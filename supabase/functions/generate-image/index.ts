import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { messages = [], user_prompt, format = "1080x1080", reference_images = [] } = await req.json();

    // Build effective messages: combine chat history + user prompt
    const effectiveMessages = [...(Array.isArray(messages) ? messages : [])];
    if (user_prompt?.trim()) {
      effectiveMessages.push({ role: "user", content: user_prompt.trim() });
    }

    if (effectiveMessages.length === 0) {
      return new Response(JSON.stringify({ error: "Forneça um prompt ou histórico de chat" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context from chat messages
    const chatContext = effectiveMessages
      .map((m: any) => `${m.role}: ${m.content}`)
      .join("\n")
      .slice(0, 4000);

    // ─── 1. Strategist: generate creative brief from chat context ───
    const hasRefImages = Array.isArray(reference_images) && reference_images.length > 0;
    const refImageNote = hasRefImages
      ? `\n\nO USUÁRIO ANEXOU ${reference_images.length} IMAGEM(NS) DE REFERÊNCIA. Leve em conta que o visual da imagem gerada deve se inspirar ou incorporar elementos dessas referências.`
      : "";

    const userPromptSection = user_prompt
      ? `\n\nINSTRUÇÃO ESPECÍFICA DO USUÁRIO:\n"${user_prompt}"\n\nLEVE EM CONTA esta instrução como prioridade ao definir headline, body_copy, CTA, visual_direction e nano_banana_prompt.${refImageNote}`
      : refImageNote ? `\n${refImageNote}` : "";

    const strategistPrompt = `Você é um estrategista criativo de alto nível. Analise o contexto do chat abaixo e gere um briefing criativo para produzir um criativo de marketing visual.

CONTEXTO DO CHAT:
${chatContext}
${userPromptSection}

Com base nesse contexto, retorne APENAS um JSON válido (sem markdown, sem \`\`\`) com este schema:
{
  "creative_objective": "objetivo do criativo",
  "target_audience": "público-alvo específico identificado",
  "headline": "título principal impactante (max 8 palavras)",
  "body_copy": "texto de apoio (max 20 palavras)",
  "cta": "chamada para ação (max 4 palavras)",
  "visual_direction": "direção visual detalhada para a imagem de fundo",
  "tone_of_voice": "tom de voz do criativo",
  "nano_banana_prompt": "prompt detalhado em inglês para gerar a imagem de fundo sem texto",
  "editable_layers": [
    {"type": "headline", "content": "texto do headline", "style": "bold, large"},
    {"type": "subheadline", "content": "texto de apoio", "style": "medium"},
    {"type": "cta", "content": "texto do CTA", "style": "button"}
  ]
}

REGRAS:
- O headline, body_copy e CTA devem ser relevantes ao contexto do chat
- O nano_banana_prompt deve ser em INGLÊS e descrever APENAS o visual de fundo, SEM texto
- Inclua visual_direction coerente com o tema da conversa`;

    const strategistRes = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: strategistPrompt }],
      }),
    });

    if (!strategistRes.ok) {
      const status = strategistRes.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Strategist error: ${status}`);
    }

    const strategistData = await strategistRes.json();
    const rawContent = strategistData.choices?.[0]?.message?.content || "";
    const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let strategistOutput: any;
    try {
      strategistOutput = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse strategist output:", cleaned.slice(0, 500));
      strategistOutput = {
        headline: "Transforme Seus Resultados",
        body_copy: "Uma solução pensada para você",
        cta: "Saiba Mais",
        nano_banana_prompt: "Modern professional marketing background with gradient colors, abstract shapes, clean design for social media ad",
        visual_direction: "Modern, clean, professional",
        editable_layers: [
          { type: "headline", content: "Transforme Seus Resultados", style: "bold, large" },
          { type: "subheadline", content: "Uma solução pensada para você", style: "medium" },
          { type: "cta", content: "Saiba Mais", style: "button" },
        ],
      };
    }

    // ─── 2. Nano Banana Image Generation ───
    const imagePrompt = `${strategistOutput.nano_banana_prompt || "Professional marketing creative background"}

FORMAT: ${format}
VISUAL DIRECTION: ${strategistOutput.visual_direction || "Modern and professional"}

IMPORTANT RULES:
- Do NOT include any text, words, letters, numbers, or typography in the image
- Create ONLY the visual/graphic background
- Leave clear space for text overlays
- Make it modern, vibrant, and eye-catching`;

    const imageRes = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"],
      }),
    });

    let imageUrl = "";
    if (imageRes.ok) {
      const imageData = await imageRes.json();
      imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url || "";
    } else {
      console.error("Image generation failed:", imageRes.status);
    }

    // ─── 3. Build Editable HTML ───
    const layers = strategistOutput.editable_layers || [
      { type: "headline", content: strategistOutput.headline || "Título" },
      { type: "subheadline", content: strategistOutput.body_copy || "Subtítulo" },
      { type: "cta", content: strategistOutput.cta || "Saiba Mais" },
    ];

    const dimensions = format === "1080x1920" ? { w: 1080, h: 1920 }
      : format === "1200x628" ? { w: 1200, h: 628 }
      : { w: 1080, h: 1080 };

    const editableHtml = `<div class="creative-canvas" style="position:relative;width:100%;aspect-ratio:${dimensions.w}/${dimensions.h};overflow:hidden;border-radius:12px;background:#1a1a2e;">
  <img src="${imageUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" />
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.3) 0%,transparent 40%,rgba(0,0,0,0.5) 100%);"></div>
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;gap:0.75rem;">
    ${layers.map((layer: any) => {
      if (layer.type === "headline") {
        return `<div contenteditable="true" data-layer="headline" style="text-align:center;font-size:2rem;font-weight:800;color:#FFFFFF;text-shadow:0 2px 8px rgba(0,0,0,0.6);outline:none;cursor:text;padding:0.25rem 1rem;border-radius:4px;" onmouseover="this.style.outline='2px solid rgba(255,255,255,0.4)'" onmouseout="this.style.outline='none'">${layer.content}</div>`;
      }
      if (layer.type === "subheadline") {
        return `<div contenteditable="true" data-layer="subheadline" style="text-align:center;font-size:1rem;font-weight:500;color:#FFFFFF;text-shadow:0 1px 4px rgba(0,0,0,0.5);outline:none;cursor:text;padding:0.25rem 1rem;border-radius:4px;max-width:80%;" onmouseover="this.style.outline='2px solid rgba(255,255,255,0.4)'" onmouseout="this.style.outline='none'">${layer.content}</div>`;
      }
      if (layer.type === "cta") {
        return `<div style="margin-top:1rem;"><div contenteditable="true" data-layer="cta" style="display:inline-block;padding:0.75rem 2rem;border-radius:9999px;font-size:0.875rem;font-weight:700;background:hsl(220,80%,55%);color:#FFFFFF;box-shadow:0 4px 15px rgba(0,0,0,0.3);outline:none;cursor:text;" onmouseover="this.style.outline='2px solid rgba(255,255,255,0.4)'" onmouseout="this.style.outline='none'">${layer.content}</div></div>`;
      }
      return "";
    }).join("\n    ")}
  </div>
</div>`;

    return new Response(JSON.stringify({
      strategist_output: strategistOutput,
      image_url: imageUrl,
      editable_html: editableHtml,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
