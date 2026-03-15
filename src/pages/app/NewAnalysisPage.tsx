import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Paperclip, X, FileText, Loader2, LayoutGrid, Users, Zap, BarChart3, Target, Check } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { AGENT_INFO, AgentKind } from "@/types/database";

type FlowStep = "intake" | "uploading" | "processing" | "completed";

const agentOrder: AgentKind[] = ["master_orchestrator", "sociobehavioral", "offer_engineer", "performance_scientist", "chief_strategist"];
const agentIcons: Record<AgentKind, React.ElementType> = {
  master_orchestrator: LayoutGrid,
  sociobehavioral: Users,
  offer_engineer: Zap,
  performance_scientist: BarChart3,
  chief_strategist: Target,
};

const suggestions = [
  { icon: "🎯", label: "Auditar campanha de Meta Ads" },
  { icon: "📊", label: "Analisar funil de vendas" },
  { icon: "🧠", label: "Avaliar copy e oferta" },
  { icon: "📈", label: "Otimizar performance de mídia" },
];

export default function NewAnalysisPage() {
  const { user } = useAuth();
  const { uploadsLimit } = usePlanAccess();
  const navigate = useNavigate();

  const [step, setStep] = useState<FlowStep>("intake");
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [currentAgent, setCurrentAgent] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const simulateProcessing = async (analysisId: string) => {
    setStep("processing");
    for (let i = 0; i < agentOrder.length; i++) {
      setCurrentAgent(i);
      await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));
    }

    const scores = {
      score_overall: 45 + Math.random() * 40,
      score_sociobehavioral: 40 + Math.random() * 45,
      score_offer: 35 + Math.random() * 50,
      score_performance: 40 + Math.random() * 45,
    };

    await supabase
      .from("analysis_requests")
      .update({
        status: "completed",
        ...scores,
        completed_at: new Date().toISOString(),
        normalized_payload: {
          campanha_normalizada: {
            oferta_principal: prompt.slice(0, 100),
            publico_alvo_declarado: "A ser identificado",
            canais_identificados: ["Instagram", "Meta Ads"],
          },
        },
      })
      .eq("id", analysisId);

    setStep("completed");
    setTimeout(() => navigate(`/app/analysis/${analysisId}/report`), 1500);
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast.error("Descreva sua campanha para continuar.");
      return;
    }
    if (!user) return;

    setLoading(true);

    const { data: analysis, error } = await supabase
      .from("analysis_requests")
      .insert({
        user_id: user.id,
        title: prompt.slice(0, 60),
        raw_prompt: prompt,
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

    await simulateProcessing(analysis.id);
    setLoading(false);
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
                  animate={{
                    opacity: isDone || isActive ? 1 : 0.3,
                    scale: isActive ? 1.15 : 1,
                  }}
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4">
      {/* Hero heading */}
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-2">
          O que você quer analisar?
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Descreva sua campanha e nossos agentes farão uma auditoria completa.
        </p>
      </div>

      {/* Suggestion chips */}
      <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-xl">
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => {
              setPrompt(s.label);
              textareaRef.current?.focus();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card hover:bg-muted text-sm text-foreground transition-colors"
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Chat input area */}
      <div className="w-full max-w-2xl">
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
                <div
                  key={f.name + i}
                  className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 text-sm"
                >
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

        {/* Input box */}
        <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm focus-within:border-primary/50 transition-colors">
          {/* Attach button */}
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

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Descreva sua campanha, produto, público-alvo..."
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm sm:text-base text-foreground placeholder:text-muted-foreground max-h-[200px]"
          />

          {/* Send button */}
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={loading || !prompt.trim()}
            className="flex-shrink-0 rounded-xl h-10 w-10 bg-primary hover:bg-primary/90"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-3">
          Pressione Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
