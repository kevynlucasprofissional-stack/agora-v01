
Objetivo: corrigir o fluxo do `step_update completed` do `sociobehavioral` sem mexer no contrato do callback, resolvendo a serialização inválida de `cognitive_biases`.

1. Causa raiz
- O erro acontece no n8n antes da requisição sair.
- O node HTTP Request está montando o body como texto JSON com `{{ }}` embutido.
- Quando uma expressão retorna array/objeto dentro desse JSON textual, o n8n faz coerção para string e gera:
  ```text
  [object Object],[object Object],...
  ```
- O backend espera `step_update.output_payload` como objeto JSON real. Isso está confirmado no schema atual:
  - `supabase/functions/_shared/validation.ts` → `output_payload: z.record(z.unknown()).optional().nullable()`
  - `supabase/functions/n8n-callback/index.ts` → persiste `step_update.output_payload` diretamente em `run_steps.output_payload`
- Portanto, o problema não é do callback em si; é a montagem do body no workflow.

2. Ajuste proposto no n8n
- Substituir a montagem manual do JSON no HTTP Request por um Code node imediatamente antes do callback.
- Esse Code node deve:
  1. ler o texto bruto do LLM,
  2. remover fences de markdown,
  3. fazer `JSON.parse(...)`,
  4. montar o payload completo como objeto JavaScript,
  5. retornar esse objeto em `json`.

Fluxo sugerido:
```text
LLM SOCIO
   -> Code node: Parse socio output + build callback payload
   -> HTTP Request: POST n8n-callback com body = {{$json}}
```

3. Estrutura que o Code node deve retornar
```text
{
  run_id,
  event_type: "step_update",
  step_update: {
    step_kind: "sociobehavioral",
    status: "completed",
    started_at,
    completed_at,
    duration_ms,
    model_used,
    tokens_input,
    tokens_output,
    output_payload: {
      cognitive_biases: parsed.cognitive_biases ?? [],
      score: parsed.score_sociobehavioral ?? null
    }
  }
}
```

4. Observação importante sobre seu payload atual
- Isto aqui é exatamente o ponto que quebra:
  ```text
  "cognitive_biases": {{ $json.step_update.output_payload.cognitive_biases }}
  ```
- Dentro de JSON textual, isso não preserva array de objetos.
- O mesmo vale para qualquer campo complexo futuro, como `marketing_era`, `audience_insights`, `brand_sentiment`, etc.

5. Implementação segura
- No Code node, centralizar:
  - parse do texto do modelo,
  - cálculo de `completed_at`,
  - cálculo de `duration_ms`,
  - montagem de `output_payload`.
- No HTTP Request:
  - não escrever JSON “na mão” com blocos `{{ }}`
  - enviar o objeto inteiro vindo do node anterior.

6. Ajuste opcional no backend
Para evitar esse tipo de depuração difícil no futuro, posso depois aplicar um endurecimento localizado no callback:
- `supabase/functions/_shared/validation.ts`
- `supabase/functions/n8n-callback/index.ts`

Melhoria proposta:
- rejeitar `output_payload` inválido com erro 400 descritivo quando vier string/coerção tipo `[object Object]`
- preservar o contrato atual de resposta e a máquina de estados existente

7. Arquivos impactados
Obrigatório:
- workflow n8n do `sociobehavioral` (fora do repositório)

Opcional, se você quiser blindagem adicional no projeto:
- `supabase/functions/_shared/validation.ts`
- `supabase/functions/n8n-callback/index.ts`
- teste dedicado do callback para payload inválido

8. O que será preservado
- contrato atual do `n8n-callback`
- transições `pending -> running -> completed/failed`
- persistência atual em `run_steps.output_payload`
- compatibilidade com frontend e polling/realtime já existentes
- sem refactor global

9. Checklist de validação manual
- Executar o node de parse e confirmar que `cognitive_biases` aparece como array real no output do Code node
- Confirmar que o HTTP Request envia body como objeto, não como JSON textual interpolado
- Verificar resposta 200 do callback
- Verificar em `run_steps.output_payload` que `cognitive_biases` foi salvo como JSONB válido
- Repetir o teste com pelo menos um campo complexo extra além de `cognitive_biases`

10. Próxima implementação que farei ao aprovar
- te entrego o Code node exato para colar no n8n
- e, se quiser, também adiciono a validação defensiva no callback para retornar erro 400 claro em vez desse cenário quebrar silenciosamente no fluxo
