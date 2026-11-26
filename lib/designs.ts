import type { AiProvider } from "@/app/api/design/route";
import type { VideoStoryboard } from "@/app/api/video/route";

export interface ArchitectureComponent {
  name: string;
  role: string;
  tech: string;
  scalingNote: string;
}

export interface TradeoffItem {
  topic: string;
  decision: string;
}

export interface SystemFlow {
  name: string;
  category: string;
  mermaid: string;
  steps: string[];
}

export interface SystemDesignOutput {
  title: string;
  summary: string;
  mermaid: string;
  flows?: SystemFlow[];
  components: ArchitectureComponent[];
  dataFlow: string[];
  tradeoffs: TradeoffItem[];
}

export interface SavedDesign {
  id: string;
  userId?: string;
  userEmail?: string;
  savedToCloud?: boolean;
  videos?: Record<string, VideoStoryboard>;
  prompt: string;
  scale: string;
  focus: string;
  provider: AiProvider;
  createdAt: string;
  design: SystemDesignOutput;
}

export function hashChartKey(chart: string): string {
  let hash = 2166136261;
  for (let i = 0; i < chart.length; i++) {
    hash ^= chart.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `v_${(hash >>> 0).toString(16)}`;
}

export const SCALE_OPTIONS = [
  "Prototype / MVP",
  "Small / Team (10K Users)",
  "Growth (1M Users)",
  "Enterprise / Hyperscale (100M+)",
] as const;

export const FOCUS_OPTIONS = [
  "End-to-End Architecture",
  "Full-Stack & Web",
  "Backend & Distributed Systems",
  "AI / ML & Data Pipelines",
  "Mobile & Client Apps",
  "Hardware / IoT & Embedded",
  "Business & Operations Workflow",
] as const;

export const PROVIDERS: {
  id: AiProvider;
  label: string;
  note: string;
  requiresKey: boolean;
  description: string;
}[] = [
  {
    id: "pollinations",
    label: "Pollinations AI",
    note: "Free • No API Key",
    requiresKey: false,
    description: "Zero-setup free inference endpoint for rapid architecture prototyping.",
  },
  {
    id: "gemini",
    label: "Google Gemini 2.5 Flash",
    note: "Free Tier Key",
    requiresKey: true,
    description: "Fast structured JSON generation with strong system-design reasoning.",
  },
  {
    id: "groq",
    label: "Groq Llama 3.3 70B",
    note: "Free Tier Key",
    requiresKey: true,
    description: "Ultra-low-latency LPU inference for instant diagram iterations.",
  },
  {
    id: "openrouter",
    label: "OpenRouter Free Models",
    note: "Free Tier Key",
    requiresKey: true,
    description: "Unified gateway to free open-weight models via OpenRouter.",
  },
];
