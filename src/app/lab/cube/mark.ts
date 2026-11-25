/**
 * The mark carved on the front face. It arrives as one SVG path
 * (/lab/mark.svg) and is used twice: as a distance field the shader carves
 * into the stone, and as the DOM mark that lands in the page.
 */

export interface Mark {
  /** The path data. */
  d: string;
  /** The viewBox, which is the whole front face of the cube. */
  viewBox: [x: number, y: number, width: number, height: number];
}

export function parseMark(svg: string): Mark {
  const viewBox = /\bviewBox\s*=\s*["']([^"']+)["']/.exec(svg)?.[1].trim().split(/[\s,]+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox.some(Number.isNaN)) throw new Error("The mark needs a viewBox.");
  const d = /<path\b[^>]*?\sd\s*=\s*["']([^"']+)["']/.exec(svg)?.[1].trim();
  if (!d) throw new Error("The mark needs a path with a d attribute.");
  return { d, viewBox: viewBox as Mark["viewBox"] };
}

const FAR = 1e20;

/** Felzenszwalb and Huttenlocher's squared distance transform, one row or column at a time. */
function transform1d(grid: Float64Array, offset: number, stride: number, length: number, f: Float64Array, v: Uint16Array, z: Float64Array) {
  v[0] = 0;
  z[0] = -FAR;
  z[1] = FAR;
  f[0] = grid[offset];
  for (let q = 1, k = 0, s = 0; q < length; q += 1) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = FAR;
  }
  for (let q = 0, k = 0; q < length; q += 1) {
    while (z[k + 1] < q) k += 1;
    const r = v[k];
    grid[offset + q * stride] = f[r] + (q - r) * (q - r);
  }
}

function transform2d(grid: Float64Array, width: number, height: number) {
  const longest = Math.max(width, height);
  const f = new Float64Array(longest);
  const v = new Uint16Array(longest);
  const z = new Float64Array(longest + 1);
  for (let x = 0; x < width; x += 1) transform1d(grid, x, width, height, f, v, z);
  for (let y = 0; y < height; y += 1) transform1d(grid, y * width, 1, width, f, v, z);
}

/**
 * Coverage (0–255 per pixel) to a signed distance field, one byte per pixel:
 * 128 on the edge, higher inside, lower outside, `radius` pixels to either end.
 * Partly covered pixels place the edge inside the pixel, so the field is
 * smoother than the raster it came from and stays sharp when magnified.
 */
export function distanceField(alpha: ArrayLike<number>, width: number, height: number, radius: number): Uint8Array {
  const outer = new Float64Array(width * height);
  const inner = new Float64Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const coverage = alpha[i] / 255;
    if (coverage >= 1) {
      outer[i] = 0;
      inner[i] = FAR;
    } else if (coverage <= 0) {
      outer[i] = FAR;
      inner[i] = 0;
    } else {
      const d = 0.5 - coverage;
      outer[i] = d > 0 ? d * d : 0;
      inner[i] = d < 0 ? d * d : 0;
    }
  }
  transform2d(outer, width, height);
  transform2d(inner, width, height);

  const field = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const signed = Math.sqrt(inner[i]) - Math.sqrt(outer[i]);
    field[i] = Math.round(255 * Math.min(1, Math.max(0, 0.5 + signed / (2 * radius))));
  }
  return field;
}

/**
 * Where the lit edge of the carving sits relative to the shape, in screen
 * pixels (y down): a copy of the shape pushed away from the light. The same
 * offset, in texture space, is what the shader samples.
 * `light` is the direction to the key light, seen with the face square to the camera.
 */
export function bevelOffset(light: readonly [number, number, number], widthPx: number): [x: number, y: number] {
  const length = Math.hypot(light[0], light[1]);
  if (length === 0) return [0, 0];
  return [(-light[0] / length) * widthPx, (light[1] / length) * widthPx];
}
