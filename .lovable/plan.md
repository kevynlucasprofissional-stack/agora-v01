

# Migrar todas as Edge Functions do Lovable AI Gateway para a API direta do Google Gemini

## Contexto
Atualmente, 5 edge functions usam o Lovable AI Gateway (`ai.gateway.lovable.dev`) com `LOVABLE_API_KEY`, o que consome créditos do workspace Lovable. As outras 4 já usam a API direta do Google (`generativelanguage.googleapis.com`) com `GEMINI_API_KEY`. O objetivo é unificar todas para usar a API do Google diretamente, eliminando a dependência de créditos Lovable.

## Funções a migrar (5 arquivos)

### 1. `supabase/functions/generate-image/index.ts`
- Trocar `LOVABLE_API_KEY` → `GEMINI_API_KEY`
- **Chamada de texto (strategist)**: trocar gateway por `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` com `Authorization: Bearer ${GEMINI_API_KEY}` (endpoint OpenAI-compatible do Google)
- **Chamada de imagem**: trocar gateway por `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}` com `generationConfig: { responseModalities: ["TEXT", "IMAGE"] }` e adaptar o parsing da resposta (Google retorna `parts` com `inlineData.data` em base64, não `images[].image_url.url`)

### 2. `supabase/functions/generate-creative/index.ts`
- Mesma migração: strategist → endpoint OpenAI-compatible, imagem → `generateContent` nativo
- Adaptar parsing da resposta de imagem para o formato Google (`response.candidates[0].content.parts` → encontrar part com `inlineData`)

### 3. `supabase/functions/analyze-campaign/index.ts`
- Trocar gateway por endpoint OpenAI-compatible do Google
- Manter retry logic entre modelos, apenas mudar URL e auth header
- Modelos: `gemini-2.5-flash` e `gemini-3-flash-preview` (mesmos nomes sem prefixo `google/`)

### 4. `supabase/functions/strategist-chat/index.ts`
- Streaming: trocar gateway por `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` (suporta streaming no formato OpenAI-compatible)
- Trocar `LOVABLE_API_KEY` → `GEMINI_API_KEY`

### 5. `supabase/functions/audience-insights/index.ts`
- Trocar gateway por endpoint OpenAI-compatible com tool calling
- Trocar `LOVABLE_API_KEY` → `GEMINI_API_KEY`

## Detalhes técnicos

**Endpoint OpenAI-compatible (texto/chat/tools):**
```
https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
Authorization: Bearer ${GEMINI_API_KEY}
```
- Suporta mesmo formato de request/response (messages, tools, stream)
- Modelos sem prefixo: `gemini-2.5-flash`, `gemini-3-flash-preview`, `gemini-2.5-flash-lite`

**Endpoint nativo para imagens:**
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}
```
- Body: `{ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }`
- Response: `candidates[0].content.parts[]` → part com `inlineData: { mimeType, data }` (base64)
- Converter para `data:image/png;base64,${data}` para uso no HTML

**Para imagens com referência (multimodal):**
- Adicionar parts com `inlineData: { mimeType, data: base64 }` junto ao text part

## Resultado
- Todas as 9 edge functions usarão `GEMINI_API_KEY` (já configurada como secret)
- Zero dependência de créditos Lovable para IA
- Sem mudanças no frontend — os contratos de resposta das functions permanecem iguais

