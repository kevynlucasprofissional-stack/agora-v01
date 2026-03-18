import { useRef, useCallback, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
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
  const [isLaunching, setIsLaunching] = useState(false);

  const launchEditor = useCallback(async () => {
    if (isLaunching) return;
    setIsLaunching(true);

    try {
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

      const callbacks = {
        onCancel: () => {},
        onPublish: (_intent: string, publishParams: any) => {
          const asset = publishParams?.asset?.[0];
          if (asset?.data) {
            onPublish?.({
              imageData: asset.data,
              projectId: publishParams?.projectId,
            });
            toast.success("Criativo exportado com sucesso!");
          }
        },
        onError: (err: any) => {
          console.error("Adobe Express error:", err);
          toast.error("Erro no Adobe Express");
        },
      };

      const appConfig = {
        selectedCategory: "socialMedia",
        callbacks,
      };

      const docConfig: any = {
        canvasSize,
      };

      // If we have an image URL, open with that asset
      if (imageUrl) {
        try {
          const resp = await fetch(imageUrl, { mode: "cors" });
          const blob = await resp.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
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

          ccEverywhere.editor.createWithAsset(docConfig, appConfig);
        } catch (imgErr) {
          console.warn("Could not load image, opening blank editor:", imgErr);
          ccEverywhere.editor.create(docConfig, appConfig);
        }
      } else {
        ccEverywhere.editor.create(docConfig, appConfig);
      }
    } catch (err) {
      console.error("Adobe Express error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao abrir editor");
    } finally {
      setIsLaunching(false);
    }
  }, [imageUrl, canvasSize, onPublish, isLaunching]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={launchEditor}
      disabled={isLaunching}
      className="gap-2"
    >
      {isLaunching ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Pencil className="h-4 w-4" />
      )}
      {isLaunching ? "Abrindo..." : "Editar no Adobe Express"}
    </Button>
  );
}

// Type augmentation for window
declare global {
  interface Window {
    CCEverywhere: any;
  }
}
