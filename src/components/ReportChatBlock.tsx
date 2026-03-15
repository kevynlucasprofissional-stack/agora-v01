import { useState, useRef, useCallback } from "react";
import { Send, Loader2, Sparkles, Search, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { streamChat } from "@/lib/streamChat";
import { AnalysisRequest } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const ACTION_OPTIONS = [
  { label: "Gerar criativos", icon: Sparkles, prompt: "Gere criativos otimizados para esta campanha com base na análise completa." },
  { label: "Pesquisa de mercado", icon: Search, prompt: "Faça uma pesquisa de mercado detalhada com base nos dados desta campanha." },
  { label: "Gerar campanha", icon: BarChart3, prompt: "Gere uma campanha completa otimizada com base nos insights desta análise." },
];

interface ReportChatBlockProps {
  analysis: AnalysisRequest;
}

export function ReportChatBlock({ analysis }: ReportChatBlockProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const getOrCreateConversation = useCallback(async () => {
    if (conversationId) return conversationId;
    if (!user) return null;

    const { data: existing } = await supabase
      .from("conversations" as any)
      .select("id")
      .eq("analysis_request_id", analysis.id)
      .eq("context_type", "report-chat")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const id = (existing as any).id;
      setConversationId(id);
      return id;
    }

    const { data: newConv } = await supabase
      .from("conversations" as any)
      .insert({ user_id: user.id, analysis_request_id: analysis.id, context_type: "report-chat", title: analysis.title || "Chat Livre" } as any)
      .select("id")
      .single();

    if (newConv) {
      const id = (newConv as any).id;
      setConversationId(id);
      return id;
    }
    return null;
  }, [conversationId, user, analysis]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const convId = await getOrCreateConversation();
    const userMsg = text.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setIsStreaming(true);

    if (convId) {
      await supabase.from("chat_messages" as any).insert({ conversation_id: convId, role: "user", content: userMsg } as any);
    }

    let assistantContent = "";

    try {
      await streamChat({
        messages: newMessages,
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
          if (assistantContent && convId) {
            await supabase.from("chat_messages" as any).insert({ conversation_id: convId, role: "assistant", content: assistantContent } as any);
          }
        },
      });
    } catch (e) {
      setIsStreaming(false);
      const errorMsg = `❌ ${e instanceof Error ? e.message : "Erro ao conectar com a IA."}`;
      setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
    }
  }, [input, isStreaming, messages, analysis, getOrCreateConversation]);

  return (
    <div className="glass-card p-6">
      <h3 className="section-label mb-4 flex items-center gap-2">
        💬 Chat Livre — Estrategista IA
      </h3>

      {/* Messages */}
      {messages.length > 0 && (
        <div className="max-h-[400px] overflow-auto space-y-3 mb-4 pr-1">
          {messages.map((msg, i) => (
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
          ))}
          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="bg-accent/50 border border-border/50 rounded-2xl px-3.5 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Action chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {ACTION_OPTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => sendMessage(action.prompt)}
            disabled={isStreaming}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border/50 bg-accent/30 hover:bg-accent/60 text-foreground transition-colors disabled:opacity-50"
          >
            <action.icon className="h-3.5 w-3.5" />
            {action.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
          placeholder="Pergunte qualquer coisa sobre a análise..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button variant="hero" size="icon" onClick={() => sendMessage(input)} disabled={isStreaming || !input.trim()} className="shrink-0 h-auto">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
