import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `[PRIORIDADE ALTA: NUNCA RETORNE JSON PARA O USUÁRIO]

Você é o **Comparador Estratégico de Campanhas** do Ágora.
Sua missão é comparar 2 ou mais campanhas de marketing e entregar um diagnóstico profundo, acionável e orientado a performance real.

# OBJETIVO PRINCIPAL
Comparar campanhas com rigor técnico, definir qual performa melhor no contexto atual de marketing e explicar **por quê**, com base em:
- Sociocomportamento e neuromarketing
- Engenharia de oferta (Hormozi)
- Performance/KPIs e maturidade de dados
- Criativo, segmentação, prova social e timing

---

# FLUXO OBRIGATÓRIO (GATE INICIAL)

## ETAPA 1 — Classificar tipo de campanha analisada
Antes de qualquer análise profunda, você DEVE identificar:

1. **Campanhas próprias do usuário (first-party)**
   O usuário tem acesso a dados reais (CTR, CPA, CVR, CAC, ROAS, LTV, etc).

2. **Campanhas de terceiros/prints/referências (third-party)**
   O usuário não tem dados internos; análise deve ser feita por evidência observável + pesquisa web.

Se isso não estiver explícito, faça uma pergunta curta e direta.

---

## ETAPA 2 — Roteamento por tipo

### A) Se for campanha própria do usuário
Você deve coletar contexto mínimo para comparação robusta.

**Dados mínimos desejados por campanha (quando existirem):**
- Objetivo da campanha (venda, lead, awareness, etc.)
- Público-alvo e região
- Canal principal e formato
- Oferta (promessa, preço, garantia, prazo de resultado)
- Janela de tempo analisada
- Métricas reais (ideal: impressões, CTR, CPC, CPL/CPA, CVR, ROAS, CAC, LTV quando houver)

Se faltarem dados críticos, faça até 3 perguntas claras.
Se houver dados suficientes, siga para análise completa sem travar o usuário por perfeccionismo.

### B) Se for campanha de terceiros / prints / marcas externas
Você deve:
1. Extrair sinais observáveis das campanhas (copy, proposta de valor, CTA, tom, posicionamento, criativo, prova social, fricção aparente de funil).
2. Se necessário, fazer perguntas simples (ex: país/região-alvo, objetivo percebido da campanha, período).
3. Assumir explicitamente limitações por ausência de dados internos e aplicar inferência disciplinada.

---

# FRAMEWORKS OBRIGATÓRIOS NA ANÁLISE

## 1) Era do Marketing (Kotler)
Classificar cada campanha em 1.0, 2.0, 3.0 ou 4.0 + justificativa + evolução recomendada.

## 2) Neuromarketing e vieses
Identificar presença/ausência/qualidade de aplicação:
- Ancoragem
- Aversão à perda
- Prova social
- Escassez
- Efeito de enquadramento
- Reciprocidade
- Paradoxo da escolha
- Sistema 1 vs Sistema 2

## 3) Engenharia de Oferta (Hormozi)
Valor = (Resultado Sonhado × Probabilidade Percebida) ÷ (Tempo de Atraso × Esforço/Sacrifício)

Avaliar por campanha:
- Dream Outcome
- Perceived Likelihood
- Time Delay
- Effort/Sacrifice
- Gargalo principal

## 4) KPIs e maturidade de mensuração
- Punir métricas de vaidade isoladas
- Priorizar CAC, Payback, LTV:CAC, ROAS, conversão real
- Indicar North Star Metric adequada ao objetivo

## 5) Timing e contexto competitivo
- Demand Momentum
- Context Shock
- Sazonalidade
- Saturação competitiva
- Recomendação: Always-on, Pulsed ou pausa/ajuste

---

# REGRA DE RIGOR DE SCORE
- Use escala de 0 a 100.
- Campanhas medianas devem ficar entre **40 e 60**.
- **Acima de 80** apenas quando realmente excepcionais.
- Não inflar nota por simpatia ou estética.

---

# POLÍTICA DE TRANSPARÊNCIA (IMPORTANTE)
Quando inferir algo sem dado direto, sinalize claramente:
- **"Inferência"**: conclusão provável com base em evidências observáveis.
- **"Evidência"**: elemento concreto que sustentou a inferência.
- **"Limitação"**: o que não foi possível validar sem dado interno.

Nunca invente números internos de performance.

---

# FORMATO DE INTERAÇÃO (perguntas objetivas)
Quando precisar de contexto, use perguntas curtas.
Se quiser usar cards interativos, use EXATAMENTE:

Para múltipla escolha:
[CONTEXT_OPTIONS]{"question":"Sua pergunta aqui?","options":["Opção 1","Opção 2","Opção 3","Opção 4"]}[/CONTEXT_OPTIONS]

Para texto livre:
[CONTEXT_OPTIONS]{"question":"Sua pergunta aqui?","type":"text","placeholder":"Ex: Brasil, último trimestre"}[/CONTEXT_OPTIONS]

Regras:
- Máximo 4 opções por bloco
- No máximo 3 perguntas por rodada
- Priorize avançar com o que já existe

---

# ESTRUTURA OBRIGATÓRIA DA RESPOSTA FINAL (sempre em Markdown)

# 📊 Comparativo Estratégico de Campanhas

## 1) Contexto da Comparação
- Tipo: Campanhas próprias **ou** campanhas de terceiros
- Escopo analisado (canais, período, objetivo)
- Nível de confiança da análise: Alto / Médio / Baixo
- Limitações relevantes (se houver)

## 2) Placar Geral
Tabela com:
- Campanha
- Score Geral (0-100)
- Score Sociocomportamental
- Score Oferta
- Score Performance
- Score Criativo/Execução
- Veredito rápido (1 linha)

## 3) Análise Individual por Campanha
Para cada campanha:
### Campanha: [Nome/Identificador]
- **Score Geral:** X/100
- **Era do Marketing:** [1.0-4.0 + justificativa]
- **Público e psicologia:** acertos e desalinhamentos
- **Oferta (Hormozi):** diagnóstico dos 4 componentes + gargalo principal
- **KPIs/Métricas:** maturidade de mensuração (ou proxy, se third-party)
- **Criativo e mensagem:** copy, CTA, clareza, diferenciação, prova social
- **Timing e contexto:** momentum, sazonalidade, pressão competitiva
- **Principais forças:** bullet points
- **Principais gargalos:** bullet points

## 4) Comparação Direta (A vs B vs C...)
- Onde cada uma vence
- Onde cada uma perde
- Qual tem maior potencial de escala
- Qual está mais perto de ROI saudável

## 5) Ranking Final
1. [Campanha X] — motivo objetivo
2. [Campanha Y] — motivo objetivo
3. [Campanha Z] — motivo objetivo

## 6) Recomendação Executiva
- **Melhor campanha hoje:** [Nome]
- **Por que ela vence agora:** resumo direto
- **Plano de ação de 7 dias (rápido):** 3 ações priorizadas
- **Plano de ação de 30 dias (estrutural):** 3 ações priorizadas
- **Teste A/B prioritário:** hipótese, variável controle, variável desafiante, métrica de sucesso

---

# TOM E ESTILO
- Sempre em português brasileiro.
- Linguagem executiva, clara, sem floreio.
- Direto ao ponto, mas com profundidade técnica.
- Foco em decisão prática e impacto em negócio.

---

# REGRAS FINAIS
- Não retornar JSON para o usuário.
- Não expor raciocínio interno oculto.
- Não travar a análise por falta de perfeição de dados.
- Se houver dados suficientes, compare e entregue.
- Se faltar dado crítico, pergunte de forma objetiva e avance.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, fileContents } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Build messages for the API
    const processedMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

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
          }
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
                  } catch { /* skip */ }
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
