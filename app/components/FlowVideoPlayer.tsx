"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Loader2,
  Video,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDesigns } from "@/app/components/DesignProvider";
import type { VideoScene, VideoStoryboard } from "@/app/api/video/route";

interface FlowVideoPlayerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  chart: string;
  steps?: string[];
  onVideoReady?: () => void;
}

interface NodeBox {
  label: string;
  /** Normalized center X (0..1) within diagram image */
  nx: number;
  /** Normalized center Y (0..1) within diagram image */
  ny: number;
  /** Normalized width (0..1) */
  nw: number;
  /** Normalized height (0..1) */
  nh: number;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let score = 0;
  if (v.lang.toLowerCase().startsWith("en")) score += 50;
  if (name.includes("natural") || name.includes("neural")) score += 40;
  if (name.includes("online")) score += 25;
  if (name.includes("google")) score += 20;
  if (name.includes("aria") || name.includes("jenny") || name.includes("guy"))
    score += 15;
  return score;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function matchNodeForScene(
  scene: VideoScene | null,
  sceneIndex: number,
  nodes: NodeBox[]
): NodeBox | null {
  if (nodes.length === 0) return null;
  if (!scene) return nodes[0];

  const focus = scene.focusNode.trim().toLowerCase();
  if (focus) {
    const exact = nodes.find((n) => n.label.toLowerCase().includes(focus));
    if (exact) return exact;
    const focusWords = focus.split(/\s+/).filter((w) => w.length > 2);
    const partial = nodes.find((n) =>
      focusWords.some((w) => n.label.toLowerCase().includes(w))
    );
    if (partial) return partial;
  }

  const combined = `${scene.headline} ${scene.narration}`.toLowerCase();
  let bestNode: NodeBox | null = null;
  let bestHits = 0;
  for (const n of nodes) {
    const words = n.label
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const hits = words.filter((w) => combined.includes(w)).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestNode = n;
    }
  }
  if (bestNode) return bestNode;

  return nodes[sceneIndex % nodes.length];
}

function measureSvgNodes(svgMarkup: string): NodeBox[] {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-99999px";
  host.style.top = "-99999px";
  host.style.visibility = "hidden";
  host.innerHTML = svgMarkup;
  document.body.appendChild(host);

  try {
    const svgEl = host.querySelector("svg");
    if (!svgEl) return [];
    const svgRect = svgEl.getBoundingClientRect();
    if (svgRect.width <= 0 || svgRect.height <= 0) return [];

    const nodeEls = Array.from(svgEl.querySelectorAll("g.node"));
    return nodeEls
      .map((el) => {
        const r = el.getBoundingClientRect();
        const label = (el.textContent ?? "").replace(/\s+/g, " ").trim();
        return {
          label,
          nx: (r.left - svgRect.left + r.width / 2) / svgRect.width,
          ny: (r.top - svgRect.top + r.height / 2) / svgRect.height,
          nw: r.width / svgRect.width,
          nh: r.height / svgRect.height,
        };
      })
      .filter((n) => n.nw > 0 && n.nh > 0);
  } finally {
    document.body.removeChild(host);
  }
}

export function FlowVideoPlayer({
  open,
  onOpenChange,
  title,
  chart,
  steps = [],
  onVideoReady,
}: FlowVideoPlayerProps) {
  const { provider, apiKeys, getVideoStoryboard, saveVideoStoryboard } =
    useDesigns();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storyboard, setStoryboard] = useState<VideoStoryboard | null>(null);
  const [diagramImg, setDiagramImg] = useState<HTMLImageElement | null>(null);
  const [nodeBoxes, setNodeBoxes] = useState<NodeBox[]>([]);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [animTime, setAnimTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preparedChartRef = useRef<string | null>(null);
  const lastSpokenSceneRef = useRef<number>(-1);
  const speakingActiveRef = useRef<boolean>(false);
  const speechTokenRef = useRef<number>(0);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechTimeoutRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const totalDuration =
    storyboard?.scenes.reduce((sum, s) => sum + s.durationSec, 0) ?? 0;

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const list = window.speechSynthesis
        .getVoices()
        .slice()
        .sort((a, b) => scoreVoice(b) - scoreVoice(a));
      if (list.length > 0) {
        setVoices(list);
        setSelectedVoiceURI((prev) => prev || list[0].voiceURI);
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPlaying(false);
      speakingActiveRef.current = false;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
    onOpenChange(nextOpen);
  };

  useEffect(() => {
    if (!open) return;

    const cachedStoryboard = getVideoStoryboard(chart);

    // Reuse in-memory rasterized image & storyboard if already prepared in this mount
    if (
      preparedChartRef.current === chart &&
      (storyboard || cachedStoryboard) &&
      diagramImg
    ) {
      const id = window.setTimeout(() => {
        if (!storyboard && cachedStoryboard) {
          setStoryboard(cachedStoryboard);
        }
        lastSpokenSceneRef.current = -1;
        speakingActiveRef.current = false;
        setElapsed(0);
        setPlaying(true);
      }, 0);
      return () => window.clearTimeout(id);
    }

    let cancelled = false;

    async function prepareVideo() {
      setLoading(true);
      setError(null);
      setElapsed(0);
      lastSpokenSceneRef.current = -1;
      speakingActiveRef.current = false;

      try {
        const mermaidPromise = import("mermaid");
        const scriptPromise = cachedStoryboard
          ? Promise.resolve({ storyboard: cachedStoryboard })
          : fetch("/api/video", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title,
                mermaid: chart,
                steps,
                provider,
                apiKey: apiKeys[provider] ?? "",
              }),
            }).then(async (res) => {
              const data = await res.json();
              if (!res.ok) {
                throw new Error(
                  data.error || "Could not generate AI video script."
                );
              }
              return data as { storyboard: VideoStoryboard };
            });

        const [mermaidModule, scriptData] = await Promise.all([
          mermaidPromise,
          scriptPromise,
        ]);

        const mermaid = mermaidModule.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          flowchart: { htmlLabels: false },
          themeVariables: {
            primaryColor: "#18181b",
            primaryTextColor: "#f4f4f5",
            primaryBorderColor: "#8b5cf6",
            lineColor: "#a78bfa",
            secondaryColor: "#27272a",
            tertiaryColor: "#09090b",
            edgeLabelBackground: "#18181b",
            tertiaryTextColor: "#e4e4e7",
            fontFamily: "sans-serif",
          },
        });

        const { svg } = await mermaid.render(`video-svg-${Date.now()}`, chart);
        const measured = measureSvgNodes(svg);
        const encoded = window.btoa(unescape(encodeURIComponent(svg)));
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to rasterize diagram."));
          img.src = `data:image/svg+xml;base64,${encoded}`;
        });

        if (!cancelled) {
          preparedChartRef.current = chart;
          if (!cachedStoryboard) {
            saveVideoStoryboard(chart, scriptData.storyboard);
          }
          setNodeBoxes(measured);
          setStoryboard(scriptData.storyboard);
          setDiagramImg(img);
          setPlaying(true);
          onVideoReady?.();
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to prepare AI video."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void prepareVideo();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    title,
    chart,
    steps,
    provider,
    apiKeys,
    storyboard,
    diagramImg,
    getVideoStoryboard,
    saveVideoStoryboard,
    onVideoReady,
  ]);

  const getSceneAtTime = useCallback(
    (timeSec: number) => {
      if (!storyboard || storyboard.scenes.length === 0) {
        return {
          index: 0,
          localTime: 0,
          progress: 0,
          sceneStart: 0,
          sceneEnd: 1,
          scene: null,
        };
      }
      let acc = 0;
      for (let i = 0; i < storyboard.scenes.length; i++) {
        const s = storyboard.scenes[i];
        const sceneEnd = acc + s.durationSec;
        if (timeSec < sceneEnd || i === storyboard.scenes.length - 1) {
          const local = Math.max(0, timeSec - acc);
          return {
            index: i,
            localTime: local,
            progress: Math.min(1, local / s.durationSec),
            sceneStart: acc,
            sceneEnd,
            scene: s,
          };
        }
        acc = sceneEnd;
      }
      const last = storyboard.scenes[storyboard.scenes.length - 1];
      return {
        index: storyboard.scenes.length - 1,
        localTime: last.durationSec,
        progress: 1,
        sceneStart: Math.max(0, totalDuration - last.durationSec),
        sceneEnd: totalDuration,
        scene: last,
      };
    },
    [storyboard, totalDuration]
  );

  // Draw current frame with smooth zoom-in & pan onto the exact focused node
  const drawFrame = useCallback(
    (timeSec: number, visualSec = timeSec) => {
      const canvas = canvasRef.current;
      if (!canvas || !storyboard || !diagramImg) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      const { index, localTime, scene } = getSceneAtTime(timeSec);

      // Background
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, W, H);

      // Animated ambient motion-graphics orbs (continuous visualSec clock)
      const orb1X = W * 0.25 + Math.sin(visualSec * 0.6) * 80;
      const orb1Y = H * 0.35 + Math.cos(visualSec * 0.5) * 45;
      const bgGrad1 = ctx.createRadialGradient(orb1X, orb1Y, 10, orb1X, orb1Y, 320);
      bgGrad1.addColorStop(0, "rgba(124, 58, 237, 0.14)");
      bgGrad1.addColorStop(1, "rgba(124, 58, 237, 0)");
      ctx.fillStyle = bgGrad1;
      ctx.fillRect(0, 0, W, H);

      const orb2X = W * 0.72 + Math.cos(visualSec * 0.45) * 70;
      const orb2Y = H * 0.55 + Math.sin(visualSec * 0.7) * 50;
      const bgGrad2 = ctx.createRadialGradient(orb2X, orb2Y, 10, orb2X, orb2Y, 280);
      bgGrad2.addColorStop(0, "rgba(56, 189, 248, 0.08)");
      bgGrad2.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = bgGrad2;
      ctx.fillRect(0, 0, W, H);

      const stageTop = 70;
      const stageBottom = H - 166;
      const stageH = stageBottom - stageTop;
      const diagramLeft = 24;
      const diagramW = 816;
      const stageCenterX = diagramLeft + diagramW / 2;

      const fitScale = Math.min(
        (diagramW - 48) / Math.max(1, diagramImg.width),
        (stageH - 24) / Math.max(1, diagramImg.height),
        2.0
      );

      // Determine previous & current target node camera
      const targetNode = matchNodeForScene(scene, index, nodeBoxes);
      const prevNode =
        index > 0
          ? matchNodeForScene(storyboard.scenes[index - 1], index - 1, nodeBoxes)
          : null;

      const getCameraForNode = (node: NodeBox | null) => {
        if (!node) {
          return { nx: 0.5, ny: 0.5, zoomMul: 1.0 };
        }
        const desiredZoom = Math.min(
          2.6,
          Math.max(1.75, 0.36 / Math.max(node.nw, node.nh, 0.14))
        );
        return { nx: node.nx, ny: node.ny, zoomMul: desiredZoom };
      };

      const startCam =
        index === 0
          ? { nx: 0.5, ny: 0.5, zoomMul: 1.0 }
          : getCameraForNode(prevNode);
      const endCam = getCameraForNode(targetNode);
      const transitionT = easeInOutCubic(Math.min(1, localTime / 0.95));

      const camNx = startCam.nx + (endCam.nx - startCam.nx) * transitionT;
      const camNy = startCam.ny + (endCam.ny - startCam.ny) * transitionT;
      const camZoom =
        startCam.zoomMul + (endCam.zoomMul - startCam.zoomMul) * transitionT;

      const drawW = diagramImg.width * fitScale * camZoom;
      const drawH = diagramImg.height * fitScale * camZoom;
      const drawX = stageCenterX - camNx * drawW;
      const drawY = stageTop + (stageH - drawH) * 0.5 - (camNy - 0.5) * drawH;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(diagramLeft, stageTop, diagramW, stageH, 14);
      ctx.fillStyle = "#0d0d11";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.stroke();
      ctx.clip();

      // Parallax dot grid inside stage
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      const gridOffsetX = ((-camNx * 60) % 28 + 28) % 28;
      const gridOffsetY = ((-camNy * 60) % 28 + 28) % 28;
      for (let gx = diagramLeft + gridOffsetX; gx < diagramLeft + diagramW; gx += 28) {
        for (let gy = stageTop + gridOffsetY; gy < stageTop + stageH; gy += 28) {
          ctx.fillRect(gx, gy, 1.5, 1.5);
        }
      }

      // Floating ambient motion particles
      for (let p = 0; p < 14; p++) {
        const px =
          diagramLeft +
          (((p * 173 + visualSec * (14 + (p % 5) * 4)) % diagramW) + diagramW) %
            diagramW;
        const py =
          stageTop +
          (((p * 97 + Math.sin(visualSec * 0.8 + p) * 24) % stageH) + stageH) %
            stageH;
        ctx.fillStyle =
          p % 2 === 0
            ? "rgba(167, 139, 250, 0.22)"
            : "rgba(56, 189, 248, 0.16)";
        ctx.beginPath();
        ctx.arc(px, py, 1.5 + (p % 2), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.drawImage(diagramImg, drawX, drawY, drawW, drawH);

      // Subtle scene transition light sweep
      if (localTime < 0.45) {
        const sweepT = easeOutCubic(localTime / 0.45);
        const sweepX = diagramLeft + diagramW * sweepT;
        const sweepGrad = ctx.createLinearGradient(
          sweepX - 90,
          stageTop,
          sweepX + 90,
          stageTop
        );
        sweepGrad.addColorStop(0, "rgba(139, 92, 246, 0)");
        sweepGrad.addColorStop(0.5, "rgba(167, 139, 250, 0.12)");
        sweepGrad.addColorStop(1, "rgba(139, 92, 246, 0)");
        ctx.fillStyle = sweepGrad;
        ctx.fillRect(diagramLeft, stageTop, diagramW, stageH);
      }

      // Animated data-packet comet traveling from prevNode -> targetNode
      if (prevNode && targetNode && prevNode !== targetNode) {
        const p1x = drawX + prevNode.nx * drawW;
        const p1y = drawY + prevNode.ny * drawH;
        const p2x = drawX + targetNode.nx * drawW;
        const p2y = drawY + targetNode.ny * drawH;

        const packetT = (visualSec * 0.85) % 1;
        const px = p1x + (p2x - p1x) * packetT;
        const py = p1y + (p2y - p1y) * packetT;

        ctx.save();
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -visualSec * 36;
        ctx.strokeStyle = "rgba(167, 139, 250, 0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.stroke();
        ctx.restore();

        // Glowing data packet orb
        const packetGlow = ctx.createRadialGradient(px, py, 1, px, py, 16);
        packetGlow.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        packetGlow.addColorStop(0.35, "rgba(167, 139, 250, 0.85)");
        packetGlow.addColorStop(1, "rgba(167, 139, 250, 0)");
        ctx.fillStyle = packetGlow;
        ctx.beginPath();
        ctx.arc(px, py, 16, 0, Math.PI * 2);
        ctx.fill();
      }

      // Motion-graphics HUD brackets, expanding ripples & floating callout on active node
      if (targetNode) {
        const nodeCx = drawX + targetNode.nx * drawW;
        const nodeCy = drawY + targetNode.ny * drawH;
        const boxW = targetNode.nw * drawW + 22;
        const boxH = targetNode.nh * drawH + 18;
        const pulse = 1 + 0.03 * Math.sin(visualSec * 5);
        const rw = boxW * pulse;
        const rh = boxH * pulse;
        const rx = nodeCx - rw / 2;
        const ry = nodeCy - rh / 2;

        // Expanding ripple rings
        for (let r = 0; r < 2; r++) {
          const ripplePhase = (visualSec * 0.7 + r * 0.5) % 1;
          const rippleScale = 1 + ripplePhase * 0.55;
          ctx.save();
          ctx.strokeStyle = `rgba(167, 139, 250, ${(1 - ripplePhase) * 0.45})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(
            nodeCx - (boxW * rippleScale) / 2,
            nodeCy - (boxH * rippleScale) / 2,
            boxW * rippleScale,
            boxH * rippleScale,
            12
          );
          ctx.stroke();
          ctx.restore();
        }

        // Radial spotlight
        const grad = ctx.createRadialGradient(
          nodeCx,
          nodeCy,
          10,
          nodeCx,
          nodeCy,
          Math.max(boxW, boxH) * 1.2
        );
        grad.addColorStop(0, "rgba(139, 92, 246, 0.24)");
        grad.addColorStop(1, "rgba(139, 92, 246, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(diagramLeft, stageTop, diagramW, stageH);

        // Animated HUD corner brackets
        const bracketLen = 14;
        ctx.save();
        ctx.strokeStyle = "#ddd6fe";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "rgba(167, 139, 250, 0.9)";
        ctx.shadowBlur = 12;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(rx, ry + bracketLen);
        ctx.lineTo(rx, ry);
        ctx.lineTo(rx + bracketLen, ry);
        // Top-right
        ctx.moveTo(rx + rw - bracketLen, ry);
        ctx.lineTo(rx + rw, ry);
        ctx.lineTo(rx + rw, ry + bracketLen);
        // Bottom-right
        ctx.moveTo(rx + rw, ry + rh - bracketLen);
        ctx.lineTo(rx + rw, ry + rh);
        ctx.lineTo(rx + rw - bracketLen, ry + rh);
        // Bottom-left
        ctx.moveTo(rx + bracketLen, ry + rh);
        ctx.lineTo(rx, ry + rh);
        ctx.lineTo(rx, ry + rh - bracketLen);
        ctx.stroke();
        ctx.restore();

        // Floating animated callout badge above node
        const badgePop = easeOutCubic(Math.min(1, localTime / 0.45));
        const calloutText = `STEP ${index + 1} • ${targetNode.label}`;
        ctx.font = "600 11px monospace";
        const cW = Math.min(240, ctx.measureText(calloutText).width + 20);
        const cX = Math.max(
          diagramLeft + 12,
          Math.min(diagramLeft + diagramW - cW - 12, nodeCx - cW / 2)
        );
        const cY = Math.max(stageTop + 12, ry - 34 + (1 - badgePop) * 8);

        ctx.save();
        ctx.globalAlpha = badgePop;
        ctx.fillStyle = "rgba(139, 92, 246, 0.92)";
        ctx.beginPath();
        ctx.roundRect(cX, cY, cW, 24, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(calloutText.slice(0, 30), cX + 10, cY + 16);
        ctx.restore();
      }

      // Cinematic vignette around diagram stage
      const vig = ctx.createRadialGradient(
        stageCenterX,
        stageTop + stageH / 2,
        diagramW * 0.25,
        stageCenterX,
        stageTop + stageH / 2,
        diagramW * 0.65
      );
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.42)");
      ctx.fillStyle = vig;
      ctx.fillRect(diagramLeft, stageTop, diagramW, stageH);

      // Picture-in-picture Mini Radar Map in top-right of stage
      const miniW = 136;
      const miniH = 88;
      const miniX = diagramLeft + diagramW - miniW - 14;
      const miniY = stageTop + 14;
      ctx.save();
      ctx.fillStyle = "rgba(9, 9, 11, 0.85)";
      ctx.beginPath();
      ctx.roundRect(miniX, miniY, miniW, miniH, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.stroke();
      ctx.clip();

      const miniFit = Math.min(
        (miniW - 12) / Math.max(1, diagramImg.width),
        (miniH - 12) / Math.max(1, diagramImg.height)
      );
      const mW = diagramImg.width * miniFit;
      const mH = diagramImg.height * miniFit;
      const mX = miniX + (miniW - mW) / 2;
      const mY = miniY + (miniH - mH) / 2;
      ctx.globalAlpha = 0.7;
      ctx.drawImage(diagramImg, mX, mY, mW, mH);
      ctx.globalAlpha = 1;

      // Viewport indicator box inside mini-map
      const vpW = Math.min(mW, (diagramW / drawW) * mW);
      const vpH = Math.min(mH, (stageH / drawH) * mH);
      const vpX = mX + camNx * mW - vpW / 2;
      const vpY = mY + camNy * mH - vpH / 2;
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 1.5;
      ctx.fillStyle = "rgba(139, 92, 246, 0.16)";
      ctx.fillRect(vpX, vpY, vpW, vpH);
      ctx.strokeRect(vpX, vpY, vpW, vpH);
      ctx.restore();

      ctx.restore();

      // Right Panel: Step-by-Step Checklist
      const panelX = diagramLeft + diagramW + 18;
      const panelW = W - panelX - 24;
      ctx.fillStyle = "#111116";
      ctx.beginPath();
      ctx.roundRect(panelX, stageTop, panelW, stageH, 14);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.stroke();

      ctx.fillStyle = "#a1a1aa";
      ctx.font = "600 12px monospace";
      ctx.fillText("FLOW WALKTHROUGH", panelX + 18, stageTop + 28);

      const itemStartY = stageTop + 48;
      const maxItems = Math.min(storyboard.scenes.length, 7);
      const startIdx = Math.max(
        0,
        Math.min(index - 3, storyboard.scenes.length - maxItems)
      );
      const rowH = Math.min(58, (stageH - 60) / Math.max(1, maxItems));

      for (let slot = 0; slot < maxItems; slot++) {
        const i = startIdx + slot;
        const s = storyboard.scenes[i];
        const y = itemStartY + slot * rowH;
        const isCurrent = i === index;
        const isDone = i < index;

        if (isCurrent) {
          ctx.fillStyle = "rgba(139, 92, 246, 0.18)";
          ctx.beginPath();
          ctx.roundRect(panelX + 12, y, panelW - 24, rowH - 6, 8);
          ctx.fill();
          ctx.strokeStyle = "rgba(167, 139, 250, 0.5)";
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(panelX + 30, y + (rowH - 6) / 2, 11, 0, Math.PI * 2);
        ctx.fillStyle = isCurrent
          ? "#8b5cf6"
          : isDone
          ? "#10b981"
          : "rgba(255,255,255,0.1)";
        ctx.fill();

        ctx.fillStyle = isCurrent || isDone ? "#ffffff" : "#a1a1aa";
        ctx.font = "600 11px monospace";
        ctx.fillText(
          isDone ? "✓" : String(i + 1),
          panelX + (isDone ? 26 : 27),
          y + (rowH - 6) / 2 + 4
        );

        ctx.fillStyle = isCurrent ? "#f4f4f5" : isDone ? "#a1a1aa" : "#71717a";
        ctx.font = isCurrent ? "600 13px sans-serif" : "500 13px sans-serif";
        const label =
          s.headline.length > 34 ? `${s.headline.slice(0, 32)}...` : s.headline;
        ctx.fillText(label, panelX + 50, y + (rowH - 6) / 2 + 4);
      }

      // Top bar
      ctx.fillStyle = "rgba(20, 20, 25, 0.95)";
      ctx.fillRect(0, 0, W, 56);
      ctx.fillStyle = "#f4f4f5";
      ctx.font = "600 17px sans-serif";
      ctx.fillText(storyboard.videoTitle, 24, 34);

      ctx.fillStyle = "#a78bfa";
      ctx.font = "600 12px monospace";
      const badgeText = `STEP ${index + 1} OF ${storyboard.scenes.length}`;
      const badgeW = ctx.measureText(badgeText).width;
      ctx.fillText(badgeText, W - badgeW - 24, 33);

      // Bottom narration bar
      ctx.fillStyle = "rgba(16, 16, 20, 0.98)";
      ctx.fillRect(0, H - 152, W, 152);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(0, H - 152);
      ctx.lineTo(W, H - 152);
      ctx.stroke();

      if (scene) {
        const kineticT = easeOutCubic(Math.min(1, localTime / 0.45));
        ctx.save();
        ctx.globalAlpha = kineticT;
        ctx.fillStyle = "#c4b5fd";
        ctx.font = "600 15px sans-serif";
        ctx.fillText(
          `${index + 1}. ${scene.headline}`,
          28,
          H - 120 + (1 - kineticT) * 8
        );

        ctx.fillStyle = "#e4e4e7";
        ctx.font = "400 16px sans-serif";
        const lines = wrapLines(ctx, scene.narration, W - 140);
        lines.slice(0, 3).forEach((line, lIdx) => {
          ctx.fillText(line, 28, H - 90 + lIdx * 24 + (1 - kineticT) * 6);
        });
        ctx.restore();

        // Animated audio waveform equalizer bars when playing
        const barCount = 7;
        const barBaseX = W - 84;
        const barBaseY = H - 64;
        for (let b = 0; b < barCount; b++) {
          const amp = playing
            ? 8 + Math.abs(Math.sin(visualSec * 8 + b * 0.9)) * 24
            : 6;
          ctx.fillStyle = playing ? "#a78bfa" : "rgba(167, 139, 250, 0.35)";
          ctx.beginPath();
          ctx.roundRect(barBaseX + b * 8, barBaseY - amp / 2, 4, amp, 2);
          ctx.fill();
        }
      }

      // Progress bar with animated playhead glow
      const pct = totalDuration > 0 ? Math.min(1, timeSec / totalDuration) : 0;
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(0, H - 6, W, 6);
      ctx.fillStyle = "#8b5cf6";
      ctx.fillRect(0, H - 6, W * pct, 6);
      if (pct > 0) {
        ctx.fillStyle = "#e9d5ff";
        ctx.beginPath();
        ctx.arc(W * pct, H - 3, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [storyboard, diagramImg, nodeBoxes, getSceneAtTime, totalDuration, playing]
  );

  useEffect(() => {
    drawFrame(elapsed, animTime);
  }, [elapsed, animTime, drawFrame]);

  useEffect(() => {
    if (!playing || !storyboard || totalDuration <= 0) return;

    let lastTick = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTick) / 1000;
      lastTick = now;

      setAnimTime((prev) => prev + dt);
      setElapsed((prev) => {
        const { sceneEnd } = getSceneAtTime(prev);
        let next = prev + dt * playbackSpeed;

        if (!muted && speakingActiveRef.current && next >= sceneEnd - 0.05) {
          next = Math.max(prev, sceneEnd - 0.05);
        }

        if (next >= totalDuration) {
          setPlaying(false);
          return totalDuration;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [playing, muted, playbackSpeed, storyboard, totalDuration, getSceneAtTime]);

  useEffect(() => {
    if (!playing || muted || !storyboard) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const { index, scene } = getSceneAtTime(elapsed);
    if (scene && lastSpokenSceneRef.current !== index) {
      lastSpokenSceneRef.current = index;
      const myToken = ++speechTokenRef.current;
      window.speechSynthesis.cancel();
      if (speechTimeoutRef.current) {
        window.clearTimeout(speechTimeoutRef.current);
      }
      speakingActiveRef.current = true;

      const utterance = new SpeechSynthesisUtterance(
        `${scene.headline}. ${scene.narration}`
      );
      currentUtteranceRef.current = utterance;
      const chosen = voices.find((v) => v.voiceURI === selectedVoiceURI);
      if (chosen) utterance.voice = chosen;
      utterance.rate = Math.min(1.6, Math.max(0.7, 0.98 * playbackSpeed));
      utterance.pitch = 1.0;

      const finishSpeech = () => {
        if (speechTokenRef.current !== myToken) return;
        speakingActiveRef.current = false;
        currentUtteranceRef.current = null;
        if (speechTimeoutRef.current) {
          window.clearTimeout(speechTimeoutRef.current);
          speechTimeoutRef.current = null;
        }
      };

      utterance.onend = finishSpeech;
      utterance.onerror = finishSpeech;
      // Generous safety fallback in case browser speechSynthesis drops onend
      speechTimeoutRef.current = window.setTimeout(
        finishSpeech,
        Math.max(15, scene.durationSec * 2 + 8) * 1000
      );
      window.speechSynthesis.speak(utterance);
    }
  }, [elapsed, playing, muted, playbackSpeed, storyboard, voices, selectedVoiceURI, getSceneAtTime]);

  const jumpToScene = (sceneIdx: number) => {
    if (!storyboard) return;
    let t = 0;
    for (let i = 0; i < sceneIdx; i++) {
      t += storyboard.scenes[i]?.durationSec ?? 0;
    }
    lastSpokenSceneRef.current = -1;
    speakingActiveRef.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setElapsed(t);
    setPlaying(true);
  };

  const handleRestart = () => {
    lastSpokenSceneRef.current = -1;
    speakingActiveRef.current = false;
    setElapsed(0);
    setPlaying(true);
  };

  const handleDownloadVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !storyboard || totalDuration <= 0) return;
    if (typeof MediaRecorder === "undefined") {
      setError("Video recording is not supported in this browser.");
      return;
    }

    setPlaying(false);
    speakingActiveRef.current = false;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setRecording(true);

    try {
      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const finished = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
      });

      recorder.start();

      const startTime = performance.now();
      await new Promise<void>((resolve) => {
        const renderStep = (now: number) => {
          const t = (now - startTime) / 1000;
          drawFrame(Math.min(t, totalDuration));
          setElapsed(Math.min(t, totalDuration));
          if (t < totalDuration) {
            requestAnimationFrame(renderStep);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(renderStep);
      });

      recorder.stop();
      const blob = await finished;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-explainer.webm`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to export video."
      );
    } finally {
      setRecording(false);
    }
  };

  const { index: currentSceneIndex } = getSceneAtTime(elapsed);

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-5xl sm:max-w-5xl w-[94vw] p-0 overflow-hidden">
        <DialogHeader className="border-b px-5 py-3.5 flex flex-row items-center justify-between pr-12">
          <div className="flex items-center gap-2">
            <Video className="size-4 text-primary" />
            <DialogTitle className="text-sm font-semibold">
              AI Flowchart Explainer Video — {title}
            </DialogTitle>
          </div>
          {storyboard && (
            <Badge variant="secondary" className="font-mono text-xs">
              Step {currentSceneIndex + 1} / {storyboard.scenes.length}
            </Badge>
          )}
        </DialogHeader>

        <div className="p-5 space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center h-[380px] gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p>AI is writing the step-by-step narration & rendering your video...</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl overflow-hidden border border-border bg-black">
                <canvas
                  ref={canvasRef}
                  width={1280}
                  height={720}
                  className="w-full h-auto block"
                />
              </div>

              {storyboard && storyboard.scenes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {storyboard.scenes.map((s, sIdx) => (
                    <Button
                      key={`${s.headline}-${sIdx}`}
                      type="button"
                      size="xs"
                      variant={sIdx === currentSceneIndex ? "default" : "outline"}
                      disabled={recording}
                      onClick={() => jumpToScene(sIdx)}
                      className="text-[11px]"
                    >
                      {sIdx + 1}. {s.headline}
                    </Button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={recording || !storyboard}
                    onClick={() => {
                      if (elapsed >= totalDuration) {
                        handleRestart();
                      } else {
                        if (playing && "speechSynthesis" in window) {
                          window.speechSynthesis.cancel();
                          speakingActiveRef.current = false;
                        }
                        setPlaying((p) => !p);
                      }
                    }}
                  >
                    {playing ? (
                      <Pause className="size-3.5" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    {playing ? "Pause" : elapsed >= totalDuration ? "Replay" : "Play"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={recording || !storyboard}
                    onClick={handleRestart}
                  >
                    <RotateCcw className="size-3.5" />
                    Restart
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!muted && "speechSynthesis" in window) {
                        window.speechSynthesis.cancel();
                        speakingActiveRef.current = false;
                      }
                      setMuted((m) => !m);
                    }}
                  >
                    {muted ? (
                      <VolumeX className="size-3.5" />
                    ) : (
                      <Volume2 className="size-3.5" />
                    )}
                    {muted ? "Muted" : "AI Voice"}
                  </Button>

                  <Select
                    value={String(playbackSpeed)}
                    onValueChange={(val) => {
                      if (val) setPlaybackSpeed(Number(val));
                    }}
                  >
                    <SelectTrigger className="h-8 w-20 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.75">0.75x</SelectItem>
                      <SelectItem value="1">1x</SelectItem>
                      <SelectItem value="1.25">1.25x</SelectItem>
                      <SelectItem value="1.5">1.5x</SelectItem>
                    </SelectContent>
                  </Select>

                  <span className="text-xs font-mono text-muted-foreground px-1">
                    {Math.floor(elapsed)}s / {Math.ceil(totalDuration)}s
                  </span>

                  {voices.length > 0 && (
                    <Select
                      value={selectedVoiceURI}
                      onValueChange={(val) => {
                        if (val) setSelectedVoiceURI(val);
                      }}
                    >
                      <SelectTrigger className="h-8 w-52 text-xs">
                        <SelectValue placeholder="Select AI voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {voices.slice(0, 12).map((v) => (
                          <SelectItem
                            key={v.voiceURI}
                            value={v.voiceURI}
                            className="text-xs"
                          >
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={recording || !storyboard}
                  onClick={handleDownloadVideo}
                >
                  {recording ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Exporting .webm...
                    </>
                  ) : (
                    <>
                      <Download className="size-3.5" />
                      Download Video (.webm)
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
