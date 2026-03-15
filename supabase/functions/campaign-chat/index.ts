import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o editor de campanhas do Ágora. O usuário está editando um documento de campanha de marketing melhorada.

Seu papel é:
1. Receber pedidos de edição do usuário (ex: "mude o tom para mais informal", "adicione um CTA mais agressivo", "reescreva a seção de público-alvo")
2. Retornar o documento COMPLETO atualizado em Markdown, incorporando as alterações solicitadas
3. Manter todas as seções que não foram alteradas intactas

REGRAS:
- Responda SEMPRE em português brasileiro
- SEMPRE retorne o documento COMPLETO em Markdown, não apenas a seção alterada
- O output deve ser APENAS o documento Markdown atualizado, sem explicações adicionais antes ou depois
- Mantenha a formatação rica (headers, bold, listas, tabelas)
- Se o usuário pedir algo que não faz sentido, retorne o documento original com um comentário no início: "<!-- NOTA: [explicação] -->"`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, currentDocument } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const contextMessage = {
      role: "user" as const,
      content: `Aqui está o documento atual da campanha que o usuário está editando:\n\n---\n${currentDocument}\n---\n\nO usuário fará pedidos de edição. Retorne SEMPRE o documento completo atualizado.`,
    };

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
            contextMessage,
            { role: "assistant", content: "Entendido. Estou pronto para editar o documento. Qual alteração deseja?" },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Tente novamente." }),
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
    console.error("campaign-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
