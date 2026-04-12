

# Auditoria Completa: Workflow n8n + Frontend — Plano de Correção

## Situação Atual

O workflow funciona end-to-end (a última run `c96ced5f` completou com todos os 5 steps). Os problemas restantes são de **experiência do usuário** e **resiliência**.

---

## Problema Principal: UI de Progresso Desconectada dos Steps Reais

### Diagnóstico

No `NewAnalysisPage.tsx` (linhas 552-556), a animação dos agentes é baseada em **timers fixos de 5 segundos**:

```text
for (let i = 1; i < agentOrder.length; i++) {
  agentTimers.push(setTimeout(() => setCurrentAgent(i), i * 5000));
}
```

Isso significa que:
- O agente "Sociocomportamental" aparece ativo aos 5s independente do status real
- Se o LLM demorar 15s num step, a UI já mostra outro agente como ativo
- Se falhar num step intermediário, a UI continua animando alegremente

O backend **já envia step_updates em tempo real** (comprovado pelo banco: `run_steps` tem `started_at` e `completed_at` reais). A UI simplesmente não os consome.

### Solução

Substituir os timers fixos por **polling dos `run_steps`** (a mesma infraestrutura de polling que já existe para `analysis_requests`). A cada 3s, consultar `run_steps` da run atual e derivar o `currentAgent` do estado real:

```text
run_steps polling (3s):
  intake=completed → agente 0 done
  socio=running    → agente 1 ativo
  socio=completed  → agente 1 done
  offer=running    → agente 2 ativo
  ...
```

Opcionalmente, usar Realtime no `run_steps` em vez de polling.

---

## Problema Secundário: Error Handler Envia Payload Errado

### Diagnóstico

O nó "Code in JavaScript" (error handler) constrói um objeto com:
```text
{ step_callback: { url, body }, final_callback: { url, body } }
```

Mas o próximo nó "POST n8n-callback failed (legacy)" envia `{{ $json }}` — ou seja, envia o **wrapper inteiro** (com `step_callback` e `final_callback` como chaves), não o `body` do `final_callback`. O backend recebe um payload sem `run_id` no nível raiz e retorna 400.

### Solução (n8n)

Mudar o error handler para gerar dois outputs separados, ou simplificar para enviar direto o payload legacy:

```javascript
return [{
  json: {
    run_id: runId,
    status: "failed",
    error: errorMessage.substring(0, 10000)
  }
}];
```

---

## Outros Problemas Identificados

### 3. URL com Protocolo Duplicado (risco moderado)

Todos os HTTP Request nodes usam:
```text
url: "=https://{{$env.SUPABASE_URL + '/functions/v1/...'}}"
```

Se `SUPABASE_URL` já contém `https://`, a URL final será `https://https://...`. O fato de a última run ter funcionado indica que o valor configurado no n8n **não tem** o prefixo. Mas é frágil — documentar para verificação.

### 4. Webhook sem Respond Node no Happy Path

O workflow usa `responseMode: "responseNode"` mas não tem um "Respond to Webhook" no caminho principal. O fix no `analyze-campaign` (tratar AbortError como sucesso) mitiga isso, mas adicionar um nó "Respond 202" após "Set Context" eliminaria o timeout de 8s e os logs desnecessários.

### 5. Intake marcado como "failed" em runs falhas

Nos dados, runs falhas (ex: `34939393`) mostram `intake` com status `failed` e `socio` com status `running` — isso sugere que o error handler do n8n tentou algo mas não conseguiu atualizar corretamente o run. Consistente com o erro do payload do error handler (problema #2).

---

## Plano de Implementação

### Parte 1 — Frontend: UI reativa aos steps reais

**Arquivo:** `src/pages/app/NewAnalysisPage.tsx`

1. Remover os `setTimeout` timers (linhas 553-556)
2. Adicionar polling de `run_steps` a cada 3 segundos durante o step "processing":
   - Query: `SELECT step_kind, status FROM run_steps WHERE run_id = ? ORDER BY step_order`
   - Derivar `currentAgent` do step mais avançado que esteja `running` ou do último `completed`
3. Mapear `step_kind` → índice do `agentOrder`:
   - `intake` → 0, `sociobehavioral` → 1, `offer_analysis` → 2, `performance_timing` → 3, `synthesis` → 4
4. Precisamos do `run_id` — ele vem na resposta do dispatch (`analyze-campaign` retorna `{ run_id }`). Guardar em state.

### Parte 2 — n8n: Corrigir Error Handler (documento)

Atualizar `/mnt/documents/n8n-workflow-fixes.md` com o Code Node corrigido do error handler que envia diretamente o payload legacy sem wrapper.

### Parte 3 — n8n: Respond to Webhook (documento)

Incluir instrução para adicionar nó "Respond to Webhook" com status 202 logo após "Set Context".

---

## Arquivos Impactados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/app/NewAnalysisPage.tsx` | Substituir timers por polling de `run_steps` |
| `/mnt/documents/n8n-workflow-fixes.md` | Atualizar error handler + Respond 202 |

## O que será preservado

- Contrato do `n8n-callback` (step_update + legacy)
- Realtime subscription em `analysis_requests` (para completed/failed)
- Fallback polling de `analysis_requests`
- Toda a lógica de chat/intake
- Máquina de estados do backend

