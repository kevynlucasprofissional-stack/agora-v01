import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Trash2, Bold, Italic, ArrowUpToLine, ArrowDownToLine, Copy } from "lucide-react";
import type { WorkspaceElement, Artboard, StickyNote, WorkspaceText, Arrow, NoteColor } from "./useWorkspaceState";
import type { CanvasFormat } from "./useCanvasState";

const FORMAT_LABELS: Record<CanvasFormat, string> = {
  "1080x1080": "Feed (1:1)",
  "1080x1920": "Stories (9:16)",
  "1200x628": "Banner (1200×628)",
  "1080x1350": "Post (4:5)",
};

const NOTE_COLORS: { value: NoteColor; label: string; bg: string }[] = [
  { value: "yellow", label: "Amarelo", bg: "hsl(48, 96%, 89%)" },
  { value: "pink", label: "Rosa", bg: "hsl(330, 80%, 90%)" },
  { value: "blue", label: "Azul", bg: "hsl(210, 80%, 90%)" },
  { value: "green", label: "Verde", bg: "hsl(140, 60%, 88%)" },
  { value: "purple", label: "Roxo", bg: "hsl(270, 60%, 90%)" },
  { value: "orange", label: "Laranja", bg: "hsl(25, 90%, 88%)" },
];

const ARROW_COLORS = [
  { value: "hsl(var(--foreground) / 0.5)", label: "Padrão" },
  { value: "hsl(0, 70%, 55%)", label: "Vermelho" },
  { value: "hsl(210, 80%, 55%)", label: "Azul" },
  { value: "hsl(140, 60%, 45%)", label: "Verde" },
  { value: "hsl(40, 90%, 55%)", label: "Amarelo" },
  { value: "hsl(270, 60%, 55%)", label: "Roxo" },
];

type Props = {
  element: WorkspaceElement | null;
  onUpdate: (id: string, updates: Partial<any>) => void;
  onRemove: (id: string) => void;
  onEdit?: (id: string) => void;
  onBringToFront?: (id: string) => void;
  onSendToBack?: (id: string) => void;
  onDuplicate?: (id: string) => void;
};

export function WorkspacePropertiesPanel({ element, onUpdate, onRemove, onEdit, onBringToFront, onSendToBack, onDuplicate }: Props) {
  if (!element) {
    return (
      <div className="w-60 border-l border-border bg-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Propriedades
        </h3>
        <p className="text-xs text-muted-foreground">
          Selecione um elemento para ver suas propriedades.
        </p>
        <Separator className="my-4" />
        <p className="text-[10px] text-muted-foreground/60">
          Alt+arrastar = mover workspace · Ctrl+scroll = zoom · Delete = excluir · Ctrl+D = duplicar
        </p>
      </div>
    );
  }

  const showDepth = element.type !== "arrow";

  return (
    <div className="w-60 border-l border-border bg-card p-4 space-y-4 overflow-y-auto">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {element.type === "artboard" ? "Artboard" :
           element.type === "sticky-note" ? "Nota" :
           element.type === "text" ? "Texto" : "Seta"}
        </h3>
        <div className="flex items-center gap-0.5">
          {onDuplicate && element.type !== "arrow" && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => onDuplicate(element.id)} title="Duplicar (Ctrl+D)">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
            onClick={() => onRemove(element.id)} title="Excluir (Delete)">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Depth controls */}
      {showDepth && (
        <div className="space-y-1.5">
          <Label className="text-xs">Profundidade</Label>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1"
              onClick={() => onBringToFront?.(element.id)}>
              <ArrowUpToLine className="h-3 w-3" /> Frente
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1"
              onClick={() => onSendToBack?.(element.id)}>
              <ArrowDownToLine className="h-3 w-3" /> Trás
            </Button>
          </div>
        </div>
      )}

      {/* Artboard properties */}
      {element.type === "artboard" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input value={(element as Artboard).name}
              onChange={(e) => onUpdate(element.id, { name: e.target.value })} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Formato</Label>
            <Select value={(element as Artboard).format}
              onValueChange={(v) => onUpdate(element.id, { format: v as CanvasFormat })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FORMAT_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <Button size="sm" className="w-full" onClick={() => onEdit?.(element.id)}>
            Abrir Editor
          </Button>
        </>
      )}

      {/* Sticky Note properties */}
      {element.type === "sticky-note" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Cor</Label>
            <div className="flex gap-1.5">
              {NOTE_COLORS.map((c) => (
                <button key={c.value}
                  className={`w-7 h-7 rounded-md border transition-all duration-150 active:scale-95 ${
                    (element as StickyNote).color === c.value ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "border-border/50"
                  }`}
                  style={{ backgroundColor: c.bg }}
                  onClick={() => onUpdate(element.id, { color: c.value })}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tamanho</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted-foreground">Largura</span>
                <Input type="number" value={(element as StickyNote).width}
                  onChange={(e) => onUpdate(element.id, { width: Number(e.target.value) })}
                  className="h-7 text-xs" min={80} max={600} />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Altura</span>
                <Input type="number" value={(element as StickyNote).height}
                  onChange={(e) => onUpdate(element.id, { height: Number(e.target.value) })}
                  className="h-7 text-xs" min={60} max={600} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Text properties */}
      {element.type === "text" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Conteúdo</Label>
            <Input value={(element as WorkspaceText).text}
              onChange={(e) => onUpdate(element.id, { text: e.target.value })} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tamanho da fonte</Label>
            <Slider value={[(element as WorkspaceText).fontSize]}
              onValueChange={([v]) => onUpdate(element.id, { fontSize: v })}
              min={10} max={72} step={1} className="w-full" />
            <span className="text-[10px] text-muted-foreground">{(element as WorkspaceText).fontSize}px</span>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estilo</Label>
            <div className="flex gap-1.5">
              <Button variant={(element as WorkspaceText).bold ? "default" : "outline"} size="icon" className="h-7 w-7"
                onClick={() => onUpdate(element.id, { bold: !(element as WorkspaceText).bold })}>
                <Bold className="h-3.5 w-3.5" />
              </Button>
              <Button variant={(element as WorkspaceText).italic ? "default" : "outline"} size="icon" className="h-7 w-7"
                onClick={() => onUpdate(element.id, { italic: !(element as WorkspaceText).italic })}>
                <Italic className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cor</Label>
            <Input type="color" value="#ffffff"
              onChange={(e) => onUpdate(element.id, { color: e.target.value })} className="h-8 w-full cursor-pointer" />
          </div>
        </>
      )}

      {/* Arrow properties */}
      {element.type === "arrow" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <span className="text-[10px] text-muted-foreground">
              {(element as Arrow).arrowMode === "freeform" ? "Seta livre" : "Conectada"}
            </span>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estilo</Label>
            <Select value={(element as Arrow).style}
              onValueChange={(v) => onUpdate(element.id, { style: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Sólida</SelectItem>
                <SelectItem value="dashed">Tracejada</SelectItem>
                <SelectItem value="curved">Curva</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Direção</Label>
            <Select value={(element as Arrow).direction}
              onValueChange={(v) => onUpdate(element.id, { direction: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="one-way">Unidirecional</SelectItem>
                <SelectItem value="two-way">Bidirecional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cor</Label>
            <div className="flex gap-1.5 flex-wrap">
              {ARROW_COLORS.map((c) => (
                <button key={c.value}
                  className={`w-7 h-7 rounded-md border transition-all duration-150 active:scale-95 ${
                    (element as Arrow).color === c.value ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "border-border/50"
                  }`}
                  style={{ backgroundColor: c.value }}
                  onClick={() => onUpdate(element.id, { color: c.value })}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
