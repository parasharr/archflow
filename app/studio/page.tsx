"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  Layers,
  GitBranch,
  Scale,
  Loader2,
  AlertCircle,
  KeyRound,
  Workflow,
  Save,
  Check,
  UserCheck,
} from "lucide-react";
import MermaidDiagram from "@/app/components/MermaidDiagram";
import type { AiProvider } from "@/app/api/design/route";
import { useAuth } from "@/app/components/AuthProvider";
import { useDesigns } from "@/app/components/DesignProvider";
import {
  FOCUS_OPTIONS,
  PROVIDERS,
  SCALE_OPTIONS,
  type SystemDesignOutput,
} from "@/lib/designs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

function StudioContent() {
  const searchParams = useSearchParams();
  const designIdParam = searchParams.get("id");

  return (
    <StudioForm
      key={designIdParam ?? "new"}
      designIdParam={designIdParam}
    />
  );
}

function StudioForm({ designIdParam }: { designIdParam: string | null }) {
  const { user, openAuthModal } = useAuth();
  const {
    designs,
    activeDesign,
    saveProjectToCloud,
    provider,
    setProvider,
    apiKeys,
    setApiKeyForProvider,
    customModels,
    customEndpoint,
    defaultScale,
    defaultFocus,
  } = useDesigns();

  const matchedDesign = designIdParam
    ? designs.find((d) => d.id === designIdParam)
    : undefined;

  const initialDesignRecord = matchedDesign ?? activeDesign ?? null;

  const [prompt, setPrompt] = useState(initialDesignRecord?.prompt ?? "");
  const [scale, setScale] = useState(matchedDesign?.scale ?? defaultScale);
  const [focus, setFocus] = useState(matchedDesign?.focus ?? defaultFocus);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [currentDesign, setCurrentDesign] = useState<SystemDesignOutput | null>(
    initialDesignRecord?.design ?? null
  );
  const [currentScaleLabel, setCurrentScaleLabel] = useState(
    initialDesignRecord?.scale ?? defaultScale
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedProjectInfo, setSavedProjectInfo] = useState<{
    projectId: string;
    userId: string;
  } | null>(
    initialDesignRecord?.savedToCloud && initialDesignRecord.userId
      ? {
          projectId: initialDesignRecord.id,
          userId: initialDesignRecord.userId,
        }
      : null
  );
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("diagram");

  const availableProviders = PROVIDERS.filter((p) => {
    if (p.id === provider) return true;
    if (!p.requiresKey) return true;
    if (p.id === "custom") {
      return Boolean(customEndpoint.trim() && customModels.custom?.trim());
    }
    return Boolean(apiKeys[p.id]?.trim());
  });

  const currentProviderMeta = PROVIDERS.find((p) => p.id === provider);
  const currentApiKey = apiKeys[provider] ?? "";

  const performSave = async (
    targetUser: NonNullable<typeof user>
  ) => {
    if (!currentDesign) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveProjectToCloud(
        {
          prompt,
          scale,
          focus,
          provider,
          design: currentDesign,
        },
        targetUser
      );
      setSavedProjectInfo({
        projectId: saved.id,
        userId: saved.userId ?? targetUser.uid,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save project to Firebase."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = () => {
    if (!currentDesign) return;
    if (!user) {
      openAuthModal(async (loggedInUser) => {
        await performSave(loggedInUser);
      });
      return;
    }
    void performSave(user);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          scale,
          focus,
          provider,
          apiKey: currentApiKey,
          customEndpoint,
          customModel: customModels[provider],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate architecture.");
      }

      setCurrentDesign(data.design as SystemDesignOutput);
      setCurrentScaleLabel(scale);
      setSavedProjectInfo(null);
      setActiveTab("flows");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const flows = currentDesign?.flows ?? [];
  const components = currentDesign?.components ?? [];
  const dataFlow = currentDesign?.dataFlow ?? [];
  const tradeoffs = currentDesign?.tradeoffs ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Control Panel */}
      <section className="lg:col-span-4 space-y-6 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Project Prompt</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setShowKeyInput((v) => !v)}
              >
                <KeyRound className="size-3" />
                API Key
              </Button>
            </div>
            <CardDescription>
              Explain any software project and the AI will design its architecture and every flow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="system-prompt">Project Description</Label>
                <Textarea
                  id="system-prompt"
                  rows={8}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  style={{ fieldSizing: "fixed" }}
                  className="h-64 min-h-[220px] max-h-[360px] overflow-y-auto resize-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  placeholder="Describe any project: web app, mobile app, backend API, AI/ML pipeline, data platform, IoT system, or distributed service — include features, auth, storage, integrations, or real-time needs..."
                />
              </div>

              <div className="space-y-2">
                <Label>Target Scale</Label>
                <Select
                  value={scale}
                  onValueChange={(val) => {
                    if (val) setScale(val);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select target scale" />
                  </SelectTrigger>
                  <SelectContent>
                    {SCALE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Focus Area</Label>
                <Select
                  value={focus}
                  onValueChange={(val) => {
                    if (val) setFocus(val);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select focus area" />
                  </SelectTrigger>
                  <SelectContent>
                    {FOCUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>AI API Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(val) => {
                    if (val) setProvider(val as AiProvider);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label} ({p.note})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(showKeyInput || currentProviderMeta?.requiresKey) && (
                <div className="space-y-2">
                  <Label htmlFor="api-key">
                    API Key{" "}
                    {provider === "pollinations"
                      ? "(Not Needed)"
                      : "(Optional if set in .env.local)"}
                  </Label>
                  <Input
                    id="api-key"
                    type="password"
                    value={currentApiKey}
                    onChange={(e) =>
                      setApiKeyForProvider(provider, e.target.value)
                    }
                    placeholder={`Paste your free ${provider} API key...`}
                    disabled={provider === "pollinations"}
                  />
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Designing Every Flow...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Generate System Design
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Right Output Canvas */}
      <section className="lg:col-span-8 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Generation Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!currentDesign ? (
          <Card>
            <CardHeader>
              <CardTitle>Ready to Architect Any Project</CardTitle>
              <CardDescription>
                Explain any software project on the left — web apps, mobile apps,
                APIs, AI pipelines, IoT systems, or distributed services — and
                click Generate System Design to get the overall architecture and
                every individual flow diagrammed step-by-step.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-xl sm:text-2xl">
                      {currentDesign.title}
                    </CardTitle>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {currentScaleLabel}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant={savedProjectInfo ? "secondary" : "default"}
                      disabled={saving}
                      onClick={handleSaveClick}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : savedProjectInfo ? (
                        <>
                          <Check className="size-3.5 text-emerald-400" />
                          Saved
                        </>
                      ) : (
                        <>
                          <Save className="size-3.5" />
                          Save Project
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-sm leading-relaxed">
                  {currentDesign.summary}
                </CardDescription>
                {(savedProjectInfo || user) && (
                  <div className="pt-2 flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
                    {user && (
                      <Badge variant="outline" className="gap-1.5 font-mono text-[11px]">
                        <UserCheck className="size-3 text-emerald-400" />
                        User ID: {user.uid}
                      </Badge>
                    )}
                    {savedProjectInfo && (
                      <Badge variant="outline" className="font-mono text-[11px]">
                        Project ID: {savedProjectInfo.projectId}
                      </Badge>
                    )}
                  </div>
                )}
              </CardHeader>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="diagram" className="gap-1.5">
                  <GitBranch className="size-3.5" />
                  System Overview
                </TabsTrigger>
                <TabsTrigger value="flows" className="gap-1.5">
                  <Workflow className="size-3.5" />
                  Every Flow ({flows.length > 0 ? flows.length : dataFlow.length})
                </TabsTrigger>
                <TabsTrigger value="components" className="gap-1.5">
                  <Layers className="size-3.5" />
                  Components ({components.length})
                </TabsTrigger>
                <TabsTrigger value="tradeoffs" className="gap-1.5">
                  <Scale className="size-3.5" />
                  Tradeoffs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="diagram" className="space-y-6">
                <MermaidDiagram
                  chart={currentDesign.mermaid}
                  title="Overall System Architecture"
                  steps={dataFlow}
                />
                {dataFlow.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        How It Works (Step-by-Step)
                      </CardTitle>
                      <CardDescription>
                        Plain-English walkthrough of the overall system flow
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {dataFlow.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <Badge
                            variant="secondary"
                            className="size-6 rounded-full p-0 flex items-center justify-center shrink-0 font-mono text-xs"
                          >
                            {idx + 1}
                          </Badge>
                          <p className="text-sm leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="flows" className="space-y-6">
                {flows.length > 0 ? (
                  flows.map((flow, flowIdx) => (
                    <Card key={`${flow.name}-${flowIdx}`}>
                      <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <CardTitle className="text-base">{flow.name}</CardTitle>
                          <Badge variant="outline">{flow.category}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        {flow.mermaid && (
                          <MermaidDiagram
                            chart={flow.mermaid}
                            title={flow.name}
                            steps={flow.steps}
                          />
                        )}
                        <div className="space-y-3">
                          {flow.steps.map((step, stepIdx) => (
                            <div key={stepIdx} className="flex items-start gap-3">
                              <Badge
                                variant="secondary"
                                className="size-6 rounded-full p-0 flex items-center justify-center shrink-0 font-mono text-xs"
                              >
                                {stepIdx + 1}
                              </Badge>
                              <p className="text-sm leading-relaxed">{step}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Request & Data Flow</CardTitle>
                      <CardDescription>
                        Step-by-step execution path across system boundaries
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {dataFlow.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <Badge
                            variant="secondary"
                            className="size-6 rounded-full p-0 flex items-center justify-center shrink-0 font-mono text-xs"
                          >
                            {idx + 1}
                          </Badge>
                          <p className="text-sm leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="components">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {components.map((comp, idx) => (
                    <Card key={`${comp.name}-${idx}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{comp.name}</CardTitle>
                          <Badge variant="outline" className="font-mono text-[11px] shrink-0">
                            {comp.tech}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">{comp.role}</p>
                        <Separator />
                        <p className="text-xs font-mono text-muted-foreground">
                          Scaling: {comp.scalingNote}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="tradeoffs">
                <div className="space-y-4">
                  {tradeoffs.map((item, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{item.topic}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {item.decision}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </section>
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Loading Design Studio...
        </div>
      }
    >
      <StudioContent />
    </Suspense>
  );
}
