import { useState, useRef, useCallback, useEffect } from "react";
import { Download, Loader2, RefreshCw, Palette, Type, Eye, Move, Layers, SunDim, ALargeSmall, RotateCcw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { Slider } from "@/components/ui/slider";

interface StrategistOutput {
  creative_objective?: string;
  target_audience?: string;
  headline?: string;
  body_copy?: string;
  cta?: string;
  visual_direction?: string;
  tone_of_voice?: string;
  compliance_warnings?: string[];
  editable_layers?: { type: string; content: string; style?: string }[];
}

interface CreativeEditorProps {
  strategistOutput: StrategistOutput;
  imageUrl: string;
  editableHtml: string;
  creativeJobId: string | null;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

interface LayerState {
  type: string;
  content: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  shadowEnabled: boolean;
  shadowBlur: number;
  shadowColor: string;
}

const TEXT_COLORS = [
  { label: "Branco", value: "#FFFFFF" },
  { label: "Preto", value: "#000000" },
  { label: "Amarelo", value: "#FFD700" },
  { label: "Vermelho", value: "#FF4444" },
  { label: "Azul", value: "#4488FF" },
  { label: "Verde", value: "#44DD88" },
];

const SHADOW_PRESETS = [
  { label: "Nenhuma", blur: 0, color: "transparent" },
  { label: "Suave", blur: 4, color: "rgba(0,0,0,0.5)" },
  { label: "Média", blur: 8, color: "rgba(0,0,0,0.7)" },
  { label: "Forte", blur: 16, color: "rgba(0,0,0,0.9)" },
  { label: "Neon", blur: 12, color: "rgba(68,136,255,0.8)" },
];

function parseLayers(strategistOutput: StrategistOutput): LayerState[] {
  const raw = strategistOutput.editable_layers || [
    { type: "headline", content: strategistOutput.headline || "Título" },
    { type: "subheadline", content: strategistOutput.body_copy || "Subtítulo" },
    { type: "cta", content: strategistOutput.cta || "Saiba Mais" },
  ];

  return raw.map((layer, i) => ({
    type: layer.type,
    content: layer.content,
    x: 50, // percent
    y: layer.type === "headline" ? 40 : layer.type === "subheadline" ? 55 : 70,
    color: layer.type === "cta" ? "#FFFFFF" : "#FFFFFF",
    fontSize: layer.type === "headline" ? 22 : layer.type === "cta" ? 14 : 15,
    shadowEnabled: true,
    shadowBlur: 8,
    shadowColor: "rgba(0,0,0,0.6)",
  }));
}

export function CreativeEditor({
  strategistOutput,
  imageUrl,
  editableHtml,
  creativeJobId,
  onRegenerate,
  isRegenerating,
}: CreativeEditorProps) {
  const [layers, setLayers] = useState<LayerState[]>(() => parseLayers(strategistOutput));
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null);
  const [showBrief, setShowBrief] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activePanel, setActivePanel] = useState<"color" | "shadow" | "size" | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ layerIdx: number; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Reset layers when strategist output changes
  useEffect(() => {
    setLayers(parseLayers(strategistOutput));
    setSelectedLayer(null);
  }, [strategistOutput]);

  const updateLayer = useCallback((idx: number, updates: Partial<LayerState>) => {
    setLayers(prev => prev.map((l, i) => i === idx ? { ...l, ...updates } : l));
  }, []);

  // Drag handling
  const handlePointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    setSelectedLayer(idx);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      layerIdx: idx,
      startX: e.clientX,
      startY: e.clientY,
      origX: layers[idx].x,
      origY: layers[idx].y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [layers]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
    const dy = ((e.clientY - dragRef.current.startY) / rect.height) * 100;
    const newX = Math.max(5, Math.min(95, dragRef.current.origX + dx));
    const newY = Math.max(5, Math.min(95, dragRef.current.origY + dy));
    updateLayer(dragRef.current.layerIdx, { x: newX, y: newY });
  }, [updateLayer]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleDownload = useCallback(async () => {
    if (!canvasRef.current) return;
    setIsDownloading(true);
    // Temporarily deselect
    const prevSelected = selectedLayer;
    setSelectedLayer(null);
    // Wait for render
    await new Promise(r => setTimeout(r, 100));
    try {
      const canvas = await html2canvas(canvasRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      });
      const link = document.createElement("a");
      link.download = `criativo-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Criativo baixado com sucesso!");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Erro ao baixar o criativo.");
    } finally {
      setIsDownloading(false);
      setSelectedLayer(prevSelected);
    }
  }, [selectedLayer]);

  const resetPositions = useCallback(() => {
    setLayers(parseLayers(strategistOutput));
    setSelectedLayer(null);
    toast.success("Posições resetadas!");
  }, [strategistOutput]);

  const addNewLayer = useCallback(() => {
    const newLayer: LayerState = {
      type: `texto-${layers.length + 1}`,
      content: "Novo texto",
      x: 50,
      y: 30 + (layers.length * 12) % 60,
      color: "#FFFFFF",
      fontSize: 16,
      shadowEnabled: true,
      shadowBlur: 8,
      shadowColor: "rgba(0,0,0,0.6)",
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedLayer(layers.length);
    setActivePanel(null);
    toast.success("Nova camada adicionada!");
  }, [layers.length]);

  const sel = selectedLayer !== null ? layers[selectedLayer] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Strategist Brief Toggle */}
      {strategistOutput && (
        <div className="space-y-2">
          <button
            onClick={() => setShowBrief(!showBrief)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Eye className="h-3 w-3" />
            {showBrief ? "Ocultar briefing" : "Ver briefing do estrategista"}
          </button>
          {showBrief && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-xl border border-border/50 bg-accent/30 p-4 text-xs space-y-2"
            >
              {strategistOutput.creative_objective && (
                <p><strong className="text-foreground">Objetivo:</strong> <span className="text-muted-foreground">{strategistOutput.creative_objective}</span></p>
              )}
              {strategistOutput.target_audience && (
                <p><strong className="text-foreground">Público:</strong> <span className="text-muted-foreground">{strategistOutput.target_audience}</span></p>
              )}
              {strategistOutput.tone_of_voice && (
                <p><strong className="text-foreground">Tom:</strong> <span className="text-muted-foreground">{strategistOutput.tone_of_voice}</span></p>
              )}
              {strategistOutput.visual_direction && (
                <p><strong className="text-foreground">Visual:</strong> <span className="text-muted-foreground">{strategistOutput.visual_direction}</span></p>
              )}
              {strategistOutput.compliance_warnings && strategistOutput.compliance_warnings.length > 0 && (
                <p><strong className="text-warning">⚠️ Compliance:</strong> <span className="text-muted-foreground">{strategistOutput.compliance_warnings.join("; ")}</span></p>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* Main Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={activePanel === "color" ? "default" : "outline"}
          size="sm"
          onClick={() => setActivePanel(activePanel === "color" ? null : "color")}
          className="gap-1.5"
          disabled={selectedLayer === null}
        >
          <Palette className="h-3.5 w-3.5" />
          Cor
        </Button>

        <Button
          variant={activePanel === "shadow" ? "default" : "outline"}
          size="sm"
          onClick={() => setActivePanel(activePanel === "shadow" ? null : "shadow")}
          className="gap-1.5"
          disabled={selectedLayer === null}
        >
          <SunDim className="h-3.5 w-3.5" />
          Sombra
        </Button>

        <Button
          variant={activePanel === "size" ? "default" : "outline"}
          size="sm"
          onClick={() => setActivePanel(activePanel === "size" ? null : "size")}
          className="gap-1.5"
          disabled={selectedLayer === null}
        >
          <ALargeSmall className="h-3.5 w-3.5" />
          Tamanho
        </Button>

        <Button variant="outline" size="sm" onClick={resetPositions} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Resetar
        </Button>

        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={isRegenerating} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
          Regerar
        </Button>

        <Button variant="hero" size="sm" onClick={handleDownload} disabled={isDownloading} className="gap-1.5 ml-auto">
          {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Baixar
        </Button>
      </div>

      {/* Sub-panels */}
      {selectedLayer !== null && sel && activePanel && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-xl border border-border/50 bg-card p-3 space-y-3"
        >
          {activePanel === "color" && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Cor do texto — {sel.type}</p>
              <div className="flex gap-1.5 flex-wrap">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => updateLayer(selectedLayer, { color: c.value })}
                    className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c.value,
                      borderColor: sel.color === c.value ? "hsl(var(--primary))" : "hsl(var(--border))",
                    }}
                    title={c.label}
                  />
                ))}
                <input
                  type="color"
                  value={sel.color}
                  onChange={(e) => updateLayer(selectedLayer, { color: e.target.value })}
                  className="h-8 w-8 rounded-full cursor-pointer border-2 border-border"
                  title="Cor personalizada"
                />
              </div>
            </div>
          )}

          {activePanel === "shadow" && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Sombra — {sel.type}</p>
              <div className="flex gap-2 flex-wrap">
                {SHADOW_PRESETS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => updateLayer(selectedLayer, {
                      shadowEnabled: s.blur > 0,
                      shadowBlur: s.blur,
                      shadowColor: s.color,
                    })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      sel.shadowBlur === s.blur && sel.shadowColor === s.color
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {sel.shadowEnabled && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16">Intensidade</span>
                  <Slider
                    value={[sel.shadowBlur]}
                    onValueChange={([v]) => updateLayer(selectedLayer, { shadowBlur: v })}
                    min={1}
                    max={30}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8">{sel.shadowBlur}px</span>
                </div>
              )}
            </div>
          )}

          {activePanel === "size" && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Tamanho da fonte — {sel.type}</p>
              <div className="flex items-center gap-3">
                <Slider
                  value={[sel.fontSize]}
                  onValueChange={([v]) => updateLayer(selectedLayer, { fontSize: v })}
                  min={10}
                  max={64}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-10">{sel.fontSize}px</span>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Layer chips */}
      <div className="flex gap-2 flex-wrap items-center">
        {layers.map((layer, i) => (
          <button
            key={i}
            onClick={() => { setSelectedLayer(i); setActivePanel(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              selectedLayer === i
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            <Layers className="h-3 w-3" />
            {layer.type === "headline" ? "Título" : layer.type === "subheadline" ? "Subtítulo" : layer.type === "cta" ? "CTA" : layer.type}
          </button>
        ))}
        <button
          onClick={addNewLayer}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          title="Adicionar nova camada de texto"
        >
          <Plus className="h-3 w-3" />
          Texto
        </button>
      </div>

      {/* Creative Canvas */}
      <div className="flex justify-center">
        <div
          ref={canvasRef}
          className="w-full max-w-[540px] relative select-none"
          style={{ aspectRatio: "1/1", background: "#1a1a2e", borderRadius: 12, overflow: "hidden" }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={() => { setSelectedLayer(null); setActivePanel(null); }}
        >
          {/* Background image */}
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              crossOrigin="anonymous"
              draggable={false}
            />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(0,0,0,0.5) 100%)" }} />

          {/* Editable layers */}
          {layers.map((layer, i) => {
            const isSelected = selectedLayer === i;
            const shadow = layer.shadowEnabled
              ? `0 ${layer.shadowBlur / 2}px ${layer.shadowBlur}px ${layer.shadowColor}`
              : "none";

            const isCta = layer.type === "cta";

            return (
              <div
                key={i}
                onPointerDown={(e) => handlePointerDown(e, i)}
                onClick={(e) => e.stopPropagation()}
                className="absolute cursor-move"
                style={{
                  left: `${layer.x}%`,
                  top: `${layer.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: isSelected ? 20 : 10,
                }}
              >
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => updateLayer(i, { content: e.currentTarget.textContent || "" })}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLayer(i);
                  }}
                  className={`outline-none whitespace-nowrap transition-shadow ${isSelected ? "ring-2 ring-primary/60 ring-offset-1 ring-offset-transparent rounded" : ""}`}
                  style={{
                    color: layer.color,
                    fontSize: `${layer.fontSize}px`,
                    fontWeight: layer.type === "headline" ? 800 : layer.type === "cta" ? 700 : 500,
                    textShadow: !isCta && layer.shadowEnabled ? `0 ${layer.shadowBlur / 2}px ${layer.shadowBlur}px ${layer.shadowColor}` : undefined,
                    textAlign: "center" as const,
                    padding: isCta ? "0.6rem 1.8rem" : "0.25rem 0.75rem",
                    borderRadius: isCta ? 9999 : 4,
                    background: isCta ? "hsl(220, 80%, 55%)" : "transparent",
                    boxShadow: isCta && layer.shadowEnabled ? shadow : undefined,
                    cursor: "move",
                    userSelect: "text",
                  }}
                >
                  {layer.content}
                </div>
                {isSelected && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-card/90 backdrop-blur px-2 py-0.5 rounded-full border border-border/50">
                    <Move className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Arraste</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
        <Type className="h-3 w-3" />
        Clique para selecionar, arraste para mover, edite o texto diretamente
      </p>
    </motion.div>
  );
}
