import { useCallback, useState, useRef, useEffect } from "react";
import type { CanvasFormat } from "./useCanvasState";

export type NoteColor = "yellow" | "pink" | "blue" | "green" | "purple" | "orange";
export type ArrowStyle = "solid" | "dashed" | "curved";
export type ArrowDirection = "one-way" | "two-way";
export type ArrowMode = "connected" | "freeform";

export interface Artboard {
  id: string;
  type: "artboard";
  name: string;
  x: number;
  y: number;
  zIndex: number;
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
  zIndex: number;
  text: string;
  color: NoteColor;
}

export interface WorkspaceText {
  id: string;
  type: "text";
  x: number;
  y: number;
  zIndex: number;
  text: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
}

export interface Arrow {
  id: string;
  type: "arrow";
  arrowMode: ArrowMode;
  // Connected mode
  fromId: string | null;
  toId: string | null;
  // Freeform mode
  x1: number;
  y1: number;
  x2: number;
  y2: number;
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
  const [elements, setElements] = useState<WorkspaceElement[]>(() => {
    try {
      const saved = localStorage.getItem("agora-workspace-elements");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pan, setPan] = useState(() => {
    try {
      const saved = localStorage.getItem("agora-workspace-view");
      if (saved) { const v = JSON.parse(saved); return { x: v.panX ?? 0, y: v.panY ?? 0 }; }
    } catch {}
    return { x: 0, y: 0 };
  });
  const [wsZoom, setWsZoom] = useState(() => {
    try {
      const saved = localStorage.getItem("agora-workspace-view");
      if (saved) { const v = JSON.parse(saved); return v.zoom ?? 1; }
    } catch {}
    return 1;
  });
  const [arrowToolMode, setArrowToolMode] = useState<"connected" | "freeform" | null>(null);
  const [arrowFromId, setArrowFromId] = useState<string | null>(null);
  const [freeformStart, setFreeformStart] = useState<{ x: number; y: number } | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Persist elements to localStorage (debounced, strip large thumbnails)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stripped = elements.map((e) => {
          if (e.type === "artboard") {
            return { ...e, thumbnail: null, layersState: null };
          }
          return e;
        });
        localStorage.setItem("agora-workspace-elements", JSON.stringify(stripped));
      } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [elements]);

  const nextZIndex = useCallback(() => {
    const maxZ = elements.reduce((m, e) => {
      const z = (e as any).zIndex ?? 0;
      return z > m ? z : m;
    }, 0);
    return maxZ + 1;
  }, [elements]);

  const snapValue = useCallback((v: number) => {
    if (!snapToGrid) return v;
    return Math.round(v / 40) * 40;
  }, [snapToGrid]);

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
      id, type: "artboard",
      name: name || `Artboard ${count + 1}`,
      x, y, zIndex: nextZIndex(),
      format, layersState: null, thumbnail: null,
    };
    setElements((prev) => [...prev, artboard]);
    setSelectedId(id);
    return id;
  }, [elements, nextZIndex]);

  // ---- StickyNote CRUD ----
  const addStickyNote = useCallback((color: NoteColor = "yellow") => {
    const id = crypto.randomUUID();
    const note: StickyNote = {
      id, type: "sticky-note",
      x: -pan.x / wsZoom + 200,
      y: -pan.y / wsZoom + 200,
      width: 200, height: 160,
      zIndex: nextZIndex(),
      text: "", color,
    };
    setElements((prev) => [...prev, note]);
    setSelectedId(id);
    return id;
  }, [pan, wsZoom, nextZIndex]);

  // ---- Text CRUD ----
  const addText = useCallback(() => {
    const id = crypto.randomUUID();
    const text: WorkspaceText = {
      id, type: "text",
      x: -pan.x / wsZoom + 200,
      y: -pan.y / wsZoom + 200,
      zIndex: nextZIndex(),
      text: "Texto", fontSize: 16,
      color: "hsl(var(--foreground))",
      bold: false, italic: false,
    };
    setElements((prev) => [...prev, text]);
    setSelectedId(id);
    return id;
  }, [pan, wsZoom, nextZIndex]);

  // ---- Arrow CRUD ----
  const addConnectedArrow = useCallback((fromId: string, toId: string) => {
    const id = crypto.randomUUID();
    const arrow: Arrow = {
      id, type: "arrow", arrowMode: "connected",
      fromId, toId,
      x1: 0, y1: 0, x2: 0, y2: 0,
      color: "hsl(var(--foreground) / 0.5)",
      style: "solid", direction: "one-way",
    };
    setElements((prev) => [...prev, arrow]);
    setSelectedId(id);
    setArrowToolMode(null);
    setArrowFromId(null);
    return id;
  }, []);

  const addFreeformArrow = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const id = crypto.randomUUID();
    const arrow: Arrow = {
      id, type: "arrow", arrowMode: "freeform",
      fromId: null, toId: null,
      x1, y1, x2, y2,
      color: "hsl(var(--foreground) / 0.5)",
      style: "solid", direction: "one-way",
    };
    setElements((prev) => [...prev, arrow]);
    setSelectedId(id);
    setArrowToolMode(null);
    setFreeformStart(null);
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

  // ---- Z-Index ----
  const bringToFront = useCallback((id: string) => {
    const maxZ = elements.reduce((m, e) => Math.max(m, (e as any).zIndex ?? 0), 0);
    updateElement(id, { zIndex: maxZ + 1 });
  }, [elements, updateElement]);

  const sendToBack = useCallback((id: string) => {
    const minZ = elements.reduce((m, e) => Math.min(m, (e as any).zIndex ?? 0), 0);
    updateElement(id, { zIndex: minZ - 1 });
  }, [elements, updateElement]);

  // ---- Duplicate ----
  const duplicateElement = useCallback((id: string) => {
    const el = elements.find((e) => e.id === id);
    if (!el || el.type === "arrow") return;
    const newId = crypto.randomUUID();
    const clone = { ...el, id: newId, x: (el as any).x + 30, y: (el as any).y + 30, zIndex: nextZIndex() };
    setElements((prev) => [...prev, clone as WorkspaceElement]);
    setSelectedId(newId);
  }, [elements, nextZIndex]);

  // Legacy compatibility
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
    if (arrowToolMode !== "connected") return;
    if (!arrowFromId) {
      setArrowFromId(elementId);
    } else if (elementId !== arrowFromId) {
      addConnectedArrow(arrowFromId, elementId);
    }
  }, [arrowToolMode, arrowFromId, addConnectedArrow]);

  const handleFreeformClick = useCallback((worldX: number, worldY: number) => {
    if (arrowToolMode !== "freeform") return;
    if (!freeformStart) {
      setFreeformStart({ x: worldX, y: worldY });
    } else {
      addFreeformArrow(freeformStart.x, freeformStart.y, worldX, worldY);
    }
  }, [arrowToolMode, freeformStart, addFreeformArrow]);

  const cancelArrowMode = useCallback(() => {
    setArrowToolMode(null);
    setArrowFromId(null);
    setFreeformStart(null);
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
    addConnectedArrow,
    addFreeformArrow,
    removeElement,
    updateElement,
    updateArtboard,
    removeArtboard,
    getElementCenter,
    bringToFront,
    sendToBack,
    duplicateElement,
    arrowToolMode,
    setArrowToolMode,
    arrowFromId,
    freeformStart,
    handleArrowClick,
    handleFreeformClick,
    cancelArrowMode,
    snapToGrid,
    setSnapToGrid,
    snapValue,
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
