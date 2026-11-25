import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { bevelOffset, distanceField, parseMark } from "@/app/lab/cube/mark";

const file = readFileSync(resolve(process.cwd(), "public/lab/mark.svg"), "utf8");

describe("the placeholder mark", () => {
  it("is one path in a square viewBox", () => {
    expect(file.match(/<path\b/g)).toHaveLength(1);
    const mark = parseMark(file);
    expect(mark.viewBox[2]).toBe(mark.viewBox[3]);
    expect(mark.d.startsWith("M")).toBe(true);
  });

  it("carries no colour of its own", () => {
    expect(file).not.toMatch(/fill=|stroke=|style=|#[0-9a-f]{3,8}\b/i);
  });

  it("reaches into all three columns and rows of the face, so every front cubie holds a piece", () => {
    const { d, viewBox } = parseMark(file);
    const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    // The placeholder uses absolute M/H/V/L only; H and V carry one value each.
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [, command, args] of d.matchAll(/([MLHV])([^MLHVZ]*)/g)) {
      const values = args.trim().split(/[\s,]+/).map(Number);
      if (command === "H") xs.push(...values);
      else if (command === "V") ys.push(...values);
      else values.forEach((value, index) => (index % 2 === 0 ? xs : ys).push(value));
    }
    expect(numbers.length).toBeGreaterThan(20);
    const third = viewBox[2] / 3;
    expect(Math.min(...xs)).toBeLessThan(third * 0.6);
    expect(Math.max(...xs)).toBeGreaterThan(third * 2.4);
    expect(Math.min(...ys)).toBeLessThan(third * 0.8);
    expect(Math.max(...ys)).toBeGreaterThan(third * 2.2);
  });
});

describe("parsing a mark", () => {
  it("reads the viewBox and the first path", () => {
    const mark = parseMark('<svg viewBox="0 0 24 24"><path fill="red" d="M1 2L3 4Z"/><path d="M0 0"/></svg>');
    expect(mark).toEqual({ d: "M1 2L3 4Z", viewBox: [0, 0, 24, 24] });
  });

  it("says what is missing", () => {
    expect(() => parseMark("<svg><path d='M0 0'/></svg>")).toThrow(/viewBox/);
    expect(() => parseMark('<svg viewBox="0 0 1 1"></svg>')).toThrow(/path/);
  });
});

describe("the distance field", () => {
  // An 8×8 coverage grid with a filled 4×4 square in the middle.
  const size = 8;
  const alpha = new Uint8ClampedArray(size * size);
  for (let y = 2; y < 6; y += 1) for (let x = 2; x < 6; x += 1) alpha[y * size + x] = 255;
  const field = distanceField(alpha, size, size, 4);
  const at = (x: number, y: number) => field[y * size + x];

  it("is above the midpoint inside the shape and below it outside", () => {
    expect(at(3, 3)).toBeGreaterThan(128);
    expect(at(2, 2)).toBeGreaterThan(128);
    expect(at(1, 3)).toBeLessThan(128);
    expect(at(0, 0)).toBeLessThan(128);
  });

  it("grows with depth inside and falls with distance outside", () => {
    expect(at(3, 3)).toBeGreaterThan(at(2, 3));
    expect(at(0, 3)).toBeLessThan(at(1, 3));
  });

  it("is symmetric for a symmetric shape", () => {
    expect(at(1, 3)).toBe(at(6, 4));
    expect(at(3, 1)).toBe(at(4, 6));
  });
});

describe("the bevel", () => {
  const light: [number, number, number] = [-0.58, 0.3, 0.76];

  it("offsets the lit edge away from the light, in screen space", () => {
    const [x, y] = bevelOffset(light, 10);
    expect(x).toBeGreaterThan(0); // light on the left: the far edge is on the right
    expect(y).toBeGreaterThan(0); // light above: the far edge is below (screen y runs down)
    expect(Math.hypot(x, y)).toBeCloseTo(10, 6);
  });
});
