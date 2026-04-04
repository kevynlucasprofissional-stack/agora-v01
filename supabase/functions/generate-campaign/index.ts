import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, streamResponse, handleAIStatus, withErrorHandler } from "../_shared/errors.ts";
import { callGemini } from "../_shared/gemini.ts";

const SYSTEM_PROMPT = `[PRIORIDADE ALTA: NUNCA RETORNE JSON PARA O USUÁRIO]
Você é um especialista em marketing e estratégia de campanhas do Ágora. 
Sua tarefa é gerar uma CAMPANHA MELHORADA completa em formato Markdown, baseada na análise original e nos apontamentos de melhoria.

O documento deve ter as seguintes seções:
1. **Resumo Executivo** — Visão geral da campanha melhorada
2. **Público-Alvo Refinado** — Persona detalhada com base nos insights sociocomportamentais
3. **Proposta de Valor** — Headline principal + sub-headlines com gatilhos mentais
4. **Estratégia de Canais** — Canais recomendados com alocação de budget sugerida
5. **Criativos Sugeridos** — 3 variações de copy para anúncios (headline + body + CTA)
6. **Funil de Conversão** — Etapas otimizadas do funil
7. **Métricas & KPIs** — North Star Metric + KPIs secundários com metas sugeridas
8. **Plano de Testes A/B** — Hipóteses e variáveis para teste
9. **Cronograma Sugerido** — Timeline de implementação em sprints semanais

REGRAS:
- Responda SEMPRE em português brasileiro
- Use formatação Markdown rica (headers, bold, listas, tabelas quando aplicável)
- Seja específico e acionável, não genérico
- Incorpore TODOS os apontamentos de melhoria fornecidos
- O documento deve estar pronto para download e uso imediato`;

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  return withErrorHandler("generate-campaign", async () => {
    const { analysisData, improvements } = await req.json();

    const userPrompt = `Aqui estão os dados da análise original:
- Título: ${analysisData.title || "Sem título"}
- Prompt original: ${analysisData.raw_prompt}
- Score geral: ${analysisData.score_overall}/100
- Score Sociocomportamental: ${analysisData.score_sociobehavioral}/100
- Score Oferta: ${analysisData.score_offer}/100
- Score Performance: ${analysisData.score_performance}/100
- Indústria: ${analysisData.industry || "Não especificada"}
- Canal principal: ${analysisData.primary_channel || "Não especificado"}
- Público-alvo declarado: ${analysisData.declared_target_audience || "Não especificado"}
- Região: ${analysisData.region || "Não especificada"}

Apontamentos de melhoria selecionados pelo usuário:
${improvements.join("\n")}

Gere a campanha melhorada completa em Markdown.`;

    const response = await callGemini({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    });

    if (!response.ok) {
      const aiError = handleAIStatus(response.status);
      if (aiError) return aiError;
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return errorResponse(500, "Erro no serviço de IA", { category: "model" });
    }

    return streamResponse(response.body);
  })(req);
});
