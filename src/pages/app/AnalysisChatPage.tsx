import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisRequest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft, Target, Loader2, Plus, Sparkles, ExternalLink, ImageIcon } from "lucide-react";
import { motion } from "framer-motion";
import { streamChat } from "@/lib/streamChat";
import { TypewriterMarkdown } from "@/components/TypewriterMarkdown";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { parseContextCards } from "@/lib/parseContextCards";
import { ContextCards } from "@/components/ContextCards";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image_url?: string | null;
  expires_at?: string | null;
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
  const [generatingCreative, setGeneratingCreative] = useState(false);
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
              image_url: m.image_url || null,
              expires_at: m.expires_at || null,
            }))
          );
        } else if (analysisData) {
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

  const saveMessage = async (
    convId: string,
    role: string,
    content: string,
    imageUrl?: string | null,
    expiresAt?: string | null
  ) => {
    await supabase.from("chat_messages" as any).insert({
      conversation_id: convId,
      role,
      content,
      image_url: imageUrl || null,
      expires_at: expiresAt || null,
    } as any);
  };

  // Check if image is expired
  const isImageExpired = (expiresAt: string | null | undefined): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  // Track if user is near bottom
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 100;
    isUserNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Only auto-scroll if user is near bottom
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (isUserNearBottomRef.current && el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const handleGenerateCreative = useCallback(async () => {
    if (!id || generatingCreative || !conversationId) return;
    setGeneratingCreative(true);

    // Add generating message
    const genMsg: ChatMessage = { role: "assistant", content: "🎨 Gerando criativo com IA... Isso pode levar alguns segundos." };
    setMessages((prev) => [...prev, genMsg]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-creative", {
        body: { analysis_id: id, conversation_id: conversationId, format: "1080x1080" },
      });
      if (error) throw error;

      const imageUrl = data?.image_url || null;
      const creativeJobId = data?.creative_job_id || null;
      const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

      // Build the assistant message content
      let msgContent = "✅ Imagem gerada com sucesso!";
      if (creativeJobId) {
        msgContent += `\n\n[creative_job_id:${creativeJobId}]`;
      }

      // Replace the generating message with the actual image message
      const imageMessage: ChatMessage = {
        role: "assistant",
        content: msgContent,
        image_url: imageUrl,
        expires_at: expiresAt,
      };

      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 && m.content.includes("Gerando criativo")
            ? imageMessage
            : m
        )
      );

      // Save to DB
      await saveMessage(conversationId, "assistant", msgContent, imageUrl, expiresAt);

      toast.success("Criativo gerado com sucesso!");
    } catch (e: any) {
      console.error("Erro ao gerar criativo:", e);
      const errorMsg = "❌ Erro ao gerar criativo. Tente novamente.";
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 && m.content.includes("Gerando criativo")
            ? { ...m, content: errorMsg }
            : m
        )
      );
      await saveMessage(conversationId, "assistant", errorMsg);
      toast.error("Erro ao gerar criativo.");
    } finally {
      setGeneratingCreative(false);
    }
  }, [id, generatingCreative, conversationId]);

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
        messages: apiMessages.map((m) => ({ role: m.role, content: m.content })),
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

  // Extract creative_job_id from message content
  const extractCreativeJobId = (content: string): string | null => {
    const match = content.match(/\[creative_job_id:([^\]]+)\]/);
    return match ? match[1] : null;
  };

  // Clean content for display (remove internal markers)
  const cleanContent = (content: string): string => {
    return content.replace(/\n?\n?\[creative_job_id:[^\]]+\]/g, "").trim();
  };

  const handleContextCardSelect = useCallback((text: string) => {
    setInput(text);
    // Auto-send
    setTimeout(() => {
      const fakeMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
      setMessages(fakeMessages);
      setIsStreaming(true);
      if (conversationId) {
        saveMessage(conversationId, "user", text);
      }
      let assistantContent = "";
      const apiMessages = fakeMessages.filter((_, i) => i > 0);
      streamChat({
        messages: apiMessages.map((m) => ({ role: m.role, content: m.content })),
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
          if (assistantContent && conversationId) {
            await saveMessage(conversationId, "assistant", assistantContent);
          }
        },
      }).catch((e) => {
        setIsStreaming(false);
        const errorMsg = `❌ ${e instanceof Error ? e.message : "Erro ao conectar com a IA."}`;
        setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
      });
    }, 0);
    setInput("");
  }, [messages, analysis, conversationId, isStreaming]);

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
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateCreative}
          disabled={generatingCreative}
        >
          {generatingCreative ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Gerar Criativo
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/new-analysis">
            <Plus className="h-4 w-4 mr-2" /> Novo chat
          </Link>
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-auto py-6 space-y-4">
        {messages.map((msg, i) => {
          const hasImage = !!msg.image_url;
          const expired = hasImage && isImageExpired(msg.expires_at);
          const creativeJobId = extractCreativeJobId(msg.content);
          const rawContent = cleanContent(msg.content);
          const parsed = msg.role === "assistant" ? parseContextCards(rawContent) : null;
          const displayContent = parsed ? parsed.textWithoutCards : rawContent;
          const isLastAssistant = msg.role === "assistant" && i === messages.length - 1;

          return (
            <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user" ? "bg-primary text-primary-foreground" : "glass-card"
              }`}>
                {msg.role === "assistant" ? (
                  <>
                    <TypewriterMarkdown
                      content={displayContent}
                      isStreaming={isStreaming && isLastAssistant}
                      className="prose prose-sm prose-invert max-w-none prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-headings:text-foreground"
                    />
                    {parsed && parsed.cards.length > 0 && !isStreaming && (
                      <ContextCards
                        cards={parsed.cards}
                        onSelect={handleContextCardSelect}
                        disabled={isStreaming || generatingCreative}
                      />
                    )}
                    {/* Render image inline */}
                    {hasImage && !expired && (
                      <div className="mt-3">
                        <img
                          src={msg.image_url!}
                          alt="Criativo gerado"
                          className="w-full max-w-[320px] rounded-lg border border-border/50"
                        />
                        {creativeJobId && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button variant="hero" size="sm" asChild>
                              <Link to={`/app/creative-studio/${creativeJobId}?analysis_id=${id}&conversation_id=${conversationId}`}>
                                Abrir no Estúdio <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Expired image */}
                    {hasImage && expired && (
                      <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-muted-foreground text-xs">
                        <ImageIcon className="h-4 w-4 shrink-0" />
                        <span>Imagem expirada</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
            </motion.div>
          );
        })}
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
