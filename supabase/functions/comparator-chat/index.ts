import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, streamResponse, handleAIStatus, withErrorHandler } from "../_shared/errors.ts";
import { callGemini, transformGeminiStream } from "../_shared/gemini.ts";

// ─── Prompt ──────────────────────────────────────────────────

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
- **3+ campanhas**: 140–260 palavras (fora dashboard)
- Sem redundância com o dashboard — NÃO repita scores, rankings ou dados já presentes no dashboard em texto
- Só expandir se usuário pedir: **"quero versão detalhada"**

Para **3+ campanhas**, use 3 linhas por campanha:

1) Principal acerto
2) Principal gargalo
3) Impacto em ROI

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

[DASHBOARD]{"title":"Comparativo Estratégico","campaigns":["Nome A","Nome B"],"scores":[{"campaign":"Nome A","overall":88,"socio":90,"offer":85,"performance":88,"creative":90,"verdict":"Resumo em 1 linha"},{"campaign":"Nome B","overall":72,"socio":75,"offer":70,"performance":68,"creative":74,"verdict":"Resumo em 1 linha"}],"winner":"Nome A","winnerReason":"Razão objetiva","actions":["Ação 1","Ação 2","Ação 3"]}[/DASHBOARD]

Regras:

- JSON válido em linha única
- 1 score por campanha
- actions com 3 a 5 itens
- Não repetir tabela de scores em markdown — o dashboard já exibe tudo

---

## 8) ESTRUTURA FINAL (MARKDOWN)

## 1) Contexto

Tipo (first/third-party), escopo, confiança, limitações — máx. 3 linhas.

## 2) Análise por Campanha

- 1–2 campanhas: análise curta por bloco (sem repetir scores)
- 3+ campanhas: formato de 3 linhas por campanha

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

// ─── Helpers ─────────────────────────────────────────────────

function pickModel(messageCount: number): string {
  // Use flash-lite for 3+ campaign conversations (longer contexts, simpler per-campaign output)
  // Use flash for 1-2 campaigns (deeper analysis)
  return messageCount > 6 ? "gemini-2.5-flash-lite" : "gemini-2.5-flash";
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  return withErrorHandler("comparator-chat", async () => {
    const { validatePayload, ChatPayloadSchema } = await import("../_shared/validation.ts");
    const body = await req.json();
    const validated = validatePayload(ChatPayloadSchema, body);
    if (validated.error) return validated.error;
    const { messages, fileContents } = validated.data;
    const model = pickModel(messages.length);
    console.log(`[comparator] model=${model} msgs=${messages.length} files=${fileContents?.length ?? 0}`);

    // Multimodal path (images)
    if (fileContents && fileContents.length > 0) {
      const imageFiles = fileContents.filter((f: any) => f.isBase64 && f.type?.startsWith("image/"));

      if (imageFiles.length > 0) {
        const { getGeminiKey } = await import("../_shared/gemini.ts");
        const apiKey = getGeminiKey();

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
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
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
          const aiError = handleAIStatus(response.status);
          if (aiError) return aiError;
          return errorResponse(500, "Erro no serviço de IA", { category: "model" });
        }

        return streamResponse(transformGeminiStream(response.body!));
      }
    }

    // Text-only path
    const response = await callGemini({
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      stream: true,
    });

    if (!response.ok) {
      const aiError = handleAIStatus(response.status);
      if (aiError) return aiError;
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return errorResponse(500, "Erro no serviço de IA", { category: "model" });
    }

    return streamResponse(response.body);
  })(req);
});
