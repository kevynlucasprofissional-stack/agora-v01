import { usePlanAccess } from "@/hooks/usePlanAccess";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { PLAN_FEATURES } from "@/types/database";

const plans = [
  { code: "freemium" as const, price: "R$ 0", name: "Freemium" },
  { code: "standard" as const, price: "R$ 97", name: "Standard", highlight: true },
  { code: "pro" as const, price: "R$ 197", name: "Pro" },
  { code: "enterprise" as const, price: "R$ 997", name: "Enterprise" },
];

export default function SettingsPage() {
  const { planCode } = usePlanAccess();

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie seu plano e preferências.</p>
      </div>

      {/* Plans comparison */}
      <div>
        <h2 className="section-label mb-4">Planos Disponíveis</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => {
            const isCurrent = p.code === planCode;
            return (
              <div key={p.code} className={`glass-card p-5 flex flex-col ${p.highlight ? "border-primary/50" : ""} ${isCurrent ? "ring-1 ring-primary/30" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display font-bold">{p.name}</h3>
                  {isCurrent && (
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Atual</span>
                  )}
                </div>
                <p className="text-2xl font-display font-bold text-tabular mb-4">{p.price}<span className="text-sm text-muted-foreground">/mês</span></p>
                <ul className="flex-1 space-y-2 mb-4">
                  {PLAN_FEATURES[p.code].features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 mt-0.5 text-success shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <Button variant={p.highlight ? "hero" : "outline"} size="sm" className="w-full" onClick={() => {}}>
                    {plans.findIndex((pl) => pl.code === p.code) > plans.findIndex((pl) => pl.code === planCode) ? "Fazer Upgrade" : "Mudar Plano"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
