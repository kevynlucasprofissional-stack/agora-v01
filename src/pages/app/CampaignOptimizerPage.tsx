import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Send, Paperclip, X, Loader2, Zap, Users, BarChart3, Target, Check,
  TrendingUp, Brain, AlertTriangle, Eye, Clock, Globe, Sparkles,
  ChevronDown, ChevronUp, Image, FileText, Download, Edit3, LayoutGrid,
  ThumbsUp, ThumbsDown, Plus, ArrowLeft, Palette, Search, Database, Layers,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { AGENT_INFO, AgentKind } from "@/types/database";

type FlowStep = "input" | "processing" | "results";

interface DiagnosticCategory {
  score: number;
  issues: string[];
  recommendations: string[];
}

interface OptimizedCampaign {
  headline: string;
  subheadline?: string;
  value_proposition: string;
  offer: string;
  cta_primary: string;
  cta_secondary?: string;
  target_channels: string[];
  tone_of_voice: string;
  landing_page_structure: Array<{ section: string; content: string; purpose: string }>;
}

interface CreativeBrief {
  type: string;
  title: string;
  headline: string;
  body_copy: string;
  cta: string;
  visual_direction: string;
  format?: string;
}

interface AnalysisResult {
  score_overall: number;
  score_sociobehavioral: number;
  score_offer: number;
  score_performance: number;
  industry: string;
  primary_channel: string;
  declared_target_audience: string;
  region?: string;
  executive_summary: string;
  marketing_era: { era: string; description: string; recommendation: string };
  web_context: {
    brand_detected: string;
    product_category: string;
    commercial_event?: string;
    market_trends?: string[];
    competitor_insights?: string[];
  };
  diagnostics: {
    kpis: DiagnosticCategory;
    segmentation: DiagnosticCategory;
    interface_ux: DiagnosticCategory;
    creative: DiagnosticCategory;
    social_proof: DiagnosticCategory;
  };
  hormozi_analysis: {
    dream_outcome: number;
    perceived_likelihood: number;
    time_delay: number;
    effort_sacrifice: number;
    overall_value: string;
  };
  cognitive_biases: Array<{ bias: string; status: string; application: string }>;
  kpi_analysis: { vanity_metrics: string[]; recommended_north_star: string; recommended_kpis: string[] };
  timing_analysis: { demand_momentum: string; context_shock: string; seasonality: string };
  audience_insights: Array<{ generation: string; emoji: string; feedback: string }>;
  brand_sentiment: { overall: string; analysis: string };
  market_references: string[];
  strengths: string[];
  optimized_campaign: OptimizedCampaign;
  creative_briefs: CreativeBrief[];
}

const pipelineSteps = [
  { id: "web", icon: Search, label: "Web Search", description: "Analisando contexto da campanha" },
  { id: "user_kb", icon: FileText, label: "Docs do Usuário", description: "Consultando documentos enviados" },
  { id: "agora_kb", icon: Database, label: "KB Ágora", description: "Cruzando com frameworks" },
  { id: "cross", icon: Layers, label: "Cross Intelligence", description: "Cruzando fontes de dados" },
  { id: "optimize", icon: Zap, label: "Otimização", description: "Reestruturando campanha" },
  { id: "creative", icon: Image, label: "Criativos", description: "Gerando briefs de criativos" },
];

const diagnosticCategories = [
  { key: "kpis", label: "KPIs & Métricas", icon: BarChart3, color: "text-primary" },
  { key: "segmentation", label: "Segmentação", icon: Users, color: "text-secondary" },
  { key: "interface_ux", label: "Interface & UX", icon: LayoutGrid, color: "text-accent" },
  { key: "creative", label: "Criativo", icon: Palette, color: "text-warning" },
  { key: "social_proof", label: "Prova Social", icon: ThumbsUp, color: "text-success" },
] as const;

const suggestions = [
  { icon: "🎯", label: "Auditar campanha de Meta Ads" },
  { icon: "📊", label: "Otimizar funil de vendas" },
  { icon: "🧠", label: "Avaliar copy e oferta" },
  { icon: "📈", label: "Analisar performance de mídia" },
];

export default function CampaignOptimizerPage() {
  const { user } = useAuth();
  const { canUseSyntheticAudience } = usePlanAccess();
  const navigate = useNavigate();

  const [step, setStep] = useState<FlowStep>("input");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [currentPipelineStep, setCurrentPipelineStep] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingCreatives, setGeneratingCreatives] = useState<Record<number, boolean>>({});
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [expandedDiagnostic, setExpandedDiagnostic] = useState<string | null>(null);
  const [editingBrief, setEditingBrief] = useState<number | null>(null);
  const [editedBriefs, setEditedBriefs] = useState<Record<number, CreativeBrief>>({});
  const [feedbackSent, setFeedbackSent] = useState<"like" | "dislike" | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles]);
  };

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
      handleAnalyze();
    }
  };

  const handleAnalyze = async () => {
    if (!input.trim() || loading || !user) return;
    setLoading(true);
    setStep("processing");
    setCurrentPipelineStep(0);

    // Create analysis request in DB
    const { data: analysis, error } = await supabase
      .from("analysis_requests")
      .insert({
        user_id: user.id,
        title: input.slice(0, 60),
        raw_prompt: input,
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !analysis) {
      toast.error("Erro ao criar análise.");
      setLoading(false);
      setStep("input");
      return;
    }

    setAnalysisId(analysis.id);

    // Upload files if any
    if (files.length > 0) {
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

    // Animate pipeline steps
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < pipelineSteps.length; i++) {
      timers.push(setTimeout(() => setCurrentPipelineStep(i), i * 2500));
    }

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/optimize-campaign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            rawPrompt: input,
            title: input.slice(0, 60),
            files: files.map((f) => f.name),
          }),
        }
      );

      timers.forEach(clearTimeout);
      setCurrentPipelineStep(pipelineSteps.length - 1);

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Erro na análise");
      }

      const { analysis: analysisResult } = await resp.json();
      setResult(analysisResult);

      // Update DB
      await supabase
        .from("analysis_requests")
        .update({
          status: "completed",
          score_overall: analysisResult.score_overall,
          score_sociobehavioral: analysisResult.score_sociobehavioral,
          score_offer: analysisResult.score_offer,
          score_performance: analysisResult.score_performance,
          industry: analysisResult.industry,
          primary_channel: analysisResult.primary_channel,
          declared_target_audience: analysisResult.declared_target_audience,
          region: analysisResult.region || null,
          completed_at: new Date().toISOString(),
          normalized_payload: analysisResult,
        })
        .eq("id", analysis.id);

      setStep("results");
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    } catch (e) {
      timers.forEach(clearTimeout);
      console.error("Analysis error:", e);
      toast.error(e instanceof Error ? e.message : "Erro ao otimizar campanha.");
      await supabase.from("analysis_requests").update({ status: "failed" }).eq("id", analysis.id);
      setStep("input");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCreativeImage = async (index: number) => {
    if (!result) return;
    const brief = editedBriefs[index] || result.creative_briefs[index];
    setGeneratingCreatives((prev) => ({ ...prev, [index]: true }));

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-creative`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ brief }),
        }
      );

      if (!resp.ok) throw new Error("Erro na geração");
      const { image } = await resp.json();
      if (image) {
        setGeneratedImages((prev) => ({ ...prev, [index]: image }));
        toast.success("Criativo gerado!");
      }
    } catch (e) {
      toast.error("Erro ao gerar criativo. Tente novamente.");
    } finally {
      setGeneratingCreatives((prev) => ({ ...prev, [index]: false }));
    }
  };

  const handleFeedback = async (type: "like" | "dislike") => {
    if (!analysisId || !user) return;
    await supabase.from("analysis_feedback").upsert({
      analysis_request_id: analysisId,
      user_id: user.id,
      feedback: type,
    }, { onConflict: "analysis_request_id,user_id" });
    setFeedbackSent(type);
    toast.success(type === "like" ? "Obrigado!" : "Obrigado pelo feedback.");
  };

  const handleNewAnalysis = () => {
    setStep("input");
    setInput("");
    setFiles([]);
    setResult(null);
    setAnalysisId(null);
    setGeneratedImages({});
    setEditedBriefs({});
    setFeedbackSent(null);
  };

  const handleUpdateBrief = (index: number, field: keyof CreativeBrief, value: string) => {
    const current = editedBriefs[index] || result?.creative_briefs[index];
    if (!current) return;
    setEditedBriefs((prev) => ({ ...prev, [index]: { ...current, [field]: value } }));
  };

  // ── PROCESSING VIEW ──
  if (step === "processing") {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="text-center mb-12">
          <h1 className="text-2xl font-bold font-display">Otimizando Campanha...</h1>
          <p className="mt-2 text-muted-foreground text-sm">Pipeline de inteligência em execução.</p>
        </div>
        <div className="space-y-3 max-w-md mx-auto">
          {pipelineSteps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = idx === currentPipelineStep;
            const isDone = idx < currentPipelineStep;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0.4 }}
                animate={{ opacity: isDone || isActive ? 1 : 0.4 }}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  isActive ? "border-primary bg-primary/5" : isDone ? "border-success/30 bg-success/5" : "border-border bg-card"
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${
                  isActive ? "bg-primary/10" : isDone ? "bg-success/10" : "bg-muted"
                }`}>
                  {isDone ? <Check className="h-5 w-5 text-success" /> : <Icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
                {isActive && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── RESULTS VIEW ──
  if (step === "results" && result) {
    const r = result;
    const scores = [
      { label: "Sociocomportamental", value: r.score_sociobehavioral, icon: Users, color: "bg-success" },
      { label: "Oferta", value: r.score_offer, icon: Zap, color: "bg-warning" },
      { label: "Performance", value: r.score_performance, icon: BarChart3, color: "bg-primary" },
    ];

    return (
      <div ref={resultsRef} className="max-w-5xl space-y-8 pb-20">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <button onClick={handleNewAnalysis} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
              <ArrowLeft className="h-4 w-4" /> Nova análise
            </button>
            <h1 className="text-2xl font-bold font-display">Otimização de Campanha</h1>
            <p className="text-sm text-muted-foreground mt-1">{input.slice(0, 80)}{input.length > 80 ? "..." : ""}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleNewAnalysis}>
              <Plus className="h-4 w-4 mr-2" /> Nova Análise
            </Button>
          </div>
        </div>

        {/* Web Context */}
        {r.web_context && (
          <div className="glass-card p-5">
            <h3 className="section-label mb-3 flex items-center gap-2"><Search className="h-4 w-4" /> Contexto Detectado</h3>
            <div className="flex flex-wrap gap-3">
              {r.web_context.brand_detected && (
                <span className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">🏢 {r.web_context.brand_detected}</span>
              )}
              {r.web_context.product_category && (
                <span className="text-xs bg-secondary/10 text-secondary px-3 py-1.5 rounded-full font-medium">📦 {r.web_context.product_category}</span>
              )}
              {r.web_context.commercial_event && (
                <span className="text-xs bg-warning/10 text-warning px-3 py-1.5 rounded-full font-medium">📅 {r.web_context.commercial_event}</span>
              )}
            </div>
            {r.web_context.market_trends && r.web_context.market_trends.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Tendências de Mercado:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {r.web_context.market_trends.map((t, i) => <li key={i}>• {t}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Overall Score */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 text-center">
          <span className="section-label">Score Geral</span>
          <div className="mt-4 relative flex items-center justify-center mx-auto w-32 h-32">
            <svg className="h-32 w-32" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--primary))" strokeWidth="8"
                strokeDasharray={`${(r.score_overall / 100) * 314} 314`}
                strokeLinecap="round" transform="rotate(-90 60 60)" className="transition-all duration-1000" />
            </svg>
            <span className="absolute text-4xl font-display font-bold text-tabular">{r.score_overall.toFixed(0)}</span>
          </div>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto text-sm">{r.executive_summary}</p>
        </motion.div>

        {/* Sub-scores */}
        <div className="grid md:grid-cols-3 gap-4">
          {scores.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-card p-6 pt-8 text-center relative">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-lg bg-warning shadow-md">
                <s.icon className="h-5 w-5 text-warning-foreground" />
              </div>
              <span className="section-label">{s.label}</span>
              <div className="mt-3 text-3xl font-display font-bold text-tabular">{s.value.toFixed(0)}<span className="text-lg text-muted-foreground">/100</span></div>
              <div className="mt-3 h-2 rounded-full bg-border overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${s.value}%` }} transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                  className={`h-full rounded-full ${s.color}`} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Marketing Era */}
        {r.marketing_era && (
          <div className="glass-card p-6">
            <h3 className="section-label mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Era do Marketing</h3>
            <div className="flex items-center gap-4 mb-3">
              <span className="text-3xl font-display font-bold text-primary">{r.marketing_era.era}</span>
              <div className="flex gap-1">
                {["1.0", "2.0", "3.0", "4.0"].map((era) => (
                  <div key={era} className={`h-2 w-8 rounded-full ${parseFloat(era) <= parseFloat(r.marketing_era.era) ? "bg-primary" : "bg-border"}`} />
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{r.marketing_era.description}</p>
            <p className="text-sm"><strong>Recomendação:</strong> {r.marketing_era.recommendation}</p>
          </div>
        )}

        {/* Structured Diagnostics by Category */}
        <div className="glass-card p-6">
          <h3 className="section-label mb-4">Diagnóstico por Categoria</h3>
          <div className="space-y-3">
            {diagnosticCategories.map((cat) => {
              const diag = r.diagnostics[cat.key as keyof typeof r.diagnostics];
              if (!diag) return null;
              const Icon = cat.icon;
              const isExpanded = expandedDiagnostic === cat.key;

              return (
                <div key={cat.key} className="border border-border/50 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedDiagnostic(isExpanded ? null : cat.key)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Icon className={`h-4 w-4 ${cat.color}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">{cat.label}</p>
                      <p className="text-xs text-muted-foreground">{diag.issues.length} problemas identificados</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className={`text-lg font-bold font-display ${diag.score >= 70 ? "text-success" : diag.score >= 40 ? "text-warning" : "text-destructive"}`}>
                          {diag.score}
                        </span>
                        <span className="text-xs text-muted-foreground">/100</span>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 grid md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Problemas
                            </h4>
                            <ul className="space-y-1.5">
                              {diag.issues.map((issue, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                  <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0 mt-1" /> {issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-success mb-2 flex items-center gap-1">
                              <Check className="h-3 w-3" /> Recomendações
                            </h4>
                            <ul className="space-y-1.5">
                              {diag.recommendations.map((rec, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                  <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0 mt-1" /> {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hormozi Value Analysis */}
        {r.hormozi_analysis && (
          <div className="glass-card p-6">
            <h3 className="section-label mb-4 flex items-center gap-2"><Target className="h-4 w-4" /> Análise de Valor (Hormozi)</h3>
            <p className="text-xs text-muted-foreground mb-4">Valor = (Resultado × Probabilidade) ÷ (Tempo × Esforço)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[
                { label: "Resultado Sonhado", value: r.hormozi_analysis.dream_outcome, icon: "🎯" },
                { label: "Probabilidade", value: r.hormozi_analysis.perceived_likelihood, icon: "📈" },
                { label: "Tempo (rapidez)", value: r.hormozi_analysis.time_delay, icon: "⚡" },
                { label: "Facilidade", value: r.hormozi_analysis.effort_sacrifice, icon: "🧘" },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <span className="text-2xl">{item.icon}</span>
                  <div className="flex justify-center gap-0.5 my-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className={`h-2 w-4 rounded-sm ${n <= item.value ? "bg-primary" : "bg-border"}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{r.hormozi_analysis.overall_value}</p>
          </div>
        )}

        {/* Generational Verdict */}
        {canUseSyntheticAudience && r.audience_insights && r.audience_insights.length > 0 && (
          <div>
            <h3 className="section-label mb-4">Audiência Sintética — Veredicto Geracional</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {r.audience_insights.map((insight, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="glass-card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{insight.emoji}</span>
                    <h4 className="font-semibold text-sm">{insight.generation}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground italic">"{insight.feedback}"</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── OPTIMIZED CAMPAIGN ── */}
        <div className="border-t-2 border-primary/20 pt-8">
          <h2 className="text-xl font-display font-bold mb-6 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Campanha Otimizada
          </h2>

          <div className="glass-card p-6 space-y-6">
            {/* Headline & Value Prop */}
            <div className="text-center space-y-3">
              <h3 className="text-2xl font-display font-bold text-foreground">{r.optimized_campaign.headline}</h3>
              {r.optimized_campaign.subheadline && (
                <p className="text-base text-muted-foreground">{r.optimized_campaign.subheadline}</p>
              )}
              <div className="inline-block bg-primary/10 rounded-xl px-6 py-3 mt-2">
                <p className="text-sm font-medium text-primary">{r.optimized_campaign.value_proposition}</p>
              </div>
            </div>

            {/* Offer & CTAs */}
            <div className="grid md:grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
                <span className="section-label">Oferta</span>
                <p className="text-sm mt-2">{r.optimized_campaign.offer}</p>
              </div>
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <span className="section-label">CTA Principal</span>
                <p className="text-sm font-medium mt-2 text-primary">{r.optimized_campaign.cta_primary}</p>
              </div>
              {r.optimized_campaign.cta_secondary && (
                <div className="p-4 rounded-xl bg-muted border border-border/50">
                  <span className="section-label">CTA Secundário</span>
                  <p className="text-sm mt-2">{r.optimized_campaign.cta_secondary}</p>
                </div>
              )}
            </div>

            {/* Channels & Tone */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <span className="section-label">Canais Recomendados</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {r.optimized_campaign.target_channels.map((ch, i) => (
                    <span key={i} className="text-xs bg-card border border-border rounded-full px-3 py-1.5">{ch}</span>
                  ))}
                </div>
              </div>
              <div>
                <span className="section-label">Tom de Voz</span>
                <p className="text-sm mt-2 text-muted-foreground">{r.optimized_campaign.tone_of_voice}</p>
              </div>
            </div>

            {/* Landing Page Structure */}
            {r.optimized_campaign.landing_page_structure && r.optimized_campaign.landing_page_structure.length > 0 && (
              <div>
                <span className="section-label mb-3 block">Estrutura da Landing Page</span>
                <div className="space-y-2">
                  {r.optimized_campaign.landing_page_structure.map((section, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary text-xs font-bold shrink-0">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{section.section}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{section.content}</p>
                        <p className="text-[10px] text-primary/70 mt-1">Objetivo: {section.purpose}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── CREATIVE BRIEFS ── */}
        <div className="border-t-2 border-secondary/20 pt-8">
          <h2 className="text-xl font-display font-bold mb-6 flex items-center gap-2">
            <Image className="h-5 w-5 text-secondary" /> Criativos Gerados
          </h2>

          <div className="space-y-6">
            {r.creative_briefs.map((brief, i) => {
              const currentBrief = editedBriefs[i] || brief;
              const isEditing = editingBrief === i;
              const hasImage = !!generatedImages[i];

              return (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="glass-card overflow-hidden">
                  {/* Brief header */}
                  <div className="flex items-center justify-between p-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                      <span className="text-xs bg-secondary/10 text-secondary px-2.5 py-1 rounded-full font-medium uppercase tracking-wider">
                        {currentBrief.type.replace("_", " ")}
                      </span>
                      <h4 className="text-sm font-medium">{currentBrief.title}</h4>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingBrief(isEditing ? null : i)}>
                        <Edit3 className="h-3.5 w-3.5 mr-1" /> {isEditing ? "Fechar" : "Editar"}
                      </Button>
                      <Button
                        variant="hero"
                        size="sm"
                        onClick={() => handleGenerateCreativeImage(i)}
                        disabled={!!generatingCreatives[i]}
                      >
                        {generatingCreatives[i] ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <Image className="h-3.5 w-3.5 mr-1" />
                        )}
                        {hasImage ? "Regenerar" : "Gerar Imagem"}
                      </Button>
                    </div>
                  </div>

                  <div className={`grid ${hasImage ? "md:grid-cols-2" : ""}`}>
                    {/* Brief content */}
                    <div className="p-5 space-y-3">
                      {isEditing ? (
                        <>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Headline</label>
                            <Input value={currentBrief.headline} onChange={(e) => handleUpdateBrief(i, "headline", e.target.value)} className="mt-1 text-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Body Copy</label>
                            <Textarea value={currentBrief.body_copy} onChange={(e) => handleUpdateBrief(i, "body_copy", e.target.value)} className="mt-1 text-sm" rows={3} />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">CTA</label>
                            <Input value={currentBrief.cta} onChange={(e) => handleUpdateBrief(i, "cta", e.target.value)} className="mt-1 text-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Direção Visual</label>
                            <Textarea value={currentBrief.visual_direction} onChange={(e) => handleUpdateBrief(i, "visual_direction", e.target.value)} className="mt-1 text-sm" rows={2} />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Headline</span>
                            <p className="text-sm font-medium mt-1">{currentBrief.headline}</p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Copy</span>
                            <p className="text-sm text-muted-foreground mt-1">{currentBrief.body_copy}</p>
                          </div>
                          <div className="flex gap-4">
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">CTA</span>
                              <p className="text-sm font-medium text-primary mt-1">{currentBrief.cta}</p>
                            </div>
                            {currentBrief.format && (
                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Formato</span>
                                <p className="text-sm text-muted-foreground mt-1">{currentBrief.format}</p>
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Direção Visual</span>
                            <p className="text-xs text-muted-foreground mt-1">{currentBrief.visual_direction}</p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Generated image */}
                    {hasImage && (
                      <div className="border-l border-border/50 p-4 flex flex-col items-center justify-center bg-muted/30">
                        <img src={generatedImages[i]} alt={currentBrief.title} className="max-w-full rounded-lg shadow-md" />
                        <a
                          href={generatedImages[i]}
                          download={`creative-${i}.png`}
                          className="mt-3 text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" /> Baixar imagem
                        </a>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Feedback */}
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">Esta otimização foi útil?</p>
          <div className="flex justify-center gap-3">
            <Button
              variant={feedbackSent === "like" ? "default" : "outline"}
              size="sm"
              onClick={() => handleFeedback("like")}
              disabled={!!feedbackSent}
            >
              <ThumbsUp className="h-4 w-4 mr-2" /> Sim
            </Button>
            <Button
              variant={feedbackSent === "dislike" ? "default" : "outline"}
              size="sm"
              onClick={() => handleFeedback("dislike")}
              disabled={!!feedbackSent}
            >
              <ThumbsDown className="h-4 w-4 mr-2" /> Pode melhorar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── INPUT VIEW ──
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-1 overflow-y-auto px-4">
        <div className="max-w-2xl mx-auto py-6">
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-2 text-center">
              Campaign Optimizer
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base text-center mb-2 max-w-md">
              Envie sua campanha e receba uma versão otimizada com diagnóstico, estratégia e criativos prontos.
            </p>
            <p className="text-xs text-muted-foreground text-center mb-8 max-w-sm">
              Descreva a campanha, cole um link ou faça upload de prints e documentos.
            </p>

            <div className="flex flex-wrap justify-center gap-2 max-w-xl mb-8">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => { setInput(s.label); textareaRef.current?.focus(); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card hover:bg-muted text-sm text-foreground transition-colors"
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed bottom input */}
      <div className="shrink-0 border-t border-border/50 bg-background/80 backdrop-blur-lg px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {/* Attached files */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="max-w-[150px] truncate">{f.name}</span>
                  <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)}KB</span>
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative flex items-end gap-2">
            <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,.pdf,.doc,.docx,.txt,.csv" onChange={handleFileAdd} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mb-0.5"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="Descreva sua campanha para otimização..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-input bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] max-h-[200px]"
            />
            <Button
              onClick={handleAnalyze}
              disabled={loading || !input.trim()}
              variant="hero"
              size="icon"
              className="shrink-0 h-10 w-10 rounded-xl mb-0.5"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Pressione Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </div>
    </div>
  );
}
