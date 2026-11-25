import { describe, expect, it } from "vitest";
import { createFrameDriver } from "@/lib/three/frame-driver";

/** A fake page: a clock like THREE.Clock, a wall clock, and timers the test advances by hand. */
function setup() {
  const world = {
    now: 1_000,
    invalidations: 0,
    clock: { oldTime: 1_000, running: true, autoStart: true },
  };
  const timers = new Map<number, { at: number; run: () => void }>();
  let nextTimer = 1;

  const driver = createFrameDriver({
    invalidate: () => void (world.invalidations += 1),
    clock: world.clock,
    now: () => world.now,
    setTimer: (run, delay) => {
      timers.set(nextTimer, { at: world.now + delay, run });
      return nextTimer++;
    },
    clearTimer: (id) => void timers.delete(id),
  });

  /** Moves the wall clock forward, firing timers as they fall due. */
  const advance = (ms: number) => {
    const end = world.now + ms;
    for (;;) {
      const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      world.now = due[1].at;
      due[1].run();
    }
    world.now = end;
  };
  /** Draws frames 16 ms apart for the given time. */
  const animate = (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 16) {
      advance(16);
      driver.onFrame();
    }
  };

  return { world, driver, advance, animate, pendingTimers: () => timers.size };
}

describe("frame driver: when frames are asked for", () => {
  it("always: draws at once and asks for the next frame after every frame", () => {
    const { world, driver } = setup();
    driver.setMode("always");
    expect(world.invalidations).toBe(1);
    driver.onFrame();
    driver.onFrame();
    expect(world.invalidations).toBe(3);
  });

  it("never: stops asking, so the loop winds down", () => {
    const { world, driver } = setup();
    driver.setMode("always");
    driver.setMode("never");
    const before = world.invalidations;
    driver.onFrame();
    expect(world.invalidations).toBe(before);
  });

  it("demand: draws the static state once on entry and then waits", () => {
    const { world, driver } = setup();
    driver.setMode("demand");
    expect(world.invalidations).toBe(1);
    driver.onFrame();
    expect(world.invalidations).toBe(1);
  });

  it("request() draws one frame, except when nothing is in view", () => {
    const { world, driver } = setup();
    driver.request();
    expect(world.invalidations).toBe(0);
    driver.setMode("demand");
    driver.request();
    expect(world.invalidations).toBe(2);
  });

  it("setting the same mode again does nothing", () => {
    const { world, driver } = setup();
    driver.setMode("demand");
    driver.setMode("demand");
    expect(world.invalidations).toBe(1);
  });
});

describe("frame driver: the clock only runs while frames are drawn", () => {
  it("keeps the clock running across consecutive frames", () => {
    const { world, driver, animate } = setup();
    driver.setMode("always");
    animate(400);
    expect(world.clock.running).toBe(true);
  });

  it("pauses the clock once frames stop, so time out of view is never counted", () => {
    const { world, driver, animate, advance } = setup();
    driver.setMode("always");
    animate(200);
    driver.setMode("never");
    advance(150);
    expect(world.clock.running).toBe(false);
    // THREE.Clock restarts from zero when autoStart is on and it is not running.
    expect(world.clock.autoStart).toBe(false);
  });

  it("the first frame after a pause restarts time from that frame, whoever asked for it", () => {
    const { world, driver, animate, advance } = setup();
    driver.setMode("demand");
    animate(48);
    advance(8_000); // idle: React re-renders a scene and R3F draws a frame by itself
    expect(world.clock.running).toBe(false);

    driver.onFrame();

    expect(world.clock.running).toBe(true);
    expect(world.clock.oldTime).toBe(world.now);
  });

  it("does not pause in the middle of a slow frame sequence", () => {
    const { world, driver, advance } = setup();
    driver.setMode("always");
    for (let frame = 0; frame < 10; frame += 1) {
      advance(60); // 16 fps: slow, but still animating
      driver.onFrame();
      expect(world.clock.running).toBe(true);
    }
  });

  it("dispose() leaves no timer behind and stops asking for frames", () => {
    const { world, driver, animate, advance, pendingTimers } = setup();
    driver.setMode("always");
    animate(64);
    driver.dispose();
    expect(pendingTimers()).toBe(0);
    const before = world.invalidations;
    advance(500);
    driver.onFrame();
    expect(world.invalidations).toBe(before);
  });
});
