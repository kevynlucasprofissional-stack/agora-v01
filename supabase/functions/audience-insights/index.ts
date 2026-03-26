import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { analysis } = await req.json();
    if (!analysis) {
      return new Response(JSON.stringify({ error: "analysis é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

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

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
                  target_generation: { type: "string", description: "Max 150 chars insight about target generation" },
                },
                required: ["consumption_behavior", "target_generation"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "audience_insights" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();

    // Extract from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let insights: { consumption_behavior: string; target_generation: string };

    if (toolCall?.function?.arguments) {
      insights =
        typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
    } else {
      // Fallback: try parsing content directly
      const content = data.choices?.[0]?.message?.content || "";
      const cleaned = content
        .replace(/```json\n?/g, "")
        .replace(/```/g, "")
        .trim();
      insights = JSON.parse(cleaned);
    }

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("audience-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
