import type { useWorkspaceState } from "./useWorkspaceState";
import { ArtboardCard } from "./ArtboardCard";

type Props = {
  workspace: ReturnType<typeof useWorkspaceState>;
};

export function WorkspaceGrid({ workspace }: Props) {
  const { pan, wsZoom, artboards, selectedId } = workspace;

  return (
    <div
      className="flex-1 overflow-hidden relative select-none"
      style={{ cursor: "grab" }}
      onMouseDown={workspace.handlePanStart}
      onMouseMove={workspace.handlePanMove}
      onMouseUp={workspace.handlePanEnd}
      onMouseLeave={workspace.handlePanEnd}
      onWheel={workspace.handleWheel}
      onClick={() => workspace.setSelectedId(null)}
    >
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

      {/* Artboards layer */}
      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${wsZoom})`,
          willChange: "transform",
        }}
      >
        {artboards.map((ab) => (
          <ArtboardCard
            key={ab.id}
            artboard={ab}
            isSelected={selectedId === ab.id}
            onSelect={() => workspace.setSelectedId(ab.id)}
            onDoubleClick={() => workspace.setEditingId(ab.id)}
          />
        ))}
      </div>

      {/* Empty state */}
      {artboards.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Nenhum artboard ainda</p>
            <p className="text-xs text-muted-foreground/60">
              Clique em "Novo Artboard" para começar
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
