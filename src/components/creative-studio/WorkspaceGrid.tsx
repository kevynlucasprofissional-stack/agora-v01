import { useRef, useCallback, useState } from "react";
import type { useWorkspaceState } from "./useWorkspaceState";
import { ArtboardCard } from "./ArtboardCard";
import { StickyNoteCard } from "./StickyNoteCard";
import { WorkspaceTextNode } from "./WorkspaceTextNode";
import { ArrowConnector } from "./ArrowConnector";

type Props = {
  workspace: ReturnType<typeof useWorkspaceState>;
};

export function WorkspaceGrid({ workspace }: Props) {
  const { pan, wsZoom, artboards, stickyNotes, texts, arrows, selectedId, arrowMode, arrowFromId } = workspace;

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
      workspace.updateElement(dragRef.current.id, {
        x: dragRef.current.elX + dx,
        y: dragRef.current.elY + dy,
      });
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

  return (
    <div
      className="flex-1 overflow-hidden relative select-none"
      style={{ cursor: arrowMode ? "crosshair" : "grab" }}
      onMouseDown={workspace.handlePanStart}
      onMouseMove={workspace.handlePanMove}
      onMouseUp={workspace.handlePanEnd}
      onMouseLeave={workspace.handlePanEnd}
      onWheel={workspace.handleWheel}
      onClick={() => { workspace.setSelectedId(null); if (arrowMode) workspace.cancelArrowMode(); }}
    >
      {/* Arrow mode indicator */}
      {arrowMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium shadow-lg">
          {arrowFromId ? "Clique no elemento de destino" : "Clique no elemento de origem"}
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
        {/* Arrows first (behind other elements) */}
        {arrows.map((arrow) => (
          <ArrowConnector
            key={arrow.id}
            arrow={arrow}
            from={workspace.getElementCenter(arrow.fromId)}
            to={workspace.getElementCenter(arrow.toId)}
            isSelected={selectedId === arrow.id}
            onSelect={() => workspace.setSelectedId(arrow.id)}
          />
        ))}

        {/* Artboards */}
        {artboards.map((ab) => (
          <ArtboardCard
            key={ab.id}
            artboard={ab}
            isSelected={selectedId === ab.id}
            isArrowTarget={arrowMode && arrowFromId !== null && arrowFromId !== ab.id}
            onSelect={() => workspace.setSelectedId(ab.id)}
            onDoubleClick={() => workspace.setEditingId(ab.id)}
            onDragStart={handleDragStart}
            onArrowClick={handleArrowClick}
          />
        ))}

        {/* Sticky Notes */}
        {stickyNotes.map((note) => (
          <StickyNoteCard
            key={note.id}
            note={note}
            isSelected={selectedId === note.id}
            isArrowTarget={arrowMode && arrowFromId !== null && arrowFromId !== note.id}
            onSelect={() => workspace.setSelectedId(note.id)}
            onUpdate={workspace.updateElement}
            onDragStart={handleDragStart}
            onArrowClick={handleArrowClick}
          />
        ))}

        {/* Texts */}
        {texts.map((node) => (
          <WorkspaceTextNode
            key={node.id}
            node={node}
            isSelected={selectedId === node.id}
            isArrowTarget={arrowMode && arrowFromId !== null && arrowFromId !== node.id}
            onSelect={() => workspace.setSelectedId(node.id)}
            onUpdate={workspace.updateElement}
            onDragStart={handleDragStart}
            onArrowClick={handleArrowClick}
          />
        ))}
      </div>

      {/* Empty state */}
      {workspace.elements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Nenhum elemento ainda</p>
            <p className="text-xs text-muted-foreground/60">
              Adicione artboards, notas ou textos para começar
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
