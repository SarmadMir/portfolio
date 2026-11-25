"use client";

import { CubeLab } from "./CubeLab";

/**
 * Lab: the boot cube. A prototype to judge in the browser, not production.
 * It answers three questions: does the solve read as motion graphics, does
 * the dolly feel like the Netflix N, does the landing feel seamless.
 */
export default function CubeSlot() {
  return <CubeLab title={<h1 className="font-display text-title-3 text-ink">Cube</h1>} />;
}
