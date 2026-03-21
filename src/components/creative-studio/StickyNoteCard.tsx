import { memo, useRef, useState, useCallback } from "react";
import type { StickyNote, NoteColor } from "./useWorkspaceState";

const NOTE_COLORS: Record<NoteColor, string> = {
  yellow: "hsl(48, 96%, 89%)",
  pink: "hsl(330, 80%, 90%)",
  blue: "hsl(210, 80%, 90%)",
  green: "hsl(140, 60%, 88%)",
  purple: "hsl(270, 60%, 90%)",
  orange: "hsl(25, 90%, 88%)",
};

const NOTE_BORDER_COLORS: Record<NoteColor, string> = {
  yellow: "hsl(48, 70%, 70%)",
  pink: "hsl(330, 50%, 72%)",
  blue: "hsl(210, 50%, 72%)",
  green: "hsl(140, 40%, 68%)",
  purple: "hsl(270, 40%, 72%)",
  orange: "hsl(25, 60%, 70%)",
};

type Props = {
  note: StickyNote;
  isSelected: boolean;
  isArrowTarget: boolean;
  onSelect: () => void;
  onUpdate: (id: string, updates: Partial<StickyNote>) => void;
  onDragStart: (id: string, e: React.MouseEvent) => void;
  onArrowClick: (id: string) => void;
  wsZoom: number;
};

export const StickyNoteCard = memo(function StickyNoteCard({
  note, isSelected, isArrowTarget, onSelect, onUpdate, onDragStart, onArrowClick, wsZoom,
}: Props) {
  const [editing, setEditing] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    setTimeout(() => textRef.current?.focus(), 0);
  }, []);

  const handleBlur = useCallback(() => {
    setEditing(false);
  }, []);

  // Resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = note.width;
    const startH = note.height;

    const handleMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / wsZoom;
      const dy = (ev.clientY - startY) / wsZoom;
      onUpdate(note.id, {
        width: Math.max(80, startW + dx),
        height: Math.max(60, startH + dy),
      });
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [note.id, note.width, note.height, wsZoom, onUpdate]);

  const bg = NOTE_COLORS[note.color];
  const border = NOTE_BORDER_COLORS[note.color];

  return (
    <div
      className={`absolute group cursor-grab active:cursor-grabbing select-none ${
        isArrowTarget ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      }`}
      style={{ left: note.x, top: note.y, width: note.width, height: note.height, zIndex: note.zIndex }}
      onClick={(e) => { e.stopPropagation(); onSelect(); onArrowClick(note.id); }}
      onDoubleClick={handleDoubleClick}
      onMouseDown={(e) => { if (e.button === 0 && !e.altKey && !editing) { e.stopPropagation(); onDragStart(note.id, e); } }}
    >
      <div
        className={`w-full h-full rounded-lg overflow-hidden transition-shadow duration-200 ${
          isSelected ? "shadow-lg ring-2 ring-primary" : "shadow-md hover:shadow-lg"
        }`}
        style={{ backgroundColor: bg, borderColor: border, borderWidth: 1 }}
      >
        {editing ? (
          <textarea
            ref={textRef}
            value={note.text}
            onChange={(e) => onUpdate(note.id, { text: e.target.value })}
            onBlur={handleBlur}
            className="w-full h-full bg-transparent resize-none p-3 text-xs text-gray-800 outline-none"
            placeholder="Escreva sua nota..."
          />
        ) : (
          <div className="w-full h-full p-3 text-xs text-gray-800 overflow-hidden whitespace-pre-wrap break-words">
            {note.text || <span className="text-gray-400 italic">Duplo-clique para editar</span>}
          </div>
        )}
      </div>

      {/* Resize handle */}
      {isSelected && (
        <div
          className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize bg-primary/60 rounded-tl-sm hover:bg-primary transition-colors"
          onMouseDown={handleResizeStart}
        />
      )}
    </div>
  );
});
