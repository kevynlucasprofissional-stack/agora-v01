import { useState, useCallback, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useCanvasState } from "@/components/creative-studio/useCanvasState";
import { FabricCanvas } from "@/components/creative-studio/FabricCanvas";
import { ToolsSidebar } from "@/components/creative-studio/ToolsSidebar";
import { PropertiesPanel } from "@/components/creative-studio/PropertiesPanel";
import { StudioHeader } from "@/components/creative-studio/StudioHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CreativeStudioPage() {
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();
  const analysisId = searchParams.get("analysis_id") || undefined;
  const conversationId = searchParams.get("conversation_id") || undefined;

  const canvasState = useCanvasState();
  const [saving, setSaving] = useState(false);
  const [jobLoaded, setJobLoaded] = useState(false);

  // Load creative_job data when jobId is present
  useEffect(() => {
    if (!jobId || !canvasState.canvasReady || jobLoaded) return;

    const loadJob = async () => {
      const { data: job } = await supabase
        .from("creative_jobs")
        .select("image_url, strategist_output, layers_state, format")
        .eq("id", jobId)
        .single();

      if (!job) return;
      setJobLoaded(true);

      // Change format if needed
      if (job.format && job.format !== canvasState.format) {
        canvasState.changeFormat(job.format as any);
      }

      // If layers_state exists and has objects, restore it
      const ls = job.layers_state as any;
      if (ls && ls.objects && ls.objects.length > 0) {
        canvasState.loadJSON(ls);
        return;
      }

      // Otherwise build from image_url + strategist_output
      if (job.image_url) {
        canvasState.setBackgroundImage(job.image_url);
      }

      const output = job.strategist_output as any;
      if (output) {
        const layers = output.editable_layers || [];
        const dims = canvasState.dimensions;

        // Small delay to let background load first
        setTimeout(() => {
          layers.forEach((layer: any, i: number) => {
            if (layer.type === "headline") {
              canvasState.addText(layer.content || output.headline || "Título", {
                fontSize: 56,
                fontWeight: "bold",
                fill: "#FFFFFF",
                textAlign: "center",
                left: dims.w * 0.1,
                top: dims.h * 0.3,
                width: dims.w * 0.8,
                shadow: new (window as any).fabric?.Shadow?.("0 2px 8px rgba(0,0,0,0.6)") || undefined,
              });
            } else if (layer.type === "subheadline") {
              canvasState.addText(layer.content || output.body_copy || "Subtítulo", {
                fontSize: 28,
                fill: "#FFFFFF",
                textAlign: "center",
                left: dims.w * 0.1,
                top: dims.h * 0.5,
                width: dims.w * 0.8,
              });
            } else if (layer.type === "cta") {
              canvasState.addText(layer.content || output.cta || "Saiba Mais", {
                fontSize: 24,
                fontWeight: "bold",
                fill: "#FFFFFF",
                textAlign: "center",
                left: dims.w * 0.3,
                top: dims.h * 0.7,
                width: dims.w * 0.4,
                backgroundColor: "hsl(220,80%,55%)",
              });
            }
          });
        }, 500);
      }
    };

    loadJob();
  }, [jobId, canvasState.canvasReady, jobLoaded]);

  const handleSave = useCallback(async () => {
    const json = canvasState.getJSON();
    if (!json) return;

    setSaving(true);
    try {
      if (jobId) {
        const { error } = await supabase
          .from("creative_jobs")
          .update({ layers_state: json as any })
          .eq("id", jobId);
        if (error) throw error;
        toast.success("Salvo com sucesso!");
      } else {
        toast.info("Use 'Gerar com IA' primeiro para criar um criativo salvável.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }, [canvasState, jobId]);

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      <StudioHeader state={canvasState} onSave={handleSave} saving={saving} />
      <div className="flex flex-1 overflow-hidden">
        <ToolsSidebar state={canvasState} analysisId={analysisId} conversationId={conversationId} />
        <FabricCanvas state={canvasState} />
        <PropertiesPanel state={canvasState} />
      </div>
    </div>
  );
}
