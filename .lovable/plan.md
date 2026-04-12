

# Corrigir Code Nodes para n8n 2.x

## Problema
Os 4 Code Nodes usam `$items('NODE', 0, 0)` que foi removido no n8n 2.x. A API correta é `$('NODE').first().json`.

## Mudança necessária
Regenerar os 4 arquivos JS (`n8n-code-node-socio.js`, `n8n-code-node-offer.js`, `n8n-code-node-performance.js`, `n8n-code-node-synthesis.js`) substituindo todas as ocorrências de:

| Padrão antigo (n8n 1.x) | Padrão correto (n8n 2.x) |
|---|---|
| `$items('NODE', 0, 0)[0].json` | `$('NODE').first().json` |
| `$items('NODE', 0, 0)` | `$('NODE').all()` |

## Nomes dos nós (baseados no screenshot do workflow)
Cada Code Node referencia 3 nós upstream:
- **Socio**: `LLM SOCIO`, `POST socio running`, `Set Context`
- **Offer**: `LLM OFFER`, `POST offer running`, `Set Context`
- **Performance**: `LLM PERFORMANCE`, `POST performance running`, `Set Context`
- **Synthesis**: `LLM SYNTHESIS` (ou equivalente), `POST synthesis running`, `Set Context`

## Entrega
Arquivo consolidado em `/mnt/documents/n8n-code-nodes-v2.md` com os 4 scripts corrigidos, prontos para copiar e colar no n8n.

## O que será preservado
- Toda a lógica de sanitização (remoção de markdown fences, JSON.parse seguro)
- Cálculo de `duration_ms` e `completed_at`
- Estrutura do `output_payload` por agente
- Contrato do `n8n-callback` inalterado

