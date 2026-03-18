import { useEffect, useRef, useCallback, useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ADOBE_CLIENT_ID = "0eb19546a87349719eb48a1c393ce98e";
const APP_NAME = "Agora MKT AI";

interface AdobeExpressEditorProps {
  /** Background image URL to pre-load into the editor */
  imageUrl?: string;
  /** Callback when user publishes/exports from Adobe Express */
  onPublish?: (data: { imageData: string; projectId?: string }) => void;
  /** Canvas size preset */
  canvasSize?: "1:1" | "9:16" | "16:9" | "4:5";
}

let sdkLoaded = false;
let sdkLoadPromise: Promise<void> | null = null;

async function loadAdobeSDK(): Promise<void> {
  if (sdkLoaded) return;
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cc-embed.adobe.com/sdk/v4/CCEverywhere.js";
    script.onload = () => {
      sdkLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Adobe Express SDK"));
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

export function AdobeExpressEditor({
  imageUrl,
  onPublish,
  canvasSize = "1:1",
}: AdobeExpressEditorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<any>(null);
  const initializedRef = useRef(false);

  const launchEditor = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      await loadAdobeSDK();

      if (!window.CCEverywhere) {
        throw new Error("Adobe Express SDK not available");
      }

      const hostInfo = {
        clientId: ADOBE_CLIENT_ID,
        appName: APP_NAME,
        appVersion: { major: 1, minor: 0 },
        platformCategory: "web",
      };

      const configParams = {
        loginMode: "delayed",
        locale: "pt_BR",
      };

      const ccEverywhere = await window.CCEverywhere.initialize(
        hostInfo,
        configParams
      );

      editorRef.current = ccEverywhere.editor;

      const exportConfig = {
        onPublish: (intent: string, publishParams: any) => {
          const asset = publishParams?.asset?.[0];
          if (asset?.data) {
            onPublish?.({
              imageData: asset.data,
              projectId: publishParams?.projectId,
            });
            toast.success("Criativo exportado com sucesso!");
          }
        },
        onCancel: () => {
          // User cancelled - do nothing
        },
      };

      const appConfig = {
        selectedCategory: "socialMedia",
      };

      const docConfig: any = {
        canvasSize,
      };

      // If we have an image URL, open with that asset
      if (imageUrl) {
        try {
          const resp = await fetch(imageUrl);
          const blob = await resp.blob();
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(",")[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          docConfig.asset = {
            data: base64,
            dataType: "base64",
            type: "image",
          };

          ccEverywhere.editor.createWithAsset(docConfig, appConfig, exportConfig);
        } catch (imgErr) {
          console.warn("Could not load image, opening blank editor:", imgErr);
          ccEverywhere.editor.create(docConfig, appConfig, exportConfig);
        }
      } else {
        ccEverywhere.editor.create(docConfig, appConfig, exportConfig);
      }

      setIsLoading(false);
    } catch (err) {
      console.error("Adobe Express error:", err);
      setError(err instanceof Error ? err.message : "Erro ao inicializar editor");
      setIsLoading(false);
    }
  }, [imageUrl, canvasSize, onPublish]);

  // Auto-launch on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    launchEditor();

    return () => {
      // Cleanup: terminate SDK instance
      try {
        if (window.CCEverywhere?.activeInstance) {
          window.CCEverywhere.activeInstance.terminate();
        }
      } catch {
        // ignore cleanup errors
      }
    };
  }, [launchEditor]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 rounded-xl border border-border/50 bg-accent/20">
        <p className="text-sm text-destructive text-center">{error}</p>
        <Button variant="outline" size="sm" onClick={() => { initializedRef.current = false; launchEditor(); }}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 rounded-xl border border-border/50 bg-accent/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Abrindo Adobe Express...</p>
        <p className="text-xs text-muted-foreground/60">O editor abrirá em uma janela modal</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 px-6 rounded-xl border border-border/50 bg-accent/20">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <ExternalLink className="h-6 w-6 text-primary" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">Adobe Express aberto</p>
        <p className="text-xs text-muted-foreground">Edite seu criativo na janela do Adobe Express. Ao salvar, o resultado aparecerá aqui.</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => { initializedRef.current = false; launchEditor(); }}>
        Reabrir editor
      </Button>
    </div>
  );
}

// Type augmentation for window
declare global {
  interface Window {
    CCEverywhere: any;
  }
}
