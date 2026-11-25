import { describe, expect, it } from "vitest";
import { freshView, patchView, runKey, viewFor } from "@/app/lab/cube/run-view";

describe("the run's view", () => {
  it("is keyed by the run and both branches", () => {
    expect(runKey(3, false, false)).not.toBe(runKey(3, true, false));
    expect(runKey(3, false, false)).not.toBe(runKey(3, false, true));
    expect(runKey(3, false, false)).not.toBe(runKey(4, false, false));
    expect(runKey(3, false, false)).toBe(runKey(3, false, false));
  });

  it("starts at the scrambled cube: boot, no mark, cube shown, not animating", () => {
    const key = runKey(0, false, false);
    expect(freshView(key)).toEqual({ key, stage: "boot", markAt: "hidden", cubeShown: true, animating: false });
  });

  it("reads as fresh for a new run, whatever the last run left behind", () => {
    const [a, b] = [runKey(0, false, false), runKey(1, false, false)];
    const landed = { ...freshView(a), stage: "landed" as const, markAt: "slot" as const, cubeShown: false, animating: true };
    expect(viewFor(landed, a)).toBe(landed);
    expect(viewFor(landed, b)).toEqual(freshView(b));
  });

  it("ignores a late update from an older run: the newer run keeps its state", () => {
    const current = { ...freshView(runKey(2, false, false)), stage: "swap" as const };
    expect(patchView(current, runKey(1, false, false), { stage: "landed", cubeShown: false })).toBe(current);
    expect(patchView(current, current.key, { animating: true })).toEqual({ ...current, animating: true });
  });

  it("moves to a newer run on its first update, even one that changes nothing from fresh", () => {
    const landed = { ...freshView(runKey(1, false, false)), stage: "landed" as const, markAt: "slot" as const, cubeShown: false };
    const next = runKey(2, false, false);
    expect(patchView(landed, next, { animating: false })).toEqual(freshView(next));
  });

  it("keeps the same object when a patch to the same run changes nothing", () => {
    const current = freshView(runKey(0, false, false));
    expect(patchView(current, current.key, { animating: false })).toBe(current);
  });
});
