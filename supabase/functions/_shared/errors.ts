/**
 * Unified error taxonomy and response builders for Ágora Edge Functions.
 *
 * Error categories:
 *  - validation  : malformed input, missing required fields
 *  - auth        : unauthorized, invalid JWT
 *  - model       : AI gateway errors (rate-limit, credits, failures)
 *  - integration : external API failures (IBGE, storage, etc.)
 *  - persistence : database save/read failures
 *  - unknown     : catch-all
 */

import { corsHeaders } from "./cors.ts";

export type ErrorCategory =
  | "validation"
  | "auth"
  | "model"
  | "integration"
  | "persistence"
  | "unknown";

interface ErrorMeta {
  category: ErrorCategory;
  detail?: string;
}

/**
 * Build a JSON error Response with CORS headers.
 */
export function errorResponse(
  status: number,
  message: string,
  meta?: ErrorMeta,
): Response {
  const body: Record<string, unknown> = { error: message };
  if (meta?.category) body.category = meta.category;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Build a JSON success Response with CORS headers.
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Build a streaming SSE Response with CORS headers.
 */
export function streamResponse(body: ReadableStream | null): Response {
  return new Response(body, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

/**
 * Map common AI gateway HTTP statuses to user-facing error responses.
 * Returns null if the status is not a known AI error.
 */
export function handleAIStatus(status: number): Response | null {
  if (status === 429) {
    return errorResponse(429, "Muitas requisições. Tente novamente em alguns segundos.", {
      category: "model",
    });
  }
  if (status === 402) {
    return errorResponse(402, "Créditos insuficientes.", { category: "model" });
  }
  return null;
}

/**
 * Wraps an async handler with standard error catching + logging.
 */
export function withErrorHandler(
  fnName: string,
  handler: (req: Request) => Promise<Response>,
) {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (e) {
      console.error(`${fnName} error:`, e);
      return errorResponse(
        500,
        e instanceof Error ? e.message : "Erro desconhecido",
        { category: "unknown" },
      );
    }
  };
}
