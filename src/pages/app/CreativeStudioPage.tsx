import { useState, useCallback } from "react";
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
