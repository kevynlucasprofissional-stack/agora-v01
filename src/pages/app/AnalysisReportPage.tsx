import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisRequest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Download, ThumbsUp, ThumbsDown, ArrowLeft, Users, Zap, BarChart3,
  Sparkles, Globe, Brain, TrendingUp, AlertTriangle, Target, Clock, Eye, Plus,
  FileText, Presentation, ChevronDown, ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { exportToDocx, exportToPptx } from "@/lib/exportUtils";
import { ReportChatBlock } from "@/components/ReportChatBlock";
import { useIsMobile } from "@/hooks/use-mobile";

export default function AnalysisReportPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { canUseSyntheticAudience } = usePlanAccess();
  const isMobile = useIsMobile();
  const [analysis, setAnalysis] = useState<AnalysisRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState<"like" | "dislike" | null>(null);
  const [expandedBiases, setExpandedBiases] = useState(false);
  const [audienceInsights, setAudienceInsights] = useState<{ consumption_behavior: string; target_generation: string } | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("analysis_requests").select("*").eq("id", id).single().then(({ data }) => {
      setAnalysis(data);
      setLoading(false);
    });
  }, [id]);

  // Fetch audience insights when analysis is loaded and completed
  useEffect(() => {
    if (!analysis || analysis.status !== "completed") return;
    setInsightsLoading(true);
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audience-insights`;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ analysis }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.consumption_behavior && data.target_generation) {
          setAudienceInsights(data);
        }
      })
      .catch((e) => console.error("Audience insights error:", e))
      .finally(() => setInsightsLoading(false));
  }, [analysis]);




  const handleFeedback = async (type: "like" | "dislike") => {
    if (!analysis || !user) return;
    const { error } = await supabase.from("analysis_feedback").upsert({
      analysis_request_id: analysis.id,
      user_id: user.id,
      feedback: type,
      comment: feedbackComment || null,
    }, { onConflict: "analysis_request_id,user_id" });
    if (!error) {
      setFeedbackSent(type);
      toast.success(type === "like" ? "Obrigado pelo feedback positivo!" : "Agradecemos o feedback. Vamos melhorar.");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando relatório...</div>;
  if (!analysis) return <div className="text-center py-20 text-muted-foreground">Análise não encontrada.</div>;

  const payload = analysis.normalized_payload as Record<string, any> | null;
  const summary = payload?.executive_summary as string | undefined;
  const rawImprovements = payload?.improvements;
  const rawStrengths = payload?.strengths;

  // Support both old (string[]) and new (categorized) formats
  type CategorizedItem = { category: string; items: string[] };
  const improvements: CategorizedItem[] = Array.isArray(rawImprovements)
    ? rawImprovements.length > 0 && typeof rawImprovements[0] === "string"
      ? [{ category: "Geral", items: rawImprovements as string[] }]
      : (rawImprovements as CategorizedItem[])
    : [];
  const strengths: CategorizedItem[] = Array.isArray(rawStrengths)
    ? rawStrengths.length > 0 && typeof rawStrengths[0] === "string"
      ? [{ category: "Geral", items: rawStrengths as string[] }]
      : (rawStrengths as CategorizedItem[])
    : [];
  const audienceBehavior = payload?.audience_behavior as { section: string; cards: Array<{ title: string; content: string }> } | undefined;
  const marketRefs = (payload?.market_references as string[] | undefined) || [];
  const marketingEra = payload?.marketing_era as { era: string; description: string; recommendation: string } | undefined;
  const cognitiveBiases = (payload?.cognitive_biases as Array<{ bias: string; status: string; application: string }> | undefined) || [];
  const hormoziAnalysis = payload?.hormozi_analysis as { dream_outcome: number; perceived_likelihood: number; time_delay: number; effort_sacrifice: number; overall_value: string } | undefined;
  const kpiAnalysis = payload?.kpi_analysis as { vanity_metrics: string[]; recommended_north_star: string; recommended_kpis: string[] } | undefined;
  const timingAnalysis = payload?.timing_analysis as { demand_momentum: string; context_shock: string; seasonality: string } | undefined;
  const brandSentiment = payload?.brand_sentiment as { overall: string; analysis: string } | undefined;

  const scores = [
    { label: "Sociocomportamental", value: analysis.score_sociobehavioral, icon: Users, color: "bg-success" },
    { label: "Oferta", value: analysis.score_offer, icon: Zap, color: "bg-warning" },
    { label: "Performance", value: analysis.score_performance, icon: BarChart3, color: "bg-primary" },
  ];

  const handleExportDocx = () => {
    exportToDocx(analysis, payload);
    toast.success("Exportando DOCX...");
  };
  const handleExportPptx = () => {
    exportToPptx(analysis, payload);
    toast.success("Exportando PPTX...");
  };

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-8 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="min-w-0">
            <Link to="/app/analyses" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
              <ArrowLeft className="h-4 w-4" /> Voltar às análises
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold break-words">{analysis.title || "Relatório Executivo"}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(analysis.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleExportDocx}>
              <FileText className="h-4 w-4 mr-2" /> DOCX
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPptx}>
              <Presentation className="h-4 w-4 mr-2" /> PPTX
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/new-analysis">
                <Plus className="h-4 w-4 mr-2" /> Novo chat
              </Link>
            </Button>
          </div>
        </div>

        {/* Overall Score */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6 sm:p-8 text-center">
          <span className="section-label">Score Geral da Campanha</span>
          <div className="mt-4 relative flex items-center justify-center mx-auto w-32 h-32">
            <svg className="h-32 w-32" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--primary))" strokeWidth="8"
                strokeDasharray={`${(Number(analysis.score_overall ?? 0) / 100) * 314} 314`}
                strokeLinecap="round" transform="rotate(-90 60 60)" className="transition-all duration-1000" />
            </svg>
            <span className="absolute text-4xl font-display font-bold text-tabular">
              {Number(analysis.score_overall ?? 0).toFixed(0)}
            </span>
          </div>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto text-sm">
            {Number(analysis.score_overall ?? 0) < 50
              ? "Campanha com alta fricção e problemas estruturais significativos."
              : Number(analysis.score_overall ?? 0) < 75
              ? "Campanha com potencial, mas com gargalos que precisam ser resolvidos."
              : "Campanha bem estruturada. Ajustes finos podem otimizar ainda mais."}
          </p>
        </motion.div>

        {/* Sub-scores */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {scores.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-card p-6 pt-8 text-center relative">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-lg bg-warning shadow-md">
                <s.icon className="h-5 w-5 text-warning-foreground" />
              </div>
              <span className="section-label">{s.label}</span>
              <div className="mt-3 text-3xl font-display font-bold text-tabular">{Number(s.value ?? 0).toFixed(0)}<span className="text-lg text-muted-foreground">/100</span></div>
              <div className="mt-3 h-2 rounded-full bg-border overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Number(s.value ?? 0)}%` }} transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                  className={`h-full rounded-full ${s.color}`} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Run Steps (Kernel Traceability) */}
        <RunStepsBlock analysisId={id!} />

        {/* Inline Chat Block - Estrategista-Chefe */}
        {analysis && <ReportChatBlock analysis={analysis} />}

        {/* Marketing Era */}
        {marketingEra && (
          <div className="glass-card p-6">
            <h3 className="section-label mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Era do Marketing</h3>
            <div className="flex items-center gap-4 mb-3">
              <span className="text-3xl font-display font-bold text-primary">{marketingEra.era}</span>
              <div className="flex gap-1">
                {["1.0", "2.0", "3.0", "4.0"].map((era) => (
                  <div key={era} className={`h-2 w-8 rounded-full ${parseFloat(era) <= parseFloat(marketingEra.era) ? "bg-primary" : "bg-border"}`} />
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{marketingEra.description}</p>
            <p className="text-sm text-foreground/80"><strong>Recomendação:</strong> {marketingEra.recommendation}</p>
          </div>
        )}

        {/* Executive Summary */}
        {summary && (
          <div className="glass-card p-6">
            <h3 className="section-label mb-3">Resumo Executivo</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{summary}</p>
          </div>
        )}

        {/* Hormozi Value Analysis */}
        {hormoziAnalysis && (
          <div className="glass-card p-6">
            <h3 className="section-label mb-4 flex items-center gap-2"><Target className="h-4 w-4" /> Análise de Valor (Hormozi)</h3>
            <p className="text-xs text-muted-foreground mb-4">Valor = (Resultado Sonhado × Probabilidade) ÷ (Tempo × Esforço)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              {[
                { label: "Resultado Sonhado", value: hormoziAnalysis.dream_outcome, icon: "🎯" },
                { label: "Probabilidade", value: hormoziAnalysis.perceived_likelihood, icon: "📈" },
                { label: "Tempo (rapidez)", value: hormoziAnalysis.time_delay, icon: "⚡" },
                { label: "Facilidade", value: hormoziAnalysis.effort_sacrifice, icon: "🧘" },
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
            <p className="text-sm text-muted-foreground">{hormoziAnalysis.overall_value}</p>
          </div>
        )}

        {/* Cognitive Biases */}
        {cognitiveBiases.length > 0 && (
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-label flex items-center gap-2"><Brain className="h-4 w-4" /> Vieses Cognitivos</h3>
              {cognitiveBiases.length > 4 && (
                <button onClick={() => setExpandedBiases(!expandedBiases)} className="text-xs text-primary flex items-center gap-1">
                  {expandedBiases ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {expandedBiases ? "Ver menos" : `Ver todos (${cognitiveBiases.length})`}
                </button>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {(expandedBiases ? cognitiveBiases : cognitiveBiases.slice(0, 4)).map((b, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                    b.status === "presente" ? "bg-success/20 text-success" :
                    b.status === "ausente" ? "bg-destructive/20 text-destructive" :
                    "bg-warning/20 text-warning"
                  }`}>{b.status}</span>
                  <div>
                    <p className="text-sm font-medium">{b.bias}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{b.application}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPI Analysis */}
        {kpiAnalysis && (
          <div className="glass-card p-6">
            <h3 className="section-label mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Análise de KPIs</h3>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-warning" /> Métricas de Vaidade</h4>
                <ul className="space-y-1">
                  {kpiAnalysis.vanity_metrics.map((m, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" /> {m}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Target className="h-3.5 w-3.5 text-success" /> KPIs Recomendados</h4>
                <div className="mb-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">North Star Metric</span>
                  <p className="text-sm font-medium text-primary">{kpiAnalysis.recommended_north_star}</p>
                </div>
                <ul className="space-y-1">
                  {kpiAnalysis.recommended_kpis.map((k, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" /> {k}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Timing Analysis */}
        {timingAnalysis && (
          <div className="glass-card p-6">
            <h3 className="section-label mb-4 flex items-center gap-2"><Clock className="h-4 w-4" /> Timing e Tendências</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-accent/30">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Demand Momentum</span>
                <p className="text-sm font-medium mt-1">{timingAnalysis.demand_momentum}</p>
              </div>
              <div className="p-3 rounded-lg bg-accent/30">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Context Shock</span>
                <p className="text-sm font-medium mt-1">{timingAnalysis.context_shock}</p>
              </div>
              <div className="p-3 rounded-lg bg-accent/30">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Sazonalidade</span>
                <p className="text-sm font-medium mt-1">{timingAnalysis.seasonality}</p>
              </div>
            </div>
          </div>
        )}

        {/* Brand Sentiment */}
        {brandSentiment && (
          <div className="glass-card p-6">
            <h3 className="section-label mb-3 flex items-center gap-2"><Eye className="h-4 w-4" /> Sentimento da Marca</h3>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                brandSentiment.overall === "Positivo" ? "bg-success/20 text-success" :
                brandSentiment.overall === "Negativo" ? "bg-destructive/20 text-destructive" :
                "bg-warning/20 text-warning"
              }`}>{brandSentiment.overall}</span>
            </div>
            <p className="text-sm text-muted-foreground">{brandSentiment.analysis}</p>
          </div>
        )}

        {/* Improvements & Strengths */}
        <div className="glass-card p-6">
          <h3 className="section-label mb-4">Diagnóstico</h3>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-sm mb-3">🔴 Gargalos Identificados</h4>
              {improvements.length > 0 ? (
                <div className="space-y-4">
                  {improvements.map((cat, ci) => (
                    <div key={ci}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-destructive/80 mb-1.5">{cat.category}</p>
                      <ul className="space-y-1.5 text-sm text-muted-foreground pl-1">
                        {cat.items.map((item, ii) => <li key={ii}>• {item}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">• Dados de melhoria não disponíveis</p>
              )}
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">🟢 Pontos Fortes</h4>
              {strengths.length > 0 ? (
                <div className="space-y-4">
                  {strengths.map((cat, ci) => (
                    <div key={ci}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-success/80 mb-1.5">{cat.category}</p>
                      <ul className="space-y-1.5 text-sm text-muted-foreground pl-1">
                        {cat.items.map((item, ii) => <li key={ii}>• {item}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">• Dados de pontos fortes não disponíveis</p>
              )}
            </div>
          </div>
        </div>

        {/* Market References */}
        {marketRefs.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="section-label mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4" /> Referências de Mercado
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {marketRefs.map((ref, i) => <li key={i}>• {ref}</li>)}
            </ul>
          </div>
        )}

        {/* Synthetic Audience */}
        {/* Comportamento e Perfil do Público-Alvo */}
        <div className="glass-card p-6">
          <span className="inline-block px-3 py-1 rounded-md bg-destructive/15 text-destructive text-sm font-medium mb-4">
            Comportamento e perfil público-alvo
          </span>
          <div className="grid sm:grid-cols-2 gap-4">
            {(() => {
              const cards = audienceInsights
                ? [
                    { title: "Comportamento de Consumo", content: audienceInsights.consumption_behavior },
                    { title: "Geração Alvo Real", content: audienceInsights.target_generation },
                  ]
                : audienceBehavior?.cards && audienceBehavior.cards.length > 0
                ? audienceBehavior.cards
                : [
                    { title: "Comportamento de Consumo", content: insightsLoading ? "Gerando insights com IA..." : "Dados não disponíveis. Execute a análise para gerar insights." },
                    { title: "Geração Alvo Real", content: insightsLoading ? "Gerando insights com IA..." : "Dados não disponíveis. Execute a análise para gerar insights." },
                  ];
              return cards.map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="rounded-xl bg-primary/10 p-5 shadow-sm"
              >
                <h4 className="font-semibold text-sm mb-2">{card.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{card.content}</p>
              </motion.div>
              ));
            })()}
          </div>
        </div>
        {/* Feedback */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Como foi essa análise?</h3>
              <p className="text-sm text-muted-foreground">Seu feedback ajuda a melhorar os agentes.</p>
            </div>
            <div className="flex gap-2">
              <Button variant={feedbackSent === "like" ? "default" : "outline"} size="icon" onClick={() => handleFeedback("like")} disabled={feedbackSent !== null}>
                <ThumbsUp className="h-4 w-4" />
              </Button>
              <Button variant={feedbackSent === "dislike" ? "default" : "outline"} size="icon" onClick={() => handleFeedback("dislike")} disabled={feedbackSent !== null}>
                <ThumbsDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {!feedbackSent && (
            <Textarea
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="Deixe um comentário (opcional)..."
              className="bg-card text-sm"
              rows={2}
            />
          )}
          {feedbackSent && (
            <p className="text-sm text-success">✓ Feedback enviado. Obrigado!</p>
          )}
        </div>
      </div>
    </>
  );
}
