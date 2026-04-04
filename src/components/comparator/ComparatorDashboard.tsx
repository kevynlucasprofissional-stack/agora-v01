import { useMemo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { Trophy, TrendingUp, Target, Zap, Award } from "lucide-react";

export interface DashboardData {
  title?: string;
  campaigns: string[];
  scores: Array<{
    campaign: string;
    overall: number;
    socio: number;
    offer: number;
    performance: number;
    creative: number;
    verdict?: string;
  }>;
  winner?: string;
  winnerReason?: string;
  actions?: string[];
}

const COLORS = [
  "hsl(155, 42%, 55%)", // primary sage
  "hsl(35, 90%, 60%)",  // secondary amber
  "hsl(200, 60%, 55%)", // blue
  "hsl(340, 60%, 55%)", // pink
];

function ScoreBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color =
    value >= 80 ? "bg-primary" :
    value >= 60 ? "bg-secondary" :
    "bg-destructive";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-28 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-2.5 bg-muted/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-bold text-foreground w-8 text-right">{value}</span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/30 border border-border/30 min-w-0">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${accent || "bg-primary/10"}`}>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <span className="text-xl font-bold text-foreground truncate max-w-full">{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-center leading-tight">{label}</span>
    </div>
  );
}

export function ComparatorDashboard({ data }: { data: DashboardData }) {
  const radarData = useMemo(() => {
    const dims = [
      { key: "socio", label: "Sociocomp." },
      { key: "offer", label: "Oferta" },
      { key: "performance", label: "Performance" },
      { key: "creative", label: "Criativo" },
    ];
    return dims.map((d) => {
      const entry: Record<string, string | number> = { dimension: d.label };
      data.scores.forEach((s) => {
        entry[s.campaign] = s[d.key as keyof typeof s] as number;
      });
      return entry;
    });
  }, [data]);

  const barData = useMemo(
    () => data.scores.map((s) => ({ name: s.campaign, score: s.overall })),
    [data]
  );

  const winnerScore = data.scores.find((s) => s.campaign === data.winner);
  const bestScore = data.scores.reduce((a, b) => (a.overall > b.overall ? a : b));

  return (
    <div className="my-4 rounded-2xl border border-border/40 bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {data.title || "Dashboard Comparativo"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {data.campaigns.join(" vs ")}
            </p>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4">
        <KpiCard
          label="Campanhas"
          value={data.campaigns.length}
          icon={Target}
        />
        <KpiCard
          label="Melhor Score"
          value={bestScore.overall}
          icon={Award}
          accent="bg-primary/15"
        />
        <KpiCard
          label="Média Geral"
          value={Math.round(data.scores.reduce((a, b) => a + b.overall, 0) / data.scores.length)}
          icon={TrendingUp}
        />
        <KpiCard
          label="Vencedora"
          value={data.winner || bestScore.campaign}
          icon={Trophy}
          accent="bg-secondary/15"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-4">
        {/* Radar */}
        <div className="rounded-xl border border-border/30 bg-background/50 p-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Perfil por Dimensão
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              {data.scores.map((s, i) => (
                <Radar
                  key={s.campaign}
                  name={s.campaign}
                  dataKey={s.campaign}
                  stroke={COLORS[i % COLORS.length]}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 justify-center mt-1">
            {data.scores.map((s, i) => (
              <div key={s.campaign} className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-[10px] text-muted-foreground">{s.campaign}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart */}
        <div className="rounded-xl border border-border/30 bg-background/50 p-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Score Geral
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={24}>
                {barData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Score breakdown per campaign */}
      <div className="px-4 pb-4 space-y-4">
        {data.scores.map((s, i) => (
          <div key={s.campaign} className="rounded-xl border border-border/30 bg-background/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-sm font-bold text-foreground">{s.campaign}</span>
              <span className="ml-auto text-lg font-bold text-foreground">{s.overall}/100</span>
            </div>
            <div className="space-y-2">
              <ScoreBar label="Sociocomp." value={s.socio} />
              <ScoreBar label="Oferta" value={s.offer} />
              <ScoreBar label="Performance" value={s.performance} />
              <ScoreBar label="Criativo" value={s.creative} />
            </div>
            {s.verdict && (
              <p className="mt-3 text-xs text-muted-foreground italic border-t border-border/20 pt-2">
                {s.verdict}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Winner banner */}
      {data.winner && (
        <div className="mx-4 mb-4 rounded-xl bg-primary/10 border border-primary/20 p-4 flex items-start gap-3">
          <Trophy className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-foreground">
              🏆 Vencedora: {data.winner}
            </p>
            {data.winnerReason && (
              <p className="text-xs text-muted-foreground mt-1">{data.winnerReason}</p>
            )}
          </div>
        </div>
      )}

      {/* Quick actions */}
      {data.actions && data.actions.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Zap className="h-3 w-3" /> Ações Prioritárias
          </p>
          <div className="space-y-1.5">
            {data.actions.map((action, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-foreground/85 bg-muted/20 rounded-lg px-3 py-2"
              >
                <span className="font-bold text-primary shrink-0">{i + 1}.</span>
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
