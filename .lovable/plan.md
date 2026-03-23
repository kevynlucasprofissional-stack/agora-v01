

## Plano: Corrigir bugs menores do Estudio Criativo

### Bug 1 — Ctrl+Z intercepta undo do browser em inputs

**Arquivo:** `useCanvasState.ts` (linha 98-106)

O handler de Ctrl+Z/Y não verifica se o foco esta em um input/textarea. Quando o usuario digita no PropertiesPanel ou ToolsSidebar e tenta Ctrl+Z para desfazer texto digitado, o undo do canvas e disparado em vez do undo nativo do browser.

**Correcao:** Adicionar o mesmo guard de input/textarea/contenteditable que ja existe no handler de Delete (linha 108-109) tambem para Ctrl+Z e Ctrl+Y.

---

### Bug 2 — Canvas nao faz dispose ao desmontar

**Arquivo:** `FabricCanvas.tsx`

O useEffect de inicializacao nao chama `canvas.dispose()` no cleanup. Ao trocar artboards ou sair da pagina, o canvas anterior fica vivo na memoria (event listeners, WebGL contexts).

**Correcao:** No cleanup do useEffect, chamar `state.canvasRef.current?.dispose()` antes de resetar `initialized`.

---

### Bug 3 — File input nao reseta apos upload

**Arquivo:** `ToolsSidebar.tsx` (linha 25-35)

Apos enviar uma imagem, o `<input type="file">` mantem o valor. Se o usuario tentar enviar o mesmo arquivo novamente, `onChange` nao dispara.

**Correcao:** Resetar `e.target.value = ""` no final do handler `handleUpload`.

---

### Bug 4 — Export PNG usa nome generico

**Arquivo:** `StudioHeader.tsx` (linha 178)

O download usa `criativo-${state.format}.png`. Nao inclui o nome do artboard, dificultando identificar multiplas exportacoes.

**Correcao:** Receber `artboardName` (ja disponivel como prop) e usar no filename: `${artboardName}-${format}.png`.

---

### Bug 5 — Nenhum loading state ao carregar job do banco

**Arquivo:** `CreativeStudioPage.tsx`

Quando o usuario abre `/app/creative-studio/:jobId`, a pagina mostra o workspace vazio enquanto o job carrega do banco. Nao ha indicacao visual de loading.

**Correcao:** Adicionar estado `jobLoading` e exibir um spinner centralizado enquanto o job esta sendo carregado.

---

### Bug 6 — WorkspaceGrid keyboard handler nao verifica contenteditable

**Arquivo:** `WorkspaceGrid.tsx` (linha 52)

O handler verifica `INPUT` e `TEXTAREA` mas nao `contenteditable`. Se algum elemento futuro usar contenteditable, Delete/Backspace vai deletar o elemento do workspace.

**Correcao:** Adicionar `|| (e.target as HTMLElement).isContentEditable` no guard.

---

### Bug 7 — Workspace pan state resetado ao recarregar

**Arquivo:** `useWorkspaceState.ts`

Os elements sao persistidos no localStorage, mas `pan` e `wsZoom` nao. Ao recarregar, o usuario perde a posicao de visualizacao e tem que navegar de volta.

**Correcao:** Persistir `pan` e `wsZoom` no localStorage junto com os elements.

---

### Arquivos editados

| Arquivo | Mudanca |
|---|---|
| `useCanvasState.ts` | Guard de input no Ctrl+Z/Y |
| `FabricCanvas.tsx` | Dispose canvas no cleanup |
| `ToolsSidebar.tsx` | Reset file input apos upload |
| `StudioHeader.tsx` | Nome do artboard no filename de export |
| `CreativeStudioPage.tsx` | Loading state ao carregar job |
| `WorkspaceGrid.tsx` | Guard contenteditable no keyboard handler |
| `useWorkspaceState.ts` | Persistir pan/zoom no localStorage |

