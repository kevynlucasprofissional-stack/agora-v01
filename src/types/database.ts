import { Database } from "@/integrations/supabase/types";

// Table row types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Plan = Database["public"]["Tables"]["plans"]["Row"];
export type AnalysisRequest = Database["public"]["Tables"]["analysis_requests"]["Row"];
export type AgentResponse = Database["public"]["Tables"]["agent_responses"]["Row"];
export type Agent = Database["public"]["Tables"]["agents"]["Row"];
export type FileRecord = Database["public"]["Tables"]["files"]["Row"];
export type GeneratedOutput = Database["public"]["Tables"]["generated_outputs"]["Row"];
export type AnalysisFeedback = Database["public"]["Tables"]["analysis_feedback"]["Row"];
export type ExternalIntegration = Database["public"]["Tables"]["external_integrations"]["Row"];
export type DailyUsageCounter = Database["public"]["Tables"]["daily_usage_counters"]["Row"];
export type Enterprise = Database["public"]["Tables"]["enterprises"]["Row"];
export type EnterpriseMember = Database["public"]["Tables"]["enterprise_members"]["Row"];

// Enum types
export type PlanCode = Database["public"]["Enums"]["plan_code"];
export type AnalysisStatus = Database["public"]["Enums"]["analysis_status"];
export type AgentKind = Database["public"]["Enums"]["agent_kind"];
export type ResponseFormat = Database["public"]["Enums"]["response_format"];
export type UploadKind = Database["public"]["Enums"]["upload_kind"];
export type FeedbackType = Database["public"]["Enums"]["feedback_type"];
export type IntegrationProvider = Database["public"]["Enums"]["integration_provider"];
export type IntegrationStatus = Database["public"]["Enums"]["integration_status"];

// Insert types
export type AnalysisRequestInsert = Database["public"]["Tables"]["analysis_requests"]["Insert"];
export type FileInsert = Database["public"]["Tables"]["files"]["Insert"];
export type FeedbackInsert = Database["public"]["Tables"]["analysis_feedback"]["Insert"];

// Agent display info
export const AGENT_INFO: Record<AgentKind, { name: string; icon: string; color: string }> = {
  master_orchestrator: { name: "Orquestrador Master", icon: "LayoutGrid", color: "primary" },
  sociobehavioral: { name: "Analista Sociocomportamental", icon: "Users", color: "success" },
  offer_engineer: { name: "Engenheiro de Oferta", icon: "Zap", color: "warning" },
  performance_scientist: { name: "Cientista de Performance", icon: "BarChart3", color: "primary" },
  chief_strategist: { name: "Estrategista-Chefe", icon: "Target", color: "destructive" },
};

// Plan features
export const PLAN_FEATURES: Record<PlanCode, { badge: string; features: string[] }> = {
  freemium: {
    badge: "Grátis",
    features: [
      "Até 2 uploads/dia",
      "Relatório executivo básico",
      "Onboarding gratuito",
    ],
  },
  standard: {
    badge: "Popular",
    features: [
      "Até 5 uploads/dia",
      "Audiência sintética geracional",
      "Relatório completo",
      "Chat com Estrategista",
    ],
  },
  pro: {
    badge: "Avançado",
    features: [
      "Uploads ilimitados",
      "Audiência sintética",
      "Templates avançados",
      "Exportação completa",
      "Prioridade no processamento",
    ],
  },
  enterprise: {
    badge: "Corporativo",
    features: [
      "Tudo do Pro",
      "Integrações Meta Ads / GA4",
      "Contexto por empresa",
      "Dashboard de previsibilidade",
      "Suporte dedicado",
    ],
  },
};
