import { describe, expect, it } from "vitest";
import { GRAIN_SIZE, grainBytes } from "@/app/lab/cube/grain";

describe("the grain", () => {
  it("is a small square tile", () => {
    expect(GRAIN_SIZE).toBeLessThanOrEqual(128);
    expect(grainBytes()).toHaveLength(GRAIN_SIZE * GRAIN_SIZE);
  });

  it("is the same on every load", () => {
    expect(grainBytes()).toEqual(grainBytes());
  });

  it("is centred on mid-grey and uses the whole range", () => {
    const bytes = grainBytes();
    const mean = bytes.reduce((sum, value) => sum + value, 0) / bytes.length;
    expect(mean).toBeGreaterThan(118);
    expect(mean).toBeLessThan(138);
    expect(Math.min(...bytes)).toBeLessThan(20);
    expect(Math.max(...bytes)).toBeGreaterThan(235);
  });
});
