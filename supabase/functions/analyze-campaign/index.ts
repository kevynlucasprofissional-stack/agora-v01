import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, handleAIStatus, withErrorHandler } from "../_shared/errors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { KernelRun } from "../_shared/kernel.ts";
import { callGeminiWithRetry, type ChatMessage } from "../_shared/gemini.ts";

// ── Analysis tool definition for Gemini ──
const ANALYSIS_TOOL = {
  type: "function" as const,
  function: {
    name: "analysis_result",
    description: "Returns the structured campaign analysis result",
    parameters: {
      type: "object",
      properties: {
        score_overall: { type: "number", description: "Overall score 0-100" },
        score_sociobehavioral: { type: "number", description: "Sociobehavioral score 0-100" },
        score_offer: { type: "number", description: "Offer engineering score 0-100" },
        score_performance: { type: "number", description: "Performance score 0-100" },
        executive_summary: { type: "string", description: "Executive summary in Portuguese (3-5 paragraphs)" },
        improvements: {
          type: "array",
          description: "5-10 actionable improvements grouped by category",
          items: {
            type: "object",
            properties: {
              category: { type: "string", description: "Category name (e.g. Estratégia e Táticas, Oferta e Comunicação, Performance e Métricas)" },
              items: {
                type: "array",
                items: { type: "string" },
                description: "List of specific improvement recommendations"
              },
            },
            required: ["category", "items"],
          },
        },
        strengths: {
          type: "array",
          description: "3-5 identified strengths grouped by category",
          items: {
            type: "object",
            properties: {
              category: { type: "string", description: "Category name" },
              items: {
                type: "array",
                items: { type: "string" },
                description: "List of strength points"
              },
            },
            required: ["category", "items"],
          },
        },
        audience_insights: {
          type: "array",
          description: "Audience generation insights",
          items: {
            type: "object",
            properties: {
              generation: { type: "string", description: "Generation or audience segment name" },
              emoji: { type: "string", description: "Emoji representing the segment" },
              feedback: { type: "string", description: "Detailed insight about this audience segment" },
            },
            required: ["generation", "emoji", "feedback"],
          },
        },
        market_references: {
          type: "array",
          description: "Relevant market references and benchmarks",
          items: { type: "string" },
        },
        marketing_era: {
          type: "object",
          description: "Kotler marketing era classification",
          properties: {
            era: { type: "string", description: "Marketing era (e.g. 'Marketing 3.0 (Foco em Valores) em transição para 4.0')" },
            description: { type: "string", description: "Explanation of why this era applies" },
            recommendation: { type: "string", description: "Recommendation to evolve the marketing approach" },
          },
          required: ["era", "description", "recommendation"],
        },
        cognitive_biases: {
          type: "array",
          description: "4-6 cognitive biases analysis",
          items: {
            type: "object",
            properties: {
              bias: { type: "string", description: "Name of the cognitive bias" },
              status: { type: "string", description: "Status: Presente, Ausente (recomendado), Presente (potencial), or Mal aplicado" },
              application: { type: "string", description: "How this bias applies or could be applied to the campaign" },
            },
            required: ["bias", "status", "application"],
          },
        },
        hormozi_analysis: {
          type: "object",
          description: "Alex Hormozi Value Equation analysis",
          properties: {
            dream_outcome: { type: "number", description: "Dream Outcome score 1-10" },
            perceived_likelihood: { type: "number", description: "Perceived Likelihood of Achievement score 1-10" },
            time_delay: { type: "number", description: "Time Delay score 1-10 (higher = faster)" },
            effort_sacrifice: { type: "number", description: "Effort & Sacrifice score 1-10 (higher = easier)" },
            overall_value: { type: "string", description: "Calculated value equation and interpretation" },
          },
          required: ["dream_outcome", "perceived_likelihood", "time_delay", "effort_sacrifice", "overall_value"],
        },
        kpi_analysis: {
          type: "object",
          description: "KPI and metrics analysis",
          properties: {
            vanity_metrics: { type: "array", items: { type: "string" }, description: "Identified vanity metrics to avoid" },
            recommended_north_star: { type: "string", description: "Recommended North Star metric" },
            recommended_kpis: { type: "array", items: { type: "string" }, description: "Recommended KPIs to track" },
          },
          required: ["vanity_metrics", "recommended_north_star", "recommended_kpis"],
        },
        timing_analysis: {
          type: "object",
          description: "Timing and trends analysis",
          properties: {
            demand_momentum: { type: "string", description: "Current demand momentum assessment" },
            context_shock: { type: "string", description: "Context shock potential assessment" },
            seasonality: { type: "string", description: "Seasonality analysis and recommendations" },
          },
          required: ["demand_momentum", "context_shock", "seasonality"],
        },
        brand_sentiment: {
          type: "object",
          description: "Brand sentiment analysis",
          properties: {
            overall: { type: "string", description: "Overall sentiment (e.g. Positivo, Neutro, Negativo)" },
            analysis: { type: "string", description: "Detailed sentiment analysis" },
          },
          required: ["overall", "analysis"],
        },
        industry: { type: "string" },
        primary_channel: { type: "string" },
        declared_target_audience: { type: "string" },
        region: { type: "string" },
      },
      required: [
        "score_overall", "score_sociobehavioral", "score_offer", "score_performance",
        "executive_summary", "improvements", "strengths",
        "marketing_era", "cognitive_biases", "hormozi_analysis",
        "kpi_analysis", "timing_analysis", "brand_sentiment",
      ],
    },
  },
};

const SYSTEM_PROMPT = `Você é o Ágora, um sistema multiagente de análise de campanhas de marketing.
Analise a campanha descrita pelo usuário sob 4 perspectivas:

1. **Sociocomportamental** (score_sociobehavioral): Adequação psicográfica, gatilhos emocionais, vieses cognitivos, adequação cultural e geracional.
2. **Engenharia de Oferta** (score_offer): Proposta de valor, estrutura de preço, urgência, garantias, diferenciação competitiva.
3. **Performance & Timing** (score_performance): Canais, segmentação, métricas esperadas, sazonalidade, orçamento.
4. **Score Geral** (score_overall): Média ponderada considerando os 3 pilares.

Forneça TODOS os campos obrigatórios:

### Scores
- Scores de 0 a 100 para cada dimensão (score_overall, score_sociobehavioral, score_offer, score_performance)

### Resumo Executivo
- executive_summary: Resumo executivo em português (3-5 parágrafos detalhados)

### Melhorias (improvements)
- Array de objetos com { category, items[] }. Agrupe em 2-4 categorias (ex: "Estratégia e Táticas", "Oferta e Comunicação", "Performance e Métricas"). Cada categoria deve ter 2-4 itens específicos e acionáveis.

### Pontos Fortes (strengths)
- Array de objetos com { category, items[] }. Agrupe em 2-3 categorias com 1-3 itens cada.

### Era do Marketing (marketing_era)
- Classifique segundo Kotler (1.0 a 4.0). Campos: era (string com classificação, ex: "Marketing 3.0 (Foco em Valores)"), description, recommendation.

### Vieses Cognitivos (cognitive_biases)
- Analise 4-6 vieses cognitivos relevantes. Para cada: bias (nome), status ("Presente", "Presente (potencial)", "Ausente (recomendado)" ou "Mal aplicado"), application (como se aplica ou deveria ser aplicado).

### Análise de Valor Hormozi (hormozi_analysis)
- Equação de Valor: Valor = (Resultado Sonhado × Probabilidade) ÷ (Tempo × Esforço)
- Scores de 1 a 10 para: dream_outcome, perceived_likelihood, time_delay, effort_sacrifice
- overall_value: cálculo e interpretação textual

### Análise de KPIs (kpi_analysis)
- vanity_metrics: métricas de vaidade identificadas
- recommended_north_star: métrica North Star recomendada
- recommended_kpis: 4-6 KPIs recomendados

### Timing e Tendências (timing_analysis)
- demand_momentum: momento de demanda
- context_shock: potencial de choque de contexto
- seasonality: análise de sazonalidade

### Sentimento de Marca (brand_sentiment)
- overall: sentimento geral (Positivo, Neutro, Negativo ou Desconhecido)
- analysis: análise detalhada

### Insights de Audiência (audience_insights)
- Array com segmentos de público, cada um com: generation, emoji, feedback

### Referências de Mercado (market_references)
- Array de strings com referências relevantes do mercado

### Campos adicionais
- industry, primary_channel, declared_target_audience, region

Responda SEMPRE usando a tool analysis_result. Seja específico, profundo e acionável. Todos os textos em português.`;

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
    await res.text();
    return { dispatched: res.ok, ...(!res.ok ? { error: `HTTP ${res.status}` } : {}) };
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof DOMException && err.name === "AbortError" ? "Timeout (8s)" : String(err);
    console.error(`[n8n-dispatch] Failed for run_id=${payload.run_id}: ${msg}`);
    return { dispatched: false, error: msg };
  }
}

// ── Legacy inline analysis ──────────────────────────────────
async function runInlineAnalysis(
  run: KernelRun,
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  rawPrompt: string,
  analysisRequestId: string,
): Promise<Response> {
  const startTime = Date.now();

  try {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: rawPrompt },
    ];

    // Call Gemini with tool calling
    const intakeStep = await run.startStep("intake", { rawPrompt });
    const { data, response: aiResponse } = await callGeminiWithRetry({
      messages,
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: "function", function: { name: "analysis_result" } },
    });

    // Check for AI errors
    const aiError = handleAIStatus(aiResponse.status);
    if (aiError) {
      await run.finish("failed", { errorMessage: `AI error: ${aiResponse.status}` });
      await supabaseAdmin
        .from("analysis_requests")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", analysisRequestId);
      return aiError;
    }

    if (!data) {
      await run.finish("failed", { errorMessage: "No data from AI" });
      return errorResponse(500, "AI retornou resposta vazia", { category: "model" });
    }

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let analysis: Record<string, unknown>;

    if (toolCall?.function?.arguments) {
      analysis = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } else {
      // Fallback: try to parse content as JSON
      const content = data.choices?.[0]?.message?.content || "";
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleaned);
    }

    if (intakeStep) await intakeStep.complete(analysis, {
      model: data.model || "gemini-2.5-flash",
      tokensIn: data.usage?.prompt_tokens,
      tokensOut: data.usage?.completion_tokens,
    });

    // Complete all remaining steps as completed (inline mode skips individual agent steps)
    const stepKinds = ["sociobehavioral", "offer_analysis", "performance_timing", "synthesis"] as const;
    for (const kind of stepKinds) {
      const step = await run.startStep(kind, {});
      if (step) await step.complete({ mode: "inline", source: "gemini" });
    }

    // Persist to analysis_requests
    const a = analysis as Record<string, any>;
    const requestUpdate: Record<string, unknown> = {
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (a.score_overall != null) requestUpdate.score_overall = a.score_overall;
    if (a.score_sociobehavioral != null) requestUpdate.score_sociobehavioral = a.score_sociobehavioral;
    if (a.score_offer != null) requestUpdate.score_offer = a.score_offer;
    if (a.score_performance != null) requestUpdate.score_performance = a.score_performance;
    if (a.industry) requestUpdate.industry = a.industry;
    if (a.primary_channel) requestUpdate.primary_channel = a.primary_channel;
    if (a.declared_target_audience) requestUpdate.declared_target_audience = a.declared_target_audience;
    if (a.region) requestUpdate.region = a.region;

    // Persist ALL fields into normalized_payload (matching n8n async output)
    requestUpdate.normalized_payload = {
      executive_summary: a.executive_summary,
      improvements: a.improvements,
      strengths: a.strengths,
      audience_insights: a.audience_insights,
      market_references: a.market_references,
      marketing_era: a.marketing_era,
      cognitive_biases: a.cognitive_biases,
      hormozi_analysis: a.hormozi_analysis,
      kpi_analysis: a.kpi_analysis,
      timing_analysis: a.timing_analysis,
      brand_sentiment: a.brand_sentiment,
    };

    await supabaseAdmin
      .from("analysis_requests")
      .update(requestUpdate)
      .eq("id", analysisRequestId);

    // Finish the run
    await run.finish("completed", { modelUsed: data.model || "gemini-2.5-flash" });

    const durationMs = Date.now() - startTime;
    console.log(JSON.stringify({
      run_id: run.runId,
      mode: "inline",
      model_used: data.model || "gemini-2.5-flash",
      duration_ms: durationMs,
      tokens_input: data.usage?.prompt_tokens,
      tokens_output: data.usage?.completion_tokens,
    }));

    return jsonResponse({
      success: true,
      run_id: run.runId,
      analysis_request_id: analysisRequestId,
      status: "completed",
      analysis,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido na análise inline";
    console.error(`[analyze-campaign] Inline analysis failed: ${msg}`);

    await run.finish("failed", { errorMessage: msg });
    await supabaseAdmin
      .from("analysis_requests")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", analysisRequestId);

    return errorResponse(500, msg, { category: "model" });
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

    // ── Require analysisRequestId ──
    if (!analysisRequestId) {
      return errorResponse(400, "analysisRequestId é obrigatório", { category: "validation" });
    }

    // ── Create kernel run + pipeline steps ──
    const orchestratorLabel = useN8nAsync ? "n8n-orchestrated" : "inline-gemini";
    const run = await KernelRun.create(supabaseAdmin, analysisRequestId, orchestratorLabel, {
      rawPrompt,
      title,
      files,
    });

    if (!run) {
      return errorResponse(500, "Failed to create analysis run", { category: "kernel" });
    }

    // ── Legacy inline path ──
    if (!useN8nAsync) {
      console.log(`[analyze-campaign] USE_N8N_ASYNC=false, running inline for run_id=${run.runId}`);
      return runInlineAnalysis(run, supabaseAdmin, rawPrompt, analysisRequestId);
    }

    // ── Async n8n path ──
    const intakeStep = await run.startStep("intake", { rawPrompt, title });
    // Mover o step para 'running' imediatamente antes do dispatch
    if (intakeStep) await intakeStep.updateStatus("running");

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

    console.log(JSON.stringify({
      run_id: run.runId,
      step_kind: "intake",
      attempt: 1,
      dispatch_error: dispatchResult.error || null,
      n8n_dispatched: dispatchResult.dispatched,
      model_used: null,
      tokens_input: null,
      tokens_output: null,
      duration_ms: null,
      workflow_execution_id: null,
    }));

    // ── If dispatch failed: fail run immediately (no orphan) ──
    if (!dispatchResult.dispatched) {
      const failMsg = `n8n dispatch failed: ${dispatchResult.error}`;
      console.error(`[analyze-campaign] ${failMsg}`);

      if (intakeStep) await intakeStep.fail(failMsg);

      await supabaseAdmin
        .from("analysis_runs")
        .update({
          status: "failed",
          error_message: failMsg,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.runId);

      await supabaseAdmin
        .from("analysis_requests")
        .update({ status: "failed", updated_at: new Date().toISOString() })
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
