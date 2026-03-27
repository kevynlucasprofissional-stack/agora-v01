import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_TEXT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_IMAGE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { analysis_id, conversation_id, format = "1080x1080", user_prompt } = await req.json();

    // ─── 1. Build context (with or without analysis) ───
    let creativeContext: any;

    if (analysis_id) {
      const [analysisRes, agentRes, chatRes] = await Promise.all([
        supabase
          .from("analysis_requests")
          .select("*")
          .eq("id", analysis_id)
          .single(),
        supabase
          .from("agent_responses")
          .select("agent_id, content_text, content")
          .eq("analysis_request_id", analysis_id)
          .eq("success", true)
          .limit(10),
        conversation_id
          ? supabase
              .from("chat_messages")
              .select("role, content")
              .eq("conversation_id", conversation_id)
              .order("created_at", { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [] }),
      ]);

      const campaign = analysisRes.data;
      if (!campaign) {
        return new Response(JSON.stringify({ error: "Análise não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const agentOutputs = (agentRes.data || []).map((a: any) => ({
        agent: a.agent_id,
        summary: a.content_text?.slice(0, 500) || JSON.stringify(a.content)?.slice(0, 500),
      }));

      const chatHistory = ((chatRes as any).data || []).reverse().map((m: any) => `${m.role}: ${m.content}`).join("\n").slice(0, 2000);

      creativeContext = {
        campaign: {
          title: campaign.title,
          raw_prompt: campaign.raw_prompt,
          industry: campaign.industry,
          primary_channel: campaign.primary_channel,
          target_audience: campaign.declared_target_audience,
          region: campaign.region,
        },
        analysis: {
          score_overall: campaign.score_overall,
          score_sociobehavioral: campaign.score_sociobehavioral,
          score_offer: campaign.score_offer,
          score_performance: campaign.score_performance,
          normalized_payload: campaign.normalized_payload,
        },
        agents: agentOutputs,
        chat_history: chatHistory,
        requested_format: format,
        user_prompt: user_prompt || null,
      };
    } else {
      // Standalone mode — no analysis, just user prompt
      creativeContext = {
        campaign: null,
        analysis: null,
        agents: [],
        chat_history: "",
        requested_format: format,
        user_prompt: user_prompt || "Create a professional marketing creative",
      };
    }

    // ─── 2. Gemini Strategist ───
    const userPromptSection = user_prompt
      ? `\n\nINSTRUÇÃO ESPECÍFICA DO USUÁRIO:\n"${user_prompt}"\n\nLEVE EM CONTA esta instrução como prioridade ao definir headline, body_copy, CTA, visual_direction e nano_banana_prompt. O criativo deve refletir o pedido do usuário.`
      : "";

    const contextSection = analysis_id
      ? `CONTEXTO DA CAMPANHA:\n${JSON.stringify(creativeContext, null, 2)}`
      : `O usuário quer criar um criativo de marketing com base apenas na descrição abaixo. Não há análise de campanha vinculada.\n\nDESCRIÇÃO DO USUÁRIO: "${user_prompt}"`;

    const strategistPrompt = `Você é um estrategista criativo de alto nível. Analise o contexto e gere um briefing criativo estruturado para produzir um criativo de marketing.

${contextSection}
${userPromptSection}

Com base nesse contexto, retorne APENAS um JSON válido (sem markdown, sem \`\`\`) com este schema:
{
  "creative_objective": "objetivo do criativo",
  "target_audience": "público-alvo específico identificado",
  "core_pain_or_desire": "dor ou desejo central do público",
  "main_offer_angle": "ângulo principal da oferta",
  "headline": "título principal impactante (max 8 palavras)",
  "body_copy": "texto de apoio (max 20 palavras)",
  "cta": "chamada para ação (max 4 palavras)",
  "visual_direction": "direção visual detalhada para a imagem de fundo",
  "tone_of_voice": "tom de voz do criativo",
  "mandatory_elements": ["elementos obrigatórios"],
  "forbidden_elements": ["elementos proibidos"],
  "compliance_warnings": ["avisos de compliance"],
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
- O visual deve ser coerente com o contexto fornecido
- Inclua compliance_warnings se houver restrições identificadas`;

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

    // ─── 3. Nano Banana Image Generation ───
    const imagePrompt = `${strategistOutput.nano_banana_prompt || "Professional marketing creative background"}

FORMAT: ${format}
VISUAL DIRECTION: ${strategistOutput.visual_direction || "Modern and professional"}

IMPORTANT RULES:
- Do NOT include any text, words, letters, numbers, or typography in the image
- Create ONLY the visual/graphic background
- Leave clear space for text overlays
- Make it modern, vibrant, and eye-catching`;

    const imageRes = await fetch(`${GEMINI_IMAGE_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: imagePrompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    });

    let imageUrl = "";
    if (imageRes.ok) {
      const imageData = await imageRes.json();
      const resParts = imageData.candidates?.[0]?.content?.parts || [];
      const imgPart = resParts.find((p: any) => p.inlineData);
      const rawImageUrl = imgPart
        ? `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`
        : "";

      // Upload base64 to storage if it's a data URI
      if (rawImageUrl && rawImageUrl.startsWith("data:")) {
        try {
          const base64Match = rawImageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
          if (base64Match) {
            const ext = base64Match[1] === "jpeg" ? "jpg" : base64Match[1];
            const base64Data = base64Match[2];
            const binaryStr = atob(base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

            const filePath = `${user.id}/creatives/${crypto.randomUUID()}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from("agora-files")
              .upload(filePath, bytes, { contentType: `image/${base64Match[1]}`, upsert: true });

            if (!uploadError) {
              const { data: signedData } = await supabase.storage
                .from("agora-files")
                .createSignedUrl(filePath, 60 * 60 * 24 * 30);
              imageUrl = signedData?.signedUrl || rawImageUrl;
            } else {
              console.error("Storage upload error:", uploadError);
              imageUrl = rawImageUrl;
            }
          }
        } catch (uploadErr) {
          console.error("Failed to upload image to storage:", uploadErr);
          imageUrl = rawImageUrl;
        }
      } else {
        imageUrl = rawImageUrl;
      }
    } else {
      console.error("Image generation failed:", imageRes.status);
    }

    // ─── 4. Build Editable HTML ───
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
      if (layer.type === "logo_placeholder") {
        return `<div data-layer="logo" style="position:absolute;bottom:1.5rem;right:1.5rem;width:60px;height:60px;border-radius:8px;border:2px dashed rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:rgba(255,255,255,0.5);">LOGO</div>`;
      }
      return "";
    }).join("\n    ")}
  </div>
</div>`;

    // ─── 5. Save creative job ───
    const { data: job, error: jobError } = await supabase
      .from("creative_jobs")
      .insert({
        user_id: user.id,
        analysis_request_id: analysis_id || null,
        conversation_id: conversation_id || null,
        prompt_context: creativeContext,
        strategist_output: strategistOutput,
        image_url: imageUrl,
        editable_html: editableHtml,
        format,
        status: "completed",
      })
      .select("id")
      .single();

    if (jobError) {
      console.error("Failed to save creative job:", jobError);
    }

    return new Response(JSON.stringify({
      strategist_output: strategistOutput,
      image_url: imageUrl,
      editable_html: editableHtml,
      creative_job_id: job?.id || null,
    }), {
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
