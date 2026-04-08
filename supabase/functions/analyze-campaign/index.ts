import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, withErrorHandler } from "../_shared/errors.ts";
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
    return { dispatched: res.ok, ...(!res.ok ? { error: `HTTP ${res.status}` } : {}) };
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

    // ── Feature flag: USE_N8N_ASYNC ──
    const useN8nAsync = Deno.env.get("USE_N8N_ASYNC") !== "false"; // default true

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

    // ── Require analysisRequestId for async flow ──
    if (!analysisRequestId) {
      return errorResponse(400, "analysisRequestId é obrigatório", { category: "validation" });
    }

    // ── Create kernel run + pipeline steps ──
    const run = await KernelRun.create(supabaseAdmin, analysisRequestId, "n8n-orchestrated", {
      rawPrompt,
      title,
      files,
    });

    if (!run) {
      return errorResponse(500, "Failed to create analysis run", { category: "kernel" });
    }

    // ── Mark intake step as running ──
    const intakeStep = await run.startStep("intake", { rawPrompt, title });

    if (!useN8nAsync) {
      // Legacy inline kernel path — mark intake as completed and return
      if (intakeStep) await intakeStep.complete({});
      console.log(`[analyze-campaign] USE_N8N_ASYNC=false, legacy path for run_id=${run.runId}`);
      return jsonResponse({
        run_id: run.runId,
        analysis_request_id: analysisRequestId,
        status: "processing",
        message: "Análise iniciada (modo legado).",
      }, 202);
    }

    // ── Dispatch to n8n (async) ──
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

    // Structured log per spec §8
    console.log(JSON.stringify({
      run_id: run.runId,
      step_kind: "intake",
      attempt: 1,
      dispatch_error: dispatchResult.error || null,
      n8n_dispatched: dispatchResult.dispatched,
    }));

    // ── If dispatch failed: fail run immediately (no orphan) ──
    if (!dispatchResult.dispatched) {
      const failMsg = `n8n dispatch failed: ${dispatchResult.error}`;
      console.error(`[analyze-campaign] ${failMsg}`);

      if (intakeStep) await intakeStep.fail(failMsg);

      // Fail the run terminally
      await supabaseAdmin
        .from("analysis_runs")
        .update({
          status: "failed",
          error_message: failMsg,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.runId);

      // Also fail the analysis_request
      await supabaseAdmin
        .from("analysis_requests")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", analysisRequestId);

      return errorResponse(500, "Falha ao iniciar análise assíncrona", {
        category: "integration",
        detail: failMsg,
      });
    }

    // ── Return 202 immediately ──
    return jsonResponse({
      run_id: run.runId,
      analysis_request_id: analysisRequestId,
      status: "processing",
      message: "Análise iniciada. Acompanhe via Realtime.",
    }, 202);
  })(req);
});
