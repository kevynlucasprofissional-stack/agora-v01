import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisRequest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, Target } from "lucide-react";
import { motion } from "framer-motion";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function AnalysisChatPage() {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<AnalysisRequest | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from("analysis_requests").select("*").eq("id", id).single().then(({ data }) => {
      setAnalysis(data);
      if (data) {
        setMessages([{
          role: "assistant",
          content: `Olá! Sou o Estrategista-Chefe da Ágora. Analisei sua campanha "${data.title || "sem título"}" e o score geral ficou em **${Number(data.score_overall ?? 0).toFixed(0)}/100**.\n\nPosso ajudá-lo a refinar canais, oferta, público-alvo ou estratégia de testes. O que gostaria de explorar?`,
        }]);
      }
    });
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    // Mock AI response
    setTimeout(() => {
      const responses = [
        `Excelente pergunta. Com base na análise sociocomportamental, identifiquei que o público real da sua campanha opera predominantemente no **Sistema 1** (pensamento rápido e emocional). \n\nIsso significa que o criativo precisa comunicar valor em menos de 3 segundos. Recomendo:\n\n1. **Reescrever o headline** focando em resultado + prazo\n2. **Adicionar prova social visual** (números, logos, depoimentos)\n3. **Reduzir opções** para evitar paradoxo da escolha\n\nDeseja que eu detalhe algum desses pontos?`,
        `Analisando os KPIs que você mencionou, identifiquei que **CTR e curtidas são métricas de vaidade** neste contexto. A north star metric deveria ser o **CAC Payback Period**.\n\nSeu Timing Index sugere uma janela de alta demanda, então recomendo:\n- Estratégia **Pulsed** com bursts de 7 dias\n- Concentrar budget em TikTok + Instagram Reels\n- Teste A/B: garantia de 7 dias vs 14 dias\n\nQuer que eu elabore o plano de experimentação?`,
        `Baseado na engenharia de oferta, o gargalo principal é a **baixa probabilidade percebida**. O consumidor não acredita que o resultado prometido é alcançável.\n\nPara corrigir:\n- Inserir **case study quantificável** antes do CTA\n- Adicionar **garantia incondicional** visível\n- Usar **ancoragem de preço** (mostrar valor total vs investimento)\n- Reduzir passos do checkout de 4 para 2\n\nEstas correções podem elevar o score de oferta em +25 pontos.`,
      ];
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: responses[Math.floor(Math.random() * responses.length)],
      }]);
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-border/50 shrink-0">
        <Link to={`/app/analysis/${id}/report`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-sm">Estrategista-Chefe</h2>
          <p className="text-xs text-muted-foreground">Refinamento contextual da análise</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto py-6 space-y-4">
        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === "user" ? "bg-primary text-primary-foreground" : "glass-card"
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="glass-card px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-pulse" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-pulse" style={{ animationDelay: "0.2s" }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-pulse" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 flex gap-2 pt-4 border-t border-border/50">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte sobre a análise..."
          className="bg-card" onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()} />
        <Button variant="hero" size="icon" onClick={handleSend} disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
