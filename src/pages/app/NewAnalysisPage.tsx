import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Upload, X, FileText, Loader2, LayoutGrid, Users, Zap, BarChart3, Target, Check } from "lucide-react";
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

export default function NewAnalysisPage() {
  const { user } = useAuth();
  const { uploadsLimit } = usePlanAccess();
  const navigate = useNavigate();

  const [step, setStep] = useState<FlowStep>("intake");
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [currentAgent, setCurrentAgent] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const simulateProcessing = async (analysisId: string) => {
    setStep("processing");

    // Simulate each agent processing
    for (let i = 0; i < agentOrder.length; i++) {
      setCurrentAgent(i);
      await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));
    }

    // Update analysis as completed with mock scores
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

    // Create analysis request
    const { data: analysis, error } = await supabase
      .from("analysis_requests")
      .insert({
        user_id: user.id,
        title: title || prompt.slice(0, 60),
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

    // Upload files
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

    // Simulate agent processing
    await simulateProcessing(analysis.id);
    setLoading(false);
  };

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

        {/* Agent orchestrator visualization */}
        <div className="grid grid-cols-5 gap-3 mb-12">
          {agentOrder.map((code, idx) => {
            const Icon = agentIcons[code];
            const info = AGENT_INFO[code];
            const isActive = idx === currentAgent && step === "processing";
            const isDone = idx < currentAgent || step === "completed";

            return (
              <div key={code} className="flex flex-col items-center text-center">
                <motion.div
                  animate={{
                    opacity: isDone || isActive ? 1 : 0.3,
                    scale: isActive ? 1.15 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                  className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border-2 transition-colors ${
                    isActive ? "border-primary glow-primary bg-primary/10" :
                    isDone ? "border-success/50 bg-success/10" : "border-border bg-card"
                  }`}
                >
                  {isDone ? <Check className="h-6 w-6 text-success" /> : <Icon className="h-6 w-6" />}
                  {isActive && (
                    <div className="absolute -bottom-1 -right-1">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  )}
                </motion.div>
                <span className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground leading-tight">
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

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Nova Análise</h1>
        <p className="mt-1 text-muted-foreground">Descreva sua campanha de marketing para iniciar a auditoria científica.</p>
      </div>

      <div className="space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <Label>Título da análise (opcional)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Campanha Black Friday 2026" className="bg-card" />
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <Label>Descreva sua campanha *</Label>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder="Descreva o produto/serviço, público-alvo, canais utilizados, objetivo da campanha, métricas atuais, contexto de mercado..."
            className="min-h-[200px] bg-card resize-none" />
          <p className="text-xs text-muted-foreground">
            Quanto mais detalhes, melhor a análise. Inclua: produto, público, canais, KPIs, orçamento e contexto.
          </p>
        </div>

        {/* Files */}
        <div className="space-y-3">
          <Label>Arquivos de apoio</Label>
          <div className="glass-card p-6 border-dashed text-center cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Clique ou arraste arquivos aqui</p>
            <p className="text-xs text-muted-foreground mt-1">PDFs, imagens, planilhas, apresentações</p>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileAdd}
              accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.pptx,.docx,.csv,.txt" />
          </div>

          <AnimatePresence>
            {files.map((f, i) => (
              <motion.div key={f.name + i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 glass-card p-3">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 truncate">{f.name}</span>
                <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)}KB</span>
                <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-4">
          <Button variant="hero" size="lg" className="flex-1" onClick={handleSubmit} disabled={loading || !prompt.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar para Análise
          </Button>
        </div>
      </div>
    </div>
  );
}
