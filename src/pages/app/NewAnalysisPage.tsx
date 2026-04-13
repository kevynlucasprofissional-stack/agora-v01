import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, X, FileText, Loader2, LayoutGrid, Users, Zap, BarChart3, Target, Check, Sparkles, Search, ImageIcon, Pencil } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { AGENT_INFO, AgentKind } from "@/types/database";
import { ExternalLink } from "lucide-react";
import { ChatMessageActions } from "@/components/ChatMessageActions";
import { AgoraIcon } from "@/components/AgoraIcon";
import { ChatMessageBubble, ChatLoadingBubble } from "@/components/ChatMessageBubble";
import { streamChat } from "@/lib/streamChat";
import {
  type ChatMessage,
  saveMessage,
  isNearBottom,
  scrollToBottom,
  autoResizeTextarea,
  cleanMessageContent,
} from "@/lib/chatHelpers";

type FlowStep = "intake" | "uploading" | "processing" | "completed";

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

type FileContent = { name: string; type: string; content: string; isBase64: boolean };

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

  // Refs to avoid stale closures in async handleSend
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  const conversationIdRef = useRef<string | null>(conversationId);
  conversationIdRef.current = conversationId;

  // ── Resilient recovery: detect in-progress analysis on mount ──
  const processingRecoveredRef = useRef(false);

  useEffect(() => {
    if (processingRecoveredRef.current || !user) return;

    // Check URL params first (user was on this page when they left)
    const urlAnalysisId = searchParams.get("aid");
    const urlRunId = searchParams.get("rid");

    if (urlAnalysisId && urlRunId) {
      // Resume from URL params
      processingRecoveredRef.current = true;
      resumeProcessing(urlAnalysisId, urlRunId);
      return;
    }

    // Check if user has any in-progress OR recently-completed analysis
    const checkInProgress = async () => {
      // 1) Check for still-processing analysis
      const { data: processingData } = await supabase
        .from("analysis_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "processing")
        .order("created_at", { ascending: false })
        .limit(1);

      if (processingData && processingData.length > 0) {
        const analysisId = processingData[0].id;
        const { data: runs } = await supabase
          .from("analysis_runs")
          .select("id")
          .eq("analysis_request_id", analysisId)
          .eq("status", "running")
          .order("created_at", { ascending: false })
          .limit(1);

        if (runs && runs.length > 0) {
          processingRecoveredRef.current = true;
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("aid", analysisId);
            next.set("rid", runs[0].id);
            return next;
          }, { replace: true });
          resumeProcessing(analysisId, runs[0].id);
          return;
        }
      }

      // 2) Check for recently-completed analysis (last 5 min) the user may not have seen
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: completedData } = await supabase
        .from("analysis_requests")
        .select("id, completed_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("completed_at", fiveMinAgo)
        .order("completed_at", { ascending: false })
        .limit(1);

      if (completedData && completedData.length > 0) {
        processingRecoveredRef.current = true;
        console.log(`[recovery] Redirecting to recently-completed analysis ${completedData[0].id}`);
        navigate(`/app/analysis/${completedData[0].id}/report`, { replace: true });
      }
    };

    checkInProgress();
  }, [user]);

  const hasMessages = messages.length > 0;
  const isBusy = isStreaming || isGeneratingImage;

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
    isUserNearBottomRef.current = isNearBottom(el);
  }, []);

  useEffect(() => {
    if (isUserNearBottomRef.current) scrollToBottom(chatScrollRef.current);
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
    if (conversationIdRef.current) return conversationIdRef.current;
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, context_type: "intake", title: "Novo chat" })
      .select("id")
      .single();

    if (error || !data) throw new Error("Failed to create conversation");

    const newId = data.id;
    conversationIdRef.current = newId;
    setConversationId(newId);
    // Preserve existing params (especially "t" which is used as component key) to avoid remount
    setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("c", newId);
        return next;
      }, { replace: true });
    }, 0);
    return newId;
  }, [user, setSearchParams]);

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
    autoResizeTextarea(e.target, 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const readFileContent = async (file: File): Promise<FileContent> => {
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
        const imageFailed = data.image_generation_failed === true;
        const expiresAt = imageUrl ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() : null;

        setCreativeData({
          strategist_output: data.strategist_output,
          image_url: imageUrl,
          editable_html: data.editable_html,
        });

        let creativeJobId: string | null = null;
        if (user) {
          const analysisId = searchParams.get("analysis_id") || null;
          const { data: jobData } = await supabase.from("creative_jobs").insert({
            user_id: user.id,
            analysis_request_id: analysisId,
            conversation_id: conversationId,
            image_url: imageUrl,
            strategist_output: data.strategist_output as any,
            format: "1080x1080",
            status: "completed",
            layers_state: {} as any,
          }).select("id").single();
          if (jobData) creativeJobId = jobData.id;
        }

        const jobTag = creativeJobId ? ` [creative_job_id:${creativeJobId}]` : "";
        const messageContent = imageFailed
          ? `⚠️ Criativo gerado com textos, mas a imagem de fundo não pôde ser criada.${jobTag}`
          : `✅ Imagem gerada com sucesso!${jobTag}`;

        const imageMessage: ChatMessage = {
          role: "assistant",
          content: messageContent,
          image_url: imageUrl,
          expires_at: expiresAt,
        };

        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 && m.content.includes("Gerando imagem")
              ? imageMessage
              : m
          )
        );

        if (conversationId) {
          await saveMessage(conversationId, "assistant", messageContent, imageUrl, expiresAt);
        }

        if (imageFailed) {
          toast.warning("Imagem de fundo não gerada. Textos aplicados.");
        } else {
          toast.success("Imagem gerada! Edite os textos clicando neles.");
        }
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

  const pendingCardTextRef = useRef<string | null>(null);

  const handleContextCardSelect = useCallback((text: string) => {
    pendingCardTextRef.current = text;
    setInput(text);
  }, []);

  // Auto-send when a context card option is selected
  useEffect(() => {
    if (pendingCardTextRef.current && input === pendingCardTextRef.current && !isStreaming && !isGeneratingImage) {
      pendingCardTextRef.current = null;
      handleSendDirect();
    }
  }, [input]);

  const handleSendDirect = () => handleSend();

  const handleSend = async () => {
    if (isStreaming || isGeneratingImage) return;

    // Check if creative mode is active — intercept and generate image
    if (activeAction === "creative") {
      const userPrompt = input.trim();
      let displayContent = userPrompt || "Gerar imagem";
      
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
    setActiveAction(null);
    const pendingFiles = [...files];
    const fileContents: FileContent[] = [];

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
    const currentMessages = messagesRef.current;
    const messagesForAI = activeMode
      ? [...currentMessages, { role: "user" as const, content: activeMode.prefix + userDisplayContent }]
      : [...currentMessages, userMsg];
    const updatedMessages = [...currentMessages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setFiles([]);
    setIsStreaming(true);
    isUserNearBottomRef.current = true;

    // Persist user message
    saveMessage(convId, "user", userDisplayContent);

    // Update conversation title from first user message
    if (currentMessages.length === 0 || chatTitle === "Novo chat" || chatTitle === "Nova Análise") {
      const titleText = (input.trim() || userDisplayContent).slice(0, 80);
      setChatTitle(titleText);
      supabase.from("conversations").update({ title: titleText }).eq("id", convId);
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    let assistantSoFar = "";

    try {
      await streamChat({
        messages: messagesForAI.map(m => ({ role: m.role, content: m.content })),
        functionName: "intake-chat",
        extraBody: fileContents.length > 0 ? { fileContents } : {},
        onDelta: (chunk) => {
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
        },
        onDone: async () => {
          setIsStreaming(false);
          if (assistantSoFar) {
            saveMessage(convId, "assistant", assistantSoFar);
          }
        },
      });
    } catch (e) {
      console.error(e);
      setIsStreaming(false);
      const errorMsg = `❌ ${e instanceof Error ? e.message : "Erro na comunicação com a IA."}`;
      setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
      saveMessage(convId, "assistant", errorMsg);
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

  const STEP_KIND_TO_AGENT_INDEX: Record<string, number> = {
    intake: 0,
    sociobehavioral: 1,
    offer_analysis: 2,
    performance_timing: 3,
    synthesis: 4,
  };

  const deriveCurrentAgent = (steps: { step_kind: string; status: string }[]): number => {
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].status === "running") {
        return STEP_KIND_TO_AGENT_INDEX[steps[i].step_kind] ?? 0;
      }
    }
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].status === "completed") {
        const idx = STEP_KIND_TO_AGENT_INDEX[steps[i].step_kind] ?? 0;
        return Math.min(idx + 1, agentOrder.length - 1);
      }
    }
    return 0;
  };

  // ── Shared: start polling + realtime for an analysis ──
  const startProcessingPolling = useCallback((analysisId: string, runId: string) => {
    setStep("processing");

    // Store in URL for recovery
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("aid", analysisId);
      next.set("rid", runId);
      return next;
    }, { replace: true });

    const cleanupProcessingParams = () => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("aid");
        next.delete("rid");
        return next;
      }, { replace: true });
    };

    // Poll run_steps for agent progress
    const STEP_POLL_INTERVAL = 3000;
    const stepPollTimer = setInterval(async () => {
      try {
        const { data: steps } = await supabase
          .from("run_steps")
          .select("step_kind, status")
          .eq("run_id", runId)
          .order("step_order", { ascending: true });

        if (steps && steps.length > 0) {
          const pipelineSteps = steps.filter(
            (s) => s.step_kind in STEP_KIND_TO_AGENT_INDEX
          );
          if (pipelineSteps.length > 0) {
            const agentIdx = deriveCurrentAgent(pipelineSteps);
            setCurrentAgent(agentIdx);
          }
        }
      } catch (err) {
        console.warn("[step-poll] Error polling run_steps:", err);
      }
    }, STEP_POLL_INTERVAL);

    // Realtime subscription
    const channel = supabase
      .channel(`analysis-${analysisId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "analysis_requests",
          filter: `id=eq.${analysisId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          console.log("[realtime] analysis_requests update:", updated.status);

          if (updated.status === "completed") {
            clearInterval(stepPollTimer);
            setCurrentAgent(agentOrder.length - 1);
            channel.unsubscribe();
            cleanupProcessingParams();
            setStep("completed");
            setTimeout(() => navigate(`/app/analysis/${analysisId}/report`), 1500);
          } else if (updated.status === "failed") {
            clearInterval(stepPollTimer);
            channel.unsubscribe();
            cleanupProcessingParams();
            toast.error("A análise falhou. Tente novamente.");
            setStep("intake");
          }
        }
      )
      .subscribe();

    // Fallback polling
    const POLL_INTERVAL = 5000;
    const MAX_POLL_TIME = 5 * 60 * 1000;
    const pollStart = Date.now();

    const pollTimer = setInterval(async () => {
      if (Date.now() - pollStart > MAX_POLL_TIME) {
        clearInterval(pollTimer);
        clearInterval(stepPollTimer);
        channel.unsubscribe();
        cleanupProcessingParams();
        toast.error("Tempo limite excedido. Verifique o histórico de análises.");
        setStep("intake");
        return;
      }

      const { data: current } = await supabase
        .from("analysis_requests")
        .select("status")
        .eq("id", analysisId)
        .single();

      if (current?.status === "completed") {
        clearInterval(pollTimer);
        clearInterval(stepPollTimer);
        channel.unsubscribe();
        cleanupProcessingParams();
        setCurrentAgent(agentOrder.length - 1);
        setStep("completed");
        setTimeout(() => navigate(`/app/analysis/${analysisId}/report`), 1500);
      } else if (current?.status === "failed") {
        clearInterval(pollTimer);
        clearInterval(stepPollTimer);
        channel.unsubscribe();
        cleanupProcessingParams();
        toast.error("A análise falhou. Tente novamente.");
        setStep("intake");
      }
    }, POLL_INTERVAL);
  }, [navigate, setSearchParams]);

  // ── Resume processing (called on mount when recovering) ──
  const resumeProcessing = useCallback((analysisId: string, runId: string) => {
    console.log(`[recovery] Resuming processing for analysis=${analysisId} run=${runId}`);

    // Do an initial poll to set agent state immediately
    supabase
      .from("run_steps")
      .select("step_kind, status")
      .eq("run_id", runId)
      .order("step_order", { ascending: true })
      .then(({ data: steps }) => {
        if (steps && steps.length > 0) {
          const pipelineSteps = steps.filter(
            (s) => s.step_kind in STEP_KIND_TO_AGENT_INDEX
          );
          if (pipelineSteps.length > 0) {
            setCurrentAgent(deriveCurrentAgent(pipelineSteps));
          }
        }
      });

    // Also check if already completed/failed before starting polling
    supabase
      .from("analysis_requests")
      .select("status")
      .eq("id", analysisId)
      .single()
      .then(({ data }) => {
        if (data?.status === "completed") {
          setStep("completed");
          setCurrentAgent(agentOrder.length - 1);
          setTimeout(() => navigate(`/app/analysis/${analysisId}/report`), 1500);
        } else if (data?.status === "failed") {
          toast.error("A análise anterior falhou.");
          setStep("intake");
        } else {
          startProcessingPolling(analysisId, runId);
        }
      });
  }, [navigate, startProcessingPolling]);

  const runRealAnalysis = async (analysisId: string) => {
    setStep("processing");

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
            analysisRequestId: analysisId,
          }),
        }
      );

      if (!resp.ok && resp.status !== 202) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Erro ao iniciar análise");
      }

      const dispatchData = await resp.json();
      console.log("[analyze] Dispatch accepted:", dispatchData);
      const runId = dispatchData.run_id as string | undefined;

      if (runId) {
        startProcessingPolling(analysisId, runId);
      } else {
        // No runId — use fallback timer-based approach
        startProcessingPolling(analysisId, "unknown");
      }

    } catch (e) {
      console.error("Analysis error:", e);
      toast.error(e instanceof Error ? e.message : "Erro ao analisar campanha.");

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
    const progressPercent = step === "completed"
      ? 100
      : Math.round(((currentAgent) / agentOrder.length) * 100 + (1 / agentOrder.length) * 50);

    const PROCESSING_TIPS = [
      "💡 Campanhas com CTA claro convertem até 3x mais.",
      "📊 Dados socioeconômicos ajudam a refinar o público-alvo.",
      "🎯 Ofertas com urgência real superam as genéricas em 47%.",
      "🧠 O cérebro processa imagens 60.000x mais rápido que texto.",
      "📱 72% das compras online começam no mobile.",
      "🔍 Testes A/B consistentes aumentam ROI em até 30%.",
      "⏰ O horário de envio impacta até 25% da taxa de abertura.",
      "🎨 Cores consistentes aumentam reconhecimento de marca em 80%.",
      "📈 Segmentar por comportamento gera 3x mais engajamento.",
      "✨ Personalização no assunto aumenta abertura em 26%.",
    ];

    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
          >
            {step === "completed" ? (
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/20 mb-4">
                <Check className="h-8 w-8 text-success" />
              </div>
            ) : (
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                <Sparkles className="h-8 w-8 text-primary animate-pulse" />
              </div>
            )}
          </motion.div>
          <h1 className="text-2xl font-bold">
            {step === "completed" ? "Análise Concluída! 🎉" : "Analisando sua campanha..."}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {step === "completed"
              ? "Redirecionando para o relatório..."
              : "Nossos agentes especializados estão trabalhando na sua campanha."}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-10">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Progresso</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Agent steps */}
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-10">
          {agentOrder.map((code, idx) => {
            const Icon = agentIcons[code];
            const info = AGENT_INFO[code];
            const isActive = idx === currentAgent && step === "processing";
            const isDone = idx < currentAgent || step === "completed";
            const isPending = !isActive && !isDone;

            return (
              <motion.div
                key={code}
                className="flex flex-col items-center text-center w-20 sm:w-24"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.4 }}
              >
                <motion.div
                  animate={{
                    opacity: isPending ? 0.35 : 1,
                    scale: isActive ? 1.15 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                  className={`relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border-2 transition-colors ${
                    isActive
                      ? "border-primary bg-primary/15 shadow-lg shadow-primary/20"
                      : isDone
                      ? "border-success/60 bg-success/10"
                      : "border-border bg-card"
                  }`}
                >
                  <AnimatePresence mode="wait">
                    {isDone ? (
                      <motion.div
                        key="done"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <Check className="h-6 w-6 sm:h-7 sm:w-7 text-success" strokeWidth={3} />
                      </motion.div>
                    ) : isActive ? (
                      <motion.div
                        key="active"
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      >
                        <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                      </motion.div>
                    ) : (
                      <motion.div key="pending">
                        <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-muted-foreground/50" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Pulsing ring for active agent */}
                  {isActive && (
                    <>
                      <motion.div
                        className="absolute inset-0 rounded-2xl border-2 border-primary/40"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      />
                      <div className="absolute -bottom-1.5 -right-1.5 bg-background rounded-full p-0.5">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    </>
                  )}
                </motion.div>

                <span
                  className={`mt-2 text-[10px] sm:text-xs uppercase tracking-wider leading-tight transition-colors ${
                    isActive
                      ? "text-primary font-semibold"
                      : isDone
                      ? "text-success font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {info.name}
                </span>

                {isDone && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[9px] text-success mt-0.5"
                  >
                    Concluído ✓
                  </motion.span>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Current agent card with rotating tips */}
        {step === "processing" && (
          <motion.div
            key={currentAgent}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-card p-6 text-center space-y-4"
          >
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">
                {AGENT_INFO[agentOrder[currentAgent]].name} está analisando...
              </p>
            </div>
            <ProcessingTip tips={PROCESSING_TIPS} />
          </motion.div>
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

          {/* Messages — now using shared ChatMessageBubble */}
          {messages.map((msg, idx) => {
            const isLastAssistant = msg.role === "assistant" && idx === messages.length - 1;

            return (
              <div key={idx} className="group/msg mb-4">
                <ChatMessageBubble
                  message={msg}
                  index={idx}
                  isLastAssistant={isLastAssistant}
                  isStreaming={isStreaming}
                  isBusy={isBusy}
                  onContextCardSelect={handleContextCardSelect}
                />
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mt-1`}>
                  <ChatMessageActions
                    content={cleanMessageContent(msg.content)}
                    messageIndex={idx}
                    role={msg.role}
                    onFeedback={handleFeedback}
                    feedback={feedbacks[idx] || null}
                  />
                </div>
              </div>
            );
          })}

          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <ChatLoadingBubble />
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
              disabled={isBusy || (!input.trim() && files.length === 0 && activeAction !== "creative")}
              className="flex-shrink-0 rounded-xl h-10 w-10 bg-primary hover:bg-primary/90"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex justify-center gap-1.5 sm:gap-2 mt-3">
            {ACTION_MODES.map((a) => {
              const isActive = activeAction === a.key;
              return (
                <button
                  key={a.key}
                  onClick={() => setActiveAction(isActive ? null : a.key)}
                  disabled={isBusy}
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
