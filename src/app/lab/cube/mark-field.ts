"use client";

import type { Mark } from "./mark";
import { fieldFromContext, type MarkField } from "./mark-raster";

/** Texels across the mark's distance field. The face is at most ~1500 px wide when it lands. */
export const FIELD_SIZE = 1024;

function onMainThread(mark: Mark, size: number): MarkField {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("No 2D canvas for the mark's distance field.");
  return fieldFromContext(context, mark, size);
}

/**
 * The mark's distance field for the shader, built in a worker so the boot's
 * main thread stays free. Falls back to the main thread where a worker cannot
 * draw (no OffscreenCanvas) or fails. Rejects if both fail; aborting stops the worker.
 * (Turbopack ships the worker as a same-origin classic script, which the CSP's 'self' allows.)
 */
export function computeMarkField(mark: Mark, signal: AbortSignal, size = FIELD_SIZE): Promise<MarkField> {
  if (typeof OffscreenCanvas === "undefined" || typeof Worker === "undefined") {
    return new Promise((resolve) => resolve(onMainThread(mark, size)));
  }
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./mark-field.worker.ts", import.meta.url), { type: "module" });
    } catch {
      // Some engines refuse the worker outright (a blocked origin, a stricter CSP).
      try {
        resolve(onMainThread(mark, size));
      } catch (error) {
        reject(error);
      }
      return;
    }
    const stop = () => {
      worker.terminate();
      reject(new DOMException("The mark's distance field was not needed any more.", "AbortError"));
    };
    signal.addEventListener("abort", stop, { once: true });
    const settle = (build: () => MarkField) => {
      signal.removeEventListener("abort", stop);
      worker.terminate();
      try {
        resolve(build());
      } catch (error) {
        reject(error);
      }
    };
    worker.onmessage = (event: MessageEvent<MarkField>) => settle(() => event.data);
    worker.onerror = (event) => {
      event.preventDefault();
      settle(() => onMainThread(mark, size));
    };
    worker.postMessage({ mark, size });
  });
}
