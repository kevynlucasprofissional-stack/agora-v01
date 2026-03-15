import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um especialista em marketing e estratégia de campanhas do Ágora. 
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisData, improvements } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

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

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
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
          stream: true,
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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-campaign error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
