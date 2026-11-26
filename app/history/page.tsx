"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDesigns } from "@/app/components/DesignProvider";
import { cn } from "cn";

export default function HistoryPage() {
  const { designs, deleteDesign } = useDesigns();
  const [query, setQuery] = useState("");

  const filtered = designs.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      item.design.title.toLowerCase().includes(q) ||
      item.prompt.toLowerCase().includes(q) ||
      item.focus.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved designs..."
            className="pl-8"
          />
        </div>
        <Link href="/studio" className={cn(buttonVariants({ size: "sm" }))}>
          New Architecture
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saved Architectures ({filtered.length})</CardTitle>
          <CardDescription>
            Projects saved to your Firebase account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {designs.length === 0
                ? "No saved projects yet. Generate a design in the Studio and click Save Project."
                : "No saved designs matched your search."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title &amp; Prompt</TableHead>
                  <TableHead>Scale</TableHead>
                  <TableHead className="hidden md:table-cell">User ID &amp; Provider</TableHead>
                  <TableHead className="hidden sm:table-cell">Components</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-md">
                      <div className="font-medium line-clamp-1">
                        {item.design.title}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {item.prompt}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        {item.scale.split(" ")[0]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="space-y-0.5">
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {item.provider}
                        </Badge>
                        {item.userId && (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            UID: {item.userId}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">
                      {item.design.components.length}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/studio?id=${encodeURIComponent(item.id)}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" })
                          )}
                        >
                          Open
                          <ArrowRight className="size-3.5" />
                        </Link>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${item.design.title}`}
                          onClick={() => deleteDesign(item.id)}
                        >
                          <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
