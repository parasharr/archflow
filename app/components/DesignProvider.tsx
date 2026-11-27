"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { AiProvider } from "@/app/api/design/route";
import type { VideoStoryboard } from "@/app/api/video/route";
import {
  hashChartKey,
  type SavedDesign,
  type SystemDesignOutput,
} from "@/lib/designs";
import { firebaseDb, initFirebaseAnalytics } from "@/lib/firebase";
import { useAuth } from "@/app/components/AuthProvider";

interface SaveProjectInput {
  prompt: string;
  scale: string;
  focus: string;
  provider: AiProvider;
  design: SystemDesignOutput;
}

interface DesignContextValue {
  designs: SavedDesign[];
  activeDesign: SavedDesign | null;
  setActiveDesignById: (id: string) => void;
  saveProjectToCloud: (
    input: SaveProjectInput,
    overrideUser?: User
  ) => Promise<SavedDesign>;
  deleteDesign: (id: string) => void;
  getVideoStoryboard: (chart: string) => VideoStoryboard | undefined;
  saveVideoStoryboard: (chart: string, storyboard: VideoStoryboard) => void;
  provider: AiProvider;
  setProvider: (provider: AiProvider) => void;
  apiKeys: Partial<Record<AiProvider, string>>;
  setApiKeyForProvider: (provider: AiProvider, key: string) => void;
  customModels: Partial<Record<AiProvider, string>>;
  setCustomModelForProvider: (provider: AiProvider, model: string) => void;
  customEndpoint: string;
  setCustomEndpoint: (endpoint: string) => void;
  defaultScale: string;
  setDefaultScale: (scale: string) => void;
  defaultFocus: string;
  setDefaultFocus: (focus: string) => void;
}

const STORAGE_KEYS = {
  provider: "archflow_provider_v1",
  apiKeys: "archflow_api_keys_v1",
  customModels: "archflow_custom_models_v1",
  customEndpoint: "archflow_custom_endpoint_v1",
  scale: "archflow_default_scale_v2",
  focus: "archflow_default_focus_v2",
  videos: "archflow_video_cache_v1",
};

const DesignContext = createContext<DesignContextValue | null>(null);

export function DesignProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [activeDesignId, setActiveDesignId] = useState<string | null>(null);
  const [videoCache, setVideoCache] = useState<Record<string, VideoStoryboard>>(
    {}
  );
  const [provider, setProviderState] = useState<AiProvider>("pollinations");
  const [apiKeys, setApiKeys] = useState<Partial<Record<AiProvider, string>>>({});
  const [customModels, setCustomModels] = useState<
    Partial<Record<AiProvider, string>>
  >({});
  const [customEndpoint, setCustomEndpointState] = useState<string>("");
  const [defaultScale, setDefaultScaleState] = useState("Growth (1M Users)");
  const [defaultFocus, setDefaultFocusState] = useState(
    "End-to-End Architecture"
  );
  const settingsSyncTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void initFirebaseAnalytics();
    const id = window.setTimeout(() => {
      try {
        localStorage.removeItem("archflow_designs_v1");
        localStorage.removeItem("archflow_designs_v2");
        const savedProvider = localStorage.getItem(
          STORAGE_KEYS.provider
        ) as AiProvider | null;
        if (savedProvider) setProviderState(savedProvider);

        const savedKeys = localStorage.getItem(STORAGE_KEYS.apiKeys);
        if (savedKeys) setApiKeys(JSON.parse(savedKeys));

        const savedModels = localStorage.getItem(STORAGE_KEYS.customModels);
        if (savedModels) setCustomModels(JSON.parse(savedModels));

        const savedEndpoint = localStorage.getItem(STORAGE_KEYS.customEndpoint);
        if (savedEndpoint) setCustomEndpointState(savedEndpoint);

        const savedScale = localStorage.getItem(STORAGE_KEYS.scale);
        if (savedScale) setDefaultScaleState(savedScale);

        const savedFocus = localStorage.getItem(STORAGE_KEYS.focus);
        if (savedFocus) setDefaultFocusState(savedFocus);

        const savedVideos = localStorage.getItem(STORAGE_KEYS.videos);
        if (savedVideos) {
          setVideoCache(JSON.parse(savedVideos) as Record<string, VideoStoryboard>);
        }
      } catch {
        // Ignore malformed localStorage entries
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Load user's saved projects and connected API settings from Firestore when logged in
  useEffect(() => {
    if (!user || !firebaseDb) {
      const clearId = window.setTimeout(() => {
        setDesigns([]);
        setActiveDesignId(null);
      }, 0);
      return () => window.clearTimeout(clearId);
    }
    const db = firebaseDb;
    const uid = user.uid;
    let cancelled = false;

    async function fetchCloudData() {
      try {
        const [projectsSnap, userSnap] = await Promise.all([
          getDocs(query(collection(db, "projects"), where("userId", "==", uid))),
          getDoc(doc(db, "users", uid)),
        ]);
        if (cancelled) return;

        // Hydrate connected API settings from users/{uid}
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const apiSettings = userData?.apiSettings as
            | {
                provider?: AiProvider;
                apiKeys?: Partial<Record<AiProvider, string>>;
                customModels?: Partial<Record<AiProvider, string>>;
                customEndpoint?: string;
                defaultScale?: string;
                defaultFocus?: string;
              }
            | undefined;

          if (apiSettings) {
            if (apiSettings.provider) {
              setProviderState(apiSettings.provider);
              try {
                localStorage.setItem(STORAGE_KEYS.provider, apiSettings.provider);
              } catch {}
            }
            if (apiSettings.apiKeys) {
              setApiKeys(apiSettings.apiKeys);
              try {
                localStorage.setItem(
                  STORAGE_KEYS.apiKeys,
                  JSON.stringify(apiSettings.apiKeys)
                );
              } catch {}
            }
            if (apiSettings.customModels) {
              setCustomModels(apiSettings.customModels);
              try {
                localStorage.setItem(
                  STORAGE_KEYS.customModels,
                  JSON.stringify(apiSettings.customModels)
                );
              } catch {}
            }
            if (typeof apiSettings.customEndpoint === "string") {
              setCustomEndpointState(apiSettings.customEndpoint);
              try {
                localStorage.setItem(
                  STORAGE_KEYS.customEndpoint,
                  apiSettings.customEndpoint
                );
              } catch {}
            }
            if (apiSettings.defaultScale) {
              setDefaultScaleState(apiSettings.defaultScale);
              try {
                localStorage.setItem(
                  STORAGE_KEYS.scale,
                  apiSettings.defaultScale
                );
              } catch {}
            }
            if (apiSettings.defaultFocus) {
              setDefaultFocusState(apiSettings.defaultFocus);
              try {
                localStorage.setItem(
                  STORAGE_KEYS.focus,
                  apiSettings.defaultFocus
                );
              } catch {}
            }
          }
        }

        const cloudList: SavedDesign[] = projectsSnap.docs.map((d) => {
          const data = d.data();
          const created =
            data.createdAt && typeof data.createdAt.toDate === "function"
              ? data.createdAt.toDate().toISOString()
              : new Date().toISOString();
          return {
            id: d.id,
            userId: String(data.userId ?? uid),
            userEmail:
              typeof data.userEmail === "string" ? data.userEmail : undefined,
            savedToCloud: true,
            videos:
              data.videos && typeof data.videos === "object"
                ? (data.videos as Record<string, VideoStoryboard>)
                : undefined,
            prompt: String(data.prompt ?? ""),
            scale: String(data.scale ?? "Growth (1M Users)"),
            focus: String(data.focus ?? "End-to-End Architecture"),
            provider: (data.provider as AiProvider) ?? "pollinations",
            createdAt: created,
            design: data.design as SystemDesignOutput,
          };
        });

        cloudList.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setDesigns(cloudList);
        if (cloudList.length > 0) {
          setActiveDesignId((prev) => prev ?? cloudList[0].id);
        }

        // Hydrate videoCache from cloud projects so saved videos open instantly
        const cloudVideos: Record<string, VideoStoryboard> = {};
        for (const item of cloudList) {
          if (item.videos) {
            Object.assign(cloudVideos, item.videos);
          }
        }
        if (Object.keys(cloudVideos).length > 0) {
          setVideoCache((prev) => ({ ...prev, ...cloudVideos }));
        }
      } catch {
        // Ignore Firestore read errors (e.g., offline or rules)
      }
    }

    void fetchCloudData();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const scheduleCloudSettingsSync = useCallback(
    (overrides: {
      provider?: AiProvider;
      apiKeys?: Partial<Record<AiProvider, string>>;
      customModels?: Partial<Record<AiProvider, string>>;
      customEndpoint?: string;
      defaultScale?: string;
      defaultFocus?: string;
    }) => {
      if (!user || !firebaseDb) return;
      const db = firebaseDb;
      const uid = user.uid;
      if (settingsSyncTimerRef.current) {
        window.clearTimeout(settingsSyncTimerRef.current);
      }
      const payload = {
        provider: overrides.provider ?? provider,
        apiKeys: overrides.apiKeys ?? apiKeys,
        customModels: overrides.customModels ?? customModels,
        customEndpoint: overrides.customEndpoint ?? customEndpoint,
        defaultScale: overrides.defaultScale ?? defaultScale,
        defaultFocus: overrides.defaultFocus ?? defaultFocus,
      };
      settingsSyncTimerRef.current = window.setTimeout(() => {
        void setDoc(
          doc(db, "users", uid),
          {
            uid,
            apiSettings: payload,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});
      }, 350);
    },
    [user, provider, apiKeys, customModels, customEndpoint, defaultScale, defaultFocus]
  );

  const setProvider = (next: AiProvider) => {
    setProviderState(next);
    try {
      localStorage.setItem(STORAGE_KEYS.provider, next);
    } catch {}
    scheduleCloudSettingsSync({ provider: next });
  };

  const setApiKeyForProvider = (target: AiProvider, key: string) => {
    setApiKeys((prev) => {
      const updated = { ...prev, [target]: key };
      try {
        localStorage.setItem(STORAGE_KEYS.apiKeys, JSON.stringify(updated));
      } catch {}
      scheduleCloudSettingsSync({ apiKeys: updated });
      return updated;
    });
  };

  const setCustomModelForProvider = (target: AiProvider, model: string) => {
    setCustomModels((prev) => {
      const updated = { ...prev, [target]: model };
      try {
        localStorage.setItem(STORAGE_KEYS.customModels, JSON.stringify(updated));
      } catch {}
      scheduleCloudSettingsSync({ customModels: updated });
      return updated;
    });
  };

  const setCustomEndpoint = (next: string) => {
    setCustomEndpointState(next);
    try {
      localStorage.setItem(STORAGE_KEYS.customEndpoint, next);
    } catch {}
    scheduleCloudSettingsSync({ customEndpoint: next });
  };

  const setDefaultScale = (next: string) => {
    setDefaultScaleState(next);
    try {
      localStorage.setItem(STORAGE_KEYS.scale, next);
    } catch {}
    scheduleCloudSettingsSync({ defaultScale: next });
  };

  const setDefaultFocus = (next: string) => {
    setDefaultFocusState(next);
    try {
      localStorage.setItem(STORAGE_KEYS.focus, next);
    } catch {}
    scheduleCloudSettingsSync({ defaultFocus: next });
  };

  const saveProjectToCloud = useCallback(
    async (input: SaveProjectInput, overrideUser?: User) => {
      const targetUser = overrideUser ?? user;
      if (!targetUser) {
        throw new Error("You must be signed in to save a project.");
      }
      if (!firebaseDb) {
        throw new Error("Firebase Firestore is not configured.");
      }

      // Collect any already-generated videos for this design's charts
      const projectVideos: Record<string, VideoStoryboard> = {};
      const charts = [
        input.design.mermaid,
        ...(input.design.flows?.map((f) => f.mermaid) ?? []),
      ].filter(Boolean);
      for (const c of charts) {
        const key = hashChartKey(c);
        if (videoCache[key]) {
          projectVideos[key] = videoCache[key];
        }
      }

      const docRef = await addDoc(collection(firebaseDb, "projects"), {
        userId: targetUser.uid,
        userEmail: targetUser.email ?? "",
        prompt: input.prompt,
        scale: input.scale,
        focus: input.focus,
        provider: input.provider,
        design: input.design,
        videos: projectVideos,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const savedEntry: SavedDesign = {
        id: docRef.id,
        userId: targetUser.uid,
        userEmail: targetUser.email ?? "",
        savedToCloud: true,
        videos: projectVideos,
        prompt: input.prompt,
        scale: input.scale,
        focus: input.focus,
        provider: input.provider,
        createdAt: new Date().toISOString(),
        design: input.design,
      };

      setDesigns((prev) => [savedEntry, ...prev]);
      setActiveDesignId(savedEntry.id);
      return savedEntry;
    },
    [user, videoCache]
  );

  const getVideoStoryboard = useCallback(
    (chart: string) => {
      return videoCache[hashChartKey(chart)];
    },
    [videoCache]
  );

  const saveVideoStoryboard = useCallback(
    (chart: string, storyboard: VideoStoryboard) => {
      const key = hashChartKey(chart);
      setVideoCache((prev) => {
        const next = { ...prev, [key]: storyboard };
        try {
          localStorage.setItem(STORAGE_KEYS.videos, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Also persist onto any matching cloud-saved project in Firestore
      const matchingProject = designs.find(
        (d) =>
          d.savedToCloud &&
          (d.design.mermaid === chart ||
            d.design.flows?.some((f) => f.mermaid === chart))
      );
      if (matchingProject && firebaseDb) {
        void updateDoc(doc(firebaseDb, "projects", matchingProject.id), {
          [`videos.${key}`]: storyboard,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    },
    [designs]
  );

  const deleteDesign = (id: string) => {
    const target = designs.find((d) => d.id === id);
    if (target?.savedToCloud && firebaseDb) {
      void deleteDoc(doc(firebaseDb, "projects", id)).catch(() => {});
    }
    setDesigns((prev) => {
      const nextList = prev.filter((d) => d.id !== id);
      if (activeDesignId === id) {
        setActiveDesignId(nextList[0]?.id ?? null);
      }
      return nextList;
    });
  };

  const activeDesign =
    designs.find((d) => d.id === activeDesignId) ?? designs[0] ?? null;

  return (
    <DesignContext.Provider
      value={{
        designs,
        activeDesign,
        setActiveDesignById: setActiveDesignId,
        saveProjectToCloud,
        deleteDesign,
        getVideoStoryboard,
        saveVideoStoryboard,
        provider,
        setProvider,
        apiKeys,
        setApiKeyForProvider,
        customModels,
        setCustomModelForProvider,
        customEndpoint,
        setCustomEndpoint,
        defaultScale,
        setDefaultScale,
        defaultFocus,
        setDefaultFocus,
      }}
    >
      {children}
    </DesignContext.Provider>
  );
}

export function useDesigns() {
  const ctx = useContext(DesignContext);
  if (!ctx) {
    throw new Error("useDesigns must be used within a DesignProvider");
  }
  return ctx;
}
