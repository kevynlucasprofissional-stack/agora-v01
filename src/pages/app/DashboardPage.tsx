import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisRequest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Plus, BarChart3, History, FolderOpen, Zap, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const { profile } = useAuth();
  const { planCode, uploadsLimit } = usePlanAccess();
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisRequest[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [recentRes, countRes] = await Promise.all([
        supabase
          .from("analysis_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("analysis_requests")
          .select("id", { count: "exact", head: true }),
      ]);
      setRecentAnalyses(recentRes.data ?? []);
      setTotalCount(countRes.count ?? 0);
      setLoading(false);
    };
    fetchData();
  }, []);

  const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: "Rascunho", color: "text-muted-foreground" },
    processing: { label: "Processando", color: "text-warning" },
    completed: { label: "Concluída", color: "text-success" },
    failed: { label: "Falhou", color: "text-destructive" },
    awaiting_clarification: { label: "Aguardando", color: "text-warning" },
    archived: { label: "Arquivada", color: "text-muted-foreground" },
  };

  const todayCount = recentAnalyses.filter(a => new Date(a.created_at).toDateString() === new Date().toDateString()).length;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold">
          Olá, {profile?.full_name || "Analista"} 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          Bem-vindo ao seu centro de comando. Plano atual:{" "}
          <span className="font-medium text-primary capitalize">{planCode}</span>
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Plus, label: "Nova\nAnálise", to: "/app/new-analysis", primary: true },
          { icon: History, label: "Histórico", to: "/app/history" },
          { icon: FolderOpen, label: "Biblioteca", to: "/app/assets" },
          { icon: BarChart3, label: "Conta", to: "/app/account" },
        ].map((a, i) => (
          <motion.div key={a.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={a.to} className={`glass-card p-5 flex items-center gap-4 hover:border-primary/30 transition-all group block aspect-[2/1] ${a.primary ? "border-primary/30 bg-primary/5" : ""}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${a.primary ? "bg-primary text-primary-foreground" : "bg-warning text-warning-foreground"} transition-colors shrink-0`}>
                <a.icon className="h-5 w-5" />
              </div>
              <span className="font-medium whitespace-pre-line">{a.label}</span>
              {a.primary && <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Usage stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <span className="section-label">Análises Hoje</span>
          <p className="mt-2 text-3xl font-display font-bold text-tabular">{todayCount}</p>
        </div>
        <div className="glass-card p-5">
          <span className="section-label">Total de Análises</span>
          <p className="mt-2 text-3xl font-display font-bold text-tabular">{totalCount}</p>
        </div>
        <div className="glass-card p-5">
          <span className="section-label">Limite de Uploads</span>
          <p className="mt-2 text-3xl font-display font-bold text-tabular">
            {uploadsLimit >= 999999 ? "∞" : `${uploadsLimit}/dia`}
          </p>
        </div>
      </div>

      {/* Recent analyses */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Análises Recentes</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/history">Ver todas</Link>
          </Button>
        </div>
        {loading ? (
          <div className="glass-card p-8 text-center text-muted-foreground">Carregando...</div>
        ) : recentAnalyses.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Zap className="h-10 w-10 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg">Nenhuma análise ainda</h3>
            <p className="text-sm text-muted-foreground mt-1">Comece sua primeira auditoria de campanha agora.</p>
            <Button variant="hero" className="mt-6" asChild>
              <Link to="/app/new-analysis">
                <Plus className="h-4 w-4 mr-2" /> Nova Análise
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {recentAnalyses.map((a) => (
              <Link key={a.id} to={a.status === "completed" ? `/app/analysis/${a.id}/report` : `/app/new-analysis`}
                className="glass-card p-4 flex items-center gap-4 hover:border-primary/30 transition-colors block">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{a.title || "Análise sem título"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className={`text-xs font-medium ${statusLabels[a.status]?.color}`}>
                  {statusLabels[a.status]?.label}
                </span>
                {a.score_overall != null && (
                  <span className="text-lg font-display font-bold text-primary text-tabular">
                    {Number(a.score_overall).toFixed(0)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
