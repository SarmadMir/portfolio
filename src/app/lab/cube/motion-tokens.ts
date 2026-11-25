/**
 * The system's motion tokens as numbers and functions, for animation that
 * runs in JavaScript (the cube's turns and dolly). Values are read from the
 * CSS variables at runtime: nothing here repeats a token.
 */

export type Ease = (t: number) => number;

export interface MotionTokens {
  fastMs: number;
  baseMs: number;
  slowMs: number;
  standard: Ease;
}

/** "240ms" or "0.48s" to milliseconds. */
export function parseDuration(value: string): number {
  const match = /^\s*(-?\d*\.?\d+)(ms|s)\s*$/.exec(value);
  if (!match) throw new Error(`Not a duration: "${value}"`);
  return Number(match[1]) * (match[2] === "s" ? 1000 : 1);
}

/** "cubic-bezier(x1, y1, x2, y2)" to its four numbers. */
export function parseCubicBezier(value: string): [number, number, number, number] {
  const match = /^\s*cubic-bezier\(([^)]+)\)\s*$/.exec(value);
  const numbers = match?.[1].split(",").map((part) => Number(part.trim()));
  if (!numbers || numbers.length !== 4 || numbers.some(Number.isNaN)) throw new Error(`Not a cubic-bezier(): "${value}"`);
  return numbers as [number, number, number, number];
}

/** The CSS cubic-bezier timing function: progress in time to progress in value. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const curve = (a: number, b: number, s: number) => {
    const inverse = 1 - s;
    return 3 * a * s * inverse * inverse + 3 * b * s * s * inverse + s * s * s;
  };
  const slope = (a: number, b: number, s: number) => {
    const inverse = 1 - s;
    return 3 * a * inverse * inverse + 6 * (b - a) * s * inverse + 3 * (1 - b) * s * s;
  };

  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // Solve x(s) = t: Newton first, bisection when the slope is too flat to trust.
    let s = t;
    for (let i = 0; i < 8; i += 1) {
      const error = curve(x1, x2, s) - t;
      if (Math.abs(error) < 1e-7) return curve(y1, y2, s);
      const d = slope(x1, x2, s);
      if (Math.abs(d) < 1e-6) break;
      s -= error / d;
    }
    let low = 0;
    let high = 1;
    s = t;
    for (let i = 0; i < 40; i += 1) {
      const x = curve(x1, x2, s);
      if (Math.abs(x - t) < 1e-7) break;
      if (x < t) low = s;
      else high = s;
      s = (low + high) / 2;
    }
    return curve(y1, y2, s);
  };
}

/** Pass getComputedStyle(document.documentElement). */
export function readMotionTokens(style: Pick<CSSStyleDeclaration, "getPropertyValue">): MotionTokens {
  return {
    fastMs: parseDuration(style.getPropertyValue("--duration-fast")),
    baseMs: parseDuration(style.getPropertyValue("--duration-base")),
    slowMs: parseDuration(style.getPropertyValue("--duration-slow")),
    standard: cubicBezier(...parseCubicBezier(style.getPropertyValue("--ease-standard"))),
  };
}
