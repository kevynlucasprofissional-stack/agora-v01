import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Trash2 } from "lucide-react";
import type { useCanvasState } from "./useCanvasState";
import * as fabric from "fabric";

type Props = {
  state: ReturnType<typeof useCanvasState>;
};

const FONTS = [
  "Arial", "Helvetica", "Georgia", "Times New Roman",
  "Courier New", "Verdana", "Impact", "Comic Sans MS",
  "Trebuchet MS", "Palatino", "Garamond", "Bookman",
];

export function PropertiesPanel({ state }: Props) {
  const obj = state.selectedObject;
  const [props, setProps] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!obj) {
      setProps({});
      return;
    }
    setProps({
      fill: (obj.fill as string) || "#000000",
      stroke: (obj.stroke as string) || "",
      strokeWidth: obj.strokeWidth || 0,
      opacity: obj.opacity ?? 1,
      left: Math.round(obj.left || 0),
      top: Math.round(obj.top || 0),
      angle: Math.round(obj.angle || 0),
      // Text-specific
      ...((obj as any).fontSize !== undefined && {
        fontSize: (obj as any).fontSize,
        fontFamily: (obj as any).fontFamily || "Arial",
        fontWeight: (obj as any).fontWeight || "normal",
        fontStyle: (obj as any).fontStyle || "normal",
        underline: (obj as any).underline || false,
        textAlign: (obj as any).textAlign || "left",
      }),
    });
  }, [obj]);

  const update = (key: string, value: any) => {
    setProps((p) => ({ ...p, [key]: value }));
    state.updateSelectedObject({ [key]: value });
  };

  const deleteObject = () => {
    const canvas = state.canvasRef.current;
    if (!canvas || !obj) return;
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.renderAll();
    state.saveState();
  };

  if (!obj) {
    return (
      <div className="w-60 border-l border-border bg-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Propriedades</h3>
        <p className="text-xs text-muted-foreground">Selecione um elemento no canvas para editar suas propriedades.</p>
        
        <Separator className="my-4" />
        
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Fundo do Canvas</h3>
        <div className="flex items-center gap-2">
          <Label className="text-xs shrink-0">Cor</Label>
          <input
            type="color"
            value={(state.canvasRef.current?.backgroundColor as string) || "#ffffff"}
            onChange={(e) => {
              const canvas = state.canvasRef.current;
              if (canvas) {
                canvas.backgroundColor = e.target.value;
                canvas.renderAll();
                state.saveState();
              }
            }}
            className="h-8 w-12 rounded cursor-pointer border border-border"
          />
        </div>
      </div>
    );
  }

  const isText = obj instanceof fabric.IText || obj instanceof fabric.Textbox || (obj as any).fontSize !== undefined;

  return (
    <div className="w-60 border-l border-border bg-card flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Propriedades</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={deleteObject} title="Excluir">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Fill */}
          <div className="space-y-1.5">
            <Label className="text-xs">Cor de preenchimento</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={props.fill || "#000000"} onChange={(e) => update("fill", e.target.value)} className="h-8 w-12 rounded cursor-pointer border border-border" />
              <Input value={props.fill || ""} onChange={(e) => update("fill", e.target.value)} className="h-8 text-xs flex-1" />
            </div>
          </div>

          {/* Stroke */}
          <div className="space-y-1.5">
            <Label className="text-xs">Borda</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={props.stroke || "#000000"} onChange={(e) => update("stroke", e.target.value)} className="h-8 w-12 rounded cursor-pointer border border-border" />
              <Input type="number" value={props.strokeWidth || 0} onChange={(e) => update("strokeWidth", Number(e.target.value))} className="h-8 text-xs w-16" min={0} max={20} />
            </div>
          </div>

          {/* Opacity */}
          <div className="space-y-1.5">
            <Label className="text-xs">Opacidade: {Math.round((props.opacity || 1) * 100)}%</Label>
            <Slider value={[(props.opacity || 1) * 100]} onValueChange={([v]) => update("opacity", v / 100)} min={0} max={100} step={1} />
          </div>

          <Separator />

          {/* Position */}
          <div className="space-y-1.5">
            <Label className="text-xs">Posição</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted-foreground">X</span>
                <Input type="number" value={props.left || 0} onChange={(e) => update("left", Number(e.target.value))} className="h-7 text-xs" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Y</span>
                <Input type="number" value={props.top || 0} onChange={(e) => update("top", Number(e.target.value))} className="h-7 text-xs" />
              </div>
            </div>
          </div>

          {/* Rotation */}
          <div className="space-y-1.5">
            <Label className="text-xs">Rotação: {props.angle || 0}°</Label>
            <Slider value={[props.angle || 0]} onValueChange={([v]) => update("angle", v)} min={0} max={360} step={1} />
          </div>

          {/* Text-specific properties */}
          {isText && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-xs font-semibold">Texto</Label>

                {/* Font family */}
                <Select value={props.fontFamily || "Arial"} onValueChange={(v) => update("fontFamily", v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map((f) => (
                      <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Font size */}
                <div className="flex gap-2 items-center">
                  <Label className="text-xs shrink-0">Tamanho</Label>
                  <Input type="number" value={props.fontSize || 20} onChange={(e) => update("fontSize", Number(e.target.value))} className="h-7 text-xs" min={8} max={200} />
                </div>

                {/* Style buttons */}
                <div className="flex gap-1">
                  <Button
                    variant={props.fontWeight === "bold" ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => update("fontWeight", props.fontWeight === "bold" ? "normal" : "bold")}
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={props.fontStyle === "italic" ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => update("fontStyle", props.fontStyle === "italic" ? "normal" : "italic")}
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={props.underline ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => update("underline", !props.underline)}
                  >
                    <Underline className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Text alignment */}
                <div className="flex gap-1">
                  <Button variant={props.textAlign === "left" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => update("textAlign", "left")}>
                    <AlignLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant={props.textAlign === "center" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => update("textAlign", "center")}>
                    <AlignCenter className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant={props.textAlign === "right" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => update("textAlign", "right")}>
                    <AlignRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
