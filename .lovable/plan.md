

# PLAN — Adaptar n8n-callback para step patches

---

## 1) PLAN

### Fase 1: Fix build error (pré-requisito)
- **kernel.ts**: Remover chamada a `updateStatus` inexistente em `analyze-campaign/index.ts:461`, pois `startStep` já marca o step como `running`. Alternativa: simplesmente deletar a linha 461.

### Fase 2: Schemas Zod (validation.ts)
- Adicionar `StepUpdatePayloadSchema` que aceita **dois formatos** do n8n:
  - **Formato A** (wrapper): `{ run_id, event_type: "step_update", step_update: { step_kind, status, ... } }`
  - **Formato B** (flat/REST-like): `{ run_id, step_update: { step_kind, status, ... } }` (sem event_type)
  - **Formato C** (direto do PATCH REST atual): `{ status, started_at?, completed_at?, duration_ms?, output_payload?, error_message?, model_used? }` — este será **descartado** no callback (não suportado), pois não traz `run_id` nem `step_kind` no body (estão na URL query).
- Manter `N8nCallbackPayloadSchema` intacto para legado.
- Criar schema unificado `N8nCallbackUnifiedSchema` como `z.union([legado, step_update])`.

### Fase 3: Handler n8n-callback (index.ts)
- Detectar `event_type === "step_update"` ou presença de `step_update` no payload.
- Se flag `N8N_CALLBACK_ENABLE_STEP_UPDATES` !== `"true"`, retornar 200 com `{ ok: true, step_updates_disabled: true }` (aceita mas ignora — não quebra n8n).
- Implementar lógica de state machine para `run_steps`:
  - Buscar step atual por `run_id + step_kind`.
  - Validar transição: `pending→running→completed|failed`. Regressão = resposta idempotente 200 + log.
  - Aplicar update com campos fornecidos.
- Run terminal (`completed|failed`) bloqueia step updates (200 idempotente).

### Fase 4: Secret do callback
- Fonte canônica: `AGORA_CALLBACK_SECRET` (já configurado).
- O n8n usa `X_AGORA_CALLBACK_SECRET` como env var interna — isso é config do n8n, fora de escopo backend. O header HTTP recebido é `x-agora-callback-secret`, que já é o que o backend valida.

### Confirmação: **Nenhuma alteração de workflow n8n é necessária.** O backend passa a aceitar os payloads já emitidos. O único ajuste futuro no n8n seria trocar a URL dos nodes PATCH de `/rest/v1/run_steps` para `/functions/v1/n8n-callback` e usar POST — mas isso é decisão do usuário, fora de escopo.

### Arquivos impactados
| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/validation.ts` | Novos schemas Zod |
| `supabase/functions/n8n-callback/index.ts` | Novo branch step_update |
| `supabase/functions/analyze-campaign/index.ts` | Remover linha 461 (fix build) |
| `supabase/functions/_shared/kernel.ts` | Sem mudanças |

---

## 2) RISKS

| Risco | Severidade | Impacto | Mitigação | Status |
|---|---|---|---|---|
| Quebra de payload legado | Alta | Callback final para de funcionar | Schema union com fallback para legado; testes | Mitigado |
| Inconsistência secret env | Baixa | Falha de auth no n8n | Header canônico `x-agora-callback-secret` já é o validado; env n8n é responsabilidade do usuário | Aceito |
| Race condition de steps | Média | Dois updates simultâneos para mesmo step | State machine unidirecional + idempotência (step terminal = skip) | Mitigado |
| Duplicidade/replay | Média | Step marcado duas vezes | Update idempotente — se já no estado alvo, retorna ok sem reprocessar | Mitigado |
| `agent_id` textual vs UUID | Alta | Insert em `agent_responses` falha (schema exige UUID) | Manter no legado; documentar issue; **não corrigir neste PR** (fora de escopo — é problema do callback final, não dos step patches) | Aceito/documentado |
| Run terminal recebendo step update | Média | Estado inconsistente | Check run status antes de processar step update | Mitigado |
| Flag desativada causa confusão | Baixa | n8n envia mas nada acontece | Resposta explícita `step_updates_disabled: true` | Mitigado |

---

## 3) PATCH

### 3.1 `analyze-campaign/index.ts` — Fix build error
Remover linha 461 (`if (intakeStep) await intakeStep.updateStatus("running");`). O `startStep` já marca como `running`.

### 3.2 `validation.ts` — Novos schemas

```typescript
// Step update sub-schema
const StepUpdateSchema = z.object({
  step_kind: z.enum(["intake", "sociobehavioral", "offer_analysis", "performance_timing", "synthesis"]),
  status: z.enum(["running", "completed", "failed"]),
  started_at: z.string().max(100).optional().nullable(),
  completed_at: z.string().max(100).optional().nullable(),
  duration_ms: z.number().int().nonnegative().optional().nullable(),
  output_payload: z.record(z.unknown()).optional().nullable(),
  error_message: z.string().max(10_000).optional().nullable(),
  model_used: z.string().max(200).optional().nullable(),
  workflow_execution_id: z.string().max(500).optional().nullable(),
  attempt: z.number().int().nonnegative().optional().nullable(),
});

export const N8nStepUpdatePayloadSchema = z.object({
  run_id: z.string().uuid("run_id must be a valid UUID"),
  event_type: z.literal("step_update").optional(),
  step_update: StepUpdateSchema,
});

export type N8nStepUpdatePayload = z.infer<typeof N8nStepUpdatePayloadSchema>;
```

O `N8nCallbackPayloadSchema` legado permanece inalterado.

### 3.3 `n8n-callback/index.ts` — Novo branch

Lógica principal:
1. Parse raw JSON.
2. Se tem `step_update` no payload → validar com `N8nStepUpdatePayloadSchema` → branch step_update.
3. Senão → validar com `N8nCallbackPayloadSchema` → branch legado (código atual).

**Branch step_update:**
```
- Check flag N8N_CALLBACK_ENABLE_STEP_UPDATES
- Fetch run (check exists + not terminal)
- Fetch step by run_id + step_kind
- Validate state transition (VALID_TRANSITIONS map)
- Apply update
- Return { ok, run_id, step_kind, previous_status, new_status }
```

**Mapa de transições válidas:**
```
pending → running, completed, failed
running → completed, failed
completed → (nenhuma — idempotente se mesmo status)
failed → (nenhuma — idempotente se mesmo status)
```

---

## 4) TESTS

| # | Cenário | Input | Resultado esperado |
|---|---|---|---|
| 1 | Secret inválido | Header errado | 401 |
| 2 | Payload inválido | `{ run_id: "not-uuid" }` | 400 |
| 3 | Step `pending→running` | step_update com status running | 200, step atualizado |
| 4 | Step `running→completed` | step_update com status completed | 200, step atualizado |
| 5 | Step duplicado (completed→completed) | Mesmo payload duas vezes | 200, `already_at_status: true` |
| 6 | Step regressivo (completed→running) | step_update running para step completed | 200, `transition_blocked: true`, sem mudança |
| 7 | Callback final legado | Payload legado com status completed + analysis | 200, run e request atualizados |
| 8 | Callback final com run terminal | Legado para run já completed | 200, `already_finalized: true` |
| 9 | Falha global encerrando run | Legado com status failed | 200, run e steps pendentes marcados failed |
| 10 | Flag desativada | step_update com flag off | 200, `step_updates_disabled: true` |
| 11 | Payload do n8n atual (com `step_update` wrapper) | Body igual ao dos nodes PATCH atuais | 200, normalizado e processado |

Testes serão validáveis via `supabase--curl_edge_functions` após deploy.

---

## 5) ROLLOUT

| Etapa | Ação | Critério de promoção |
|---|---|---|
| **Dev** | Deploy com `N8N_CALLBACK_ENABLE_STEP_UPDATES=false` (default) | Build sem erros, testes manuais passam |
| **Staging** | Setar flag `=true`, executar workflow n8n de teste | Steps atualizados corretamente via callback; callback final legado continua funcional |
| **Prod** | Setar flag `=true` | Monitorar logs por 24h — zero erros 500 nos step updates |
| **Rollback** | Setar flag `=false` — step updates são aceitos mas ignorados | 1 passo, sem redeploy |

**Observabilidade:** Cada step update logará `n8n-callback | step_update | run=X | step=Y | prev→new | Xms`.

---

## 6) OPEN QUESTIONS

1. **`agent_id` textual no callback final:** O workflow envia `"intake"`, `"sociobehavioral"` etc., mas o schema Zod exige UUID e a tabela `agent_responses.agent_id` é UUID com FK para `agents.id`. Isso causa falha no insert. **Proposta:** Criar um lookup map `step_kind → agent UUID` dentro do callback, resolvendo automaticamente. Porém, isso exige que os registros existam na tabela `agents`. Preciso de confirmação se os agents já existem no banco ou se devo criar uma migration para populá-los.

2. **Nenhuma outra questão bloqueante.** O build error na linha 461 é corrigido como parte da Fase 1.

