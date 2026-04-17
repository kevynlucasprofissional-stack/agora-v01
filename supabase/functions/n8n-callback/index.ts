/**
 * n8n-callback – Receives async workflow results from n8n.
 *
 * Supports TWO modes:
 *
 * A) Legacy final callback (retrocompatible):
 *    POST { run_id, status, analysis?, error?, agent_responses? }
 *
 * B) Incremental step update (new, governed by N8N_CALLBACK_ENABLE_STEP_UPDATES flag):
 *    POST { run_id, event_type?: "step_update", step_update: { step_kind, status, ... } }
 *
 * Auth: x-agora-callback-secret header
 */

import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import {
  validatePayload,
  N8nCallbackPayloadSchema,
  N8nStepUpdatePayloadSchema,
} from "../_shared/validation.ts";
import type { N8nStepUpdatePayload } from "../_shared/validation.ts";

// ── Helpers ─────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TERMINAL = ["completed", "failed"];

// Valid state transitions for run_steps
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["running", "completed", "failed"],
  running: ["completed", "failed"],
  completed: [],
  failed: [],
};

// ── Step Update Handler ─────────────────────────────────────
async function handleStepUpdate(
  payload: N8nStepUpdatePayload,
  start: number,
): Promise<Response> {
  const { run_id, step_update } = payload;
  const { step_kind, status: newStatus } = step_update;

  // Feature flag check
  const flagEnabled = Deno.env.get("N8N_CALLBACK_ENABLE_STEP_UPDATES") === "true";
  if (!flagEnabled) {
    console.log(`n8n-callback | step_update DISABLED | run=${run_id} | step=${step_kind}`);
    return json({ ok: true, step_updates_disabled: true, run_id, step_kind });
  }

  const sb = createAdminClient();

  // Check run exists and is not terminal
  const { data: run, error: runErr } = await sb
    .from("analysis_runs")
    .select("id, status")
    .eq("id", run_id)
    .maybeSingle();

  if (runErr) throw runErr;
  if (!run) return json({ error: "Run not found", run_id }, 404);

  if (TERMINAL.includes(run.status)) {
    console.log(`n8n-callback | step_update | run=${run_id} | run already terminal (${run.status})`);
    return json({ ok: true, run_terminal: true, run_status: run.status, run_id, step_kind });
  }

  // Fetch step by run_id + step_kind
  const { data: step, error: stepErr } = await sb
    .from("run_steps")
    .select("id, status")
    .eq("run_id", run_id)
    .eq("step_kind", step_kind)
    .maybeSingle();

  if (stepErr) throw stepErr;
  if (!step) return json({ error: "Step not found", run_id, step_kind }, 404);

  const prevStatus = step.status as string;

  // Idempotent: already at target status
  if (prevStatus === newStatus) {
    const ms = (performance.now() - start).toFixed(0);
    console.log(`n8n-callback | step_update | run=${run_id} | step=${step_kind} | already_at=${newStatus} | ${ms}ms`);
    return json({ ok: true, already_at_status: true, run_id, step_kind, status: newStatus });
  }

  // Validate transition
  const allowed = VALID_TRANSITIONS[prevStatus] || [];
  if (!allowed.includes(newStatus)) {
    const ms = (performance.now() - start).toFixed(0);
    console.log(`n8n-callback | step_update | run=${run_id} | step=${step_kind} | BLOCKED ${prevStatus}->${newStatus} | ${ms}ms`);
    return json({
      ok: true,
      transition_blocked: true,
      run_id,
      step_kind,
      previous_status: prevStatus,
      requested_status: newStatus,
    });
  }

  // Build update object
  const updateObj: Record<string, unknown> = { status: newStatus };

  // Auto-set started_at when transitioning to running (if not provided)
  const startedAt = step_update.started_at ?? (newStatus === "running" ? new Date().toISOString() : undefined);
  if (startedAt) updateObj.started_at = startedAt;

  if (step_update.completed_at) updateObj.completed_at = step_update.completed_at;
  if (step_update.duration_ms != null) updateObj.duration_ms = step_update.duration_ms;
  if (step_update.output_payload != null) updateObj.output_payload = step_update.output_payload;
  if (step_update.error_message) updateObj.error_message = step_update.error_message;
  if (step_update.model_used) updateObj.model_used = step_update.model_used;
  if (step_update.tokens_input != null) updateObj.tokens_input = step_update.tokens_input;
  if (step_update.tokens_output != null) updateObj.tokens_output = step_update.tokens_output;

  const { error: updateErr } = await sb
    .from("run_steps")
    .update(updateObj)
    .eq("id", step.id);

  if (updateErr) throw updateErr;

  const ms = (performance.now() - start).toFixed(0);
  console.log(`n8n-callback | step_update | run=${run_id} | step=${step_kind} | ${prevStatus}->${newStatus} | ${ms}ms`);

  // Include started_at in response so n8n can use it for duration calculation
  const response: Record<string, unknown> = {
    ok: true,
    run_id,
    step_kind,
    previous_status: prevStatus,
    new_status: newStatus,
  };
  if (startedAt) response.started_at = startedAt;

  return json(response);
}

// ── Legacy Final Callback Handler ───────────────────────────
async function handleLegacyCallback(raw: Record<string, unknown>, start: number): Promise<Response> {
  const validated = validatePayload(N8nCallbackPayloadSchema, raw);
  if (validated.error) return validated.error;

  const { run_id, status, analysis, error: errorMsg, agent_responses } = validated.data;

  const sb = createAdminClient();

  // Fetch current run
  const { data: run, error: fetchErr } = await sb
    .from("analysis_runs")
    .select("id, status, analysis_request_id")
    .eq("id", run_id)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!run) return json({ error: "Run not found", run_id }, 404);

  // Idempotency: skip if already terminal
  if (TERMINAL.includes(run.status)) {
    console.log(`n8n-callback | run=${run_id} | already finalized (${run.status})`);
    return json({ ok: true, already_finalized: true, current_status: run.status });
  }

  // Build update payload for analysis_runs
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  };

  if (status === "failed" && errorMsg) {
    update.error_message = errorMsg;
  }

  // Duration
  const { data: runFull } = await sb
    .from("analysis_runs")
    .select("started_at")
    .eq("id", run_id)
    .single();

  if (runFull?.started_at) {
    const durationMs = Date.now() - new Date(runFull.started_at).getTime();
    update.duration_ms = durationMs;
  }

  // Update analysis_runs
  const { error: updateErr } = await sb
    .from("analysis_runs")
    .update(update)
    .eq("id", run_id);

  if (updateErr) throw updateErr;

  // ── Persist analysis results to analysis_requests ──
  if (status === "completed" && run.analysis_request_id) {
    // Fallback: if `analysis` is missing or incomplete, read from synthesis step output
    let analysisData: Record<string, any> = (analysis as Record<string, any>) ?? {};

    const needsFallback =
      !analysisData ||
      analysisData.score_overall == null ||
      analysisData.score_sociobehavioral == null ||
      analysisData.score_offer == null ||
      analysisData.score_performance == null ||
      !analysisData.executive_summary;

    if (needsFallback) {
      const { data: synthStep } = await sb
        .from("run_steps")
        .select("output_payload")
        .eq("run_id", run_id)
        .eq("step_kind", "synthesis")
        .maybeSingle();

      const synth = (synthStep?.output_payload as Record<string, any>) ?? {};
      // Support both flat scores and nested { scores: {...} } shapes
      const nestedScores = (synth.scores as Record<string, any>) ?? {};
      const merged: Record<string, any> = {
        ...synth,
        ...nestedScores,
        ...analysisData, // explicit analysis values still win when present
      };
      // Ensure score fields fall back when analysisData has nulls
      for (const k of ["score_overall", "score_sociobehavioral", "score_offer", "score_performance"]) {
        if (merged[k] == null) {
          merged[k] = synth[k] ?? nestedScores[k] ?? null;
        }
      }
      analysisData = merged;
      console.log(`n8n-callback | run=${run_id} | scores fallback from synthesis step: overall=${analysisData.score_overall}`);
    }

    const requestUpdate: Record<string, unknown> = {
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (analysisData.score_overall != null) requestUpdate.score_overall = analysisData.score_overall;
    if (analysisData.score_sociobehavioral != null) requestUpdate.score_sociobehavioral = analysisData.score_sociobehavioral;
    if (analysisData.score_offer != null) requestUpdate.score_offer = analysisData.score_offer;
    if (analysisData.score_performance != null) requestUpdate.score_performance = analysisData.score_performance;

    if (analysisData.industry) requestUpdate.industry = analysisData.industry;
    if (analysisData.primary_channel) requestUpdate.primary_channel = analysisData.primary_channel;
    if (analysisData.declared_target_audience) requestUpdate.declared_target_audience = analysisData.declared_target_audience;
    if (analysisData.region) requestUpdate.region = analysisData.region;

    requestUpdate.normalized_payload = {
      executive_summary: analysisData.executive_summary,
      improvements: analysisData.improvements,
      strengths: analysisData.strengths,
      audience_insights: analysisData.audience_insights,
      market_references: analysisData.market_references,
      marketing_era: analysisData.marketing_era,
      cognitive_biases: analysisData.cognitive_biases,
      hormozi_analysis: analysisData.hormozi_analysis,
      kpi_analysis: analysisData.kpi_analysis,
      timing_analysis: analysisData.timing_analysis,
      brand_sentiment: analysisData.brand_sentiment,
      ibge_insights: analysisData.ibge_insights,
    };

    const { error: reqUpdateErr } = await sb
      .from("analysis_requests")
      .update(requestUpdate)
      .eq("id", run.analysis_request_id);

    if (reqUpdateErr) {
      console.error(`n8n-callback | Failed to update analysis_requests: ${reqUpdateErr.message}`);
    } else {
      console.log(`n8n-callback | analysis_requests updated for ${run.analysis_request_id}`);
    }
  }

  // If failed, also update analysis_requests status
  if (status === "failed" && run.analysis_request_id) {
    await sb
      .from("analysis_requests")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.analysis_request_id);
  }

  // Insert agent_responses if provided
  let responsesInserted = 0;
  if (agent_responses && agent_responses.length > 0) {
    const rows = agent_responses.map((r) => ({
      agent_id: r.agent_id,
      analysis_request_id: r.analysis_request_id,
      content: r.content ?? null,
      content_text: r.content_text ?? null,
      response_format: r.response_format ?? "json",
      success: r.success ?? true,
      error_message: r.error_message ?? null,
      model_name: r.model_name ?? null,
      latency_ms: r.latency_ms ?? null,
      tokens_input: r.tokens_input ?? null,
      tokens_output: r.tokens_output ?? null,
    }));

    const { error: insertErr } = await sb
      .from("agent_responses")
      .insert(rows);

    if (insertErr) throw insertErr;
    responsesInserted = rows.length;
  }

  const ms = (performance.now() - start).toFixed(0);
  console.log(
    `n8n-callback | run=${run_id} | status=${status} | responses=${responsesInserted} | ${ms}ms`,
  );

  return json({
    ok: true,
    run_id,
    status,
    agent_responses_inserted: responsesInserted,
  });
}

// ── Main Handler ────────────────────────────────────────────
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Auth
  const secret = Deno.env.get("AGORA_CALLBACK_SECRET");
  const provided = req.headers.get("x-agora-callback-secret") ?? "";
  if (!secret || provided !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const start = performance.now();

  try {
    const raw = await req.json();

    // Route: step_update branch vs legacy
    if (raw && typeof raw === "object" && "step_update" in raw) {
      const validated = validatePayload(N8nStepUpdatePayloadSchema, raw);
      if (validated.error) return validated.error;
      return await handleStepUpdate(validated.data, start);
    }

    // Legacy final callback
    return await handleLegacyCallback(raw, start);
  } catch (e) {
    const ms = (performance.now() - start).toFixed(0);
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error(`n8n-callback | ${ms}ms | ERROR: ${msg}`);
    return json({ error: msg }, 500);
  }
});
