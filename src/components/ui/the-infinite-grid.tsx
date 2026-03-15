import React, { useRef } from "react";
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useAnimationFrame,
} from "framer-motion";

interface InfiniteGridProps {
  className?: string;
  children?: React.ReactNode;
}

export function InfiniteGrid({ className, children }: InfiniteGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    const { left, top } = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  };

  const gridOffsetX = useMotionValue(0);
  const gridOffsetY = useMotionValue(0);

  useAnimationFrame(() => {
    gridOffsetX.set((gridOffsetX.get() + 0.3) % 40);
    gridOffsetY.set((gridOffsetY.get() + 0.3) % 40);
  });

  const maskImage = useMotionTemplate`radial-gradient(350px circle at ${mouseX}px ${mouseY}px, black, transparent)`;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`absolute inset-0 overflow-hidden ${className ?? ""}`}
    >
      {/* Base grid layer - subtle */}
      <div className="absolute inset-0">
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} color="hsl(var(--warning) / 0.08)" />
      </div>

      {/* Mouse-reveal layer - brighter */}
      <motion.div className="absolute inset-0" style={{ WebkitMaskImage: maskImage, maskImage }}>
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} color="hsl(var(--warning) / 0.25)" />
      </motion.div>

      {children}
    </div>
  );
}

function GridPattern({ offsetX, offsetY, color }: { offsetX: any; offsetY: any; color: string }) {
  return (
    <svg className="absolute inset-0 h-full w-full">
      <defs>
        <motion.pattern
          id={`grid-${color.replace(/[^a-z0-9]/gi, "")}`}
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={color} strokeWidth="1" />
        </motion.pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#grid-${color.replace(/[^a-z0-9]/gi, "")})`} />
    </svg>
  );
}
