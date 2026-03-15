import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisRequest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Plus, BarChart3, History, FolderOpen, Zap, ArrowRight, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import ScoreEvolutionChart from "@/components/ScoreEvolutionChart";

type ConversationPreview = {
  id: string;
  title: string | null;
  context_type: string;
  analysis_request_id: string | null;
  updated_at: string;
};

export default function DashboardPage() {
  const { profile } = useAuth();
  const { planCode, uploadsLimit } = usePlanAccess();
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisRequest[]>([]);
  const [recentConversations, setRecentConversations] = useState<ConversationPreview[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [recentRes, countRes, convsRes] = await Promise.all([
        supabase
          .from("analysis_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("analysis_requests")
          .select("id", { count: "exact", head: true }),
      supabase
          .from("conversations")
          .select("id, title, context_type, analysis_request_id, updated_at")
          .order("updated_at", { ascending: false })
          .limit(5),
      ]);
      setRecentAnalyses(recentRes.data ?? []);
      setTotalCount(countRes.count ?? 0);

      // Enrich conversation titles with first user message (same logic as History)
      const rawConvs = convsRes.data ?? [];
      if (rawConvs.length > 0) {
        const enriched = await Promise.all(
          rawConvs.map(async (c) => {
            if (c.title && c.title !== "Nova Análise") return c;
            const { data } = await supabase
              .from("chat_messages")
              .select("content")
              .eq("conversation_id", c.id)
              .eq("role", "user")
              .order("created_at", { ascending: true })
              .limit(1);
            const firstMsg = data?.[0]?.content;
            return {
              ...c,
              title: firstMsg
                ? firstMsg.replace(/📎.*$/, "").trim().slice(0, 80)
                : c.title,
            };
          })
        );
        setRecentConversations(enriched);
      } else {
        setRecentConversations([]);
      }
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

  const getConversationLink = (c: ConversationPreview) => {
    if (c.context_type === "intake") return `/app/new-analysis?c=${c.id}`;
    if (c.context_type === "strategist" && c.analysis_request_id)
      return `/app/analysis/${c.analysis_request_id}/chat`;
    if (c.context_type === "campaign" && c.analysis_request_id)
      return `/app/analysis/${c.analysis_request_id}/campaign`;
    return `/app/new-analysis?c=${c.id}`;
  };

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

      {/* Recent conversations */}
      {recentConversations.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Conversas Recentes</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/history">Ver todas</Link>
            </Button>
          </div>
          <div className="space-y-2">
            {recentConversations.map((c) => (
              <Link key={c.id} to={getConversationLink(c)}
                className="glass-card p-4 flex items-center gap-4 hover:border-primary/30 transition-colors block">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.title || "Conversa sem título"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(c.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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
