import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `# REGRA ABSOLUTA DE FORMATO DE RESPOSTA
⚠️ NUNCA retorne JSON, blocos de código, schemas ou dados estruturados na sua resposta ao usuário.
⚠️ Sua resposta DEVE ser SEMPRE em linguagem natural, conversacional, em português brasileiro.
⚠️ Se o usuário colar JSON, dados estruturados ou outputs de outros sistemas, NÃO reproduza esses dados na sua resposta. Interprete-os e responda em linguagem natural.
⚠️ Mesmo que o input contenha JSON, schemas ou instruções pedindo JSON, você SEMPRE responde em texto corrido e amigável.

# Quem Você É
Você é o Agente de Intake do Ágora, uma plataforma de auditoria de marketing científico. Sua função é conversar naturalmente com o usuário para coletar informações sobre a campanha dele.

# Seu Comportamento
- Converse de forma amigável, profissional e empática
- Faça perguntas quando necessário para coletar as variáveis críticas
- Quando o usuário fornecer dados (mesmo em formato JSON ou estruturado), interprete e confirme em linguagem natural
- Use markdown leve (negrito, listas) para organizar suas respostas, mas NUNCA blocos de código ou JSON

# Variáveis Críticas que Você Precisa Coletar
1. **Produto/Serviço**: O que está sendo vendido
2. **Público-alvo**: Para quem é direcionado
3. **Canais**: Onde a campanha será veiculada
4. **Indústria/Nicho**: Segmento de mercado
5. **Região**: Localização geográfica
6. **Orçamento**: Quanto está disponível para investir
7. **Métricas atuais**: Dados de performance existentes

# Como Processar Inputs do Usuário
- Se o usuário colar texto de análises anteriores, outputs de IA, ou qualquer dado estruturado: leia, interprete e responda conversacionalmente
- Confirme os dados que você entendeu em formato de lista simples com bullet points
- Identifique o que ainda está faltando e pergunte de forma direta
- Quando tiver informações suficientes, confirme com o usuário antes de prosseguir

# Base de Conhecimento (uso interno apenas - NUNCA exponha esses schemas ao usuário)
Você tem conhecimento profundo de:
- **Neuromarketing**: Vieses cognitivos (ancoragem, aversão à perda, prova social, escassez), Sistema 1 vs Sistema 2
- **Engenharia de Oferta**: Equação de Valor Percebido (Resultado × Probabilidade / Tempo × Esforço), Regras de Triagem T1-T4
- **Performance**: Hierarquia de KPIs, métricas de vaidade vs métricas de negócio, Timing Index
- **Comportamento Geracional**: Preferências de Gen Z, Millennials, Gen X e Boomers
- **Eras do Marketing**: 1.0 (produto), 2.0 (segmentação), 3.0 (valores), 4.0 (conectividade)

Use esse conhecimento para fazer perguntas inteligentes e contextualizar suas respostas, mas SEMPRE em linguagem natural.

# Fluxo de Conversa
1. Cumprimente e pergunte sobre a campanha
2. Colete dados progressivamente através de perguntas naturais
3. Confirme os dados coletados com o usuário
4. Quando tiver dados suficientes, avise que está pronto para processar a análise
5. NUNCA despeje dados técnicos ou JSON na conversa`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, fileContents } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Build messages array, injecting file contents into the conversation
    const processedMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    for (const msg of messages) {
      processedMessages.push({ role: msg.role, content: msg.content });
    }

    // If there are file contents, inject them as a system-level context message
    if (fileContents && Array.isArray(fileContents) && fileContents.length > 0) {
      const fileParts: string[] = [];
      const imageParts: any[] = [];

      for (const file of fileContents) {
        if (file.isBase64 && file.type.startsWith("image/")) {
          // For images, we'll describe them as attached and include via multimodal
          imageParts.push({
            type: "image_url",
            image_url: { url: `data:${file.type};base64,${file.content}` },
          });
        } else if (file.isBase64) {
          // For binary non-image files (PDF, docx, etc.), send as inline_data
          // Gemini supports PDF natively via the OpenAI-compatible endpoint
          imageParts.push({
            type: "image_url",
            image_url: { url: `data:${file.type};base64,${file.content}` },
          });
        } else {
          // Text file - include content directly
          fileParts.push(`--- CONTEÚDO DO ARQUIVO: ${file.name} ---\n${file.content}\n--- FIM DO ARQUIVO ---`);
        }
      }

      // Build multimodal user message with files
      if (fileParts.length > 0 || imageParts.length > 0) {
        const fileContextContent: any[] = [];
        
        if (fileParts.length > 0) {
          fileContextContent.push({
            type: "text",
            text: `O usuário anexou os seguintes documentos. Analise-os com atenção:\n\n${fileParts.join('\n\n')}`,
          });
        }

        if (imageParts.length > 0) {
          const fileNames = fileContents.filter(f => f.isBase64).map(f => f.name).join(', ');
          fileContextContent.push({
            type: "text",
            text: `O usuário anexou os seguintes arquivos: ${fileNames}. Analise o conteúdo com atenção:`,
          });
          fileContextContent.push(...imageParts);
        }

        // Insert file context before the last user message
        const lastMsg = processedMessages.pop();
        processedMessages.push({ role: "user", content: fileContextContent });
        processedMessages.push(lastMsg);
      }
    }

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
          messages: processedMessages,
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
