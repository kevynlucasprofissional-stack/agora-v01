import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── IBGE Service ──────────────────────────────────────────────
const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1";
const SIDRA_BASE = "https://apisidra.ibge.gov.br";

const ufMap: Record<string, string> = {
  "sp": "35", "são paulo": "35", "sao paulo": "35",
  "rj": "33", "rio de janeiro": "33",
  "mg": "31", "minas gerais": "31",
  "ba": "29", "bahia": "29",
  "pr": "41", "paraná": "41", "parana": "41",
  "rs": "43", "rio grande do sul": "43",
  "pe": "26", "pernambuco": "26",
  "ce": "23", "ceará": "23", "ceara": "23",
  "sc": "42", "santa catarina": "42",
  "go": "52", "goiás": "52", "goias": "52",
  "df": "53", "distrito federal": "53", "brasília": "53",
};

async function fetchIbgeData(region: string) {
  try {
    const normalized = region.trim().toLowerCase();
    let ufCode = ufMap[normalized] || null;
    
    if (!ufCode) {
      for (const [key, code] of Object.entries(ufMap)) {
        if (normalized.includes(key) && key.length > 2) {
          ufCode = code;
          break;
        }
      }
    }
    if (!ufCode) return null;

    const ufResp = await fetch(`${IBGE_BASE}/localidades/estados/${ufCode}`, { signal: AbortSignal.timeout(5000) });
    const ufData = ufResp.ok ? await ufResp.json() : null;

    let populacao = "N/D";
    try {
      const popResp = await fetch(`${SIDRA_BASE}/values/t/6579/n3/${ufCode}/v/9324/p/last%201/d/v9324%200`, { signal: AbortSignal.timeout(8000) });
      if (popResp.ok) {
        const popData = await popResp.json();
        if (popData?.[1]?.V) populacao = parseInt(popData[1].V).toLocaleString("pt-BR") + " habitantes";
      }
    } catch {}

    return { uf: ufData?.nome || ufCode, populacao };
  } catch { return null; }
}

// ── Ágora Knowledge Base (embedded) ──────────────────────────
const AGORA_KB = `
# ÁGORA KNOWLEDGE BASE — Marketing Intelligence

## Framework Hormozi (Equação de Valor)
Valor = (Resultado Sonhado × Probabilidade Percebida) ÷ (Tempo de Atraso × Esforço/Sacrifício)
- Dream Outcome: O que o cliente realmente quer (não o que você vende)
- Perceived Likelihood: Prova social, garantias, credibilidade
- Time Delay: Quanto tempo até o primeiro resultado? (Quick wins = conversão)
- Effort & Sacrifice: Fricção no processo de compra e uso

## Framework RICE (Priorização)
Score = (Reach × Impact × Confidence) / Effort
- Reach: Quantas pessoas afeta por trimestre
- Impact: 0.25 (mínimo) a 3 (massivo)
- Confidence: % de certeza nos dados
- Effort: Pessoa-meses necessários

## Eras do Marketing (Kotler)
- 1.0: Centrado no produto. Comunicação de massa. "Compre isso."
- 2.0: Centrado no consumidor. Segmentação. "Isso é para você."
- 3.0: Centrado em valores. Propósito. "Juntos mudamos o mundo."
- 4.0: Digital-first. Dados, IA, personalização, comunidades. "Experiência sob medida."

## Neuromarketing por Geração (Base 2026)
### Gen Z (1997-2012, ~14-29 anos)
- Sistema 1 dominante (emocional, visual, rápido)
- Canais: TikTok, Reels, YouTube Shorts, WhatsApp
- Vieses: Imediatismo, escassez, prova social de criadores
- Tom: Horizontal, transparente, sem fricção
- Red flag: Qualquer processo com mais de 2 cliques

### Millennials (1981-1996, ~30-45 anos)
- Paradoxo da privacidade (aceita dar dados por personalização)
- Canais: Instagram, LinkedIn, WhatsApp, Email
- Vieses: Pertencimento, efeito manada, storytelling
- Tom: Empático, inspirador, foco em identidade
- Red flag: Falta de autenticidade ou propósito

### Gen X (1965-1980, ~46-61 anos)
- Pragmáticos, independentes, focados em ROI
- Canais: Email, Facebook, LinkedIn, TV
- Vieses: Ancoragem, ceticismo saudável
- Tom: Direto, prático, baseado em dados
- Red flag: Promessas exageradas sem prova

### Baby Boomers (1946-1964, ~62-80 anos)
- Sistema 2 dominante (lógico, analítico)
- Canais: TV, rádio, Facebook, contato direto
- Vieses: Aversão à perda, busca de segurança
- Tom: Respeitoso, formal, confiável
- Red flag: Urgência agressiva, linguagem informal

## Hierarquia de KPIs (Punição de Vaidade)
- Camada 1 (Negócio): ROI, ROAS, CAC, LTV, Payback Period
- Camada 2 (Conversão): Taxa de conversão, CTR, CPA, CPL
- Camada 3 (Engajamento): Comments, Shares, Saves
- Camada 4 (Vaidade): Curtidas, Impressões, Alcance
REGRA: Se campanha foca apenas em Camadas 3-4, PUNIR score em 40%.

## Timing Index
- Demand Momentum: Volume de busca e tendência (Google Trends proxy)
- Competitive Pressure: Saturação do mercado
- Context Shock: Eventos globais/nacionais afetando comportamento
- Decisão: Always-on | Pulsed (rajadas) | Pausar (brand safety)

## Regras de Triagem (T1-T4)
- T1 (Clareza): Oferta resumível em 1 frase? (Para quem + Resultado + Prazo + Mecanismo)
- T2 (Credibilidade): Prova social + mitigação de risco (garantias, trial)?
- T3 (Latência): Tempo até primeiro valor < 7 dias? Quick win disponível?
- T4 (Fricção): Menos de 3 passos no checkout? Sem excesso de opções?
`;

const SYSTEM_PROMPT = `Você é o Campaign Optimizer da Ágora — uma IA de marketing científico que analisa campanhas existentes e entrega versões otimizadas prontas para uso.

${AGORA_KB}

## Sua Missão
1. ANALISAR a campanha com rigor científico
2. DIAGNOSTICAR problemas por categoria estratégica
3. GERAR veredicto por geração (audiência sintética)
4. REESTRUTURAR a campanha completamente
5. CRIAR briefs de criativos prontos para produção

## Regras
- Scores rigorosos: campanhas medianas = 40-60. Acima de 80 = excepcional.
- Diagnóstico CATEGORIZADOS (KPIs, Segmentação, Interface/UX, Criativo, Prova Social)
- Veredicto geracional com linguagem REAL de cada geração
- Campanha otimizada COMPLETA e ACIONÁVEL
- Briefs de criativos com headline, copy, CTA e direção visual

IMPORTANTE: Se dados do IBGE forem fornecidos, USE-OS para validar público-alvo e adequação regional.
Simule que você tem acesso a dados de web search sobre a marca/produto/evento para enriquecer a análise.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawPrompt, title, files, userDocuments } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // ── IBGE Enrichment ──
    let ibgeSection = "";
    const regionPatterns = [
      /(?:em|de|para|no|na|do|da)\s+([\wÀ-ÿ\s]+?)(?:\.|,|$|\n)/gi,
    ];
    for (const pattern of regionPatterns) {
      const matches = rawPrompt.matchAll(pattern);
      for (const match of matches) {
        const candidate = match[1]?.trim();
        if (candidate && candidate.length > 2 && candidate.length < 40) {
          const ibgeResult = await fetchIbgeData(candidate);
          if (ibgeResult) {
            ibgeSection = `\n\nDADOS IBGE (Reais): Estado: ${ibgeResult.uf}, População: ${ibgeResult.populacao}`;
            break;
          }
        }
      }
      if (ibgeSection) break;
    }

    // ── User Documents Context ──
    let userDocsSection = "";
    if (userDocuments && userDocuments.length > 0) {
      userDocsSection = `\n\nDOCUMENTOS DO USUÁRIO (Knowledge Base):\n${userDocuments.map((d: string) => `- ${d}`).join("\n")}`;
    }

    const userPrompt = `Analise e otimize a seguinte campanha:

TÍTULO: ${title || "Sem título"}

DESCRIÇÃO DA CAMPANHA:
${rawPrompt}

${files?.length ? `ARQUIVOS ANEXADOS: ${files.join(", ")}` : ""}
${ibgeSection}
${userDocsSection}

INSTRUÇÕES:
1. Simule web search: analise como se tivesse pesquisado sobre a marca, produto, evento comercial e concorrentes mencionados.
2. Cruze com a Knowledge Base da Ágora (frameworks Hormozi, RICE, Kotler, neuromarketing).
3. Cruze com os documentos do usuário se fornecidos.
4. Gere diagnóstico CATEGORIZADO por: KPIs, Segmentação, Interface/UX, Criativo, Prova Social.
5. Gere veredicto de audiência sintética por geração com linguagem REAL.
6. Gere campanha otimizada COMPLETA.
7. Gere briefs de criativos prontos.

Use a ferramenta "optimization_result" para retornar TUDO estruturado.`;

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
                name: "optimization_result",
                description: "Retorna o resultado completo da otimização da campanha.",
                parameters: {
                  type: "object",
                  properties: {
                    // Scores
                    score_overall: { type: "number", description: "Score geral 0-100" },
                    score_sociobehavioral: { type: "number", description: "Score sociocomportamental 0-100" },
                    score_offer: { type: "number", description: "Score da oferta 0-100" },
                    score_performance: { type: "number", description: "Score de performance 0-100" },
                    // Context
                    industry: { type: "string" },
                    primary_channel: { type: "string" },
                    declared_target_audience: { type: "string" },
                    region: { type: "string" },
                    executive_summary: { type: "string", description: "Resumo executivo em 2-3 parágrafos" },
                    // Marketing Era
                    marketing_era: {
                      type: "object",
                      properties: {
                        era: { type: "string" },
                        description: { type: "string" },
                        recommendation: { type: "string" }
                      },
                      required: ["era", "description", "recommendation"]
                    },
                    // Web Context (simulated)
                    web_context: {
                      type: "object",
                      properties: {
                        brand_detected: { type: "string", description: "Marca detectada" },
                        product_category: { type: "string", description: "Categoria do produto" },
                        commercial_event: { type: "string", description: "Evento comercial (ex: Black Friday)" },
                        market_trends: { type: "array", items: { type: "string" }, description: "Tendências de mercado relevantes" },
                        competitor_insights: { type: "array", items: { type: "string" }, description: "Insights de concorrentes" }
                      },
                      required: ["brand_detected", "product_category"]
                    },
                    // Structured Diagnostics by Category
                    diagnostics: {
                      type: "object",
                      properties: {
                        kpis: {
                          type: "object",
                          properties: {
                            score: { type: "number", description: "Score 0-100 para KPIs" },
                            issues: { type: "array", items: { type: "string" } },
                            recommendations: { type: "array", items: { type: "string" } }
                          },
                          required: ["score", "issues", "recommendations"]
                        },
                        segmentation: {
                          type: "object",
                          properties: {
                            score: { type: "number" },
                            issues: { type: "array", items: { type: "string" } },
                            recommendations: { type: "array", items: { type: "string" } }
                          },
                          required: ["score", "issues", "recommendations"]
                        },
                        interface_ux: {
                          type: "object",
                          properties: {
                            score: { type: "number" },
                            issues: { type: "array", items: { type: "string" } },
                            recommendations: { type: "array", items: { type: "string" } }
                          },
                          required: ["score", "issues", "recommendations"]
                        },
                        creative: {
                          type: "object",
                          properties: {
                            score: { type: "number" },
                            issues: { type: "array", items: { type: "string" } },
                            recommendations: { type: "array", items: { type: "string" } }
                          },
                          required: ["score", "issues", "recommendations"]
                        },
                        social_proof: {
                          type: "object",
                          properties: {
                            score: { type: "number" },
                            issues: { type: "array", items: { type: "string" } },
                            recommendations: { type: "array", items: { type: "string" } }
                          },
                          required: ["score", "issues", "recommendations"]
                        }
                      },
                      required: ["kpis", "segmentation", "interface_ux", "creative", "social_proof"]
                    },
                    // Hormozi
                    hormozi_analysis: {
                      type: "object",
                      properties: {
                        dream_outcome: { type: "number" },
                        perceived_likelihood: { type: "number" },
                        time_delay: { type: "number" },
                        effort_sacrifice: { type: "number" },
                        overall_value: { type: "string" }
                      },
                      required: ["dream_outcome", "perceived_likelihood", "time_delay", "effort_sacrifice", "overall_value"]
                    },
                    // Cognitive Biases
                    cognitive_biases: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          bias: { type: "string" },
                          status: { type: "string" },
                          application: { type: "string" }
                        },
                        required: ["bias", "status", "application"]
                      }
                    },
                    // KPI Analysis
                    kpi_analysis: {
                      type: "object",
                      properties: {
                        vanity_metrics: { type: "array", items: { type: "string" } },
                        recommended_north_star: { type: "string" },
                        recommended_kpis: { type: "array", items: { type: "string" } }
                      },
                      required: ["vanity_metrics", "recommended_north_star", "recommended_kpis"]
                    },
                    // Timing
                    timing_analysis: {
                      type: "object",
                      properties: {
                        demand_momentum: { type: "string" },
                        context_shock: { type: "string" },
                        seasonality: { type: "string" }
                      },
                      required: ["demand_momentum", "context_shock", "seasonality"]
                    },
                    // Generational Verdict
                    audience_insights: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          generation: { type: "string" },
                          emoji: { type: "string" },
                          feedback: { type: "string", description: "Feedback na voz real da geração, como se fosse um membro dessa geração falando. Use gírias e linguagem natural." }
                        },
                        required: ["generation", "emoji", "feedback"]
                      },
                      description: "OBRIGATÓRIO: 4 feedbacks, um para cada geração (Gen Z, Millennials, Gen X, Boomers)"
                    },
                    // Brand Sentiment
                    brand_sentiment: {
                      type: "object",
                      properties: {
                        overall: { type: "string" },
                        analysis: { type: "string" }
                      },
                      required: ["overall", "analysis"]
                    },
                    // Market References
                    market_references: { type: "array", items: { type: "string" } },
                    // Strengths
                    strengths: { type: "array", items: { type: "string" } },
                    // Optimized Campaign
                    optimized_campaign: {
                      type: "object",
                      properties: {
                        headline: { type: "string", description: "Headline principal otimizada" },
                        subheadline: { type: "string", description: "Subheadline de suporte" },
                        value_proposition: { type: "string", description: "Proposta de valor clara e concisa" },
                        offer: { type: "string", description: "Oferta estruturada" },
                        cta_primary: { type: "string", description: "Call-to-action principal" },
                        cta_secondary: { type: "string", description: "Call-to-action secundário" },
                        target_channels: { type: "array", items: { type: "string" }, description: "Canais recomendados em ordem de prioridade" },
                        tone_of_voice: { type: "string", description: "Tom de voz recomendado" },
                        landing_page_structure: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              section: { type: "string" },
                              content: { type: "string" },
                              purpose: { type: "string" }
                            },
                            required: ["section", "content", "purpose"]
                          },
                          description: "Estrutura da landing page seção por seção"
                        }
                      },
                      required: ["headline", "value_proposition", "offer", "cta_primary", "target_channels", "tone_of_voice", "landing_page_structure"]
                    },
                    // Creative Briefs
                    creative_briefs: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          type: { type: "string", description: "banner, social_ad, video_script, email, headline_variations" },
                          title: { type: "string", description: "Título do criativo" },
                          headline: { type: "string" },
                          body_copy: { type: "string" },
                          cta: { type: "string" },
                          visual_direction: { type: "string", description: "Descrição visual detalhada para geração de imagem" },
                          format: { type: "string", description: "Formato recomendado (ex: 1080x1080, 1200x628, 9:16)" }
                        },
                        required: ["type", "title", "headline", "body_copy", "cta", "visual_direction"]
                      },
                      description: "3-5 briefs de criativos prontos para produção"
                    }
                  },
                  required: [
                    "score_overall", "score_sociobehavioral", "score_offer", "score_performance",
                    "industry", "primary_channel", "declared_target_audience",
                    "executive_summary", "web_context", "diagnostics",
                    "hormozi_analysis", "cognitive_biases", "kpi_analysis", "timing_analysis",
                    "audience_insights", "brand_sentiment", "market_references", "strengths",
                    "optimized_campaign", "creative_briefs", "marketing_era"
                  ],
                  additionalProperties: false
                }
              }
            }
          ],
          tool_choice: { type: "function", function: { name: "optimization_result" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "optimization_result") {
      console.error("Unexpected format:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "Formato inesperado da IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ analysis }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("optimize-campaign error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
