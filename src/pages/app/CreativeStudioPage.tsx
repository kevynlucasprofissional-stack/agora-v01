import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useCanvasState } from "@/components/creative-studio/useCanvasState";
import { useWorkspaceState } from "@/components/creative-studio/useWorkspaceState";
import { FabricCanvas } from "@/components/creative-studio/FabricCanvas";
import { ToolsSidebar } from "@/components/creative-studio/ToolsSidebar";
import { PropertiesPanel } from "@/components/creative-studio/PropertiesPanel";
import { WorkspaceGrid } from "@/components/creative-studio/WorkspaceGrid";
import { WorkspacePropertiesPanel } from "@/components/creative-studio/WorkspacePropertiesPanel";
import { StudioHeader } from "@/components/creative-studio/StudioHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CreativeStudioPage() {
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();
  const analysisId = searchParams.get("analysis_id") || undefined;
  const conversationId = searchParams.get("conversation_id") || undefined;

  const workspace = useWorkspaceState();
  const canvasState = useCanvasState();
  const [saving, setSaving] = useState(false);
  const [jobLoaded, setJobLoaded] = useState(false);

  useEffect(() => {
    if (!workspace.editingId || !canvasState.canvasReady) return;
    const ab = workspace.editingArtboard;
    if (!ab) return;
    if (ab.format !== canvasState.format) canvasState.changeFormat(ab.format);
    if (ab.layersState && typeof ab.layersState === "object" && (ab.layersState as any).objects?.length > 0) {
      canvasState.loadJSON(ab.layersState);
    }
  }, [workspace.editingId, canvasState.canvasReady]);

  // Store job data to apply after canvas is ready
  const pendingJobRef = useRef<any>(null);

  useEffect(() => {
    if (!jobId || jobLoaded) return;
    const loadJob = async () => {
      const { data: job } = await supabase
        .from("creative_jobs")
        .select("image_url, strategist_output, layers_state, format")
        .eq("id", jobId).single();
      if (!job) return;
      setJobLoaded(true);
      const fmt = (job.format as any) || "1080x1080";
      const hasLayers = job.layers_state && typeof job.layers_state === "object" && 
        (job.layers_state as any).objects?.length > 0;
      const id = workspace.addArtboard(fmt, "Criativo importado");
      if (hasLayers) {
        workspace.updateArtboard(id, { layersState: job.layers_state });
      } else {
        // Store job data to apply image + text layers after canvas init
        pendingJobRef.current = { image_url: job.image_url, strategist_output: job.strategist_output };
      }
      workspace.setEditingId(id);
    };
    loadJob();
  }, [jobId, jobLoaded]);

  // Apply pending job image + layers once canvas is ready
  useEffect(() => {
    if (!canvasState.canvasReady || !pendingJobRef.current) return;
    const { image_url, strategist_output } = pendingJobRef.current;
    pendingJobRef.current = null;

    if (image_url) {
      canvasState.setBackgroundImage(image_url);
    }

    if (strategist_output?.editable_layers) {
      const layers = strategist_output.editable_layers as Array<{ type: string; content: string; style?: string }>;
      const dim = canvasState.dimensions;
      layers.forEach((layer, i) => {
        const opts: Record<string, any> = {
          left: dim.w * 0.1,
          top: dim.h * 0.15 + i * (dim.h * 0.2),
          fill: "#ffffff",
          shadow: "2px 2px 6px rgba(0,0,0,0.6)",
        };
        if (layer.type === "headline") {
          opts.fontSize = Math.round(dim.w * 0.065);
          opts.fontWeight = "bold";
          opts.fontFamily = "Arial Black";
        } else if (layer.type === "cta") {
          opts.fontSize = Math.round(dim.w * 0.04);
          opts.fontWeight = "bold";
          opts.fontFamily = "Arial";
          opts.backgroundColor = "hsl(220,80%,55%)";
          opts.padding = 12;
        } else {
          opts.fontSize = Math.round(dim.w * 0.04);
          opts.fontFamily = "Arial";
        }
        canvasState.addText(layer.content || "", opts);
      });
    }
  }, [canvasState.canvasReady]);

  const handleBackToWorkspace = useCallback(() => {
    if (workspace.editingId) {
      const json = canvasState.getJSON();
      const thumb = canvasState.exportThumbnail();
      workspace.updateArtboard(workspace.editingId, {
        layersState: json, thumbnail: thumb || null, format: canvasState.format,
      });
    }
    workspace.setEditingId(null);
  }, [workspace, canvasState]);

  const handleSave = useCallback(async () => {
    const json = canvasState.getJSON();
    if (!json) return;
    setSaving(true);
    try {
      if (jobId) {
        const { error } = await supabase.from("creative_jobs")
          .update({ layers_state: json as any }).eq("id", jobId);
        if (error) throw error;
        toast.success("Salvo com sucesso!");
      } else {
        if (workspace.editingId) {
          const thumb = canvasState.exportPNG();
          workspace.updateArtboard(workspace.editingId, { layersState: json, thumbnail: thumb || null });
        }
        toast.success("Artboard salvo!");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }, [canvasState, jobId, workspace]);

  if (workspace.editingId) {
    return (
      <div className="flex flex-col h-[calc(100vh-2rem)]">
        <StudioHeader mode="editor" state={canvasState} onSave={handleSave} saving={saving}
          onBack={handleBackToWorkspace} artboardName={workspace.editingArtboard?.name} />
        <div className="flex flex-1 overflow-hidden">
          <ToolsSidebar state={canvasState} analysisId={analysisId} conversationId={conversationId} />
          <FabricCanvas state={canvasState} />
          <PropertiesPanel state={canvasState} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      <StudioHeader mode="workspace" workspace={workspace} />
      <div className="flex flex-1 overflow-hidden">
        <WorkspaceGrid workspace={workspace} />
        <WorkspacePropertiesPanel
          element={workspace.selectedElement}
          onUpdate={workspace.updateElement}
          onRemove={workspace.removeElement}
          onEdit={(id) => workspace.setEditingId(id)}
          onBringToFront={workspace.bringToFront}
          onSendToBack={workspace.sendToBack}
          onDuplicate={workspace.duplicateElement}
        />
      </div>
    </div>
  );
}
