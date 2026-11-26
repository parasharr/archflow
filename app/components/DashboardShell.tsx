"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, LogOut, Plus, Sparkles, UserCheck } from "lucide-react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppSidebar } from "@/app/components/AppSidebar";
import { useDesigns } from "@/app/components/DesignProvider";
import { useAuth } from "@/app/components/AuthProvider";
import { PROVIDERS } from "@/lib/designs";
import { cn } from "cn";

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "Dashboard Overview",
    subtitle: "Architecture metrics, recent blueprints & quick templates",
  },
  "/studio": {
    title: "Design Studio",
    subtitle: "Describe any software project & generate every system flow",
  },
  "/history": {
    title: "Saved Designs",
    subtitle: "Browse and reopen generated system architectures",
  },
  "/settings": {
    title: "AI Providers & Settings",
    subtitle: "Configure inference providers, API keys & defaults",
  },
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { provider } = useDesigns();
  const { user, openAuthModal, logout } = useAuth();
  const activeProvider = PROVIDERS.find((p) => p.id === provider);
  const meta = PAGE_META[pathname] ?? PAGE_META["/"];

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2 min-w-0">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{meta.title}</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {meta.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className="hidden md:inline-flex gap-1.5 font-mono text-[11px]"
            >
              <Sparkles className="size-3" />
              {activeProvider?.label ?? "Pollinations AI"}
            </Badge>

            {user ? (
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="hidden sm:inline-flex gap-1.5 font-mono text-[11px]"
                  title={`User ID: ${user.uid}`}
                >
                  <UserCheck className="size-3 text-emerald-400" />
                  {user.email ?? user.displayName ?? "Signed In"} • ID:{" "}
                  {user.uid.slice(0, 8)}...
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void logout()}
                  title="Sign out"
                >
                  <LogOut className="size-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openAuthModal()}
              >
                <LogIn className="size-3.5" />
                Sign In
              </Button>
            )}

            {pathname !== "/studio" && (
              <Link
                href="/studio"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                <Plus className="size-3.5" />
                New Design
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
