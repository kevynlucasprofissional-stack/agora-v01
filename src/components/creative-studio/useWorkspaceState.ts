import { useCallback, useState, useRef } from "react";
import type { CanvasFormat } from "./useCanvasState";

export interface Artboard {
  id: string;
  name: string;
  x: number;
  y: number;
  format: CanvasFormat;
  layersState: any | null;
  thumbnail: string | null;
}

const FORMAT_DIMS: Record<CanvasFormat, { w: number; h: number }> = {
  "1080x1080": { w: 1080, h: 1080 },
  "1080x1920": { w: 1080, h: 1920 },
  "1200x628": { w: 1200, h: 628 },
  "1080x1350": { w: 1080, h: 1350 },
};

const THUMB_SCALE = 0.18;

export function useWorkspaceState() {
  const [artboards, setArtboards] = useState<Artboard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [wsZoom, setWsZoom] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const addArtboard = useCallback((format: CanvasFormat, name?: string) => {
    const id = crypto.randomUUID();
    const count = artboards.length;
    // Place new artboards in a grid-like layout
    const col = count % 3;
    const row = Math.floor(count / 3);
    const dims = FORMAT_DIMS[format];
    const spacing = 80;
    const x = col * (dims.w * THUMB_SCALE + spacing) + 60;
    const y = row * (dims.h * THUMB_SCALE + spacing + 40) + 60;

    const artboard: Artboard = {
      id,
      name: name || `Artboard ${count + 1}`,
      x,
      y,
      format,
      layersState: null,
      thumbnail: null,
    };
    setArtboards((prev) => [...prev, artboard]);
    setSelectedId(id);
    return id;
  }, [artboards.length]);

  const removeArtboard = useCallback((id: string) => {
    setArtboards((prev) => prev.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  }, [selectedId, editingId]);

  const updateArtboard = useCallback((id: string, updates: Partial<Artboard>) => {
    setArtboards((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const selectedArtboard = artboards.find((a) => a.id === selectedId) || null;
  const editingArtboard = artboards.find((a) => a.id === editingId) || null;

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
    artboards,
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    selectedArtboard,
    editingArtboard,
    addArtboard,
    removeArtboard,
    updateArtboard,
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
  };
}
