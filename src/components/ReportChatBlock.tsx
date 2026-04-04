import { useState, useRef, useCallback, useEffect, ChangeEvent } from "react";
import { Send, Loader2, Sparkles, Search, BarChart3, Paperclip, X, Target, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { streamChat } from "@/lib/streamChat";
import { AnalysisRequest } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  type ChatMessage,
  saveMessage,
  isNearBottom,
  scrollToBottom as scrollElToBottom,
  autoResizeTextarea,
} from "@/lib/chatHelpers";
import { ChatMessageBubble, ChatLoadingBubble } from "@/components/ChatMessageBubble";

interface FileAttachment {
  file: File;
  preview?: string;
}

const ACTION_OPTIONS = [
  { label: "Gerar criativos", icon: Sparkles, action: "creative" as const },
  { label: "Pesquisa de mercado", icon: Search, action: "chat" as const, prompt: "Faça uma pesquisa de mercado detalhada com base nos dados desta campanha." },
  { label: "Gerar campanha", icon: BarChart3, action: "chat" as const, prompt: "Gere uma campanha completa otimizada com base nos insights desta análise." },
];

interface ReportChatBlockProps {
  analysis: AnalysisRequest;
}

const buildGreeting = (data: AnalysisRequest) =>
  `Olá! Sou o **Estrategista-Chefe** da Ágora. Analisei sua campanha "${data.title || "sem título"}" e o score geral ficou em **${Number(data.score_overall ?? 0).toFixed(0)}/100**.\n\nPosso ajudá-lo com:\n- 🧠 **Neuromarketing** — vieses cognitivos e gatilhos para seu público\n- 🎯 **Oferta** — Fórmula de Hormozi, proposta de valor, pricing\n- 📊 **Performance** — KPIs, funil, canais e segmentação\n- 👥 **Público-alvo** — comportamento geracional e segmentação\n\nO que gostaria de explorar?`;

export function ReportChatBlock({ analysis }: ReportChatBlockProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isGeneratingCreative, setIsGeneratingCreative] = useState(false);
  const isBusy = isStreaming || isGeneratingCreative;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldAutoScrollRef = useRef(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  useEffect(() => {
    if (!user || loaded) return;
    const load = async () => {
      const { data: existingConv } = await supabase
        .from("conversations" as any)
        .select("*")
        .eq("analysis_request_id", analysis.id)
        .eq("context_type", "report-chat")
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
        } else {
          const greeting = buildGreeting(analysis);
          setMessages([{ role: "assistant", content: greeting }]);
          await saveMessage(convId, "assistant", greeting);
        }
      } else {
        const { data: newConv } = await supabase
          .from("conversations" as any)
          .insert({
            user_id: user.id,
            analysis_request_id: analysis.id,
            context_type: "report-chat",
            title: analysis.title || "Chat Estrategista",
          } as any)
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
      setTimeout(() => scrollElToBottom(scrollContainerRef.current), 100);
    };
    load();
  }, [user, analysis, loaded]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    scrollElToBottom(scrollContainerRef.current);
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setShowScrollDown(!isNearBottom(el, 150));
  }, []);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 25 * 1024 * 1024;
    const valid = files.filter((f) => f.size <= maxSize);
    const newAttachments: FileAttachment[] = valid.map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const att = prev[index];
      if (att.preview) URL.revokeObjectURL(att.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const generateCreative = useCallback(
    async (userPrompt?: string) => {
      if (isGeneratingCreative || !conversationId) return;
      shouldAutoScrollRef.current = true;
      setIsGeneratingCreative(true);

      if (userPrompt?.trim()) {
        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      }

      const genMsg: ChatMessage = {
        role: "assistant",
        content: "🎨 Gerando criativo com IA... Isso pode levar alguns segundos.",
      };
      setMessages((prev) => [...prev, genMsg]);

      try {
        const { data, error } = await supabase.functions.invoke("generate-creative", {
          body: {
            analysis_id: analysis.id,
            conversation_id: conversationId,
            format: "1080x1080",
            user_prompt: userPrompt?.trim() || undefined,
          },
        });

        if (error) throw error;
        if (data?.error) {
          toast.error(data.error);
          return;
        }

        const imageUrl = data?.image_url || null;
        const creativeJobId = data?.creative_job_id || null;
        const imageFailed = data?.image_generation_failed === true;
        const expiresAt = imageUrl
          ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
          : null;

        let msgContent = imageFailed
          ? "⚠️ Criativo gerado com textos, mas a imagem de fundo não pôde ser criada."
          : "✅ Criativo gerado com sucesso!";
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
            : "Criativo gerado! Edite os textos clicando neles.",
        );
      } catch (err) {
        console.error("Creative generation error:", err);
        const errorMsg = "❌ Erro ao gerar criativo. Tente novamente.";
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 && m.content.includes("Gerando criativo")
              ? { ...m, content: errorMsg }
              : m,
          ),
        );
        await saveMessage(conversationId, "assistant", errorMsg);
        toast.error("Erro ao gerar criativo. Tente novamente.");
      } finally {
        setIsGeneratingCreative(false);
        shouldAutoScrollRef.current = false;
      }
    },
    [analysis, isGeneratingCreative, conversationId],
  );

  const handleActionClick = useCallback(
    (action: (typeof ACTION_OPTIONS)[number]) => {
      if (action.action === "creative") {
        generateCreative(input);
      } else if (action.prompt) {
        sendMessage(action.prompt);
      }
    },
    [generateCreative, input],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if ((!text.trim() && attachments.length === 0) || isStreaming || isGeneratingCreative || !conversationId) return;

      let userMsg = text.trim();
      if (attachments.length > 0) {
        const fileNames = attachments.map((a) => a.file.name).join(", ");
        userMsg = userMsg
          ? `${userMsg}\n\n📎 Arquivos anexados: ${fileNames}`
          : `📎 Arquivos anexados: ${fileNames}`;
      }

      setInput("");
      setAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      shouldAutoScrollRef.current = true;
      const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
      setMessages(newMessages);
      setIsStreaming(true);

      await saveMessage(conversationId, "user", userMsg);

      let assistantContent = "";

      try {
        const apiMessages = newMessages.filter((_, i) => i > 0);
        await streamChat({
          messages: apiMessages.map((m) => ({ role: m.role, content: m.content })),
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
              if (last?.role === "user")
                return [...prev, { role: "assistant", content: assistantContent }];
              return [...prev.slice(0, -1), { role: "assistant", content: assistantContent }];
            });
          },
          onDone: async () => {
            setIsStreaming(false);
            shouldAutoScrollRef.current = false;
            if (assistantContent && conversationId) {
              await saveMessage(conversationId, "assistant", assistantContent);
            }
          },
        });
      } catch (e) {
        setIsStreaming(false);
        shouldAutoScrollRef.current = false;
        const errorMsg = `❌ ${e instanceof Error ? e.message : "Erro ao conectar com a IA."}`;
        setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
        await saveMessage(conversationId, "assistant", errorMsg);
      }
    },
    [isStreaming, isGeneratingCreative, messages, analysis, conversationId, attachments],
  );

  const handleContextCardSelect = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage],
  );

  return (
    <div className="glass-card p-6 flex flex-col" style={{ maxHeight: "750px" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Target className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="section-label flex items-center gap-2">Estrategista-Chefe</h3>
          <p className="text-xs text-muted-foreground truncate">{analysis.title}</p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative flex-1 min-h-0 overflow-auto space-y-3 mb-4 pr-1"
      >
        {showScrollDown && (
          <button
            onClick={() => scrollElToBottom(scrollContainerRef.current)}
            className="sticky top-0 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/95 backdrop-blur-sm border border-border/60 shadow-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowDown className="h-3 w-3" />
            Mais recente
          </button>
        )}
        {!loaded ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatMessageBubble
              key={i}
              message={msg}
              index={i}
              isLastAssistant={msg.role === "assistant" && i === messages.length - 1}
              isStreaming={isStreaming}
              isBusy={isBusy}
              onContextCardSelect={handleContextCardSelect}
              variant="compact"
            />
          ))
        )}

        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <ChatLoadingBubble variant="compact" />
        )}

        <AnimatePresence>
          {isGeneratingCreative && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 gap-3"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Gerando criativo com IA...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {ACTION_OPTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => handleActionClick(action)}
            disabled={isBusy || !conversationId}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border/50 bg-accent/30 hover:bg-accent/60 text-foreground transition-colors disabled:opacity-50"
          >
            <action.icon className="h-3.5 w-3.5" />
            {action.label}
          </button>
        ))}
      </div>

      {/* Attachment previews */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2 mb-3"
          >
            {attachments.map((att, i) => (
              <div
                key={i}
                className="relative group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-accent/30 text-xs"
              >
                {att.preview ? (
                  <img
                    src={att.preview}
                    alt={att.file.name}
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="max-w-[120px] truncate">{att.file.name}</span>
                <button
                  onClick={() => removeAttachment(i)}
                  className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className="shrink-0 p-2.5 rounded-xl border border-input bg-card text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-50"
          title="Anexar arquivo"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          disabled={isBusy}
          onChange={(e) => {
            setInput(e.target.value);
            autoResizeTextarea(e.target, 120);
          }}
          onKeyDown={(e) =>
            e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage(input))
          }
          placeholder={isBusy ? "Aguarde..." : "Pergunte qualquer coisa sobre a análise..."}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        <Button
          variant="hero"
          size="icon"
          onClick={() => sendMessage(input)}
          disabled={isBusy || (!input.trim() && attachments.length === 0) || !conversationId}
          className="shrink-0 h-10 w-10"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
