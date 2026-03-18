import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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

import "polotno/polotno.css";

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

// Polotno API key (publishable, client-side)
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
  const [storeReady, setStoreReady] = useState(false);
  const storeRef = useRef<any>(null);

  // Create store once
  const store = useMemo(() => {
    const s = createStore({ key: POLOTNO_KEY, showCredit: true });
    storeRef.current = s;
    return s;
  }, []);

  // Load AI content into store
  useEffect(() => {
    if (!store) return;

    // Clear existing pages
    store.clear();

    // Create page with correct dimensions (1080x1080 default)
    const page = store.addPage({
      width: 1080,
      height: 1080,
    });

    // Set background image if available
    if (imageUrl) {
      page.set({
        background: imageUrl,
      });
    }

    // Add text layers from strategist output
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
          x: 540 - 400,
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
          shadowOffsetX: 0,
          shadowOffsetY: 4,
        });
      } else if (layer.type === "subheadline") {
        page.addElement({
          type: "text",
          text: layer.content,
          x: 540 - 350,
          y: 430,
          width: 700,
          height: 80,
          fontSize: 36,
          fontWeight: "normal",
          fontFamily: "Arial",
          fill: "#FFFFFF",
          align: "center",
          shadowEnabled: true,
          shadowColor: "rgba(0,0,0,0.5)",
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowOffsetY: 2,
        });
      } else if (layer.type === "cta") {
        // CTA as styled text with background
        page.addElement({
          type: "text",
          text: layer.content,
          x: 540 - 150,
          y: 560,
          width: 300,
          height: 70,
          fontSize: 32,
          fontWeight: "bold",
          fontFamily: "Arial",
          fill: "#FFFFFF",
          align: "center",
          backgroundEnabled: true,
          backgroundColor: "hsl(220, 80%, 55%)",
          borderRadius: 50,
          shadowEnabled: true,
          shadowColor: "rgba(0,0,0,0.3)",
          shadowBlur: 12,
          shadowOffsetX: 0,
          shadowOffsetY: 4,
        });
      }
    });

    setStoreReady(true);

    return () => {
      // Cleanup not needed here since store persists
    };
  }, [store, strategistOutput, imageUrl]);

  // Download handler
  const handleDownload = useCallback(async () => {
    if (!store) return;
    setIsDownloading(true);
    try {
      await store.waitLoading();
      const dataUrl = await store.toDataURL({ pixelRatio: 2 });
      
      // Trigger download
      const link = document.createElement("a");
      link.download = `criativo-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      // Notify parent
      onCapture?.(dataUrl);
      toast.success("Criativo baixado!");
    } catch {
      toast.error("Erro ao baixar.");
    } finally {
      setIsDownloading(false);
    }
  }, [store, onCapture]);

  // Filter side panel sections to keep it relevant
  const sections = DEFAULT_SECTIONS.filter(
    (section) => !["size", "photos"].includes(section.name)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {/* Action bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] text-muted-foreground">
          Editor Polotno · Arraste, redimensione e edite os elementos
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50 transition-colors disabled:opacity-50"
          >
            {isRegenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            Regerar
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            Baixar PNG
          </button>
        </div>
      </div>

      {/* Polotno Editor */}
      <div
        className="rounded-xl overflow-hidden border border-border/60"
        style={{ height: "600px", minHeight: "500px" }}
      >
        <PolotnoContainer style={{ width: "100%", height: "100%" }}>
          <SidePanelWrap>
            <SidePanel store={store} sections={sections} />
          </SidePanelWrap>
          <WorkspaceWrap>
            <Toolbar store={store} />
            <Workspace store={store} />
            <ZoomButtons store={store} />
          </WorkspaceWrap>
        </PolotnoContainer>
      </div>
    </motion.div>
  );
}
