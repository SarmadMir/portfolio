import { describe, expect, it } from "vitest";
import { isSolved } from "@/app/lab/cube/model";
import type { MotionTokens } from "@/app/lab/cube/motion-tokens";
import { advanceRig, createRig } from "@/app/lab/cube/rig";

const linear = (t: number) => t;
const tokens: MotionTokens = { fastMs: 120, baseMs: 240, slowMs: 480, standard: linear };

describe("the rig, full motion", () => {
  it("starts scrambled, twelve turns from solved, idle", () => {
    const rig = createRig({ seed: 7, motion: "full", tokens });
    expect(rig.solution).toHaveLength(12);
    expect(isSolved(rig.cubies)).toBe(false);
    expect(rig.turn).toBeNull();
    expect(advanceRig(rig, 16, 0)).toBe(false);
  });

  it("takes its durations from the tokens: turn and hold at base, dolly at slow", () => {
    const rig = createRig({ seed: 7, motion: "full", tokens });
    expect(rig.config).toEqual({ total: 12, turnMs: 240, holdMs: 240, dollyMs: 480 });
  });

  it("turns the layer in flight by the eased share of a quarter turn, in the move's direction", () => {
    const rig = createRig({ seed: 7, motion: "full", tokens });
    expect(advanceRig(rig, 120, 100)).toBe(true);
    expect(rig.turn?.move).toEqual(rig.solution[0]);
    expect(rig.turn?.angle).toBeCloseTo((rig.solution[0].turns * Math.PI) / 4, 6);
  });

  it("applies each turn to the cubies as it lands, and is solved after the twelfth", () => {
    const rig = createRig({ seed: 7, motion: "full", tokens });
    const before = rig.cubies;
    advanceRig(rig, 240, 100);
    expect(rig.sequence.done).toBe(1);
    expect(rig.cubies).not.toBe(before);
    advanceRig(rig, 240 * 11, 100);
    expect(isSolved(rig.cubies)).toBe(true);
    expect(rig.turn).toBeNull();
  });

  it("undoes turns when the value falls back", () => {
    const rig = createRig({ seed: 7, motion: "full", tokens });
    const scrambled = rig.cubies;
    advanceRig(rig, 240 * 3, 50);
    advanceRig(rig, 240 * 3, 0);
    expect(rig.sequence.done).toBe(0);
    expect(rig.cubies.map((cubie) => cubie.position)).toEqual(scrambled.map((cubie) => cubie.position));
  });

  it("reports the dolly as eased progress, and stays busy until it lands", () => {
    const rig = createRig({ seed: 7, motion: "full", tokens });
    advanceRig(rig, 240 * 12 + 240, 100); // solved and held
    expect(rig.sequence.phase).toBe("dolly");
    expect(advanceRig(rig, 120, 100)).toBe(true);
    expect(rig.dolly).toBeCloseTo(0.25, 6);
    expect(rig.fade).toBe(0);
    expect(advanceRig(rig, 360, 100)).toBe(false);
    expect(rig.sequence.phase).toBe("landed");
    expect(rig.dolly).toBe(1);
  });

  it("bumps its revision only when what the renderers draw has changed", () => {
    const rig = createRig({ seed: 7, motion: "full", tokens });
    const start = rig.revision;
    advanceRig(rig, 16, 0);
    expect(rig.revision).toBe(start);
    advanceRig(rig, 16, 100);
    expect(rig.revision).toBeGreaterThan(start);
  });
});

describe("the rig, reduced motion", () => {
  it("starts solved with nothing to turn", () => {
    const rig = createRig({ seed: 7, motion: "reduced", tokens });
    expect(rig.solution).toHaveLength(0);
    expect(isSolved(rig.cubies)).toBe(true);
    expect(advanceRig(rig, 1000, 60)).toBe(false);
    expect(rig.sequence.phase).toBe("solving");
  });

  it("fades instead of dollying once the value is complete: the camera never moves", () => {
    const rig = createRig({ seed: 7, motion: "reduced", tokens });
    const revision = rig.revision;
    advanceRig(rig, 240, 100); // the hold
    advanceRig(rig, 240, 100);
    expect(rig.sequence.phase).toBe("dolly");
    expect(rig.fade).toBeCloseTo(0.5, 6);
    expect(rig.dolly).toBe(0);
    expect(rig.revision).toBe(revision);
    advanceRig(rig, 240, 100);
    expect(rig.sequence.phase).toBe("landed");
    expect(rig.fade).toBe(1);
    expect(rig.dolly).toBe(0);
  });
});
