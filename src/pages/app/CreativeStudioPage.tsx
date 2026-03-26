import { useState, useCallback, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
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
import { addImpactfulLayers } from "@/components/creative-studio/layerLayoutEngine";
import { toast } from "sonner";

export default function CreativeStudioPage() {
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();
  const analysisId = searchParams.get("analysis_id") || undefined;
  const conversationId = searchParams.get("conversation_id") || undefined;

  const workspace = useWorkspaceState();
  const canvasState = useCanvasState();
  const [saving, setSaving] = useState(false);
  const [jobProcessed, setJobProcessed] = useState(false);
  const [jobLoading, setJobLoading] = useState(!!jobId);

  // Store job data to apply after canvas is ready
  const pendingJobRef = useRef<any>(null);

  // When editing an artboard, load its layers into canvas
  useEffect(() => {
    if (!workspace.editingId || !canvasState.canvasReady) return;
    const ab = workspace.editingArtboard;
    if (!ab) return;
    if (ab.format !== canvasState.format) canvasState.changeFormat(ab.format);
    if (ab.layersState && typeof ab.layersState === "object") {
      const ls = ab.layersState as any;
      const hasContent = (ls.objects?.length > 0) || ls.backgroundImage;
      if (hasContent) {
        canvasState.loadJSON(ab.layersState);
      }
    }
  }, [workspace.editingId, canvasState.canvasReady]);

  // Handle jobId: find or create linked artboard, then open it
  useEffect(() => {
    if (!jobId || jobProcessed || !workspace.dbLoaded) return;

    // Check if an artboard already exists for this job
    const existingArtboard = workspace.findArtboardByJobId(jobId);
    if (existingArtboard) {
      // Artboard exists, just open it
      workspace.setEditingId(existingArtboard.id);
      setJobProcessed(true);
      setJobLoading(false);
      return;
    }

    // No artboard exists — load job data and create one
    setJobLoading(true);
    const loadJob = async () => {
      const { data: job } = await supabase
        .from("creative_jobs")
        .select("image_url, strategist_output, layers_state, format")
        .eq("id", jobId).single();
      if (!job) { setJobLoading(false); setJobProcessed(true); return; }

      const fmt = (job.format as any) || "1080x1080";
      const hasLayers = job.layers_state && typeof job.layers_state === "object" &&
        (job.layers_state as any).objects?.length > 0;

      const id = workspace.addArtboard(fmt, "Criativo importado", { creativeJobId: jobId });

      if (hasLayers) {
        workspace.updateArtboard(id, { layersState: job.layers_state });
      } else {
        pendingJobRef.current = { image_url: job.image_url, strategist_output: job.strategist_output };
      }
      workspace.setEditingId(id);
      setJobProcessed(true);
      setJobLoading(false);
    };
    loadJob();
  }, [jobId, jobProcessed, workspace.dbLoaded]);

  // Apply pending job image + layers once canvas is ready
  useEffect(() => {
    if (!canvasState.canvasReady || !pendingJobRef.current) return;
    const { image_url, strategist_output } = pendingJobRef.current;
    pendingJobRef.current = null;

    const applyAndSave = async () => {
      if (image_url) {
        canvasState.setBackgroundImage(image_url);
        await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      }

      if (strategist_output?.editable_layers) {
        const layers = strategist_output.editable_layers as Array<{ type: string; content: string; style?: string }>;
        const dim = canvasState.dimensions;
        const canvas = canvasState.canvasRef.current;
        if (canvas) {
          addImpactfulLayers(canvas, layers, dim, canvasState.addText, {
            addOverlay: true,
            layout: "hero-bottom",
          });
        }
      }

      // Save state to artboard after rendering
      setTimeout(() => {
        if (workspace.editingId) {
          const json = canvasState.getJSON();
          const thumb = canvasState.exportThumbnail();
          workspace.updateArtboard(workspace.editingId, {
            layersState: json,
            thumbnail: thumb || null,
            format: canvasState.format,
          });
        }
      }, 1000);
    };

    applyAndSave();
  }, [canvasState.canvasReady]);

  const handleBackToWorkspace = useCallback(() => {
    if (workspace.editingId) {
      const json = canvasState.getJSON();
      const thumb = canvasState.exportThumbnail();
      workspace.updateArtboard(workspace.editingId, {
        layersState: json, thumbnail: thumb || null, format: canvasState.format,
      });
      lastSavedJsonRef.current = null; // reset for next editing session
    }
    workspace.setEditingId(null);
  }, [workspace, canvasState]);

  const handleSave = useCallback(async () => {
    const json = canvasState.getJSON();
    if (!json) return;
    setSaving(true);
    try {
      // Save to artboard (which persists to DB)
      if (workspace.editingId) {
        const thumb = canvasState.exportThumbnail();
        workspace.updateArtboard(workspace.editingId, {
          layersState: json, thumbnail: thumb || null, format: canvasState.format,
        });
      }

      // Also save to creative_jobs if linked
      if (jobId) {
        const { error } = await supabase.from("creative_jobs")
          .update({ layers_state: json as any }).eq("id", jobId);
        if (error) throw error;
      }

      toast.success("Salvo com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }, [canvasState, jobId, workspace]);

  const handleAfterGenerate = useCallback(() => {
    if (workspace.editingId) {
      const json = canvasState.getJSON();
      const thumb = canvasState.exportThumbnail();
      workspace.updateArtboard(workspace.editingId, {
        layersState: json, thumbnail: thumb || null, format: canvasState.format,
      });
    }
  }, [workspace, canvasState]);

  // ---- Auto-save: save artboard state every 5 seconds when editing ----
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedJsonRef = useRef<string | null>(null);

  useEffect(() => {
    if (!workspace.editingId || !canvasState.canvasReady) {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      return;
    }

    autoSaveRef.current = setInterval(() => {
      const json = canvasState.getJSON();
      if (!json || !workspace.editingId) return;
      const jsonStr = JSON.stringify(json);
      if (jsonStr === lastSavedJsonRef.current) return; // no changes
      lastSavedJsonRef.current = jsonStr;
      const thumb = canvasState.exportThumbnail();
      workspace.updateArtboard(workspace.editingId, {
        layersState: json, thumbnail: thumb || null, format: canvasState.format,
      });
    }, 5000);

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [workspace.editingId, canvasState.canvasReady]);

  const isLinkedArtboard = !!(workspace.editingArtboard?.creativeJobId);

  if (workspace.editingId) {
    return (
      <div className="flex flex-col h-[calc(100vh-2rem)]">
        <StudioHeader mode="editor" state={canvasState} onSave={handleSave} saving={saving}
          onBack={handleBackToWorkspace} artboardName={workspace.editingArtboard?.name} />
        <div className="flex flex-1 overflow-hidden">
          <ToolsSidebar state={canvasState} analysisId={analysisId} conversationId={conversationId} isLinkedArtboard={isLinkedArtboard} onAfterGenerate={handleAfterGenerate} />
          <FabricCanvas state={canvasState} />
          <PropertiesPanel state={canvasState} />
        </div>
      </div>
    );
  }

  if (jobLoading || !workspace.dbLoaded) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-2rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
