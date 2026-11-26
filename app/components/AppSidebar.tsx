"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  History,
  Settings,
  Cpu,
  KeyRound,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useDesigns } from "@/app/components/DesignProvider";
import { PROVIDERS } from "@/lib/designs";

const NAV_ITEMS = [
  {
    title: "Overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Design Studio",
    href: "/studio",
    icon: Sparkles,
  },
  {
    title: "Saved Designs",
    href: "/history",
    icon: History,
  },
];

const CONFIG_ITEMS = [
  {
    title: "AI Providers & Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { designs, provider, apiKeys } = useDesigns();
  const activeProvider = PROVIDERS.find((p) => p.id === provider);
  const hasKey =
    !activeProvider?.requiresKey || Boolean(apiKeys[provider]?.trim());

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              tooltip="ArchFlow AI"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Cpu className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">ArchFlow AI</span>
                <span className="truncate text-xs text-muted-foreground">
                  System Design Studio
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {item.href === "/history" && (
                      <SidebarMenuBadge>{designs.length}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {CONFIG_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Active AI Provider"
              render={<Link href="/settings" />}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                <KeyRound className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-xs leading-tight">
                <span className="truncate font-medium">
                  {activeProvider?.label ?? "Pollinations AI"}
                </span>
                <span className="truncate text-muted-foreground">
                  {hasKey ? "Ready" : "Key optional / .env"}
                </span>
              </div>
              <Badge variant={hasKey ? "secondary" : "outline"} className="text-[10px]">
                {activeProvider?.requiresKey ? "Key" : "Free"}
              </Badge>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
