# Prompt Spec-Driven: Integração Backend ↔ n8n (Orquestração Assíncrona)

> **Versão:** 1.0.0 · **Idioma:** pt-BR · **Status:** pronto para execução

---

## 1. Objetivo

Implementar e validar a integração completa entre o backend Supabase (Edge Functions) e o workflow n8n, garantindo:

- Retorno **202 Accepted** imediato com `run_id` ao cliente.
- Execução assíncrona dos 5 agentes no n8n (`intake`, `sociobehavioral`, `offer_analysis`, `performance_timing`, `synthesis`).
- Atualização em tempo real de `run_steps` e `analysis_runs` via Supabase Realtime.
- Término determinístico: toda run **sempre** finaliza em `completed` ou `failed` — nunca fica presa em `running`.

---

## 2. Escopo / Não Objetivos

### ✅ Escopo desta spec

- Contrato de API: endpoint assíncrono, callback idempotente, `mcp-resource`.
- Segurança de borda: webhook secret, callback secret, bearer MCP, service-role headers.
- Modelo de dados e estados: `analysis_runs`, `run_steps`, `step_kind`.
- Guardrails anti-órfão (watchdog SQL + erro terminal sem run presa).
- Realtime via Supabase: publicação de `run_steps` e `analysis_runs`.
- Observabilidade com logs estruturados.
- Rollout gradual com feature flag `USE_N8N_ASYNC`.

### ❌ Não objetivos

- Implementação de UI/frontend (consumo de Realtime é responsabilidade do cliente).
- Troca de provedor de LLM (usa configuração existente do projeto).
- Autenticação de usuário final (fora do escopo desta integração).

---

## 3. Contratos de API

### 3.1 Endpoint assíncrono — `POST /functions/v1/analyze-campaign`

**Retorno de sucesso (202 Accepted)**

```json
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "run_id": "uuid-v4",
  "status": "processing",
  "message": "Análise iniciada. Acompanhe via Realtime."
}
```

**Payload enviado ao n8n (webhook trigger)**

```json
{
  "run_id": "uuid",
  "analysis_request_id": "uuid",
  "rawPrompt": "...",
  "title": "...",
  "files": [],
  "user_id": "uuid",
  "supabase_url": "https://xxx.supabase.co",
  "triggered_at": "2026-04-08T22:00:00Z"
}
```

> **Regra:** se `run_id` estiver ausente no payload, o workflow falha imediatamente e chama o callback com `status: "failed"`.

---

### 3.2 Callback final — `POST /functions/v1/n8n-callback`

**Idempotência:** se `analysis_runs.status` já for `completed` ou `failed`, retornar `200` com `"already_finalized": true` sem reprocessar.

**Payload — sucesso**

```json
{
  "run_id": "uuid",
  "status": "completed",
  "analysis": {
    "summary": "...",
    "recommendations": []
  },
  "agent_responses": {}
}
```

**Payload — falha**

```json
{
  "run_id": "uuid",
  "status": "failed",
  "error": "Descrição do erro",
  "agent_responses": {}
}
```

**Respostas esperadas**

| Cenário              | HTTP | Body                                      |
|----------------------|------|-------------------------------------------|
| Finalizado com sucesso | 200 | `{"ok": true}`                          |
| Já finalizado (idem) | 200  | `{"ok": true, "already_finalized": true}` |
| Secret inválido      | 401  | `{"ok": false, "error": "unauthorized"}`  |
| `run_id` ausente     | 400  | `{"ok": false, "error": "missing run_id"}`|

---

### 3.3 Recurso MCP — `POST /functions/v1/mcp-resource`

```json
// IBGE
{ "uri": "agora://resources/ibge/SP" }

// Benchmark
{ "uri": "agora://resources/benchmarks/e-commerce" }
```

**Header obrigatório:** `Authorization: Bearer <MCP_RESOURCE_SECRET>`

---

## 4. Segurança

| Ponto                | Mecanismo                                         | Obrigatório |
|----------------------|---------------------------------------------------|-------------|
| Trigger n8n          | `x-agora-webhook-secret: <N8N_INTERNAL_SECRET>`   | ✅          |
| Callback n8n         | `x-agora-callback-secret: <AGORA_CALLBACK_SECRET>`| ✅          |
| Supabase REST (n8n)  | `apikey` + `Authorization: Bearer <SERVICE_ROLE>` | ✅          |
| `mcp-resource`       | `Authorization: Bearer <MCP_RESOURCE_SECRET>`     | ✅          |

### 4.1 Validação do webhook secret (Node 2 — n8n)

```js
// Condição no nó IF
{{ $json.headers["x-agora-webhook-secret"] === $env.N8N_INTERNAL_SECRET }}
```

- **true** → segue fluxo normal.
- **false** → `Respond to Webhook` com HTTP `401`:

```json
{
  "ok": false,
  "error": "unauthorized",
  "message": "invalid webhook secret"
}
```

> **Nunca** usar `anon key` em nós HTTP do n8n que escrevem no Supabase — sempre `service_role`.

---

## 5. Modelo de Dados e Estados

### 5.1 Tabela `analysis_runs`

| Coluna          | Tipo        | Descrição                              |
|-----------------|-------------|----------------------------------------|
| `id`            | `uuid`      | PK                                     |
| `status`        | `text`      | `pending` · `processing` · `completed` · `failed` |
| `error_message` | `text`      | Preenchido quando `status = failed`    |
| `completed_at`  | `timestamptz` | Preenchido quando terminal           |
| `updated_at`    | `timestamptz` | Atualizado a cada transição          |
| `n8n_dispatched`| `boolean`   | `true` após dispatch bem-sucedido ao n8n |

### 5.2 Tabela `run_steps`

| Coluna           | Tipo        | Descrição                              |
|------------------|-------------|----------------------------------------|
| `id`             | `uuid`      | PK                                     |
| `run_id`         | `uuid`      | FK → `analysis_runs.id`                |
| `step_kind`      | `text`      | Ver seção 5.3 — **use `step_kind`, nunca `step_name`** |
| `status`         | `text`      | `pending` · `running` · `completed` · `failed` |
| `started_at`     | `timestamptz` | Preenchido ao entrar em `running`    |
| `completed_at`   | `timestamptz` | Preenchido ao entrar em `completed`/`failed` |
| `duration_ms`    | `integer`   | `completed_at - started_at` em ms      |
| `output_payload` | `jsonb`     | Saída do agente                        |
| `error_message`  | `text`      | Mensagem de erro quando `failed`       |
| `model_used`     | `text`      | Ex.: `gemini-2.5-flash`                |

### 5.3 Valores válidos de `step_kind`

```
intake
sociobehavioral
offer_analysis
performance_timing
synthesis
```

> ⚠️ **Padronização:** usar sempre `step_kind` (não `step_name`) em todos os PATCHs, queries e logs.

### 5.4 Diagrama de estados de `run_steps`

```
pending ──► running ──► completed
                  └──► failed
```

> Nunca pular de `pending` direto para `completed` sem preencher `started_at`.

---

## 6. Guardrails de Falha Anti-Órfão

### 6.1 Regras obrigatórias

1. `analysis_runs` só termina em `completed` ou `failed`.
2. Nenhuma run fica em `running` por mais de **15 minutos** sem heartbeat.
3. Se o dispatch ao n8n falhar:
   - `USE_N8N_ASYNC=true` → fallback sync **ou** fail terminal imediato (definir por flag).
   - `USE_N8N_ASYNC=false` → kernel inline legado.
4. Ramo de erro global no n8n: marca step atual como `failed`, encerra steps pendentes, chama callback `failed`.

### 6.2 Watchdog SQL (cron ou pg_cron)

```sql
-- Auditar runs órfãs (executar periodicamente)
SELECT id, created_at
FROM public.analysis_runs
WHERE status = 'running'
  AND created_at < now() - interval '15 minutes';
```

**Cleanup manual de órfã:**

```sql
UPDATE public.analysis_runs
SET
  status        = 'failed',
  error_message = COALESCE(error_message, 'Watchdog: orphan run finalized'),
  completed_at  = now(),
  updated_at    = now()
WHERE status = 'running'
  AND created_at < now() - interval '15 minutes';

UPDATE public.run_steps
SET
  status        = 'failed',
  error_message = COALESCE(error_message, 'Parent run finalized by watchdog'),
  completed_at  = now(),
  duration_ms   = COALESCE(duration_ms, 0)
WHERE status IN ('pending', 'running')
  AND run_id IN (
    SELECT id FROM public.analysis_runs
    WHERE status = 'failed'
      AND error_message LIKE '%Watchdog%'
  );
```

### 6.3 Ramo de erro global no n8n

```text
[Error Trigger / On Error]
        |
        v
[PATCH run_step atual → failed + error_message]
        |
        v
[POST n8n-callback]
  { "run_id": "...", "status": "failed", "error": "{{ $json.error.message }}" }
```

---

## 7. Requisitos de Realtime

- As tabelas `run_steps` e `analysis_runs` devem estar na **Supabase Realtime publication**.
- O frontend assina o canal e exibe progresso por `run_id`.
- Nenhum polling no cliente — apenas eventos push.

**Verificar publicação:**

```sql
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
-- Deve retornar: analysis_runs, run_steps
```

---

## 8. Observabilidade / Logs Estruturados

Todos os logs (backend e n8n) devem conter:

```json
{
  "run_id": "uuid",
  "step_kind": "intake|sociobehavioral|...",
  "attempt": 1,
  "model_used": "gemini-2.5-flash",
  "tokens_input": 1200,
  "tokens_output": 800,
  "duration_ms": 1540,
  "workflow_execution_id": "n8n-exec-uuid",
  "dispatch_error": null
}
```

> `dispatch_error` preenchido quando o dispatch ao n8n falha — nunca omitir.

---

## 9. Variáveis de Ambiente

### 9.1 Backend (Supabase Edge Functions / `.env`)

| Variável                  | Descrição                                         |
|---------------------------|---------------------------------------------------|
| `SUPABASE_URL`            | URL do projeto Supabase                           |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (nunca expor ao cliente)     |
| `N8N_WEBHOOK_URL`         | URL do webhook n8n (produção)                     |
| `N8N_INTERNAL_SECRET`     | Secret compartilhado backend → n8n               |
| `AGORA_CALLBACK_SECRET`   | Secret validado no callback n8n → backend         |
| `MCP_RESOURCE_SECRET`     | Bearer token para `mcp-resource`                  |
| `USE_N8N_ASYNC`           | `true` \| `false` — feature flag de rollout       |

### 9.2 n8n (credenciais / variáveis de ambiente)

| Variável                    | Descrição                                       |
|-----------------------------|-------------------------------------------------|
| `SUPABASE_URL`              | URL do projeto Supabase                         |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role para escrita em `run_steps`        |
| `N8N_INTERNAL_SECRET`       | Validado no Node 2 (IF secret)                  |
| `AGORA_CALLBACK_SECRET`     | Enviado no header do callback final             |
| `MCP_RESOURCE_SECRET`       | Bearer para `mcp-resource`                      |

---

## 10. Critérios de Aceite E2E

- [ ] **Sucesso completo:** análise real percorre os 5 steps; `analysis_runs.status = completed`; todos `run_steps.status = completed`.
- [ ] **Realtime:** frontend recebe updates sem polling em cada transição de step.
- [ ] **Idempotência do callback:** segundo POST com mesmo `run_id` retorna `already_finalized: true` sem reprocessar.
- [ ] **Falha controlada:** secret errado → 401; run termina `failed`; nenhuma run fica em `running`.
- [ ] **n8n indisponível:** dispatch falha → backend aplica estratégia definida (sem run órfã).
- [ ] **Monitoramento limpo:** query watchdog retorna zero rows de `running` com mais de 15 min.

---

## 11. Plano de Rollout / Rollback

### Rollout gradual

| Etapa | `USE_N8N_ASYNC` | Usuários cobertos  | Critério para avançar          |
|-------|-----------------|--------------------|-------------------------------|
| 0     | `false`         | 0% (legado)        | —                              |
| 1     | `true` (interno)| ~5–10%             | Zero órfãos em 24 h            |
| 2     | `true` (beta)   | ~30%               | Taxa de erro < 1% em 48 h      |
| 3     | `true` (full)   | 100%               | SLA de callback < 30 s (p95)   |

### Rollback

1. Setar `USE_N8N_ASYNC=false` → tráfego retorna ao kernel inline.
2. Rodar SQL watchdog para limpar runs presas.
3. Investigar causa raiz antes de reativar.

---

## 12. Prompt para Lovable

> Copie e execute o bloco abaixo diretamente no Lovable para implementar todas as mudanças.

---

```
Implemente a integração assíncrona backend ↔ n8n seguindo a spec abaixo.
Use TypeScript + Supabase Edge Functions. Não altere arquivos não relacionados.

### CONTRATOS

**analyze-campaign (POST)**
- Retornar 202 imediatamente com { run_id, status: "processing" }.
- Disparar POST para N8N_WEBHOOK_URL com payload:
  { run_id, analysis_request_id, rawPrompt, title, files, user_id, supabase_url, triggered_at }
- Header: x-agora-webhook-secret: <N8N_INTERNAL_SECRET>
- Se USE_N8N_ASYNC=false, usar kernel inline legado.
- Se dispatch falhar: registrar dispatch_error e retornar 500 (sem run órfã).

**n8n-callback (POST)**
- Validar header x-agora-callback-secret.
- Idempotência: se analysis_runs.status já for terminal, retornar 200 { already_finalized: true }.
- Atualizar analysis_runs: status, completed_at, error_message.
- Espelhar resultado em analysis_requests (campo analysis).

**mcp-resource (POST)**
- Validar Bearer MCP_RESOURCE_SECRET.
- Retornar dados de IBGE ou benchmark conforme uri recebida.

### MODELO DE DADOS

Tabela run_steps:
- step_kind TEXT — valores: intake | sociobehavioral | offer_analysis | performance_timing | synthesis
- NUNCA usar step_name — sempre step_kind.
- Transição de estado: pending → running → completed | failed.
- Preencher started_at ao entrar em running; completed_at e duration_ms ao terminar.

### SEGURANÇA

- Supabase REST no n8n: sempre apikey + Authorization: Bearer SERVICE_ROLE.
- Nunca usar anon key em escrita.
- Todos os secrets via variáveis de ambiente (nunca hardcoded).

### GUARDRAILS

- Se dispatch ao n8n falhar: run termina failed imediatamente (sem stuck em processing).
- Criar watchdog SQL ou pg_cron para finalizar runs em running por > 15 min.
- Ramo de erro global no n8n: PATCH step atual = failed + POST callback failed.

### REALTIME

- Confirmar que analysis_runs e run_steps estão na supabase_realtime publication.
- Frontend assina por run_id sem polling.

### OBSERVABILIDADE

- Logs estruturados em JSON com: run_id, step_kind, attempt, model_used,
  tokens_input, tokens_output, duration_ms, workflow_execution_id, dispatch_error.

### VARIÁVEIS DE AMBIENTE (backend)

SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, N8N_WEBHOOK_URL,
N8N_INTERNAL_SECRET, AGORA_CALLBACK_SECRET, MCP_RESOURCE_SECRET, USE_N8N_ASYNC

### CRITÉRIOS DE ACEITE

1. analyze-campaign retorna 202 consistentemente.
2. n8n processa os 5 steps e atualiza run_steps em tempo real.
3. analysis_runs sempre termina em completed ou failed.
4. Callback duplicado retorna already_finalized: true.
5. n8n down → sem run órfã.
6. Query watchdog retorna zero rows de running > 15 min.
```

---

*Documento gerado em 2026-04-08 — mantenha esta spec como fonte de verdade para revisões futuras.*
