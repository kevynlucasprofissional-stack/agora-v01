

## Adicionar Ferramentas de Mapa Mental ao Workspace do Estúdio Criativo

Transformar o workspace em um espaço híbrido de mapa mental + criativos, com setas de conexão, notas adesivas, textos livres e cores personalizáveis.

### O que será feito

1. **Expandir o modelo de dados do workspace** (`useWorkspaceState.ts`)
   - Adicionar tipos para novos elementos: `StickyNote` (nota adesiva com texto, cor, posição), `WorkspaceText` (texto livre com tamanho, cor, posição), `Arrow` (seta conectando dois elementos por ID ou posição livre)
   - Union type `WorkspaceElement` que engloba artboards + notas + textos + setas
   - CRUD para cada tipo de elemento (add/update/remove)
   - Seleção unificada: qualquer elemento pode ser selecionado e mostrar propriedades no painel direito

2. **Renderizar novos elementos no WorkspaceGrid** (`WorkspaceGrid.tsx`)
   - `StickyNoteCard`: retângulo colorido com texto editável (inline), redimensionável, arrastável
   - `WorkspaceTextNode`: texto livre posicionado no canvas, com fonte/tamanho/cor configuráveis
   - `ArrowConnector`: SVG `<line>` ou `<path>` entre dois pontos/elementos, com opções de estilo (seta simples, bidirecional, tracejada), cor configurável
   - Todos os elementos seguem o mesmo sistema de pan/zoom dos artboards

3. **Toolbar no header do workspace** (`StudioHeader.tsx`)
   - Adicionar botões ao lado do "Novo Artboard": "Nova Nota", "Texto", "Seta"
   - Para setas: modo de criação onde o usuário clica em elemento de origem e depois no destino
   - Dropdown de cores rápidas para o elemento selecionado

4. **Painel de propriedades expandido** (`WorkspacePropertiesPanel.tsx`)
   - Quando nota selecionada: editar texto, cor de fundo (palette de cores), tamanho
   - Quando texto selecionado: editar conteúdo, fonte size, cor, negrito/itálico
   - Quando seta selecionada: estilo (sólida/tracejada), cor, direcional/bidirecional
   - Manter propriedades de artboard como já existe

5. **Drag para mover elementos** (`WorkspaceGrid.tsx`)
   - Click+drag em qualquer elemento (nota, texto, artboard) para reposicionar no workspace
   - Setas conectadas a elementos acompanham automaticamente a posição

### Novos arquivos
- `src/components/creative-studio/StickyNoteCard.tsx`
- `src/components/creative-studio/WorkspaceTextNode.tsx`
- `src/components/creative-studio/ArrowConnector.tsx`

### Arquivos editados
- `useWorkspaceState.ts` — novos tipos e CRUD
- `WorkspaceGrid.tsx` — renderizar novos elementos + drag
- `StudioHeader.tsx` — botões de ferramentas
- `WorkspacePropertiesPanel.tsx` — propriedades contextuais
- `CreativeStudioPage.tsx` — passar novos handlers

### Detalhes técnicos
- Setas renderizadas via SVG overlay no workspace (mesma camada de transform)
- Conexões armazenam `fromId`/`toId` e calculam posição central dos elementos para desenhar a seta
- Cores: palette pré-definida (amarelo, rosa, azul, verde, roxo, laranja) + input hex livre
- Drag implementado com mousedown/mousemove no elemento, atualiza x/y no estado

