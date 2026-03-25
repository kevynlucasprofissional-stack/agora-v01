import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, X, FileText, Loader2, LayoutGrid, Users, Zap, BarChart3, Target, Check, Sparkles, Search, ImageIcon, Pencil } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { TypewriterMarkdown } from "@/components/TypewriterMarkdown";
import { AGENT_INFO, AgentKind } from "@/types/database";
import { ExternalLink } from "lucide-react";
import { ChatMessageActions } from "@/components/ChatMessageActions";
import { AgoraIcon } from "@/components/AgoraIcon";
import { parseContextCards } from "@/lib/parseContextCards";
import { ContextCards } from "@/components/ContextCards";

type FlowStep = "intake" | "uploading" | "processing" | "completed";
type ChatMessage = { role: "user" | "assistant"; content: string; image_url?: string | null; expires_at?: string | null };

const agentOrder: AgentKind[] = ["master_orchestrator", "sociobehavioral", "offer_engineer", "performance_scientist", "chief_strategist"];
const agentIcons: Record<AgentKind, React.ElementType> = {
  master_orchestrator: LayoutGrid,
  sociobehavioral: Users,
  offer_engineer: Zap,
  performance_scientist: BarChart3,
  chief_strategist: Target,
};

type ActionMode = "creative" | "research" | "campaign" | null;

const ACTION_MODES = [
  { key: "creative" as const, label: "Gerar imagem", icon: ImageIcon, prefix: "[MODO: GERAR IMAGEM] " },
  { key: "research" as const, label: "Pesquisa de mercado", icon: Search, prefix: "[MODO: PESQUISA DE MERCADO] " },
  { key: "campaign" as const, label: "Gerar campanha", icon: BarChart3, prefix: "[MODO: GERAR CAMPANHA] " },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/intake-chat`;

type FileContent = { name: string; type: string; content: string; isBase64: boolean };

async function streamChat({
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
    if (resp.status === 429) {
      toast.error("Muitas requisições. Aguarde um momento.");
    } else if (resp.status === 402) {
      toast.error("Créditos insuficientes.");
    } else {
      toast.error("Erro ao conectar com a IA.");
    }
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

export default function NewAnalysisPage() {
  const { user } = useAuth();
  const { uploadsLimit } = usePlanAccess();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [step, setStep] = useState<FlowStep>("intake");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [currentAgent, setCurrentAgent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(searchParams.get("c"));
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionMode>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [creativeData, setCreativeData] = useState<{
    strategist_output: any;
    image_url: string;
    editable_html: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isUserNearBottomRef = useRef(true);
  const [chatTitle, setChatTitle] = useState("Novo chat");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<number, "like" | "dislike">>({});
  const titleInputRef = useRef<HTMLInputElement>(null);

  const hasMessages = messages.length > 0;

  // Load existing conversation on mount
  useEffect(() => {
    const convId = searchParams.get("c");
    if (convId && user) {
      setConversationId(convId);
      setLoadingHistory(true);
      
      // Load title
      supabase
        .from("conversations")
        .select("title")
        .eq("id", convId)
        .single()
        .then(({ data }) => {
          if (data?.title) setChatTitle(data.title);
        });

      supabase
        .from("chat_messages")
        .select("role, content, image_url, expires_at")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .then(({ data }) => {
          if (data && data.length > 0) {
            const restored = data.map((m: any) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
              image_url: m.image_url || null,
              expires_at: m.expires_at || null,
            }));
            setMessages(restored);
            if (restored.some((m: any) => m.role === "assistant" && m.content.includes("##READY##"))) {
              setIsReady(true);
            }
          }
          setLoadingHistory(false);
        });
    }
  }, [user]);

  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    isUserNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (isUserNearBottomRef.current && el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleRenameChat = useCallback(async (newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed || !conversationId) return;
    setChatTitle(trimmed);
    setIsEditingTitle(false);
    await supabase.from("conversations").update({ title: trimmed }).eq("id", conversationId);
  }, [conversationId]);

  const handleFeedback = useCallback((index: number, type: "like" | "dislike") => {
    setFeedbacks((prev) => ({
      ...prev,
      [index]: prev[index] === type ? undefined! : type,
    }));
  }, []);


  const ensureConversation = useCallback(async (): Promise<string> => {
    if (conversationId) return conversationId;
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, context_type: "intake", title: "Novo chat" })
      .select("id")
      .single();

    if (error || !data) throw new Error("Failed to create conversation");

    setConversationId(data.id);
    setSearchParams({ c: data.id }, { replace: true });
    return data.id;
  }, [conversationId, user, setSearchParams]);

  // Helper: persist a message to DB
  const persistMessage = useCallback(async (
    convId: string,
    role: string,
    content: string,
    imageUrl?: string | null,
    expiresAt?: string | null
  ) => {
    await supabase.from("chat_messages").insert({
      conversation_id: convId,
      role,
      content,
      image_url: imageUrl || null,
      expires_at: expiresAt || null,
    } as any);
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
          // Create a named file from clipboard
          const named = new File([file], `imagem-colada-${Date.now()}.png`, { type: file.type });
          imageFiles.push(named);
        }
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      setFiles((prev) => [...prev, ...imageFiles]);
      toast.success(`${imageFiles.length} imagem(ns) colada(s)`);
    }
  }, []);

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

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

  const readFileContent = async (file: File): Promise<{ name: string; type: string; content: string; isBase64: boolean }> => {
    const textTypes = ['.txt', '.csv', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.tsx'];
    const isText = textTypes.some(ext => file.name.toLowerCase().endsWith(ext)) || file.type.startsWith('text/');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      if (isText) {
        reader.onload = () => resolve({ name: file.name, type: file.type || 'text/plain', content: reader.result as string, isBase64: false });
        reader.onerror = reject;
        reader.readAsText(file);
      } else {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({ name: file.name, type: file.type || 'application/octet-stream', content: base64, isBase64: true });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }
    });
  };
  const generateImage = useCallback(async (userPrompt: string, referenceImages?: { name: string; type: string; content: string }[]) => {
    if (isGeneratingImage) return;
    setIsGeneratingImage(true);
    setCreativeData(null);

    // Show generating message in chat
    const genMsg: ChatMessage = { role: "assistant", content: "🎨 Gerando imagem com IA... Isso pode levar alguns segundos." };
    setMessages((prev) => [...prev, genMsg]);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            user_prompt: userPrompt,
            format: "1080x1080",
            reference_images: referenceImages || [],
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao gerar imagem");
      }

      const data = await resp.json();

      if (data?.editable_html) {
        const imageUrl = data.image_url || null;
        const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

        setCreativeData({
          strategist_output: data.strategist_output,
          image_url: imageUrl,
          editable_html: data.editable_html,
        });

        const imageMessage: ChatMessage = {
          role: "assistant",
          content: "✅ Imagem gerada com sucesso!",
          image_url: imageUrl,
          expires_at: expiresAt,
        };

        // Replace the generating message with the image message
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 && m.content.includes("Gerando imagem")
              ? imageMessage
              : m
          )
        );

        // Persist to DB with image_url and expires_at
        if (conversationId) {
          await persistMessage(conversationId, "assistant", "✅ Imagem gerada com sucesso!", imageUrl, expiresAt);
        }

        toast.success("Imagem gerada! Edite os textos clicando neles.");
      } else {
        throw new Error("Não foi possível gerar a imagem.");
      }
    } catch (err) {
      console.error("Image generation error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao gerar imagem.");
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 && m.content.includes("Gerando imagem")
            ? { ...m, content: "❌ Erro ao gerar imagem. Tente novamente." }
            : m
        )
      );
    } finally {
      setIsGeneratingImage(false);
    }
  }, [messages, isGeneratingImage, conversationId]);

  const handleSend = async () => {
    if (isStreaming || isGeneratingImage) return;

    // Check if creative mode is active — intercept and generate image
    if (activeAction === "creative") {
      const userPrompt = input.trim();
      let displayContent = userPrompt || "Gerar imagem";
      
      // Process attached files for creative mode
      const pendingFiles = [...files];
      let referenceImages: { name: string; type: string; content: string }[] = [];
      
      if (pendingFiles.length > 0) {
        try {
          const results = await Promise.all(pendingFiles.map(readFileContent));
          referenceImages = results
            .filter(f => f.isBase64 && f.type.startsWith("image/"))
            .map(f => ({ name: f.name, type: f.type, content: f.content }));
          const fileNames = pendingFiles.map(f => f.name).join(', ');
          displayContent += `\n\n📎 Imagens de referência: ${fileNames}`;
        } catch (err) {
          console.error("Error reading files:", err);
          toast.error("Erro ao ler arquivo(s).");
        }
      }
      
      const userMsg: ChatMessage = { role: "user", content: displayContent };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setFiles([]);
      setActiveAction(null);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      await generateImage(userPrompt, referenceImages.length > 0 ? referenceImages : undefined);
      return;
    }

    if (!input.trim() && files.length === 0) return;

    // Ensure conversation exists
    let convId: string;
    try {
      convId = await ensureConversation();
    } catch {
      toast.error("Erro ao criar conversa.");
      return;
    }

    // Build user message content with files
    let userDisplayContent = input.trim();
    const activeMode = ACTION_MODES.find(m => m.key === activeAction);
    setActiveAction(null); // Reset action after sending
    const pendingFiles = [...files];
    const fileContents: { name: string; type: string; content: string; isBase64: boolean }[] = [];

    if (pendingFiles.length > 0) {
      try {
        const results = await Promise.all(pendingFiles.map(readFileContent));
        fileContents.push(...results);
        const fileNames = pendingFiles.map(f => f.name).join(', ');
        userDisplayContent = userDisplayContent
          ? `${userDisplayContent}\n\n📎 Arquivos anexados: ${fileNames}`
          : `📎 Arquivos anexados: ${fileNames}`;
      } catch (err) {
        console.error("Error reading files:", err);
        toast.error("Erro ao ler arquivo(s). Tente novamente.");
        return;
      }
    }

    const userMsg: ChatMessage = { role: "user", content: userDisplayContent };
    // Prepend action mode prefix for the AI but show clean message to user
    const messagesForAI = activeMode
      ? [...messages, { role: "user" as const, content: activeMode.prefix + userDisplayContent }]
      : [...messages, userMsg];
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setFiles([]);
    setIsStreaming(true);

    // Persist user message
    persistMessage(convId, "user", userDisplayContent);

    // Update conversation title from first user message (use raw input, not file-appended)
    if (messages.length === 0 || chatTitle === "Novo chat" || chatTitle === "Nova Análise") {
      const titleText = (input.trim() || userDisplayContent).slice(0, 80);
      setChatTitle(titleText);
      supabase.from("conversations").update({ title: titleText }).eq("id", convId);
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

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

      if (assistantSoFar.includes("##READY##")) {
        setIsReady(true);
      }
    };

    try {
      await streamChat({
        messages: messagesForAI,
        onDelta: upsertAssistant,
        onDone: () => {
          setIsStreaming(false);
          // Persist assistant response
          if (assistantSoFar) {
            persistMessage(convId, "assistant", assistantSoFar);
          }
        },
        fileContents: fileContents.length > 0 ? fileContents : undefined,
      });
    } catch (e) {
      console.error(e);
      setIsStreaming(false);
      toast.error("Erro na comunicação com a IA.");
    }
  };

  const getFullPrompt = (): string => {
    return messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n\n");
  };

  const handleStartAnalysis = async () => {
    if (!user) return;
    setLoading(true);

    const fullPrompt = getFullPrompt();
    const { data: analysis, error } = await supabase
      .from("analysis_requests")
      .insert({
        user_id: user.id,
        title: messages[0]?.content.slice(0, 60) || "Nova análise",
        raw_prompt: fullPrompt,
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !analysis) {
      toast.error("Erro ao criar análise.");
      setLoading(false);
      return;
    }

    if (files.length > 0) {
      setStep("uploading");
      for (const file of files) {
        const path = `${user.id}/${analysis.id}/${file.name}`;
        await supabase.storage.from("agora-files").upload(path, file);
        await supabase.from("files").insert({
          user_id: user.id,
          analysis_request_id: analysis.id,
          kind: "user_input",
          bucket_name: "agora-files",
          storage_path: path,
          original_filename: file.name,
          mime_type: file.type || "application/octet-stream",
          file_size_bytes: file.size,
        });
      }
    }

    await runRealAnalysis(analysis.id);
    setLoading(false);
  };

  const runRealAnalysis = async (analysisId: string) => {
    setStep("processing");

    // Animate through agents progressively
    const agentTimers: NodeJS.Timeout[] = [];
    let agentIdx = 0;
    const advanceAgent = () => {
      if (agentIdx < agentOrder.length - 1) {
        agentIdx++;
        setCurrentAgent(agentIdx);
      }
    };
    // Advance agent every ~3s to show progress while AI works
    for (let i = 1; i < agentOrder.length; i++) {
      agentTimers.push(setTimeout(() => { setCurrentAgent(i); }, i * 3000));
    }

    try {
      const fullPrompt = getFullPrompt();
      const fileNames = files.map(f => f.name);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-campaign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            rawPrompt: fullPrompt,
            title: messages[0]?.content.slice(0, 60) || "Nova análise",
            files: fileNames,
          }),
        }
      );

      // Clear animation timers
      agentTimers.forEach(clearTimeout);
      setCurrentAgent(agentOrder.length - 1);

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Erro na análise");
      }

      const { analysis: result } = await resp.json();

      // Update analysis_request with real AI results
      await supabase
        .from("analysis_requests")
        .update({
          status: "completed",
          score_overall: result.score_overall,
          score_sociobehavioral: result.score_sociobehavioral,
          score_offer: result.score_offer,
          score_performance: result.score_performance,
          industry: result.industry,
          primary_channel: result.primary_channel,
          declared_target_audience: result.declared_target_audience,
          region: result.region || null,
          completed_at: new Date().toISOString(),
          normalized_payload: {
            executive_summary: result.executive_summary,
            improvements: result.improvements,
            strengths: result.strengths,
            audience_insights: result.audience_insights,
            market_references: result.market_references,
            marketing_era: result.marketing_era,
            cognitive_biases: result.cognitive_biases,
            hormozi_analysis: result.hormozi_analysis,
            kpi_analysis: result.kpi_analysis,
            timing_analysis: result.timing_analysis,
            brand_sentiment: result.brand_sentiment,
          },
        })
        .eq("id", analysisId);

      setStep("completed");
      setTimeout(() => navigate(`/app/analysis/${analysisId}/report`), 1500);
    } catch (e) {
      agentTimers.forEach(clearTimeout);
      console.error("Analysis error:", e);
      toast.error(e instanceof Error ? e.message : "Erro ao analisar campanha.");

      // Mark as failed
      await supabase
        .from("analysis_requests")
        .update({ status: "failed" })
        .eq("id", analysisId);

      setStep("intake");
      setMessages(messages);
    }
  };

  // Processing / completed view
  if (step === "processing" || step === "completed") {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="text-center mb-12">
          <h1 className="text-2xl font-bold">
            {step === "completed" ? "Análise Concluída!" : "Processando Análise..."}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {step === "completed" ? "Redirecionando para o relatório..." : "Os agentes especialistas estão analisando sua campanha."}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 sm:gap-8 mb-12">
          {agentOrder.map((code, idx) => {
            const Icon = agentIcons[code];
            const info = AGENT_INFO[code];
            const isActive = idx === currentAgent && step === "processing";
            const isDone = idx < currentAgent || step === "completed";

            return (
              <div key={code} className="flex flex-col items-center text-center w-20 sm:w-24">
                <motion.div
                  animate={{ opacity: isDone || isActive ? 1 : 0.3, scale: isActive ? 1.15 : 1 }}
                  transition={{ duration: 0.3 }}
                  className={`relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border-2 transition-colors ${
                    isActive ? "border-primary bg-primary/10" :
                    isDone ? "border-success/50 bg-success/10" : "border-border bg-card"
                  }`}
                >
                  {isDone ? <Check className="h-5 w-5 sm:h-6 sm:w-6 text-success" /> : <Icon className="h-5 w-5 sm:h-6 sm:w-6" />}
                  {isActive && (
                    <div className="absolute -bottom-1 -right-1">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  )}
                </motion.div>
                <span className="mt-2 text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground leading-tight">
                  {info.name}
                </span>
              </div>
            );
          })}
        </div>

        {step === "processing" && (
          <div className="glass-card p-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {AGENT_INFO[agentOrder[currentAgent]].name} está processando...
            </p>
          </div>
        )}
      </div>
    );
  }

  // Chat-style intake view
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Chat title bar */}
      {hasMessages && conversationId && (
        <div className="shrink-0 px-4 py-2 border-b border-border/40 flex items-center gap-2">
          <AgoraIcon size={24} className="shrink-0 rounded-md" />
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              defaultValue={chatTitle}
              autoFocus
              onBlur={(e) => handleRenameChat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameChat((e.target as HTMLInputElement).value);
                if (e.key === "Escape") setIsEditingTitle(false);
              }}
              className="text-sm font-medium bg-transparent border-b border-primary/40 outline-none text-foreground px-1 py-0.5 max-w-[300px]"
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors group"
              title="Renomear conversa"
            >
              <span className="truncate max-w-[300px]">{chatTitle}</span>
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </button>
          )}
        </div>
      )}

      {/* Scrollable chat area */}
      <div ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto px-4">
        <div className="max-w-2xl mx-auto py-6">
          {!hasMessages && !loadingHistory && (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <AgoraIcon size={64} className="mb-6 rounded-2xl" />
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-2 text-center">
                O que você quer analisar?
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base text-center mb-8">
                Descreva sua campanha e nossos agentes farão uma auditoria completa.
              </p>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, idx) => {
            const hasImage = !!msg.image_url;
            const expired = hasImage && msg.expires_at ? new Date(msg.expires_at) < new Date() : false;

            return (
              <div key={idx} className={`group/msg mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="flex flex-col gap-1 max-w-[85%]">
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm sm:text-base ${
                      msg.role === "user"
                        ? "bg-secondary text-secondary-foreground rounded-br-md"
                        : "bg-card border border-border text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <>
                        <TypewriterMarkdown
                          content={msg.content.replace("##READY##", "").trim()}
                          isStreaming={isStreaming && idx === messages.length - 1}
                          className="prose prose-sm max-w-none text-foreground"
                        />
                        {/* Inline image */}
                        {hasImage && !expired && (
                          <div className="mt-3">
                            <img
                              src={msg.image_url!}
                              alt="Imagem gerada"
                              className="w-full max-w-[320px] rounded-lg border border-border/50"
                            />
                            <div className="mt-2 flex justify-center">
                              <Button variant="outline" size="sm" asChild>
                                <Link to={(() => {
                                  const match = msg.content.match(/\[creative_job_id:([^\]]+)\]/);
                                  return match ? `/app/creative-studio/${match[1]}` : "/app/creative-studio";
                                })()}>
                                  Abrir no Estúdio Criativo <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                                </Link>
                              </Button>
                            </div>
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
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <ChatMessageActions
                      content={msg.content.replace("##READY##", "").trim()}
                      messageIndex={idx}
                      role={msg.role}
                      onFeedback={handleFeedback}
                      feedback={feedbacks[idx] || null}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="mb-4 flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Ready CTA */}
          {isReady && !isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center my-6"
            >
              <Button
                onClick={handleStartAnalysis}
                disabled={loading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-xl text-base"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Iniciar Análise Completa
              </Button>
            </motion.div>
          )}

          {isGeneratingImage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 gap-3 mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Gerando imagem com IA...</p>
              <p className="text-xs text-muted-foreground/60">Isso pode levar alguns segundos</p>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Fixed bottom input */}
      <div className="border-t border-border bg-background px-4 py-3">
        <div className="max-w-2xl mx-auto">
          {/* Attached files */}
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="flex flex-wrap gap-2 mb-3"
              >
                {files.map((f, i) => {
                  const isImage = f.type.startsWith("image/");
                  return (
                    <div key={f.name + i} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 text-sm">
                      {isImage ? (
                        <img
                          src={URL.createObjectURL(f)}
                          alt={f.name}
                          className="h-8 w-8 rounded object-cover shrink-0"
                        />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="truncate max-w-[140px]">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)}KB</span>
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive ml-1">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm focus-within:border-primary/50 transition-colors">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Anexar arquivos"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileAdd}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.pptx,.docx,.csv,.txt,image/*"
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                activeAction === "creative" ? "Descreva a imagem que deseja gerar..." :
                activeAction === "research" ? "O que deseja pesquisar?" :
                activeAction === "campaign" ? "Descreva a campanha que deseja gerar..." :
                hasMessages ? "Responda aqui..." : "Descreva sua campanha, produto, público-alvo..."
              }
              rows={1}
              className="flex-1 bg-transparent border-none outline-none resize-none text-sm sm:text-base text-foreground placeholder:text-muted-foreground max-h-[200px]"
            />

            <Button
              size="icon"
              onClick={handleSend}
              disabled={(isStreaming || isGeneratingImage) || (!input.trim() && files.length === 0 && activeAction !== "creative")}
              className="flex-shrink-0 rounded-xl h-10 w-10 bg-primary hover:bg-primary/90"
            >
              {(isStreaming || isGeneratingImage) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex justify-center gap-1.5 sm:gap-2 mt-3">
            {ACTION_MODES.map((a) => {
              const isActive = activeAction === a.key;
              return (
                <button
                  key={a.key}
                  onClick={() => setActiveAction(isActive ? null : a.key)}
                  disabled={isStreaming || isGeneratingImage}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full border text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap disabled:opacity-50 ${
                    isActive
                      ? "border-primary bg-primary/15 text-primary ring-1 ring-primary/30 scale-[1.02]"
                      : "border-border bg-card hover:bg-muted text-foreground"
                  }`}
                >
                  <a.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                  <span>{a.label}</span>
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-2">
            Pressione Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </div>
    </div>
  );
}
