# Memory: tech/mcp-layer
Updated: just now

O Ágora possui uma camada MCP-ready interna em `supabase/functions/_shared/mcp/` com:
- **Catálogo de Tools**: 8 ferramentas registradas (analyze_campaign, generate_creative, generate_image, generate_campaign, audience_insights, compare_campaigns, strategist_chat, campaign_chat) com schemas tipados.
- **Reality Layer (Resources)**: 5 recursos registrados — IBGE/SIDRA (demographic), benchmarks por indústria (benchmark), perfis geracionais (benchmark), contexto empresarial (enterprise, plan-gated), templates de criativos (template, plan-gated).
- **Catálogo de Prompts**: 8 prompts versionados mapeados aos agent_kinds do kernel multiagente.
- **Integração**: `analyze-campaign` já consome benchmarks da Reality Layer. IBGE continua integrado via `_shared/ibge.ts`.
- **Arquitetura**: Singleton `catalog` com auto-init no import. Contratos tipados via `types.ts`. Preparado para futura exposição como MCP server real.
