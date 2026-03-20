import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import type { Artboard } from "./useWorkspaceState";
import type { CanvasFormat } from "./useCanvasState";

const FORMAT_LABELS: Record<CanvasFormat, string> = {
  "1080x1080": "Feed (1:1)",
  "1080x1920": "Stories (9:16)",
  "1200x628": "Banner (1200×628)",
  "1080x1350": "Post (4:5)",
};

type Props = {
  artboard: Artboard | null;
  onUpdate: (id: string, updates: Partial<Artboard>) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
};

export function WorkspacePropertiesPanel({ artboard, onUpdate, onRemove, onEdit }: Props) {
  if (!artboard) {
    return (
      <div className="w-60 border-l border-border bg-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Propriedades
        </h3>
        <p className="text-xs text-muted-foreground">
          Selecione um artboard para ver suas propriedades.
        </p>
        <Separator className="my-4" />
        <p className="text-[10px] text-muted-foreground/60">
          Dica: Alt + arrastar para mover o workspace. Ctrl + scroll para zoom.
        </p>
      </div>
    );
  }

  return (
    <div className="w-60 border-l border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Artboard
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={() => onRemove(artboard.id)}
          title="Excluir artboard"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Nome</Label>
        <Input
          value={artboard.name}
          onChange={(e) => onUpdate(artboard.id, { name: e.target.value })}
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Formato</Label>
        <Select
          value={artboard.format}
          onValueChange={(v) => onUpdate(artboard.id, { format: v as CanvasFormat })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FORMAT_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <Button
        size="sm"
        className="w-full"
        onClick={() => onEdit(artboard.id)}
      >
        Abrir Editor
      </Button>
    </div>
  );
}
