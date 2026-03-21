import { memo, useCallback } from "react";
import type { Arrow } from "./useWorkspaceState";

type Props = {
  arrow: Arrow;
  from: { x: number; y: number } | null;
  to: { x: number; y: number } | null;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateEndpoint?: (id: string, updates: Partial<Arrow>) => void;
  wsZoom?: number;
};

export const ArrowConnector = memo(function ArrowConnector({ arrow, from, to, isSelected, onSelect, onUpdateEndpoint, wsZoom = 1 }: Props) {
  // Determine start/end points
  let p1: { x: number; y: number } | null;
  let p2: { x: number; y: number } | null;

  if (arrow.arrowMode === "freeform") {
    p1 = { x: arrow.x1, y: arrow.y1 };
    p2 = { x: arrow.x2, y: arrow.y2 };
  } else {
    p1 = from;
    p2 = to;
  }

  if (!p1 || !p2) return null;

  const markerId = `arrowhead-${arrow.id}`;
  const markerStartId = `arrowhead-start-${arrow.id}`;
  const strokeColor = isSelected ? "hsl(var(--primary))" : arrow.color;
  const strokeDash = arrow.style === "dashed" ? "8 4" : undefined;

  const pad = 24;
  const minX = Math.min(p1.x, p2.x) - pad;
  const minY = Math.min(p1.y, p2.y) - pad;
  const maxX = Math.max(p1.x, p2.x) + pad;
  const maxY = Math.max(p1.y, p2.y) + pad;

  const lx1 = p1.x - minX;
  const ly1 = p1.y - minY;
  const lx2 = p2.x - minX;
  const ly2 = p2.y - minY;

  // Curved: compute control point perpendicular to midpoint
  const isCurved = arrow.style === "curved";
  let pathD = "";
  if (isCurved) {
    const mx = (lx1 + lx2) / 2;
    const my = (ly1 + ly2) / 2;
    const dx = lx2 - lx1;
    const dy = ly2 - ly1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const offset = len * 0.25;
    const cx = mx + (-dy / len) * offset;
    const cy = my + (dx / len) * offset;
    pathD = `M ${lx1},${ly1} Q ${cx},${cy} ${lx2},${ly2}`;
  }

  // Freeform endpoint drag
  const handleEndpointDrag = useCallback((which: "start" | "end", e: React.MouseEvent) => {
    if (arrow.arrowMode !== "freeform" || !onUpdateEndpoint) return;
    e.stopPropagation();
    e.preventDefault();
    const startMX = e.clientX;
    const startMY = e.clientY;
    const origX = which === "start" ? arrow.x1 : arrow.x2;
    const origY = which === "start" ? arrow.y1 : arrow.y2;

    const handleMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startMX) / wsZoom;
      const dy = (ev.clientY - startMY) / wsZoom;
      const updates: Partial<Arrow> = which === "start"
        ? { x1: origX + dx, y1: origY + dy }
        : { x2: origX + dx, y2: origY + dy };
      onUpdateEndpoint(arrow.id, updates);
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [arrow, onUpdateEndpoint, wsZoom]);

  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        left: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY,
        overflow: "visible",
      }}
    >
      <defs>
        <marker id={markerId} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} />
        </marker>
        {arrow.direction === "two-way" && (
          <marker id={markerStartId} markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto">
            <polygon points="10 0, 0 3.5, 10 7" fill={strokeColor} />
          </marker>
        )}
      </defs>

      {/* Hit area */}
      {isCurved ? (
        <path
          d={pathD}
          stroke="transparent"
          strokeWidth={16}
          fill="none"
          className="pointer-events-auto cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        />
      ) : (
        <line
          x1={lx1} y1={ly1} x2={lx2} y2={ly2}
          stroke="transparent"
          strokeWidth={16}
          className="pointer-events-auto cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        />
      )}

      {/* Visible line/path */}
      {isCurved ? (
        <path
          d={pathD}
          stroke={strokeColor}
          strokeWidth={isSelected ? 2.5 : 2}
          fill="none"
          markerEnd={`url(#${markerId})`}
          markerStart={arrow.direction === "two-way" ? `url(#${markerStartId})` : undefined}
          className="pointer-events-none"
        />
      ) : (
        <line
          x1={lx1} y1={ly1} x2={lx2} y2={ly2}
          stroke={strokeColor}
          strokeWidth={isSelected ? 2.5 : 2}
          strokeDasharray={strokeDash}
          markerEnd={`url(#${markerId})`}
          markerStart={arrow.direction === "two-way" ? `url(#${markerStartId})` : undefined}
          className="pointer-events-none"
        />
      )}

      {/* Freeform drag handles */}
      {isSelected && arrow.arrowMode === "freeform" && (
        <>
          <circle
            cx={lx1} cy={ly1} r={5}
            fill="hsl(var(--primary))"
            stroke="hsl(var(--background))"
            strokeWidth={2}
            className="pointer-events-auto cursor-move"
            onMouseDown={(e) => handleEndpointDrag("start", e)}
          />
          <circle
            cx={lx2} cy={ly2} r={5}
            fill="hsl(var(--primary))"
            stroke="hsl(var(--background))"
            strokeWidth={2}
            className="pointer-events-auto cursor-move"
            onMouseDown={(e) => handleEndpointDrag("end", e)}
          />
        </>
      )}
    </svg>
  );
});
