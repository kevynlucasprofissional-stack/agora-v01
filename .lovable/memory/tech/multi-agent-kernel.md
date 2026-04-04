# Memory: tech/multi-agent-kernel
Updated: just now

O motor de análise do Ágora utiliza um kernel multiagente com rastreabilidade granular de execução. A orquestração é gerenciada pelo módulo `_shared/kernel.ts` que fornece:
- **KernelRun**: Cria runs em `analysis_runs` e registra steps em `run_steps` com lifecycle individual (pending → running → completed/failed).
- **KernelStep**: Handle por etapa com start/complete/fail independentes, tracking de duração, modelo usado e tokens por step.
- **PIPELINE_STEPS**: 5 etapas definidas — intake, sociobehavioral, offer_analysis, performance_timing, synthesis — cada uma mapeada a um agent_kind.
- **Atribuição por agente**: O output da IA é decomposto e atribuído a cada step com dados de domínio específicos (ex: socio recebe marketing_era + cognitive_biases, offer recebe hormozi_analysis).
- **Compatibilidade**: O contrato de resposta `{ success, analysis }` permanece inalterado. O frontend não precisa de mudanças.
- **Base para evolução**: A arquitetura permite migração incremental para chamadas AI separadas por agente, sem quebra de contrato.
