import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, handleAIStatus, withErrorHandler } from "../_shared/errors.ts";
import { callGemini } from "../_shared/gemini.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  return withErrorHandler("audience-insights", async () => {
    const { analysis } = await req.json();
    if (!analysis) {
      return errorResponse(400, "analysis é obrigatório", { category: "validation" });
    }

    const payload = analysis.normalized_payload || {};
    const contextParts: string[] = [];
    if (analysis.title) contextParts.push(`Campanha: ${analysis.title}`);
    if (analysis.industry) contextParts.push(`Indústria: ${analysis.industry}`);
    if (analysis.declared_target_audience)
      contextParts.push(`Público-alvo declarado: ${analysis.declared_target_audience}`);
    if (analysis.primary_channel) contextParts.push(`Canal: ${analysis.primary_channel}`);
    if (analysis.raw_prompt) contextParts.push(`Descrição: ${analysis.raw_prompt}`);
    if (payload.executive_summary) contextParts.push(`Resumo: ${payload.executive_summary}`);
    if (payload.strengths?.length) contextParts.push(`Pontos fortes: ${payload.strengths.join("; ")}`);
    if (payload.improvements?.length) contextParts.push(`Gargalos: ${payload.improvements.join("; ")}`);

    const systemPrompt = `[PRIORIDADE ALTA: NUNCA RETORNE JSON PARA O USUÁRIO] Você é um analista de comportamento de consumo e perfil geracional.
Dado o contexto de uma campanha de marketing, gere EXATAMENTE um JSON com dois campos:
- "consumption_behavior": insight curto (máx 150 caracteres) sobre o comportamento de consumo do público-alvo desta campanha específica. Seja específico e acionável.
- "target_generation": insight curto (máx 150 caracteres) identificando a geração-alvo (Gen Z, Millennials, Gen X, Boomers) e seu comportamento digital relevante para esta campanha.

Responda APENAS com o JSON, sem markdown, sem backticks.`;

    const response = await callGemini({
      model: "gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextParts.join("\n") },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "audience_insights",
            description: "Return audience behavior and generation insights",
            parameters: {
              type: "object",
              properties: {
                consumption_behavior: {
                  type: "string",
                  description: "Max 150 chars insight about consumption behavior",
                },
                target_generation: {
                  type: "string",
                  description: "Max 150 chars insight about target generation",
                },
              },
              required: ["consumption_behavior", "target_generation"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "audience_insights" } },
    });

    if (!response.ok) {
      const aiError = handleAIStatus(response.status);
      if (aiError) return aiError;
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return errorResponse(500, "AI gateway error", { category: "model" });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let insights: { consumption_behavior: string; target_generation: string };

    if (toolCall?.function?.arguments) {
      insights =
        typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
    } else {
      const content = data.choices?.[0]?.message?.content || "";
      const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      insights = JSON.parse(cleaned);
    }

    return jsonResponse(insights);
  })(req);
});
