"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Server, Trash2, Cloud } from "lucide-react";
import type { AiProvider } from "@/app/api/design/route";
import { useAuth } from "@/app/components/AuthProvider";
import { useDesigns } from "@/app/components/DesignProvider";
import { FOCUS_OPTIONS, PROVIDERS, SCALE_OPTIONS } from "@/lib/designs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CUSTOM_PRESETS = [
  {
    label: "DeepSeek",
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
  },
  {
    label: "Together AI",
    endpoint: "https://api.together.xyz/v1/chat/completions",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  },
  {
    label: "Fireworks AI",
    endpoint: "https://api.fireworks.ai/inference/v1/chat/completions",
    model: "accounts/fireworks/models/llama-v3p3-70b-instruct",
  },
  {
    label: "Local Ollama",
    endpoint: "http://localhost:11434/v1/chat/completions",
    model: "llama3.2",
  },
];

export default function SettingsPage() {
  const { user, openAuthModal } = useAuth();
  const {
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
  } = useDesigns();

  const [savedNotice, setSavedNotice] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  const flashSaved = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  const toggleReveal = (id: string) => {
    setRevealedKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Default Studio Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Studio Defaults</CardTitle>
              <CardDescription>
                Pre-selected scale and architectural focus for new designs
              </CardDescription>
            </div>
            {savedNotice ? (
              <Badge variant="secondary" className="gap-1">
                <Check className="size-3" />
                {user ? "Saved to Firebase" : "Saved locally"}
              </Badge>
            ) : user ? (
              <Badge variant="outline" className="gap-1.5 font-mono text-[11px]">
                <Cloud className="size-3 text-emerald-400" />
                Synced • UID: {user.uid.slice(0, 8)}...
              </Badge>
            ) : (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => openAuthModal()}
              >
                <Cloud className="size-3" />
                Sign in to sync to Firebase
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default Target Scale</Label>
            <Select
              value={defaultScale}
              onValueChange={(val) => {
                if (val) {
                  setDefaultScale(val);
                  flashSaved();
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
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
            <Label>Default Focus Area</Label>
            <Select
              value={defaultFocus}
              onValueChange={(val) => {
                if (val) {
                  setDefaultFocus(val);
                  flashSaved();
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
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
        </CardContent>
      </Card>

      {/* Custom / Paid API Key Setup (BYOK) */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="size-4 text-primary" />
                Custom / Paid API Setup (BYOK)
              </CardTitle>
              <CardDescription>
                Bring your own paid or self-hosted OpenAI-compatible API key,
                endpoint URL, and model ID.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant={provider === "custom" ? "default" : "outline"}
              onClick={() => {
                setProvider("custom");
                flashSaved();
              }}
            >
              {provider === "custom" ? "Active" : "Use Custom Setup"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">
              Quick Presets:
            </span>
            {CUSTOM_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                size="xs"
                variant="outline"
                onClick={() => {
                  setCustomEndpoint(preset.endpoint);
                  setCustomModelForProvider("custom", preset.model);
                  setProvider("custom");
                  flashSaved();
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="custom-endpoint">API Endpoint URL</Label>
              <Input
                id="custom-endpoint"
                type="url"
                value={customEndpoint}
                onChange={(e) => {
                  setCustomEndpoint(e.target.value);
                  flashSaved();
                }}
                placeholder="https://api.openai.com/v1/chat/completions"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="custom-model">Model ID</Label>
              <Input
                id="custom-model"
                type="text"
                value={customModels.custom ?? ""}
                onChange={(e) => {
                  setCustomModelForProvider("custom", e.target.value);
                  flashSaved();
                }}
                placeholder="e.g. gpt-4o, deepseek-chat, claude-3-7-sonnet"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="key-custom"
              className="text-xs text-muted-foreground flex items-center gap-1.5"
            >
              <KeyRound className="size-3" />
              Custom API Key
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="key-custom"
                type={revealedKeys.custom ? "text" : "password"}
                value={apiKeys.custom ?? ""}
                onChange={(e) => {
                  setApiKeyForProvider("custom", e.target.value);
                  flashSaved();
                }}
                placeholder="Paste your paid or custom API key..."
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Toggle key visibility"
                onClick={() => toggleReveal("custom")}
              >
                {revealedKeys.custom ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>
              {apiKeys.custom && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Clear custom API key"
                  onClick={() => {
                    setApiKeyForProvider("custom", "");
                    flashSaved();
                  }}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Providers & Keys */}
      <Card>
        <CardHeader>
          <CardTitle>Built-in AI Providers &amp; Keys</CardTitle>
          <CardDescription>
            Select a built-in provider and optionally paste your own free or
            paid API key and model override.{" "}
            {user
              ? "Connected APIs & keys are automatically saved to your Firebase user profile."
              : "Sign in to sync your connected APIs & keys to Firebase."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {PROVIDERS.filter((p) => p.id !== "custom").map((item) => {
            const isActive = provider === item.id;
            const currentKey = apiKeys[item.id] ?? "";
            const isRevealed = Boolean(revealedKeys[item.id]);
            return (
              <div
                key={item.id}
                className="rounded-xl border p-4 space-y-3 bg-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{item.label}</span>
                      <Badge variant="outline" className="text-[11px]">
                        {item.note}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                    onClick={() => {
                      setProvider(item.id as AiProvider);
                      flashSaved();
                    }}
                  >
                    {isActive ? "Active" : "Use Provider"}
                  </Button>
                </div>

                {item.requiresKey && (
                  <div className="grid gap-3 pt-1 sm:grid-cols-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label
                        htmlFor={`key-${item.id}`}
                        className="text-xs text-muted-foreground flex items-center gap-1.5"
                      >
                        <KeyRound className="size-3" />
                        {item.label} API Key
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          id={`key-${item.id}`}
                          type={isRevealed ? "text" : "password"}
                          value={currentKey}
                          onChange={(e) => {
                            setApiKeyForProvider(item.id, e.target.value);
                            flashSaved();
                          }}
                          placeholder={`Paste your ${item.label} API key...`}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label={`Toggle ${item.label} key visibility`}
                          onClick={() => toggleReveal(item.id)}
                        >
                          {isRevealed ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </Button>
                        {currentKey && (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label={`Clear ${item.label} key`}
                            onClick={() => {
                              setApiKeyForProvider(item.id, "");
                              flashSaved();
                            }}
                          >
                            <Trash2 className="size-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor={`model-${item.id}`}
                        className="text-xs text-muted-foreground"
                      >
                        Model (optional)
                      </Label>
                      <Input
                        id={`model-${item.id}`}
                        type="text"
                        value={customModels[item.id] ?? ""}
                        onChange={(e) => {
                          setCustomModelForProvider(item.id, e.target.value);
                          flashSaved();
                        }}
                        placeholder={item.defaultModel}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
