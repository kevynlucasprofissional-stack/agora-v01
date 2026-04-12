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

// ── n8n callback payload ─────────────────────────────────────

const AgentResponseSchema = z.object({
  agent_id: z.string().uuid("agent_id must be a valid UUID"),
  analysis_request_id: z.string().uuid("analysis_request_id must be a valid UUID"),
  content: z.unknown().nullable().optional(),
  content_text: z.string().max(500_000).nullable().optional(),
  response_format: z.enum(["json", "markdown", "text"]).default("json"),
  success: z.boolean().default(true),
  error_message: z.string().max(5_000).nullable().optional(),
  model_name: z.string().max(200).nullable().optional(),
  latency_ms: z.number().int().nonnegative().nullable().optional(),
  tokens_input: z.number().int().nonnegative().nullable().optional(),
  tokens_output: z.number().int().nonnegative().nullable().optional(),
});

export const N8nCallbackPayloadSchema = z.object({
  run_id: z.string().uuid("run_id must be a valid UUID"),
  status: z.enum(["completed", "failed"]),
  analysis: z.record(z.unknown()).nullable().optional(),
  error: z.string().max(10_000).nullable().optional(),
  agent_responses: z.array(AgentResponseSchema).max(50).nullable().optional(),
});

export type N8nCallbackPayload = z.infer<typeof N8nCallbackPayloadSchema>;

// ── Step update payload (incremental n8n step patches) ───────

const StepUpdateSchema = z.object({
  step_kind: z.enum([
    "intake",
    "sociobehavioral",
    "offer_analysis",
    "performance_timing",
    "synthesis",
    "image_generation",
    "post_processing",
    "error_handling",
  ]),
  status: z.enum(["running", "completed", "failed"]),
  started_at: z.string().max(100).optional().nullable(),
  completed_at: z.string().max(100).optional().nullable(),
  duration_ms: z.number().int().nonnegative().optional().nullable(),
  output_payload: z.record(z.unknown()).optional().nullable().refine(
    (val) => {
      if (val == null) return true;
      const serialized = JSON.stringify(val);
      return !serialized.includes("[object Object]");
    },
    {
      message:
        "output_payload contém valores serializados como '[object Object]'. " +
        "Certifique-se de enviar objetos JSON reais, não strings coercidas. " +
        "Use um Code Node no n8n para montar o payload em vez de interpolação {{ }} em JSON textual.",
    },
  ),
  error_message: z.string().max(10_000).optional().nullable(),
  model_used: z.string().max(200).optional().nullable(),
  tokens_input: z.number().int().nonnegative().optional().nullable(),
  tokens_output: z.number().int().nonnegative().optional().nullable(),
  workflow_execution_id: z.string().max(500).optional().nullable(),
  attempt: z.number().int().nonnegative().optional().nullable(),
});

export const N8nStepUpdatePayloadSchema = z.object({
  run_id: z.string().uuid("run_id must be a valid UUID"),
  event_type: z.literal("step_update").optional(),
  step_update: StepUpdateSchema,
});

export type N8nStepUpdatePayload = z.infer<typeof N8nStepUpdatePayloadSchema>;

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
