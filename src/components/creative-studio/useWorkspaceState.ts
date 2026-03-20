import { useCallback, useState, useRef } from "react";
import type { CanvasFormat } from "./useCanvasState";

export type NoteColor = "yellow" | "pink" | "blue" | "green" | "purple" | "orange";
export type ArrowStyle = "solid" | "dashed";
export type ArrowDirection = "one-way" | "two-way";

export interface Artboard {
  id: string;
  type: "artboard";
  name: string;
  x: number;
  y: number;
  format: CanvasFormat;
  layersState: any | null;
  thumbnail: string | null;
}

export interface StickyNote {
  id: string;
  type: "sticky-note";
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: NoteColor;
}

export interface WorkspaceText {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
}

export interface Arrow {
  id: string;
  type: "arrow";
  fromId: string;
  toId: string;
  color: string;
  style: ArrowStyle;
  direction: ArrowDirection;
}

export type WorkspaceElement = Artboard | StickyNote | WorkspaceText | Arrow;

const FORMAT_DIMS: Record<CanvasFormat, { w: number; h: number }> = {
  "1080x1080": { w: 1080, h: 1080 },
  "1080x1920": { w: 1080, h: 1920 },
  "1200x628": { w: 1200, h: 628 },
  "1080x1350": { w: 1080, h: 1350 },
};

const THUMB_SCALE = 0.18;

const NOTE_COLORS: Record<NoteColor, string> = {
  yellow: "hsl(48, 96%, 89%)",
  pink: "hsl(330, 80%, 90%)",
  blue: "hsl(210, 80%, 90%)",
  green: "hsl(140, 60%, 88%)",
  purple: "hsl(270, 60%, 90%)",
  orange: "hsl(25, 90%, 88%)",
};

export function useWorkspaceState() {
  const [elements, setElements] = useState<WorkspaceElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [wsZoom, setWsZoom] = useState(1);
  const [arrowMode, setArrowMode] = useState(false);
  const [arrowFromId, setArrowFromId] = useState<string | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Derived lists
  const artboards = elements.filter((e): e is Artboard => e.type === "artboard");
  const stickyNotes = elements.filter((e): e is StickyNote => e.type === "sticky-note");
  const texts = elements.filter((e): e is WorkspaceText => e.type === "text");
  const arrows = elements.filter((e): e is Arrow => e.type === "arrow");

  // ---- Artboard CRUD ----
  const addArtboard = useCallback((format: CanvasFormat, name?: string) => {
    const id = crypto.randomUUID();
    const count = elements.filter((e) => e.type === "artboard").length;
    const col = count % 3;
    const row = Math.floor(count / 3);
    const dims = FORMAT_DIMS[format];
    const spacing = 80;
    const x = col * (dims.w * THUMB_SCALE + spacing) + 60;
    const y = row * (dims.h * THUMB_SCALE + spacing + 40) + 60;

    const artboard: Artboard = {
      id,
      type: "artboard",
      name: name || `Artboard ${count + 1}`,
      x,
      y,
      format,
      layersState: null,
      thumbnail: null,
    };
    setElements((prev) => [...prev, artboard]);
    setSelectedId(id);
    return id;
  }, [elements]);

  // ---- StickyNote CRUD ----
  const addStickyNote = useCallback((color: NoteColor = "yellow") => {
    const id = crypto.randomUUID();
    const note: StickyNote = {
      id,
      type: "sticky-note",
      x: -pan.x / wsZoom + 200,
      y: -pan.y / wsZoom + 200,
      width: 200,
      height: 160,
      text: "",
      color,
    };
    setElements((prev) => [...prev, note]);
    setSelectedId(id);
    return id;
  }, [pan, wsZoom]);

  // ---- Text CRUD ----
  const addText = useCallback(() => {
    const id = crypto.randomUUID();
    const text: WorkspaceText = {
      id,
      type: "text",
      x: -pan.x / wsZoom + 200,
      y: -pan.y / wsZoom + 200,
      text: "Texto",
      fontSize: 16,
      color: "hsl(var(--foreground))",
      bold: false,
      italic: false,
    };
    setElements((prev) => [...prev, text]);
    setSelectedId(id);
    return id;
  }, [pan, wsZoom]);

  // ---- Arrow CRUD ----
  const addArrow = useCallback((fromId: string, toId: string) => {
    const id = crypto.randomUUID();
    const arrow: Arrow = {
      id,
      type: "arrow",
      fromId,
      toId,
      color: "hsl(var(--foreground) / 0.5)",
      style: "solid",
      direction: "one-way",
    };
    setElements((prev) => [...prev, arrow]);
    setSelectedId(id);
    setArrowMode(false);
    setArrowFromId(null);
    return id;
  }, []);

  // ---- Generic CRUD ----
  const removeElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id && !(e.type === "arrow" && ((e as Arrow).fromId === id || (e as Arrow).toId === id))));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  }, [selectedId, editingId]);

  const updateElement = useCallback((id: string, updates: Partial<any>) => {
    setElements((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  }, []);

  // Legacy compatibility aliases
  const updateArtboard = updateElement;
  const removeArtboard = removeElement;

  const selectedElement = elements.find((e) => e.id === selectedId) || null;
  const selectedArtboard = selectedElement?.type === "artboard" ? (selectedElement as Artboard) : null;
  const editingArtboard = elements.find((e) => e.id === editingId && e.type === "artboard") as Artboard | null;

  // Helper: get center position of a connectable element
  const getElementCenter = useCallback((id: string): { x: number; y: number } | null => {
    const el = elements.find((e) => e.id === id);
    if (!el) return null;
    if (el.type === "artboard") {
      const dims = FORMAT_DIMS[el.format] || { w: 1080, h: 1080 };
      return { x: el.x + (dims.w * THUMB_SCALE) / 2, y: el.y + (dims.h * THUMB_SCALE) / 2 };
    }
    if (el.type === "sticky-note") {
      return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
    }
    if (el.type === "text") {
      return { x: el.x + 40, y: el.y + 10 };
    }
    return null;
  }, [elements]);

  // Arrow mode handlers
  const handleArrowClick = useCallback((elementId: string) => {
    if (!arrowMode) return;
    if (!arrowFromId) {
      setArrowFromId(elementId);
    } else if (elementId !== arrowFromId) {
      addArrow(arrowFromId, elementId);
    }
  }, [arrowMode, arrowFromId, addArrow]);

  const cancelArrowMode = useCallback(() => {
    setArrowMode(false);
    setArrowFromId(null);
  }, []);

  // Pan handlers
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      e.preventDefault();
    }
  }, [pan]);

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }, []);

  const handlePanEnd = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setWsZoom((z) => Math.min(3, Math.max(0.2, z + delta)));
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  return {
    elements,
    artboards,
    stickyNotes,
    texts,
    arrows,
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    selectedElement,
    selectedArtboard,
    editingArtboard,
    addArtboard,
    addStickyNote,
    addText,
    addArrow,
    removeElement,
    updateElement,
    updateArtboard,
    removeArtboard,
    getElementCenter,
    arrowMode,
    setArrowMode,
    arrowFromId,
    handleArrowClick,
    cancelArrowMode,
    pan,
    setPan,
    wsZoom,
    setWsZoom,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    handleWheel,
    thumbScale: THUMB_SCALE,
    formatDims: FORMAT_DIMS,
    noteColors: NOTE_COLORS,
  };
}
