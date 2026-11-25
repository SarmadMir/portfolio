import { describe, expect, it } from "vitest";
import { createFrameStats } from "@/app/lab/cube/stats";

describe("frame stats", () => {
  it("counts only frames drawn while the sequence is busy", () => {
    const stats = createFrameStats();
    stats.frame(0, false);
    stats.frame(16, false);
    expect(stats.summary()).toEqual({ frames: 0, averageFps: 0, worstMs: 0 });
  });

  it("reports the average rate and the longest frame of a run", () => {
    const stats = createFrameStats();
    for (let frame = 0; frame <= 60; frame += 1) stats.frame(1000 + frame * (1000 / 60), true);
    const steady = stats.summary();
    expect(steady.frames).toBe(60);
    expect(steady.averageFps).toBeCloseTo(60, 1);
    expect(steady.worstMs).toBeCloseTo(16.67, 1);

    stats.frame(2050, true); // one dropped stretch
    expect(stats.summary().worstMs).toBeCloseTo(50, 1);
  });

  it("does not count the gap between two busy stretches as a frame", () => {
    const stats = createFrameStats();
    stats.frame(0, true);
    stats.frame(16, true);
    stats.frame(32, false);
    stats.frame(5000, true); // first frame of the next stretch
    stats.frame(5016, true);
    expect(stats.summary()).toEqual({ frames: 2, averageFps: 62.5, worstMs: 16 });
  });

  it("keeps the renderer's last counts and starts over on reset", () => {
    const stats = createFrameStats();
    stats.renderer(1, 2916);
    stats.frame(0, true);
    stats.frame(16, true);
    expect(stats.calls).toBe(1);
    expect(stats.triangles).toBe(2916);
    stats.reset();
    expect(stats.summary().frames).toBe(0);
  });
});

describe("frame stats across a pause", () => {
  it("does not count the time the page was hidden as a frame", () => {
    const stats = createFrameStats();
    stats.frame(0, true);
    stats.frame(16, true);
    stats.resume(); // the route was hidden mid-run and shown again
    stats.frame(9000, true);
    stats.frame(9016, true);
    expect(stats.summary()).toEqual({ frames: 2, averageFps: 62.5, worstMs: 16 });
  });
});
