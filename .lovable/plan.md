

## Plano: Corrigir bugs importantes do Estúdio Criativo

### Bug 1 — Color picker de texto no WorkspacePropertiesPanel hardcoded

**Arquivo:** `src/components/creative-studio/WorkspacePropertiesPanel.tsx` (linha 201)

O `<Input type="color">` usa `value="#ffffff"` fixo em vez de ler `(element as WorkspaceText).color`. O usuário nunca vê a cor atual do texto.

**Correção:** Trocar `value="#ffffff"` por `value={(element as WorkspaceText).color}`.

---

### Bug 2 — Atalhos de teclado (Delete/Backspace) disparam durante edição de texto

**Arquivo:** `src/components/creative-studio/useCanvasState.ts` (linhas 96-115)

O handler de Delete/Backspace no canvas não verifica se o alvo do evento é um input/textarea. Ao digitar em campos do PropertiesPanel ou ToolsSidebar, objetos são deletados acidentalmente.

**Correção:** Adicionar guard no início do handler:
```
if (target is INPUT, TEXTAREA, or contenteditable) return;
```

---

### Bug 3 — Memory leak no upload de imagens (URL.createObjectURL)

**Arquivo:** `src/components/creative-studio/ToolsSidebar.tsx` (linha 28)

`URL.createObjectURL(file)` nunca é revogado. Cada upload acumula blobs na memória.

**Correção:** Chamar `URL.revokeObjectURL(url)` no callback `onload` do `addImage`, ou após o fabric processar. Alternativa simples: converter para FileReader data URL (auto-GC).

---

### Bug 4 — Workspace não persiste (estado local perdido ao recarregar)

**Arquivo:** `src/components/creative-studio/useWorkspaceState.ts`

Os elementos do workspace (sticky notes, textos, artboards manuais) ficam apenas em `useState`. Ao recarregar a página, tudo é perdido.

**Correção:** Salvar/carregar `elements` no `localStorage` com debounce. Usar `useEffect` para hidratar no mount e salvar a cada mudança (excluindo thumbnails base64 grandes).

---

### Bug 5 — Thumbnail exportado com multiplier alto causa lag

**Arquivo:** `src/components/creative-studio/useCanvasState.ts`

`exportPNG` usa `multiplier: 2`, gerando imagens enormes para thumbnails de preview. Para artboards 1080x1920, gera 2160x3840 data URIs.

**Correção:** Adicionar um método `exportThumbnail()` separado com `multiplier: 0.2` (ou escala fixa para ~200px) para uso nos thumbnails do workspace. Manter `exportPNG` com multiplier 2 para exportação final.

---

### Arquivos editados

| Arquivo | Mudança |
|---|---|
| `src/components/creative-studio/WorkspacePropertiesPanel.tsx` | Ler cor real do elemento no color picker |
| `src/components/creative-studio/useCanvasState.ts` | Guard de input nos atalhos + método `exportThumbnail` |
| `src/components/creative-studio/ToolsSidebar.tsx` | Revogar objectURL após uso |
| `src/components/creative-studio/useWorkspaceState.ts` | Persistir elements no localStorage |
| `src/pages/app/CreativeStudioPage.tsx` | Usar `exportThumbnail` em vez de `exportPNG` para thumbnails |

### Ordem de execução

1. Bug 2 (atalhos deletando durante digitação) — UX quebrada
2. Bug 1 (color picker hardcoded) — UI incorreta
3. Bug 5 (thumbnail otimizado) — Performance
4. Bug 3 (memory leak) — Limpeza
5. Bug 4 (persistência localStorage) — Qualidade de vida

