import { NextRequest, NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";

export type AiProvider = "pollinations" | "gemini" | "groq" | "openrouter";

interface DesignRequestBody {
  prompt: string;
  scale?: string;
  focus?: string;
  provider?: AiProvider;
  apiKey?: string;
}

const SYSTEM_PROMPT = `You are a Principal Systems Architect who explains architectures in clear, simple, easy-to-understand language.
The user will describe ANY kind of project (web app, mobile app, backend/microservices, AI/ML pipeline, data platform, desktop/CLI tool, game, IoT/hardware system, business/operations workflow, or any custom system).
Respond with ONLY valid JSON (no markdown fences, no commentary outside JSON) matching this exact schema:
{
  "title": "Short Architecture Title",
  "summary": "2-3 plain-English sentences explaining how the system works from start to finish",
  "mermaid": "Valid Mermaid flowchart TD code for the overall system architecture with labeled arrows so anyone can understand it at a glance, e.g. A[User Browser] -->|Sends request| B[API Server]",
  "flows": [
    {
      "name": "Specific Flow Name (tailored to the user's project, e.g. Account Creation Flow, Login Flow, Logout Flow)",
      "category": "Core Flow | Auth & Access | Data & Storage | Async / Events | Integrations | Processing",
      "mermaid": "Valid Mermaid flowchart LR or flowchart TD diagram specifically for this flow with labeled arrows like A[User] -->|1. Enter email & password| B[Login API]",
      "steps": [
        "Plain-English step 1: What the user or trigger does...",
        "Plain-English step 2: What the server/module checks or processes...",
        "Plain-English step 3: What gets saved or updated in storage...",
        "Plain-English step 4: What response or result the user sees..."
      ]
    }
  ],
  "components": [
    {
      "name": "Component Name",
      "role": "Simple, clear explanation of what it does in the system",
      "tech": "Recommended tech stack (e.g. Next.js, Go, PostgreSQL, Redis)",
      "scalingNote": "Plain-English note on how it handles more users/load"
    }
  ],
  "dataFlow": [
    "Simple end-to-end step 1...",
    "Simple end-to-end step 2..."
  ],
  "tradeoffs": [
    {
      "topic": "Key Design Choice",
      "decision": "Simple explanation of what was chosen and why"
    }
  ]
}
Rules:
- Keep all explanations clear, concise, and easy to understand for any developer.
- Generate 3 to 5 distinct flows in "flows" covering EVERY major flow implied by the user's project description.
- Rules for all mermaid strings:
  - Start with "flowchart TD" or "flowchart LR"
  - ALWAYS label arrows with short, clear actions: A -->|Short action| B
  - Use bracketed node labels without double quotes or parentheses: NodeId[Readable Label]
  - Never use double quotes, parentheses, or HTML tags inside node or arrow labels
  - Keep each diagram between 5 and 9 nodes so it stays clean and easy to read.`;

function normalizeDesign(raw: Record<string, unknown>) {
  const flows = Array.isArray(raw.flows)
    ? raw.flows.map((f: Record<string, unknown>) => ({
        name: typeof f?.name === "string" ? f.name : "System Flow",
        category: typeof f?.category === "string" ? f.category : "Core Flow",
        mermaid: typeof f?.mermaid === "string" ? f.mermaid : "",
        steps: Array.isArray(f?.steps) ? f.steps.map(String) : [],
      }))
    : [];

  return {
    title: typeof raw.title === "string" ? raw.title : "System Architecture",
    summary: typeof raw.summary === "string" ? raw.summary : "",
    mermaid:
      typeof raw.mermaid === "string"
        ? raw.mermaid
        : "flowchart TD\n  A[Client] --> B[System]",
    flows,
    components: Array.isArray(raw.components) ? raw.components : [],
    dataFlow: Array.isArray(raw.dataFlow) ? raw.dataFlow : [],
    tradeoffs: Array.isArray(raw.tradeoffs) ? raw.tradeoffs : [],
  };
}

function extractJson(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate =
    start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try {
    return normalizeDesign(JSON.parse(candidate) as Record<string, unknown>);
  } catch {
    try {
      return normalizeDesign(
        JSON.parse(jsonrepair(candidate)) as Record<string, unknown>
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Invalid JSON";
      throw new Error(`AI returned malformed JSON (${detail}). Please try again.`);
    }
  }
}

async function callPollinations(userPrompt: string): Promise<string> {
  const res = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    throw new Error(`Pollinations API error (${res.status})`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(userPrompt: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callOpenAICompatible(
  endpoint: string,
  model: string,
  userPrompt: string,
  apiKey: string,
  extraHeaders: Record<string, string> = {}
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Provider API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DesignRequestBody;
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json(
        { error: "Please describe the system you want to design." },
        { status: 400 }
      );
    }

    const provider: AiProvider = body.provider ?? "pollinations";
    const scale = body.scale ?? "Growth (1M Users)";
    const focus = body.focus ?? "End-to-End Architecture";
    const userPrompt = `Design this system: "${prompt}"\nTarget Scale: ${scale}\nFocus Area: ${focus}`;

    let rawText = "";

    if (provider === "gemini") {
      const key = body.apiKey?.trim() || process.env.GEMINI_API_KEY;
      if (!key) {
        return NextResponse.json(
          { error: "Missing Gemini API key. Add GEMINI_API_KEY in .env.local or paste a free key in AI Settings." },
          { status: 400 }
        );
      }
      rawText = await callGemini(userPrompt, key);
    } else if (provider === "groq") {
      const key = body.apiKey?.trim() || process.env.GROQ_API_KEY;
      if (!key) {
        return NextResponse.json(
          { error: "Missing Groq API key. Add GROQ_API_KEY in .env.local or paste a free key in AI Settings." },
          { status: 400 }
        );
      }
      rawText = await callOpenAICompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        "llama-3.3-70b-versatile",
        userPrompt,
        key
      );
    } else if (provider === "openrouter") {
      const key = body.apiKey?.trim() || process.env.OPENROUTER_API_KEY;
      if (!key) {
        return NextResponse.json(
          { error: "Missing OpenRouter API key. Add OPENROUTER_API_KEY in .env.local or paste a free key in AI Settings." },
          { status: 400 }
        );
      }
      rawText = await callOpenAICompatible(
        "https://openrouter.ai/api/v1/chat/completions",
        "meta-llama/llama-3.3-70b-instruct:free",
        userPrompt,
        key,
        { "HTTP-Referer": "http://localhost:3000", "X-Title": "ArchFlow AI" }
      );
    } else {
      rawText = await callPollinations(userPrompt);
    }

    const design = extractJson(rawText);
    return NextResponse.json({ design, provider });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate system design.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
