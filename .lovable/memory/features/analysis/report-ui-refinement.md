---
name: Report UI Refinement
description: AnalysisReportPage usa todos os 20 campos do n8n; barrinhas Era 1.0-5.0 via regex, Hormozi clamp 0-5, audience_insights vem do n8n (sem fetch separado), cards de contexto e IBGE, exports DOCX e PPTX em paridade
type: feature
---

O componente AnalysisReportPage renderiza fielmente o `output_payload` do step `synthesis` do n8n, persistido pelo `n8n-callback` em `analysis_requests.normalized_payload` + colunas top-level (industry, primary_channel, region, declared_target_audience, scores).

## Fluxo de dados (end-to-end)
1. **n8n LLM SYNTHESIS** → emite JSON com 20 campos (scores, executive_summary, marketing_era "Marketing X.0 — ...", hormozi_analysis, cognitive_biases, kpi_analysis, timing_analysis, brand_sentiment, ibge_insights, industry, primary_channel, region, declared_target_audience, audience_insights, market_references, improvements, strengths).
2. **n8n Code "analysis_data"** → monta `_final_callback` + `step_update` com `normalized_payload` completo.
3. **Edge function n8n-callback** (legacy mode) → persiste em `analysis_requests`:
   - Top-level columns: scores, industry, primary_channel, region, declared_target_audience.
   - JSONB `normalized_payload`: 13 campos restantes incluindo `audience_insights` e `ibge_insights`.
4. **Frontend** lê `normalized_payload` com fallback para colunas top-level (`payload?.industry ?? analysis.industry`).

## Renderização
1. **Era do Marketing** (1.0–5.0): 5 barrinhas. Extrai número via `String(era).match(/\d+(\.\d+)?/)` para suportar strings descritivas ("Marketing 3.0 — Centrado em valores"). Sem regex falha, todas as barras ficavam apagadas.
2. **Hormozi**: Clamp `Math.max(0, Math.min(5, Math.round(value)))` evita barras quebradas se LLM retornar valores fora do range 1–5.
3. **Audiência Sintética**: Lê `audience_insights` (Array<{generation, emoji, feedback}>) direto do payload. **Removido fetch redundante para `audience-insights` edge function** (era custoso e duplicava dados). Fallback para `audience_behavior.cards` legado.
4. **Contexto da Análise**: Card com industry, primary_channel, region, declared_target_audience.
5. **IBGE Insights**: Card com `demographic_summary`, grid de `key_indicators` e `relevance`.
6. **Exports DOCX e PPTX**: ambos incluem Contexto + IBGE + audience_insights, em paridade.

## Não tocar
- RunStepsBlock continua oculto (debug-only).
- Score Overall fica no círculo grande (não nos 3 sub-scores grid) — decisão visual deliberada.
- Edge function `audience-insights` permanece deployada mas órfã; apagar futuramente se confirmado sem uso em outros lugares.

## Pré-requisito n8n
O nó **LLM SYNTHESIS** precisa retornar `marketing_era.era` no formato `"Marketing X.0 — ..."` (X = 1..5) com o `.0` explícito. Marketing 5.0 é opção válida e deve ser usada quando há IA/automação centrada no humano.
