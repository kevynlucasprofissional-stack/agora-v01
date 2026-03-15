import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisRequest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Send, X, Target, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { streamChat } from "@/lib/streamChat";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/hooks/useAuth";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface StrategistChatPanelProps {
  analysis: AnalysisRequest;
  open: boolean;
  onClose: () => void;
}

export function StrategistChatPanel({ analysis, open, onClose }: StrategistChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const buildGreeting = (data: AnalysisRequest) =>
    `Olá! Sou o **Estrategista-Chefe** da Ágora. Analisei sua campanha "${data.title || "sem título"}" e o score geral ficou em **${Number(data.score_overall ?? 0).toFixed(0)}/100**.\n\nPosso ajudá-lo com:\n- 🧠 **Neuromarketing** — vieses cognitivos e gatilhos\n- 🎯 **Oferta** — Fórmula de Hormozi, proposta de valor\n- 📊 **Performance** — KPIs, funil, canais\n- 👥 **Público-alvo** — comportamento geracional\n\nO que gostaria de explorar?`;

  const saveMessage = async (convId: string, role: string, content: string) => {
    await supabase.from("chat_messages" as any).insert({ conversation_id: convId, role, content } as any);
  };

  // Load or create conversation when panel opens
  useEffect(() => {
    if (!open || !user || loaded) return;

    const load = async () => {
      const { data: existingConv } = await supabase
        .from("conversations" as any)
        .select("*")
        .eq("analysis_request_id", analysis.id)
        .eq("context_type", "strategist")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let convId: string;

      if (existingConv) {
        convId = (existingConv as any).id;
        setConversationId(convId);
        const { data: dbMessages } = await supabase
          .from("chat_messages" as any)
          .select("*")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true });

        if (dbMessages && dbMessages.length > 0) {
          setMessages((dbMessages as any[]).map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })));
        } else {
          const greeting = buildGreeting(analysis);
          setMessages([{ role: "assistant", content: greeting }]);
          await saveMessage(convId, "assistant", greeting);
        }
      } else {
        const { data: newConv } = await supabase
          .from("conversations" as any)
          .insert({ user_id: user.id, analysis_request_id: analysis.id, context_type: "strategist", title: analysis.title || "Chat Estrategista" } as any)
          .select("id")
          .single();

        if (newConv) {
          convId = (newConv as any).id;
          setConversationId(convId);
          const greeting = buildGreeting(analysis);
          setMessages([{ role: "assistant", content: greeting }]);
          await saveMessage(convId, "assistant", greeting);
        }
      }
      setLoaded(true);
    };

    load();
  }, [open, user, analysis, loaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !conversationId) return;
    const userMsg = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setIsStreaming(true);
    await saveMessage(conversationId, "user", userMsg);

    let assistantContent = "";

    try {
      const apiMessages = newMessages.filter((_, i) => i > 0);
      await streamChat({
        messages: apiMessages,
        functionName: "strategist-chat",
        extraBody: {
          analysisContext: {
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
          },
        },
        onDelta: (chunk) => {
          assistantContent += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "user") return [...prev, { role: "assistant", content: assistantContent }];
            return [...prev.slice(0, -1), { role: "assistant", content: assistantContent }];
          });
        },
        onDone: async () => {
          setIsStreaming(false);
          if (assistantContent && conversationId) await saveMessage(conversationId, "assistant", assistantContent);
        },
      });
    } catch (e) {
      setIsStreaming(false);
      const errorMsg = `❌ ${e instanceof Error ? e.message : "Erro ao conectar com a IA."}`;
      setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
      await saveMessage(conversationId, "assistant", errorMsg);
    }
  }, [input, isStreaming, conversationId, messages, analysis]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full z-50 w-full sm:w-[400px] lg:w-[35%] bg-background border-l border-border shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border/50 shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-sm truncate">Estrategista-Chefe</h2>
                <p className="text-xs text-muted-foreground truncate">{analysis.title}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {!loaded ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                messages.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent/50 border border-border/50"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-headings:text-foreground">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
              {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="bg-accent/50 border border-border/50 rounded-2xl px-3.5 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 flex gap-2 p-4 border-t border-border/50">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="Pergunte sobre a análise..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button variant="hero" size="icon" onClick={handleSend} disabled={isStreaming || !input.trim()} className="shrink-0 h-auto">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
