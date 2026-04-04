/**
 * Shared Gemini API client helpers for Ágora Edge Functions.
 *
 * Centralizes:
 *  - API key retrieval
 *  - OpenAI-compatible chat completions (streaming & non-streaming)
 *  - Native Gemini API calls (for multimodal)
 *  - Stream transformation (Gemini SSE → OpenAI SSE)
 *  - Retry logic with model fallback
 */

const GEMINI_OPENAI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/**
 * Get Gemini API key or throw.
 */
export function getGeminiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

// ─── OpenAI-compatible endpoint ──────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | unknown[];
}

interface GeminiChatOptions {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  tools?: unknown[];
  tool_choice?: unknown;
}

/**
 * Call Gemini via the OpenAI-compatible endpoint.
 * Returns the raw Response (can be streaming or JSON).
 */
export async function callGemini(opts: GeminiChatOptions): Promise<Response> {
  const apiKey = getGeminiKey();
  const { model = "gemini-2.5-flash", messages, stream = false, tools, tool_choice } = opts;

  const body: Record<string, unknown> = { model, messages, stream };
  if (tools) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;

  return fetch(GEMINI_OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Call Gemini with retry + model fallback for non-streaming (tool calling) requests.
 * Returns the parsed JSON response or throws.
 */
export async function callGeminiWithRetry(
  opts: GeminiChatOptions & { fallbackModels?: string[] },
): Promise<{ data: any; response: Response }> {
  const models = [opts.model || "gemini-2.5-flash", ...(opts.fallbackModels || ["gemini-2.5-pro"])];

  let lastError = "";
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await callGemini({ ...opts, model });

        if (response.ok) {
          const data = await response.json();
          return { data, response };
        }

        // Known client errors — don't retry
        if (response.status === 429 || response.status === 402) {
          return { data: null, response };
        }

        const errText = await response.text();
        lastError = `Model ${model} attempt ${attempt + 1}: ${response.status} - ${errText}`;
        console.warn(lastError);

        if (response.status >= 500) {
          await sleep(2000);
          continue;
        }
        break;
      } catch (err) {
        lastError = `Fetch error for ${model}: ${err}`;
        console.warn(lastError);
        await sleep(1000);
      }
    }
  }

  throw new Error(`All AI models failed: ${lastError}`);
}

// ─── Native Gemini API (multimodal) ──────────────────────────

/**
 * Convert OpenAI-style messages to Gemini native format.
 */
export function toGeminiContents(messages: ChatMessage[]) {
  const contents: any[] = [];
  let systemInstruction: any = undefined;

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction = {
        parts: [{ text: typeof msg.content === "string" ? msg.content : "" }],
      };
      continue;
    }

    const role = msg.role === "assistant" ? "model" : "user";

    if (typeof msg.content === "string") {
      contents.push({ role, parts: [{ text: msg.content }] });
    } else if (Array.isArray(msg.content)) {
      const parts: any[] = [];
      for (const part of msg.content as any[]) {
        if (part.type === "text") {
          parts.push({ text: part.text });
        } else if (part.type === "inline_data") {
          parts.push({ inlineData: part.inline_data });
        }
      }
      contents.push({ role, parts });
    }
  }

  return { contents, systemInstruction };
}

/**
 * Call native Gemini streaming API (for multimodal content).
 */
export async function callGeminiNative(
  model: string,
  contents: any[],
  systemInstruction?: any,
  config?: Record<string, unknown>,
): Promise<Response> {
  const apiKey = getGeminiKey();
  const body: Record<string, unknown> = { contents };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (config) body.generationConfig = config;

  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

/**
 * Transform a Gemini SSE stream into OpenAI-compatible SSE format.
 */
export function transformGeminiStream(body: ReadableStream): ReadableStream {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);

          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const gemini = JSON.parse(jsonStr);
            const text = gemini?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const chunk = {
                choices: [{ delta: { content: text, role: "assistant" }, index: 0 }],
                created: Math.floor(Date.now() / 1000),
                model: "gemini",
                object: "chat.completion.chunk",
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            }
          } catch {
            /* skip malformed */
          }
        }
      }
    },
  });
}

// ─── Utilities ───────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse JSON from AI text response, stripping markdown fences.
 */
export function parseAIJson<T = any>(raw: string, fallback: T): T {
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.error("Failed to parse AI JSON:", cleaned.slice(0, 500));
    return fallback;
  }
}
