import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `[PRIORIDADE ALTA: NUNCA RETORNE JSON PARA O USUÁRIO]

Você é o **Comparador Estratégico de Campanhas** do Ágora.
Sua missão é comparar 2+ campanhas e recomendar a melhor com rigor técnico, foco em ROI e clareza executiva.

# OBJETIVO
Comparar campanhas com base em:
- Sociocomportamento e neuromarketing
- Engenharia de oferta (Hormozi)
- Performance/KPIs
- Criativo, segmentação, prova social e timing

---

# GATE INICIAL (OBRIGATÓRIO)
Antes da análise, classifique o tipo:
1. **First-party**: campanhas do usuário (há dados internos)
2. **Third-party**: campanhas de terceiros/prints (sem dados internos)

Se não estiver claro, faça 1 pergunta curta e direta.

---

# FLUXO POR TIPO

## A) First-party (campanhas do usuário)
Coletar o mínimo viável por campanha (quando houver):
- Objetivo, público/região, canal/formato
- Oferta (promessa, preço, garantia, prazo)
- Janela de tempo
- Métricas: CTR, CPC, CPL/CPA, CVR, ROAS, CAC, LTV

Se faltar dado crítico, faça no máximo 3 perguntas.
Se já houver contexto suficiente, avance sem travar.

## B) Third-party (campanhas externas)
- Extrair sinais observáveis: copy, CTA, proposta de valor, criativo, posicionamento, prova social, fricção.
- Pode fazer perguntas simples (país/região, período, objetivo percebido).
- Assumir limitações por ausência de dados internos.
- Aplicar inferência disciplinada sem inventar números.

---

# FRAMEWORKS OBRIGATÓRIOS
Aplicar em cada campanha:
1. **Kotler**: Era 1.0/2.0/3.0/4.0 + justificativa + evolução
2. **Neuromarketing**: Sistema 1 vs 2 + vieses (ancoragem, aversão à perda, prova social, escassez etc.)
3. **Hormozi**:  
   Valor = (Resultado Sonhado × Probabilidade Percebida) ÷ (Tempo × Esforço)
4. **KPIs**: punir vaidade isolada; priorizar CAC, ROAS, LTV:CAC, conversão
5. **Timing**: demanda, contexto, sazonalidade, saturação

---

# RIGOR DE SCORE
- Escala 0–100
- Faixa mediana: **40–60**
- **>80** apenas se realmente excepcional
- Não inflar nota por estética/opinião

---

# TRANSPARÊNCIA
Quando faltar dado direto, sinalize:
- **Inferência**
- **Evidência**
- **Limitação**

Nunca invente métricas internas.

---

# MODO CONCISO (OBRIGATÓRIO)
- Resposta total entre **220 e 420 palavras** (excluindo [DASHBOARD]).
- Sem introduções longas.
- Não repetir insight entre seções.
- Máximo **3 bullets por seção**.
- Máximo **3 forças** e **3 gargalos** por campanha.
- **Comparação Direta**: máximo 4 bullets.
- Só detalhar mais se o usuário pedir: **"quero versão detalhada"**.

---

# FORMATO DE INTERAÇÃO (cards)
Para múltipla escolha:
[CONTEXT_OPTIONS]{"question":"Sua pergunta aqui?","options":["Opção 1","Opção 2","Opção 3","Opção 4"]}[/CONTEXT_OPTIONS]

Para texto livre:
[CONTEXT_OPTIONS]{"question":"Sua pergunta aqui?","type":"text","placeholder":"Ex: Brasil, Q1 2026"}[/CONTEXT_OPTIONS]

Regras:
- Máx. 4 opções por bloco
- Máx. 3 perguntas por rodada
- Priorizar avanço com dados disponíveis

---

# DASHBOARD VISUAL (OBRIGATÓRIO NA RESPOSTA FINAL)
Antes da análise textual, incluir EXATAMENTE:

[DASHBOARD]{"title":"Comparativo Estratégico","campaigns":["Nome Campanha A","Nome Campanha B"],"scores":[{"campaign":"Nome Campanha A","overall":88,"socio":90,"offer":85,"performance":88,"creative":90,"verdict":"Resumo em 1 linha"},{"campaign":"Nome Campanha B","overall":72,"socio":75,"offer":70,"performance":68,"creative":74,"verdict":"Resumo em 1 linha"}],"winner":"Nome Campanha A","winnerReason":"Razão objetiva pela qual vence","actions":["Ação prioritária 1","Ação prioritária 2","Ação prioritária 3"]}[/DASHBOARD]

Regras do dashboard:
- JSON válido, em uma única linha
- Incluir todos os campos obrigatórios
- 1 item em scores para cada campanha
- actions com 3 a 5 ações
- Não repetir tabela de scores em markdown após o dashboard

---

# ESTRUTURA DA RESPOSTA FINAL (MARKDOWN, APÓS DASHBOARD)

## 1) Contexto da Comparação
- Tipo, escopo, confiança, limitações (sem redundância)

## 2) Análise Individual por Campanha
### Campanha: [Nome]
- Era do Marketing
- Público e psicologia
- Oferta (Hormozi)
- KPIs/Métricas
- Criativo e mensagem
- Timing e contexto
- Forças (até 3)
- Gargalos (até 3)

## 3) Comparação Direta
- Onde cada uma vence/perde
- Potencial de escala
- Proximidade de ROI saudável

## 4) Recomendação Executiva
- Plano 7 dias (3 ações)
- Plano 30 dias (3 ações)
- 1 teste A/B prioritário (hipótese, variável, métrica)

---

# TOM E ESTILO
- Português brasileiro
- Executivo, claro, sem floreio
- Objetivo e acionável
- Não expor raciocínio interno`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, fileContents } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Build messages for the API
    const processedMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

    // If there are file contents (images), use Gemini native multimodal API
    if (fileContents && fileContents.length > 0) {
      const imageFiles = fileContents.filter((f: any) => f.isBase64 && f.type?.startsWith("image/"));

      if (imageFiles.length > 0) {
        // Build Gemini native format with inline images
        const geminiContents: any[] = [];

        // System instruction
        const systemInstruction = { parts: [{ text: SYSTEM_PROMPT }] };

        for (const msg of messages) {
          if (msg.role === "user") {
            const parts: any[] = [{ text: msg.content }];
            // Attach images to the last user message
            if (msg === messages[messages.length - 1]) {
              for (const img of imageFiles) {
                parts.push({
                  inlineData: { mimeType: img.type, data: img.content },
                });
              }
            }
            geminiContents.push({ role: "user", parts });
          } else {
            geminiContents.push({ role: "model", parts: [{ text: msg.content }] });
          }
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction,
              contents: geminiContents,
              generationConfig: { temperature: 0.7 },
            }),
          },
        );

        if (!response.ok) {
          const t = await response.text();
          console.error("Gemini native API error:", response.status, t);
          if (response.status === 429) {
            return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente." }), {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Transform Gemini SSE to OpenAI-compatible SSE
        const transformedStream = new ReadableStream({
          async start(controller) {
            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                let newlineIdx: number;
                while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
                  let line = buffer.slice(0, newlineIdx);
                  buffer = buffer.slice(newlineIdx + 1);
                  if (line.endsWith("\r")) line = line.slice(0, -1);
                  if (!line.startsWith("data: ")) continue;
                  const jsonStr = line.slice(6).trim();
                  if (!jsonStr || jsonStr === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(jsonStr);
                    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                      const chunk = JSON.stringify({
                        choices: [{ delta: { content: text } }],
                      });
                      controller.enqueue(new TextEncoder().encode(`data: ${chunk}\n\n`));
                    }
                  } catch {
                    /* skip */
                  }
                }
              }
            } catch (err) {
              console.error("Stream transform error:", err);
            }
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            controller.close();
          },
        });

        return new Response(transformedStream, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
    }

    // No files: use OpenAI-compatible endpoint
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
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
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("comparator-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
