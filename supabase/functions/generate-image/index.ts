import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { callGeminiText } from "../_shared/gemini.ts";
import { generateImageWithRetry, uploadImageToStorage, buildEditableHtml } from "../_shared/image-gen.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth: try to get user from JWT (optional)
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader) {
      try {
        const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await anonClient.auth.getUser(token);
        userId = user?.id || null;
      } catch { /* Auth is optional */ }
    }

    const { messages = [], user_prompt, format = "1080x1080", reference_images = [] } = await req.json();

    // Build effective messages
    const effectiveMessages = [...(Array.isArray(messages) ? messages : [])];
    if (user_prompt?.trim()) {
      effectiveMessages.push({ role: "user", content: user_prompt.trim() });
    }

    if (effectiveMessages.length === 0) {
      return new Response(JSON.stringify({ error: "Forneça um prompt ou histórico de chat" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatContext = effectiveMessages.map((m: any) => `${m.role}: ${m.content}`).join("\n").slice(0, 4000);

    // ─── 1. Strategist ───
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
- O headline, body_copy, CTA e TODOS os textos em editable_layers devem ser escritos NO MESMO IDIOMA da instrução do usuário. Se foi escrita em português, TODOS os textos devem ser em português. NUNCA traduza para inglês.
- O nano_banana_prompt deve ser em INGLÊS e descrever APENAS o visual de fundo, SEM texto
- Inclua visual_direction coerente com o tema da conversa`;

    let strategistOutput: any;
    try {
      const rawContent = await callGeminiText(strategistPrompt, GEMINI_API_KEY, { model: "gemini-2.5-flash" });
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      strategistOutput = JSON.parse(cleaned);
    } catch {
      console.error("Strategist parse failed, using fallback");
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

    // ─── 2. Image Generation (shared helper) ───
    const imagePrompt = `${strategistOutput.nano_banana_prompt || "Professional marketing creative background"}

FORMAT: ${format}
VISUAL DIRECTION: ${strategistOutput.visual_direction || "Modern and professional"}

IMPORTANT RULES:
- Do NOT include any text, words, letters, numbers, or typography in the image
- Create ONLY the visual/graphic background
- Leave clear space for text overlays
- Make it modern, vibrant, and eye-catching`;

    const imageParts: any[] = [{ text: imagePrompt }];
    if (hasRefImages) {
      for (const img of reference_images) {
        const base64Match = img.content.match(/^data:image\/(\w+);base64,(.+)$/);
        if (base64Match) {
          imageParts.push({ inlineData: { mimeType: `image/${base64Match[1]}`, data: base64Match[2] } });
        } else {
          imageParts.push({ inlineData: { mimeType: img.type || "image/png", data: img.content } });
        }
      }
    }

    const imageResult = await generateImageWithRetry(imageParts, GEMINI_API_KEY);
    const image_generation_failed = imageResult.failed;

    let imageUrl = "";
    if (imageResult.imageData && userId) {
      imageUrl = await uploadImageToStorage(supabase, userId, imageResult.imageData);
    } else if (imageResult.imageData) {
      const imgPart = imageResult.imageData;
      imageUrl = `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
    }

    // ─── 3. Build Editable HTML (shared helper) ───
    const layers = strategistOutput.editable_layers || [
      { type: "headline", content: strategistOutput.headline || "Título" },
      { type: "subheadline", content: strategistOutput.body_copy || "Subtítulo" },
      { type: "cta", content: strategistOutput.cta || "Saiba Mais" },
    ];
    const editableHtml = buildEditableHtml(layers, format, imageUrl);

    return new Response(JSON.stringify({
      strategist_output: strategistOutput,
      image_url: imageUrl,
      image_generation_failed,
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
