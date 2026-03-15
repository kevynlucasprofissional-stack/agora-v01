import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um auditor de marketing científico do Ágora. Sua missão é analisar campanhas de marketing com precisão, usando seu conhecimento profundo sobre:
- Benchmarks de mercado por indústria (CTR, CPA, ROAS médios)
- Estratégias de neuromarketing e vieses cognitivos
- Tendências de comportamento de consumidor por geração
- Melhores práticas de copy, oferta, funil e performance digital
- Dados de mercado brasileiro e internacional

IMPORTANTE: Analise com base em dados reais de mercado que você conhece. Pesquise em sua base de conhecimento sobre:
1. Benchmarks do setor/indústria mencionados
2. Público-alvo e comportamento geracional
3. Melhores práticas para os canais mencionados
4. Concorrentes e referências do mercado
5. Tendências atuais do setor

Seja RIGOROSO e HONESTO nos scores. Campanhas medianas devem ter scores medianos (40-60). Scores acima de 80 são reservados para campanhas excepcionais.`;

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

Use a ferramenta "analysis_result" para retornar sua análise estruturada.`;

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
                description: "Retorna o resultado completo da análise da campanha com scores, insights e recomendações.",
                parameters: {
                  type: "object",
                  properties: {
                    score_overall: {
                      type: "number",
                      description: "Score geral da campanha (0-100). Média ponderada dos 3 sub-scores."
                    },
                    score_sociobehavioral: {
                      type: "number",
                      description: "Score sociocomportamental (0-100). Avalia alinhamento com público-alvo, gatilhos mentais, vieses cognitivos, tom de voz geracional."
                    },
                    score_offer: {
                      type: "number",
                      description: "Score da oferta (0-100). Avalia proposta de valor, pricing, diferenciação, urgência, prova social."
                    },
                    score_performance: {
                      type: "number",
                      description: "Score de performance (0-100). Avalia KPIs, funil, canais, segmentação, otimização técnica."
                    },
                    industry: {
                      type: "string",
                      description: "Indústria/setor identificado (ex: 'E-commerce de Moda', 'SaaS B2B', 'Restaurante Local')"
                    },
                    primary_channel: {
                      type: "string",
                      description: "Canal principal identificado (ex: 'Meta Ads', 'Google Ads', 'Instagram Orgânico')"
                    },
                    declared_target_audience: {
                      type: "string",
                      description: "Público-alvo identificado ou inferido"
                    },
                    region: {
                      type: "string",
                      description: "Região/mercado identificado"
                    },
                    executive_summary: {
                      type: "string",
                      description: "Resumo executivo em 2-3 parágrafos com os principais achados da análise."
                    },
                    improvements: {
                      type: "array",
                      items: { type: "string" },
                      description: "Lista de 6-10 apontamentos de melhoria específicos e acionáveis."
                    },
                    strengths: {
                      type: "array",
                      items: { type: "string" },
                      description: "Lista de 3-5 pontos fortes identificados na campanha."
                    },
                    audience_insights: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          generation: { type: "string", description: "Geração (Gen Z, Millennials, Gen X, Boomers)" },
                          emoji: { type: "string", description: "Emoji representativo" },
                          feedback: { type: "string", description: "Feedback simulado dessa geração sobre a campanha" }
                        },
                        required: ["generation", "emoji", "feedback"]
                      },
                      description: "Feedback simulado de audiência sintética por geração."
                    },
                    market_references: {
                      type: "array",
                      items: { type: "string" },
                      description: "Referências de mercado, benchmarks e dados que fundamentam a análise."
                    }
                  },
                  required: [
                    "score_overall", "score_sociobehavioral", "score_offer", "score_performance",
                    "industry", "primary_channel", "declared_target_audience",
                    "executive_summary", "improvements", "strengths", "audience_insights", "market_references"
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
    
    // Extract tool call result
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
