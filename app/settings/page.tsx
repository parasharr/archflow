"use client";

import { useState } from "react";
import { Check, KeyRound } from "lucide-react";
import type { AiProvider } from "@/app/api/design/route";
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

export default function SettingsPage() {
  const {
    provider,
    setProvider,
    apiKeys,
    setApiKeyForProvider,
    defaultScale,
    setDefaultScale,
    defaultFocus,
    setDefaultFocus,
  } = useDesigns();

  const [savedNotice, setSavedNotice] = useState(false);

  const flashSaved = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
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
            {savedNotice && (
              <Badge variant="secondary" className="gap-1">
                <Check className="size-3" />
                Saved
              </Badge>
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

      {/* AI Providers & Keys */}
      <Card>
        <CardHeader>
          <CardTitle>AI Providers & API Keys</CardTitle>
          <CardDescription>
            Select your active inference provider. Keys are stored only in your
            browser&apos;s localStorage and sent directly to /api/design.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {PROVIDERS.map((item) => {
            const isActive = provider === item.id;
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
                  <div className="space-y-1.5 pt-1">
                    <Label
                      htmlFor={`key-${item.id}`}
                      className="text-xs text-muted-foreground flex items-center gap-1.5"
                    >
                      <KeyRound className="size-3" />
                      {item.label} API Key (optional if configured in .env.local)
                    </Label>
                    <Input
                      id={`key-${item.id}`}
                      type="password"
                      value={apiKeys[item.id] ?? ""}
                      onChange={(e) => {
                        setApiKeyForProvider(item.id, e.target.value);
                        flashSaved();
                      }}
                      placeholder={`Paste your ${item.id} API key...`}
                    />
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
