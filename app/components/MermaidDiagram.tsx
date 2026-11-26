"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  Copy,
  Check,
  Download,
  Code2,
  Eye,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Activity,
  Video,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlowVideoPlayer } from "@/app/components/FlowVideoPlayer";
import { useDesigns } from "@/app/components/DesignProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MermaidDiagramProps {
  chart: string;
  title?: string;
  steps?: string[];
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

function ZoomableCanvas({
  svg,
  zoom,
  pan,
  animateFlow,
  activeStep,
  onZoomChange,
  onPanChange,
  className = "min-h-[380px]",
}: {
  svg: string;
  zoom: number;
  pan: { x: number; y: number };
  animateFlow: boolean;
  activeStep: number | null;
  onZoomChange: (updater: (prev: number) => number) => void;
  onPanChange: (next: { x: number; y: number }) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      onZoomChange((prev) =>
        Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((prev + delta).toFixed(2))))
      );
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [onZoomChange]);

  // Highlight active step's edge & connected nodes in the rendered SVG
  useEffect(() => {
    const root = svgWrapperRef.current;
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll("g.node"));
    const links = Array.from(root.querySelectorAll("path.flowchart-link"));
    const labels = Array.from(root.querySelectorAll("g.edgeLabel"));

    nodes.forEach((n) => n.classList.remove("archflow-active"));
    links.forEach((l) => l.classList.remove("archflow-active"));
    labels.forEach((l) => l.classList.remove("archflow-active"));

    if (activeStep === null) return;

    const stepNum = activeStep + 1;
    // Match edge label starting with "1." / "1:" or fallback to activeStep index
    let targetIdx = labels.findIndex((el) => {
      const txt = el.textContent?.trim() ?? "";
      return new RegExp(`^${stepNum}[.:\\s]`).test(txt);
    });
    if (targetIdx === -1 && links.length > 0) {
      targetIdx = activeStep % links.length;
    }

    if (targetIdx >= 0) {
      links[targetIdx]?.classList.add("archflow-active");
      labels[targetIdx]?.classList.add("archflow-active");

      // Highlight adjacent nodes by index or link id
      const linkId = links[targetIdx]?.getAttribute("id") ?? "";
      const matchedNodes = nodes.filter((n) => {
        const nodeId = n.getAttribute("data-id") ?? n.getAttribute("id") ?? "";
        return nodeId && linkId.includes(nodeId);
      });
      if (matchedNodes.length > 0) {
        matchedNodes.forEach((n) => n.classList.add("archflow-active"));
      } else if (nodes.length > 0) {
        nodes[activeStep % nodes.length]?.classList.add("archflow-active");
        nodes[(activeStep + 1) % nodes.length]?.classList.add("archflow-active");
      }
    }
  }, [svg, activeStep]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    setDragging(true);
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    onPanChange({ x: pan.x + dx, y: pan.y + dy });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative overflow-hidden flex items-center justify-center select-none p-6 ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      } ${animateFlow ? "archflow-animated" : ""} ${
        activeStep !== null ? "archflow-stepping" : ""
      } ${className}`}
    >
      <div
        ref={svgWrapperRef}
        className="transition-transform duration-75 ease-out [&_svg]:max-w-none [&_svg]:h-auto"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <span className="pointer-events-none absolute bottom-2.5 right-3 rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-mono text-muted-foreground border border-border">
        Scroll to zoom • Drag to pan
      </span>
    </div>
  );
}

export default function MermaidDiagram({
  chart,
  title = "Architecture Flow",
  steps = [],
}: MermaidDiagramProps) {
  const rawId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [expanded, setExpanded] = useState(false);
  const [animateFlow, setAnimateFlow] = useState(true);
  const { getVideoStoryboard } = useDesigns();
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const hasGeneratedVideo = Boolean(getVideoStoryboard(chart));

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      if (!chart.trim()) return;
      try {
        setError(null);
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          themeVariables: {
            primaryColor: "#18181b",
            primaryTextColor: "#f4f4f5",
            primaryBorderColor: "#8b5cf6",
            lineColor: "#a78bfa",
            secondaryColor: "#27272a",
            tertiaryColor: "#09090b",
            edgeLabelBackground: "#18181b",
            tertiaryTextColor: "#e4e4e7",
            fontFamily: "var(--font-sans), sans-serif",
          },
        });

        const { svg: renderedSvg } = await mermaid.render(
          `archflow-${rawId}`,
          chart
        );
        if (!cancelled) {
          setSvg(renderedSvg);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not render Mermaid diagram syntax."
          );
        }
      }
    }

    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [chart, rawId]);

  useEffect(() => {
    if (!playing || steps.length === 0) return;
    const timer = window.setInterval(() => {
      setActiveStep((prev) => {
        if (prev === null) return 0;
        if (prev >= steps.length - 1) return 0;
        return prev + 1;
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [playing, steps.length]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(chart);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "archflow-diagram.svg";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleZoomIn = () =>
    setZoom((z) => Math.min(MAX_ZOOM, Number((z + ZOOM_STEP).toFixed(2))));
  const handleZoomOut = () =>
    setZoom((z) => Math.max(MIN_ZOOM, Number((z - ZOOM_STEP).toFixed(2))));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleTogglePlay = () => {
    if (playing) {
      setPlaying(false);
    } else {
      if (activeStep === null) setActiveStep(0);
      setPlaying(true);
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b py-3">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {title}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            {!showCode && !error && svg && (
              <>
                <Button
                  type="button"
                  variant={hasGeneratedVideo ? "secondary" : "default"}
                  size="sm"
                  onClick={() => setVideoOpen(true)}
                  title={
                    hasGeneratedVideo
                      ? "Open generated AI explainer video"
                      : "Create AI explainer video for this flowchart"
                  }
                >
                  <Video className="size-3.5" />
                  {hasGeneratedVideo ? "View Video" : "AI Video"}
                </Button>
                <Button
                  type="button"
                  variant={animateFlow ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setAnimateFlow((v) => !v)}
                  title="Toggle animated data flow"
                >
                  <Activity className="size-3.5" />
                  {animateFlow ? "Flowing" : "Static"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Zoom out"
                  onClick={handleZoomOut}
                  disabled={zoom <= MIN_ZOOM}
                >
                  <ZoomOut className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetView}
                  className="font-mono text-xs px-2 min-w-[3.25rem]"
                  title="Reset zoom & pan"
                >
                  {Math.round(zoom * 100)}%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Zoom in"
                  onClick={handleZoomIn}
                  disabled={zoom >= MAX_ZOOM}
                >
                  <ZoomIn className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Reset view"
                  onClick={handleResetView}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Expand diagram"
                  onClick={() => setExpanded(true)}
                >
                  <Maximize2 className="size-3.5" />
                </Button>
              </>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCode((v) => !v)}
            >
              {showCode ? <Eye className="size-3.5" /> : <Code2 className="size-3.5" />}
              {showCode ? "Diagram" : "Mermaid"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
            {svg && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadSvg}
              >
                <Download className="size-3.5" />
                SVG
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {showCode ? (
            <pre className="p-5 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed">
              {chart}
            </pre>
          ) : error ? (
            <div className="p-6 space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Diagram preview fallback (syntax warning)</AlertTitle>
                <AlertDescription className="font-mono text-xs">
                  {error}
                </AlertDescription>
              </Alert>
              <pre className="p-4 rounded-lg border bg-muted/50 text-xs font-mono text-muted-foreground overflow-x-auto">
                {chart}
              </pre>
            </div>
          ) : (
            <>
              <ZoomableCanvas
                svg={svg}
                zoom={zoom}
                pan={pan}
                animateFlow={animateFlow}
                activeStep={activeStep}
                onZoomChange={setZoom}
                onPanChange={setPan}
              />

              {steps.length > 0 && (
                <div className="border-t bg-muted/30 px-4 py-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant={playing ? "default" : "outline"}
                      onClick={handleTogglePlay}
                    >
                      {playing ? (
                        <Pause className="size-3.5" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                      {playing ? "Pause" : "Simulate"}
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      aria-label="Previous step"
                      onClick={() => {
                        setPlaying(false);
                        setActiveStep((prev) =>
                          prev === null || prev <= 0
                            ? steps.length - 1
                            : prev - 1
                        );
                      }}
                    >
                      <SkipBack className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      aria-label="Next step"
                      onClick={() => {
                        setPlaying(false);
                        setActiveStep((prev) =>
                          prev === null || prev >= steps.length - 1
                            ? 0
                            : prev + 1
                        );
                      }}
                    >
                      <SkipForward className="size-3.5" />
                    </Button>
                    {activeStep !== null && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPlaying(false);
                          setActiveStep(null);
                        }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    {activeStep !== null ? (
                      <>
                        <Badge variant="secondary" className="font-mono text-xs shrink-0">
                          Step {activeStep + 1}/{steps.length}
                        </Badge>
                        <p className="text-xs text-foreground truncate">
                          {steps[activeStep]}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Click <strong>Simulate</strong> to visualize each step through the flowchart
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[92vw] sm:max-w-[92vw] w-[92vw] h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="flex flex-row items-center justify-between border-b px-4 py-3 pr-12">
            <DialogTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {title}
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              {steps.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant={playing ? "default" : "outline"}
                  onClick={handleTogglePlay}
                >
                  {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  {playing ? "Pause" : "Simulate"}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Zoom out"
                onClick={handleZoomOut}
                disabled={zoom <= MIN_ZOOM}
              >
                <ZoomOut className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetView}
                className="font-mono text-xs px-2 min-w-[3.25rem]"
              >
                {Math.round(zoom * 100)}%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Zoom in"
                onClick={handleZoomIn}
                disabled={zoom >= MAX_ZOOM}
              >
                <ZoomIn className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Reset view"
                onClick={handleResetView}
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <ZoomableCanvas
              svg={svg}
              zoom={zoom}
              pan={pan}
              animateFlow={animateFlow}
              activeStep={activeStep}
              onZoomChange={setZoom}
              onPanChange={setPan}
              className="h-full w-full"
            />
          </div>
        </DialogContent>
      </Dialog>

      <FlowVideoPlayer
        open={videoOpen}
        onOpenChange={setVideoOpen}
        title={title}
        chart={chart}
        steps={steps}
      />
    </>
  );
}
