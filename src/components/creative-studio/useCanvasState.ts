import { useCallback, useEffect, useRef, useState } from "react";
import * as fabric from "fabric"; // v6

export type CanvasFormat = "1080x1080" | "1080x1920" | "1200x628" | "1080x1350";

const FORMAT_DIMENSIONS: Record<CanvasFormat, { w: number; h: number }> = {
  "1080x1080": { w: 1080, h: 1080 },
  "1080x1920": { w: 1080, h: 1920 },
  "1200x628": { w: 1200, h: 628 },
  "1080x1350": { w: 1080, h: 1350 },
};

export function useCanvasState() {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null);
  const [format, setFormat] = useState<CanvasFormat>("1080x1080");
  const [zoom, setZoom] = useState(0.5);
  const [canvasReady, setCanvasReady] = useState(false);
  const setCanvasNotReady = useCallback(() => setCanvasReady(false), []);

  // Use a ref for dimensions so initCanvas doesn't depend on format
  const formatRef = useRef<CanvasFormat>(format);
  formatRef.current = format;

  // Undo/Redo
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const isRestoring = useRef(false);

  const dimensions = FORMAT_DIMENSIONS[format];

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || isRestoring.current) return;
    const json = JSON.stringify(canvas.toJSON());
    undoStack.current.push(json);
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || undoStack.current.length < 2) return;
    isRestoring.current = true;
    const current = undoStack.current.pop()!;
    redoStack.current.push(current);
    const prev = undoStack.current[undoStack.current.length - 1];
    canvas.loadFromJSON(prev).then(() => {
      canvas.renderAll();
      isRestoring.current = false;
    });
  }, []);

  const redo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || redoStack.current.length === 0) return;
    isRestoring.current = true;
    const next = redoStack.current.pop()!;
    undoStack.current.push(next);
    canvas.loadFromJSON(next).then(() => {
      canvas.renderAll();
      isRestoring.current = false;
    });
  }, []);

  // A version counter so the PropertiesPanel can re-read without unmounting
  const [propsVersion, setPropsVersion] = useState(0);

  // initCanvas: stable reference — reads dimensions from ref, not state
  const initCanvas = useCallback((canvasEl: HTMLCanvasElement) => {
    if (canvasRef.current) {
      canvasRef.current.dispose();
    }

    const dims = FORMAT_DIMENSIONS[formatRef.current];
    const c = new fabric.Canvas(canvasEl, {
      width: dims.w,
      height: dims.h,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
    });

    c.on("selection:created", (e) => {
      setSelectedObject(e.selected?.[0] || null);
    });
    c.on("selection:updated", (e) => {
      setSelectedObject(e.selected?.[0] || null);
    });
    c.on("selection:cleared", () => {
      setSelectedObject(null);
    });
    c.on("object:modified", () => {
      saveState();
      // Bump propsVersion so PropertiesPanel re-reads without flicker
      setPropsVersion((v) => v + 1);
    });

    canvasRef.current = c;
    saveState();
    setCanvasReady(true);
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveState]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        if (isInput) return;
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && ((e.key === "z" && e.shiftKey) || e.key === "y")) {
        if (isInput) return;
        e.preventDefault();
        redo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const target = e.target as HTMLElement;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (active && !(active as any).isEditing) {
          canvas.remove(active);
          canvas.discardActiveObject();
          saveState();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, saveState]);

  const addText = useCallback((text: string, options: Partial<fabric.ITextProps> = {}) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dim = FORMAT_DIMENSIONS[formatRef.current];
    const hasWidth = options.width && options.width > 0;
    let t: fabric.IText | fabric.Textbox;
    if (hasWidth) {
      t = new fabric.Textbox(text, {
        left: dim.w / 2 - 100,
        top: dim.h / 2 - 20,
        fontSize: 40,
        fontFamily: "Arial",
        fill: "#000000",
        centeredRotation: true,
        ...options,
      });
    } else {
      t = new fabric.IText(text, {
        left: dim.w / 2 - 100,
        top: dim.h / 2 - 20,
        fontSize: 40,
        fontFamily: "Arial",
        fill: "#000000",
        centeredRotation: true,
        ...options,
      });
    }
    // Enforce canvas margins — clamp position
    const margin = dim.w * 0.05;
    if ((t.left || 0) < margin) t.set("left", margin);
    if ((t.top || 0) < margin) t.set("top", margin);
    canvas.add(t);
    canvas.setActiveObject(t);
    canvas.renderAll();
    saveState();
  }, [saveState]);

  const addShape = useCallback((type: "rect" | "circle" | "triangle" | "line") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dim = FORMAT_DIMENSIONS[formatRef.current];
    const cx = dim.w / 2;
    const cy = dim.h / 2;
    let obj: fabric.FabricObject;
    switch (type) {
      case "rect":
        obj = new fabric.Rect({ left: cx - 75, top: cy - 75, width: 150, height: 150, fill: "hsl(220,80%,55%)", rx: 8, ry: 8, centeredRotation: true });
        break;
      case "circle":
        obj = new fabric.Circle({ left: cx - 75, top: cy - 75, radius: 75, fill: "hsl(155,50%,55%)", centeredRotation: true });
        break;
      case "triangle":
        obj = new fabric.Triangle({ left: cx - 75, top: cy - 75, width: 150, height: 150, fill: "hsl(40,80%,60%)", centeredRotation: true });
        break;
      case "line":
        obj = new fabric.Line([cx - 100, cy, cx + 100, cy], { stroke: "#000000", strokeWidth: 3 });
        break;
      default:
        return;
    }
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.renderAll();
    saveState();
  }, [saveState]);

  const addImage = useCallback((url: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dim = FORMAT_DIMENSIONS[formatRef.current];
    const imgEl = new Image();
    imgEl.crossOrigin = "anonymous";
    imgEl.onload = () => {
      const img = new fabric.FabricImage(imgEl, {
        left: 50,
        top: 50,
      });
      const maxDim = Math.min(dim.w, dim.h) * 0.6;
      if (img.width && img.width > maxDim) {
        img.scaleToWidth(maxDim);
      }
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      saveState();
    };
    imgEl.src = url;
  }, [saveState]);

  const setBackgroundImage = useCallback((url: string): Promise<void> => {
    const canvas = canvasRef.current;
    if (!canvas) return Promise.resolve();
    return new Promise((resolve) => {
      const dim = FORMAT_DIMENSIONS[formatRef.current];
      const imgEl = new Image();
      imgEl.crossOrigin = "anonymous";
      imgEl.onload = () => {
        const img = new fabric.FabricImage(imgEl);
        img.scaleToWidth(dim.w);
        img.scaleToHeight(dim.h);
        canvas.backgroundImage = img;
        canvas.renderAll();
        saveState();
        resolve();
      };
      imgEl.onerror = () => {
        console.error("Failed to load background image:", url.slice(0, 80));
        resolve();
      };
      imgEl.src = url;
    });
  }, [saveState]);

  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    return canvas.toDataURL({ format: "png", multiplier: 2 });
  }, []);

  const exportThumbnail = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    return canvas.toDataURL({ format: "png", multiplier: 0.2 });
  }, []);

  const getJSON = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toJSON();
  }, []);

  const loadJSON = useCallback((json: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isRestoring.current = true;
    canvas.loadFromJSON(json).then(() => {
      canvas.renderAll();
      isRestoring.current = false;
      saveState();
    });
  }, [saveState]);

  const updateSelectedObject = useCallback((props: Record<string, any>, { skipSave = false } = {}) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;

    // Handle rotation around center
    if ("angle" in props && props.angle !== undefined) {
      const center = obj.getCenterPoint();
      obj.set({ angle: props.angle, originX: "center", originY: "center", left: center.x, top: center.y });
      const { angle, centeredRotation, ...rest } = props;
      if (Object.keys(rest).length > 0) obj.set(rest);
    } else {
      obj.set(props);
    }

    canvas.renderAll();
    if (!skipSave) {
      saveState();
    }
    setPropsVersion((v) => v + 1);
  }, [saveState]);

  const changeFormat = useCallback((newFormat: CanvasFormat) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dims = FORMAT_DIMENSIONS[newFormat];
    canvas.setDimensions({ width: dims.w, height: dims.h });
    canvas.renderAll();
    setFormat(newFormat);
    formatRef.current = newFormat;
    saveState();
  }, [saveState]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getObjects().slice().forEach((obj) => canvas.remove(obj));
    canvas.backgroundImage = undefined;
    canvas.backgroundColor = "#1a1a2e";
    canvas.renderAll();
    saveState();
  }, [saveState]);

  return {
    canvasRef,
    initCanvas,
    selectedObject,
    propsVersion,
    format,
    changeFormat,
    dimensions,
    zoom,
    setZoom,
    canvasReady,
    setCanvasNotReady,
    undo,
    redo,
    addText,
    addShape,
    addImage,
    setBackgroundImage,
    exportPNG,
    exportThumbnail,
    getJSON,
    loadJSON,
    updateSelectedObject,
    saveState,
    clearCanvas,
  };
}
