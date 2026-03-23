

## Plano: Corrigir bugs criticos do Estudio Criativo

### Bug 1 — Links sem jobId (ReportChatBlock + NewAnalysisPage)

Os botões "Abrir no Estúdio Criativo" em `ReportChatBlock.tsx` e `NewAnalysisPage.tsx` redirecionam para `/app/creative-studio` sem passar o `jobId`. O estúdio abre em branco porque não sabe qual job carregar.

**Correção:**
- **`ReportChatBlock.tsx`**: Extrair `creative_job_id` do conteúdo da mensagem (mesmo padrão já usado no `AnalysisChatPage`) e montar o link como `/app/creative-studio/{jobId}`.
- **`NewAnalysisPage.tsx`**: Mesmo tratamento — extrair o `creative_job_id` do content da mensagem e passar no link.

### Bug 2 — FabricCanvas não reinicializa ao trocar artboard

O `initialized.current` ref nunca é resetado. Quando o usuário sai de um artboard e entra em outro, o canvas não é recriado.

**Correção em `FabricCanvas.tsx`:**
- Resetar `initialized.current = false` quando o componente desmonta (cleanup no useEffect) ou quando `state.initCanvas` muda (indicando troca de dimensões/artboard).

### Bug 3 — Race condition entre layers_state e pendingJobRef

No `CreativeStudioPage.tsx`, o useEffect que carrega `editingId` e o useEffect que aplica `pendingJobRef` competem. Quando ambos disparam com `canvasReady`, o primeiro carrega o `layersState` vazio (`{}`) e o segundo tenta aplicar a imagem, mas o canvas pode já ter sido sobrescrito.

**Correção em `CreativeStudioPage.tsx`:**
- No useEffect de `editingId`, verificar se o artboard tem `layersState` com objetos antes de chamar `loadJSON`. Se não tiver objetos, pular — deixando o `pendingJobRef` effect lidar com a inicialização.
- Garantir que `pendingJobRef` só é consumido uma vez.

### Bug 4 — Imagem base64 gigante salva no banco

A Gemini API retorna imagens como data URIs base64 (~500KB-2MB). Isso é salvo diretamente no campo `image_url` da tabela `creative_jobs` e `chat_messages`, causando bloat no banco e problemas de performance.

**Correção na edge function `generate-creative/index.ts`:**
- Após receber a imagem base64 da Gemini, fazer upload para o storage bucket `agora-files` como arquivo PNG.
- Gerar uma signed URL (ou public URL) e salvar essa URL no `image_url` em vez do base64.
- Isso resolve também problemas de CORS no Fabric.js ao carregar a imagem.

### Arquivos editados

| Arquivo | Mudança |
|---|---|
| `src/components/ReportChatBlock.tsx` | Extrair `creative_job_id` e passar no link |
| `src/pages/app/NewAnalysisPage.tsx` | Extrair `creative_job_id` e passar no link |
| `src/components/creative-studio/FabricCanvas.tsx` | Reset `initialized` ref no cleanup |
| `src/pages/app/CreativeStudioPage.tsx` | Evitar `loadJSON` com layersState vazio |
| `supabase/functions/generate-creative/index.ts` | Upload base64 para storage, salvar URL |

### Ordem de execução

1. Bug 4 (base64 → storage) — Maior impacto, resolve performance e CORS
2. Bug 1 (links sem jobId) — Resolve redirecionamento quebrado
3. Bug 3 (race condition) — Resolve canvas em branco
4. Bug 2 (reinicialização do canvas) — Resolve troca de artboards

