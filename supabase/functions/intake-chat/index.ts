import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o assistente de intake do Ágora — uma plataforma de auditoria científica de campanhas de marketing.

Seu papel é coletar informações suficientes do usuário antes de iniciar a análise. Você precisa entender:
1. **Produto/Serviço**: O que está sendo vendido ou promovido
2. **Público-alvo**: Quem é o cliente ideal
3. **Canais**: Onde a campanha está rodando (Meta Ads, Google Ads, Instagram, etc.)
4. **Objetivo**: Qual o objetivo principal (vendas, leads, awareness, etc.)
5. **Métricas atuais** (opcional mas valioso): CTR, CPA, ROAS, conversões, etc.
6. **Orçamento** (opcional): Quanto está investindo

REGRAS:
- Responda SEMPRE em português brasileiro.
- Seja conciso e amigável. Use no máximo 2-3 frases + perguntas.
- Faça no máximo 2-3 perguntas por vez.
- Quando tiver informações suficientes (pelo menos produto, público e canais), responda EXATAMENTE com o prefixo "##READY##" seguido de um breve resumo do que será analisado.
- Se o input inicial já for detalhado o suficiente, responda com "##READY##" imediatamente.
- NÃO invente informações. Apenas organize o que o usuário forneceu.
- Seja direto, não seja excessivamente formal.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
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
          JSON.stringify({ error: "Créditos insuficientes. Entre em contato com o suporte." }),
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
    console.error("intake-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
