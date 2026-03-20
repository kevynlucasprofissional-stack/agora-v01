import { memo } from "react";
import type { Artboard } from "./useWorkspaceState";

const FORMAT_DIMS: Record<string, { w: number; h: number }> = {
  "1080x1080": { w: 1080, h: 1080 },
  "1080x1920": { w: 1080, h: 1920 },
  "1200x628": { w: 1200, h: 628 },
  "1080x1350": { w: 1080, h: 1350 },
};

const THUMB_SCALE = 0.18;

type Props = {
  artboard: Artboard;
  isSelected: boolean;
  isArrowTarget?: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
  onDragStart: (id: string, e: React.MouseEvent) => void;
  onArrowClick: (id: string) => void;
};

export const ArtboardCard = memo(function ArtboardCard({
  artboard, isSelected, isArrowTarget, onSelect, onDoubleClick, onDragStart, onArrowClick,
}: Props) {
  const dims = FORMAT_DIMS[artboard.format] || { w: 1080, h: 1080 };
  const w = dims.w * THUMB_SCALE;
  const h = dims.h * THUMB_SCALE;

  return (
    <div
      className={`absolute group cursor-grab active:cursor-grabbing ${
        isArrowTarget ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg" : ""
      }`}
      style={{ left: artboard.x, top: artboard.y }}
      onClick={(e) => { e.stopPropagation(); onSelect(); onArrowClick(artboard.id); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
      onMouseDown={(e) => { if (e.button === 0 && !e.altKey) { e.stopPropagation(); onDragStart(artboard.id, e); } }}
    >
      {/* Label */}
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-foreground/70 truncate max-w-[160px]">
          {artboard.name}
        </span>
        <span className="text-[9px] text-muted-foreground">
          {artboard.format}
        </span>
      </div>

      {/* Card */}
      <div
        className={`rounded-lg overflow-hidden transition-shadow duration-200 ${
          isSelected
            ? "ring-2 ring-primary shadow-lg shadow-primary/20"
            : "ring-1 ring-border/50 shadow-md hover:shadow-lg hover:ring-border"
        }`}
        style={{ width: w, height: h }}
      >
        {artboard.thumbnail ? (
          <img
            src={artboard.thumbnail}
            alt={artboard.name}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-white flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground/40">Vazio</span>
          </div>
        )}
      </div>
    </div>
  );
});
