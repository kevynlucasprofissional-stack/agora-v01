import { useCallback, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ADOBE_CLIENT_ID = "0eb19546a87349719eb48a1c393ce98e";
const APP_NAME = "Agora MKT AI";

type CanvasRatio = "1:1" | "9:16" | "16:9" | "4:5";

interface AdobeExpressEditorProps {
  imageUrl?: string;
  onPublish?: (data: { imageData: string; projectId?: string }) => void;
  canvasSize?: CanvasRatio;
}

const CANVAS_SIZE_MAP: Record<CanvasRatio, { width: number; height: number; unit: "px" }> = {
  "1:1": { width: 1080, height: 1080, unit: "px" },
  "9:16": { width: 1080, height: 1920, unit: "px" },
  "16:9": { width: 1920, height: 1080, unit: "px" },
  "4:5": { width: 1080, height: 1350, unit: "px" },
};

let sdkLoaded = false;
let sdkLoadPromise: Promise<void> | null = null;

type AdobeSdkInstance = any;

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
    script.onerror = () => reject(new Error("Falha ao carregar Adobe Express SDK"));
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

async function getSDKInstance(): Promise<AdobeSdkInstance> {
  await loadAdobeSDK();

  if (!window.CCEverywhere) {
    throw new Error("Adobe Express SDK não disponível");
  }

  // Check for existing active instance first (survives HMR)
  if (window.__adobeExpressInstance) return window.__adobeExpressInstance;

  // Check SDK's own static activeInstance
  const existingActive = window.CCEverywhere.activeInstance;
  if (existingActive) {
    window.__adobeExpressInstance = existingActive;
    return existingActive;
  }

  if (window.__adobeExpressInitPromise) return window.__adobeExpressInitPromise;

  const hostInfo = {
    clientId: ADOBE_CLIENT_ID,
    appName: APP_NAME,
    appVersion: { major: 1, minor: 0 },
    platformCategory: "web",
  };
  const configParams = { loginMode: "delayed", locale: "pt_BR" };

  const initPromise: Promise<AdobeSdkInstance> = window.CCEverywhere.initialize(hostInfo, configParams)
    .then((instance: AdobeSdkInstance) => {
      window.__adobeExpressInstance = instance;
      return instance;
    })
    .catch((err: any) => {
      if (err?._code === "SDK_ALREADY_INITIALIZED" || err?.message?.includes("already initialized")) {
        const active = window.CCEverywhere?.activeInstance;
        if (active) {
          window.__adobeExpressInstance = active;
          return active;
        }
      }
      throw err;
    })
    .finally(() => {
      window.__adobeExpressInitPromise = null;
    });

  window.__adobeExpressInitPromise = initPromise;
  return initPromise;
}

export function AdobeExpressEditor({ imageUrl, onPublish, canvasSize = "1:1" }: AdobeExpressEditorProps) {
  const [isLaunching, setIsLaunching] = useState(false);

  const launchEditor = useCallback(async () => {
    if (isLaunching) return;
    setIsLaunching(true);

    try {
      const sdk = await getSDKInstance();

      const baseDocConfig: any = { canvasSize: CANVAS_SIZE_MAP[canvasSize] };
      const containerConfig = {
        loadTimeout: 180000,
      };

      const handledErrorCodes = new Set<string>();
      let timeoutRetryAttempted = false;
      let appConfig: any;

      const openBlankEditor = async () => {
        await Promise.resolve(sdk.editor.create(baseDocConfig, appConfig, undefined, containerConfig));
      };

      const callbacks = {
        onCancel: () => {},
        onPublish: (_intent: string, publishParams: any) => {
          const directAsset = Array.isArray(publishParams?.asset)
            ? publishParams.asset[0]
            : publishParams?.asset;
          const nestedAsset = publishParams?.asset?.images?.[0] ?? publishParams?.asset?.videos?.[0];
          const asset = nestedAsset ?? directAsset;
          const imageData = asset?.data ?? asset?.dataUrl;

          if (imageData) {
            onPublish?.({ imageData, projectId: publishParams?.projectId });
            toast.success("Criativo exportado com sucesso!");
          }
        },
        onError: async (err: any) => {
          const errorCode = err?._code ?? "UNKNOWN_ADOBE_ERROR";

          if (errorCode === "TARGET_LOAD_TIMED_OUT" && !timeoutRetryAttempted) {
            timeoutRetryAttempted = true;
            toast.warning("Adobe Express demorou para carregar. Tentando novamente...");
            try {
              await openBlankEditor();
              return;
            } catch (retryErr) {
              console.error("Falha ao tentar reabrir editor após timeout:", retryErr);
            }
          }

          if (handledErrorCodes.has(errorCode)) return;
          handledErrorCodes.add(errorCode);

          console.error("Adobe Express editor error:", {
            code: errorCode,
            message: err?.message,
            debugId: err?._debugId,
          });

          toast.error("Não foi possível carregar o Adobe Express agora. Tente novamente em instantes.");
        },
      };

      appConfig = { callbacks };

      if (imageUrl) {
        try {
          const resp = await fetch(imageUrl, { mode: "cors" });
          if (!resp.ok) throw new Error(`Falha ao carregar imagem (${resp.status})`);

          const blob = await resp.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const docConfig = {
            ...baseDocConfig,
            asset: {
              // Satisfaz a validação da camada externa da SDK
              type: "image",
              dataType: "base64",
              data: dataUrl,
              // Satisfaz o motor interno do iframe do editor
              images: [
                {
                  type: "image",
                  dataType: "base64",
                  data: dataUrl,
                },
              ],
            },
          };

          try {
            await Promise.resolve(sdk.editor.createWithAsset(docConfig, appConfig, undefined, containerConfig));
          } catch (assetError) {
            console.error("Falha síncrona ao preparar imagem para Adobe Express:", assetError);
            toast.warning("Não foi possível pré-carregar a imagem. Abrindo editor vazio.");
            await openBlankEditor();
          }
        } catch (imgErr) {
          console.warn("Não foi possível carregar a imagem, abrindo editor vazio:", imgErr);
          await openBlankEditor();
        }
      } else {
        await openBlankEditor();
      }
    } catch (err: any) {
      console.error("Erro ao abrir Adobe Express:", err);
      toast.error("Não foi possível abrir o editor Adobe Express.");
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
      {isLaunching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
      {isLaunching ? "Abrindo editor…" : "Editar no Adobe Express"}
    </Button>
  );
}

declare global {
  interface Window {
    CCEverywhere: any;
    __adobeExpressInstance: any;
    __adobeExpressInitPromise: Promise<any> | null;
  }
}