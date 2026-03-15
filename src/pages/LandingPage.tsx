import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, BarChart3, Users, Target, Shield, ArrowRight, Check } from "lucide-react";
import { InfiniteGrid } from "@/components/ui/the-infinite-grid";
import { PLAN_FEATURES } from "@/types/database";

const features = [
  { icon: Users, title: "Análise Sociocomportamental", desc: "Classificação geracional, neuromarketing e vieses cognitivos do seu público real." },
  { icon: Zap, title: "Engenharia de Oferta", desc: "Desconstrução matemática do valor percebido. Identifica gargalos fatais." },
  { icon: BarChart3, title: "Ciência de Performance", desc: "Auditoria de KPIs, benchmark de mercado e Timing Index em tempo real." },
  { icon: Target, title: "Estratégia Consolidada", desc: "Relatório executivo com score 0-100 e campanha otimizada pronta para execução." },
];

const plans = [
  { code: "freemium" as const, price: "R$ 0", period: "/mês" },
  { code: "standard" as const, price: "R$ 97", period: "/mês", highlight: true },
  { code: "pro" as const, price: "R$ 197", period: "/mês" },
  { code: "enterprise" as const, price: "R$ 997", period: "/mês" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] } }),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">Ágora</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/pricing">Planos</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/login">Entrar</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link to="/login?tab=signup">Começar Agora</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-primary/10 blur-[100px]" />
        </div>
        <div className="container relative text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <span className="section-label mb-4 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-primary">
              Marketing Científico com IA
            </span>
          </motion.div>
          <motion.h1 variants={fadeUp} custom={1} initial="hidden" animate="visible"
            className="mx-auto max-w-4xl text-5xl font-extrabold leading-[1.1] md:text-7xl">
            Simule suas campanhas. Otimize sua estratégia. Aumente suas vendas.
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} initial="hidden" animate="visible"
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            A Ágora usa inteligência artificial multiagente, neuromarketing e dados reais para diagnosticar, pontuar e otimizar suas campanhas com precisão científica.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} initial="hidden" animate="visible" className="mt-10 flex justify-center gap-4">
            <Button variant="hero" size="lg" asChild>
              <Link to="/login?tab=signup">
                Começar Agora <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="hero-outline" size="lg" asChild>
              <Link to="/pricing">Ver Planos</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-border/30">
        <div className="container">
          <div className="text-center mb-16">
            <span className="section-label">Motor Multiagente</span>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">Quatro especialistas. Uma inteligência.</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Cada campanha passa por agentes especializados que simulam uma equipe de marketing científico completa.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div key={f.title} variants={fadeUp} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="glass-card p-6 group hover:border-primary/30 transition-colors">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-20 border-t border-border/30">
        <div className="container text-center">
          <span className="section-label">Resultados Comprovados</span>
          <h2 className="mt-3 text-3xl font-bold md:text-4xl">Confiado por equipes de marketing</h2>
          <div className="mt-12 grid md:grid-cols-3 gap-8">
            {[
              { metric: "+340%", label: "Aumento médio em conversão" },
              { metric: "2.3s", label: "Tempo médio de diagnóstico" },
              { metric: "98%", label: "Precisão nas recomendações" },
            ].map((s, i) => (
              <motion.div key={s.label} variants={fadeUp} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="glass-card p-8">
                <div className="text-4xl font-display font-bold text-primary text-tabular">{s.metric}</div>
                <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-20 border-t border-border/30">
        <div className="container">
          <div className="text-center mb-16">
            <span className="section-label">Planos</span>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">Escale com precisão</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((p, i) => (
              <motion.div key={p.code} variants={fadeUp} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className={`glass-card p-6 flex flex-col ${p.highlight ? "border-primary/50 ring-1 ring-primary/20" : ""}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="section-label">{PLAN_FEATURES[p.code].badge}</span>
                  {p.highlight && (
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                      Recomendado
                    </span>
                  )}
                </div>
                <div className="mb-6">
                  <span className="text-3xl font-display font-bold text-tabular">{p.price}</span>
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
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-12">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold text-foreground">Ágora</span>
          </div>
          <p>© 2026 Ágora. Marketing que prevê o futuro.</p>
        </div>
      </footer>
    </div>
  );
}
