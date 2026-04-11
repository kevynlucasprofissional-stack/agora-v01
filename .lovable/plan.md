

# Documento Consolidado de System Prompts para n8n

**Objetivo**: Gerar um arquivo Markdown em `/mnt/documents/` com os 4 system prompts corrigidos (sociobehavioral, offer_analysis, performance_timing, synthesis), alinhados ao schema real do backend (`ANALYSIS_TOOL` em `analyze-campaign/index.ts` e persistência em `n8n-callback/index.ts`).

**Nota**: O prompt de intake não foi solicitado nesta rodada (são 4 agentes, não 5 — o intake é o contexto inicial que alimenta os demais).

## O que será gerado

Um único arquivo `system-prompts-n8n-agents.md` contendo:

1. **Introdução** — Explicação do pipeline e contrato de saída esperado
2. **Agente Sociocomportamental** — Prompt corrigido gerando `score_sociobehavioral`, `marketing_era`, `cognitive_biases`, `audience_insights`, `brand_sentiment`
3. **Agente Engenharia de Oferta** — Prompt corrigido gerando `score_offer`, `hormozi_analysis`, `diagnostics` (segmentation/creative/social_proof)
4. **Agente Performance & Timing** — Prompt corrigido gerando `score_performance`, `kpi_analysis`, `timing_analysis`
5. **Agente Síntese Final (Chief Strategist)** — Prompt consolidador usando tool `analysis_result`, gerando TODOS os campos obrigatórios do `ANALYSIS_TOOL`

Cada prompt incluirá:
- Instruções claras em português
- Schema JSON exato esperado como saída
- Campos obrigatórios vs opcionais
- Valores permitidos para enums (ex: status de vieses cognitivos)

## Arquivos de referência utilizados
- `supabase/functions/analyze-campaign/index.ts` (linhas 9-147) — schema canônico
- `supabase/functions/n8n-callback/index.ts` — persistência e campos mapeados

## Entrega
- Arquivo: `/mnt/documents/system-prompts-n8n-agents.md`

