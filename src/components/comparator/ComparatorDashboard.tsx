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
  "hsl(155, 42%, 55%)",
  "hsl(35, 90%, 60%)",
  "hsl(200, 60%, 55%)",
  "hsl(340, 60%, 55%)",
];

const DIM_LABELS: Record<string, string> = {
  socio: "Sociocomp.",
  offer: "Oferta",
  performance: "Perform.",
  creative: "Criativo",
};

function ScoreRing({ value, size = 48 }: { value: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / 100, 1);
  const color =
    value >= 80 ? "stroke-primary" :
    value >= 60 ? "stroke-secondary" :
    "stroke-destructive";

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" className="stroke-muted/40" strokeWidth={4} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        className={color}
        strokeWidth={4}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        className="fill-foreground text-xs font-bold"
      >
        {value}
      </text>
    </svg>
  );
}

function DimBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min((value / 100) * 100, 100);
  const color =
    value >= 80 ? "bg-primary" :
    value >= 60 ? "bg-secondary" :
    "bg-destructive";

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-20 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-foreground w-6 text-right">{value}</span>
    </div>
  );
}

export function ComparatorDashboard({ data }: { data: DashboardData }) {
  const radarData = useMemo(() => {
    const dims = Object.entries(DIM_LABELS);
    return dims.map(([key, label]) => {
      const entry: Record<string, string | number> = { dimension: label };
      data.scores.forEach((s) => {
        entry[s.campaign] = s[key as keyof typeof s] as number;
      });
      return entry;
    });
  }, [data]);

  const barData = useMemo(
    () => data.scores.map((s) => ({ name: s.campaign, score: s.overall })),
    [data]
  );

  const bestScore = data.scores.reduce((a, b) => (a.overall > b.overall ? a : b));
  const isSingle = data.scores.length === 1;

  return (
    <div className="my-4 rounded-2xl border border-border/40 bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 bg-muted/20 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
          <Target className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">
            {data.title || "Dashboard Comparativo"}
          </h3>
          <p className="text-[10px] text-muted-foreground truncate">
            {data.campaigns.join(" vs ")}
          </p>
        </div>
      </div>

      {/* Campaign score cards - compact grid */}
      <div className={`grid gap-3 p-4 ${data.scores.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {data.scores.map((s, i) => (
          <div key={s.campaign} className="rounded-xl border border-border/30 bg-background/50 p-3">
            <div className="flex items-center gap-3 mb-2.5">
              <ScoreRing value={s.overall} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs font-bold text-foreground truncate">{s.campaign}</span>
                </div>
                {s.verdict && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{s.verdict}</p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              {Object.entries(DIM_LABELS).map(([key, label]) => (
                <DimBar key={key} label={label} value={s[key as keyof typeof s] as number} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Radar chart - only for 2+ campaigns */}
      {!isSingle && (
        <div className="px-4 pb-4">
          <div className="rounded-xl border border-border/30 bg-background/50 p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Perfil por Dimensão
            </p>
            <ResponsiveContainer width="100%" height={200}>
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
            <div className="flex gap-3 justify-center">
              {data.scores.map((s, i) => (
                <div key={s.campaign} className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-[10px] text-muted-foreground">{s.campaign}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Winner banner */}
      {data.winner && !isSingle && (
        <div className="mx-4 mb-4 rounded-xl bg-primary/10 border border-primary/20 p-3 flex items-start gap-2.5">
          <Trophy className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">
              🏆 Vencedora: {data.winner}
            </p>
            {data.winnerReason && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{data.winnerReason}</p>
            )}
          </div>
        </div>
      )}

      {/* Quick actions */}
      {data.actions && data.actions.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Zap className="h-3 w-3" /> Ações Prioritárias
          </p>
          <div className="space-y-1">
            {data.actions.map((action, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground/85 bg-muted/20 rounded-lg px-3 py-1.5">
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
