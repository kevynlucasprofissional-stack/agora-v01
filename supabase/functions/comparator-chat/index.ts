import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `[PRIORIDADE ALTA: NUNCA RETORNE JSON PARA O USUÁRIO]

Você é o **Comparador de Campanhas** do Ágora.

Compare campanhas com rigor técnico, foco em ROI e recomendação prática.

## 1) GATE INICIAL

Classifique primeiro:

- **First-party**: campanhas do usuário (com dados)
- **Third-party**: campanhas externas/prints (sem dados internos)

Se não estiver claro, faça 1 pergunta objetiva.

---

## 2) FLUXO

### First-party

Coletar (quando houver): objetivo, público/região, canal, oferta, período, métricas (CTR/CPC/CPA/CVR/ROAS/CAC/LTV).
Se faltar dado crítico: até 3 perguntas.
Se houver contexto suficiente: avançar.

### Third-party

Analisar sinais observáveis (copy, CTA, oferta, criativo, posicionamento, prova social, fricção).
Declarar limitações e usar inferência disciplinada.
Nunca inventar métricas internas.

---

## 3) FRAMEWORKS OBRIGATÓRIOS

Aplicar por campanha:

1. **Era do Marketing (Kotler)**
2. **Neuromarketing** (Sistema 1/2 + vieses relevantes)
3. **Hormozi**: (Resultado × Probabilidade) ÷ (Tempo × Esforço)
4. **KPIs**: punir vaidade, priorizar CAC/ROAS/LTV:CAC/conversão
5. **Timing**: demanda, sazonalidade, contexto e saturação

---

## 4) SCORE

- 0–100
- Mediana: 40–60
- >80 apenas excepcional
- Sem inflar nota

---

## 5) MODO CONCISO

- **1–2 campanhas**: 180–320 palavras (fora dashboard)
- **3+ campanhas**: 240–420 palavras (fora dashboard)
- Sem redundância
- Só expandir se usuário pedir: **"quero versão detalhada"**

Para **3+ campanhas**, use 4 linhas por campanha:

1) Score + Era
2) Principal acerto
3) Principal gargalo
4) Impacto em ROI

---

## 6) FORMATO DE INTERAÇÃO (cards)
Para múltipla escolha:
[CONTEXT_OPTIONS]{"question":"Sua pergunta aqui?","options":["Opção 1","Opção 2","Opção 3","Opção 4"]}[/CONTEXT_OPTIONS]

Para texto livre:
[CONTEXT_OPTIONS]{"question":"Sua pergunta aqui?","type":"text","placeholder":"Ex: Brasil, Q1 2026"}[/CONTEXT_OPTIONS]

Regras:
- Máx. 4 opções por bloco
- Máx. 3 perguntas por rodada
- Priorizar avanço com dados disponíveis

---

## 7) DASHBOARD (OBRIGATÓRIO)

Sempre inserir antes da análise textual:

[DASHBOARD]{"title":"Comparativo Estratégico","campaigns":["Nome Campanha A","Nome Campanha B"],"scores":[{"campaign":"Nome Campanha A","overall":88,"socio":90,"offer":85,"performance":88,"creative":90,"verdict":"Resumo em 1 linha"},{"campaign":"Nome Campanha B","overall":72,"socio":75,"offer":70,"performance":68,"creative":74,"verdict":"Resumo em 1 linha"}],"winner":"Nome Campanha A","winnerReason":"Razão objetiva","actions":["Ação 1","Ação 2","Ação 3"]}[/DASHBOARD]

Regras:

- JSON válido em linha única
- 1 score por campanha
- actions com 3 a 5 itens
- Não repetir tabela de scores em markdown

---

## 8) ESTRUTURA FINAL (MARKDOWN)

## 1) Contexto

Tipo, escopo, confiança, limitações

## 2) Análise por Campanha

- 1–2 campanhas: análise curta por bloco
- 3+ campanhas: formato de 4 linhas por campanha

## 3) Comparação Direta

Máx. 4 bullets com diferenças decisivas

## 4) Recomendação Executiva (SOMENTE para campanhas first-party)

- Plano 7 dias (3 ações)
- Plano 30 dias (3 ações)
- 1 teste A/B (hipótese, variável, métrica)

**Se TODAS as campanhas forem third-party, OMITIR esta seção inteiramente.** Apenas ofereça observações táticas dentro da Comparação Direta.

---

## 9) TOM

Português brasileiro, executivo, direto, sem floreio.
Não expor raciocínio interno.`;

/** Detect if conversation mentions 3+ campaigns to pick a lighter model */
function detectManyCampaigns(messages: { role: string; content: string }[]): boolean {
  const fullText = messages.map((m) => m.content).join(" ").toLowerCase();
  // Heuristics: mentions of "campanha 3/4/5", numbered lists, or explicit "3 campanhas"
  const patterns = [
    /\b[3-9]\+?\s*campanhas?\b/,
    /campanha\s*[3-9]/,
    /terceira\s*campanha/,
    /campanha\s*c\b/i,
    // Count distinct "campanha" mentions with different names
  ];
  if (patterns.some((p) => p.test(fullText))) return true;

  // Count how many distinct "Campanha X" or "campanha:" blocks appear
  const matches = fullText.match(/campanha\s*[a-z0-9"':]/gi);
  if (matches && matches.length >= 3) return true;

  return false;
}

function pickModel(messages: { role: string; content: string }[]): string {
  return detectManyCampaigns(messages) ? "gemini-2.5-flash-lite" : "gemini-2.5-flash";
}

function buildErrorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function transformGeminiStream(response: Response) {
  return new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(
                  new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)
                );
              }
            } catch { /* skip partial */ }
          }
        }
      } catch (err) {
        console.error("Stream transform error:", err);
      }
      controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, fileContents } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const model = pickModel(messages);
    console.log(`Using model: ${model} for ${messages.length} messages`);

    // Multimodal path (images)
    if (fileContents && fileContents.length > 0) {
      const imageFiles = fileContents.filter((f: any) => f.isBase64 && f.type?.startsWith("image/"));

      if (imageFiles.length > 0) {
        const systemInstruction = { parts: [{ text: SYSTEM_PROMPT }] };
        const geminiContents: any[] = [];

        for (const msg of messages) {
          if (msg.role === "user") {
            const parts: any[] = [{ text: msg.content }];
            if (msg === messages[messages.length - 1]) {
              for (const img of imageFiles) {
                parts.push({ inlineData: { mimeType: img.type, data: img.content } });
              }
            }
            geminiContents.push({ role: "user", parts });
          } else {
            geminiContents.push({ role: "model", parts: [{ text: msg.content }] });
          }
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
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
          if (response.status === 429) return buildErrorResponse(429, "Muitas requisições. Tente novamente.");
          return buildErrorResponse(500, "Erro no serviço de IA");
        }

        return new Response(transformGeminiStream(response), {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
    }

    // Text-only path
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return buildErrorResponse(429, "Muitas requisições. Tente novamente.");
      if (response.status === 402) return buildErrorResponse(402, "Créditos insuficientes.");
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return buildErrorResponse(500, "Erro no serviço de IA");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("comparator-chat error:", e);
    return buildErrorResponse(500, e instanceof Error ? e.message : "Erro desconhecido");
  }
});
