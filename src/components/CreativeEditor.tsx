import { useState, useRef, useCallback } from "react";
import { Download, Loader2, RefreshCw, Type, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import html2canvas from "html2canvas";

interface CreativeTexts {
  headline: string;
  subheadline: string;
  cta: string;
}

interface CreativeEditorProps {
  imageUrl: string;
  suggestedText: CreativeTexts;
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

export function CreativeEditor({ imageUrl, suggestedText, onRegenerate, isRegenerating }: CreativeEditorProps) {
  const safeText = {
    headline: suggestedText?.headline || "Seu Título Aqui",
    subheadline: suggestedText?.subheadline || "Subtítulo do seu criativo",
    cta: suggestedText?.cta || "Saiba Mais",
  };
  const [texts, setTexts] = useState<CreativeTexts>(safeText);
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [isDownloading, setIsDownloading] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    if (!canvasRef.current) return;
    setIsDownloading(true);
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
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
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
                  onClick={() => { setTextColor(c.value); setShowColorPicker(false); }}
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c.value, borderColor: textColor === c.value ? "hsl(var(--primary))" : "hsl(var(--border))" }}
                  title={c.label}
                />
              ))}
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={isRegenerating} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
          Regerar imagem
        </Button>

        <Button variant="hero" size="sm" onClick={handleDownload} disabled={isDownloading} className="gap-1.5 ml-auto">
          {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Baixar criativo
        </Button>
      </div>

      {/* Creative Canvas */}
      <div className="flex justify-center">
        <div
          ref={canvasRef}
          className="relative w-full max-w-[540px] aspect-square rounded-xl overflow-hidden shadow-lg"
          style={{ backgroundColor: "#1a1a2e" }}
        >
          {/* Background Image */}
          <img
            src={imageUrl}
            alt="Creative background"
            className="absolute inset-0 w-full h-full object-cover"
            crossOrigin="anonymous"
          />

          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />

          {/* Editable Text Layers */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 gap-3">
            {/* Headline */}
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setTexts(prev => ({ ...prev, headline: e.currentTarget?.textContent || prev.headline }))}
              className="text-center text-2xl sm:text-3xl font-display font-bold leading-tight outline-none cursor-text px-4 py-1 rounded hover:ring-2 hover:ring-white/30 focus:ring-2 focus:ring-white/50 transition-all"
              style={{
                color: textColor,
                textShadow: "0 2px 8px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)",
              }}
            >
              {safeText.headline}
            </div>

            {/* Subheadline */}
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setTexts(prev => ({ ...prev, subheadline: e.currentTarget?.textContent || prev.subheadline }))}
              className="text-center text-sm sm:text-base font-medium leading-relaxed outline-none cursor-text px-4 py-1 rounded hover:ring-2 hover:ring-white/30 focus:ring-2 focus:ring-white/50 transition-all max-w-[80%]"
              style={{
                color: textColor,
                textShadow: "0 1px 6px rgba(0,0,0,0.5)",
              }}
            >
              {safeText.subheadline}
            </div>

            {/* CTA Button */}
            <div className="mt-4">
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setTexts(prev => ({ ...prev, cta: e.currentTarget?.textContent || prev.cta }))}
                className="inline-block px-6 py-2.5 rounded-full text-sm font-bold outline-none cursor-text hover:ring-2 hover:ring-white/30 focus:ring-2 focus:ring-white/50 transition-all"
                style={{
                  backgroundColor: textColor === "#FFFFFF" ? "hsl(var(--primary))" : textColor,
                  color: textColor === "#FFFFFF" || textColor === "#FFD700" ? "#000000" : "#FFFFFF",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                }}
              >
                {safeText.cta}
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
        <Type className="h-3 w-3" />
        Clique em qualquer texto no criativo para editar diretamente
      </p>
    </motion.div>
  );
}
