import { memo } from "react";
import type { Arrow } from "./useWorkspaceState";

type Props = {
  arrow: Arrow;
  from: { x: number; y: number } | null;
  to: { x: number; y: number } | null;
  isSelected: boolean;
  onSelect: () => void;
};

export const ArrowConnector = memo(function ArrowConnector({ arrow, from, to, isSelected, onSelect }: Props) {
  if (!from || !to) return null;

  const markerId = `arrowhead-${arrow.id}`;
  const markerStartId = `arrowhead-start-${arrow.id}`;
  const strokeColor = isSelected ? "hsl(var(--primary))" : arrow.color;
  const strokeDash = arrow.style === "dashed" ? "8 4" : undefined;

  // Padding around the SVG so markers aren't clipped
  const pad = 20;
  const minX = Math.min(from.x, to.x) - pad;
  const minY = Math.min(from.y, to.y) - pad;
  const maxX = Math.max(from.x, to.x) + pad;
  const maxY = Math.max(from.y, to.y) + pad;

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
        <marker
          id={markerId}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} />
        </marker>
        {arrow.direction === "two-way" && (
          <marker
            id={markerStartId}
            markerWidth="10"
            markerHeight="7"
            refX="1"
            refY="3.5"
            orient="auto"
          >
            <polygon points="10 0, 0 3.5, 10 7" fill={strokeColor} />
          </marker>
        )}
      </defs>
      {/* Invisible wider line for easier clicking */}
      <line
        x1={from.x - minX}
        y1={from.y - minY}
        x2={to.x - minX}
        y2={to.y - minY}
        stroke="transparent"
        strokeWidth={16}
        className="pointer-events-auto cursor-pointer"
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      />
      <line
        x1={from.x - minX}
        y1={from.y - minY}
        x2={to.x - minX}
        y2={to.y - minY}
        stroke={strokeColor}
        strokeWidth={isSelected ? 2.5 : 2}
        strokeDasharray={strokeDash}
        markerEnd={`url(#${markerId})`}
        markerStart={arrow.direction === "two-way" ? `url(#${markerStartId})` : undefined}
        className="pointer-events-none"
      />
    </svg>
  );
});
