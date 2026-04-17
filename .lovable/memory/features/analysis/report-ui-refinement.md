---
name: Report UI Refinement
description: AnalysisReportPage usa todos os 20 campos do n8n; barrinhas Era 1.0-5.0 via regex, Hormozi clamp 0-5, audience_insights vem do n8n (sem fetch separado), cards de contexto e IBGE
type: feature
---

O componente AnalysisReportPage renderiza fielmente o output_payload do n8n synthesis:

1. **Era do Marketing**: 5 barrinhas (1.0 a 5.0). Extrai número via `String(era).match(/\d+(\.\d+)?/)` para suportar strings descritivas como "Marketing 3.0 — Centrado em valores".
2. **Hormozi**: Clamp `Math.max(0, Math.min(5, Math.round(value)))` para evitar barras quebradas em valores fora do range 1-5.
3. **Audiência Sintética**: Lê `audience_insights` (Array<{generation, emoji, feedback}>) direto do `normalized_payload`. **Removido o fetch para `audience-insights` edge function** (era redundante e custoso). Fallback para `audience_behavior.cards` legado.
4. **Contexto da Análise**: Card novo com industry, primary_channel, region, declared_target_audience (do payload, fallback para colunas top-level de analysis_requests).
5. **IBGE Insights**: Card dedicado com demographic_summary, key_indicators (grid) e relevance.
6. **Exports DOCX**: Incluem Contexto e IBGE além dos demais campos.

RunStepsBlock continua oculto (debug-only).
