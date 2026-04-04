import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, streamResponse, handleAIStatus, withErrorHandler } from "../_shared/errors.ts";
import { callGemini } from "../_shared/gemini.ts";

const SYSTEM_PROMPT = `[PRIORIDADE ALTA: NUNCA RETORNE JSON PARA O USUÁRIO]
Você é o Estrategista-Chefe da Ágora, o agente mais sênior da plataforma de auditoria de marketing. Você combina conhecimento profundo de:

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
- Quando relevante, cite qual viés cognitivo ou framework está usando

FORMATO DE PERGUNTAS INTERATIVAS:
Quando precisar fazer perguntas ao usuário para obter mais contexto ou apresentar opções de direcionamento, use EXATAMENTE este formato (além do seu texto normal):

Para perguntas com opções de múltipla escolha:
[CONTEXT_OPTIONS]{"question":"Sua pergunta aqui?","options":["Opção 1","Opção 2","Opção 3","Opção 4"]}[/CONTEXT_OPTIONS]

Para perguntas abertas onde a resposta é texto livre (ex: cidade, nome, descrição):
[CONTEXT_OPTIONS]{"question":"Sua pergunta aqui?","type":"text","placeholder":"Ex: São Paulo, SP"}[/CONTEXT_OPTIONS]

REGRAS DOS CARDS:
- Use no máximo 4 opções por bloco de múltipla escolha
- Cada opção deve ser uma frase curta e clara
- Pode usar múltiplos blocos se tiver perguntas diferentes
- Continue escrevendo normalmente antes e depois do bloco
- Para ORÇAMENTO/BUDGET, SEMPRE use opções com faixas: "Até R$1.000/mês", "R$1.000 a R$5.000/mês", "R$5.000 a R$20.000/mês", "Acima de R$20.000/mês"
- Para REGIÃO/CIDADE/LOCALIZAÇÃO, use type:"text" com placeholder adequado
- Para perguntas onde as respostas possíveis são bem definidas (indústria, canal, objetivo), use opções
- Para perguntas abertas (nome do produto, descrição, URL, cidade), use type:"text"`;

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  return withErrorHandler("strategist-chat", async () => {
    const { messages, analysisContext } = await req.json();

    const safeMessages = Array.isArray(messages) && messages.length > 0 ? messages : [];

    // Build context from analysis data
    const contextParts: string[] = [];
    if (analysisContext) {
      contextParts.push(`DADOS DA ANÁLISE:`);
      if (analysisContext.title) contextParts.push(`Título: ${analysisContext.title}`);
      if (analysisContext.score_overall != null) contextParts.push(`Score Geral: ${analysisContext.score_overall}/100`);
      if (analysisContext.score_sociobehavioral != null)
        contextParts.push(`Score Sociocomportamental: ${analysisContext.score_sociobehavioral}/100`);
      if (analysisContext.score_offer != null) contextParts.push(`Score Oferta: ${analysisContext.score_offer}/100`);
      if (analysisContext.score_performance != null)
        contextParts.push(`Score Performance: ${analysisContext.score_performance}/100`);
      if (analysisContext.industry) contextParts.push(`Indústria: ${analysisContext.industry}`);
      if (analysisContext.primary_channel) contextParts.push(`Canal Principal: ${analysisContext.primary_channel}`);
      if (analysisContext.declared_target_audience)
        contextParts.push(`Público-Alvo: ${analysisContext.declared_target_audience}`);
      if (analysisContext.raw_prompt) contextParts.push(`\nDescrição Original:\n${analysisContext.raw_prompt}`);

      const payload = analysisContext.normalized_payload;
      if (payload) {
        if (payload.executive_summary) contextParts.push(`\nResumo Executivo:\n${payload.executive_summary}`);
        if (payload.improvements?.length)
          contextParts.push(`\nGargalos:\n${payload.improvements.map((i: string) => `- ${i}`).join("\n")}`);
        if (payload.strengths?.length)
          contextParts.push(`\nPontos Fortes:\n${payload.strengths.map((s: string) => `- ${s}`).join("\n")}`);
        if (payload.marketing_era)
          contextParts.push(`\nEra do Marketing: ${payload.marketing_era.era} - ${payload.marketing_era.description}`);
        if (payload.cognitive_biases?.length)
          contextParts.push(
            `\nVieses Cognitivos:\n${payload.cognitive_biases.map((b: any) => `- ${b.bias}: ${b.application}`).join("\n")}`,
          );
      }
    }

    const systemContent =
      contextParts.length > 0 ? `${SYSTEM_PROMPT}\n\n${contextParts.join("\n")}` : SYSTEM_PROMPT;

    if (safeMessages.length === 0) {
      safeMessages.push({ role: "user", content: "Olá, analise minha campanha." });
    }

    const response = await callGemini({
      messages: [{ role: "system", content: systemContent }, ...safeMessages],
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
