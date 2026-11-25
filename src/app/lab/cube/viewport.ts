"use client";

import { useSyncExternalStore } from "react";
import type { Stage } from "./framing";

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

// A string snapshot, so React sees a change only when a dimension does.
const read = () => `${window.innerWidth}x${window.innerHeight}`;
/** The server renders for the 1440 desktop; the client corrects it on hydration. */
const serverSnapshot = () => "1440x900";

/** The viewport, which is the boot's stage. */
export function useViewport(): Stage {
  const [width, height] = useSyncExternalStore(subscribe, read, serverSnapshot).split("x").map(Number);
  return { width, height };
}
