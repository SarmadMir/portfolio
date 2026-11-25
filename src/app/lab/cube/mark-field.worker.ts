/// Builds the mark's distance field off the main thread (about 60 ms of work at 1024²).
import type { Mark } from "./mark";
import { fieldFromContext } from "./mark-raster";

interface WorkerScope {
  onmessage: ((event: MessageEvent<{ mark: Mark; size: number }>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
}

const scope = globalThis as unknown as WorkerScope;

scope.onmessage = ({ data: { mark, size } }) => {
  const context = new OffscreenCanvas(size, size).getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("No 2D OffscreenCanvas in this worker.");
  const field = fieldFromContext(context, mark, size);
  scope.postMessage(field, [field.data.buffer]);
};
