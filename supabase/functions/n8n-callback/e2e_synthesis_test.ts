import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const AGORA_SECRET = Deno.env.get("AGORA_CALLBACK_SECRET")!;

const FULL_ANALYSIS = {
  score_overall: 74,
  score_sociobehavioral: 72,
  score_offer: 68,
  score_performance: 65,
  executive_summary: "Teste E2E: campanha sólida com boa adequação ao público digital.",
  improvements: [
    { category: "Estratégia e Táticas", items: ["Implementar testes A/B", "Diversificar canais"] },
    { category: "Performance e Métricas", items: ["Substituir impressões por ROAS"] },
  ],
  strengths: [
    { category: "Estrutura de Oferta", items: ["Pricing com âncora bem posicionada"] },
  ],
  audience_insights: [
    { generation: "Geração Z", emoji: "📱", feedback: "Engaja com vídeo curto." },
  ],
  market_references: ["Benchmark CTR educação online: 2.1%"],
  marketing_era: {
    era: "Marketing 3.0 em transição para 4.0",
    description: "Foco em valores, subutiliza IA.",
    recommendation: "Incorporar personalização dinâmica.",
  },
  cognitive_biases: [
    { bias: "Prova Social", status: "Presente", application: "Depoimentos de clientes reais." },
    { bias: "Escassez", status: "Ausente (recomendado)", application: "Introduzir contadores regressivos." },
    { bias: "Ancoragem", status: "Presente (potencial)", application: "Preço anterior sem destaque." },
    { bias: "Aversão à Perda", status: "Mal aplicado", application: "Foca em ganhos." },
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
    seasonality: "Fora do pico sazonal.",
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

// Use the first running run available
const RUN_ID = "c26dadde-3e08-4d80-8041-2f3689572cf8";

Deno.test("e2e: full synthesis callback returns success", async () => {
  const { status, data } = await callCallback({
    run_id: RUN_ID,
    status: "completed",
    analysis: FULL_ANALYSIS,
  });

  console.log(`\n📥 Response (${status}):`, JSON.stringify(data, null, 2));

  assertEquals(status, 200);
  assertEquals(data.ok, true);

  // Either completed successfully or already finalized (idempotent)
  if (data.already_finalized) {
    console.log("⚠️ Run was already finalized — idempotent response OK");
    assertEquals(data.already_finalized, true);
  } else {
    assertEquals(data.status, "completed");
    console.log("✅ Callback accepted and processed!");
  }
});
