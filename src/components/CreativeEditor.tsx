import { useState, useRef, useCallback, useEffect } from "react";
import { Download, Loader2, Move } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import html2canvas from "html2canvas";

interface StrategistOutput {
  creative_objective?: string;
  headline?: string;
  body_copy?: string;
  cta?: string;
  editable_layers?: { type: string; content: string }[];
}

interface CreativeEditorProps {
  strategistOutput: StrategistOutput;
  imageUrl: string;
  editableHtml: string;
  creativeJobId: string | null;
  onRegenerate: () => void;
  isRegenerating: boolean;
  onCapture?: (dataUrl: string) => void;
}

interface LayerState {
  id: string;
  content: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  shadow: boolean;
  width: number;
  isCta: boolean;
}

const COLORS = ["#FFFFFF", "#000000", "#FFD700", "#FF4444", "#4488FF", "#44DD88", "#FF69B4", "#8B5CF6"];

let layerIdCounter = 0;
const uid = () => `layer-${++layerIdCounter}-${Date.now()}`;

function buildInitialLayers(s: StrategistOutput): LayerState[] {
  const raw = s.editable_layers || [
    { type: "headline", content: s.headline || "Título" },
    { type: "subheadline", content: s.body_copy || "Subtítulo" },
    { type: "cta", content: s.cta || "Saiba Mais" },
  ];
  return raw.map((l, i) => ({
    id: uid(),
    content: l.content,
    x: 50,
    y: l.type === "headline" ? 35 : l.type === "cta" ? 70 : 50,
    color: "#FFFFFF",
    fontSize: l.type === "headline" ? 20 : l.type === "cta" ? 13 : 14,
    shadow: true,
    width: l.type === "headline" ? 80 : l.type === "cta" ? 40 : 70,
    isCta: l.type === "cta",
  }));
}

export function CreativeEditor({
  strategistOutput, imageUrl, editableHtml, creativeJobId,
  onRegenerate, isRegenerating, onCapture,
}: CreativeEditorProps) {
  const [layers, setLayers] = useState<LayerState[]>(() => buildInitialLayers(strategistOutput));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showColors, setShowColors] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; dragging: boolean } | null>(null);
  const resizeRef = useRef<{ id: string; startX: number; origWidth: number; origFontSize: number; side: string } | null>(null);

  useEffect(() => {
    setLayers(buildInitialLayers(strategistOutput));
    setSelectedId(null);
  }, [strategistOutput]);

  const update = useCallback((id: string, u: Partial<LayerState>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...u } : l));
  }, []);

  const selected = layers.find(l => l.id === selectedId) || null;

  // --- Keyboard controls ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId) return;
      // Don't intercept if user is editing text inside contentEditable
      const active = document.activeElement;
      if (active && active.getAttribute("contenteditable") === "true") {
        // Only intercept Delete/Backspace if there's no text selection (i.e. not editing)
        return;
      }

      const STEP = 2; // percentage step per keypress
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          update(selectedId, { y: Math.max(5, (layers.find(l => l.id === selectedId)?.y ?? 50) - STEP) });
          break;
        case "ArrowDown":
          e.preventDefault();
          update(selectedId, { y: Math.min(95, (layers.find(l => l.id === selectedId)?.y ?? 50) + STEP) });
          break;
        case "ArrowLeft":
          e.preventDefault();
          update(selectedId, { x: Math.max(5, (layers.find(l => l.id === selectedId)?.x ?? 50) - STEP) });
          break;
        case "ArrowRight":
          e.preventDefault();
          update(selectedId, { x: Math.min(95, (layers.find(l => l.id === selectedId)?.x ?? 50) + STEP) });
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          setLayers(prev => prev.filter(l => l.id !== selectedId));
          setSelectedId(null);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, layers, update]);

  // --- Drag ---
  const onPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    // Don't preventDefault so contentEditable can receive focus/cursor
    setSelectedId(id);
    setShowColors(false);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, origX: layer.x, origY: layer.y, dragging: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [layers]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (dragRef.current) {
      const rawDx = e.clientX - dragRef.current.startX;
      const rawDy = e.clientY - dragRef.current.startY;
      // Only start dragging after a 5px threshold to allow text editing clicks
      if (!dragRef.current.dragging) {
        if (Math.abs(rawDx) < 5 && Math.abs(rawDy) < 5) return;
        dragRef.current.dragging = true;
      }
      const dx = (rawDx / rect.width) * 100;
      const dy = (rawDy / rect.height) * 100;
      update(dragRef.current.id, {
        x: Math.max(5, Math.min(95, dragRef.current.origX + dx)),
        y: Math.max(5, Math.min(95, dragRef.current.origY + dy)),
      });
    }

    if (resizeRef.current) {
      const dx = e.clientX - resizeRef.current.startX;
      const pctChange = (dx / rect.width) * 100;
      const dir = resizeRef.current.side === "right" ? 1 : -1;
      const newWidth = Math.max(15, Math.min(95, resizeRef.current.origWidth + pctChange * dir));
      const scale = newWidth / resizeRef.current.origWidth;
      const newFontSize = Math.max(8, Math.min(64, Math.round(resizeRef.current.origFontSize * scale)));
      update(resizeRef.current.id, { width: newWidth, fontSize: newFontSize });
    }
  }, [update]);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    resizeRef.current = null;
  }, []);

  // --- Resize handle ---
  const onResizeDown = useCallback((e: React.PointerEvent, id: string, side: string) => {
    e.stopPropagation();
    e.preventDefault();
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    resizeRef.current = { id, startX: e.clientX, origWidth: layer.width, origFontSize: layer.fontSize, side };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [layers]);

  // --- Double-click to add text (only on empty canvas area) ---
  const onCanvasDoubleClick = useCallback((e: React.MouseEvent) => {
    // If the click target is inside an existing layer element, don't create a new one
    const target = e.target as HTMLElement;
    if (target.closest("[data-layer-id]")) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const newLayer: LayerState = {
      id: uid(), content: "Novo texto", x, y,
      color: "#FFFFFF", fontSize: 16, shadow: true, width: 40, isCta: false,
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedId(newLayer.id);
    setShowColors(false);
  }, []);

  // --- Delete layer ---
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setLayers(prev => prev.filter(l => l.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // --- Download ---
  const handleDownload = useCallback(async () => {
    if (!canvasRef.current) return;
    setIsDownloading(true);
    const prev = selectedId;
    setSelectedId(null);
    await new Promise(r => setTimeout(r, 80));
    try {
      const canvas = await html2canvas(canvasRef.current, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: null });
      const dataUrl = canvas.toDataURL("image/png");
      // Trigger download
      const link = document.createElement("a");
      link.download = `criativo-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      // Notify parent for persistence
      onCapture?.(dataUrl);
      toast.success("Criativo baixado!");
    } catch {
      toast.error("Erro ao baixar.");
    } finally {
      setIsDownloading(false);
      setSelectedId(prev);
    }
  }, [selectedId, onCapture]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
      {/* Canvas */}
      <div className="relative flex justify-center">
        <div
          ref={canvasRef}
          className="w-full max-w-[480px] relative select-none rounded-xl overflow-hidden"
          style={{ aspectRatio: "1/1", background: "#1a1a2e" }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={() => { setSelectedId(null); setShowColors(false); }}
          onDoubleClick={onCanvasDoubleClick}
        >
          {imageUrl && (
            <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" crossOrigin="anonymous" draggable={false} />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 40%, rgba(0,0,0,0.45) 100%)" }} />

          {layers.map((layer) => {
            const isSelected = selectedId === layer.id;
            return (
              <div
                key={layer.id}
                data-layer-id={layer.id}
                className="absolute"
                style={{
                  left: `${layer.x}%`, top: `${layer.y}%`,
                  transform: "translate(-50%, -50%)",
                  width: `${layer.width}%`,
                  zIndex: isSelected ? 20 : 10,
                }}
              >
                {/* Resize handles */}
                {isSelected && (
                  <>
                    <div
                      onPointerDown={(e) => onResizeDown(e, layer.id, "left")}
                      className="absolute -left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background cursor-ew-resize z-30 hover:scale-125 transition-transform"
                    />
                    <div
                      onPointerDown={(e) => onResizeDown(e, layer.id, "right")}
                      className="absolute -right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background cursor-ew-resize z-30 hover:scale-125 transition-transform"
                    />
                  </>
                )}

                {/* Content */}
                <div
                  onPointerDown={(e) => onPointerDown(e, layer.id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(layer.id); }}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => update(layer.id, { content: e.currentTarget.textContent || "" })}
                  className={`outline-none transition-all cursor-move ${isSelected ? "ring-2 ring-primary/70 ring-offset-1 ring-offset-transparent rounded" : ""}`}
                  style={{
                    color: layer.color,
                    fontSize: `${layer.fontSize}px`,
                    fontWeight: layer.isCta ? 700 : layer.fontSize >= 18 ? 800 : 500,
                    textShadow: layer.shadow ? `0 2px 8px rgba(0,0,0,0.7)` : undefined,
                    textAlign: "center",
                    padding: layer.isCta ? "0.5rem 1.2rem" : "0.2rem 0.5rem",
                    borderRadius: layer.isCta ? 9999 : 4,
                    background: layer.isCta ? "hsl(var(--primary))" : "transparent",
                    boxShadow: layer.isCta && layer.shadow ? "0 4px 12px rgba(0,0,0,0.4)" : undefined,
                    userSelect: "text",
                    wordBreak: "break-word",
                  }}
                >
                  {layer.content}
                </div>

                {/* Floating toolbar */}
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-card/95 backdrop-blur-sm px-1.5 py-1 rounded-full border border-border/60 shadow-lg z-30"
                  >
                    {/* Color dot */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowColors(prev => !prev); }}
                      className="w-5 h-5 rounded-full border-2 border-background shadow-sm hover:scale-110 transition-transform"
                      style={{ backgroundColor: layer.color }}
                      title="Cor"
                    />
                    {/* Shadow toggle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); update(layer.id, { shadow: !layer.shadow }); }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${layer.shadow ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      title="Sombra"
                    >
                      S
                    </button>
                    {/* Delete */}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSelected(); }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
                      title="Remover"
                    >
                      ✕
                    </button>
                  </motion.div>
                )}

                {/* Color picker dropdown */}
                {isSelected && showColors && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute -top-[72px] left-1/2 -translate-x-1/2 flex items-center gap-1 bg-card/95 backdrop-blur-sm px-2 py-1.5 rounded-full border border-border/60 shadow-lg z-40"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => { update(layer.id, { color: c }); setShowColors(false); }}
                        className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-125"
                        style={{ backgroundColor: c, borderColor: layer.color === c ? "hsl(var(--primary))" : "transparent" }}
                      />
                    ))}
                    <input
                      type="color"
                      value={layer.color}
                      onChange={(e) => update(layer.id, { color: e.target.value })}
                      className="w-5 h-5 rounded-full cursor-pointer border-0 p-0"
                    />
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        {/* Download button - floating */}
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-foreground hover:bg-card transition-colors disabled:opacity-50"
          title="Baixar criativo"
        >
          {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground text-center opacity-70">
        Clique duplo para adicionar texto · Arraste para mover · Laterais para redimensionar
      </p>
    </motion.div>
  );
}
