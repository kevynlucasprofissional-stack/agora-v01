import { memo, useRef, useState, useCallback } from "react";
import type { WorkspaceText } from "./useWorkspaceState";

type Props = {
  node: WorkspaceText;
  isSelected: boolean;
  isArrowTarget: boolean;
  onSelect: () => void;
  onUpdate: (id: string, updates: Partial<WorkspaceText>) => void;
  onDragStart: (id: string, e: React.MouseEvent) => void;
  onArrowClick: (id: string) => void;
};

export const WorkspaceTextNode = memo(function WorkspaceTextNode({
  node, isSelected, isArrowTarget, onSelect, onUpdate, onDragStart, onArrowClick,
}: Props) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  return (
    <div
      className={`absolute cursor-grab active:cursor-grabbing select-none ${
        isArrowTarget ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded" : ""
      }`}
      style={{ left: node.x, top: node.y }}
      onClick={(e) => { e.stopPropagation(); onSelect(); onArrowClick(node.id); }}
      onDoubleClick={handleDoubleClick}
      onMouseDown={(e) => { if (e.button === 0 && !e.altKey && !editing) { e.stopPropagation(); onDragStart(node.id, e); } }}
    >
      <div
        className={`px-2 py-1 rounded transition-all duration-200 ${
          isSelected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-foreground/5"
        }`}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={node.text}
            onChange={(e) => onUpdate(node.id, { text: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === "Enter") setEditing(false); }}
            className="bg-transparent outline-none border-none min-w-[60px]"
            style={{
              fontSize: node.fontSize,
              color: node.color,
              fontWeight: node.bold ? 700 : 400,
              fontStyle: node.italic ? "italic" : "normal",
            }}
          />
        ) : (
          <span
            className="whitespace-nowrap"
            style={{
              fontSize: node.fontSize,
              color: node.color,
              fontWeight: node.bold ? 700 : 400,
              fontStyle: node.italic ? "italic" : "normal",
            }}
          >
            {node.text || "..."}
          </span>
        )}
      </div>
    </div>
  );
});
