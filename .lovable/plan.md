

# Migrar geração de imagem para API nativa do Google Gemini

## Problema
As funções `generate-image` e `generate-creative` ainda usam o Lovable Gateway (`LOVABLE_API_KEY`) para gerar imagens, causando erro 402 por falta de créditos. A parte de texto (strategist) já foi migrada com sucesso.

## Solução
Trocar a chamada de imagem do Lovable Gateway para o endpoint **nativo** `generateContent` do Google, que suporta geração de imagem com `GEMINI_API_KEY`.

## Arquivos a alterar

### 1. `supabase/functions/generate-image/index.ts`
- Remover `LOVABLE_GATEWAY` e `LOVABLE_API_KEY`
- Chamada de imagem → `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`
- Body: `{ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }`
- Para imagens de referência (multimodal): adicionar parts com `inlineData: { mimeType, data }` (extrair base64 do data URL)
- Parsear resposta: `candidates[0].content.parts[]` → encontrar part com `inlineData` → converter para `data:${mimeType};base64,${data}`

### 2. `supabase/functions/generate-creative/index.ts`
- Mesma migração: trocar gateway por endpoint nativo `generateContent`
- Adaptar parsing da resposta de imagem

## Detalhes técnicos

```typescript
// Request
const imageRes = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: imagePrompt }, ...refParts] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  }
);

// Response parsing
const data = await imageRes.json();
const parts = data.candidates?.[0]?.content?.parts || [];
const imgPart = parts.find((p: any) => p.inlineData);
const imageUrl = imgPart
  ? `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`
  : "";
```

## Resultado
- Zero dependência do Lovable Gateway / créditos Lovable
- Todas as chamadas usam `GEMINI_API_KEY` exclusivamente
- Frontend inalterado — mesmo contrato de resposta

