Design system: dark matte ceramic theme, Archivo display + Public Sans body, HSL tokens in index.css. Primary: electric blue 220 80% 55%. Success: mint 155 50% 55%. Warning: amber 40 80% 60%.

DB: Full SQL schema with plans, profiles, analysis_requests, agents, agent_responses, files, generated_outputs, analysis_feedback, external_integrations, daily_usage_counters. All with RLS.

Routes: Public (/, /login, /pricing, /forgot-password, /reset-password). App (/app, /app/new-analysis, /app/history, /app/analysis/:id/report, /app/analysis/:id/chat, /app/analysis/:id/campaign, /app/assets, /app/account, /app/settings, /app/integrations).

Auth: AuthProvider with profile+plan context. ProtectedRoute guard. Auto-profile creation on signup via DB trigger.

Plan access: usePlanAccess hook checks plan features. Enterprise-only integrations page.

Agent processing: Currently simulated with mock scores. Ready for real edge function integration.

Edge functions: intake-chat (intake conversation), generate-campaign (generates improved campaign doc), campaign-chat (edits campaign doc via chat). All use Lovable AI gateway.

Trial: 15 days Standard plan for new signups. profiles.trial_ends_at + profiles.original_plan_id.
