"use client";

import { useState } from "react";
import { Loader2, LogIn, UserPlus, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/app/components/AuthProvider";

export function AuthDialog() {
  const {
    authModalOpen,
    setAuthModalOpen,
    signInWithEmail,
    registerWithEmail,
    signInWithGoogle,
  } = useAuth();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Google sign-in failed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      if (tab === "login") {
        await signInWithEmail(email.trim(), password);
      } else {
        await registerWithEmail(name.trim(), email.trim(), password);
      }
      setPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Authentication failed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to Save Your Project</DialogTitle>
          <DialogDescription>
            Authenticate with Google or Email &amp; Password to save your
            architecture and flows to Firebase under your User ID.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={submitting}
            onClick={handleGoogle}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
            )}
            Continue with Google
          </Button>

          <div className="relative flex items-center py-1">
            <Separator className="flex-1" />
            <span className="px-3 text-[11px] uppercase text-muted-foreground">
              or with email
            </span>
            <Separator className="flex-1" />
          </div>

          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as "login" | "register");
              setError(null);
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="pt-3">
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="auth-login-email">Email</Label>
                  <Input
                    id="auth-login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-login-password">Password</Label>
                  <Input
                    id="auth-login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LogIn className="size-4" />
                  )}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="pt-3">
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="auth-reg-name">Full Name</Label>
                  <Input
                    id="auth-reg-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-reg-email">Email</Label>
                  <Input
                    id="auth-reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-reg-password">Password</Label>
                  <Input
                    id="auth-reg-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
