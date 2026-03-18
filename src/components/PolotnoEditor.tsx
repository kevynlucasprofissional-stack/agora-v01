import { useEffect, useState, useCallback, useMemo } from "react";
import { Download, Loader2, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

// Polotno imports
import { PolotnoContainer, SidePanelWrap, WorkspaceWrap } from "polotno";
import { Toolbar } from "polotno/toolbar/toolbar";
import { ZoomButtons } from "polotno/toolbar/zoom-buttons";
import { SidePanel, DEFAULT_SECTIONS } from "polotno/side-panel";
import { Workspace } from "polotno/canvas/workspace";
import { createStore } from "polotno/model/store";

interface StrategistOutput {
  creative_objective?: string;
  headline?: string;
  body_copy?: string;
  cta?: string;
  editable_layers?: { type: string; content: string; style?: string }[];
  visual_direction?: string;
}

interface PolotnoEditorProps {
  strategistOutput: StrategistOutput;
  imageUrl: string;
  editableHtml: string;
  creativeJobId: string | null;
  onRegenerate: () => void;
  isRegenerating: boolean;
  onCapture?: (dataUrl: string) => void;
}

const POLOTNO_KEY = "nFA5H9elEytDyPyvKL7T";

export function PolotnoEditor({
  strategistOutput,
  imageUrl,
  editableHtml,
  creativeJobId,
  onRegenerate,
  isRegenerating,
  onCapture,
}: PolotnoEditorProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const store = useMemo(() => {
    const s = createStore({ key: POLOTNO_KEY, showCredit: true });
    return s;
  }, []);

  // Load AI content into store
  useEffect(() => {
    if (!store) return;
    store.clear();
    store.setSize(1080, 1080);

    const page = store.addPage();

    if (imageUrl) {
      page.set({ background: imageUrl });
    }

    const layers = strategistOutput.editable_layers || [
      { type: "headline", content: strategistOutput.headline || "Título" },
      { type: "subheadline", content: strategistOutput.body_copy || "Subtítulo" },
      { type: "cta", content: strategistOutput.cta || "Saiba Mais" },
    ];

    layers.forEach((layer) => {
      if (layer.type === "headline") {
        page.addElement({
          type: "text",
          text: layer.content,
          x: 140,
          y: 280,
          width: 800,
          height: 120,
          fontSize: 72,
          fontWeight: "bold",
          fontFamily: "Arial",
          fill: "#FFFFFF",
          align: "center",
          shadowEnabled: true,
          shadowColor: "rgba(0,0,0,0.6)",
          shadowBlur: 15,
        });
      } else if (layer.type === "subheadline") {
        page.addElement({
          type: "text",
          text: layer.content,
          x: 190,
          y: 430,
          width: 700,
          height: 80,
          fontSize: 36,
          fontFamily: "Arial",
          fill: "#FFFFFF",
          align: "center",
          shadowEnabled: true,
          shadowColor: "rgba(0,0,0,0.5)",
          shadowBlur: 10,
        });
      } else if (layer.type === "cta") {
        page.addElement({
          type: "text",
          text: layer.content,
          x: 390,
          y: 560,
          width: 300,
          height: 70,
          fontSize: 32,
          fontWeight: "bold",
          fontFamily: "Arial",
          fill: "#FFFFFF",
          align: "center",
          backgroundEnabled: true,
          backgroundColor: "#3366cc",
        } as any);
      }
    });
  }, [store, strategistOutput, imageUrl]);

  const handleDownload = useCallback(async () => {
    if (!store) return;
    setIsDownloading(true);
    try {
      await store.waitLoading();
      const dataUrl = await store.toDataURL({ pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `criativo-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      onCapture?.(dataUrl);
      toast.success("Criativo baixado!");
    } catch {
      toast.error("Erro ao baixar.");
    } finally {
      setIsDownloading(false);
    }
  }, [store, onCapture]);

  const sections = DEFAULT_SECTIONS.filter(
    (s) => !["size"].includes(s.name)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">
          ✏️ Editor de Criativo
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50 transition-colors disabled:opacity-50"
          >
            {isRegenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            Regerar
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Baixar PNG
          </button>
        </div>
      </div>

      {/* Polotno Editor — scoped styles via wrapper */}
      <div className="polotno-editor-wrapper rounded-xl overflow-hidden border border-border/60 bg-white">
        <PolotnoContainer style={{ width: "100%", height: "100%" }}>
          <SidePanelWrap>
            <SidePanel store={store} sections={sections} />
          </SidePanelWrap>
          <WorkspaceWrap>
            <Toolbar store={store} />
            <Workspace
              store={store}
              backgroundColor="#f0f0f0"
            />
            <ZoomButtons store={store} />
          </WorkspaceWrap>
        </PolotnoContainer>
      </div>
    </motion.div>
  );
}
