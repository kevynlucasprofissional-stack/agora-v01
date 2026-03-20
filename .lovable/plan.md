

## Reformular o Estúdio Criativo: Workspace com Grid Infinito + Múltiplos Artboards

Transformar o Creative Studio de um editor de canvas único para um workspace estilo Figma, com fundo quadriculado infinito onde o usuário pode criar e organizar múltiplos criativos. Clicar em um criativo abre o editor completo com as ferramentas de edição.

### Arquitetura

```text
┌─────────────────────────────────────────────────┐
│  StudioHeader (zoom, salvar, novo artboard)      │
├──────┬──────────────────────────────┬───────────┤
│      │                              │           │
│ Tools│   Infinite Grid Workspace    │ Properties│
│ Side │   ┌──────┐    ┌──────┐      │  Panel    │
│ bar  │   │ Art 1│    │ Art 2│      │ (contexto │
│      │   └──────┘    └──────┘      │  do item  │
│      │        ┌──────┐             │ selecion.)│
│      │        │ Art 3│             │           │
│      │        └──────┘             │           │
├──────┴──────────────────────────────┴───────────┤
│  Ao dar duplo-clique num artboard:              │
│  → Abre modal/view com FabricCanvas full editor │
└─────────────────────────────────────────────────┘
```

### O que será feito

1. **Criar sistema de Artboards**
   - Novo tipo `Artboard` com id, nome, posição no workspace (x, y), formato, thumbnail, e estado do canvas (layers_state)
   - Estado gerenciado via `useWorkspaceState` hook que controla lista de artboards, seleção, pan e zoom do workspace

2. **Criar o Workspace com grid infinito**
   - Fundo quadriculado (CSS pattern ou SVG) com pan (arrastar) e zoom (scroll)
   - Artboards renderizados como cards/thumbnails posicionados livremente no grid
   - Selecionar artboard mostra propriedades básicas (nome, formato) no painel direito
   - Botão "+" para criar novo artboard (escolher formato)

3. **Editor de Artboard em modo focado**
   - Duplo-clique em um artboard abre o editor completo (FabricCanvas + ToolsSidebar + PropertiesPanel)
   - Botão "Voltar ao Workspace" para retornar à visão geral
   - O canvas existente (useCanvasState, FabricCanvas) continua funcionando igual, mas agora vinculado a um artboard específico

4. **Atualizar StudioHeader**
   - No modo workspace: zoom do workspace, botão "Novo Artboard"
   - No modo editor: ferramentas atuais (formato, undo/redo, zoom do canvas, salvar, exportar)

5. **Persistência**
   - Cada artboard salva seu layers_state independentemente
   - O workspace salva posições dos artboards

### Detalhes técnicos

- **Workspace pan/zoom**: Implementado via CSS transform no container + event handlers para mousewheel (zoom) e middle-click/space+drag (pan)
- **Grid background**: CSS `background-image` com `repeating-linear-gradient` para performance (sem SVG animado)
- **Thumbnails**: Canvas miniatura gerado via `canvas.toDataURL()` em escala reduzida ao sair do editor
- **Estado**: Dois modos na página — `"workspace"` e `"editor"` — controlados por estado local
- **Componentes reutilizados**: `useCanvasState`, `FabricCanvas`, `ToolsSidebar`, `PropertiesPanel` permanecem inalterados, apenas usados dentro do modo editor
- **Novos arquivos**:
  - `src/components/creative-studio/useWorkspaceState.ts`
  - `src/components/creative-studio/WorkspaceGrid.tsx`
  - `src/components/creative-studio/ArtboardCard.tsx`
  - Atualizar `CreativeStudioPage.tsx` e `StudioHeader.tsx`

