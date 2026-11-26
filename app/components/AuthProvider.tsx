"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseAuth, firebaseDb, googleProvider } from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  authLoading: boolean;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  openAuthModal: (onSuccess?: (user: User) => void | Promise<void>) => void;
  signInWithEmail: (email: string, password: string) => Promise<User>;
  registerWithEmail: (
    name: string,
    email: string,
    password: string
  ) => Promise<User>;
  signInWithGoogle: () => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function upsertUserDoc(user: User, isNewUser = false) {
  if (!firebaseDb) return;
  await setDoc(
    doc(firebaseDb, "users", user.uid),
    {
      uid: user.uid,
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      photoURL: user.photoURL ?? "",
      provider: user.providerData[0]?.providerId ?? "password",
      lastLoginAt: serverTimestamp(),
      ...(isNewUser ? { createdAt: serverTimestamp() } : {}),
    },
    { merge: true }
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(firebaseAuth));
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const pendingCallbackRef = useRef<
    ((user: User) => void | Promise<void>) | null
  >(null);

  useEffect(() => {
    if (!firebaseAuth) return;
    const unsub = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const runPendingCallback = useCallback(async (loggedInUser: User) => {
    setAuthModalOpen(false);
    const cb = pendingCallbackRef.current;
    pendingCallbackRef.current = null;
    if (cb) {
      await cb(loggedInUser);
    }
  }, []);

  const openAuthModal = useCallback(
    (onSuccess?: (user: User) => void | Promise<void>) => {
      pendingCallbackRef.current = onSuccess ?? null;
      setAuthModalOpen(true);
    },
    []
  );

  const handleModalOpenChange = useCallback((open: boolean) => {
    if (!open) {
      pendingCallbackRef.current = null;
    }
    setAuthModalOpen(open);
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!firebaseAuth) {
        throw new Error("Firebase Auth is not configured.");
      }
      const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
      await upsertUserDoc(cred.user, false);
      await runPendingCallback(cred.user);
      return cred.user;
    },
    [runPendingCallback]
  );

  const registerWithEmail = useCallback(
    async (name: string, email: string, password: string) => {
      if (!firebaseAuth) {
        throw new Error("Firebase Auth is not configured.");
      }
      const cred = await createUserWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      );
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      await upsertUserDoc(cred.user, true);
      await runPendingCallback(cred.user);
      return cred.user;
    },
    [runPendingCallback]
  );

  const signInWithGoogle = useCallback(async () => {
    if (!firebaseAuth) {
      throw new Error("Firebase Auth is not configured.");
    }
    const cred = await signInWithPopup(firebaseAuth, googleProvider);
    await upsertUserDoc(cred.user, false);
    await runPendingCallback(cred.user);
    return cred.user;
  }, [runPendingCallback]);

  const logout = useCallback(async () => {
    if (!firebaseAuth) return;
    await signOut(firebaseAuth);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        authModalOpen,
        setAuthModalOpen: handleModalOpenChange,
        openAuthModal,
        signInWithEmail,
        registerWithEmail,
        signInWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
