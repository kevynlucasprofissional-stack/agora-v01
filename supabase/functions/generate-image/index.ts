import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_TEXT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_IMAGE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent";
const GEMINI_FALLBACK_IMAGE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-image-generation:generateContent";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateImageWithRetry(
  parts: any[],
  apiKey: string,
  maxRetries = 2
): Promise<{ imageData: any | null; failed: boolean }> {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  });
  const headers = { "Content-Type": "application/json" };

  // Try primary model with retries
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Image generation attempt ${attempt + 1}/${maxRetries + 1} (primary model)`);
      const res = await fetch(`${GEMINI_IMAGE_URL}?key=${apiKey}`, {
        method: "POST",
        headers,
        body,
      });

      if (res.ok) {
        const data = await res.json();
        const resParts = data.candidates?.[0]?.content?.parts || [];
        const imgPart = resParts.find((p: any) => p.inlineData);
        if (imgPart) {
          console.log("Image generated successfully (primary model)");
          return { imageData: imgPart, failed: false };
        }
        console.warn("Primary model returned ok but no image part");
      } else {
        const statusCode = res.status;
        const errorBody = await res.text();
        console.error(`Primary model attempt ${attempt + 1} failed: ${statusCode} - ${errorBody.slice(0, 300)}`);
        if (statusCode === 429 && attempt < maxRetries) {
          const waitMs = Math.pow(2, attempt) * 1500;
          console.log(`Rate limited, waiting ${waitMs}ms before retry...`);
          await sleep(waitMs);
          continue;
        }
      }
    } catch (err) {
      console.error(`Primary model attempt ${attempt + 1} exception:`, err);
    }
    if (attempt < maxRetries) {
      await sleep(1000);
    }
  }

  // Fallback model (text-only prompt, no reference images for compatibility)
  try {
    console.log("Trying fallback model (gemini-2.5-flash-preview-image-generation)...");
    const textPart = parts.find((p: any) => p.text);
    const fallbackBody = JSON.stringify({
      contents: [{ parts: textPart ? [textPart] : parts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    });
    const res = await fetch(`${GEMINI_FALLBACK_IMAGE_URL}?key=${apiKey}`, {
      method: "POST",
      headers,
      body: fallbackBody,
    });

    if (res.ok) {
      const data = await res.json();
      const resParts = data.candidates?.[0]?.content?.parts || [];
      const imgPart = resParts.find((p: any) => p.inlineData);
      if (imgPart) {
        console.log("Image generated successfully (fallback model)");
        return { imageData: imgPart, failed: false };
      }
      console.warn("Fallback model returned ok but no image part");
    } else {
      const errorBody = await res.text();
      console.error(`Fallback model failed: ${res.status} - ${errorBody.slice(0, 300)}`);
    }
  } catch (err) {
    console.error("Fallback model exception:", err);
  }

  console.error("All image generation attempts failed");
  return { imageData: null, failed: true };
}

async function uploadImageToStorage(
  supabase: any,
  userId: string,
  imgPart: any
): Promise<string> {
  const rawImageUrl = `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
  try {
    const base64Match = rawImageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) return rawImageUrl;

    const ext = base64Match[1] === "jpeg" ? "jpg" : base64Match[1];
    const base64Data = base64Match[2];
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const filePath = `${userId}/creatives/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("agora-files")
      .upload(filePath, bytes, { contentType: `image/${base64Match[1]}`, upsert: true });

    if (!uploadError) {
      const { data: signedData } = await supabase.storage
        .from("agora-files")
        .createSignedUrl(filePath, 60 * 60 * 24 * 30);
      return signedData?.signedUrl || rawImageUrl;
    } else {
      console.error("Storage upload error:", uploadError);
      return rawImageUrl;
    }
  } catch (uploadErr) {
    console.error("Failed to upload image to storage:", uploadErr);
    return rawImageUrl;
  }
}

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

    // Auth: try to get user from JWT (optional - allows creative_job creation)
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader) {
      try {
        const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await anonClient.auth.getUser(token);
        userId = user?.id || null;
      } catch {
        // Auth is optional for this function
      }
    }

    const { messages = [], user_prompt, format = "1080x1080", reference_images = [] } = await req.json();

    // Build effective messages
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

    const chatContext = effectiveMessages
      .map((m: any) => `${m.role}: ${m.content}`)
      .join("\n")
      .slice(0, 4000);

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

    const strategistRes = await fetch(GEMINI_TEXT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
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

    // ─── 2. Image Generation with retry + fallback ───
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
      // No user auth — return base64 as fallback
      const imgPart = imageResult.imageData;
      imageUrl = `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
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

    const bgStyle = imageUrl
      ? `background:#1a1a2e;`
      : `background:linear-gradient(135deg, #1a1a2e 0%, #2d1b69 50%, #1a1a2e 100%);`;

    const imgTag = imageUrl
      ? `<img src="${imageUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" />`
      : `<!-- Image generation failed - gradient fallback -->`;

    const editableHtml = `<div class="creative-canvas" style="position:relative;width:100%;aspect-ratio:${dimensions.w}/${dimensions.h};overflow:hidden;border-radius:12px;${bgStyle}">
  ${imgTag}
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
