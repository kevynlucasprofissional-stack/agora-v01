# Memory: index.md
Updated: now

Design system: dark matte ceramic theme, Archivo display + Public Sans body, HSL tokens in index.css. Primary: electric blue 220 80% 55%. Success: mint 155 50% 55%. Warning: amber 40 80% 60%.

DB: Full SQL schema with plans, profiles, analysis_requests, agents, agent_responses, files, generated_outputs, analysis_feedback, external_integrations, daily_usage_counters, creative_jobs, conversations, chat_messages. All with RLS.

Routes: Public (/, /login, /pricing, /forgot-password, /reset-password). App (/app, /app/new-analysis, /app/analyses, /app/conversations, /app/history, /app/analysis/:id/report, /app/analysis/:id/chat, /app/assets, /app/account, /app/settings, /app/integrations).

Sidebar: Dashboard, Nova Análise, Análises (results), Conversas (history without analysis), Biblioteca, Conta, Configurações.

Auth: AuthProvider with profile+plan context. ProtectedRoute guard. Auto-profile creation on signup via DB trigger.

Plan access: usePlanAccess hook checks plan features. Enterprise-only integrations page.

Creative editor: Canva-like inline editor with drag, resize, color, shadow. Persists to creative_jobs. Renders inline in chat via [creative-editor] marker.

History split: "Análises" = analysis_requests results. "Conversas" = conversations where analysis_request_id IS NULL.
