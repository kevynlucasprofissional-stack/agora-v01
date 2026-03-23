import { useEffect, useRef } from "react";
import type { useCanvasState } from "./useCanvasState";

type Props = {
  state: ReturnType<typeof useCanvasState>;
};

export function FabricCanvas({ state }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (canvasElRef.current && !initialized.current) {
      initialized.current = true;
      state.initCanvas(canvasElRef.current);
    }
    return () => {
      state.canvasRef?.current?.dispose();
      initialized.current = false;
    };
  }, [state.initCanvas]);

  // Apply zoom via CSS transform for performance
  const scale = state.zoom;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-8"
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          transition: "transform 0.15s ease",
        }}
      >
        <div
          className="shadow-2xl rounded-lg overflow-hidden"
          style={{
            width: state.dimensions.w,
            height: state.dimensions.h,
          }}
        >
          <canvas ref={canvasElRef} />
        </div>
      </div>
    </div>
  );
}
