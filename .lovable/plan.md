

# Auditoria do Workflow n8n vs Backend — Erros e Plano de Correção

## Erros Encontrados

### CRÍTICO — Quebram o fluxo

**1. Code Nodes dos agentes individuais não mapeiam todos os campos do prompt**

| Agent | Code Node | Campo do Prompt | Campo no Code Node | Problema |
|-------|-----------|-----------------|---------------------|----------|
| SOCIO | `Code in JavaScript` | `score_sociobehavioral` | `score` | Nome errado |
| SOCIO | | `marketing_era` (objeto) | — | Ausente |
| SOCIO | | `audience_insights` (array) | — | Ausente |
| SOCIO | | `brand_sentiment` (objeto) | — | Ausente |
| OFFER | `Code in JavaScript1` | `score_offer` | `score` | Nome errado |
| OFFER | | `hormozi_analysis.overall_value` | `value_equation_score`, `improvements`, `strengths` | Sub-campos errados (prompt pede `overall_value` string, code espera campos inexistentes) |
| OFFER | | `diagnostics` | — | Ausente (prompt pede, code ignora) |
| PERF | `Code in JavaScript2` | `score_performance` | `score` | Nome errado |
| PERF | | `kpi_analysis.recommended_north_star` | `north_star_metric` | Nome errado |
| PERF | | `kpi_analysis.recommended_kpis` | `kpis` | Nome errado |
| PERF | | `timing_analysis.demand_momentum` | `momentum_score` | Tipo e nome errados (prompt: string, code: number) |
| PERF | | `timing_analysis.context_shock` | `external_shocks` (array) | Tipo e nome errados (prompt: string, code: array) |

Estes erros significam que o `output_payload` de cada step intermediário salvo em `run_steps` está incompleto ou com nomes incorretos. Embora o **callback final** use o SYNTHESIS PARSE (que já está correto), se alguma feature futura ler `run_steps.output_payload` dos agentes individuais, os dados estarão errados.

**2. Error Handler — `step_kind: "error_handling"` não existe no enum Zod**

O schema Zod aceita: `intake`, `sociobehavioral`, `offer_analysis`, `performance_timing`, `synthesis`, `image_generation`, `post_processing`. O valor `"error_handling"` será rejeitado com 400. O error handler falha silenciosamente.

**3. Error Handler — JSON inválido no body**

```json
"run_id": $json.run_id,        // ← falta aspas
"error_message": $json.error_message  // ← falta aspas
```

Isso gera JSON malformado. O callback receberá um parse error.

**4. Error Handler — Header inconsistente**

Os nós do happy path usam `$env.X_AGORA_CALLBACK_SECRET`, mas os nós de erro usam `$env.AGORA_CALLBACK_SECRET`. Se forem variáveis diferentes, os callbacks de erro retornam 401.

**5. Webhook `responseMode: "responseNode"` sem Respond node no happy path**

O webhook está configurado com `responseMode: "responseNode"`, o que exige um nó `Respond to Webhook` no fluxo. Só existe o `Respond 401` no caminho de erro. No happy path, o `analyze-campaign` edge function ficará pendurado por 8 segundos até dar timeout. Isso não é fatal (o dispatch usa `AbortController` com 8s), mas desperdiça tempo e gera logs de timeout desnecessários.

### MODERADO — Funciona mas gera risco

**6. URL com protocolo duplicado**

```
url: "=https://{{$env.SUPABASE_URL + '/functions/v1/...'}}"
```

Se `SUPABASE_URL` já contém `https://` (que é o padrão), o resultado será `https://https://aqrcjvtidgxpjhjozwct.supabase.co/functions/v1/...`. Isso quebrará todas as chamadas HTTP (MCP IBGE, MCP Benchmark, e todos os callbacks). **Verifique o valor da variável no n8n.** Se o valor já tem `https://`, remova o prefixo dos nós.

**7. `POST intake completed` — usa JSON textual interpolado**

```json
"jsonBody": "={\n  \"run_id\": \"{{ $('Set Context')... }}\",\n..."
```

Funciona para campos simples (strings, números), mas é frágil. Não é erro agora, mas seria se campos complexos fossem adicionados ao intake no futuro.

## Plano de Correção

### Parte 1 — Correções no Workflow n8n (fora do código)

**1a.** Corrigir os 3 Code Nodes dos agentes para mapear exatamente os campos dos prompts:

- **SOCIO**: adicionar `marketing_era`, `audience_insights`, `brand_sentiment`; renomear `score` para `score_sociobehavioral`
- **OFFER**: renomear `score` para `score_offer`; corrigir sub-campos de `hormozi_analysis` (`overall_value` em vez de `value_equation_score`/`improvements`/`strengths`); adicionar `diagnostics`
- **PERF**: renomear `score` para `score_performance`; corrigir nomes em `kpi_analysis` e `timing_analysis` para alinhar ao prompt

**1b.** Corrigir Error Handler:
- Converter os 2 nós HTTP Request de erro para usar Code Nodes que constroem o JSON programaticamente
- Unificar o nome da variável de secret para `X_AGORA_CALLBACK_SECRET`

**1c.** Adicionar Respond to Webhook no happy path (logo após Set Context) para desbloquear o caller imediatamente:
```
Set Context → Respond 202 → MCP IBGE/Benchmark (continua assíncrono)
```

**1d.** Verificar e corrigir o prefixo `https://` duplicado nas URLs.

### Parte 2 — Correção no Backend (dentro do código)

**2a.** Adicionar `"error_handling"` ao enum `step_kind` em `validation.ts` para que o error handler do n8n não seja rejeitado pelo Zod. Alternativa: usar um step_kind existente no error handler. A opção mais limpa é adicionar ao enum.

### Parte 3 — Entregável

Gerar um documento `/mnt/documents/n8n-workflow-fixes.md` com:
- Os 3 Code Nodes corrigidos (SOCIO, OFFER, PERF) prontos para colar
- O Code Node do Error Handler corrigido
- Instruções de configuração do Respond 202
- A migration do `step_kind` enum

## Arquivos impactados no repositório
- `supabase/functions/_shared/validation.ts` — adicionar `"error_handling"` ao enum

## O que será preservado
- Contrato do `n8n-callback` (legacy e step_update)
- SYNTHESIS PARSE e Code in JavaScript3 (já estão corretos)
- Máquina de estados e idempotência
- Validação defensiva contra `[object Object]`

