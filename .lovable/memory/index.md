# Memory: index.md
Updated: now

Design system: dark matte ceramic theme, Archivo display + Public Sans body, HSL tokens in index.css. Primary: electric blue 220 80% 55%. Success: mint 155 50% 55%. Warning: amber 40 80% 60%.

DB: Full SQL schema with plans, profiles, analysis_requests, agents, agent_responses, files, generated_outputs, analysis_feedback, external_integrations, daily_usage_counters, conversations, chat_messages. All with RLS.

Routes: Public (/, /login, /pricing, /forgot-password, /reset-password). App (/app, /app/new-analysis, /app/history, /app/analysis/:id/report, /app/analysis/:id/chat, /app/analysis/:id/campaign, /app/optimizer, /app/assets, /app/account, /app/settings, /app/integrations).

Auth: AuthProvider with profile+plan context. ProtectedRoute guard. Auto-profile creation on signup via DB trigger.

Plan access: usePlanAccess hook checks plan features. Enterprise-only integrations page.

AI Engine: Uses GEMINI_API_KEY (NOT LOVABLE_API_KEY). Endpoint: generativelanguage.googleapis.com/v1beta/openai/chat/completions. Model: gemini-2.5-flash (text), gemini-2.0-flash-exp (image).

Chat persistence: conversations + chat_messages tables. AnalysisChatPage and CampaignDocumentPage load/save messages from DB. Context types: 'strategist', 'campaign'.
