"use client";

import { View } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, type CSSProperties } from "react";
import { createFrameDriver } from "./frame-driver";
import type { RenderMode } from "./host-state";

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
const now = () => performance.now();
const setTimer = (run: () => void, delay: number) => window.setTimeout(run, delay);
const clearTimer = (timer: number) => window.clearTimeout(timer);

/** Turns the host's render mode into frame requests. See frame-driver.ts for why the frameloop prop stays fixed. */
function Frames({ mode }: { mode: RenderMode }) {
  const invalidate = useThree((state) => state.invalidate);
  const clock = useThree((state) => state.clock);
  const driver = useMemo(
    () => createFrameDriver({ invalidate, clock, now, setTimer, clearTimer }),
    [invalidate, clock],
  );

  useEffect(() => {
    driver.setMode(mode);
  }, [driver, mode]);

  useFrame(() => driver.onFrame());

  // Tracked views move with the page: repaint when it scrolls or resizes.
  useEffect(() => {
    const repaint = () => driver.request();
    window.addEventListener("scroll", repaint, { passive: true });
    window.addEventListener("resize", repaint, { passive: true });
    return () => {
      window.removeEventListener("scroll", repaint);
      window.removeEventListener("resize", repaint);
      driver.dispose();
    };
  }, [driver]);

  return null;
}

export default function SharedCanvas({ mode }: { mode: RenderMode }) {
  return (
    <Canvas
      aria-hidden
      style={style}
      // The canvas ignores the pointer; scenes receive events through the page.
      eventSource={document.body}
      eventPrefix="client"
      // Fixed on purpose: <Frames> decides when frames are drawn.
      frameloop="demand"
      dpr={dpr}
      gl={gl}
    >
      <View.Port />
      <Frames mode={mode} />
    </Canvas>
  );
}
