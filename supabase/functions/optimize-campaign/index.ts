import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import {
  errorResponse,
  jsonResponse,
  handleAIStatus,
  withErrorHandler,
} from "../_shared/errors.ts";
import { callGemini } from "../_shared/gemini.ts";
import { fetchIbgeData } from "../_shared/ibge.ts";

// ── Knowledge Base (embedded) ────────────────────────────────
const AGORA_KB = `[PRIORIDADE ALTA: NÃO RETORNE JSON PARA O USUÁRIO]
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

// ── Tool schema ──────────────────────────────────────────────
const OPTIMIZATION_TOOL = {
  type: "function" as const,
  function: {
    name: "optimization_result",
    description: "Retorna o resultado completo da otimização da campanha.",
    parameters: {
      type: "object",
      properties: {
        score_overall: { type: "number", description: "Score geral 0-100" },
        score_sociobehavioral: { type: "number", description: "Score sociocomportamental 0-100" },
        score_offer: { type: "number", description: "Score da oferta 0-100" },
        score_performance: { type: "number", description: "Score de performance 0-100" },
        industry: { type: "string" },
        primary_channel: { type: "string" },
        declared_target_audience: { type: "string" },
        region: { type: "string" },
        executive_summary: { type: "string", description: "Resumo executivo em 2-3 parágrafos" },
        marketing_era: {
          type: "object",
          properties: {
            era: { type: "string" },
            description: { type: "string" },
            recommendation: { type: "string" },
          },
          required: ["era", "description", "recommendation"],
        },
        web_context: {
          type: "object",
          properties: {
            brand_detected: { type: "string" },
            product_category: { type: "string" },
            commercial_event: { type: "string" },
            market_trends: { type: "array", items: { type: "string" } },
            competitor_insights: { type: "array", items: { type: "string" } },
          },
          required: ["brand_detected", "product_category"],
        },
        diagnostics: {
          type: "object",
          properties: {
            kpis: { type: "object", properties: { score: { type: "number" }, issues: { type: "array", items: { type: "string" } }, recommendations: { type: "array", items: { type: "string" } } }, required: ["score", "issues", "recommendations"] },
            segmentation: { type: "object", properties: { score: { type: "number" }, issues: { type: "array", items: { type: "string" } }, recommendations: { type: "array", items: { type: "string" } } }, required: ["score", "issues", "recommendations"] },
            interface_ux: { type: "object", properties: { score: { type: "number" }, issues: { type: "array", items: { type: "string" } }, recommendations: { type: "array", items: { type: "string" } } }, required: ["score", "issues", "recommendations"] },
            creative: { type: "object", properties: { score: { type: "number" }, issues: { type: "array", items: { type: "string" } }, recommendations: { type: "array", items: { type: "string" } } }, required: ["score", "issues", "recommendations"] },
            social_proof: { type: "object", properties: { score: { type: "number" }, issues: { type: "array", items: { type: "string" } }, recommendations: { type: "array", items: { type: "string" } } }, required: ["score", "issues", "recommendations"] },
          },
          required: ["kpis", "segmentation", "interface_ux", "creative", "social_proof"],
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
        cognitive_biases: {
          type: "array",
          items: {
            type: "object",
            properties: { bias: { type: "string" }, status: { type: "string" }, application: { type: "string" } },
            required: ["bias", "status", "application"],
          },
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
        audience_insights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              generation: { type: "string" }, emoji: { type: "string" },
              feedback: { type: "string", description: "Feedback na voz real da geração" },
            },
            required: ["generation", "emoji", "feedback"],
          },
          description: "OBRIGATÓRIO: 4 feedbacks, um para cada geração (Gen Z, Millennials, Gen X, Boomers)",
        },
        brand_sentiment: {
          type: "object",
          properties: { overall: { type: "string" }, analysis: { type: "string" } },
          required: ["overall", "analysis"],
        },
        market_references: { type: "array", items: { type: "string" } },
        strengths: { type: "array", items: { type: "string" } },
        optimized_campaign: {
          type: "object",
          properties: {
            headline: { type: "string" }, subheadline: { type: "string" },
            value_proposition: { type: "string" }, offer: { type: "string" },
            cta_primary: { type: "string" }, cta_secondary: { type: "string" },
            target_channels: { type: "array", items: { type: "string" } },
            tone_of_voice: { type: "string" },
            landing_page_structure: {
              type: "array",
              items: {
                type: "object",
                properties: { section: { type: "string" }, content: { type: "string" }, purpose: { type: "string" } },
                required: ["section", "content", "purpose"],
              },
            },
          },
          required: ["headline", "value_proposition", "offer", "cta_primary", "target_channels", "tone_of_voice", "landing_page_structure"],
        },
        creative_briefs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" }, title: { type: "string" },
              headline: { type: "string" }, body_copy: { type: "string" },
              cta: { type: "string" }, visual_direction: { type: "string" },
              format: { type: "string" },
            },
            required: ["type", "title", "headline", "body_copy", "cta", "visual_direction"],
          },
          description: "3-5 briefs de criativos prontos para produção",
        },
      },
      required: [
        "score_overall", "score_sociobehavioral", "score_offer", "score_performance",
        "industry", "primary_channel", "declared_target_audience", "executive_summary",
        "web_context", "diagnostics", "hormozi_analysis", "cognitive_biases",
        "kpi_analysis", "timing_analysis", "audience_insights", "brand_sentiment",
        "market_references", "strengths", "optimized_campaign", "creative_briefs",
        "marketing_era",
      ],
      additionalProperties: false,
    },
  },
};

// ── IBGE enrichment ──────────────────────────────────────────
async function buildIbgeSection(rawPrompt: string): Promise<string> {
  const regionPatterns = [
    /(?:em|de|para|no|na|do|da)\s+([\wÀ-ÿ\s]+?)(?:\.|,|$|\n)/gi,
  ];

  for (const pattern of regionPatterns) {
    const matches = rawPrompt.matchAll(pattern);
    for (const match of matches) {
      const candidate = match[1]?.trim();
      if (candidate && candidate.length > 2 && candidate.length < 40) {
        const ibgeResult = await fetchIbgeData(candidate);
        if (ibgeResult.dados_disponiveis) {
          return `\n\nDADOS IBGE (Reais): Estado: ${ibgeResult.uf || "N/D"}, População: ${ibgeResult.populacao || "N/D"}`;
        }
      }
    }
  }
  return "";
}

// ── Main ─────────────────────────────────────────────────────
serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  return withErrorHandler("optimize-campaign", async () => {
    const { rawPrompt, title, files, userDocuments } = await req.json();

    if (!rawPrompt || typeof rawPrompt !== "string") {
      return errorResponse(400, "rawPrompt é obrigatório", { category: "validation" });
    }

    // ── IBGE Enrichment (shared helper) ──
    const ibgeSection = await buildIbgeSection(rawPrompt);

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

    const response = await callGemini({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      tools: [OPTIMIZATION_TOOL],
      tool_choice: { type: "function", function: { name: "optimization_result" } },
    });

    if (!response.ok) {
      const aiError = handleAIStatus(response.status);
      if (aiError) return aiError;
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return errorResponse(500, "Erro no serviço de IA", { category: "model" });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "optimization_result") {
      console.error("Unexpected format:", JSON.stringify(data).slice(0, 500));
      return errorResponse(500, "Formato inesperado da IA", { category: "model" });
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    return jsonResponse({ analysis });
  })(req);
});
