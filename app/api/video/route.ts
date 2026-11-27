import { NextRequest, NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";
import type { AiProvider } from "@/app/api/design/route";

interface VideoRequestBody {
  title: string;
  summary?: string;
  mermaid: string;
  steps?: string[];
  provider?: AiProvider;
  apiKey?: string;
  customEndpoint?: string;
  customModel?: string;
}

export interface VideoScene {
  headline: string;
  narration: string;
  durationSec: number;
  focusNode: string;
}

export interface VideoStoryboard {
  videoTitle: string;
  scenes: VideoScene[];
}

const VIDEO_SYSTEM_PROMPT = `You are an expert technical presenter creating a detailed, easy-to-understand video walkthrough of a system architecture flowchart.
Given a flowchart title, Mermaid diagram, and its steps, create a scene-by-scene video script that explains EVERY SINGLE STEP and EVERY POINT clearly from start to finish.
Respond with ONLY valid JSON (no markdown fences) matching this exact schema:
{
  "videoTitle": "Short engaging video title",
  "scenes": [
    {
      "headline": "Step title (3-6 words)",
      "narration": "2-3 clear, natural spoken sentences explaining exactly what happens in this step, why it matters, and what data or action moves between components.",
      "durationSec": 6,
      "focusNode": "Exact node label or keyword from the diagram"
    }
  ]
}
Rules:
- Cover EVERY step provided in "Steps" (1 scene per step, plus an optional brief intro scene if needed). Do NOT skip any step or point.
- Write narration as natural spoken English for an AI voiceover (avoid raw symbols like --> or /api/v1; say "the API endpoint" or "sends a request to").
- durationSec should match the speaking time (typically 5 to 9 seconds per scene).`;

function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(4, Math.min(14, Math.ceil(words / 2.2) + 1));
}

function normalizeStoryboard(
  raw: Record<string, unknown>,
  fallbackTitle: string,
  fallbackSteps: string[]
): VideoStoryboard {
  const scenes = Array.isArray(raw.scenes)
    ? raw.scenes.map((s: Record<string, unknown>, idx: number) => {
        const narration =
          typeof s?.narration === "string" && s.narration.trim()
            ? s.narration
            : fallbackSteps[idx] ?? "Processing this stage of the system flow.";
        return {
          headline:
            typeof s?.headline === "string" && s.headline.trim()
              ? s.headline
              : `Step ${idx + 1}`,
          narration,
          durationSec:
            typeof s?.durationSec === "number" &&
            s.durationSec >= 3 &&
            s.durationSec <= 15
              ? s.durationSec
              : estimateDuration(narration),
          focusNode: typeof s?.focusNode === "string" ? s.focusNode : "",
        };
      })
    : [];

  return {
    videoTitle:
      typeof raw.videoTitle === "string" && raw.videoTitle.trim()
        ? raw.videoTitle
        : fallbackTitle,
    scenes:
      scenes.length > 0
        ? scenes
        : (fallbackSteps.length > 0
            ? fallbackSteps
            : ["Overview of how the system components connect and process requests."]
          ).map((step, idx) => ({
            headline: `Step ${idx + 1}`,
            narration: step,
            durationSec: 4,
            focusNode: "",
          })),
  };
}

function parseStoryboard(
  rawText: string,
  fallbackTitle: string,
  fallbackSteps: string[]
): VideoStoryboard {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate =
    start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try {
    return normalizeStoryboard(
      JSON.parse(candidate) as Record<string, unknown>,
      fallbackTitle,
      fallbackSteps
    );
  } catch {
    return normalizeStoryboard(
      JSON.parse(jsonrepair(candidate)) as Record<string, unknown>,
      fallbackTitle,
      fallbackSteps
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VideoRequestBody;
    const title = body.title?.trim() || "System Architecture";
    const mermaid = body.mermaid?.trim() || "";
    const steps = Array.isArray(body.steps) ? body.steps : [];
    const provider: AiProvider = body.provider ?? "pollinations";

    if (!mermaid) {
      return NextResponse.json(
        { error: "Missing Mermaid diagram to generate video." },
        { status: 400 }
      );
    }

    const userPrompt = `Flowchart Title: ${title}\nSummary: ${
      body.summary ?? ""
    }\nMermaid Diagram:\n${mermaid}\nSteps:\n${steps.join("\n")}`;

    let rawText = "";

    if (provider === "gemini") {
      const key = body.apiKey?.trim() || process.env.GEMINI_API_KEY;
      if (!key) {
        return NextResponse.json(
          { error: "Missing Gemini API key." },
          { status: 400 }
        );
      }
      const model = body.customModel?.trim() || "gemini-2.5-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: VIDEO_SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: "application/json",
            },
          }),
        }
      );
      if (!res.ok) throw new Error(`Gemini API error (${res.status})`);
      const data = await res.json();
      rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } else if (
      provider === "openai" ||
      provider === "custom" ||
      provider === "groq" ||
      provider === "openrouter"
    ) {
      const endpoint =
        provider === "custom"
          ? body.customEndpoint?.trim() ?? ""
          : provider === "openai"
          ? "https://api.openai.com/v1/chat/completions"
          : provider === "groq"
          ? "https://api.groq.com/openai/v1/chat/completions"
          : "https://openrouter.ai/api/v1/chat/completions";

      const defaultModel =
        provider === "openai"
          ? "gpt-4o-mini"
          : provider === "groq"
          ? "llama-3.3-70b-versatile"
          : provider === "openrouter"
          ? "meta-llama/llama-3.3-70b-instruct:free"
          : "";

      const model = body.customModel?.trim() || defaultModel;
      const key =
        body.apiKey?.trim() ||
        (provider === "openai"
          ? process.env.OPENAI_API_KEY
          : provider === "groq"
          ? process.env.GROQ_API_KEY
          : provider === "openrouter"
          ? process.env.OPENROUTER_API_KEY
          : "") ||
        "";

      if (!endpoint || !model) {
        return NextResponse.json(
          { error: "Missing Custom Endpoint URL or Model ID." },
          { status: 400 }
        );
      }
      if (provider !== "custom" && !key) {
        return NextResponse.json(
          { error: `Missing ${provider} API key.` },
          { status: 400 }
        );
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (key) {
        headers.Authorization = `Bearer ${key}`;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: VIDEO_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
        }),
      });
      if (!res.ok) throw new Error(`${provider} API error (${res.status})`);
      const data = await res.json();
      rawText = data.choices?.[0]?.message?.content ?? "";
    } else {
      const res = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai",
          messages: [
            { role: "system", content: VIDEO_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 2048,
          temperature: 0.4,
        }),
      });
      if (!res.ok) throw new Error(`Pollinations API error (${res.status})`);
      const data = await res.json();
      rawText = data.choices?.[0]?.message?.content ?? "";
    }

    const storyboard = parseStoryboard(rawText, title, steps);
    return NextResponse.json({ storyboard });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate AI video script.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
