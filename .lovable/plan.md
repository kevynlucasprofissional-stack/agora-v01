

# Corrigir Code Node do Synthesis — Alinhar ao Prompt

## Problema
O Code Node atual cobre apenas 7 de 19 campos do prompt, inclui 5 campos inexistentes, e tem um bug de typo em `strengths`.

## Mudança
Regenerar o script do Synthesis no arquivo `/mnt/documents/n8n-code-nodes-v2.md` com o `output_payload` corrigido:

```javascript
output_payload: {
  // Scores
  score_overall: parsed.score_overall ?? null,
  score_sociobehavioral: parsed.score_sociobehavioral ?? null,
  score_offer: parsed.score_offer ?? null,
  score_performance: parsed.score_performance ?? null,
  // Textuais
  executive_summary: parsed.executive_summary ?? null,
  improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
  strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
  audience_insights: Array.isArray(parsed.audience_insights) ? parsed.audience_insights : [],
  market_references: Array.isArray(parsed.market_references) ? parsed.market_references : [],
  // Objetos analíticos
  marketing_era: parsed.marketing_era ?? null,
  cognitive_biases: Array.isArray(parsed.cognitive_biases) ? parsed.cognitive_biases : [],
  hormozi_analysis: parsed.hormozi_analysis ?? null,
  kpi_analysis: parsed.kpi_analysis ?? null,
  timing_analysis: parsed.timing_analysis ?? null,
  brand_sentiment: parsed.brand_sentiment ?? null,
  ibge_insights: parsed.ibge_insights ?? null,
  // Contextuais
  industry: parsed.industry ?? null,
  primary_channel: parsed.primary_channel ?? null,
  declared_target_audience: parsed.declared_target_audience ?? null,
  region: parsed.region ?? null
}
```

## O que será removido
- `key_recommendations`, `weaknesses`, `opportunities`, `threats`, `industry_data` (campos fantasma)

## O que será preservado
- Suporte híbrido (tool call vs texto)
- Cálculo de `duration_ms` e timestamps
- Estrutura do `_final_callback`
- Referências a `LLM SYNTHESIS`, `POST synthesis running`, `Set Context`

## Entrega
Arquivo atualizado em `/mnt/documents/n8n-code-nodes-v2.md` com o script corrigido.

