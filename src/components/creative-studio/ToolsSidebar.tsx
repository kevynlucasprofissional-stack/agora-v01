import { useState, useRef } from "react";
import {
  Type, Square, Circle, Triangle, Minus,
  Upload, Sparkles, Heading1, Heading2, AlignLeft, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { useCanvasState } from "./useCanvasState";

type Props = {
  state: ReturnType<typeof useCanvasState>;
  analysisId?: string;
  conversationId?: string;
};

export function ToolsSidebar({ state, analysisId, conversationId }: Props) {
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
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
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    if (!analysisId) {
      toast.error("Selecione uma análise primeiro para gerar com IA.");
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-creative", {
        body: {
          analysis_id: analysisId,
          conversation_id: conversationId || null,
          format: state.format,
          user_prompt: aiPrompt,
        },
      });
      if (error) throw error;
      if (data?.image_url) {
        state.setBackgroundImage(data.image_url);
      }
      const output = data?.strategist_output;
      if (output) {
        // Add text layers from AI
        const h = state.dimensions.h;
        const w = state.dimensions.w;
        if (output.headline) {
          state.addText(output.headline, {
            fontSize: 64,
            fontWeight: "bold",
            fill: "#FFFFFF",
            left: w * 0.1,
            top: h * 0.3,
            width: w * 0.8,
            shadow: new (await import("fabric")).Shadow({ color: "rgba(0,0,0,0.5)", blur: 10, offsetX: 0, offsetY: 2 }),
          });
        }
        if (output.body_copy) {
          state.addText(output.body_copy, {
            fontSize: 28,
            fill: "#FFFFFF",
            left: w * 0.1,
            top: h * 0.5,
            width: w * 0.8,
            shadow: new (await import("fabric")).Shadow({ color: "rgba(0,0,0,0.4)", blur: 6, offsetX: 0, offsetY: 1 }),
          });
        }
        if (output.cta) {
          state.addText(output.cta, {
            fontSize: 24,
            fontWeight: "bold",
            fill: "#FFFFFF",
            backgroundColor: "hsl(220,80%,55%)",
            left: w * 0.3,
            top: h * 0.7,
            padding: 16,
          });
        }
      }
      toast.success("Criativo gerado com sucesso!");
      setAiPrompt("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar criativo");
    } finally {
      setAiLoading(false);
    }
  };

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
            {!analysisId && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Acesse via uma análise existente para usar a geração por IA.
              </p>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
