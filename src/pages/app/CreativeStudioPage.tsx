import { useState, useCallback, useEffect } from "react";
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

  // When entering editor mode, load artboard's layersState into canvas
  useEffect(() => {
    if (!workspace.editingId || !canvasState.canvasReady) return;
    const ab = workspace.editingArtboard;
    if (!ab) return;

    // Set format
    if (ab.format !== canvasState.format) {
      canvasState.changeFormat(ab.format);
    }

    // Load layers if they exist
    if (ab.layersState && ab.layersState.objects?.length > 0) {
      canvasState.loadJSON(ab.layersState);
    }
  }, [workspace.editingId, canvasState.canvasReady]);

  // Load creative_job data when jobId is present (legacy flow)
  useEffect(() => {
    if (!jobId || jobLoaded) return;

    const loadJob = async () => {
      const { data: job } = await supabase
        .from("creative_jobs")
        .select("image_url, strategist_output, layers_state, format")
        .eq("id", jobId)
        .single();

      if (!job) return;
      setJobLoaded(true);

      // Create an artboard from the job
      const format = (job.format as any) || "1080x1080";
      const id = workspace.addArtboard(format, "Criativo importado");

      if (job.layers_state) {
        workspace.updateArtboard(id, { layersState: job.layers_state });
      }

      // Auto-open in editor
      workspace.setEditingId(id);
    };

    loadJob();
  }, [jobId, jobLoaded]);

  // Save current canvas state back to artboard when leaving editor
  const handleBackToWorkspace = useCallback(() => {
    if (workspace.editingId) {
      const json = canvasState.getJSON();
      const thumb = canvasState.exportPNG();
      workspace.updateArtboard(workspace.editingId, {
        layersState: json,
        thumbnail: thumb || null,
        format: canvasState.format,
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
        const { error } = await supabase
          .from("creative_jobs")
          .update({ layers_state: json as any })
          .eq("id", jobId);
        if (error) throw error;
        toast.success("Salvo com sucesso!");
      } else {
        // Save to artboard state locally
        if (workspace.editingId) {
          const thumb = canvasState.exportPNG();
          workspace.updateArtboard(workspace.editingId, {
            layersState: json,
            thumbnail: thumb || null,
          });
        }
        toast.success("Artboard salvo!");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }, [canvasState, jobId, workspace]);

  // Editor mode
  if (workspace.editingId) {
    return (
      <div className="flex flex-col h-[calc(100vh-2rem)]">
        <StudioHeader
          mode="editor"
          state={canvasState}
          onSave={handleSave}
          saving={saving}
          onBack={handleBackToWorkspace}
          artboardName={workspace.editingArtboard?.name}
        />
        <div className="flex flex-1 overflow-hidden">
          <ToolsSidebar state={canvasState} analysisId={analysisId} conversationId={conversationId} />
          <FabricCanvas state={canvasState} />
          <PropertiesPanel state={canvasState} />
        </div>
      </div>
    );
  }

  // Workspace mode
  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      <StudioHeader mode="workspace" workspace={workspace} />
      <div className="flex flex-1 overflow-hidden">
        <WorkspaceGrid workspace={workspace} />
        <WorkspacePropertiesPanel
          artboard={workspace.selectedArtboard}
          onUpdate={workspace.updateArtboard}
          onRemove={workspace.removeArtboard}
          onEdit={(id) => workspace.setEditingId(id)}
        />
      </div>
    </div>
  );
}
