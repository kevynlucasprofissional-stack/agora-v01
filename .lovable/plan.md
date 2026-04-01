

## Diagnóstico: Criativo sem imagem para novos usuários

### Causa raiz

Na edge function `generate-creative`, a geração de imagem (linha 218-271) pode falhar silenciosamente. Quando `imageRes.ok` é `false`, o código apenas faz `console.error` e define `imageUrl = ""`. No cliente, `if (data?.image_url)` com string vazia é falsy, então nenhum background é aplicado — o usuário recebe apenas os textos.

Motivos prováveis da falha intermitente:
1. **Rate limiting do Gemini** — o modelo `gemini-3.1-flash-image-preview` tem quotas apertadas; com múltiplos usuários simultâneos, a API retorna 429
2. **Timeout** — a geração de imagem pode demorar >30s e o edge function timeout pode cortar
3. **Sem retry** — falha na primeira tentativa = sem imagem, sem feedback ao usuário

### Plano de melhoria

#### 1. `supabase/functions/generate-creative/index.ts` — Retry + fallback + feedback

- Adicionar **retry com backoff** (até 2 retries) na chamada de geração de imagem
- Se todas as tentativas falharem, tentar com modelo alternativo (`gemini-2.5-flash-image`) como fallback
- Retornar campo `image_generation_failed: true` na resposta quando não há imagem, para o cliente poder informar o usuário
- Logar o status code e body do erro para diagnóstico

#### 2. `src/components/creative-studio/ToolsSidebar.tsx` — Feedback ao usuário

- Após receber a resposta, se `data.image_url` estiver vazio ou `data.image_generation_failed` for true, mostrar toast de aviso: "Criativo gerado apenas com texto. A imagem de fundo não pôde ser gerada. Tente novamente."
- Manter o fluxo funcional (textos são aplicados normalmente)

### Detalhes técnicos

```text
generate-creative/index.ts:
  
  async function generateImageWithRetry(prompt, apiKey, maxRetries = 2):
    for attempt 0..maxRetries:
      response = fetch(GEMINI_IMAGE_URL, ...)
      if response.ok → return parsed image
      if response.status === 429 → wait 2^attempt seconds, retry
      else → log error, retry
    
    // Fallback: try simpler model
    response = fetch(GEMINI_FLASH_IMAGE_URL, ...)
    if response.ok → return parsed image
    
    return null  // all failed

  // In main flow:
  const imageResult = await generateImageWithRetry(...)
  const image_generation_failed = !imageResult
```

```text
ToolsSidebar.tsx:
  
  if (!data?.image_url || data?.image_generation_failed) {
    toast.warning("Imagem de fundo não gerada. Textos aplicados.");
  }
```

