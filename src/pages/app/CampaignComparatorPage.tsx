import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, X, FileText, Loader2, GitCompareArrows } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { TypewriterMarkdown } from "@/components/TypewriterMarkdown";
import { RichMarkdownRenderer } from "@/components/RichMarkdownRenderer";
import { AgoraIcon } from "@/components/AgoraIcon";
import { parseContextCards } from "@/lib/parseContextCards";
import { ContextCards } from "@/components/ContextCards";
import { ChatMessageActions } from "@/components/ChatMessageActions";
import { parseDashboardBlocks } from "@/lib/parseDashboardBlocks";
import { ComparatorDashboard } from "@/components/comparator/ComparatorDashboard";

type ChatMessage = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/comparator-chat`;

type FileContent = { name: string; type: string; content: string; isBase64: boolean };

async function streamComparatorChat({
  messages,
  onDelta,
  onDone,
  fileContents,
}: {
  messages: ChatMessage[];
  onDelta: (delta: string) => void;
  onDone: () => void;
  fileContents?: FileContent[];
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, fileContents }),
  });

  if (!resp.ok || !resp.body) {
    if (resp.status === 429) toast.error("Muitas requisições. Aguarde um momento.");
    else if (resp.status === 402) toast.error("Créditos insuficientes.");
    else toast.error("Erro ao conectar com a IA.");
    onDone();
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { streamDone = true; break; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

const readFileContent = async (file: File): Promise<FileContent> => {
  const textTypes = [".txt", ".csv", ".md", ".json", ".xml", ".html"];
  const isText = textTypes.some((ext) => file.name.toLowerCase().endsWith(ext)) || file.type.startsWith("text/");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (isText) {
      reader.onload = () => resolve({ name: file.name, type: file.type || "text/plain", content: reader.result as string, isBase64: false });
      reader.onerror = reject;
      reader.readAsText(file);
    } else {
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve({ name: file.name, type: file.type || "application/octet-stream", content: base64, isBase64: true });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }
  });
};

export default function CampaignComparatorPage() {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Record<number, "like" | "dislike">>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isUserNearBottomRef = useRef(true);

  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  const conversationIdRef = useRef<string | null>(conversationId);
  conversationIdRef.current = conversationId;

  const hasMessages = messages.length > 0;

  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    isUserNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (isUserNearBottomRef.current && el) {
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }
  }, [messages]);

  const pendingCardTextRef = useRef<string | null>(null);

  const handleContextCardSelect = useCallback((text: string) => {
    pendingCardTextRef.current = text;
    setInput(text);
  }, []);

  useEffect(() => {
    if (pendingCardTextRef.current && input === pendingCardTextRef.current && !isStreaming) {
      pendingCardTextRef.current = null;
      handleSend();
    }
  }, [input]);

  const handleFeedback = useCallback((index: number, type: "like" | "dislike") => {
    setFeedbacks((prev) => ({
      ...prev,
      [index]: prev[index] === type ? undefined! : type,
    }));
  }, []);

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (conversationIdRef.current) return conversationIdRef.current;
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, context_type: "comparator", title: "Comparação de campanhas" })
      .select("id")
      .single();

    if (error || !data) throw new Error("Failed to create conversation");
    const newId = data.id;
    conversationIdRef.current = newId;
    setConversationId(newId);
    return newId;
  }, [user]);

  const persistMessage = useCallback(async (convId: string, role: string, content: string) => {
    await supabase.from("chat_messages").insert({ conversation_id: convId, role, content } as any);
  }, []);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(new File([file], `imagem-colada-${Date.now()}.png`, { type: file.type }));
        }
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      setFiles((prev) => [...prev, ...imageFiles]);
      toast.success(`${imageFiles.length} imagem(ns) colada(s)`);
    }
  }, []);

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (isStreaming) return;
    const text = input.trim();
    if (!text && files.length === 0) return;

    let displayContent = text;
    let fileContents: FileContent[] = [];
    const pendingFiles = [...files];

    if (pendingFiles.length > 0) {
      try {
        fileContents = await Promise.all(pendingFiles.map(readFileContent));
        const fileNames = pendingFiles.map((f) => f.name).join(", ");
        displayContent += `\n\n📎 Arquivos: ${fileNames}`;
      } catch {
        toast.error("Erro ao ler arquivos.");
        return;
      }
    }

    const userMsg: ChatMessage = { role: "user", content: displayContent };
    const currentMessages = [...messagesRef.current, userMsg];
    setMessages(currentMessages);
    setInput("");
    setFiles([]);
    setIsStreaming(true);
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const convId = await ensureConversation();
      await persistMessage(convId, "user", displayContent);

      let assistantSoFar = "";
      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      await streamComparatorChat({
        messages: currentMessages,
        onDelta: upsertAssistant,
        onDone: async () => {
          setIsStreaming(false);
          setLoading(false);
          if (assistantSoFar) {
            await persistMessage(convId, "assistant", assistantSoFar);
          }
        },
        fileContents: fileContents.length > 0 ? fileContents : undefined,
      });
    } catch (err) {
      console.error(err);
      setIsStreaming(false);
      setLoading(false);
      toast.error("Erro ao processar mensagem.");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 md:px-4 py-3 border-b border-border/40">
        <div className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-xl bg-primary/10">
          <GitCompareArrows className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Comparar Campanhas</h1>
          <p className="text-xs text-muted-foreground">Compare campanhas e receba diagnósticos estratégicos</p>
        </div>
      </div>

      {/* Chat area */}
      <div
        ref={chatScrollRef}
        onScroll={handleChatScroll}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
      >
        {!hasMessages && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center gap-4"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <GitCompareArrows className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Comparador de Campanhas</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Descreva 2 ou mais campanhas que deseja comparar. Você pode colar textos, métricas, prints ou links. O Ágora vai analisar e entregar um diagnóstico estratégico completo.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 max-w-lg w-full">
              {[
                "Quero comparar campanhas das minhas redes sociais",
                "Comparar campanhas de concorrentes a partir de prints",
                "Tenho métricas de 2 campanhas para comparar",
                "Comparar estratégias de marketing de marcas diferentes",
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(suggestion); }}
                  className="text-left text-sm p-3 rounded-xl border border-border/40 bg-card/50 hover:bg-primary/5 hover:border-primary/30 transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          const isLastAssistant = !isUser && idx === messages.length - 1;
          const parsed = !isUser ? parseContextCards(msg.content) : null;
          const hasCards = parsed && parsed.cards.length > 0;
          const displayContent = parsed ? parsed.textWithoutCards : msg.content;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${isUser ? "justify-end" : ""}`}
            >
              {!isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-1">
                  <AgoraIcon size={18} />
                </div>
              )}
              <div className={`max-w-[85%] ${isUser ? "order-first" : ""}`}>
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    isUser
                      ? "bg-primary text-primary-foreground ml-auto"
                      : "bg-card border border-border/40"
                  }`}
                >
                  {isUser ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <>
                      {parseDashboardBlocks(displayContent).map((block, bi) =>
                        block.type === "dashboard" ? (
                          <ComparatorDashboard key={bi} data={block.data} />
                        ) : (
                          <div key={bi} className="prose prose-sm dark:prose-invert max-w-none">
                            <RichMarkdownRenderer content={block.content} />
                          </div>
                        )
                      )}
                    </>
                  )}
                </div>

                {hasCards && (
                  <ContextCards
                    cards={parsed!.cards}
                    onSelect={handleContextCardSelect}
                    disabled={isStreaming}
                  />
                )}

                {!isUser && !isStreaming && (
                  <ChatMessageActions
                    content={msg.content}
                    messageIndex={idx}
                    role="assistant"
                    feedback={feedbacks[idx]}
                    onFeedback={handleFeedback}
                  />
                )}
              </div>
            </motion.div>
          );
        })}

        {loading && !messages.some((m) => m.role === "assistant" && messages.indexOf(m) === messages.length - 1) && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <AgoraIcon size={18} />
            </div>
            <div className="bg-card border border-border/40 rounded-2xl px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border/40 px-4 py-3">
        {files.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2.5 py-1.5 text-xs">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="max-w-[120px] truncate">{f.name}</span>
                <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.csv,.md,.json"
            className="hidden"
            onChange={handleFileAdd}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 h-10 w-10 rounded-xl"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Descreva as campanhas que quer comparar..."
              rows={1}
              disabled={isStreaming}
              className="w-full resize-none rounded-xl border border-border/40 bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
              style={{ maxHeight: 200 }}
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={isStreaming || (!input.trim() && files.length === 0)}
            size="icon"
            className="shrink-0 h-10 w-10 rounded-xl"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
