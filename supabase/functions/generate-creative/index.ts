import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { corsHeaders } from "../_shared/cors.ts";
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

  return withErrorHandler("generate-creative", async () => {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return errorResponse(500, "GEMINI_API_KEY is not configured", { category: "integration" });
    }

    const authHeader = req.headers.get("authorization") || "";
    const user = await getUserFromAuth(authHeader);
    if (!user) {
      return errorResponse(401, "Não autorizado", { category: "auth" });
    }

    const supabase = createAdminClient();
    const { analysis_id, conversation_id, format = "1080x1080", user_prompt } = await req.json();

    // ─── 1. Build context ───
    let creativeContext: any;

    if (analysis_id) {
      const [analysisRes, agentRes, chatRes] = await Promise.all([
        supabase.from("analysis_requests").select("*").eq("id", analysis_id).single(),
        supabase.from("agent_responses").select("agent_id, content_text, content")
          .eq("analysis_request_id", analysis_id).eq("success", true).limit(10),
        conversation_id
          ? supabase.from("chat_messages").select("role, content")
              .eq("conversation_id", conversation_id).order("created_at", { ascending: false }).limit(20)
          : Promise.resolve({ data: [] }),
      ]);

      const campaign = analysisRes.data;
      if (!campaign) {
        return errorResponse(404, "Análise não encontrada", { category: "validation" });
      }

      const agentOutputs = (agentRes.data || []).map((a: any) => ({
        agent: a.agent_id,
        summary: a.content_text?.slice(0, 500) || JSON.stringify(a.content)?.slice(0, 500),
      }));
      const chatHistory = ((chatRes as any).data || []).reverse().map((m: any) => `${m.role}: ${m.content}`).join("\n").slice(0, 2000);

      creativeContext = {
        campaign: {
          title: campaign.title, raw_prompt: campaign.raw_prompt, industry: campaign.industry,
          primary_channel: campaign.primary_channel, target_audience: campaign.declared_target_audience,
          region: campaign.region,
        },
        analysis: {
          score_overall: campaign.score_overall, score_sociobehavioral: campaign.score_sociobehavioral,
          score_offer: campaign.score_offer, score_performance: campaign.score_performance,
          normalized_payload: campaign.normalized_payload,
        },
        agents: agentOutputs,
        chat_history: chatHistory,
        requested_format: format,
        user_prompt: user_prompt || null,
      };
    } else {
      creativeContext = {
        campaign: null, analysis: null, agents: [], chat_history: "",
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

    let strategistOutput = STRATEGIST_FALLBACK;
    try {
      strategistOutput = parseAIJson(
        await callGeminiText(strategistPrompt, GEMINI_API_KEY, { model: "gemini-2.5-flash" }),
        STRATEGIST_FALLBACK,
      );
    } catch (error) {
      console.warn("Strategist generation failed, using fallback:", error);
    }

    // ─── 3. Image Generation (shared helper) ───
    const imagePrompt = `${strategistOutput.nano_banana_prompt || "Professional marketing creative background"}

FORMAT: ${format}
VISUAL DIRECTION: ${strategistOutput.visual_direction || "Modern and professional"}

IMPORTANT RULES:
- Do NOT include any text, words, letters, numbers, or typography in the image
- Create ONLY the visual/graphic background
- Leave clear space for text overlays
- Make it modern, vibrant, and eye-catching`;

    const imageResult = await generateImageWithRetry([{ text: imagePrompt }], GEMINI_API_KEY);
    const image_generation_failed = imageResult.failed;

    let imageUrl = "";
    if (imageResult.imageData) {
      imageUrl = await uploadImageToStorage(supabase, user.id, imageResult.imageData);
    }

    // ─── 4. Build Editable HTML (shared helper) ───
    const layers = strategistOutput.editable_layers || [
      { type: "headline", content: strategistOutput.headline || "Título" },
      { type: "subheadline", content: strategistOutput.body_copy || "Subtítulo" },
      { type: "cta", content: strategistOutput.cta || "Saiba Mais" },
    ];
    const editableHtml = buildEditableHtml(layers, format, imageUrl);

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

    return jsonResponse({
      strategist_output: strategistOutput,
      image_url: imageUrl,
      image_generation_failed,
      editable_html: editableHtml,
      creative_job_id: job?.id || null,
    });
  })(req);
});
