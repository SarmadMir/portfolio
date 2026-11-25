import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cubicBezier, parseCubicBezier, parseDuration, readMotionTokens } from "@/app/lab/cube/motion-tokens";

describe("durations", () => {
  it("reads ms and s into milliseconds", () => {
    expect(parseDuration("240ms")).toBe(240);
    expect(parseDuration(" 0.48s ")).toBe(480);
  });

  it("rejects anything else", () => {
    expect(() => parseDuration("fast")).toThrow(/duration/);
    expect(() => parseDuration("")).toThrow(/duration/);
  });
});

describe("easings", () => {
  it("reads the four control values of a cubic-bezier()", () => {
    expect(parseCubicBezier("cubic-bezier(0.2, 0, 0, 1)")).toEqual([0.2, 0, 0, 1]);
    expect(parseCubicBezier("cubic-bezier(.34,1.4,.64,1)")).toEqual([0.34, 1.4, 0.64, 1]);
  });

  it("rejects keywords: the tokens are always cubic-bezier()", () => {
    expect(() => parseCubicBezier("ease-in-out")).toThrow(/cubic-bezier/);
  });

  it("starts at 0 and ends at 1", () => {
    const ease = cubicBezier(0.2, 0, 0, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });

  it("is the identity for a linear curve", () => {
    const linear = cubicBezier(0.25, 0.25, 0.75, 0.75);
    for (const t of [0.1, 0.37, 0.5, 0.9]) expect(linear(t)).toBeCloseTo(t, 5);
  });

  it("matches the CSS curve: ease-standard is most of the way there by the midpoint", () => {
    const ease = cubicBezier(0.2, 0, 0, 1);
    // Reference values from the curve itself: x(s) = 0.6s(1-s)² + s³, y(s) = 3s²(1-s) + s³.
    expect(ease(0.2)).toBeCloseTo(0.5, 2); // s = 0.5: x = 0.2, y = 0.5
    expect(ease(0.5)).toBeGreaterThan(0.85);
    for (let t = 0.05; t < 1; t += 0.05) expect(ease(t + 0.05 > 1 ? 1 : t + 0.05)).toBeGreaterThanOrEqual(ease(t));
  });
});

describe("the motion tokens", () => {
  /** The generated stylesheet stands in for getComputedStyle. */
  const css = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");
  const style = {
    getPropertyValue: (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1] ?? "",
  };

  it("are read from the system's variables", () => {
    const tokens = readMotionTokens(style);
    expect(tokens.fastMs).toBe(120);
    expect(tokens.baseMs).toBe(240);
    expect(tokens.slowMs).toBe(480);
    expect(tokens.standard(0)).toBe(0);
    expect(tokens.standard(1)).toBe(1);
    expect(tokens.standard(0.2)).toBeCloseTo(0.5, 2);
  });
});
