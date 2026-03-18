

# Plano: Editor de Criativos com Fabric.js (estilo Canva)

## Resumo

Criar uma página dedicada `/app/creative-studio` com um editor visual baseado em **Fabric.js**, oferecendo experiência semelhante ao Canva: sidebar de ferramentas à esquerda, canvas central interativo, painel de propriedades à direita. Integrado com a IA existente (`generate-creative`) para gerar criativos a partir de prompts.

## Estrutura de Arquivos

```text
src/
  pages/app/CreativeStudioPage.tsx        — Página principal (layout 3 colunas)
  components/creative-studio/
    FabricCanvas.tsx                       — Wrapper do Fabric.js canvas
    ToolsSidebar.tsx                       — Sidebar esquerda (Texto, Formas, Upload, IA)
    PropertiesPanel.tsx                    — Painel direita (cor, fonte, opacidade, posição)
    StudioHeader.tsx                       — Header (formato, zoom, undo/redo, export)
    useCanvasState.ts                      — Hook: instância Fabric, undo/redo stack, seleção
```

## Funcionalidades

### Canvas (Fabric.js)
- Canvas responsivo com zoom (scroll + controles)
- Objetos: texto (IText editável), formas (rect, circle, triangle, line, star), imagens
- Seleção, multi-seleção, agrupamento
- Drag, resize, rotação com handles nativos do Fabric
- Snap-to-center guides
- Undo/Redo (stack de JSON states, Ctrl+Z / Ctrl+Shift+Z)
- Formatos: 1080x1080, 1080x1920, 1200x628, 1080x1350

### Sidebar de Ferramentas
- **Texto**: Adicionar título, subtítulo, corpo com estilos pré-definidos
- **Formas**: Retângulo, círculo, triângulo, linha com cores configuráveis
- **Upload**: Arrastar/clicar para adicionar imagens como objetos no canvas
- **IA**: Campo de prompt → chama `generate-creative` → carrega imagem de fundo + layers de texto no canvas
- **Templates**: Pré-sets salvos de layouts populares (feed, stories, banner)

### Painel de Propriedades
- Quando objeto selecionado: cor, fonte (Google Fonts subset), tamanho, peso, alinhamento, opacidade, borda, sombra, posição (x/y/w/h/rotação)
- Quando nada selecionado: cor de fundo do canvas

### Header
- Seletor de formato (dropdown)
- Botões undo/redo
- Controle de zoom (slider + fit)
- Export: PNG (canvas.toDataURL), PDF (jsPDF), abrir no Adobe Express (integração existente)
- Salvar (auto-save no `creative_jobs.layers_state`)

## Mudanças no Banco de Dados

Adicionar coluna `layers_state jsonb` na tabela `creative_jobs` para persistir o estado completo do canvas Fabric (via `canvas.toJSON()`).

## Dependências

- `fabric` (v6) — biblioteca principal do canvas
- Já existente: `html2canvas`, `jspdf` (para export PDF)

## Rota

Adicionar em `App.tsx`:
```
<Route path="creative-studio" element={<CreativeStudioPage />} />
<Route path="creative-studio/:jobId" element={<CreativeStudioPage />} />
```

Adicionar link na sidebar (`AppSidebar.tsx`).

## Integração com IA

O fluxo "Gerar com IA" na sidebar:
1. Usuário digita prompt (ex: "Criativo para promoção de tênis")
2. Chama edge function `generate-creative` com `analysis_id` (ou cria um ad-hoc)
3. Recebe `image_url` + `strategist_output` (headline, body, CTA)
4. Carrega imagem como fundo no canvas Fabric
5. Adiciona layers de texto (IText) com headline, body, CTA posicionados

## Escopo

**Esta implementação**: Canvas Fabric funcional com texto, formas, imagens, upload, IA, undo/redo, export PNG, painel de propriedades, auto-save.

**Futuro**: Templates salvos, animações, filtros avançados de imagem, colaboração.

