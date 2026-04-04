import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisRequest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft, Target, Loader2, Plus, Sparkles, ImageIcon } from "lucide-react";
import { streamChat } from "@/lib/streamChat";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  type ChatMessage,
  saveMessage,
  isNearBottom,
  scrollToBottom,
  autoResizeTextarea,
} from "@/lib/chatHelpers";
import { ChatMessageBubble, ChatLoadingBubble } from "@/components/ChatMessageBubble";

const buildGreeting = (data: AnalysisRequest) =>
  `Olá! Sou o **Estrategista-Chefe** da Ágora. Analisei sua campanha "${data.title || "sem título"}" e o score geral ficou em **${Number(data.score_overall ?? 0).toFixed(0)}/100**.\n\nPosso ajudá-lo com:\n- 🧠 **Neuromarketing** — vieses cognitivos e gatilhos para seu público\n- 🎯 **Oferta** — Fórmula de Hormozi, proposta de valor, pricing\n- 📊 **Performance** — KPIs, funil, canais e segmentação\n- 👥 **Público-alvo** — comportamento geracional e segmentação\n\nO que gostaria de explorar?`;

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUserNearBottomRef = useRef(true);

  useEffect(() => {
    if (!id || !user) return;

    const loadData = async () => {
      const { data: analysisData } = await supabase
        .from("analysis_requests")
        .select("*")
        .eq("id", id)
        .single();
      setAnalysis(analysisData);

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
            })),
          );
        } else if (analysisData) {
          const greeting = buildGreeting(analysisData);
          setMessages([{ role: "assistant", content: greeting }]);
          await saveMessage(convId, "assistant", greeting);
        }
      } else if (analysisData) {
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

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) isUserNearBottomRef.current = isNearBottom(el);
  }, []);

  useEffect(() => {
    if (isUserNearBottomRef.current) scrollToBottom(scrollContainerRef.current);
  }, [messages]);

  const handleGenerateCreative = useCallback(async () => {
    if (!id || generatingCreative || !conversationId) return;
    setGeneratingCreative(true);

    const genMsg: ChatMessage = {
      role: "assistant",
      content: "🎨 Gerando criativo com IA... Isso pode levar alguns segundos.",
    };
    setMessages((prev) => [...prev, genMsg]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-creative", {
        body: { analysis_id: id, conversation_id: conversationId, format: "1080x1080" },
      });
      if (error) throw error;

      const imageUrl = data?.image_url || null;
      const creativeJobId = data?.creative_job_id || null;
      const imageFailed = data?.image_generation_failed === true;
      const expiresAt = imageUrl
        ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      let msgContent = imageFailed
        ? "⚠️ Criativo gerado com textos, mas a imagem de fundo não pôde ser criada."
        : "✅ Imagem gerada com sucesso!";
      if (creativeJobId) msgContent += `\n\n[creative_job_id:${creativeJobId}]`;

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
            : m,
        ),
      );

      await saveMessage(conversationId, "assistant", msgContent, imageUrl, expiresAt);
      toast[imageFailed ? "warning" : "success"](
        imageFailed
          ? "Imagem de fundo não gerada. Textos aplicados."
          : "Criativo gerado com sucesso!",
      );
    } catch (e: any) {
      console.error("Erro ao gerar criativo:", e);
      const errorMsg = "❌ Erro ao gerar criativo. Tente novamente.";
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 && m.content.includes("Gerando criativo")
            ? { ...m, content: errorMsg }
            : m,
        ),
      );
      await saveMessage(conversationId, "assistant", errorMsg);
      toast.error("Erro ao gerar criativo.");
    } finally {
      setGeneratingCreative(false);
    }
  }, [id, generatingCreative, conversationId]);

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const userMsg = (overrideText || input).trim();
      if (!userMsg || isStreaming || !conversationId) return;
      if (!overrideText) setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      const newMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content: userMsg },
      ];
      setMessages(newMessages);
      setIsStreaming(true);
      isUserNearBottomRef.current = true;

      await saveMessage(conversationId, "user", userMsg);

      let assistantContent = "";

      try {
        const apiMessages = newMessages.filter((_, i) => i > 0);

        await streamChat({
          messages: apiMessages.map((m) => ({ role: m.role, content: m.content })),
          functionName: "strategist-chat",
          extraBody: {
            analysisContext: analysis
              ? {
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
                }
              : undefined,
          },
          onDelta: (chunk) => {
            assistantContent += chunk;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "user") {
                return [...prev, { role: "assistant", content: assistantContent }];
              }
              return [
                ...prev.slice(0, -1),
                { role: "assistant", content: assistantContent },
              ];
            });
          },
          onDone: async () => {
            setIsStreaming(false);
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
    },
    [input, isStreaming, conversationId, messages, analysis],
  );

  const handleContextCardSelect = useCallback(
    (text: string) => {
      handleSend(text);
    },
    [handleSend],
  );

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando...
      </div>
    );

  const isBusy = isStreaming || generatingCreative;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background md:relative md:inset-auto md:z-auto md:h-[calc(100vh-4rem)] md:max-w-3xl md:mx-auto">
      {/* Mobile header */}
      <div className="flex md:hidden items-center gap-3 px-3 py-3 border-b border-border/40 bg-background">
        <Link
          to={`/app/analysis/${id}/report`}
          className="shrink-0 p-1 -ml-1 rounded-lg hover:bg-accent/50"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-base font-bold truncate">Estrategista-Chefe</h2>
      </div>

      {/* Desktop header */}
      <div className="hidden md:flex items-center gap-4 px-4 py-3 border-b border-border/50 shrink-0">
        <Link
          to={`/app/analysis/${id}/report`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-sm">Estrategista-Chefe</h2>
          <p className="text-xs text-muted-foreground">
            Refinamento contextual da análise
          </p>
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
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto py-6 px-4 space-y-4"
      >
        {messages.map((msg, i) => (
          <ChatMessageBubble
            key={i}
            message={msg}
            index={i}
            isLastAssistant={
              msg.role === "assistant" && i === messages.length - 1
            }
            isStreaming={isStreaming}
            isBusy={isBusy}
            onContextCardSelect={handleContextCardSelect}
            studioLinkParams={`analysis_id=${id}&conversation_id=${conversationId}`}
          />
        ))}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <ChatLoadingBubble />
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 flex gap-2 px-3 md:px-4 py-3 border-t border-border/40">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            autoResizeTextarea(e.target);
          }}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            !e.shiftKey &&
            (e.preventDefault(), handleSend())
          }
          placeholder="Pergunte sobre a análise..."
          rows={1}
          disabled={isBusy}
          className="flex-1 resize-none rounded-xl border border-input bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        <Button
          variant="hero"
          size="icon"
          onClick={() => handleSend()}
          disabled={isBusy || !input.trim()}
          className="shrink-0 h-auto"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
