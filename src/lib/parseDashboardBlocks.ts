import type { DashboardData } from "@/components/comparator/ComparatorDashboard";

export type ContentBlock =
  | { type: "text"; content: string }
  | { type: "dashboard"; data: DashboardData };

const DASHBOARD_REGEX = /\[DASHBOARD\]([\s\S]*?)\[\/DASHBOARD\]/g;

export function parseDashboardBlocks(raw: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let lastIndex = 0;

  for (const match of raw.matchAll(DASHBOARD_REGEX)) {
    const before = raw.slice(lastIndex, match.index);
    if (before.trim()) blocks.push({ type: "text", content: before });

    try {
      const data = JSON.parse(match[1]) as DashboardData;
      if (data.campaigns && data.scores) {
        blocks.push({ type: "dashboard", data });
      } else {
        blocks.push({ type: "text", content: match[0] });
      }
    } catch {
      // If JSON parse fails, keep as text
      blocks.push({ type: "text", content: match[0] });
    }

    lastIndex = (match.index ?? 0) + match[0].length;
  }

  const remaining = raw.slice(lastIndex);
  if (remaining.trim()) blocks.push({ type: "text", content: remaining });

  return blocks.length > 0 ? blocks : [{ type: "text", content: raw }];
}
