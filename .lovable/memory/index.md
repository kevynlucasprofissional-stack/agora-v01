Design system: dark matte ceramic theme, Archivo display + Public Sans body, HSL tokens in index.css. Primary: electric blue 220 80% 55%. Success: mint 155 50% 55%. Warning: amber 40 80% 60%.

DB: Full SQL schema with plans, profiles, analysis_requests, agents, agent_responses, files, generated_outputs, analysis_feedback (unique constraint on analysis_request_id+user_id), external_integrations, daily_usage_counters, enterprises, enterprise_members. All with RLS.

Routes: Public (/, /login, /pricing, /forgot-password, /reset-password). App (/app, /app/new-analysis, /app/history, /app/analysis/:id/report, /app/analysis/:id/chat, /app/analysis/:id/campaign, /app/assets, /app/account, /app/settings, /app/integrations).

Auth: AuthProvider with profile+plan context. ProtectedRoute guard. Auto-profile creation on signup via DB trigger.

Plan access: usePlanAccess hook checks plan features. Enterprise-only integrations page.

Edge functions: intake-chat (intake conversation), generate-campaign (campaign doc), campaign-chat (edit campaign via chat), analyze-campaign (structured AI analysis with Gemini tool calling), strategist-chat (real AI strategist for post-analysis Q&A). All use Lovable AI gateway.

Analysis enriched payload: executive_summary, improvements, strengths, audience_insights, market_references, marketing_era (1.0-4.0), cognitive_biases, hormozi_analysis, kpi_analysis (vanity metrics + north star), timing_analysis, brand_sentiment.

Export: Markdown, PDF (print), DOCX (docx lib), PPTX (pptxgenjs).

Trial: 15 days Standard plan for new signups. profiles.trial_ends_at + profiles.original_plan_id.
