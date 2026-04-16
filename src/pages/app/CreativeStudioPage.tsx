import { useState, useCallback, useEffect, useRef } from "react";
import { Loader2, Wrench, SlidersHorizontal } from "lucide-react";
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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

// Studio uses 1024px breakpoint so tablets also get mobile layout
function useIsCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setCompact(mql.matches);
    mql.addEventListener("change", onChange);
    setCompact(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return compact;
}

export default function CreativeStudioPage() {
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();
  const analysisId = searchParams.get("analysis_id") || undefined;
  const conversationId = searchParams.get("conversation_id") || undefined;
  const isCompact = useIsCompact();

  const workspace = useWorkspaceState();
  const canvasState = useCanvasState();
  const [saving, setSaving] = useState(false);
  const [jobProcessed, setJobProcessed] = useState(false);
  const [jobLoading, setJobLoading] = useState(!!jobId);

  // Mobile sheet states — only opened explicitly via FABs
  const [toolsSheetOpen, setToolsSheetOpen] = useState(false);
  const [propsSheetOpen, setPropsSheetOpen] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.editingId, canvasState.canvasReady]);

  // Handle jobId: find or create linked artboard, then open it
  useEffect(() => {
    if (!jobId || jobProcessed || !workspace.dbLoaded) return;

    const existingArtboard = workspace.findArtboardByJobId(jobId);
    if (existingArtboard) {
      workspace.setEditingId(existingArtboard.id);
      setJobProcessed(true);
      setJobLoading(false);
      return;
    }

    setJobLoading(true);
    const loadJob = async () => {
      try {
        const { data: job } = await supabase
          .from("creative_jobs")
          .select("image_url, strategist_output, layers_state, format")
          .eq("id", jobId).single();
        if (!job) {
          toast.error("Job criativo não encontrado");
          setJobLoading(false);
          setJobProcessed(true);
          return;
        }

        const fmt = (job.format as any) || "1080x1080";
        const hasLayers = job.layers_state && typeof job.layers_state === "object" &&
          ((job.layers_state as any).objects?.length > 0 || (job.layers_state as any).backgroundImage);

        const id = workspace.addArtboard(fmt, "Criativo importado", { creativeJobId: jobId });

        if (hasLayers) {
          workspace.updateArtboard(id, { layersState: job.layers_state });
        } else {
          pendingJobRef.current = { image_url: job.image_url, strategist_output: job.strategist_output };
        }
        workspace.setEditingId(id);
      } catch (err) {
        console.error("Error loading creative job:", err);
        toast.error("Erro ao carregar job criativo");
      } finally {
        setJobProcessed(true);
        setJobLoading(false);
      }
    };
    loadJob();
  }, [jobId, jobProcessed, workspace.dbLoaded]);

  // Apply pending job image + layers once canvas is ready
  useEffect(() => {
    if (!canvasState.canvasReady || !pendingJobRef.current) return;
    const { image_url, strategist_output } = pendingJobRef.current;
    pendingJobRef.current = null;

    const apply = async () => {
      if (image_url) {
        await canvasState.setBackgroundImage(image_url);
      }

      if (strategist_output?.editable_layers) {
        const layers = strategist_output.editable_layers as Array<{ type: string; content: string; style?: string }>;
        const dim = canvasState.dimensions;
        const canvas = canvasState.canvasRef.current;
        if (canvas && layers.length > 0) {
          addImpactfulLayers(canvas, layers, dim, canvasState.addText, {
            addOverlay: true,
            layout: "hero-bottom",
          });
        }
      }

      if (workspace.editingId) {
        requestAnimationFrame(() => {
          const json = canvasState.getJSON();
          const thumb = canvasState.exportThumbnail();
          if (workspace.editingId) {
            workspace.updateArtboard(workspace.editingId, {
              layersState: json, thumbnail: thumb || null, format: canvasState.format,
            });
          }
        });
      }
    };

    apply();
  }, [canvasState.canvasReady]);

  const handleBackToWorkspace = useCallback(() => {
    if (workspace.editingId) {
      const json = canvasState.getJSON();
      const thumb = canvasState.exportThumbnail();
      workspace.updateArtboard(workspace.editingId, {
        layersState: json, thumbnail: thumb || null, format: canvasState.format,
      });
      lastSavedJsonRef.current = null;
    }
    workspace.setEditingId(null);
  }, [workspace, canvasState]);

  const handleSave = useCallback(async () => {
    const json = canvasState.getJSON();
    if (!json) return;
    setSaving(true);
    try {
      if (workspace.editingId) {
        const thumb = canvasState.exportThumbnail();
        workspace.updateArtboard(workspace.editingId, {
          layersState: json, thumbnail: thumb || null, format: canvasState.format,
        });
      }

      const linkedJobId = jobId || workspace.editingArtboard?.creativeJobId;
      if (linkedJobId) {
        const { error } = await supabase.from("creative_jobs")
          .update({ layers_state: json as any }).eq("id", linkedJobId);
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
      requestAnimationFrame(() => {
        const json = canvasState.getJSON();
        const thumb = canvasState.exportThumbnail();
        if (workspace.editingId) {
          workspace.updateArtboard(workspace.editingId, {
            layersState: json, thumbnail: thumb || null, format: canvasState.format,
          });
        }
      });
    }
  }, [workspace, canvasState]);

  // ---- Auto-save ----
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
      if (jsonStr === lastSavedJsonRef.current) return;
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

  // ===== EDITOR MODE =====
  if (workspace.editingId) {
    return (
      <div className="flex flex-col h-[calc(100vh-2rem)]">
        <StudioHeader mode="editor" state={canvasState} onSave={handleSave} saving={saving}
          onBack={handleBackToWorkspace} artboardName={workspace.editingArtboard?.name} isCompact={isCompact} />
        <div className="flex flex-1 overflow-hidden relative">
          {/* Desktop: fixed sidebar */}
          {!isCompact && (
            <ToolsSidebar state={canvasState} analysisId={analysisId} conversationId={conversationId}
              isLinkedArtboard={isLinkedArtboard} onAfterGenerate={handleAfterGenerate} />
          )}

          <FabricCanvas state={canvasState} />

          {/* Desktop: fixed properties panel */}
          {!isCompact && <PropertiesPanel state={canvasState} />}

          {/* Compact: FABs */}
          {isCompact && (
            <>
              <Button
                size="icon"
                className="fixed bottom-20 left-4 z-50 h-12 w-12 rounded-full shadow-lg"
                onClick={() => setToolsSheetOpen(true)}
              >
                <Wrench className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full shadow-lg bg-card"
                onClick={() => setPropsSheetOpen(true)}
              >
                <SlidersHorizontal className="h-5 w-5" />
              </Button>
            </>
          )}

          {/* Compact: Tools Sheet */}
          {isCompact && (
            <Sheet open={toolsSheetOpen} onOpenChange={setToolsSheetOpen}>
              <SheetContent side="left" className="w-72 p-0">
                <ToolsSidebar state={canvasState} analysisId={analysisId} conversationId={conversationId}
                  isLinkedArtboard={isLinkedArtboard} onAfterGenerate={handleAfterGenerate} onItemAdded={() => setToolsSheetOpen(false)} />
              </SheetContent>
            </Sheet>
          )}

          {/* Compact: Properties Sheet */}
          {isCompact && (
            <Sheet open={propsSheetOpen} onOpenChange={setPropsSheetOpen}>
              <SheetContent side="bottom" className="p-0 max-h-[70vh] [&>button]:hidden">
                <PropertiesPanel state={canvasState} onClose={() => setPropsSheetOpen(false)} />
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    );
  }

  // ===== LOADING =====
  if (jobLoading || !workspace.dbLoaded) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-2rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ===== WORKSPACE MODE =====
  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      <StudioHeader mode="workspace" workspace={workspace} isCompact={isCompact} />
      <div className="flex flex-1 overflow-hidden relative">
        <WorkspaceGrid workspace={workspace} />

        {/* Desktop: fixed panel */}
        {!isCompact && (
          <WorkspacePropertiesPanel
            element={workspace.selectedElement}
            onUpdate={workspace.updateElement}
            onRemove={workspace.removeElement}
            onEdit={(id) => workspace.setEditingId(id)}
            onBringToFront={workspace.bringToFront}
            onSendToBack={workspace.sendToBack}
            onDuplicate={workspace.duplicateElement}
          />
        )}

        {/* Compact: Properties Sheet */}
        {isCompact && workspace.selectedElement && (
          <Sheet open={propsSheetOpen} onOpenChange={setPropsSheetOpen}>
            <SheetContent side="bottom" className="p-0 max-h-[70vh] [&>button]:hidden">
              <WorkspacePropertiesPanel
                element={workspace.selectedElement}
                onUpdate={workspace.updateElement}
                onRemove={workspace.removeElement}
                onEdit={(id) => { workspace.setEditingId(id); setPropsSheetOpen(false); }}
                onBringToFront={workspace.bringToFront}
                onSendToBack={workspace.sendToBack}
                onDuplicate={workspace.duplicateElement}
                onClose={() => setPropsSheetOpen(false)}
                isMobile
              />
            </SheetContent>
          </Sheet>
        )}

        {/* Compact: FAB to open properties when element selected */}
        {isCompact && workspace.selectedElement && !propsSheetOpen && (
          <Button
            variant="outline"
            size="icon"
            className="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full shadow-lg bg-card"
            onClick={() => setPropsSheetOpen(true)}
          >
            <SlidersHorizontal className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
