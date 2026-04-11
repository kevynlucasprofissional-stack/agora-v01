# Changelog — Ágora: Integração Assíncrona n8n

> Baseado na spec `docs/prompts/n8n-integration-spec-driven.md` v1.0.0

---

## [1.2.0] — 2026-04-10

### 🚀 Novas Funcionalidades

#### Step Updates Incrementais via `n8n-callback`

O endpoint `POST /functions/v1/n8n-callback` agora suporta **dois modos simultâneos**:

1. **Legado (inalterado):** callback final com `status: completed|failed`, `analysis`, `error`, `agent_responses`.
2. **Novo — Step Update:** eventos incrementais de progresso para `run_steps`, enviados pelo n8n sem necessidade de PATCH direto no banco.

O novo modo é governado pela feature flag `N8N_CALLBACK_ENABLE_STEP_UPDATES` (default: `"false"` — aceita mas ignora).

---

### 📁 Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/validation.ts` | Novos schemas Zod: `StepUpdateSchema`, `N8nStepUpdatePayloadSchema` |
| `supabase/functions/n8n-callback/index.ts` | Refatorado em dois handlers (`handleStepUpdate` + `handleLegacyCallback`), roteamento automático |
| `supabase/functions/analyze-campaign/index.ts` | Removida chamada inválida `intakeStep.updateStatus("running")` (linha 461) — fix de build error |

---

### 🔒 Feature Flag

| Secret | Valor padrão | Comportamento |
|---|---|---|
| `N8N_CALLBACK_ENABLE_STEP_UPDATES` | `"false"` | Quando `false`: step updates são aceitos (200) mas ignorados. Quando `"true"`: step updates são processados e persistidos em `run_steps`. |

**Rollback:** setar para `"false"` — 1 passo, sem redeploy.

---

### 📋 Contratos de Payload

#### A) Step Update — Payload do n8n para o callback

```
POST /functions/v1/n8n-callback
Headers:
  Content-Type: application/json
  x-agora-callback-secret: <valor de AGORA_CALLBACK_SECRET>
```

**Body (exemplo — marcar step como running):**

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "event_type": "step_update",
  "step_update": {
    "step_kind": "intake",
    "status": "running",
    "started_at": "2026-04-10T15:00:00.000Z"
  }
}
```

**Body (exemplo — marcar step como completed com métricas):**

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "event_type": "step_update",
  "step_update": {
    "step_kind": "sociobehavioral",
    "status": "completed",
    "started_at": "2026-04-10T15:00:00.000Z",
    "completed_at": "2026-04-10T15:00:12.345Z",
    "duration_ms": 12345,
    "model_used": "gemini-2.5-pro",
    "tokens_input": 4500,
    "tokens_output": 2100,
    "output_payload": {
      "cognitive_biases": ["anchoring", "social_proof"],
      "score": 78
    }
  }
}
```

**Body (exemplo — marcar step como failed):**

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "step_update": {
    "step_kind": "offer_analysis",
    "status": "failed",
    "error_message": "Gemini API timeout after 30s",
    "duration_ms": 30000
  }
}
```

> **Nota:** `event_type: "step_update"` é opcional. A detecção é feita pela presença do campo `step_update` no body.

#### Valores válidos para `step_kind`:

| step_kind | Descrição |
|---|---|
| `intake` | Processamento inicial do prompt |
| `sociobehavioral` | Análise sociocomportamental |
| `offer_analysis` | Engenharia de oferta |
| `performance_timing` | Análise de performance e timing |
| `synthesis` | Síntese final do chief strategist |
| `image_generation` | Geração de imagens |
| `post_processing` | Pós-processamento |

#### Valores válidos para `status`:

`running` | `completed` | `failed`

---

#### Respostas do Step Update

**Sucesso (transição aplicada — ex: `pending→running`):**
```json
{
  "ok": true,
  "run_id": "uuid",
  "step_kind": "intake",
  "previous_status": "pending",
  "new_status": "running",
  "started_at": "2026-04-10T14:30:00.000Z"
}
```

> **Nota:** `started_at` é retornado sempre que a transição envolve o status `running`. Se o payload de entrada não fornecer `started_at`, o backend gera automaticamente um timestamp ISO 8601. Use este valor no node seguinte do n8n para calcular `duration_ms`.

**Idempotente (já no status alvo):**
```json
{
  "ok": true,
  "already_at_status": true,
  "run_id": "uuid",
  "step_kind": "intake",
  "status": "completed"
}
```

**Transição bloqueada (regressão):**
```json
{
  "ok": true,
  "transition_blocked": true,
  "run_id": "uuid",
  "step_kind": "intake",
  "previous_status": "completed",
  "requested_status": "running"
}
```

**Flag desativada:**
```json
{
  "ok": true,
  "step_updates_disabled": true,
  "run_id": "uuid",
  "step_kind": "intake"
}
```

**Run já terminal:**
```json
{
  "ok": true,
  "run_terminal": true,
  "run_status": "completed",
  "run_id": "uuid",
  "step_kind": "intake"
}
```

---

#### B) Callback Final Legado (inalterado)

```
POST /functions/v1/n8n-callback
Headers:
  Content-Type: application/json
  x-agora-callback-secret: <valor de AGORA_CALLBACK_SECRET>
```

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "completed",
  "analysis": {
    "score_overall": 82,
    "score_sociobehavioral": 78,
    "score_offer": 85,
    "score_performance": 80,
    "executive_summary": "...",
    "improvements": [...],
    "strengths": [...],
    "audience_insights": {...},
    "market_references": [...],
    "marketing_era": "...",
    "cognitive_biases": [...],
    "hormozi_analysis": {...},
    "kpi_analysis": {...},
    "timing_analysis": {...},
    "brand_sentiment": {...},
    "ibge_insights": {...},
    "industry": "varejo",
    "primary_channel": "instagram",
    "declared_target_audience": "Mulheres 25-35",
    "region": "SP"
  },
  "agent_responses": [
    {
      "agent_id": "uuid-do-agent",
      "analysis_request_id": "uuid-da-request",
      "content": { "score": 78 },
      "content_text": "Resumo textual...",
      "response_format": "json",
      "success": true,
      "model_name": "gemini-2.5-pro",
      "latency_ms": 5000,
      "tokens_input": 3000,
      "tokens_output": 1500
    }
  ]
}
```

---

### 🔄 Máquina de Estados — Transições Válidas de `run_steps`

```
pending  → running, completed, failed
running  → completed, failed
completed → (nenhuma — idempotente se mesmo status)
failed    → (nenhuma — idempotente se mesmo status)
```

Tentativas de regressão (ex: `completed → running`) retornam `200 OK` com `transition_blocked: true`, sem alterar o banco.

---

### 🐛 Fix — Build Error

- **Causa raiz:** `analyze-campaign/index.ts:461` chamava `intakeStep.updateStatus("running")`, mas `KernelStep` não expõe esse método — `startStep()` já marca como `running`.
- **Correção:** linha removida, substituída por comentário explicativo.

---

### ⚠️ Questões em aberto (não bloqueantes)

1. **`agent_id` textual no callback final:** O workflow n8n envia `"intake"`, `"sociobehavioral"` etc. como `agent_id`, mas a tabela `agent_responses.agent_id` é UUID com FK para `agents.id`. Isso causa falha no insert de `agent_responses`. Requer lookup map ou migration para resolver.

---

### ✅ Validações Realizadas

| # | Cenário | Resultado |
|---|---|---|
| 1 | Secret inválido → 401 | ✅ |
| 2 | Deploy limpo sem erros de build | ✅ |
| 3 | Flag `N8N_CALLBACK_ENABLE_STEP_UPDATES` criada | ✅ |
| 4 | Callback legado preservado (sem breaking changes) | ✅ |
| 5 | Roteamento automático por presença de `step_update` | ✅ |

---

## [1.1.0] — 2026-04-08

### 🚀 Novas Funcionalidades

#### Feature Flag `USE_N8N_ASYNC` — Caminho Legado Inline Restaurado
- **Arquivo:** `supabase/functions/analyze-campaign/index.ts`
- Quando `USE_N8N_ASYNC=false`, a função executa análise síncrona via `runInlineAnalysis()` usando Gemini com tool calling (`analysis_result`).
- Retorna `200 OK` com resultado completo (scores, melhorias, pontos fortes, insights de audiência).
- Pipeline inline percorre todos os 5 steps do kernel (`intake`, `sociobehavioral`, `offer_analysis`, `performance_timing`, `synthesis`) e marca cada um como `completed`.
- Persiste scores (`score_overall`, `score_sociobehavioral`, `score_offer`, `score_performance`) e `normalized_payload` diretamente em `analysis_requests`.
- Em caso de falha, marca `analysis_runs` e `analysis_requests` como `failed` com mensagem de erro.

### ✅ Validações Realizadas

| Teste | Resultado |
|-------|-----------|
| `USE_N8N_ASYNC=false` → inline Gemini | ✅ 200 OK com análise completa |
| `USE_N8N_ASYNC=true` → dispatch n8n | ✅ 202 Accepted (ou 500 se n8n não configurado) |
| Alternância de flag via secrets | ✅ Confirmado |
| Scores persistidos em `analysis_requests` | ✅ Confirmado |
| Fallback de erro no inline path | ✅ `failed` em runs e requests |

---

## [1.0.0] — 2026-04-08

### 🚀 Novas Funcionalidades

#### Feature Flag `USE_N8N_ASYNC`
- **Arquivo:** `supabase/functions/analyze-campaign/index.ts`
- Default `true`; se `false`, usa o kernel inline legado.
- Permite rollout gradual (spec §11) sem risco para produção.

#### Watchdog Anti-Órfão (`finalize_orphan_runs`)
- **Tipo:** Migration SQL (função `public.finalize_orphan_runs()`)
- Finaliza automaticamente runs em `running` há mais de 15 minutos como `failed`.
- Também marca `run_steps` pendentes/running como `failed`.
- Pode ser executado via `SELECT public.finalize_orphan_runs();` ou futuro pg_cron.

#### Realtime: `analysis_runs` adicionada à publicação
- **Tipo:** Migration SQL
- Tabelas agora na publicação `supabase_realtime`: `analysis_requests`, `analysis_runs`, `run_steps`.
- Frontend recebe updates em tempo real de todas as tabelas relevantes.

---

### 🔧 Alterações (Breaking Changes: Nenhuma)

#### `analyze-campaign/index.ts` — Reescrito conforme spec §3.1
- **Retorno:** sempre `202 Accepted` com `{ run_id, analysis_request_id, status: "processing", message }`.
- **Sem retorno síncrono 200** no caminho assíncrono.
- **Dispatch failure → fail terminal imediato:** se o webhook n8n falhar, a run e o analysis_request são marcados como `failed` (sem órfã). Retorna `500` com `category: "integration"`.
- **`analysisRequestId` obrigatório:** retorna `400` se ausente.
- **Logs estruturados em JSON** (spec §8): `run_id`, `step_kind`, `attempt`, `dispatch_error`, `n8n_dispatched`.
- **Payload estável ao n8n** via interface `N8nPayload`: `run_id`, `analysis_request_id`, `rawPrompt`, `title`, `files[]`, `user_id`, `supabase_url`, `triggered_at`.
- **Erro HTTP capturado:** dispatch que retorna status não-ok agora inclui `HTTP {status}` no `dispatch_error`.

#### `n8n-callback/index.ts` — Alinhado ao contrato spec §3.2
- **Idempotência:** runs já finalizadas retornam `{ ok: true, already_finalized: true }` em vez de `{ message: "already finalized" }`.
- Validação Zod centralizada via `_shared/validation.ts`.

#### `_shared/errors.ts` — Nova categoria de erro
- Adicionado `"kernel"` ao tipo `ErrorCategory`.

#### `_shared/validation.ts` — Schemas Zod hardened
- `N8nCallbackPayloadSchema`: validação UUID para `run_id`, `agent_id`, `analysis_request_id`.
- `AgentResponseSchema`: limites de tamanho (`content_text` max 500k, arrays max 50).
- Constraints numéricas: `tokens_*` e `latency_ms` são `int().nonnegative()`.

#### `cleanup-expired-images/index.ts` — Fix de tipo
- `catch (error)` → `catch (error: unknown)` com type guard `instanceof Error`.

---

### ✅ Validações Realizadas

| Teste | Resultado |
|-------|-----------|
| Deploy `analyze-campaign` | ✅ Sucesso |
| Deploy `n8n-callback` | ✅ Sucesso |
| Deploy `cleanup-expired-images` | ✅ Sucesso |
| Callback com secret errado → 401 | ✅ Confirmado |
| Realtime publication (3 tabelas) | ✅ Confirmado |
| Análise E2E via frontend | ✅ Dispatch correto, 500 esperado (n8n não configurado) |
| Logs estruturados no dispatch | ✅ JSON com `run_id`, `step_kind`, `dispatch_error` |

---

### 📋 Pendências para Produção

- [ ] Configurar `N8N_WEBHOOK_URL` com URL real do workflow n8n.
- [ ] Configurar `N8N_INTERNAL_SECRET` e `AGORA_CALLBACK_SECRET` nos secrets.
- [ ] Criar workflow n8n com os 5 steps (intake → sociobehavioral → offer_analysis → performance_timing → synthesis).
- [ ] Configurar pg_cron para executar `SELECT public.finalize_orphan_runs()` a cada 5 minutos.
- [ ] Testar callback E2E com análise mock completa.

---

### 🗂️ Arquivos Alterados

| Arquivo | Tipo |
|---------|------|
| `supabase/functions/analyze-campaign/index.ts` | Reescrito |
| `supabase/functions/n8n-callback/index.ts` | Editado |
| `supabase/functions/_shared/errors.ts` | Editado |
| `supabase/functions/_shared/validation.ts` | Editado |
| `supabase/functions/cleanup-expired-images/index.ts` | Editado |
| Migration SQL | Novo (Realtime + Watchdog) |
| `docs/CHANGELOG.md` | Novo |

---

### 🔒 Preservado (sem alteração)

- Frontend (`NewAnalysisPage.tsx`, `AnalysisReportPage.tsx`)
- Todas as edge functions de chat (`intake-chat`, `strategist-chat`, `comparator-chat`, `campaign-chat`)
- `mcp-resource`, `generate-creative`, `generate-image`
- Schemas de banco existentes
- RLS policies existentes
- `src/integrations/supabase/client.ts` e `types.ts`
