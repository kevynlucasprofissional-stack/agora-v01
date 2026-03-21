

## Melhorias no Estúdio Criativo: Redimensionamento, Z-Index, Setas Livres e UX

### O que será feito

1. **Z-Index (profundidade) para todos os elementos**
   - Adicionar campo `zIndex` em `StickyNote`, `WorkspaceText` e `Artboard`
   - No `WorkspacePropertiesPanel`, adicionar botões "Trazer para frente" / "Enviar para trás" para o elemento selecionado
   - No `WorkspaceGrid`, aplicar `style.zIndex` em cada elemento
   - Atalho: também adicionar botões no header ou context actions

2. **Redimensionamento visual de notas (handles de resize)**
   - No `StickyNoteCard`, adicionar um handle no canto inferior-direito (drag para redimensionar)
   - Ao arrastar o handle, atualizar `width` e `height` no estado
   - Manter os inputs numéricos no painel de propriedades como alternativa

3. **Setas livres (freeform arrows)**
   - Mudar o modelo de `Arrow` para suportar dois modos: `connected` (fromId/toId, como hoje) e `freeform` (pontos x1,y1 → x2,y2 posicionados livremente)
   - Adicionar campos opcionais `x1, y1, x2, y2` ao tipo `Arrow`
   - Modo de criação freeform: o usuário clica em um ponto vazio do workspace para definir o início, depois clica em outro ponto para o fim
   - Setas freeform podem ser arrastadas pelas extremidades (dois handles nos pontos de início e fim)
   - Manter o modo connected existente como opção (clique em dois elementos)
   - No header, split do botão Seta em duas opções: "Conectar elementos" e "Seta livre"

4. **Setas curvas (melhoria visual)**
   - Adicionar estilo `curved` além de `solid` e `dashed`
   - Renderizar com `<path>` SVG usando curva quadrática em vez de `<line>`, dando visual mais orgânico

5. **Melhorias de UX adicionais**
   - **Duplicar elemento**: botão no painel de propriedades e atalho Ctrl+D
   - **Snap to grid**: opção toggle no header para alinhar elementos à grade de 40px
   - **Minimap**: pequeno retângulo no canto inferior-direito mostrando a visão geral do workspace com indicador de viewport
   - **Seleção múltipla**: Shift+click para selecionar vários elementos e mover em grupo
   - **Delete com tecla**: pressionar Delete/Backspace remove o elemento selecionado

### Arquivos editados
- `useWorkspaceState.ts` — zIndex, freeform arrow fields, duplicate, keyboard delete
- `StickyNoteCard.tsx` — resize handles
- `ArrowConnector.tsx` — freeform mode, curved style, draggable endpoints
- `WorkspaceGrid.tsx` — zIndex rendering, keyboard events, shift-select
- `WorkspacePropertiesPanel.tsx` — z-index controls, freeform arrow props
- `StudioHeader.tsx` — split arrow tool, snap toggle, duplicate button

### Detalhes técnicos

- **Z-index**: Mantido como número simples (0-999). "Trazer frente" pega o maior zIndex de todos elementos + 1. "Enviar trás" pega o menor - 1.
- **Resize handle**: Um `<div>` de 8x8px no corner SE do StickyNote com `cursor: nwse-resize`, usando `mousedown` + `mousemove` global.
- **Freeform arrows**: Quando `fromId` e `toId` são null, usam `x1,y1,x2,y2` direto. O `ArrowConnector` verifica qual modo usar. Endpoints arrastáveis via pequenos círculos SVG clicáveis.
- **Curved arrows**: `<path d="M x1,y1 Q cx,cy x2,y2">` onde o control point é calculado como ponto médio deslocado perpendicularmente à linha.
- **Keyboard**: `useEffect` com `keydown` listener no `WorkspaceGrid` para Delete e Ctrl+D.

