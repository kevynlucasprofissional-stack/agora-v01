import { useState, useRef, useCallback } from "react";
import { Download, Loader2, RefreshCw, Palette, Type, Eye, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import html2canvas from "html2canvas";

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

const TEXT_COLORS = [
  { label: "Branco", value: "#FFFFFF" },
  { label: "Preto", value: "#000000" },
  { label: "Amarelo", value: "#FFD700" },
  { label: "Vermelho", value: "#FF4444" },
  { label: "Azul", value: "#4488FF" },
];

export function CreativeEditor({
  strategistOutput,
  imageUrl,
  editableHtml,
  creativeJobId,
  onRegenerate,
  isRegenerating,
}: CreativeEditorProps) {
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const applyTextColor = useCallback((color: string) => {
    setTextColor(color);
    if (!canvasRef.current) return;
    const editables = canvasRef.current.querySelectorAll("[contenteditable='true']");
    editables.forEach((el) => {
      const layer = el.getAttribute("data-layer");
      if (layer === "cta") {
        // CTA keeps its bg, change text color
        (el as HTMLElement).style.color = color === "#FFFFFF" || color === "#FFD700" ? "#000000" : "#FFFFFF";
        (el as HTMLElement).style.backgroundColor = color === "#FFFFFF" ? "hsl(220,80%,55%)" : color;
      } else {
        (el as HTMLElement).style.color = color;
      }
    });
    setShowColorPicker(false);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!canvasRef.current) return;
    setIsDownloading(true);
    try {
      // Remove hover outlines before capture
      const editables = canvasRef.current.querySelectorAll("[contenteditable='true']");
      editables.forEach((el) => ((el as HTMLElement).style.outline = "none"));

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
    }
  }, []);

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

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="gap-1.5"
          >
            <div className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: textColor }} />
            <Palette className="h-3.5 w-3.5" />
            Cor do texto
          </Button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 z-10 flex gap-1 p-2 rounded-lg border border-border bg-card shadow-lg">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => applyTextColor(c.value)}
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.value,
                    borderColor: textColor === c.value ? "hsl(var(--primary))" : "hsl(var(--border))",
                  }}
                  title={c.label}
                />
              ))}
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={isRegenerating} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
          Regerar criativo
        </Button>

        <Button variant="hero" size="sm" onClick={handleDownload} disabled={isDownloading} className="gap-1.5 ml-auto">
          {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Baixar criativo
        </Button>
      </div>

      {/* Creative Canvas - rendered from editable HTML */}
      <div className="flex justify-center">
        <div
          ref={canvasRef}
          className="w-full max-w-[540px]"
          dangerouslySetInnerHTML={{ __html: editableHtml }}
        />
      </div>

      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
        <Type className="h-3 w-3" />
        Clique em qualquer texto no criativo para editar diretamente
      </p>
    </motion.div>
  );
}
