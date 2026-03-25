import { motion } from "framer-motion";
import { Phone, Truck, Building2, HardHat, Shield, Clock, MapPin, ChevronDown, MessageCircle } from "lucide-react";
import heroImg from "@/assets/petramix-hero.jpg";
import pouringImg from "@/assets/petramix-pouring.jpg";
import plantImg from "@/assets/petramix-plant.jpg";

const WHATSAPP_NUMBER = "5511999999999";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Gostaria de solicitar um orçamento de concreto.")}`;

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.25, 0.8, 0.25, 1] as [number, number, number, number] },
  }),
};

const services = [
  { icon: Truck, title: "Concreto Usinado", desc: "Produção e entrega de concreto dosado em central, com rastreabilidade total e controle tecnológico rigoroso." },
  { icon: Building2, title: "Bombeamento", desc: "Serviço completo de bombeamento para obras de todos os portes, com equipamentos modernos e operadores treinados." },
  { icon: HardHat, title: "Concretagem Especial", desc: "Soluções para concretos de alta resistência, autoadensável, fibra e projetado para grandes estruturas." },
  { icon: Shield, title: "Controle Tecnológico", desc: "Laboratório próprio com ensaios de resistência, slump test e acompanhamento técnico em tempo real." },
];

const stats = [
  { value: "15+", label: "Anos de Experiência" },
  { value: "3.200+", label: "Obras Atendidas" },
  { value: "850 mil", label: "m³ de Concreto Entregues" },
  { value: "98%", label: "Satisfação dos Clientes" },
];

export default function PetraMixPage() {
  return (
    <div className="min-h-screen" style={{ fontFamily: "'Archivo', system-ui, sans-serif", background: "#0a0a0a", color: "#e5e5e5" }}>
      {/* ── Nav ── */}
      <nav className="fixed top-0 z-50 w-full border-b" style={{ borderColor: "hsl(0 0% 20%)", background: "hsla(0,0%,4%,0.85)", backdropFilter: "blur(16px)" }}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <span className="text-xl font-extrabold tracking-tight" style={{ letterSpacing: "-0.04em" }}>
            <span style={{ color: "#fff" }}>PETRA</span>
            <span style={{ color: "hsl(0 0% 55%)" }}>MIX</span>
          </span>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: "hsl(0 0% 60%)" }}>
            <a href="#sobre" className="hover:text-white transition-colors">Sobre</a>
            <a href="#servicos" className="hover:text-white transition-colors">Serviços</a>
            <a href="#numeros" className="hover:text-white transition-colors">Números</a>
            <a href="#contato" className="hover:text-white transition-colors">Contato</a>
          </div>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-all hover:scale-105"
            style={{ background: "#25D366", color: "#fff" }}
          >
            <MessageCircle className="h-4 w-4" />
            Orçamento
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <img src={heroImg} alt="Caminhão betoneira PetraMix" className="absolute inset-0 h-full w-full object-cover" width={1920} height={1080} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, hsla(0,0%,4%,0.55) 0%, hsla(0,0%,4%,0.85) 100%)" }} />
        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
          <motion.p variants={fadeUp} custom={0} initial="hidden" animate="visible"
            className="mb-4 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "hsl(0 0% 55%)" }}>
            Concretagem de Alta Performance
          </motion.p>
          <motion.h1 variants={fadeUp} custom={1} initial="hidden" animate="visible"
            className="text-4xl font-extrabold leading-[1.08] sm:text-6xl md:text-7xl" style={{ color: "#fff", letterSpacing: "-0.04em" }}>
            O concreto certo para suas grandes obras
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} initial="hidden" animate="visible"
            className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: "hsl(0 0% 65%)" }}>
            Qualidade, pontualidade e controle tecnológico em cada metro cúbico entregue. Solicite seu orçamento sem compromisso.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} initial="hidden" animate="visible" className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md px-8 py-3.5 text-base font-semibold transition-all hover:scale-105 shadow-lg"
              style={{ background: "#25D366", color: "#fff" }}
            >
              <Phone className="h-5 w-5" />
              Solicitar Orçamento
            </a>
            <a
              href="#sobre"
              className="inline-flex items-center justify-center gap-2 rounded-md border px-8 py-3.5 text-base font-semibold transition-colors hover:bg-white/10"
              style={{ borderColor: "hsl(0 0% 30%)", color: "#fff" }}
            >
              Conheça a PetraMix
            </a>
          </motion.div>
        </div>
        <a href="#sobre" className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce" style={{ color: "hsl(0 0% 40%)" }}>
          <ChevronDown className="h-7 w-7" />
        </a>
      </section>

      {/* ── Sobre ── */}
      <section id="sobre" className="py-24" style={{ background: "#111" }}>
        <div className="mx-auto grid max-w-7xl gap-12 px-4 md:grid-cols-2 md:px-8 items-center">
          <motion.div variants={fadeUp} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <img src={pouringImg} alt="Concreto sendo despejado" className="rounded-xl w-full object-cover" style={{ maxHeight: 480 }} loading="lazy" width={1280} height={854} />
          </motion.div>
          <motion.div variants={fadeUp} custom={1} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "hsl(0 0% 45%)" }}>Sobre Nós</p>
            <h2 className="text-3xl font-extrabold md:text-4xl" style={{ color: "#fff", letterSpacing: "-0.03em" }}>
              Mais de 15 anos construindo com solidez
            </h2>
            <p className="mt-5 leading-relaxed" style={{ color: "hsl(0 0% 60%)" }}>
              A PetraMix nasceu da paixão pela engenharia e pelo compromisso com a qualidade. Somos uma empresa de concretagem que atende obras residenciais, comerciais e industriais com concreto usinado de alta performance.
            </p>
            <p className="mt-4 leading-relaxed" style={{ color: "hsl(0 0% 60%)" }}>
              Contamos com frota própria de caminhões betoneira, central dosadora moderna e uma equipe técnica altamente qualificada. Cada m³ de concreto que produzimos passa por rigoroso controle tecnológico para garantir a resistência especificada.
            </p>
            <div className="mt-8 flex flex-wrap gap-6">
              {[{ icon: Clock, text: "Entrega Pontual" }, { icon: Shield, text: "Qualidade Certificada" }, { icon: MapPin, text: "Cobertura Regional" }].map((item) => (
                <div key={item.text} className="flex items-center gap-2 text-sm font-medium" style={{ color: "hsl(0 0% 75%)" }}>
                  <item.icon className="h-4 w-4" style={{ color: "hsl(0 0% 50%)" }} />
                  {item.text}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Serviços ── */}
      <section id="servicos" className="py-24" style={{ background: "#0a0a0a" }}>
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "hsl(0 0% 45%)" }}>Nossos Serviços</p>
            <h2 className="text-3xl font-extrabold md:text-4xl" style={{ color: "#fff", letterSpacing: "-0.03em" }}>
              Soluções completas em concretagem
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s, i) => (
              <motion.div key={s.title} variants={fadeUp} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="group rounded-xl border p-6 transition-colors hover:border-white/20"
                style={{ borderColor: "hsl(0 0% 15%)", background: "hsl(0 0% 7%)" }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg" style={{ background: "hsl(0 0% 15%)" }}>
                  <s.icon className="h-6 w-6" style={{ color: "hsl(0 0% 60%)" }} />
                </div>
                <h3 className="text-lg font-bold" style={{ color: "#fff" }}>{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "hsl(0 0% 50%)" }}>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Números ── */}
      <section id="numeros" className="relative py-24 overflow-hidden">
        <img src={plantImg} alt="Central de concreto PetraMix" className="absolute inset-0 h-full w-full object-cover" loading="lazy" width={1280} height={854} />
        <div className="absolute inset-0" style={{ background: "hsla(0,0%,4%,0.88)" }} />
        <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "hsl(0 0% 45%)" }}>Em Números</p>
            <h2 className="text-3xl font-extrabold md:text-4xl" style={{ color: "#fff", letterSpacing: "-0.03em" }}>
              Resultados que constroem confiança
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s, i) => (
              <motion.div key={s.label} variants={fadeUp} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="text-center rounded-xl border p-8"
                style={{ borderColor: "hsl(0 0% 20%)", background: "hsla(0,0%,8%,0.6)", backdropFilter: "blur(8px)" }}
              >
                <div className="text-4xl font-extrabold" style={{ color: "#fff", fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
                <p className="mt-2 text-sm" style={{ color: "hsl(0 0% 55%)" }}>{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA WhatsApp ── */}
      <section id="contato" className="py-24" style={{ background: "#111" }}>
        <div className="mx-auto max-w-3xl px-4 text-center">
          <motion.div variants={fadeUp} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "hsl(0 0% 45%)" }}>Fale Conosco</p>
            <h2 className="text-3xl font-extrabold md:text-5xl" style={{ color: "#fff", letterSpacing: "-0.03em" }}>
              Solicite seu orçamento agora
            </h2>
            <p className="mt-5 text-lg" style={{ color: "hsl(0 0% 55%)" }}>
              Entre em contato direto pelo WhatsApp. Nosso time técnico responde rapidamente com a solução ideal para sua obra.
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-10 inline-flex items-center gap-3 rounded-xl px-10 py-4 text-lg font-bold transition-all hover:scale-105 shadow-2xl"
              style={{ background: "#25D366", color: "#fff" }}
            >
              <MessageCircle className="h-6 w-6" />
              Chamar no WhatsApp
            </a>
            <p className="mt-4 text-xs" style={{ color: "hsl(0 0% 40%)" }}>
              Atendimento de segunda a sábado, das 7h às 18h
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-10" style={{ borderColor: "hsl(0 0% 15%)", background: "#0a0a0a" }}>
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 md:px-8 text-sm" style={{ color: "hsl(0 0% 40%)" }}>
          <span className="font-extrabold text-base" style={{ letterSpacing: "-0.04em" }}>
            <span style={{ color: "hsl(0 0% 70%)" }}>PETRA</span>
            <span style={{ color: "hsl(0 0% 40%)" }}>MIX</span>
          </span>
          <p>© 2026 PetraMix Concreto. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* ── Floating WhatsApp ── */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-transform hover:scale-110"
        style={{ background: "#25D366" }}
        aria-label="WhatsApp"
      >
        <MessageCircle className="h-7 w-7 text-white" />
      </a>
    </div>
  );
}
