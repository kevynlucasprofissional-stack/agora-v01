import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Award,
  Zap,
} from "lucide-react";

/**
 * Maps heading keywords to an icon + accent color.
 */
const SECTION_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  score: { icon: BarChart3, color: "text-primary" },
  placar: { icon: BarChart3, color: "text-primary" },
  nota: { icon: Award, color: "text-primary" },
  recomenda: { icon: Lightbulb, color: "hsl(35 80% 55%)" },
  sugest: { icon: Lightbulb, color: "hsl(35 80% 55%)" },
  oportunidade: { icon: TrendingUp, color: "text-primary" },
  força: { icon: CheckCircle2, color: "text-primary" },
  ponto_forte: { icon: CheckCircle2, color: "text-primary" },
  fraqueza: { icon: AlertTriangle, color: "hsl(35 80% 55%)" },
  ponto_fraco: { icon: AlertTriangle, color: "hsl(35 80% 55%)" },
  risco: { icon: AlertTriangle, color: "hsl(0 65% 55%)" },
  ameaça: { icon: AlertTriangle, color: "hsl(0 65% 55%)" },
  veredito: { icon: Award, color: "text-primary" },
  diagnóstico: { icon: Target, color: "text-primary" },
  resumo: { icon: Zap, color: "text-primary" },
  conclus: { icon: Award, color: "text-primary" },
  comparati: { icon: BarChart3, color: "text-primary" },
  análise: { icon: Target, color: "text-primary" },
  estratég: { icon: Lightbulb, color: "hsl(35 80% 55%)" },
  performance: { icon: TrendingUp, color: "text-primary" },
  desempenho: { icon: TrendingUp, color: "text-primary" },
  melhoria: { icon: TrendingDown, color: "hsl(35 80% 55%)" },
};

function getIconForHeading(text: string) {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [key, val] of Object.entries(SECTION_ICONS)) {
    const normalKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (lower.includes(normalKey)) return val;
  }
  return null;
}

/** Detect score-like patterns: "88", "88/100", "9.5/10" */
function renderScoreBadge(text: string) {
  const scoreMatch = text.match(/\b(\d{1,3}(?:\.\d)?)\s*(?:\/\s*100|\/\s*10|pts|pontos)?\b/);
  if (!scoreMatch) return null;
  const num = parseFloat(scoreMatch[1]);
  // Only treat as score if between 0-100
  if (num < 0 || num > 100) return null;
  const color =
    num >= 80 ? "bg-primary/20 text-primary" :
    num >= 60 ? "bg-secondary/20 text-secondary-foreground" :
    "bg-destructive/20 text-destructive";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${color} ml-1`}>
      {scoreMatch[0]}
    </span>
  );
}

const components: Components = {
  // Headings become styled section headers with icons
  h2: ({ children, ...props }) => {
    const text = String(children);
    const iconInfo = getIconForHeading(text);
    const Icon = iconInfo?.icon;
    return (
      <div className="flex items-center gap-2.5 mt-6 mb-3 pb-2 border-b border-border/40">
        {Icon && (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
        <h2 className="text-base font-bold text-foreground m-0" {...props}>
          {children}
        </h2>
      </div>
    );
  },
  h3: ({ children, ...props }) => {
    const text = String(children);
    const iconInfo = getIconForHeading(text);
    const Icon = iconInfo?.icon;
    return (
      <div className="flex items-center gap-2 mt-4 mb-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-primary shrink-0" />}
        <h3 className="text-sm font-semibold text-foreground m-0" {...props}>
          {children}
        </h3>
      </div>
    );
  },
  // Tables get a scrollable wrapper
  table: ({ children, ...props }) => (
    <div className="my-4 rounded-xl border border-border/60 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs" {...props}>
          {children}
        </table>
      </div>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted/60" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }) => (
    <th className="px-3 py-2.5 text-left text-xs font-semibold text-foreground border-b-2 border-border/60 whitespace-nowrap" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => {
    const text = String(children ?? "");
    const badge = renderScoreBadge(text);
    // If the cell looks like a pure score number, render as badge only
    if (badge && /^\s*\d{1,3}(?:\.\d)?\s*$/.test(text)) {
      return (
        <td className="px-3 py-2.5 text-center border-b border-border/30" {...props}>
          {badge}
        </td>
      );
    }
    return (
      <td className="px-3 py-2.5 text-left text-xs text-foreground/90 border-b border-border/30 align-top" {...props}>
        {children}
      </td>
    );
  },
  tr: ({ children, ...props }) => (
    <tr className="hover:bg-accent/20 transition-colors" {...props}>
      {children}
    </tr>
  ),
  // Lists become styled
  ul: ({ children, ...props }) => (
    <ul className="my-2 space-y-1.5 pl-0 list-none" {...props}>
      {children}
    </ul>
  ),
  li: ({ children, ...props }) => (
    <li className="flex gap-2 text-sm leading-relaxed" {...props}>
      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
      <span>{children}</span>
    </li>
  ),
  // Bold text gets slight emphasis
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-foreground" {...props}>{children}</strong>
  ),
  // Blockquotes become callout cards
  blockquote: ({ children, ...props }) => (
    <div className="my-3 rounded-xl bg-primary/5 border-l-3 border-primary/40 px-4 py-3 text-sm" {...props}>
      {children}
    </div>
  ),
  // Paragraphs with better spacing
  p: ({ children, ...props }) => (
    <p className="text-sm leading-relaxed my-2 text-foreground/85" {...props}>
      {children}
    </p>
  ),
  // Code blocks as styled panels
  code: ({ children, className, ...props }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="block bg-muted/40 rounded-lg p-3 text-xs overflow-x-auto" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-muted/60 rounded px-1.5 py-0.5 text-xs font-medium" {...props}>
        {children}
      </code>
    );
  },
  // Horizontal rules become visual dividers
  hr: () => (
    <div className="my-5 flex items-center gap-3">
      <div className="flex-1 h-px bg-border/40" />
      <div className="h-1.5 w-1.5 rounded-full bg-primary/30" />
      <div className="flex-1 h-px bg-border/40" />
    </div>
  ),
};

interface RichMarkdownRendererProps {
  content: string;
  className?: string;
}

export function RichMarkdownRenderer({ content, className = "" }: RichMarkdownRendererProps) {
  const rendered = useMemo(
    () => (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    ),
    [content]
  );

  return <div className={`rich-markdown ${className}`}>{rendered}</div>;
}
