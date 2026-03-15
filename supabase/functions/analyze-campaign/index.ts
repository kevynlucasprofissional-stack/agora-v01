import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um auditor de marketing científico do Ágora. Sua missão é analisar campanhas de marketing com precisão absoluta, usando frameworks consagrados:

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
- Analise sentimento geral da marca se dados disponíveis.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawPrompt, title, files } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userPrompt = `Analise a seguinte campanha de marketing:

TÍTULO: ${title || "Sem título"}

DESCRIÇÃO DA CAMPANHA:
${rawPrompt}

${files?.length ? `\nARQUIVOS ANEXADOS: ${files.map((f: string) => f).join(", ")}` : ""}

Use a ferramenta "analysis_result" para retornar sua análise estruturada completa.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
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
                        era: { type: "string", description: "1.0, 2.0, 3.0 ou 4.0" },
                        description: { type: "string", description: "Por que esta campanha está nesta era" },
                        recommendation: { type: "string", description: "O que fazer para evoluir para a próxima era" }
                      },
                      required: ["era", "description", "recommendation"]
                    },
                    cognitive_biases: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          bias: { type: "string", description: "Nome do viés cognitivo" },
                          status: { type: "string", description: "'presente', 'ausente' ou 'mal aplicado'" },
                          application: { type: "string", description: "Como está sendo usado ou como deveria ser usado" }
                        },
                        required: ["bias", "status", "application"]
                      },
                      description: "Vieses cognitivos identificados na campanha"
                    },
                    hormozi_analysis: {
                      type: "object",
                      properties: {
                        dream_outcome: { type: "number", description: "Nota 1-5 para o resultado sonhado prometido" },
                        perceived_likelihood: { type: "number", description: "Nota 1-5 para probabilidade percebida de alcançar" },
                        time_delay: { type: "number", description: "Nota 1-5 para tempo de espera (5=rápido)" },
                        effort_sacrifice: { type: "number", description: "Nota 1-5 para esforço percebido (5=fácil)" },
                        overall_value: { type: "string", description: "Diagnóstico geral do valor percebido" }
                      },
                      required: ["dream_outcome", "perceived_likelihood", "time_delay", "effort_sacrifice", "overall_value"]
                    },
                    kpi_analysis: {
                      type: "object",
                      properties: {
                        vanity_metrics: { type: "array", items: { type: "string" }, description: "Métricas de vaidade identificadas" },
                        recommended_north_star: { type: "string", description: "North Star Metric recomendada" },
                        recommended_kpis: { type: "array", items: { type: "string" }, description: "KPIs recomendados" }
                      },
                      required: ["vanity_metrics", "recommended_north_star", "recommended_kpis"]
                    },
                    timing_analysis: {
                      type: "object",
                      properties: {
                        demand_momentum: { type: "string", description: "Subindo, estável ou caindo" },
                        context_shock: { type: "string", description: "Avaliação de diferenciação no feed" },
                        seasonality: { type: "string", description: "Observações sobre timing e sazonalidade" }
                      },
                      required: ["demand_momentum", "context_shock", "seasonality"]
                    },
                    improvements: {
                      type: "array",
                      items: { type: "string" },
                      description: "Lista de 6-10 melhorias acionáveis"
                    },
                    strengths: {
                      type: "array",
                      items: { type: "string" },
                      description: "Lista de 3-5 pontos fortes"
                    },
                    audience_insights: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          generation: { type: "string" },
                          emoji: { type: "string" },
                          feedback: { type: "string" }
                        },
                        required: ["generation", "emoji", "feedback"]
                      },
                      description: "Feedback de audiência sintética por geração"
                    },
                    market_references: {
                      type: "array",
                      items: { type: "string" },
                      description: "Referências de mercado e benchmarks"
                    },
                    brand_sentiment: {
                      type: "object",
                      properties: {
                        overall: { type: "string", description: "Positivo, Neutro ou Negativo" },
                        analysis: { type: "string", description: "Análise do sentimento baseado nos dados disponíveis" }
                      },
                      required: ["overall", "analysis"]
                    }
                  },
                  required: [
                    "score_overall", "score_sociobehavioral", "score_offer", "score_performance",
                    "industry", "primary_channel", "declared_target_audience",
                    "executive_summary", "improvements", "strengths", "audience_insights",
                    "market_references", "marketing_era", "cognitive_biases", "hormozi_analysis",
                    "kpi_analysis", "timing_analysis", "brand_sentiment"
                  ],
                  additionalProperties: false
                }
              }
            }
          ],
          tool_choice: { type: "function", function: { name: "analysis_result" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro no serviço de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "analysis_result") {
      console.error("Unexpected response format:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Formato de resposta inesperado da IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const analysisResult = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ success: true, analysis: analysisResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-campaign error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
