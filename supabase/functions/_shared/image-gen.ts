/**
 * Shared image generation helpers for Ágora Edge Functions.
 *
 * Used by: generate-creative, generate-image
 */

import { sleep } from "./gemini.ts";

const GEMINI_IMAGE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent";
const GEMINI_FALLBACK_IMAGE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-image-generation:generateContent";

export interface ImageResult {
  imageData: any | null;
  failed: boolean;
}

/**
 * Generate an image with retry + model fallback.
 * `parts` can be text-only or include inlineData for reference images.
 */
export async function generateImageWithRetry(
  parts: any[],
  apiKey: string,
  maxRetries = 2,
): Promise<ImageResult> {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  });
  const headers = { "Content-Type": "application/json" };

  // Primary model
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Image gen attempt ${attempt + 1}/${maxRetries + 1} (primary)`);
      const res = await fetch(`${GEMINI_IMAGE_URL}?key=${apiKey}`, {
        method: "POST",
        headers,
        body,
      });

      if (res.ok) {
        const data = await res.json();
        const imgPart = (data.candidates?.[0]?.content?.parts || []).find(
          (p: any) => p.inlineData,
        );
        if (imgPart) {
          console.log("Image generated (primary model)");
          return { imageData: imgPart, failed: false };
        }
        console.warn("Primary model ok but no image part");
      } else {
        const errorBody = await res.text();
        console.error(`Primary attempt ${attempt + 1} failed: ${res.status} - ${errorBody.slice(0, 300)}`);
        if (res.status === 429 && attempt < maxRetries) {
          await sleep(Math.pow(2, attempt) * 1500);
          continue;
        }
      }
    } catch (err) {
      console.error(`Primary attempt ${attempt + 1} exception:`, err);
    }
    if (attempt < maxRetries) await sleep(1000);
  }

  // Fallback model (text-only for compatibility)
  try {
    console.log("Trying fallback image model...");
    const textPart = parts.find((p: any) => p.text);
    const fallbackBody = JSON.stringify({
      contents: [{ parts: textPart ? [textPart] : parts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    });
    const res = await fetch(`${GEMINI_FALLBACK_IMAGE_URL}?key=${apiKey}`, {
      method: "POST",
      headers,
      body: fallbackBody,
    });

    if (res.ok) {
      const data = await res.json();
      const imgPart = (data.candidates?.[0]?.content?.parts || []).find(
        (p: any) => p.inlineData,
      );
      if (imgPart) {
        console.log("Image generated (fallback model)");
        return { imageData: imgPart, failed: false };
      }
    } else {
      const errorBody = await res.text();
      console.error(`Fallback model failed: ${res.status} - ${errorBody.slice(0, 300)}`);
    }
  } catch (err) {
    console.error("Fallback model exception:", err);
  }

  console.error("All image generation attempts failed");
  return { imageData: null, failed: true };
}

/**
 * Upload a generated image (inlineData) to Supabase storage.
 * Returns a signed URL or the raw data URI as fallback.
 */
export async function uploadImageToStorage(
  supabase: any,
  userId: string,
  imgPart: any,
): Promise<string> {
  const rawImageUrl = `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
  try {
    const base64Match = rawImageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) return rawImageUrl;

    const ext = base64Match[1] === "jpeg" ? "jpg" : base64Match[1];
    const base64Data = base64Match[2];
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const filePath = `${userId}/creatives/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("agora-files")
      .upload(filePath, bytes, { contentType: `image/${base64Match[1]}`, upsert: true });

    if (!uploadError) {
      const { data: signedData } = await supabase.storage
        .from("agora-files")
        .createSignedUrl(filePath, 60 * 60 * 24 * 30); // 30 days
      return signedData?.signedUrl || rawImageUrl;
    }
    console.error("Storage upload error:", uploadError);
    return rawImageUrl;
  } catch (err) {
    console.error("Failed to upload image to storage:", err);
    return rawImageUrl;
  }
}

/**
 * Build editable HTML for a creative with layers.
 */
export function buildEditableHtml(
  layers: Array<{ type: string; content: string; style?: string }>,
  format: string,
  imageUrl: string,
): string {
  const dimensions =
    format === "1080x1920" ? { w: 1080, h: 1920 }
    : format === "1200x628" ? { w: 1200, h: 628 }
    : { w: 1080, h: 1080 };

  const bgStyle = imageUrl
    ? `background:#1a1a2e;`
    : `background:linear-gradient(135deg, #1a1a2e 0%, #2d1b69 50%, #1a1a2e 100%);`;

  const imgTag = imageUrl
    ? `<img src="${imageUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" />`
    : `<!-- Image generation failed - gradient fallback -->`;

  const layerHtml = layers
    .map((layer) => {
      if (layer.type === "headline") {
        return `<div contenteditable="true" data-layer="headline" style="text-align:center;font-size:2rem;font-weight:800;color:#FFFFFF;text-shadow:0 2px 8px rgba(0,0,0,0.6);outline:none;cursor:text;padding:0.25rem 1rem;border-radius:4px;" onmouseover="this.style.outline='2px solid rgba(255,255,255,0.4)'" onmouseout="this.style.outline='none'">${layer.content}</div>`;
      }
      if (layer.type === "subheadline") {
        return `<div contenteditable="true" data-layer="subheadline" style="text-align:center;font-size:1rem;font-weight:500;color:#FFFFFF;text-shadow:0 1px 4px rgba(0,0,0,0.5);outline:none;cursor:text;padding:0.25rem 1rem;border-radius:4px;max-width:80%;" onmouseover="this.style.outline='2px solid rgba(255,255,255,0.4)'" onmouseout="this.style.outline='none'">${layer.content}</div>`;
      }
      if (layer.type === "cta") {
        return `<div style="margin-top:1rem;"><div contenteditable="true" data-layer="cta" style="display:inline-block;padding:0.75rem 2rem;border-radius:9999px;font-size:0.875rem;font-weight:700;background:hsl(220,80%,55%);color:#FFFFFF;box-shadow:0 4px 15px rgba(0,0,0,0.3);outline:none;cursor:text;" onmouseover="this.style.outline='2px solid rgba(255,255,255,0.4)'" onmouseout="this.style.outline='none'">${layer.content}</div></div>`;
      }
      if (layer.type === "logo_placeholder") {
        return `<div data-layer="logo" style="position:absolute;bottom:1.5rem;right:1.5rem;width:60px;height:60px;border-radius:8px;border:2px dashed rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:rgba(255,255,255,0.5);">LOGO</div>`;
      }
      return "";
    })
    .join("\n    ");

  return `<div class="creative-canvas" style="position:relative;width:100%;aspect-ratio:${dimensions.w}/${dimensions.h};overflow:hidden;border-radius:12px;${bgStyle}">
  ${imgTag}
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.3) 0%,transparent 40%,rgba(0,0,0,0.5) 100%);"></div>
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;gap:0.75rem;">
    ${layerHtml}
  </div>
</div>`;
}
