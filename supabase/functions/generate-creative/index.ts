import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brief } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Generate ONLY the visual background — no text baked in the image
    const prompt = `Create a professional marketing creative background image for a social media ad.

CONTEXT: ${brief.context || "Marketing campaign"}
VISUAL DIRECTION: ${brief.visual_direction || "Modern, clean, professional"}
FORMAT: ${brief.format || "1080x1080 square"}
INDUSTRY: ${brief.industry || "General"}
TARGET AUDIENCE: ${brief.target_audience || "General"}

IMPORTANT RULES:
- Do NOT include any text, words, letters, numbers, or typography in the image
- Create ONLY the visual/graphic background
- The image should work as a backdrop for text overlays
- Use vibrant, professional colors
- Leave clear space (especially center and top) for text to be overlaid later
- Make the design modern and eye-catching
- Use gradients, shapes, or photography that matches the brand energy`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Image gen error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro na geração de imagem" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Imagem não foi gerada. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also use AI to suggest text content for the creative
    const textResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "Você é um copywriter de marketing. Gere textos curtos e impactantes para criativos de anúncios. Responda APENAS com JSON válido, sem markdown."
          },
          {
            role: "user",
            content: `Gere textos para um criativo de marketing com base neste contexto:
${brief.context || "Campanha de marketing"}
Indústria: ${brief.industry || "Geral"}
Público: ${brief.target_audience || "Geral"}

Responda no formato JSON:
{"headline": "texto curto e impactante (max 8 palavras)", "subheadline": "frase de suporte (max 15 palavras)", "cta": "texto do botão CTA (max 4 palavras)"}`
          }
        ],
      }),
    });

    let suggestedText = { headline: "Seu Título Aqui", subheadline: "Subtítulo do seu criativo", cta: "Saiba Mais" };

    if (textResponse.ok) {
      try {
        const textData = await textResponse.json();
        const content = textData.choices?.[0]?.message?.content || "";
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        suggestedText = JSON.parse(cleaned);
      } catch {
        console.warn("Could not parse suggested text, using defaults");
      }
    }

    return new Response(JSON.stringify({ image: imageUrl, suggestedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-creative error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
