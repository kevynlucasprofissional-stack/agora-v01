import { useAuth } from "@/hooks/useAuth";
import { PlanCode } from "@/types/database";

export function usePlanAccess() {
  const { plan } = useAuth();

  const planCode = (plan?.code ?? "freemium") as PlanCode;

  const canUseSyntheticAudience = plan?.synthetic_audience_enabled ?? false;
  const canUseAdvancedTemplates = plan?.advanced_templates_enabled ?? false;
  const canUseEnterpriseIntegrations = plan?.enterprise_integrations_enabled ?? false;
  const uploadsLimit = plan?.uploads_limit_daily ?? 2;
  const isEnterprise = planCode === "enterprise";
  const isPro = planCode === "pro" || isEnterprise;

  return {
    planCode,
    canUseSyntheticAudience,
    canUseAdvancedTemplates,
    canUseEnterpriseIntegrations,
    uploadsLimit,
    isEnterprise,
    isPro,
    plan,
  };
}
