/**
 * Smart layout engine for positioning text layers on creatives
 * Creates impactful, professional-looking compositions
 */
import * as fabric from "fabric";

interface LayerInput {
  type: string;
  content: string;
  style?: string;
}

interface LayoutConfig {
  w: number;
  h: number;
}

const HEADLINE_FONTS = ["Impact", "Arial Black", "Helvetica", "Trebuchet MS"];
const BODY_FONTS = ["Helvetica", "Arial", "Verdana", "Trebuchet MS"];

function pickFont(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Creates a professional text shadow for fabric objects
 */
function createShadow(type: "headline" | "body" | "cta"): fabric.Shadow {
  switch (type) {
    case "headline":
      return new fabric.Shadow({
        color: "rgba(0,0,0,0.75)",
        blur: 20,
        offsetX: 0,
        offsetY: 4,
      });
    case "cta":
      return new fabric.Shadow({
        color: "rgba(0,0,0,0.5)",
        blur: 12,
        offsetX: 0,
        offsetY: 3,
      });
    default:
      return new fabric.Shadow({
        color: "rgba(0,0,0,0.6)",
        blur: 14,
        offsetX: 0,
        offsetY: 2,
      });
  }
}

/**
 * Layout: "Hero Bottom" — headline at bottom-left, body above CTA
 * Works great for most ad creatives with background images
 */
function layoutHeroBottom(layers: LayerInput[], dim: LayoutConfig): fabric.ITextProps[] {
  const results: fabric.ITextProps[] = [];
  const pad = dim.w * 0.08;
  const maxTextWidth = dim.w * 0.85;

  // Sort: headline first, then body/subheadline, then CTA last
  const sorted = [...layers].sort((a, b) => {
    const order: Record<string, number> = { headline: 0, subheadline: 1, body: 1, cta: 2 };
    return (order[a.type] ?? 1) - (order[b.type] ?? 1);
  });

  // Calculate vertical positions from bottom up
  let currentBottom = dim.h - pad;

  // CTA at the very bottom
  const ctaLayer = sorted.find(l => l.type === "cta");
  if (ctaLayer) {
    const ctaFontSize = Math.round(dim.w * 0.032);
    const ctaHeight = ctaFontSize + 32;
    currentBottom -= ctaHeight;
    results.push({
      text: ctaLayer.content.toUpperCase(),
      left: pad,
      top: currentBottom,
      fontSize: ctaFontSize,
      fontWeight: "bold",
      fontFamily: "Helvetica",
      fill: "#ffffff",
      backgroundColor: "hsl(220,80%,55%)",
      padding: 14,
      shadow: createShadow("cta"),
      textAlign: "center",
      charSpacing: 120,
    } as any);
    currentBottom -= dim.h * 0.04; // gap
  }

  // Body/subheadline above CTA
  const bodyLayers = sorted.filter(l => l.type === "subheadline" || l.type === "body");
  for (const bl of bodyLayers.reverse()) {
    const bodyFontSize = Math.round(dim.w * 0.033);
    const estimatedLines = Math.ceil((bl.content.length * bodyFontSize * 0.55) / maxTextWidth);
    const bodyHeight = bodyFontSize * 1.4 * Math.max(estimatedLines, 1);
    currentBottom -= bodyHeight;
    results.push({
      text: bl.content,
      left: pad,
      top: currentBottom,
      fontSize: bodyFontSize,
      fontWeight: "normal",
      fontFamily: pickFont(BODY_FONTS),
      fill: "rgba(255,255,255,0.92)",
      shadow: createShadow("body"),
      width: maxTextWidth,
      textAlign: "left",
      lineHeight: 1.4,
    } as any);
    currentBottom -= dim.h * 0.025;
  }

  // Headline at top of the text block
  const headlineLayer = sorted.find(l => l.type === "headline");
  if (headlineLayer) {
    const headlineFontSize = Math.round(dim.w * 0.065);
    const estimatedLines = Math.ceil((headlineLayer.content.length * headlineFontSize * 0.55) / maxTextWidth);
    const headlineHeight = headlineFontSize * 1.15 * Math.max(estimatedLines, 1);
    currentBottom -= headlineHeight;
    // Ensure headline doesn't go too high
    currentBottom = Math.max(dim.h * 0.25, currentBottom);
    results.push({
      text: headlineLayer.content.toUpperCase(),
      left: pad,
      top: currentBottom,
      fontSize: headlineFontSize,
      fontWeight: "bold",
      fontFamily: pickFont(HEADLINE_FONTS),
      fill: "#ffffff",
      shadow: createShadow("headline"),
      width: maxTextWidth,
      textAlign: "left",
      lineHeight: 1.1,
      charSpacing: 40,
    } as any);
  }

  return results;
}

/**
 * Layout: "Centered Impact" — all text centered vertically
 * Good for square formats
 */
function layoutCenteredImpact(layers: LayerInput[], dim: LayoutConfig): fabric.ITextProps[] {
  const results: fabric.ITextProps[] = [];
  const centerX = dim.w * 0.1;
  const maxTextWidth = dim.w * 0.8;

  const sorted = [...layers].sort((a, b) => {
    const order: Record<string, number> = { headline: 0, subheadline: 1, body: 1, cta: 2 };
    return (order[a.type] ?? 1) - (order[b.type] ?? 1);
  });

  // Calculate total height to center everything
  let totalHeight = 0;
  const layerConfigs: Array<{ layer: LayerInput; fontSize: number; height: number }> = [];

  for (const layer of sorted) {
    let fontSize: number;
    if (layer.type === "headline") fontSize = Math.round(dim.w * 0.07);
    else if (layer.type === "cta") fontSize = Math.round(dim.w * 0.03);
    else fontSize = Math.round(dim.w * 0.035);

    const estimatedLines = Math.ceil((layer.content.length * fontSize * 0.55) / maxTextWidth);
    const height = fontSize * 1.3 * Math.max(estimatedLines, 1) + (layer.type === "cta" ? 32 : 0);
    totalHeight += height;
    layerConfigs.push({ layer, fontSize, height });
  }

  const gaps = (sorted.length - 1) * dim.h * 0.035;
  totalHeight += gaps;
  let currentY = (dim.h - totalHeight) / 2;
  currentY = Math.max(dim.h * 0.15, currentY);

  for (let i = 0; i < layerConfigs.length; i++) {
    const { layer, fontSize, height } = layerConfigs[i];

    if (layer.type === "headline") {
      results.push({
        text: layer.content.toUpperCase(),
        left: centerX,
        top: currentY,
        fontSize,
        fontWeight: "bold",
        fontFamily: pickFont(HEADLINE_FONTS),
        fill: "#ffffff",
        shadow: createShadow("headline"),
        width: maxTextWidth,
        textAlign: "center",
        lineHeight: 1.1,
        charSpacing: 60,
      } as any);
    } else if (layer.type === "cta") {
      results.push({
        text: layer.content.toUpperCase(),
        left: dim.w * 0.25,
        top: currentY,
        fontSize,
        fontWeight: "bold",
        fontFamily: "Helvetica",
        fill: "#ffffff",
        backgroundColor: "hsl(220,80%,55%)",
        padding: 14,
        shadow: createShadow("cta"),
        textAlign: "center",
        charSpacing: 120,
      } as any);
    } else {
      results.push({
        text: layer.content,
        left: centerX,
        top: currentY,
        fontSize,
        fontWeight: "normal",
        fontFamily: pickFont(BODY_FONTS),
        fill: "rgba(255,255,255,0.9)",
        shadow: createShadow("body"),
        width: maxTextWidth,
        textAlign: "center",
        lineHeight: 1.4,
      } as any);
    }

    currentY += height + dim.h * 0.035;
  }

  return results;
}

/**
 * Adds a subtle gradient overlay rect to enhance text readability
 */
export function addGradientOverlay(canvas: fabric.Canvas, dim: LayoutConfig) {
  const overlay = new fabric.Rect({
    left: 0,
    top: dim.h * 0.4,
    width: dim.w,
    height: dim.h * 0.6,
    selectable: false,
    evented: false,
    hoverCursor: "default",
  });

  const gradient = new fabric.Gradient({
    type: "linear",
    coords: { x1: 0, y1: 0, x2: 0, y2: dim.h * 0.6 },
    colorStops: [
      { offset: 0, color: "rgba(0,0,0,0)" },
      { offset: 0.5, color: "rgba(0,0,0,0.35)" },
      { offset: 1, color: "rgba(0,0,0,0.7)" },
    ],
  });
  overlay.set("fill", gradient);
  canvas.add(overlay);
  // Send to back but above background image
  canvas.sendObjectToBack(overlay);
}

/**
 * Main function: compute impactful layer positions
 */
export function computeImpactfulLayers(
  layers: LayerInput[],
  dim: LayoutConfig,
  layout: "hero-bottom" | "centered" = "hero-bottom"
): fabric.ITextProps[] {
  if (!layers.length) return [];
  
  if (layout === "centered") {
    return layoutCenteredImpact(layers, dim);
  }
  return layoutHeroBottom(layers, dim);
}

/**
 * Adds all layers to a fabric canvas with impactful layout
 */
export function addImpactfulLayers(
  canvas: fabric.Canvas,
  layers: LayerInput[],
  dim: LayoutConfig,
  addTextFn: (text: string, opts: any) => void,
  options?: { addOverlay?: boolean; layout?: "hero-bottom" | "centered" }
) {
  const { addOverlay = true, layout = "hero-bottom" } = options || {};

  // Add gradient overlay for readability
  if (addOverlay) {
    addGradientOverlay(canvas, dim);
  }

  // Compute positions
  const configs = computeImpactfulLayers(layers, dim, layout);

  // Add each text layer
  for (const config of configs) {
    const text = (config as any).text || "";
    const { text: _, ...opts } = config as any;
    addTextFn(text, opts);
  }
}
