import { useCallback, useState, useRef, useEffect } from "react";
import type { CanvasFormat } from "./useCanvasState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  creativeJobId?: string | null;
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
  fromId: string | null;
  toId: string | null;
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
  const { user } = useAuth();
  const [elements, setElements] = useState<WorkspaceElement[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);
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

  // Track which artboard IDs have pending DB saves
  const savePendingRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Load artboards from DB on mount ----
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("workspace_artboards")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        const artboards: Artboard[] = data.map((row: any) => ({
          id: row.id,
          type: "artboard" as const,
          name: row.name || "Artboard",
          x: Number(row.x) || 0,
          y: Number(row.y) || 0,
          zIndex: row.z_index || 0,
          format: (row.format || "1080x1080") as CanvasFormat,
          layersState: row.layers_state || null,
          thumbnail: row.thumbnail || null,
          creativeJobId: row.creative_job_id || null,
        }));

        // Load non-artboard elements from localStorage
        let otherElements: WorkspaceElement[] = [];
        try {
          const saved = localStorage.getItem("agora-workspace-others");
          if (saved) otherElements = JSON.parse(saved);
        } catch {}

        setElements([...artboards, ...otherElements]);
      } else {
        // No artboards in DB, load non-artboard elements from localStorage
        let otherElements: WorkspaceElement[] = [];
        try {
          const saved = localStorage.getItem("agora-workspace-others");
          if (saved) otherElements = JSON.parse(saved);
        } catch {}
        setElements(otherElements);
      }
      setDbLoaded(true);
    };
    load();
  }, [user]);

  // ---- Persist non-artboard elements to localStorage ----
  useEffect(() => {
    if (!dbLoaded) return;
    const timer = setTimeout(() => {
      const others = elements.filter((e) => e.type !== "artboard");
      try {
        localStorage.setItem("agora-workspace-others", JSON.stringify(others));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [elements, dbLoaded]);

  // ---- Debounced artboard save to DB ----
  const flushArtboardSaves = useCallback(async () => {
    if (!user || savePendingRef.current.size === 0) return;
    const idsToSave = Array.from(savePendingRef.current);
    savePendingRef.current.clear();

    // Get current elements
    setElements((current) => {
      const artboardsToSave = current.filter(
        (e) => e.type === "artboard" && idsToSave.includes(e.id)
      ) as Artboard[];

      // Fire and forget upserts
      artboardsToSave.forEach(async (ab) => {
        try {
          const { error } = await supabase.from("workspace_artboards").upsert({
            id: ab.id,
            user_id: user.id,
            name: ab.name,
            format: ab.format,
            x: ab.x,
            y: ab.y,
            z_index: ab.zIndex,
            layers_state: ab.layersState as any,
            thumbnail: ab.thumbnail,
            creative_job_id: ab.creativeJobId || null,
          }, { onConflict: "id" });
          if (error) console.error("Artboard save error:", ab.id, error.message);
        } catch (err) {
          console.error("Artboard save exception:", ab.id, err);
        }
      });

      return current; // don't modify state
    });
  }, [user]);

  const scheduleArtboardSave = useCallback((id: string) => {
    savePendingRef.current.add(id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => flushArtboardSaves(), 2000);
  }, [flushArtboardSaves]);

  // Persist pan/zoom to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("agora-workspace-view", JSON.stringify({ panX: pan.x, panY: pan.y, zoom: wsZoom }));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [pan, wsZoom]);

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
  const addArtboard = useCallback((format: CanvasFormat, name?: string, opts?: { creativeJobId?: string; id?: string }) => {
    const id = opts?.id || crypto.randomUUID();
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
      creativeJobId: opts?.creativeJobId || null,
    };
    setElements((prev) => [...prev, artboard]);
    setSelectedId(id);

    // Persist to DB immediately
    if (user) {
      supabase.from("workspace_artboards").insert({
        id,
        user_id: user.id,
        name: artboard.name,
        format: artboard.format,
        x: artboard.x,
        y: artboard.y,
        z_index: artboard.zIndex,
        creative_job_id: opts?.creativeJobId || null,
      }).then(() => {});
    }

    return id;
  }, [elements, nextZIndex, user]);

  // Find artboard by creative job ID
  const findArtboardByJobId = useCallback((jobId: string): Artboard | null => {
    return (elements.find(
      (e) => e.type === "artboard" && (e as Artboard).creativeJobId === jobId
    ) as Artboard) || null;
  }, [elements]);

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
    const el = elements.find((e) => e.id === id);
    if (el?.type === "artboard") {
      // Delete from DB
      supabase.from("workspace_artboards").delete().eq("id", id).then(() => {});
    }
    setElements((prev) => prev.filter((e) => e.id !== id && !(e.type === "arrow" && ((e as Arrow).fromId === id || (e as Arrow).toId === id))));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  }, [elements, selectedId, editingId]);

  const updateElement = useCallback((id: string, updates: Partial<any>) => {
    setElements((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, ...updates } : e));
      // If it's an artboard, schedule DB save
      const el = updated.find((e) => e.id === id);
      if (el?.type === "artboard") {
        savePendingRef.current.add(id);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => flushArtboardSaves(), 2000);
      }
      return updated;
    });
  }, [flushArtboardSaves]);

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
    if (clone.type === "artboard") {
      (clone as Artboard).creativeJobId = null; // duplicated artboard shouldn't keep the link
    }
    setElements((prev) => [...prev, clone as WorkspaceElement]);
    setSelectedId(newId);

    // If artboard, persist to DB
    if (clone.type === "artboard" && user) {
      const ab = clone as Artboard;
      supabase.from("workspace_artboards").insert({
        id: newId,
        user_id: user.id,
        name: ab.name,
        format: ab.format,
        x: ab.x,
        y: ab.y,
        z_index: ab.zIndex,
        layers_state: ab.layersState as any,
        thumbnail: ab.thumbnail,
        creative_job_id: null,
      }).then(() => {});
    }
  }, [elements, nextZIndex, user]);

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
    dbLoaded,
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    selectedElement,
    selectedArtboard,
    editingArtboard,
    addArtboard,
    findArtboardByJobId,
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
