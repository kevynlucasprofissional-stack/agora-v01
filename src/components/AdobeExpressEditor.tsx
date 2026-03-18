import { useCallback, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ADOBE_CLIENT_ID = "0eb19546a87349719eb48a1c393ce98e";
const APP_NAME = "Agora MKT AI";

interface AdobeExpressEditorProps {
  imageUrl?: string;
  onPublish?: (data: { imageData: string; projectId?: string }) => void;
  canvasSize?: "1:1" | "9:16" | "16:9" | "4:5";
}

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

  // Reuse global instance/promise so HMR or re-renders don't re-initialize the SDK.
  if (window.__adobeExpressInstance) return window.__adobeExpressInstance;
  if (window.__adobeExpressInitPromise) return window.__adobeExpressInitPromise;

  const hostInfo = {
    clientId: ADOBE_CLIENT_ID,
    appName: APP_NAME,
    appVersion: { major: 1, minor: 0 },
    platformCategory: "web",
  };
  const configParams = { loginMode: "delayed", locale: "pt_BR" };

  window.__adobeExpressInitPromise = window.CCEverywhere.initialize(hostInfo, configParams)
    .then((instance: AdobeSdkInstance) => {
      window.__adobeExpressInstance = instance;
      return instance;
    })
    .catch((err: any) => {
      // Adobe SDK can throw this in dev/HMR flows even with a valid in-memory instance.
      if (err?._code === "SDK_ALREADY_INITIALIZED" || err?.message?.includes("already initialized")) {
        if (window.__adobeExpressInstance) return window.__adobeExpressInstance;
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

  return window.__adobeExpressInitPromise;
}

export function AdobeExpressEditor({ imageUrl, onPublish, canvasSize = "1:1" }: AdobeExpressEditorProps) {
  const [isLaunching, setIsLaunching] = useState(false);

  const launchEditor = useCallback(async () => {
    if (isLaunching) return;
    setIsLaunching(true);

    try {
      const sdk = await getSDKInstance();

      const callbacks = {
        onCancel: () => {},
        onPublish: (_intent: string, publishParams: any) => {
          const asset = publishParams?.asset?.[0];
          if (asset?.data) {
            onPublish?.({ imageData: asset.data, projectId: publishParams?.projectId });
            toast.success("Criativo exportado com sucesso!");
          }
        },
        onError: (err: any) => {
          console.error("Adobe Express editor error:", err);
          toast.error("Erro no Adobe Express");
        },
      };

      const appConfig = { selectedCategory: "socialMedia", callbacks };
      const docConfig: any = { canvasSize };

      if (imageUrl) {
        try {
          const resp = await fetch(imageUrl, { mode: "cors" });
          const blob = await resp.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          docConfig.asset = { data: base64, dataType: "base64", type: "image" };
          sdk.editor.createWithAsset(docConfig, appConfig);
        } catch {
          sdk.editor.create(docConfig, appConfig);
        }
      } else {
        sdk.editor.create(docConfig, appConfig);
      }
    } catch (err) {
      console.error("Adobe Express error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao abrir editor");
    } finally {
      setIsLaunching(false);
    }
  }, [imageUrl, canvasSize, onPublish, isLaunching]);

  return (
    <Button variant="outline" size="sm" onClick={launchEditor} disabled={isLaunching} className="gap-2">
      {isLaunching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
      {isLaunching ? "Abrindo..." : "Editar no Adobe Express"}
    </Button>
  );
}

declare global {
  interface Window {
    CCEverywhere: any;
    __adobeExpressInstance?: any;
    __adobeExpressInitPromise?: Promise<any> | null;
  }
}

