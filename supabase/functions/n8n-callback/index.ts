/**
 * n8n-callback – Receives async workflow results from n8n.
 *
 * POST { run_id, status, analysis?, error?, agent_responses? }
 * Auth: x-agora-callback-secret header
 *
 * When status=completed and analysis is provided, the callback also
 * persists scores and normalized_payload to analysis_requests so the
 * frontend can display the report.
 */

import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { validatePayload, N8nCallbackPayloadSchema } from "../_shared/validation.ts";

// ── Helpers ─────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TERMINAL = ["completed", "failed"];

// ── Handler ─────────────────────────────────────────────────
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
  let runId = "";

  try {
    const raw = await req.json();
    const validated = validatePayload(N8nCallbackPayloadSchema, raw);
    if (validated.error) return validated.error;

    const { run_id, status, analysis, error: errorMsg, agent_responses } = validated.data;
    runId = run_id;

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
      console.log(`n8n-callback | run=${runId} | already finalized (${run.status})`);
      return json({ ok: true, already_finalized: true, current_status: run.status });
    }

    // Build update payload for analysis_runs
    const update: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };

    if (status === "completed" && analysis) {
      update.metadata = analysis;
    }
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
    // This is what the frontend reads for the report page
    if (status === "completed" && analysis && run.analysis_request_id) {
      const analysisData = analysis as Record<string, any>;
      const requestUpdate: Record<string, unknown> = {
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Scores
      if (analysisData.score_overall != null) requestUpdate.score_overall = analysisData.score_overall;
      if (analysisData.score_sociobehavioral != null) requestUpdate.score_sociobehavioral = analysisData.score_sociobehavioral;
      if (analysisData.score_offer != null) requestUpdate.score_offer = analysisData.score_offer;
      if (analysisData.score_performance != null) requestUpdate.score_performance = analysisData.score_performance;

      // Metadata fields
      if (analysisData.industry) requestUpdate.industry = analysisData.industry;
      if (analysisData.primary_channel) requestUpdate.primary_channel = analysisData.primary_channel;
      if (analysisData.declared_target_audience) requestUpdate.declared_target_audience = analysisData.declared_target_audience;
      if (analysisData.region) requestUpdate.region = analysisData.region;

      // Normalized payload (the full analysis for the report)
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
      `n8n-callback | run=${runId} | status=${status} | responses=${responsesInserted} | ${ms}ms`,
    );

    return json({
      ok: true,
      run_id,
      status,
      agent_responses_inserted: responsesInserted,
    });
  } catch (e) {
    const ms = (performance.now() - start).toFixed(0);
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error(`n8n-callback | run=${runId} | ${ms}ms | ERROR: ${msg}`);
    return json({ error: msg }, 500);
  }
});
