import { useRef, useCallback, useState, useEffect } from "react";
import { MousePointerClick, Move, ZoomIn, Keyboard, X } from "lucide-react";
import type { useWorkspaceState } from "./useWorkspaceState";
import { ArtboardCard } from "./ArtboardCard";
import { StickyNoteCard } from "./StickyNoteCard";
import { WorkspaceTextNode } from "./WorkspaceTextNode";
import { ArrowConnector } from "./ArrowConnector";

type Props = {
  workspace: ReturnType<typeof useWorkspaceState>;
};

export function WorkspaceGrid({ workspace }: Props) {
  const { pan, wsZoom, artboards, stickyNotes, texts, arrows, selectedId, arrowToolMode, arrowFromId, freeformStart } = workspace;
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag state
  const dragRef = useRef<{ id: string; startX: number; startY: number; elX: number; elY: number } | null>(null);
  const [, forceUpdate] = useState(0);

  const handleDragStart = useCallback((id: string, e: React.MouseEvent) => {
    const el = workspace.elements.find((el) => el.id === id);
    if (!el || el.type === "arrow") return;
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, elX: (el as any).x, elY: (el as any).y };

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / wsZoom;
      const dy = (ev.clientY - dragRef.current.startY) / wsZoom;
      const newX = workspace.snapValue(dragRef.current.elX + dx);
      const newY = workspace.snapValue(dragRef.current.elY + dy);
      workspace.updateElement(dragRef.current.id, { x: newX, y: newY });
      forceUpdate((n) => n + 1);
    };

    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [workspace, wsZoom]);

  const handleArrowClick = useCallback((id: string) => {
    workspace.handleArrowClick(id);
  }, [workspace]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      if ((e.key === "Delete" || e.key === "Backspace") && workspace.selectedId) {
        workspace.removeElement(workspace.selectedId);
      }
      if (e.key === "d" && (e.ctrlKey || e.metaKey) && workspace.selectedId) {
        e.preventDefault();
        workspace.duplicateElement(workspace.selectedId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [workspace.selectedId, workspace.removeElement, workspace.duplicateElement]);

  // Handle workspace click for freeform arrows
  const handleWorkspaceClick = useCallback((e: React.MouseEvent) => {
    if (arrowToolMode === "freeform") {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (e.clientX - rect.left - pan.x) / wsZoom;
      const worldY = (e.clientY - rect.top - pan.y) / wsZoom;
      workspace.handleFreeformClick(worldX, worldY);
      return;
    }
    workspace.setSelectedId(null);
    if (arrowToolMode) workspace.cancelArrowMode();
  }, [arrowToolMode, pan, wsZoom, workspace]);

  // Sort non-arrow elements by zIndex for rendering
  const nonArrowElements = workspace.elements
    .filter((e) => e.type !== "arrow")
    .sort((a, b) => ((a as any).zIndex ?? 0) - ((b as any).zIndex ?? 0));

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative select-none"
      style={{ cursor: arrowToolMode ? "crosshair" : "grab" }}
      onMouseDown={workspace.handlePanStart}
      onMouseMove={workspace.handlePanMove}
      onMouseUp={workspace.handlePanEnd}
      onMouseLeave={workspace.handlePanEnd}
      onWheel={workspace.handleWheel}
      onClick={handleWorkspaceClick}
      tabIndex={0}
    >
      {/* Arrow mode indicator */}
      {arrowToolMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium shadow-lg">
          {arrowToolMode === "connected"
            ? (arrowFromId ? "Clique no elemento de destino" : "Clique no elemento de origem")
            : (freeformStart ? "Clique no ponto final da seta" : "Clique no ponto inicial da seta")
          }
          <button
            className="ml-2 underline opacity-80 hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); workspace.cancelArrowMode(); }}
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--foreground) / 0.06) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--foreground) / 0.06) 1px, transparent 1px)
          `,
          backgroundSize: `${40 * wsZoom}px ${40 * wsZoom}px`,
          backgroundPosition: `${pan.x % (40 * wsZoom)}px ${pan.y % (40 * wsZoom)}px`,
        }}
      />

      {/* Elements layer */}
      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${wsZoom})`,
          willChange: "transform",
        }}
      >
        {/* Arrows (rendered first, behind) */}
        {arrows.map((arrow) => (
          <ArrowConnector
            key={arrow.id}
            arrow={arrow}
            from={arrow.arrowMode === "connected" && arrow.fromId ? workspace.getElementCenter(arrow.fromId) : null}
            to={arrow.arrowMode === "connected" && arrow.toId ? workspace.getElementCenter(arrow.toId) : null}
            isSelected={selectedId === arrow.id}
            onSelect={() => workspace.setSelectedId(arrow.id)}
            onUpdateEndpoint={workspace.updateElement}
            wsZoom={wsZoom}
          />
        ))}

        {/* All non-arrow elements sorted by zIndex */}
        {nonArrowElements.map((el) => {
          if (el.type === "artboard") {
            const ab = el as any;
            return (
              <ArtboardCard
                key={ab.id}
                artboard={ab}
                isSelected={selectedId === ab.id}
                isArrowTarget={arrowToolMode === "connected" && arrowFromId !== null && arrowFromId !== ab.id}
                onSelect={() => workspace.setSelectedId(ab.id)}
                onDoubleClick={() => workspace.setEditingId(ab.id)}
                onDragStart={handleDragStart}
                onArrowClick={handleArrowClick}
                zIndex={ab.zIndex}
              />
            );
          }
          if (el.type === "sticky-note") {
            const note = el as any;
            return (
              <StickyNoteCard
                key={note.id}
                note={note}
                isSelected={selectedId === note.id}
                isArrowTarget={arrowToolMode === "connected" && arrowFromId !== null && arrowFromId !== note.id}
                onSelect={() => workspace.setSelectedId(note.id)}
                onUpdate={workspace.updateElement}
                onDragStart={handleDragStart}
                onArrowClick={handleArrowClick}
                wsZoom={wsZoom}
              />
            );
          }
          if (el.type === "text") {
            const node = el as any;
            return (
              <WorkspaceTextNode
                key={node.id}
                node={node}
                isSelected={selectedId === node.id}
                isArrowTarget={arrowToolMode === "connected" && arrowFromId !== null && arrowFromId !== node.id}
                onSelect={() => workspace.setSelectedId(node.id)}
                onUpdate={workspace.updateElement}
                onDragStart={handleDragStart}
                onArrowClick={handleArrowClick}
                zIndex={node.zIndex}
              />
            );
          }
          return null;
        })}
      </div>

      {/* Minimap */}
      <Minimap workspace={workspace} containerRef={containerRef} />

      {/* Onboarding hints (dismissible) */}
      <OnboardingHints hasElements={workspace.elements.length > 0} />

      {/* Empty state */}
      {workspace.elements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <MousePointerClick className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Nenhum elemento ainda</p>
            <p className="text-xs text-muted-foreground/70 max-w-[240px]">
              Clique em <strong>+ Artboard</strong> na barra acima para criar seu primeiro criativo
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Minimap ----
const MINIMAP_FORMAT_DIMS: Record<string, { w: number; h: number }> = {
  "1080x1080": { w: 1080, h: 1080 },
  "1080x1920": { w: 1080, h: 1920 },
  "1200x628": { w: 1200, h: 628 },
  "1080x1350": { w: 1080, h: 1350 },
};
const MM_THUMB_SCALE = 0.18;

function getElementBounds(e: any): { x: number; y: number; w: number; h: number } {
  const x = e.x ?? 0;
  const y = e.y ?? 0;
  if (e.type === "artboard") {
    const dims = MINIMAP_FORMAT_DIMS[e.format] || { w: 1080, h: 1080 };
    return { x, y, w: dims.w * MM_THUMB_SCALE, h: dims.h * MM_THUMB_SCALE };
  }
  if (e.type === "sticky-note") {
    return { x, y, w: e.width ?? 200, h: e.height ?? 160 };
  }
  // text
  return { x, y, w: 100, h: 24 };
}

function Minimap({ workspace, containerRef }: { workspace: ReturnType<typeof useWorkspaceState>; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const els = workspace.elements.filter((e) => e.type !== "arrow");
  if (els.length === 0) return null;

  const mmW = 160;
  const mmH = 110;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  els.forEach((e) => {
    const b = getElementBounds(e);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  });

  // Add padding around world bounds
  const pad = 100;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;

  const worldW = Math.max(maxX - minX, 200);
  const worldH = Math.max(maxY - minY, 200);
  const scale = Math.min(mmW / worldW, mmH / worldH) * 0.85;

  const rect = containerRef.current?.getBoundingClientRect();
  const vpW = rect ? rect.width / workspace.wsZoom : 800;
  const vpH = rect ? rect.height / workspace.wsZoom : 600;
  const vpX = (-workspace.pan.x / workspace.wsZoom - minX) * scale;
  const vpY = (-workspace.pan.y / workspace.wsZoom - minY) * scale;

  return (
    <div className="absolute bottom-3 right-3 z-20 rounded-lg border border-border bg-card/90 backdrop-blur-sm p-2"
      style={{ width: mmW, height: mmH, pointerEvents: "auto", cursor: "pointer" }}
      title="Minimapa — visão geral do workspace"
      onClick={(e) => {
        e.stopPropagation();
        const mmRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const clickX = (e.clientX - mmRect.left - 8) / scale + minX;
        const clickY = (e.clientY - mmRect.top - 8) / scale + minY;
        const cRect = containerRef.current?.getBoundingClientRect();
        if (!cRect) return;
        workspace.setPan({
          x: -(clickX - cRect.width / workspace.wsZoom / 2) * workspace.wsZoom,
          y: -(clickY - cRect.height / workspace.wsZoom / 2) * workspace.wsZoom,
        });
      }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${mmW} ${mmH}`}>
        {els.map((e) => {
          const b = getElementBounds(e);
          const ex = (b.x - minX) * scale;
          const ey = (b.y - minY) * scale;
          const ew = Math.max(b.w * scale, 4);
          const eh = Math.max(b.h * scale, 4);
          const fill = e.type === "artboard" ? "hsl(var(--primary) / 0.5)"
            : e.type === "sticky-note" ? "hsl(48, 96%, 70%)"
            : "hsl(var(--foreground) / 0.3)";
          return <rect key={e.id} x={ex} y={ey} width={ew} height={eh} fill={fill} rx={2} />;
        })}
        <rect
          x={vpX} y={vpY}
          width={Math.max(vpW * scale, 10)} height={Math.max(vpH * scale, 10)}
          fill="hsl(var(--primary) / 0.08)"
          stroke="hsl(var(--primary))"
          strokeWidth={1.5}
          rx={2}
          opacity={0.8}
        />
      </svg>
    </div>
  );
}
