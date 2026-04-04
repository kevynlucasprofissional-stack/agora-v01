import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, withErrorHandler } from "../_shared/errors.ts";
import { callGeminiText, parseAIJson } from "../_shared/gemini.ts";
import { generateImageWithRetry, uploadImageToStorage, buildEditableHtml } from "../_shared/image-gen.ts";
import { createAdminClient, getUserFromAuth } from "../_shared/supabase.ts";

const STRATEGIST_FALLBACK = {
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

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  return withErrorHandler("generate-image", async () => {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return errorResponse(500, "GEMINI_API_KEY is not configured", { category: "integration" });
    }

    const supabase = createAdminClient();

    // Auth: try to get user from JWT (optional for this function)
    const authHeader = req.headers.get("authorization") || "";
    const user = await getUserFromAuth(authHeader);

    const { messages = [], user_prompt, format = "1080x1080", reference_images = [] } = await req.json();

    // Build effective messages
    const effectiveMessages = [...(Array.isArray(messages) ? messages : [])];
    if (user_prompt?.trim()) {
      effectiveMessages.push({ role: "user", content: user_prompt.trim() });
    }

    if (effectiveMessages.length === 0) {
      return errorResponse(400, "Forneça um prompt ou histórico de chat", { category: "validation" });
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

    const strategistOutput = parseAIJson(
      await callGeminiText(strategistPrompt, GEMINI_API_KEY, { model: "gemini-2.5-flash" }),
      STRATEGIST_FALLBACK,
    );

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
    if (imageResult.imageData && user) {
      imageUrl = await uploadImageToStorage(supabase, user.id, imageResult.imageData);
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

    return jsonResponse({
      strategist_output: strategistOutput,
      image_url: imageUrl,
      image_generation_failed,
      editable_html: editableHtml,
    });
  })(req);
});
