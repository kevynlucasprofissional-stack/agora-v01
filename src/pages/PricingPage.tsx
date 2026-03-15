import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check, Zap, ArrowLeft } from "lucide-react";
import { PLAN_FEATURES } from "@/types/database";
import { motion } from "framer-motion";

const plans = [
  { code: "freemium" as const, price: "R$ 0", period: "/mês", name: "Freemium" },
  { code: "standard" as const, price: "R$ 97", period: "/mês", name: "Standard", highlight: true },
  { code: "pro" as const, price: "R$ 197", period: "/mês", name: "Pro" },
  { code: "enterprise" as const, price: "R$ 997", period: "/mês", name: "Enterprise" },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-bold">Ágora</span>
            </Link>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/login">Entrar</Link>
          </Button>
        </div>
      </nav>

      <div className="container py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold md:text-5xl">Planos e Preços</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Escolha o plano ideal para o tamanho da sua operação de marketing.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((p, i) => (
            <motion.div key={p.code} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className={`glass-card p-6 flex flex-col ${p.highlight ? "border-primary/50 ring-1 ring-primary/20" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-xl font-bold">{p.name}</h3>
                {p.highlight && (
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                    Popular
                  </span>
                )}
              </div>
              <span className="section-label mb-4">{PLAN_FEATURES[p.code].badge}</span>
              <div className="mb-6">
                <span className="text-4xl font-display font-bold text-tabular">{p.price}</span>
                <span className="text-sm text-muted-foreground">{p.period}</span>
              </div>
              <ul className="flex-1 space-y-3 mb-6">
                {PLAN_FEATURES[p.code].features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 mt-0.5 text-success shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button variant={p.highlight ? "hero" : "outline"} className="w-full" asChild>
                <Link to="/login?tab=signup">{p.price === "R$ 0" ? "Começar Grátis" : "Assinar Agora"}</Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
