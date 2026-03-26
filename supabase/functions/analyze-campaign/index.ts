import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── IBGE Service ──────────────────────────────────────────────
const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1";
const SIDRA_BASE = "https://apisidra.ibge.gov.br";

interface IbgeData {
  municipio?: string;
  uf?: string;
  populacao?: string;
  dados_disponiveis: boolean;
  erro?: string;
}

async function fetchIbgeData(region: string): Promise<IbgeData> {
  try {
    // Normalize region input
    const normalized = region.trim().toLowerCase();

    // Map common UF names/abbreviations
    const ufMap: Record<string, string> = {
      sp: "35",
      "são paulo": "35",
      "sao paulo": "35",
      rj: "33",
      "rio de janeiro": "33",
      mg: "31",
      "minas gerais": "31",
      ba: "29",
      bahia: "29",
      pr: "41",
      paraná: "41",
      parana: "41",
      rs: "43",
      "rio grande do sul": "43",
      pe: "26",
      pernambuco: "26",
      ce: "23",
      ceará: "23",
      ceara: "23",
      pa: "15",
      pará: "15",
      para: "15",
      sc: "42",
      "santa catarina": "42",
      go: "52",
      goiás: "52",
      goias: "52",
      ma: "21",
      maranhão: "21",
      maranhao: "21",
      am: "13",
      amazonas: "13",
      es: "32",
      "espírito santo": "32",
      "espirito santo": "32",
      pb: "25",
      paraíba: "25",
      paraiba: "25",
      rn: "24",
      "rio grande do norte": "24",
      mt: "51",
      "mato grosso": "51",
      al: "27",
      alagoas: "27",
      pi: "22",
      piauí: "22",
      piaui: "22",
      df: "53",
      "distrito federal": "53",
      brasília: "53",
      brasilia: "53",
      ms: "50",
      "mato grosso do sul": "50",
      se: "28",
      sergipe: "28",
      ro: "11",
      rondônia: "11",
      rondonia: "11",
      to: "17",
      tocantins: "17",
      ac: "12",
      acre: "12",
      ap: "16",
      amapá: "16",
      amapa: "16",
      rr: "14",
      roraima: "14",
    };

    // Try to find UF code
    let ufCode: string | null = null;
    let municipioNome: string | null = null;

    // Check if input is a UF
    if (ufMap[normalized]) {
      ufCode = ufMap[normalized];
    } else {
      // Try to find city by searching municipalities
      // First check if it contains a UF reference
      for (const [key, code] of Object.entries(ufMap)) {
        if (normalized.includes(key) && key.length > 2) {
          ufCode = code;
          municipioNome = normalized
            .replace(key, "")
            .trim()
            .replace(/^[-,\s]+|[-,\s]+$/g, "");
          break;
        }
      }
    }

    if (!ufCode) {
      // Try to search for the city across all states
      const searchResp = await fetch(`${IBGE_BASE}/localidades/municipios`, {
        signal: AbortSignal.timeout(5000),
      });
      if (searchResp.ok) {
        const allMunicipios = await searchResp.json();
        const found = allMunicipios.find(
          (m: any) => m.nome.toLowerCase() === normalized || m.nome.toLowerCase().includes(normalized),
        );
        if (found) {
          ufCode = String(found.microrregiao?.mesorregiao?.UF?.id || "");
          municipioNome = found.nome;
        }
      }
    }

    if (!ufCode) {
      return { dados_disponiveis: false, erro: "Região não identificada no IBGE" };
    }

    // Fetch UF info
    const ufResp = await fetch(`${IBGE_BASE}/localidades/estados/${ufCode}`, {
      signal: AbortSignal.timeout(5000),
    });
    const ufData = ufResp.ok ? await ufResp.json() : null;

    // Fetch population estimate from SIDRA (table 6579 - population estimates)
    let populacao = "Não disponível";
    try {
      const popResp = await fetch(`${SIDRA_BASE}/values/t/6579/n3/${ufCode}/v/9324/p/last%201/d/v9324%200`, {
        signal: AbortSignal.timeout(8000),
      });
      if (popResp.ok) {
        const popData = await popResp.json();
        if (popData?.[1]?.V) {
          const pop = parseInt(popData[1].V);
          populacao = pop.toLocaleString("pt-BR") + " habitantes";
        }
      }
    } catch (e) {
      console.warn("IBGE SIDRA population fetch failed:", e);
    }

    return {
      uf: ufData?.nome || ufCode,
      municipio: municipioNome || undefined,
      populacao,
      dados_disponiveis: true,
    };
  } catch (e) {
    console.warn("IBGE data fetch error:", e);
    return { dados_disponiveis: false, erro: "API do IBGE temporariamente indisponível" };
  }
}

// ── Main ──────────────────────────────────────────────────────

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawPrompt, title, files } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ── IBGE Enrichment ──
    // Try to extract region from the prompt
    let ibgeSection = "";
    const regionPatterns = [
      /(?:em|de|para|no|na|do|da)\s+([\wÀ-ÿ\s]+?)(?:\.|,|$|\n)/gi,
      /(?:cidade|estado|região|uf|município)[\s:]+([^\n,\.]+)/gi,
    ];

    let detectedRegion = "";
    for (const pattern of regionPatterns) {
      const matches = rawPrompt.matchAll(pattern);
      for (const match of matches) {
        const candidate = match[1]?.trim();
        if (candidate && candidate.length > 2 && candidate.length < 40) {
          // Check if it looks like a Brazilian location
          const ibgeResult = await fetchIbgeData(candidate);
          if (ibgeResult.dados_disponiveis) {
            detectedRegion = candidate;
            ibgeSection = `\n\n# DADOS DEMOGRÁFICOS DO IBGE (Reais, extraídos automaticamente)
- Estado/UF: ${ibgeResult.uf || "N/D"}
${ibgeResult.municipio ? `- Município: ${ibgeResult.municipio}` : ""}
- População Estimada: ${ibgeResult.populacao || "N/D"}
- Fonte: IBGE/SIDRA (dados oficiais do governo brasileiro)

INSTRUÇÃO: Use esses dados reais na sua análise sociocomportamental. Se a população ou região não forem adequadas para o produto/campanha, aponte isso como um gargalo.`;
            break;
          }
        }
      }
      if (ibgeSection) break;
    }

    if (!ibgeSection) {
      ibgeSection = "\n\n# DADOS IBGE: Região não identificada automaticamente no prompt. Use sua análise contextual.";
    }

    const userPrompt = `Analise a seguinte campanha de marketing:

TÍTULO: ${title || "Sem título"}

DESCRIÇÃO DA CAMPANHA:
${rawPrompt}

${files?.length ? `\nARQUIVOS ANEXADOS: ${files.map((f: string) => f).join(", ")}` : ""}
${ibgeSection}

Use a ferramenta "analysis_result" para retornar sua análise estruturada completa.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
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
                      recommendation: { type: "string", description: "O que fazer para evoluir para a próxima era" },
                    },
                    required: ["era", "description", "recommendation"],
                  },
                  cognitive_biases: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        bias: { type: "string", description: "Nome do viés cognitivo" },
                        status: { type: "string", description: "'presente', 'ausente' ou 'mal aplicado'" },
                        application: { type: "string", description: "Como está sendo usado ou como deveria ser usado" },
                      },
                      required: ["bias", "status", "application"],
                    },
                    description: "Vieses cognitivos identificados na campanha",
                  },
                  hormozi_analysis: {
                    type: "object",
                    properties: {
                      dream_outcome: { type: "number", description: "Nota 1-5 para o resultado sonhado prometido" },
                      perceived_likelihood: {
                        type: "number",
                        description: "Nota 1-5 para probabilidade percebida de alcançar",
                      },
                      time_delay: { type: "number", description: "Nota 1-5 para tempo de espera (5=rápido)" },
                      effort_sacrifice: { type: "number", description: "Nota 1-5 para esforço percebido (5=fácil)" },
                      overall_value: { type: "string", description: "Diagnóstico geral do valor percebido" },
                    },
                    required: [
                      "dream_outcome",
                      "perceived_likelihood",
                      "time_delay",
                      "effort_sacrifice",
                      "overall_value",
                    ],
                  },
                  kpi_analysis: {
                    type: "object",
                    properties: {
                      vanity_metrics: {
                        type: "array",
                        items: { type: "string" },
                        description: "Métricas de vaidade identificadas",
                      },
                      recommended_north_star: { type: "string", description: "North Star Metric recomendada" },
                      recommended_kpis: { type: "array", items: { type: "string" }, description: "KPIs recomendados" },
                    },
                    required: ["vanity_metrics", "recommended_north_star", "recommended_kpis"],
                  },
                  timing_analysis: {
                    type: "object",
                    properties: {
                      demand_momentum: { type: "string", description: "Subindo, estável ou caindo" },
                      context_shock: { type: "string", description: "Avaliação de diferenciação no feed" },
                      seasonality: { type: "string", description: "Observações sobre timing e sazonalidade" },
                    },
                    required: ["demand_momentum", "context_shock", "seasonality"],
                  },
                  improvements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string", description: "Nome da categoria do gargalo (ex: Estratégia de Oferta, Segmentação, Métricas, Canais, Criativo, Posicionamento)" },
                        items: { type: "array", items: { type: "string" }, description: "Lista de gargalos específicos desta categoria" },
                      },
                      required: ["category", "items"],
                    },
                    description: "Lista de gargalos categorizados. Agrupe as melhorias em 3-6 categorias temáticas com subcategorias específicas.",
                  },
                  strengths: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string", description: "Nome da categoria do ponto forte (ex: Posicionamento, Canais, Público-Alvo, Criativo)" },
                        items: { type: "array", items: { type: "string" }, description: "Lista de pontos fortes específicos desta categoria" },
                      },
                      required: ["category", "items"],
                    },
                    description: "Lista de pontos fortes categorizados. Agrupe em 2-4 categorias temáticas.",
                  },
                  audience_insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        generation: { type: "string" },
                        emoji: { type: "string" },
                        feedback: { type: "string" },
                      },
                      required: ["generation", "emoji", "feedback"],
                    },
                    description: "Feedback de audiência sintética por geração",
                  },
                  market_references: {
                    type: "array",
                    items: { type: "string" },
                    description: "Referências de mercado e benchmarks",
                  },
                  brand_sentiment: {
                    type: "object",
                    properties: {
                      overall: { type: "string", description: "Positivo, Neutro ou Negativo" },
                      analysis: { type: "string", description: "Análise do sentimento baseado nos dados disponíveis" },
                    },
                    required: ["overall", "analysis"],
                  },
                  ibge_insights: {
                    type: "object",
                    properties: {
                      region_fit: { type: "string", description: "Adequação da região para o produto/campanha" },
                      demographic_notes: {
                        type: "string",
                        description: "Observações demográficas relevantes baseadas nos dados IBGE",
                      },
                    },
                  },
                },
                required: [
                  "score_overall",
                  "score_sociobehavioral",
                  "score_offer",
                  "score_performance",
                  "industry",
                  "primary_channel",
                  "declared_target_audience",
                  "executive_summary",
                  "improvements",
                  "strengths",
                  "audience_insights",
                  "market_references",
                  "marketing_era",
                  "cognitive_biases",
                  "hormozi_analysis",
                  "kpi_analysis",
                  "timing_analysis",
                  "brand_sentiment",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analysis_result" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "analysis_result") {
      console.error("Unexpected response format:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "Formato de resposta inesperado da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysisResult = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, analysis: analysisResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-campaign error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
