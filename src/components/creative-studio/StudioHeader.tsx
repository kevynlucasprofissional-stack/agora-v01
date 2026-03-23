import { Undo2, Redo2, Download, ZoomIn, ZoomOut, Save, Loader2, Plus, ArrowLeft, StickyNote, Type, ArrowRight, Link, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import type { useCanvasState, CanvasFormat } from "./useCanvasState";
import type { useWorkspaceState, NoteColor } from "./useWorkspaceState";

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

const NOTE_COLOR_OPTIONS: { value: NoteColor; label: string; bg: string }[] = [
  { value: "yellow", label: "Amarelo", bg: "hsl(48, 96%, 89%)" },
  { value: "pink", label: "Rosa", bg: "hsl(330, 80%, 90%)" },
  { value: "blue", label: "Azul", bg: "hsl(210, 80%, 90%)" },
  { value: "green", label: "Verde", bg: "hsl(140, 60%, 88%)" },
  { value: "purple", label: "Roxo", bg: "hsl(270, 60%, 90%)" },
  { value: "orange", label: "Laranja", bg: "hsl(25, 90%, 88%)" },
];

export function StudioHeader(props: Props) {
  const [newArtboardOpen, setNewArtboardOpen] = useState(false);
  const [noteColorOpen, setNoteColorOpen] = useState(false);

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
            min={20} max={300} step={5}
            className="w-24"
          />
          <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground w-10">{Math.round(workspace.wsZoom * 100)}%</span>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-1.5">
          {/* New Artboard */}
          <Dialog open={newArtboardOpen} onOpenChange={setNewArtboardOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" /> Artboard
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Novo Artboard</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {Object.entries(FORMAT_LABELS).map(([k, label]) => (
                  <Button key={k} variant="outline" className="h-auto py-3 flex flex-col gap-1"
                    onClick={() => { workspace.addArtboard(k as CanvasFormat); setNewArtboardOpen(false); }}
                  >
                    <span className="text-xs font-medium">{label}</span>
                    <span className="text-[10px] text-muted-foreground">{k}</span>
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          {/* New Sticky Note */}
          <Dialog open={noteColorOpen} onOpenChange={setNoteColorOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <StickyNote className="h-3.5 w-3.5" /> Nota
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xs">
              <DialogHeader><DialogTitle>Nova Nota</DialogTitle></DialogHeader>
              <div className="grid grid-cols-3 gap-2 pt-2">
                {NOTE_COLOR_OPTIONS.map((c) => (
                  <button key={c.value}
                    className="h-12 rounded-lg border border-border/50 hover:ring-2 hover:ring-primary transition-all duration-150 active:scale-95"
                    style={{ backgroundColor: c.bg }}
                    onClick={() => { workspace.addStickyNote(c.value); setNoteColorOpen(false); }}
                    title={c.label}
                  />
                ))}
              </div>
            </DialogContent>
          </Dialog>

          {/* New Text */}
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => workspace.addText()}>
            <Type className="h-3.5 w-3.5" /> Texto
          </Button>

          {/* Arrow tool dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={workspace.arrowToolMode ? "default" : "outline"}
                size="sm"
                className="gap-1.5 h-8 text-xs"
              >
                <ArrowRight className="h-3.5 w-3.5" /> Seta
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => {
                if (workspace.arrowToolMode === "connected") { workspace.cancelArrowMode(); }
                else { workspace.cancelArrowMode(); workspace.setArrowToolMode("connected"); }
              }}>
                <Link className="h-3.5 w-3.5 mr-2" /> Conectar elementos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                if (workspace.arrowToolMode === "freeform") { workspace.cancelArrowMode(); }
                else { workspace.cancelArrowMode(); workspace.setArrowToolMode("freeform"); }
              }}>
                <ArrowRight className="h-3.5 w-3.5 mr-2" /> Seta livre
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6" />

          {/* Snap toggle */}
          <Button
            variant={workspace.snapToGrid ? "default" : "outline"}
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={() => workspace.setSnapToGrid(!workspace.snapToGrid)}
            title="Snap to grid"
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1" />
      </div>
    );
  }

  // Editor mode
  const { state, onSave, saving, onBack, artboardName } = props;

  const handleExport = () => {
    const dataUrl = state.exportPNG();
    if (!dataUrl) return;
    const link = document.createElement("a");
    const safeName = artboardName?.replace(/[^a-zA-Z0-9_-]/g, "_") || "criativo";
    link.download = `${safeName}-${state.format}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="h-12 border-b border-border bg-card px-4 flex items-center gap-3 shrink-0">
      <Button variant="ghost" size="sm" className="gap-1.5 h-8" onClick={onBack}>
        <ArrowLeft className="h-3.5 w-3.5" /> Workspace
      </Button>
      {artboardName && (
        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{artboardName}</span>
      )}
      <Separator orientation="vertical" className="h-6" />
      <Select value={state.format} onValueChange={(v) => state.changeFormat(v as CanvasFormat)}>
        <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.entries(FORMAT_LABELS).map(([k, label]) => (
            <SelectItem key={k} value={k}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Separator orientation="vertical" className="h-6" />
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={state.undo} title="Desfazer (Ctrl+Z)">
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={state.redo} title="Refazer (Ctrl+Shift+Z)">
        <Redo2 className="h-4 w-4" />
      </Button>
      <Separator orientation="vertical" className="h-6" />
      <div className="flex items-center gap-2">
        <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
        <Slider value={[state.zoom * 100]} onValueChange={([v]) => state.setZoom(v / 100)} min={10} max={150} step={5} className="w-24" />
        <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground w-10">{Math.round(state.zoom * 100)}%</span>
      </div>
      <div className="flex-1" />
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
