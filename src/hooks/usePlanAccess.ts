import { useAuth } from "@/hooks/useAuth";
import { PlanCode } from "@/types/database";

export function usePlanAccess() {
  const { plan, profile } = useAuth();

  const planCode = (plan?.code ?? "freemium") as PlanCode;

  // Trial info
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const now = new Date();
  const isOnTrial = trialEndsAt !== null && trialEndsAt > now && profile?.original_plan_id !== profile?.current_plan_id;
  const trialExpired = trialEndsAt !== null && trialEndsAt <= now;
  const trialDaysLeft = trialEndsAt && trialEndsAt > now
    ? Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // The effective plan is already resolved in useAuth (expired trial → freemium plan loaded)
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
    // Trial state
    isOnTrial,
    trialExpired,
    trialDaysLeft,
    trialEndsAt,
  };
}
