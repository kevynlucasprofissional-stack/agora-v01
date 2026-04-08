# Changelog — Ágora: Integração Assíncrona n8n

> Baseado na spec `docs/prompts/n8n-integration-spec-driven.md` v1.0.0

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
