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
  defaultModel: string;
  description: string;
}[] = [
  {
    id: "pollinations",
    label: "Pollinations AI",
    note: "Free • No API Key",
    requiresKey: false,
    defaultModel: "openai",
    description: "Zero-setup free inference endpoint for rapid architecture prototyping.",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    note: "Free or Paid Key",
    requiresKey: true,
    defaultModel: "gemini-2.5-flash",
    description: "Fast structured JSON generation (e.g. gemini-2.5-flash or gemini-2.5-pro).",
  },
  {
    id: "openai",
    label: "OpenAI",
    note: "Paid API Key",
    requiresKey: true,
    defaultModel: "gpt-4o-mini",
    description: "Use your own OpenAI API key with gpt-4o-mini, gpt-4o, or gpt-4.1.",
  },
  {
    id: "groq",
    label: "Groq",
    note: "Free or Paid Key",
    requiresKey: true,
    defaultModel: "llama-3.3-70b-versatile",
    description: "Ultra-low-latency LPU inference for instant diagram iterations.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    note: "Free or Paid Key",
    requiresKey: true,
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    description: "Unified gateway to free or paid models (Claude, GPT, Llama, DeepSeek).",
  },
  {
    id: "custom",
    label: "Custom / BYOK Endpoint",
    note: "Your Own API Setup",
    requiresKey: true,
    defaultModel: "",
    description: "Connect any OpenAI-compatible paid or self-hosted endpoint with your own key.",
  },
];
