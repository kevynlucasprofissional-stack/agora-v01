import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, X, FileText, Loader2, LayoutGrid, Users, Zap, BarChart3, Target, Check, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { AGENT_INFO, AgentKind } from "@/types/database";

type FlowStep = "intake" | "uploading" | "processing" | "completed";
type ChatMessage = { role: "user" | "assistant"; content: string };

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
  { key: "creative" as const, label: "Gerar criativos", icon: Sparkles, prefix: "[MODO: GERAR CRIATIVOS] " },
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const hasMessages = messages.length > 0;

  // Load existing conversation on mount
  useEffect(() => {
    const convId = searchParams.get("c");
    if (convId && user) {
      setConversationId(convId);
      setLoadingHistory(true);
      supabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .then(({ data }) => {
          if (data && data.length > 0) {
            const restored = data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
            setMessages(restored);
            // Check if AI already signaled readiness
            if (restored.some((m) => m.role === "assistant" && m.content.includes("##READY##"))) {
              setIsReady(true);
            }
          }
          setLoadingHistory(false);
        });
    }
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Helper: ensure a conversation exists, create if needed
  const ensureConversation = useCallback(async (): Promise<string> => {
    if (conversationId) return conversationId;
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, context_type: "intake", title: "Nova Análise" })
      .select("id")
      .single();

    if (error || !data) throw new Error("Failed to create conversation");

    setConversationId(data.id);
    setSearchParams({ c: data.id }, { replace: true });
    return data.id;
  }, [conversationId, user, setSearchParams]);

  // Helper: persist a message to DB
  const persistMessage = useCallback(async (convId: string, role: string, content: string) => {
    await supabase.from("chat_messages").insert({ conversation_id: convId, role, content });
  }, []);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles]);
  };

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

  const handleSend = async () => {
    if ((!input.trim() && files.length === 0) || isStreaming) return;

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
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setFiles([]);
    setIsStreaming(true);

    // Persist user message
    persistMessage(convId, "user", userDisplayContent);

    // Update conversation title from first user message (use raw input, not file-appended)
    if (messages.length === 0) {
      const titleText = input.trim() || userDisplayContent;
      supabase.from("conversations").update({ title: titleText.slice(0, 80) }).eq("id", convId);
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
        messages: updatedMessages,
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

        <div className="flex flex-wrap justify-center gap-4 sm:gap-3 mb-12">
          {agentOrder.map((code, idx) => {
            const Icon = agentIcons[code];
            const info = AGENT_INFO[code];
            const isActive = idx === currentAgent && step === "processing";
            const isDone = idx < currentAgent || step === "completed";

            return (
              <div key={code} className="flex flex-col items-center text-center w-16 sm:w-20">
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
                <span className="mt-2 text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground leading-tight line-clamp-2">
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
      {/* Scrollable chat area */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="max-w-2xl mx-auto py-6">
          {!hasMessages && !loadingHistory && (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-2 text-center">
                O que você quer analisar?
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base text-center mb-8">
                Descreva sua campanha e nossos agentes farão uma auditoria completa.
              </p>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, idx) => (
            <div key={idx} className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm sm:text-base ${
                  msg.role === "user"
                    ? "bg-secondary text-secondary-foreground rounded-br-md"
                    : "bg-card border border-border text-foreground rounded-bl-md"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none text-foreground">
                    <ReactMarkdown>
                      {msg.content.replace("##READY##", "").trim()}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

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
                {files.map((f, i) => (
                  <div key={f.name + i} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[140px]">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)}KB</span>
                    <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive ml-1">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
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
              accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.pptx,.docx,.csv,.txt"
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder={hasMessages ? "Responda aqui..." : "Descreva sua campanha, produto, público-alvo..."}
              rows={1}
              className="flex-1 bg-transparent border-none outline-none resize-none text-sm sm:text-base text-foreground placeholder:text-muted-foreground max-h-[200px]"
            />

            <Button
              size="icon"
              onClick={handleSend}
              disabled={isStreaming || (!input.trim() && files.length === 0)}
              className="flex-shrink-0 rounded-xl h-10 w-10 bg-primary hover:bg-primary/90"
            >
              {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-nowrap justify-center gap-2 mt-3">
            {quickActions.map((a) => (
              <button
                key={a.label}
                onClick={() => {
                  setInput(a.label);
                  textareaRef.current?.focus();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted text-xs sm:text-sm text-foreground transition-colors whitespace-nowrap"
              >
                <span>{a.icon}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-2">
            Pressione Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </div>
    </div>
  );
}
