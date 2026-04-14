

## Plano: Responsividade do Estudio Criativo

### Problema
O Estudio Criativo usa layout de 3 colunas fixas (sidebar 256px + canvas + painel 240px) com header horizontal largo. Em telas mobile (390px), as sidebars consomem todo o espaço, tornando o canvas invisivel e a UI inutilizavel.

### Estrategia

**Workspace mode (lista de artboards):**
- Header: trocar barra horizontal por layout empilhado; agrupar botoes de acao em menu dropdown no mobile
- WorkspaceGrid: funciona ok (canvas infinito)
- WorkspacePropertiesPanel: esconder no mobile; mostrar como sheet/drawer de baixo ao selecionar elemento

**Editor mode (canvas Fabric.js):**
- Header: compactar em 2 linhas ou usar overflow horizontal; agrupar zoom + format em area compacta; icones sem labels
- ToolsSidebar (w-64): esconder no mobile; substituir por bottom sheet ou drawer que abre sob demanda via botao flutuante
- Canvas (FabricCanvas): ocupar tela inteira no mobile
- PropertiesPanel (w-60): esconder no mobile; mostrar como sheet lateral ou bottom drawer ao selecionar objeto

### Arquivos impactados

1. **CreativeStudioPage.tsx** — adicionar hook `useIsMobile()`, passar para componentes filhos; condicionar layout
2. **StudioHeader.tsx** — modo workspace: agrupar acoes (Artboard, Nota, Texto, Seta) em DropdownMenu no mobile; modo editor: compactar controles, remover labels
3. **ToolsSidebar.tsx** — envolver em `Sheet` no mobile, visivel via botao flutuante; manter sidebar fixa no desktop
4. **PropertiesPanel.tsx** — envolver em `Sheet` no mobile, abrir automaticamente ao selecionar objeto
5. **WorkspacePropertiesPanel.tsx** — mesma abordagem: `Sheet` bottom no mobile
6. **FabricCanvas.tsx** — garantir `flex-1 min-w-0` para ocupar espaco disponivel

### Detalhes tecnicos

- Usar `useIsMobile()` hook ja existente em `src/hooks/use-mobile.tsx`
- Usar componente `Sheet` do shadcn/ui (ja instalado) para paineis mobile
- Botao flutuante (FAB) no canto inferior para abrir ToolsSidebar no mobile
- PropertiesPanel abre como Sheet lateral direito ao selecionar objeto, fecha ao deselecionar
- Header workspace: itens de criacao agrupados em um unico `DropdownMenu` com icone `Plus`
- Header editor: remover texto dos botoes, manter so icones; slider de zoom menor
- Nenhuma funcionalidade removida, apenas reorganizacao visual

### Preservado
- Todas as funcionalidades (drag, zoom, pan, arrows, snap, AI generation, export)
- Auto-save, persistencia, keyboard shortcuts
- Layout desktop inalterado

### Checklist de validacao
- [ ] Mobile workspace: header compacto, grid usavel, propriedades em sheet
- [ ] Mobile editor: canvas full-width, tools em sheet, properties em sheet
- [ ] Desktop: nenhuma regressao visual
- [ ] Botoes de acao todos acessiveis no mobile

