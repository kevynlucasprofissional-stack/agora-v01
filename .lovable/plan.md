

# Plano: Gerar Criativo no Chat do Estrategista e Redirecionar para o Estúdio Criativo

## Resumo

Adicionar um botão "Gerar Criativo" no header do chat do Estrategista-Chefe (AnalysisChatPage). Ao clicar, chama a edge function `generate-creative` com o contexto da análise e conversa atual. Quando concluído, exibe um botão para abrir o criativo no Estúdio Criativo (`/app/creative-studio/:jobId`).

Também ajustar o `CreativeStudioPage` para carregar automaticamente um `creative_job` existente (via `jobId` na URL), carregando a imagem de fundo e layers de texto no canvas Fabric.

## Mudanças

### 1. AnalysisChatPage.tsx — Botão "Gerar Criativo" + estado

- Adicionar estado `creativeJobId` e `generatingCreative`
- Botão no header (ao lado de "Novo chat") com ícone Sparkles: "Gerar Criativo"
- Ao clicar: chama `supabase.functions.invoke("generate-creative", { body: { analysis_id: id, conversation_id, format: "1080x1080" } })`
- Quando retorna `creative_job_id`, salva no estado e exibe um banner/botão acima do input: "Criativo gerado! Abrir no Estúdio Criativo →" com `Link` para `/app/creative-studio/${creativeJobId}?analysis_id=${id}&conversation_id=${conversationId}`

### 2. CreativeStudioPage.tsx — Carregar creative_job existente

- Quando `jobId` está presente na URL, buscar o `creative_job` do banco (`image_url`, `strategist_output`, `layers_state`)
- Se `layers_state` existe e não é vazio: usar `canvasState.loadJSON(layers_state)` para restaurar estado completo
- Se não tem `layers_state` mas tem `image_url` + `strategist_output`: carregar imagem como fundo + adicionar layers de texto (headline, body_copy, CTA) — igual ao que o ToolsSidebar já faz

### 3. Nenhuma mudança no banco de dados

A tabela `creative_jobs` já tem `layers_state`, `image_url`, `strategist_output`, `conversation_id` e `analysis_request_id`. Tudo necessário já existe.

## Fluxo do usuário

1. Usuário está no chat do Estrategista → clica "Gerar Criativo"
2. Loading spinner enquanto a IA gera
3. Criativo gerado → aparece banner "Abrir no Estúdio Criativo →"
4. Clica → vai para `/app/creative-studio/:jobId`
5. Canvas carrega com a imagem de fundo + textos posicionados
6. Usuário edita livremente e salva

