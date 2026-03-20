import { Undo2, Redo2, Download, ZoomIn, ZoomOut, Save, Loader2, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import type { useCanvasState, CanvasFormat } from "./useCanvasState";
import type { useWorkspaceState } from "./useWorkspaceState";

type WorkspaceMode = {
  mode: "workspace";
  workspace: ReturnType<typeof useWorkspaceState>;
};

type EditorMode = {
  mode: "editor";
  state: ReturnType<typeof useCanvasState>;
  onSave: () => void;
  saving: boolean;
  onBack: () => void;
  artboardName?: string;
};

type Props = WorkspaceMode | EditorMode;

const FORMAT_LABELS: Record<CanvasFormat, string> = {
  "1080x1080": "Feed (1:1)",
  "1080x1920": "Stories (9:16)",
  "1200x628": "Banner (1200×628)",
  "1080x1350": "Post (4:5)",
};

export function StudioHeader(props: Props) {
  const [newArtboardOpen, setNewArtboardOpen] = useState(false);

  if (props.mode === "workspace") {
    const { workspace } = props;
    return (
      <div className="h-12 border-b border-border bg-card px-4 flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold text-foreground">Estúdio Criativo</span>

        <Separator orientation="vertical" className="h-6" />

        {/* Zoom */}
        <div className="flex items-center gap-2">
          <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
          <Slider
            value={[workspace.wsZoom * 100]}
            onValueChange={([v]) => workspace.setWsZoom(v / 100)}
            min={20}
            max={300}
            step={5}
            className="w-24"
          />
          <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground w-10">{Math.round(workspace.wsZoom * 100)}%</span>
        </div>

        <div className="flex-1" />

        {/* New Artboard */}
        <Dialog open={newArtboardOpen} onOpenChange={setNewArtboardOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 h-8">
              <Plus className="h-3.5 w-3.5" /> Novo Artboard
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Novo Artboard</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {Object.entries(FORMAT_LABELS).map(([k, label]) => (
                <Button
                  key={k}
                  variant="outline"
                  className="h-auto py-3 flex flex-col gap-1"
                  onClick={() => {
                    workspace.addArtboard(k as CanvasFormat);
                    setNewArtboardOpen(false);
                  }}
                >
                  <span className="text-xs font-medium">{label}</span>
                  <span className="text-[10px] text-muted-foreground">{k}</span>
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Editor mode
  const { state, onSave, saving, onBack, artboardName } = props;

  const handleExport = () => {
    const dataUrl = state.exportPNG();
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.download = `criativo-${state.format}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="h-12 border-b border-border bg-card px-4 flex items-center gap-3 shrink-0">
      {/* Back button */}
      <Button variant="ghost" size="sm" className="gap-1.5 h-8" onClick={onBack}>
        <ArrowLeft className="h-3.5 w-3.5" /> Workspace
      </Button>

      {artboardName && (
        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{artboardName}</span>
      )}

      <Separator orientation="vertical" className="h-6" />

      {/* Format selector */}
      <Select value={state.format} onValueChange={(v) => state.changeFormat(v as CanvasFormat)}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(FORMAT_LABELS).map(([k, label]) => (
            <SelectItem key={k} value={k}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="h-6" />

      {/* Undo/Redo */}
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={state.undo} title="Desfazer (Ctrl+Z)">
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={state.redo} title="Refazer (Ctrl+Shift+Z)">
        <Redo2 className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Zoom */}
      <div className="flex items-center gap-2">
        <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
        <Slider
          value={[state.zoom * 100]}
          onValueChange={([v]) => state.setZoom(v / 100)}
          min={10}
          max={150}
          step={5}
          className="w-24"
        />
        <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground w-10">{Math.round(state.zoom * 100)}%</span>
      </div>

      <div className="flex-1" />

      {/* Save & Export */}
      <Button variant="outline" size="sm" className="gap-2 h-8" onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Salvar
      </Button>
      <Button size="sm" className="gap-2 h-8" onClick={handleExport}>
        <Download className="h-3.5 w-3.5" /> Exportar PNG
      </Button>
    </div>
  );
}
