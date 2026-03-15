import { usePlanAccess } from "@/hooks/usePlanAccess";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Lock, Link2, BarChart3, Zap, Eye } from "lucide-react";

const integrations = [
  { provider: "meta_ads", name: "Meta Ads", desc: "Conecte sua conta de anúncios do Meta para importar dados de campanhas.", icon: Zap },
  { provider: "ga4", name: "Google Analytics 4", desc: "Importe métricas e dados de audiência do GA4.", icon: BarChart3 },
  { provider: "canva", name: "Canva", desc: "Exporte materiais otimizados diretamente para o Canva.", icon: Eye },
  { provider: "gamma", name: "Gamma", desc: "Gere apresentações de pitch diretamente no Gamma.", icon: Link2 },
];

export default function IntegrationsPage() {
  const { isEnterprise } = usePlanAccess();

  if (!isEnterprise) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">Integrações</h1>
        <div className="glass-card p-12 text-center relative overflow-hidden">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-bold mb-2">Recurso Enterprise</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Integrações com Meta Ads, GA4 e ferramentas de design estão disponíveis no plano Enterprise.
          </p>
          <Button variant="hero" asChild>
            <Link to="/app/settings">Ver Planos</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Integrações</h1>
      <p className="text-sm text-muted-foreground mb-6">Conecte suas ferramentas para análises mais precisas.</p>

      <div className="space-y-4">
        {integrations.map((int) => (
          <div key={int.provider} className="glass-card p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
              <int.icon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{int.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{int.desc}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-full uppercase tracking-wider">
                Desconectado
              </span>
              <Button variant="outline" size="sm">Conectar</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
