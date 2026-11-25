import { distanceField, type Mark } from "./mark";

/** Any 2D context: the page's canvas or a worker's OffscreenCanvas. */
type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface MarkField {
  /** One byte per texel, 128 on the edge, row 0 at the top of the mark. */
  data: Uint8Array;
  size: number;
}

/** Rasterises the mark's path into `context` (size × size) and turns its coverage into a distance field. */
export function fieldFromContext(context: Context2D, mark: Mark, size: number): MarkField {
  const [x, y, width, height] = mark.viewBox;
  context.setTransform(size / width, 0, 0, size / height, (-x * size) / width, (-y * size) / height);
  context.fill(new Path2D(mark.d));
  const rgba = context.getImageData(0, 0, size, size).data;
  const alpha = new Uint8ClampedArray(size * size);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = rgba[i * 4 + 3];
  return { data: distanceField(alpha, size, size, size / 64), size };
}
