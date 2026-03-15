import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisRequest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft, Target, Loader2, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { streamChat } from "@/lib/streamChat";
import ReactMarkdown from "react-markdown";

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
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from("analysis_requests").select("*").eq("id", id).single().then(({ data }) => {
      setAnalysis(data);
      if (data) {
        setMessages([{
          role: "assistant",
          content: `Olá! Sou o **Estrategista-Chefe** da Ágora. Analisei sua campanha "${data.title || "sem título"}" e o score geral ficou em **${Number(data.score_overall ?? 0).toFixed(0)}/100**.\n\nPosso ajudá-lo com:\n- 🧠 **Neuromarketing** — vieses cognitivos e gatilhos para seu público\n- 🎯 **Oferta** — Fórmula de Hormozi, proposta de valor, pricing\n- 📊 **Performance** — KPIs, funil, canais e segmentação\n- 👥 **Público-alvo** — comportamento geracional e segmentação\n\nO que gostaria de explorar?`,
        }]);
      }
    });
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setIsStreaming(true);

    let assistantContent = "";

    try {
      // Only send non-initial messages to the API
      const apiMessages = newMessages.filter((_, i) => i > 0); // skip initial assistant greeting

      await streamChat({
        messages: apiMessages,
        functionName: "strategist-chat",
        extraBody: {
          analysisContext: analysis ? {
            title: analysis.title,
            score_overall: analysis.score_overall,
            score_sociobehavioral: analysis.score_sociobehavioral,
            score_offer: analysis.score_offer,
            score_performance: analysis.score_performance,
            industry: analysis.industry,
            primary_channel: analysis.primary_channel,
            declared_target_audience: analysis.declared_target_audience,
            raw_prompt: analysis.raw_prompt,
            normalized_payload: analysis.normalized_payload,
          } : undefined,
        },
        onDelta: (chunk) => {
          assistantContent += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && prev.length > 1 && last.content === assistantContent.slice(0, -chunk.length)) {
              return [...prev.slice(0, -1), { role: "assistant", content: assistantContent }];
            }
            if (last?.role === "user") {
              return [...prev, { role: "assistant", content: assistantContent }];
            }
            return [...prev.slice(0, -1), { role: "assistant", content: assistantContent }];
          });
        },
        onDone: () => {
          setIsStreaming(false);
        },
      });
    } catch (e) {
      setIsStreaming(false);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `❌ ${e instanceof Error ? e.message : "Erro ao conectar com a IA. Tente novamente."}`,
      }]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-border/50 shrink-0">
        <Link to={`/app/analysis/${id}/report`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-sm">Estrategista-Chefe</h2>
          <p className="text-xs text-muted-foreground">Refinamento contextual da análise</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/new-analysis">
            <Plus className="h-4 w-4 mr-2" /> Nova Análise
          </Link>
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto py-6 space-y-4">
        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === "user" ? "bg-primary text-primary-foreground" : "glass-card"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-headings:text-foreground">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
          </motion.div>
        ))}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="glass-card px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 flex gap-2 pt-4 border-t border-border/50">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleTextareaInput}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
          placeholder="Pergunte sobre a análise..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-input bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button variant="hero" size="icon" onClick={handleSend} disabled={isStreaming || !input.trim()} className="shrink-0 h-auto">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
