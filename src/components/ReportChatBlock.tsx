import { useState, useRef, useCallback, useEffect, ChangeEvent } from "react";
import { Send, Loader2, Sparkles, Search, BarChart3, Paperclip, X, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { streamChat } from "@/lib/streamChat";
import { AnalysisRequest } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CreativeEditor } from "@/components/CreativeEditor";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface FileAttachment {
  file: File;
  preview?: string;
}

interface CreativeData {
  strategist_output: any;
  image_url: string;
  editable_html: string;
  creative_job_id: string | null;
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
  const [creativeData, setCreativeData] = useState<CreativeData | null>(null);
  const [isGeneratingCreative, setIsGeneratingCreative] = useState(false);
  const [creativeMode, setCreativeMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveMessage = async (convId: string, role: string, content: string) => {
    await supabase.from("chat_messages" as any).insert({ conversation_id: convId, role, content } as any);
  };

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
          setMessages((dbMessages as any[]).map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })));
        } else {
          const greeting = buildGreeting(analysis);
          setMessages([{ role: "assistant", content: greeting }]);
          await saveMessage(convId, "assistant", greeting);
        }
      } else {
        const { data: newConv } = await supabase
          .from("conversations" as any)
          .insert({ user_id: user.id, analysis_request_id: analysis.id, context_type: "report-chat", title: analysis.title || "Chat Estrategista" } as any)
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
  }, [user, analysis, loaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 25 * 1024 * 1024;
    const valid = files.filter(f => f.size <= maxSize);
    const newAttachments: FileAttachment[] = valid.map(file => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => {
      const att = prev[index];
      if (att.preview) URL.revokeObjectURL(att.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Generate creative via edge function
  const generateCreative = useCallback(async (userPrompt?: string) => {
    if (isGeneratingCreative) return;
    setIsGeneratingCreative(true);
    setCreativeData(null);
    setCreativeMode(false);

    // Add user message to chat if there's a prompt
    if (userPrompt && conversationId) {
      const creativeMsg = `🎨 *Gerar criativo:* ${userPrompt}`;
      setMessages(prev => [...prev, { role: "user", content: creativeMsg }]);
      await saveMessage(conversationId, "user", creativeMsg);
    }

    try {
      const { data, error } = await supabase.functions.invoke("generate-creative", {
        body: {
          analysis_id: analysis.id,
          conversation_id: conversationId,
          format: "1080x1080",
          user_prompt: userPrompt || "",
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.editable_html) {
        setCreativeData({
          strategist_output: data.strategist_output,
          image_url: data.image_url,
          editable_html: data.editable_html,
          creative_job_id: data.creative_job_id,
        });
        toast.success("Criativo gerado com base na sua campanha! Edite os textos clicando neles.");
      } else {
        toast.error("Não foi possível gerar o criativo. Tente novamente.");
      }
    } catch (err) {
      console.error("Creative generation error:", err);
      toast.error("Erro ao gerar criativo. Tente novamente.");
    } finally {
      setIsGeneratingCreative(false);
    }
  }, [analysis, isGeneratingCreative, conversationId, messages]);

  const handleActionClick = useCallback((action: typeof ACTION_OPTIONS[number]) => {
    if (action.action === "creative") {
      setCreativeMode(prev => !prev);
    } else if (action.prompt) {
      sendMessage(action.prompt);
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if ((!text.trim() && attachments.length === 0) || isStreaming || !conversationId) return;

    // If creative mode is active, redirect to creative generation
    if (creativeMode) {
      generateCreative(text.trim());
      setInput("");
      setAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      return;
    }

    let userMsg = text.trim();
    if (attachments.length > 0) {
      const fileNames = attachments.map(a => a.file.name).join(", ");
      userMsg = userMsg ? `${userMsg}\n\n📎 Arquivos anexados: ${fileNames}` : `📎 Arquivos anexados: ${fileNames}`;
    }

    setInput("");
    setAttachments([]);
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
          if (assistantContent && conversationId) {
            await saveMessage(conversationId, "assistant", assistantContent);
          }
        },
      });
    } catch (e) {
      setIsStreaming(false);
      const errorMsg = `❌ ${e instanceof Error ? e.message : "Erro ao conectar com a IA."}`;
      setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
      await saveMessage(conversationId, "assistant", errorMsg);
    }
  }, [input, isStreaming, messages, analysis, conversationId, attachments, creativeMode, generateCreative]);

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Target className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="section-label flex items-center gap-2">Estrategista-Chefe</h3>
          <p className="text-xs text-muted-foreground truncate">{analysis.title}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="max-h-[500px] overflow-auto space-y-3 mb-4 pr-1">
        {!loaded ? (
          <div className="flex items-center justify-center h-24">
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

      {/* Creative Editor - shown when creative is generated */}
      <AnimatePresence>
        {isGeneratingCreative && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-12 gap-3 mb-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Gerando criativo com IA...</p>
            <p className="text-xs text-muted-foreground/60">Isso pode levar alguns segundos</p>
          </motion.div>
        )}
      </AnimatePresence>

      {creativeData && !isGeneratingCreative && (
        <div className="mb-4">
          <CreativeEditor
            strategistOutput={creativeData.strategist_output}
            imageUrl={creativeData.image_url}
            editableHtml={creativeData.editable_html}
            creativeJobId={creativeData.creative_job_id}
            onRegenerate={generateCreative}
            isRegenerating={isGeneratingCreative}
          />
        </div>
      )}

      {/* Action chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {ACTION_OPTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => handleActionClick(action)}
            disabled={isStreaming || isGeneratingCreative || !conversationId}
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
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2 mb-3">
            {attachments.map((att, i) => (
              <div key={i} className="relative group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-accent/30 text-xs">
                {att.preview ? (
                  <img src={att.preview} alt={att.file.name} className="h-8 w-8 rounded object-cover" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="max-w-[120px] truncate">{att.file.name}</span>
                <button onClick={() => removeAttachment(i)} className="ml-1 text-muted-foreground hover:text-foreground transition-colors">
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
          disabled={isStreaming}
          className="shrink-0 p-2.5 rounded-xl border border-input bg-card text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-50"
          title="Anexar arquivo"
        >
          <Paperclip className="h-4 w-4" />
        </button>
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
        <Button variant="hero" size="icon" onClick={() => sendMessage(input)} disabled={(isStreaming || (!input.trim() && attachments.length === 0)) || !conversationId} className="shrink-0 h-auto">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
