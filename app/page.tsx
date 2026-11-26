"use client";

import Link from "next/link";
import {
  ArrowRight,
  Cpu,
  GitBranch,
  Layers,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useDesigns } from "@/app/components/DesignProvider";
import { PROVIDERS } from "@/lib/designs";
import { cn } from "cn";

export default function DashboardOverviewPage() {
  const { designs, provider, defaultScale } = useDesigns();

  const totalComponents = designs.reduce(
    (sum, item) => sum + (item.design.components?.length ?? 0),
    0
  );
  const totalTradeoffs = designs.reduce(
    (sum, item) => sum + (item.design.tradeoffs?.length ?? 0),
    0
  );
  const activeProvider = PROVIDERS.find((p) => p.id === provider);
  const latestDesign = designs[0];

  return (
    <div className="space-y-6">
      {/* KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Architectures</CardDescription>
            <GitBranch className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{designs.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Saved blueprints in workspace
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Mapped Components</CardDescription>
            <Layers className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalComponents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {totalTradeoffs} documented tradeoffs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Active AI Provider</CardDescription>
            <Cpu className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold truncate">
              {activeProvider?.label ?? "Pollinations AI"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeProvider?.note ?? "Free • No API Key"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Default Scale Target</CardDescription>
            <Zap className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold truncate">{defaultScale}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Configurable in studio & settings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Recent Designs Table + Latest Blueprint Preview */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Recent System Designs</CardTitle>
              <CardDescription>
                Open any saved architecture in the Design Studio
              </CardDescription>
            </div>
            <Link
              href="/history"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              View All
            </Link>
          </CardHeader>
          <CardContent>
            {designs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  No architectures generated yet.
                </p>
                <Link href="/studio" className={cn(buttonVariants({ size: "sm" }))}>
                  <Sparkles className="size-3.5" />
                  Create First Design
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Architecture</TableHead>
                    <TableHead>Scale</TableHead>
                    <TableHead className="hidden sm:table-cell">Nodes</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {designs.slice(0, 5).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium line-clamp-1">
                          {item.design.title}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {item.focus}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {item.scale.split(" ")[0]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">
                        {item.design.components.length} services
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/studio?id=${encodeURIComponent(item.id)}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" })
                          )}
                        >
                          Open
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {latestDesign ? (
          <Card className="lg:col-span-5 flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">Latest Blueprint</Badge>
                <span className="text-xs font-mono text-muted-foreground">
                  {latestDesign.scale}
                </span>
              </div>
              <CardTitle className="mt-2">{latestDesign.design.title}</CardTitle>
              <CardDescription className="line-clamp-3">
                {latestDesign.design.summary}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Core Components
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {latestDesign.design.components.map((comp) => (
                    <Badge key={comp.name} variant="secondary">
                      {comp.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Link
                href={`/studio?id=${encodeURIComponent(latestDesign.id)}`}
                className={cn(buttonVariants({ className: "w-full" }))}
              >
                <Sparkles className="size-4" />
                Inspect in Studio
              </Link>
            </CardFooter>
          </Card>
        ) : (
          <Card className="lg:col-span-5 flex flex-col justify-between">
            <CardHeader>
              <Badge variant="outline" className="w-fit">
                Latest Blueprint
              </Badge>
              <CardTitle className="mt-2">No Blueprint Yet</CardTitle>
              <CardDescription>
                Explain any software project in the Design Studio to generate
                its architecture diagram and every system flow.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Link
                href="/studio"
                className={cn(buttonVariants({ className: "w-full" }))}
              >
                <Sparkles className="size-4" />
                Open Design Studio
              </Link>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
