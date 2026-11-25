import { inLayer, type Cubie, type Move, type Vec3 } from "./model";

/**
 * 4×4 matrices for the cube, column-major like three.js and CSS matrix3d.
 * Both renderers place cubies with these, so a turn looks the same in each.
 */
export type Mat4 = number[];

const AXES: readonly Vec3[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

/** Right-handed rotation about a unit axis. */
function rotation([x, y, z]: Vec3, angle: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [
    t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0,
    t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0,
    t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0,
    0, 0, 0, 1,
  ];
}

/** Where a cubie is drawn: the turn in flight (if its layer is turning) · its cell · its orientation · its size. */
export function cubieMatrix(cubie: Cubie, turn: { move: Move; angle: number } | null, scale: number): Mat4 {
  const [p, o] = [cubie.position, cubie.orientation];
  // Orientation is row-major; place it column-major, scaled.
  const placed: Mat4 = [
    o[0] * scale, o[3] * scale, o[6] * scale, 0,
    o[1] * scale, o[4] * scale, o[7] * scale, 0,
    o[2] * scale, o[5] * scale, o[8] * scale, 0,
    p[0], p[1], p[2], 1,
  ];
  if (!turn || !inLayer(cubie, turn.move)) return placed;
  return multiply(rotation(AXES[turn.move.axis], turn.angle), placed);
}

/** The cube's pose: yaw about y, then pitch about x. */
export function poseMatrix(yaw: number, pitch: number): Mat4 {
  return multiply(rotation(AXES[0], pitch), rotation(AXES[1], yaw));
}

export function transformPoint(m: Mat4, [x, y, z]: Vec3): Vec3 {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

/** A direction through the rotation part of m, unit length (scale drops out). */
export function transformNormal(m: Mat4, [x, y, z]: Vec3): Vec3 {
  const out: Vec3 = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
  const length = Math.hypot(...out);
  return [out[0] / length, out[1] / length, out[2] / length];
}

const FLIP = [1, -1, 1, 1];
const round = (value: number) => {
  const rounded = Math.round(value * 1e6) / 1e6;
  return rounded === 0 ? 0 : rounded; // no "-0" in the string
};

/** CSS matrix3d for m, in a y-down frame, with translations in pixels. */
export function cssMatrix(m: Mat4, unitPx: number): string {
  const values = m.map((value, index) => {
    const column = Math.floor(index / 4);
    const row = index % 4;
    const flipped = value * FLIP[row] * FLIP[column];
    return round(column === 3 && row < 3 ? flipped * unitPx : flipped);
  });
  return `matrix3d(${values.join(",")})`;
}
