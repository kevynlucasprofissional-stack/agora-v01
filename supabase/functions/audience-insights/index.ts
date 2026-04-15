import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, handleAIStatus, withErrorHandler } from "../_shared/errors.ts";
import { getGeminiKey, sleep } from "../_shared/gemini.ts";

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

    const systemPrompt = `Você é um analista de comportamento de consumo e perfil geracional.
Dado o contexto de uma campanha de marketing, gere EXATAMENTE um JSON com dois campos:
- "consumption_behavior": insight curto (máx 150 caracteres) sobre o comportamento de consumo do público-alvo desta campanha específica. Seja específico e acionável.
- "target_generation": insight curto (máx 150 caracteres) identificando a geração-alvo (Gen Z, Millennials, Gen X, Boomers) e seu comportamento digital relevante para esta campanha.

Responda APENAS com o JSON, sem markdown, sem backticks.`;

    const apiKey = getGeminiKey();
    const models = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"];
    let lastError = "";

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: contextParts.join("\n") }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: { responseMimeType: "application/json" },
              }),
            },
          );

          if (res.status === 429) return handleAIStatus(429)!;
          if (res.status === 402) return handleAIStatus(402)!;

          if (!res.ok) {
            const t = await res.text();
            lastError = `${model} ${res.status}: ${t.slice(0, 200)}`;
            console.warn(lastError);
            if (res.status >= 500 && attempt === 0) { await sleep(1500); continue; }
            break;
          }

          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const cleaned = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
          const insights = JSON.parse(cleaned);

          return jsonResponse(insights);
        } catch (err) {
          lastError = `${model} fetch error: ${err}`;
          console.warn(lastError);
          if (attempt === 0) await sleep(1000);
        }
      }
    }

    console.error("All models failed:", lastError);
    return errorResponse(500, "AI gateway error", { category: "model" });
  })(req);
});
