import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Estrategista-Chefe da Ágora, o agente mais sênior da plataforma de auditoria de marketing. Você combina conhecimento profundo de:

1. **Neuromarketing**: Vieses cognitivos (ancoragem, aversão à perda, prova social, escassez, efeito de enquadramento, paradoxo da escolha), Sistema 1 vs Sistema 2 (Kahneman), gatilhos emocionais
2. **Engenharia de Oferta**: Fórmula de Hormozi (Valor = Resultado Sonhado × Probabilidade / Tempo × Esforço), Framework RICE, proposta de valor em 3 segundos
3. **Performance Digital**: KPIs reais vs métricas de vaidade, CAC Payback Period, LTV:CAC ratio, ROAS, funil de conversão
4. **Comportamento Geracional**: Preferências de Gen Z, Millennials, Gen X e Boomers em consumo de mídia, decisão de compra e linguagem
5. **Benchmarks de Mercado**: CTR, CPA, ROAS médios por indústria, tendências sazonais, demand momentum

Você está conversando com o usuário sobre uma análise de campanha já concluída. Use os dados da análise para dar respostas contextualizadas, específicas e acionáveis.

REGRAS:
- Responda SEMPRE em português brasileiro
- Seja direto, use dados e frameworks para fundamentar suas respostas
- Dê recomendações acionáveis com prioridades claras
- Use formatação Markdown (bold, listas, headers) para clareza
- Não invente dados numéricos específicos - use ranges e referências de benchmark quando aplicável
- Quando relevante, cite qual viés cognitivo ou framework está usando`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, analysisContext } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Build context from analysis data
    const contextParts = [];
    if (analysisContext) {
      contextParts.push(`DADOS DA ANÁLISE:`);
      if (analysisContext.title) contextParts.push(`Título: ${analysisContext.title}`);
      if (analysisContext.score_overall != null) contextParts.push(`Score Geral: ${analysisContext.score_overall}/100`);
      if (analysisContext.score_sociobehavioral != null) contextParts.push(`Score Sociocomportamental: ${analysisContext.score_sociobehavioral}/100`);
      if (analysisContext.score_offer != null) contextParts.push(`Score Oferta: ${analysisContext.score_offer}/100`);
      if (analysisContext.score_performance != null) contextParts.push(`Score Performance: ${analysisContext.score_performance}/100`);
      if (analysisContext.industry) contextParts.push(`Indústria: ${analysisContext.industry}`);
      if (analysisContext.primary_channel) contextParts.push(`Canal Principal: ${analysisContext.primary_channel}`);
      if (analysisContext.declared_target_audience) contextParts.push(`Público-Alvo: ${analysisContext.declared_target_audience}`);
      if (analysisContext.raw_prompt) contextParts.push(`\nDescrição Original:\n${analysisContext.raw_prompt}`);
      
      const payload = analysisContext.normalized_payload;
      if (payload) {
        if (payload.executive_summary) contextParts.push(`\nResumo Executivo:\n${payload.executive_summary}`);
        if (payload.improvements?.length) contextParts.push(`\nGargalos:\n${payload.improvements.map((i: string) => `- ${i}`).join('\n')}`);
        if (payload.strengths?.length) contextParts.push(`\nPontos Fortes:\n${payload.strengths.map((s: string) => `- ${s}`).join('\n')}`);
        if (payload.marketing_era) contextParts.push(`\nEra do Marketing: ${payload.marketing_era.era} - ${payload.marketing_era.description}`);
        if (payload.cognitive_biases?.length) contextParts.push(`\nVieses Cognitivos Identificados:\n${payload.cognitive_biases.map((b: any) => `- ${b.bias}: ${b.application}`).join('\n')}`);
      }
    }

    const contextMessage = contextParts.length > 0 ? {
      role: "system" as const,
      content: `${SYSTEM_PROMPT}\n\n${contextParts.join('\n')}`,
    } : { role: "system" as const, content: SYSTEM_PROMPT };

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
          messages: [contextMessage, ...messages],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("strategist-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
