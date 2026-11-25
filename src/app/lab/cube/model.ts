/**
 * The cube as data: 27 cubies, quarter turns, a seeded scramble and its solution.
 * No three, no DOM: both renderers (WebGL and CSS) draw from this.
 *
 * Coordinates are right-handed with y up. A cubie's cell is one of {-1, 0, 1}³.
 */

export type Axis = 0 | 1 | 2;
export type Vec3 = readonly [number, number, number];
/** A rotation as a row-major 3×3 matrix of -1, 0 and 1. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

export interface Move {
  axis: Axis;
  /** Which outer layer along the axis. */
  layer: -1 | 1;
  /** +1 is a quarter turn counter-clockwise seen from the +axis side (right-hand rule). */
  turns: -1 | 1;
}

export interface Cubie {
  /** The cell it belongs to when solved; also what is carved or exposed on it. */
  readonly home: Vec3;
  readonly position: Vec3;
  readonly orientation: Mat3;
}

export const SCRAMBLE_LENGTH = 12;

const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Quarter-turn matrices, by axis, for turns = +1. */
const QUARTER: readonly Mat3[] = [
  [1, 0, 0, 0, 0, -1, 0, 1, 0],
  [0, 0, 1, 0, 1, 0, -1, 0, 0],
  [0, -1, 0, 1, 0, 0, 0, 0, 1],
];

function transpose(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

// `+ 0` turns -0 into 0, so positions and matrices compare cleanly.
function multiply(a: Mat3, b: Mat3): Mat3 {
  const out: number[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      out.push(a[row * 3] * b[column] + a[row * 3 + 1] * b[3 + column] + a[row * 3 + 2] * b[6 + column] + 0);
    }
  }
  return out as unknown as Mat3;
}

function rotate(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + 0,
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2] + 0,
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2] + 0,
  ];
}

/** The rotation a move applies to its layer. */
export function moveMatrix(move: Move): Mat3 {
  return move.turns === 1 ? QUARTER[move.axis] : transpose(QUARTER[move.axis]);
}

export function createCube(): Cubie[] {
  const cubies: Cubie[] = [];
  for (const x of [-1, 0, 1]) {
    for (const y of [-1, 0, 1]) {
      for (const z of [-1, 0, 1]) cubies.push({ home: [x, y, z], position: [x, y, z], orientation: IDENTITY });
    }
  }
  return cubies;
}

export function inLayer(cubie: Cubie, move: Move): boolean {
  return cubie.position[move.axis] === move.layer;
}

/** Returns the cube after the move. Cubies outside the layer keep their identity. */
export function applyMove(cubies: readonly Cubie[], move: Move): Cubie[] {
  const matrix = moveMatrix(move);
  return cubies.map((cubie) =>
    inLayer(cubie, move)
      ? { home: cubie.home, position: rotate(matrix, cubie.position), orientation: multiply(matrix, cubie.orientation) }
      : cubie,
  );
}

export function invert(move: Move): Move {
  return { axis: move.axis, layer: move.layer, turns: move.turns === 1 ? -1 : 1 };
}

export function isSolved(cubies: readonly Cubie[]): boolean {
  return cubies.every(
    (cubie) =>
      cubie.position.every((value, index) => value === cubie.home[index]) &&
      cubie.orientation.every((value, index) => value === IDENTITY[index]),
  );
}

/** mulberry32: a small seeded generator, the same sequence on every machine. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded quarter turns of the six outer layers. Two rules keep every turn
 * visible: never the same layer twice running (that is a half turn or nothing),
 * and never a layer, its opposite, then the first again (the outer two merge).
 */
export function scramble(seed: number, length = SCRAMBLE_LENGTH): Move[] {
  const next = random(seed);
  const moves: Move[] = [];
  while (moves.length < length) {
    const face = Math.floor(next() * 6);
    const move: Move = {
      axis: Math.floor(face / 2) as Axis,
      layer: face % 2 === 0 ? 1 : -1,
      turns: next() < 0.5 ? 1 : -1,
    };
    const last = moves[moves.length - 1];
    const beforeLast = moves[moves.length - 2];
    if (last && last.axis === move.axis && last.layer === move.layer) continue;
    if (last && beforeLast && last.axis === move.axis && beforeLast.axis === move.axis && beforeLast.layer === move.layer) continue;
    moves.push(move);
  }
  return moves;
}

/** The turns that undo a scramble: its inverse, last move first. */
export function solutionFor(scrambleMoves: readonly Move[]): Move[] {
  return scrambleMoves.map(invert).reverse();
}
