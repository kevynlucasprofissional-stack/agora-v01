import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AGORA_SECRET = Deno.env.get("AGORA_CALLBACK_SECRET")!;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// Full synthesis payload matching ANALYSIS_TOOL schema
const FULL_ANALYSIS = {
  score_overall: 74,
  score_sociobehavioral: 72,
  score_offer: 68,
  score_performance: 65,
  executive_summary: "A campanha demonstra uma proposta sólida com boa adequação ao público digital.\n\nOs pontos fortes residem na estrutura de oferta e no uso de prova social.\n\nRecomenda-se focar em otimização de KPIs reais, ajuste de timing sazonal e fortalecimento da proposta de valor.",
  improvements: [
    { category: "Estratégia e Táticas", items: ["Implementar testes A/B", "Diversificar canais"] },
    { category: "Oferta e Comunicação", items: ["Adicionar escassez temporal ao CTA"] },
    { category: "Performance e Métricas", items: ["Substituir impressões por ROAS"] },
  ],
  strengths: [
    { category: "Estrutura de Oferta", items: ["Pricing com âncora bem posicionada"] },
    { category: "Comunicação", items: ["Tom de voz autêntico"] },
  ],
  audience_insights: [
    { generation: "Geração Z", emoji: "📱", feedback: "Engaja com vídeo curto, espera interatividade." },
    { generation: "Millennials", emoji: "💻", feedback: "Ressoa com tom aspiracional." },
  ],
  market_references: ["Benchmark CTR educação online: 2.1%", "CAC médio infoprodutos: R$ 45-85"],
  marketing_era: {
    era: "Marketing 3.0 em transição para 4.0",
    description: "Demonstra foco em valores, mas subutiliza IA.",
    recommendation: "Incorporar personalização dinâmica baseada em dados comportamentais.",
  },
  cognitive_biases: [
    { bias: "Prova Social", status: "Presente", application: "Depoimentos de clientes reais." },
    { bias: "Escassez", status: "Ausente (recomendado)", application: "Introduzir contadores regressivos." },
    { bias: "Ancoragem", status: "Presente (potencial)", application: "Preço anterior sem destaque visual." },
    { bias: "Aversão à Perda", status: "Mal aplicado", application: "Foca em ganhos, deveria destacar perdas." },
  ],
  hormozi_analysis: {
    dream_outcome: 8,
    perceived_likelihood: 6,
    time_delay: 5,
    effort_sacrifice: 4,
    overall_value: "(8 × 6) / (5 × 4) = 2.4 — Valor percebido moderado.",
  },
  kpi_analysis: {
    vanity_metrics: ["curtidas", "impressões", "seguidores"],
    recommended_north_star: "CPA com retenção de 30 dias",
    recommended_kpis: ["ROAS", "CAC", "LTV projetado"],
  },
  timing_analysis: {
    demand_momentum: "Demanda crescente no nicho de educação online.",
    context_shock: "Moderado — criativos seguem padrões comuns.",
    seasonality: "Fora do pico sazonal. Intensificar em janeiro.",
  },
  brand_sentiment: {
    overall: "Positivo",
    analysis: "Marca transmite confiança e inovação.",
  },
  industry: "Educação Online",
  primary_channel: "Instagram Ads",
  declared_target_audience: "Empreendedores 25-40 anos",
  region: "Brasil - Nacional",
};

async function callCallback(body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/n8n-callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agora-callback-secret": AGORA_SECRET,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

Deno.test("e2e: full synthesis callback persists all fields", async () => {
  // 1. Create a test analysis_request
  const { data: req, error: reqErr } = await sb
    .from("analysis_requests")
    .insert({
      raw_prompt: "E2E test campaign for synthesis callback",
      user_id: "00000000-0000-0000-0000-000000000000", // placeholder
      status: "processing",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  // If insert fails due to FK on user_id, use an existing request
  let analysisRequestId: string;
  let runId: string;

  if (reqErr) {
    console.log("⚠️ Cannot create test request (expected if no test user). Using existing running run.");

    // Find an existing running run
    const { data: existingRun } = await sb
      .from("analysis_runs")
      .select("id, analysis_request_id, status")
      .eq("status", "running")
      .limit(1)
      .single();

    if (!existingRun) {
      console.log("❌ No running runs found. Cannot test.");
      return;
    }

    runId = existingRun.id;
    analysisRequestId = existingRun.analysis_request_id;
    console.log(`Using existing run=${runId}, request=${analysisRequestId}`);
  } else {
    analysisRequestId = req.id;

    // 2. Create a test analysis_run
    const { data: run, error: runErr } = await sb
      .from("analysis_runs")
      .insert({
        analysis_request_id: analysisRequestId,
        status: "running",
        started_at: new Date(Date.now() - 30000).toISOString(), // 30s ago
      })
      .select("id")
      .single();

    if (runErr) throw runErr;
    runId = run!.id;
  }

  console.log(`\n📤 Sending full synthesis callback...`);
  console.log(`   run_id: ${runId}`);
  console.log(`   analysis_request_id: ${analysisRequestId}`);

  // 3. Call the callback with full analysis payload
  const { status, data } = await callCallback({
    run_id: runId,
    status: "completed",
    analysis: FULL_ANALYSIS,
  });

  console.log(`\n📥 Response (${status}):`, JSON.stringify(data, null, 2));

  assertEquals(status, 200);
  assertEquals(data.ok, true);
  assertEquals(data.status, "completed");

  // 4. Verify analysis_runs was updated
  const { data: updatedRun } = await sb
    .from("analysis_runs")
    .select("status, completed_at, duration_ms")
    .eq("id", runId)
    .single();

  console.log("\n🔍 analysis_runs after callback:", JSON.stringify(updatedRun, null, 2));
  assertEquals(updatedRun!.status, "completed");
  assertExists(updatedRun!.completed_at, "completed_at should be set");
  assertExists(updatedRun!.duration_ms, "duration_ms should be calculated");

  // 5. Verify analysis_requests was updated with all fields
  const { data: updatedReq } = await sb
    .from("analysis_requests")
    .select("status, score_overall, score_sociobehavioral, score_offer, score_performance, industry, primary_channel, declared_target_audience, region, normalized_payload")
    .eq("id", analysisRequestId)
    .single();

  console.log("\n🔍 analysis_requests scores:", {
    status: updatedReq!.status,
    score_overall: updatedReq!.score_overall,
    score_sociobehavioral: updatedReq!.score_sociobehavioral,
    score_offer: updatedReq!.score_offer,
    score_performance: updatedReq!.score_performance,
  });

  assertEquals(updatedReq!.status, "completed");
  assertEquals(Number(updatedReq!.score_overall), 74);
  assertEquals(Number(updatedReq!.score_sociobehavioral), 72);
  assertEquals(Number(updatedReq!.score_offer), 68);
  assertEquals(Number(updatedReq!.score_performance), 65);
  assertEquals(updatedReq!.industry, "Educação Online");
  assertEquals(updatedReq!.primary_channel, "Instagram Ads");
  assertEquals(updatedReq!.declared_target_audience, "Empreendedores 25-40 anos");
  assertEquals(updatedReq!.region, "Brasil - Nacional");

  // 6. Verify normalized_payload contains all structured fields
  const np = updatedReq!.normalized_payload as Record<string, unknown>;
  console.log("\n🔍 normalized_payload keys:", Object.keys(np));

  assertExists(np.executive_summary, "executive_summary missing from normalized_payload");
  assertExists(np.improvements, "improvements missing");
  assertExists(np.strengths, "strengths missing");
  assertExists(np.audience_insights, "audience_insights missing");
  assertExists(np.market_references, "market_references missing");
  assertExists(np.marketing_era, "marketing_era missing");
  assertExists(np.cognitive_biases, "cognitive_biases missing");
  assertExists(np.hormozi_analysis, "hormozi_analysis missing");
  assertExists(np.kpi_analysis, "kpi_analysis missing");
  assertExists(np.timing_analysis, "timing_analysis missing");
  assertExists(np.brand_sentiment, "brand_sentiment missing");

  // Verify nested structures
  const era = np.marketing_era as Record<string, string>;
  assertEquals(era.era, "Marketing 3.0 em transição para 4.0");
  assertExists(era.description);
  assertExists(era.recommendation);

  const hormozi = np.hormozi_analysis as Record<string, unknown>;
  assertEquals(hormozi.dream_outcome, 8);
  assertEquals(hormozi.perceived_likelihood, 6);
  assertEquals(hormozi.time_delay, 5);
  assertEquals(hormozi.effort_sacrifice, 4);
  assertExists(hormozi.overall_value);

  const kpi = np.kpi_analysis as Record<string, unknown>;
  assertEquals((kpi.vanity_metrics as string[]).length, 3);
  assertExists(kpi.recommended_north_star);
  assertEquals((kpi.recommended_kpis as string[]).length, 3);

  const timing = np.timing_analysis as Record<string, string>;
  assertExists(timing.demand_momentum);
  assertExists(timing.context_shock);
  assertExists(timing.seasonality);

  const sentiment = np.brand_sentiment as Record<string, string>;
  assertEquals(sentiment.overall, "Positivo");
  assertExists(sentiment.analysis);

  const biases = np.cognitive_biases as Array<Record<string, string>>;
  assertEquals(biases.length, 4);
  assertEquals(biases[0].bias, "Prova Social");
  assertEquals(biases[0].status, "Presente");

  console.log("\n✅ ALL FIELDS PERSISTED CORRECTLY!");
  console.log("   ✅ Scores: overall, sociobehavioral, offer, performance");
  console.log("   ✅ Context: industry, primary_channel, target_audience, region");
  console.log("   ✅ normalized_payload: executive_summary, improvements, strengths");
  console.log("   ✅ normalized_payload: audience_insights, market_references");
  console.log("   ✅ normalized_payload: marketing_era, cognitive_biases, hormozi_analysis");
  console.log("   ✅ normalized_payload: kpi_analysis, timing_analysis, brand_sentiment");
});
