import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisRequest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft, Target, Loader2, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { streamChat } from "@/lib/streamChat";
import { TypewriterMarkdown } from "@/components/TypewriterMarkdown";
import { useAuth } from "@/hooks/useAuth";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function AnalysisChatPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<AnalysisRequest | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUserNearBottomRef = useRef(true);

  // Load analysis + conversation + messages
  useEffect(() => {
    if (!id || !user) return;

    const loadData = async () => {
      // Load analysis
      const { data: analysisData } = await supabase
        .from("analysis_requests")
        .select("*")
        .eq("id", id)
        .single();
      setAnalysis(analysisData);

      // Find or create conversation
      const { data: existingConv } = await supabase
        .from("conversations" as any)
        .select("*")
        .eq("analysis_request_id", id)
        .eq("context_type", "strategist")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let convId: string;

      if (existingConv) {
        convId = (existingConv as any).id;
        setConversationId(convId);

        // Load existing messages
        const { data: dbMessages } = await supabase
          .from("chat_messages" as any)
          .select("*")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true });

        if (dbMessages && dbMessages.length > 0) {
          setMessages(
            (dbMessages as any[]).map((m: any) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }))
          );
        } else if (analysisData) {
          // No messages yet, add greeting
          const greeting = buildGreeting(analysisData);
          setMessages([{ role: "assistant", content: greeting }]);
          await saveMessage(convId, "assistant", greeting);
        }
      } else if (analysisData) {
        // Create new conversation
        const { data: newConv } = await supabase
          .from("conversations" as any)
          .insert({
            user_id: user.id,
            analysis_request_id: id,
            context_type: "strategist",
            title: analysisData.title || "Chat Estrategista",
          } as any)
          .select("id")
          .single();

        if (newConv) {
          convId = (newConv as any).id;
          setConversationId(convId);
          const greeting = buildGreeting(analysisData);
          setMessages([{ role: "assistant", content: greeting }]);
          await saveMessage(convId, "assistant", greeting);
        }
      }

      setLoading(false);
    };

    loadData();
  }, [id, user]);

  const buildGreeting = (data: AnalysisRequest) =>
    `Olá! Sou o **Estrategista-Chefe** da Ágora. Analisei sua campanha "${data.title || "sem título"}" e o score geral ficou em **${Number(data.score_overall ?? 0).toFixed(0)}/100**.\n\nPosso ajudá-lo com:\n- 🧠 **Neuromarketing** — vieses cognitivos e gatilhos para seu público\n- 🎯 **Oferta** — Fórmula de Hormozi, proposta de valor, pricing\n- 📊 **Performance** — KPIs, funil, canais e segmentação\n- 👥 **Público-alvo** — comportamento geracional e segmentação\n\nO que gostaria de explorar?`;

  const saveMessage = async (convId: string, role: string, content: string) => {
    await supabase.from("chat_messages" as any).insert({
      conversation_id: convId,
      role,
      content,
    } as any);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !conversationId) return;
    const userMsg = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setIsStreaming(true);

    // Save user message to DB
    await saveMessage(conversationId, "user", userMsg);

    let assistantContent = "";

    try {
      // Send all messages (except initial greeting) to API
      const apiMessages = newMessages.filter((_, i) => i > 0);

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
            if (last?.role === "user") {
              return [...prev, { role: "assistant", content: assistantContent }];
            }
            return [...prev.slice(0, -1), { role: "assistant", content: assistantContent }];
          });
        },
        onDone: async () => {
          setIsStreaming(false);
          // Save assistant message to DB
          if (assistantContent && conversationId) {
            await saveMessage(conversationId, "assistant", assistantContent);
          }
        },
      });
    } catch (e) {
      setIsStreaming(false);
      const errorMsg = `❌ ${e instanceof Error ? e.message : "Erro ao conectar com a IA. Tente novamente."}`;
      setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
      await saveMessage(conversationId, "assistant", errorMsg);
    }
  }, [input, isStreaming, conversationId, messages, analysis]);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;

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
            <Plus className="h-4 w-4 mr-2" /> Novo chat
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
                <TypewriterMarkdown
                  content={msg.content}
                  isStreaming={isStreaming && i === messages.length - 1}
                  className="prose prose-sm prose-invert max-w-none prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-headings:text-foreground"
                />
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
