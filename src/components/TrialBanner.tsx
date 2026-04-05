import { usePlanAccess } from "@/hooks/usePlanAccess";
import { AlertTriangle, Clock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function TrialBanner() {
  const { isOnTrial, trialExpired, trialDaysLeft } = usePlanAccess();
  const navigate = useNavigate();

  if (!isOnTrial && !trialExpired) return null;

  if (trialExpired) {
    return (
      <div className="w-full bg-destructive/10 border-b border-destructive/20 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Seu período de teste expirou. Você está no plano <strong>Freemium</strong> com funcionalidades limitadas.
          </span>
        </div>
        <button
          onClick={() => navigate("/pricing")}
          className="shrink-0 text-xs font-semibold px-3 py-1 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
        >
          Fazer upgrade
        </button>
      </div>
    );
  }

  // On trial
  const urgent = trialDaysLeft <= 2;

  return (
    <div
      className={`w-full border-b px-4 py-2.5 flex items-center justify-between gap-3 ${
        urgent
          ? "bg-orange-500/10 border-orange-500/20"
          : "bg-primary/5 border-primary/10"
      }`}
    >
      <div className={`flex items-center gap-2 text-sm ${urgent ? "text-orange-700 dark:text-orange-400" : "text-muted-foreground"}`}>
        {urgent ? (
          <Clock className="h-4 w-4 shrink-0" />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0" />
        )}
        <span>
          {trialDaysLeft === 1
            ? "Seu teste Pro expira amanhã."
            : `Seu teste Pro expira em ${trialDaysLeft} dias.`}
          {urgent && " Faça upgrade para não perder acesso."}
        </span>
      </div>
      <button
        onClick={() => navigate("/pricing")}
        className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
          urgent
            ? "bg-orange-500 text-white hover:bg-orange-600"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        Fazer upgrade
      </button>
    </div>
  );
}
