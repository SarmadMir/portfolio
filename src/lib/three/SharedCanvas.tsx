"use client";

import { View } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, type CSSProperties } from "react";
import type { Frameloop } from "./host-state";

/**
 * The page's only <Canvas>. Loaded lazily by CanvasHost and never imported
 * anywhere else (ESLint enforces it). Scenes arrive through <View.Port />.
 */
const style: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: "var(--z-field)",
  pointerEvents: "none",
};
const dpr: [min: number, max: number] = [1, 2];
const gl = { antialias: true, alpha: true, powerPreference: "high-performance" } as const;

/** In "demand" mode a frame is drawn only when asked: ask whenever tracked views move. */
function RepaintOnScroll() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const repaint = () => invalidate();
    window.addEventListener("scroll", repaint, { passive: true });
    window.addEventListener("resize", repaint, { passive: true });
    return () => {
      window.removeEventListener("scroll", repaint);
      window.removeEventListener("resize", repaint);
    };
  }, [invalidate]);

  return null;
}

export default function SharedCanvas({ frameloop }: { frameloop: Frameloop }) {
  return (
    <Canvas
      aria-hidden
      style={style}
      // The canvas ignores the pointer; scenes receive events through the page.
      eventSource={document.body}
      eventPrefix="client"
      frameloop={frameloop}
      dpr={dpr}
      gl={gl}
    >
      <View.Port />
      <RepaintOnScroll />
    </Canvas>
  );
}
