/**
 * Shared Zod validation schemas for Ágora Edge Functions.
 *
 * Centralises input validation so every chat/analysis endpoint
 * rejects malformed payloads with a consistent 400 response.
 */

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { errorResponse } from "./errors.ts";

// ── Reusable atoms ───────────────────────────────────────────

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1, "Conteúdo da mensagem não pode estar vazio").max(100_000),
});

const FileContentSchema = z.object({
  name: z.string().max(500).optional(),
  type: z.string().max(200).optional(),
  content: z.string().max(20_000_000), // ~15 MB base64
  isBase64: z.boolean().optional(),
});

// ── Chat payload (intake-chat, comparator-chat, strategist-chat, etc.) ─

export const ChatPayloadSchema = z.object({
  messages: z
    .array(ChatMessageSchema)
    .min(1, "Pelo menos uma mensagem é obrigatória")
    .max(200, "Máximo de 200 mensagens por requisição"),
  fileContents: z.array(FileContentSchema).max(20).optional(),
});

export type ChatPayload = z.infer<typeof ChatPayloadSchema>;

// ── Analysis payload (analyze-campaign) ──────────────────────

export const AnalyzePayloadSchema = z.object({
  rawPrompt: z
    .string()
    .min(10, "Descrição da campanha muito curta (mín. 10 caracteres)")
    .max(50_000, "Descrição da campanha muito longa (máx. 50.000 caracteres)"),
  title: z.string().max(500).optional().nullable(),
  files: z.array(z.string().max(2000)).max(20).optional().nullable(),
  analysisRequestId: z.string().uuid("ID da análise inválido").optional().nullable(),
});

export type AnalyzePayload = z.infer<typeof AnalyzePayloadSchema>;

// ── Generic validator helper ─────────────────────────────────

/**
 * Validates `body` against `schema`.
 * Returns `{ data }` on success or `{ error: Response }` on failure.
 */
export function validatePayload<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
): { data: T; error?: never } | { data?: never; error: Response } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { data: result.data };
  }

  const fieldErrors = result.error.flatten().fieldErrors;
  const formErrors = result.error.flatten().formErrors;
  const messages = [
    ...formErrors,
    ...Object.entries(fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`),
  ];

  console.warn("Validation failed:", messages.join(" | "));
  return {
    error: errorResponse(400, messages[0] || "Payload inválido", { category: "validation" }),
  };
}
