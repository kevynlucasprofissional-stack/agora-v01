import { useState, useRef } from "react";
import {
  Type, Square, Circle, Triangle, Minus,
  Upload, Sparkles, Heading1, Heading2, AlignLeft, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { useCanvasState } from "./useCanvasState";
import { addImpactfulLayers } from "./layerLayoutEngine";

type Props = {
  state: ReturnType<typeof useCanvasState>;
  analysisId?: string;
  conversationId?: string;
  isLinkedArtboard?: boolean;
  onAfterGenerate?: () => void;
};

export function ToolsSidebar({ state, analysisId, conversationId, isLinkedArtboard, onAfterGenerate }: Props) {
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        state.addImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const doGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);

    // Save current canvas state for recovery on failure
    const previousJson = state.getJSON();

    try {
      // Clear canvas before generating
      state.clearCanvas();

      const { data, error } = await supabase.functions.invoke("generate-creative", {
        body: {
          analysis_id: analysisId || null,
          conversation_id: conversationId || null,
          format: state.format,
          user_prompt: aiPrompt,
        },
      });
      if (error) throw error;

      // Apply background image and wait for it to load before adding text layers
      if (data?.image_url) {
        await state.setBackgroundImage(data.image_url);
      }
      if (!data?.image_url || data?.image_generation_failed) {
        toast.warning("Imagem de fundo não gerada. Os textos foram aplicados. Tente gerar novamente.");
      }

      const output = data?.strategist_output;
      if (output) {
        const dim = state.dimensions;
        const canvas = state.canvasRef.current;
        const layers: Array<{ type: string; content: string }> = [];
        if (output.headline) layers.push({ type: "headline", content: output.headline });
        if (output.body_copy) layers.push({ type: "subheadline", content: output.body_copy });
        if (output.cta) layers.push({ type: "cta", content: output.cta });
        if (output.editable_layers) {
          layers.length = 0;
          layers.push(...(output.editable_layers as Array<{ type: string; content: string }>));
        }
        if (canvas && layers.length > 0) {
          addImpactfulLayers(canvas, layers, dim, state.addText, {
            addOverlay: true,
            layout: "hero-bottom",
          });
        }
      }
      toast.success("Criativo gerado com sucesso!");
      setAiPrompt("");
      setHasGenerated(true);
      if (onAfterGenerate) {
        // Use rAF to let Fabric finish rendering before saving state
        requestAnimationFrame(() => onAfterGenerate());
      }
    } catch (err: any) {
      console.error("Creative generation error:", err);
      toast.error(err.message || "Erro ao gerar criativo");
      // Restore previous canvas state on failure
      if (previousJson) {
        state.loadJSON(previousJson);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleAIGenerate = () => {
    if (hasGenerated) {
      setShowConfirm(true);
    } else {
      doGenerate();
    }
  };

  const showAISection = !isLinkedArtboard;

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Text */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Texto</h3>
            <div className="space-y-1.5">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => state.addText("Título", { fontSize: 64, fontWeight: "bold" })}>
                <Heading1 className="h-4 w-4" /> Título
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => state.addText("Subtítulo", { fontSize: 36, fontWeight: "600" })}>
                <Heading2 className="h-4 w-4" /> Subtítulo
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => state.addText("Corpo de texto", { fontSize: 20 })}>
                <AlignLeft className="h-4 w-4" /> Corpo
              </Button>
            </div>
          </section>

          <Separator />

          {/* Shapes */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Formas</h3>
            <div className="grid grid-cols-4 gap-1.5">
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => state.addShape("rect")} title="Retângulo">
                <Square className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => state.addShape("circle")} title="Círculo">
                <Circle className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => state.addShape("triangle")} title="Triângulo">
                <Triangle className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => state.addShape("line")} title="Linha">
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          </section>

          <Separator />

          {/* Upload */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Upload</h3>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" /> Enviar Imagem
            </Button>
          </section>

          {showAISection && (
            <>
              <Separator />

              {/* AI Generation */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  <Sparkles className="h-3.5 w-3.5 inline mr-1" />
                  Gerar com IA
                </h3>
                <Textarea
                  placeholder="Descreva o criativo que deseja..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="min-h-[80px] text-sm"
                />
                <Button
                  size="sm"
                  className="w-full mt-2 gap-2"
                  onClick={handleAIGenerate}
                  disabled={aiLoading || !aiPrompt.trim()}
                >
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {aiLoading ? "Gerando..." : "Gerar Criativo"}
                </Button>
              </section>
            </>
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar novo criativo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se você gerar uma nova imagem, o progresso atual será perdido. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowConfirm(false); doGenerate(); }}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
