import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisRequest } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ChevronRight, BarChart3 } from "lucide-react";

const statusMap: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  processing: { label: "Processando", className: "bg-warning/20 text-warning" },
  completed: { label: "Concluída", className: "bg-success/20 text-success" },
  failed: { label: "Falhou", className: "bg-destructive/20 text-destructive" },
  awaiting_clarification: { label: "Aguardando", className: "bg-warning/20 text-warning" },
  archived: { label: "Arquivada", className: "bg-muted text-muted-foreground" },
};

export default function AnalysisResultsPage() {
  const [analyses, setAnalyses] = useState<AnalysisRequest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("analysis_requests")
        .select("*")
        .order("created_at", { ascending: false });
      setAnalyses(data ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = analyses.filter(
    (a) =>
      (a.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.raw_prompt || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Resultados das Análises</h1>
        <Button variant="hero" size="sm" asChild>
          <Link to="/app/new-analysis">
            <Plus className="h-4 w-4 mr-2" /> Novo chat
          </Link>
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar análises..."
          className="pl-10 bg-card"
        />
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma análise encontrada.</p>
          <p className="text-xs text-muted-foreground mt-1">Inicie uma nova análise para começar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Link
              key={a.id}
              to={a.status === "completed" ? `/app/analysis/${a.id}/report` : "#"}
              className="glass-card p-4 flex items-center gap-4 hover:border-primary/30 transition-colors block"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{a.title || "Análise sem título"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(a.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                  {a.industry && ` · ${a.industry}`}
                </p>
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${statusMap[a.status]?.className}`}
              >
                {statusMap[a.status]?.label}
              </span>
              {a.score_overall != null && (
                <span className="text-xl font-display font-bold text-primary text-tabular min-w-[40px] text-right">
                  {Number(a.score_overall).toFixed(0)}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
