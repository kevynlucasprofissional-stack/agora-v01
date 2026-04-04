import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, handleAIStatus, withErrorHandler } from "../_shared/errors.ts";
import { fetchIbgeData } from "../_shared/ibge.ts";
import { createAdminClient } from "../_shared/supabase.ts";

// ── Analysis tool schema ─────────────────────────────────────
const ANALYSIS_TOOL = {
  type: "function" as const,
  function: {
    name: "analysis_result",
    description: "Retorna o resultado completo da análise da campanha.",
    parameters: {
      type: "object",
      properties: {
        score_overall: { type: "number", description: "Score geral (0-100)" },
        score_sociobehavioral: { type: "number", description: "Score sociocomportamental (0-100)" },
        score_offer: { type: "number", description: "Score da oferta (0-100)" },
        score_performance: { type: "number", description: "Score de performance (0-100)" },
        industry: { type: "string", description: "Indústria/setor identificado" },
        primary_channel: { type: "string", description: "Canal principal identificado" },
        declared_target_audience: { type: "string", description: "Público-alvo identificado" },
        region: { type: "string", description: "Região/mercado" },
        executive_summary: { type: "string", description: "Resumo executivo em 2-3 parágrafos" },
        marketing_era: {
          type: "object",
          properties: {
            era: { type: "string" }, description: { type: "string" }, recommendation: { type: "string" },
          },
          required: ["era", "description", "recommendation"],
        },
        cognitive_biases: {
          type: "array",
          items: {
            type: "object",
            properties: { bias: { type: "string" }, status: { type: "string" }, application: { type: "string" } },
            required: ["bias", "status", "application"],
          },
        },
        hormozi_analysis: {
          type: "object",
          properties: {
            dream_outcome: { type: "number" }, perceived_likelihood: { type: "number" },
            time_delay: { type: "number" }, effort_sacrifice: { type: "number" },
            overall_value: { type: "string" },
          },
          required: ["dream_outcome", "perceived_likelihood", "time_delay", "effort_sacrifice", "overall_value"],
        },
        kpi_analysis: {
          type: "object",
          properties: {
            vanity_metrics: { type: "array", items: { type: "string" } },
            recommended_north_star: { type: "string" },
            recommended_kpis: { type: "array", items: { type: "string" } },
          },
          required: ["vanity_metrics", "recommended_north_star", "recommended_kpis"],
        },
        timing_analysis: {
          type: "object",
          properties: {
            demand_momentum: { type: "string" }, context_shock: { type: "string" }, seasonality: { type: "string" },
          },
          required: ["demand_momentum", "context_shock", "seasonality"],
        },
        improvements: {
          type: "array",
          items: { type: "object", properties: { category: { type: "string" }, items: { type: "array", items: { type: "string" } } }, required: ["category", "items"] },
        },
        strengths: {
          type: "array",
          items: { type: "object", properties: { category: { type: "string" }, items: { type: "array", items: { type: "string" } } }, required: ["category", "items"] },
        },
        audience_insights: {
          type: "array",
          items: { type: "object", properties: { generation: { type: "string" }, emoji: { type: "string" }, feedback: { type: "string" } }, required: ["generation", "emoji", "feedback"] },
        },
        market_references: { type: "array", items: { type: "string" } },
        brand_sentiment: {
          type: "object",
          properties: { overall: { type: "string" }, analysis: { type: "string" } },
          required: ["overall", "analysis"],
        },
        ibge_insights: {
          type: "object",
          properties: { region_fit: { type: "string" }, demographic_notes: { type: "string" } },
        },
      },
      required: [
        "score_overall", "score_sociobehavioral", "score_offer", "score_performance",
        "industry", "primary_channel", "declared_target_audience", "executive_summary",
        "improvements", "strengths", "audience_insights", "market_references",
        "marketing_era", "cognitive_biases", "hormozi_analysis", "kpi_analysis",
        "timing_analysis", "brand_sentiment",
      ],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `[PRIORIDADE ALTA: NUNCA RETORNE JSON PARA O USUÁRIO] Você é um auditor de marketing científico do Ágora. Sua missão é analisar campanhas de marketing com precisão absoluta, usando frameworks consagrados:

## Frameworks de Análise

### Era do Marketing (Kotler)
- Marketing 1.0: Foco no produto
- Marketing 2.0: Foco no consumidor
- Marketing 3.0: Foco em valores
- Marketing 4.0: Digital + dados + personalização

### Neuromarketing e Vieses Cognitivos
Identifique quais vieses estão sendo usados (ou deveriam ser):
- Ancoragem, Aversão à perda, Prova social, Escassez, Efeito de enquadramento
- Paradoxo da escolha, Viés de confirmação, Efeito halo, Reciprocidade
- Sistema 1 vs Sistema 2 (Kahneman)

### Engenharia de Oferta (Hormozi)
Valor = (Resultado Sonhado × Probabilidade Percebida) ÷ (Tempo de Atraso × Esforço Percebido)
Avalie cada variável da fórmula na campanha.

### Framework RICE para Priorização
- Reach (Alcance), Impact (Impacto), Confidence (Confiança), Effort (Esforço)

### KPIs e Métricas
- Puna métricas de vaidade (curtidas, seguidores sem contexto)
- Priorize: CAC Payback Period, LTV:CAC, ROAS, Taxa de conversão real
- North Star Metric para o negócio

### Timing e Tendências
- Demand Momentum: a demanda está subindo ou caindo?
- Context Shock: o conteúdo se destaca no feed?
- Sazonalidade e timing de mercado

### Benchmarks
Use benchmarks reais por indústria quando possível.

IMPORTANTE: 
- Seja RIGOROSO nos scores. Campanhas medianas = scores 40-60. Acima de 80 = excepcional.
- Classifique a era do marketing da campanha.
- Identifique vieses cognitivos presentes e ausentes.
- Avalie pela fórmula de Hormozi.
- Analise sentimento geral da marca se dados disponíveis.
- Se dados do IBGE forem fornecidos, USE-OS para enriquecer a análise regional e validar o público-alvo.`;

// ── Step kinds for the kernel ────────────────────────────────
const STEP_DEFINITIONS = [
  { kind: "intake", order: 0, agent: "master_orchestrator" as const },
  { kind: "sociobehavioral", order: 1, agent: "sociobehavioral" as const },
  { kind: "offer_analysis", order: 2, agent: "offer_engineer" as const },
  { kind: "performance_timing", order: 3, agent: "performance_scientist" as const },
  { kind: "synthesis", order: 4, agent: "chief_strategist" as const },
];

// ── Run tracking helpers ─────────────────────────────────────
async function createRun(supabaseAdmin: any, analysisRequestId: string, model: string) {
  const { data } = await supabaseAdmin
    .from("analysis_runs")
    .insert({
      analysis_request_id: analysisRequestId,
      status: "running",
      model_primary: model,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  return data?.id;
}

async function createSteps(supabaseAdmin: any, runId: string, inputPayload: Record<string, unknown>) {
  const steps = STEP_DEFINITIONS.map((s) => ({
    run_id: runId,
    step_kind: s.kind,
    step_order: s.order,
    agent_kind: s.agent,
    status: "pending" as const,
    input_payload: s.order === 0 ? inputPayload : {},
  }));
  await supabaseAdmin.from("run_steps").insert(steps);
}

async function completeRun(
  supabaseAdmin: any,
  runId: string,
  status: "completed" | "failed",
  modelUsed: string,
  result: Record<string, unknown> | null,
  startTime: number,
  errorMsg?: string,
) {
  const duration = Date.now() - startTime;

  // Update run
  await supabaseAdmin
    .from("analysis_runs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      model_fallback: modelUsed,
      error_message: errorMsg || null,
    })
    .eq("id", runId);

  // Mark all steps as completed/failed with the synthesis output
  if (status === "completed" && result) {
    // Update all steps to completed
    await supabaseAdmin
      .from("run_steps")
      .update({
        status: "completed",
        model_used: modelUsed,
        completed_at: new Date().toISOString(),
      })
      .eq("run_id", runId);

    // Put full output on synthesis step
    await supabaseAdmin
      .from("run_steps")
      .update({ output_payload: result })
      .eq("run_id", runId)
      .eq("step_kind", "synthesis");
  } else {
    await supabaseAdmin
      .from("run_steps")
      .update({
        status: "failed",
        error_message: errorMsg || "Run failed",
        completed_at: new Date().toISOString(),
      })
      .eq("run_id", runId);
  }
}

// ── IBGE enrichment ──────────────────────────────────────────
async function buildIbgeSection(rawPrompt: string): Promise<string> {
  const regionPatterns = [
    /(?:em|de|para|no|na|do|da)\s+([\wÀ-ÿ\s]+?)(?:\.|,|$|\n)/gi,
    /(?:cidade|estado|região|uf|município)[\s:]+([^\n,\.]+)/gi,
  ];

  for (const pattern of regionPatterns) {
    const matches = rawPrompt.matchAll(pattern);
    for (const match of matches) {
      const candidate = match[1]?.trim();
      if (candidate && candidate.length > 2 && candidate.length < 40) {
        const ibgeResult = await fetchIbgeData(candidate);
        if (ibgeResult.dados_disponiveis) {
          return `\n\n# DADOS DEMOGRÁFICOS DO IBGE (Reais, extraídos automaticamente)
- Estado/UF: ${ibgeResult.uf || "N/D"}
${ibgeResult.municipio ? `- Município: ${ibgeResult.municipio}` : ""}
- População Estimada: ${ibgeResult.populacao || "N/D"}
- Fonte: IBGE/SIDRA (dados oficiais do governo brasileiro)

INSTRUÇÃO: Use esses dados reais na sua análise sociocomportamental. Se a população ou região não forem adequadas para o produto/campanha, aponte isso como um gargalo.`;
        }
      }
    }
  }
  return "\n\n# DADOS IBGE: Região não identificada automaticamente no prompt. Use sua análise contextual.";
}

// ── Main ─────────────────────────────────────────────────────
serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  return withErrorHandler("analyze-campaign", async () => {
    const { rawPrompt, title, files, analysisRequestId } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return errorResponse(500, "GEMINI_API_KEY is not configured", { category: "integration" });
    }

    const startTime = Date.now();
    const supabaseAdmin = createAdminClient();

    // ── Create run if we have an analysisRequestId ──
    let runId: string | null = null;
    if (analysisRequestId) {
      try {
        runId = await createRun(supabaseAdmin, analysisRequestId, "gemini-2.5-flash");
        if (runId) {
          await createSteps(supabaseAdmin, runId, { rawPrompt, title, files });
        }
      } catch (e) {
        console.warn("Run tracking init failed (non-fatal):", e);
      }
    }

    // ── IBGE Enrichment ──
    const ibgeSection = await buildIbgeSection(rawPrompt);

    const userPrompt = `Analise a seguinte campanha de marketing:

TÍTULO: ${title || "Sem título"}

DESCRIÇÃO DA CAMPANHA:
${rawPrompt}

${files?.length ? `\nARQUIVOS ANEXADOS: ${files.map((f: string) => f).join(", ")}` : ""}
${ibgeSection}

Use a ferramenta "analysis_result" para retornar sua análise estruturada completa.`;

    // ── AI call with retry + fallback ──
    const models = ["gemini-2.5-flash", "gemini-2.5-pro"];
    let response: Response | null = null;
    let lastError = "";
    let modelUsed = models[0];

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${GEMINI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: "system", content: SYSTEM_PROMPT },
                  { role: "user", content: userPrompt },
                ],
                tools: [ANALYSIS_TOOL],
                tool_choice: { type: "function", function: { name: "analysis_result" } },
              }),
            },
          );

          modelUsed = model;

          if (response!.ok) break;

          const aiError = handleAIStatus(response!.status);
          if (aiError) {
            if (runId) {
              completeRun(supabaseAdmin, runId, "failed", model, null, startTime, `HTTP ${response!.status}`).catch(() => {});
            }
            return aiError;
          }

          const errText = await response!.text();
          lastError = `Model ${model} attempt ${attempt + 1}: ${response!.status} - ${errText}`;
          console.warn(lastError);

          if (response!.status >= 500) {
            await new Promise((r) => setTimeout(r, 2000));
            response = null;
            continue;
          }
          break;
        } catch (fetchErr) {
          lastError = `Fetch error for ${model}: ${fetchErr}`;
          console.warn(lastError);
          response = null;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      if (response?.ok) break;
    }

    if (!response || !response.ok) {
      console.error("All AI models failed:", lastError);
      if (runId) {
        completeRun(supabaseAdmin, runId, "failed", modelUsed, null, startTime, lastError).catch(() => {});
      }
      return errorResponse(503, "Serviço de IA temporariamente indisponível. Tente novamente em alguns instantes.", { category: "model" });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "analysis_result") {
      console.error("Unexpected response format:", JSON.stringify(data));
      if (runId) {
        completeRun(supabaseAdmin, runId, "failed", modelUsed, null, startTime, "Unexpected AI response format").catch(() => {});
      }
      return errorResponse(500, "Formato de resposta inesperado da IA", { category: "model" });
    }

    const analysisResult = JSON.parse(toolCall.function.arguments);

    // ── Complete run tracking ──
    if (runId) {
      completeRun(supabaseAdmin, runId, "completed", modelUsed, analysisResult, startTime).catch((e) => {
        console.warn("Run tracking completion failed (non-fatal):", e);
      });
    }

    // ── Return same contract as before ──
    return jsonResponse({ success: true, analysis: analysisResult });
  })(req);
});
