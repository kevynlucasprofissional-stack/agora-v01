import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

type ScorePoint = {
  date: string;
  label: string;
  overall: number;
  performance: number | null;
  offer: number | null;
  sociobehavioral: number | null;
};

export default function ScoreEvolutionChart() {
  const [data, setData] = useState<ScorePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: rows } = await supabase
        .from("analysis_requests")
        .select("created_at, score_overall, score_performance, score_offer, score_sociobehavioral, title")
        .eq("status", "completed")
        .not("score_overall", "is", null)
        .order("created_at", { ascending: true })
        .limit(20);

      if (rows && rows.length > 0) {
        setData(
          rows.map((r, i) => ({
            date: r.created_at,
            label: new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
            overall: Number(r.score_overall) || 0,
            performance: r.score_performance != null ? Number(r.score_performance) : null,
            offer: r.score_offer != null ? Number(r.score_offer) : null,
            sociobehavioral: r.score_sociobehavioral != null ? Number(r.score_sociobehavioral) : null,
          }))
        );
      }
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6 h-[280px] flex items-center justify-center text-muted-foreground text-sm">
        Carregando gráfico…
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className="glass-card p-6 h-[280px] flex flex-col items-center justify-center text-center">
        <TrendingUp className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Complete ao menos 2 análises para ver sua evolução.
        </p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border/50 bg-background/95 backdrop-blur-sm px-3 py-2 shadow-xl text-xs space-y-1">
        <p className="font-medium text-foreground">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-semibold text-foreground">{Number(p.value).toFixed(0)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Evolução das Notas</h3>
          <p className="text-xs text-muted-foreground">Desempenho ao longo das análises</p>
        </div>
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-overall" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(220, 80%, 55%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(220, 80%, 55%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-perf" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(155, 50%, 55%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(155, 50%, 55%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-offer" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(40, 80%, 60%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(40, 80%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 10%, 25%)" strokeOpacity={0.3} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "hsl(220, 10%, 55%)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "hsl(220, 10%, 55%)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="overall"
              name="Geral"
              stroke="hsl(220, 80%, 55%)"
              strokeWidth={2.5}
              fill="url(#grad-overall)"
              dot={{ r: 3, fill: "hsl(220, 80%, 55%)", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(220, 80%, 75%)" }}
            />
            <Area
              type="monotone"
              dataKey="performance"
              name="Performance"
              stroke="hsl(155, 50%, 55%)"
              strokeWidth={1.5}
              fill="url(#grad-perf)"
              dot={false}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="offer"
              name="Oferta"
              stroke="hsl(40, 80%, 60%)"
              strokeWidth={1.5}
              fill="url(#grad-offer)"
              dot={false}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(220, 80%, 55%)" }} />
          Geral
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(155, 50%, 55%)" }} />
          Performance
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(40, 80%, 60%)" }} />
          Oferta
        </span>
      </div>
    </motion.div>
  );
}
