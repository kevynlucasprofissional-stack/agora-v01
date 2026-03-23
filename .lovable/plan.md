

## Carregar imagem do creative_job no Estúdio Criativo

### Problema

Quando o usuário clica "Abrir no Estúdio" após gerar um criativo, o `CreativeStudioPage` carrega o job do banco mas **nunca usa o `image_url`**. O campo `layers_state` está vazio (`{}`) para jobs recém-criados, então o artboard abre em branco.

### Solução

Ao carregar um `creative_job`, usar o `image_url` como background do canvas e adicionar os textos do `strategist_output` (headline, subheadline, CTA) como objetos editáveis no Fabric.js.

### Arquivos editados

1. **`src/pages/app/CreativeStudioPage.tsx`**
   - Buscar também `image_url` e `strategist_output` do job (já busca, mas não usa)
   - Após criar o artboard e entrar no modo editor, chamar `canvasState.setBackgroundImage(job.image_url)` para definir o fundo
   - Extrair `editable_layers` do `strategist_output` e chamar `canvasState.addText()` para cada layer (headline, subheadline, CTA) com estilos apropriados

2. **`src/components/creative-studio/useCanvasState.ts`** (possivelmente)
   - Pode ser necessário adicionar um método que combine background + layers de uma vez, ou simplesmente usar os métodos existentes (`setBackgroundImage` + `addText`) em sequência

### Detalhes técnicos

- O `generate-creative` já salva `image_url` e `strategist_output` no `creative_jobs`
- O `strategist_output` contém `editable_layers` com objetos `{type, content, style}`
- O `useCanvasState` já tem `setBackgroundImage(url)` e `addText(text, options)`
- O fluxo será: carregar job → criar artboard → entrar no editor → esperar canvas ready → definir background + adicionar textos
- Se `layers_state` já tiver objetos salvos (edição posterior), usar ele em vez de recriar do strategist_output

