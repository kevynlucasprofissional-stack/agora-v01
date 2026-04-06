import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, handleAIStatus, withErrorHandler } from "../_shared/errors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { KernelRun } from "../_shared/kernel.ts";

// ── n8n webhook dispatch (short timeout, non-blocking) ──
interface N8nPayload {
  run_id: string;
  analysis_request_id: string;
  rawPrompt: string;
  title: string | null;
  files: string[];
  user_id: string;
  supabase_url: string;
  triggered_at: string;
}

async function dispatchToN8n(payload: N8nPayload): Promise<{ dispatched: boolean; error?: string }> {
  const webhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
  const webhookSecret = Deno.env.get("N8N_INTERNAL_SECRET");

  if (!webhookUrl) {
    console.warn("[n8n-dispatch] N8N_WEBHOOK_URL not configured, skipping");
    return { dispatched: false, error: "N8N_WEBHOOK_URL not configured" };
  }

  if (!payload.run_id) {
    console.warn("[n8n-dispatch] run_id not defined, returning");
    return { dispatched: false, error: "run_id not defined" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret ? { "x-agora-webhook-secret": webhookSecret } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    console.log(`[n8n-dispatch] Response: ${res.status} for run_id=${payload.run_id}`);
    await res.text(); // consume body
    return { dispatched: res.ok };
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof DOMException && err.name === "AbortError" ? "Timeout (8s)" : String(err);
    console.error(`[n8n-dispatch] Failed for run_id=${payload.run_id}: ${msg}`);
    return { dispatched: false, error: msg };
  }
}

// ── Main ─────────────────────────────────────────────────────
serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  return withErrorHandler("analyze-campaign", async () => {
    const { checkRateLimit } = await import("../_shared/rate-limit.ts");
    const rateLimited = await checkRateLimit(req, "analyze-campaign", { maxRequests: 10, windowSeconds: 60 });
    if (rateLimited) return rateLimited;

    const { validatePayload, AnalyzePayloadSchema } = await import("../_shared/validation.ts");
    const body = await req.json();
    const validated = validatePayload(AnalyzePayloadSchema, body);
    if (validated.error) return validated.error;
    const { rawPrompt, title, files, analysisRequestId } = validated.data;

    const supabaseAdmin = createAdminClient();

    // ── Extract user_id from JWT (best-effort) ──
    let userId = "anonymous";
    try {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const {
          data: { user },
        } = await supabaseAdmin.auth.getUser(token);
        if (user) userId = user.id;
      }
    } catch {
      /* non-fatal */
    }

    // ── Create kernel run + pipeline steps ──
    let run: KernelRun | null = null;
    if (analysisRequestId) {
      run = await KernelRun.create(supabaseAdmin, analysisRequestId, "n8n-orchestrated", {
        rawPrompt,
        title,
        files,
      });
    }

    if (!run) {
      return errorResponse(500, "Failed to create analysis run", { category: "kernel" });
    }

    // ── Mark intake step as running ──
    const intakeStep = await run.startStep("intake", { rawPrompt, title });

    // ── Dispatch to n8n (async, but we await to know if it worked) ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const dispatchResult = await dispatchToN8n({
      run_id: run.runId,
      analysis_request_id: analysisRequestId,
      rawPrompt,
      title: title || null,
      files: files || [],
      user_id: userId,
      supabase_url: supabaseUrl,
      triggered_at: new Date().toISOString(),
    });

    console.log(`[analyze-campaign] Async dispatch: run_id=${run.runId}, dispatched=${dispatchResult.dispatched}`);

    // If dispatch failed, mark intake step as failed but still return 202
    // The n8n error handler or a future retry mechanism will handle this
    if (!dispatchResult.dispatched) {
      console.warn(`[analyze-campaign] n8n dispatch failed, run_id=${run.runId}: ${dispatchResult.error}`);
      if (intakeStep) {
        await intakeStep.fail(`n8n dispatch failed: ${dispatchResult.error}`);
      }
    }

    // ── Return 202 immediately ──
    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.runId,
        analysis_request_id: analysisRequestId,
        status: "processing",
        n8n_dispatched: dispatchResult.dispatched,
      }),
      {
        status: 202,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      },
    );
  })(req);
});
