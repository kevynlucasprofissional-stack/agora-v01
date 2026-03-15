import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisRequest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { MessageSquare, Download, ThumbsUp, ThumbsDown, ArrowLeft, Users, Zap, BarChart3, Sparkles, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { Json } from "@/integrations/supabase/types";

export default function AnalysisReportPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { canUseSyntheticAudience } = usePlanAccess();
  const [analysis, setAnalysis] = useState<AnalysisRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("analysis_requests")
        .select("*")
        .eq("id", id)
        .single();
      setAnalysis(data);
      setLoading(false);
    };
    fetch();
  }, [id]);

  const handleFeedback = async (type: "like" | "dislike") => {
    if (!analysis || !user) return;
    const { error } = await supabase.from("analysis_feedback").upsert({
      analysis_request_id: analysis.id,
      user_id: user.id,
      feedback: type,
    }, { onConflict: "analysis_request_id,user_id" });
    if (!error) toast.success(type === "like" ? "Obrigado pelo feedback positivo!" : "Agradecemos o feedback. Vamos melhorar.");
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando relatório...</div>;
  if (!analysis) return <div className="text-center py-20 text-muted-foreground">Análise não encontrada.</div>;

  const scores = [
    { label: "Sociocomportamental", value: analysis.score_sociobehavioral, icon: Users, color: "text-success" },
    { label: "Oferta", value: analysis.score_offer, icon: Zap, color: "text-warning" },
    { label: "Performance", value: analysis.score_performance, icon: BarChart3, color: "text-primary" },
  ];

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/app/history" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-4 w-4" /> Voltar ao histórico
          </Link>
          <h1 className="text-2xl font-bold">{analysis.title || "Relatório Executivo"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(analysis.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="hero" size="sm" asChild>
            <Link to={`/app/analysis/${id}/campaign`}>
              <Sparkles className="h-4 w-4 mr-2" /> Gerar Campanha
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/app/analysis/${id}/chat`}>
              <MessageSquare className="h-4 w-4 mr-2" /> Chat com Estrategista
            </Link>
          </Button>
        </div>
      </div>

      {/* Overall Score */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 text-center">
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
            ? "Campanha com alta fricção e problemas estruturais significativos. Recomenda-se revisão completa."
            : Number(analysis.score_overall ?? 0) < 75
            ? "Campanha com potencial, mas com gargalos que precisam ser resolvidos para escalar."
            : "Campanha bem estruturada com boas práticas. Ajustes finos podem otimizar ainda mais."}
        </p>
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
            <div className="mt-3 text-3xl font-display font-bold text-tabular">{Number(s.value ?? 0).toFixed(0)}<span className="text-lg text-muted-foreground">/100</span></div>
            <div className="mt-3 h-2 rounded-full bg-border overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Number(s.value ?? 0)}%` }} transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                className={`h-full rounded-full ${s.label === "Sociocomportamental" ? "bg-success" : s.label === "Oferta" ? "bg-warning" : "bg-primary"}`} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Diagnostic Summary - from AI */}
      {(() => {
        const payload = analysis.normalized_payload as Record<string, any> | null;
        const summary = payload?.executive_summary as string | undefined;
        const improvements = (payload?.improvements as string[] | undefined) || [];
        const strengths = (payload?.strengths as string[] | undefined) || [];
        const audienceInsights = (payload?.audience_insights as Array<{ generation: string; emoji: string; feedback: string }> | undefined) || [];
        const marketRefs = (payload?.market_references as string[] | undefined) || [];

        return (
          <>
            {/* Executive Summary */}
            {summary && (
              <div className="glass-card p-6">
                <h3 className="section-label mb-3">Resumo Executivo</h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{summary}</p>
              </div>
            )}

            {/* Improvements & Strengths */}
            <div className="glass-card p-6">
              <h3 className="section-label mb-4">Diagnóstico</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-sm mb-2">🔴 Gargalos Identificados</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {improvements.length > 0
                      ? improvements.map((imp, i) => <li key={i}>• {imp}</li>)
                      : <>
                          <li>• Proposta de valor não é clara em 3 segundos</li>
                          <li>• Métricas de vaidade dominando o painel de KPIs</li>
                          <li>• Excesso de fricção no funil de conversão</li>
                        </>
                    }
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">🟢 Pontos Fortes</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {strengths.length > 0
                      ? strengths.map((s, i) => <li key={i}>• {s}</li>)
                      : <>
                          <li>• Boa segmentação inicial</li>
                          <li>• Canal adequado ao público</li>
                        </>
                    }
                  </ul>
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
            {canUseSyntheticAudience ? (
              <div>
                <h3 className="section-label mb-4">Audiência Sintética — Veredicto Geracional</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {(audienceInsights.length > 0 ? audienceInsights : [
                    { generation: "Gen Z", emoji: "🧑‍💻", feedback: "Análise pendente." },
                    { generation: "Millennials", emoji: "👩‍🎨", feedback: "Análise pendente." },
                    { generation: "Gen X", emoji: "👨‍💼", feedback: "Análise pendente." },
                    { generation: "Boomers", emoji: "👴", feedback: "Análise pendente." },
                  ]).map((a, i) => (
                    <motion.div key={a.generation} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.1 }}
                      className="glass-card p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{a.emoji}</span>
                        <span className="font-display font-semibold text-sm">{a.generation}</span>
                      </div>
                      <p className="text-sm text-muted-foreground italic">"{a.feedback}"</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glass-card p-8 text-center relative overflow-hidden">
                <div className="absolute inset-0 backdrop-blur-md bg-card/80 flex flex-col items-center justify-center z-10">
                  <span className="section-label mb-2">Recurso Premium</span>
                  <p className="text-sm text-muted-foreground mb-4">A audiência sintética está disponível a partir do plano Standard.</p>
                  <Button variant="hero" size="sm" asChild>
                    <Link to="/app/settings">Fazer Upgrade</Link>
                  </Button>
                </div>
                <div className="opacity-30 grid md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="glass-card p-5">
                      <p className="text-sm">Conteúdo bloqueado</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Feedback */}
      <div className="glass-card p-6 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Como foi essa análise?</h3>
          <p className="text-sm text-muted-foreground">Seu feedback ajuda a melhorar os agentes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => handleFeedback("like")}>
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => handleFeedback("dislike")}>
            <ThumbsDown className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
