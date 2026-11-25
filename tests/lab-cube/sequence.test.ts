import { describe, expect, it } from "vitest";
import { initialSequence, stepSequence, targetTurns, type SequenceConfig, type SequenceState } from "@/app/lab/cube/sequence";

const config: SequenceConfig = { total: 12, turnMs: 240, holdMs: 240, dollyMs: 480 };

/** Runs the sequence in 16 ms frames with a fixed input. */
function run(state: SequenceState, ms: number, target: number, complete = target === config.total, cfg = config) {
  let next = state;
  for (let elapsed = 0; elapsed < ms; elapsed += 16) next = stepSequence(next, 16, { target, complete }, cfg);
  return next;
}

describe("progress to turns", () => {
  it("maps 0–100 onto the turns, reaching the last only at 100", () => {
    expect(targetTurns(0, 12)).toBe(0);
    expect(targetTurns(8.3, 12)).toBe(0);
    expect(targetTurns(8.4, 12)).toBe(1);
    expect(targetTurns(50, 12)).toBe(6);
    expect(targetTurns(99.9, 12)).toBe(11);
    expect(targetTurns(100, 12)).toBe(12);
  });

  it("clamps values outside 0–100", () => {
    expect(targetTurns(-5, 12)).toBe(0);
    expect(targetTurns(140, 12)).toBe(12);
  });
});

describe("the solve", () => {
  it("waits while the value has not reached the next turn", () => {
    const state = run(initialSequence, 1000, 0);
    expect(state).toEqual(initialSequence);
  });

  it("plays one turn at a time, each for the turn duration", () => {
    let state = stepSequence(initialSequence, 16, { target: 3, complete: false }, config);
    expect(state.turn).toEqual({ dir: 1, elapsed: 16 });
    expect(state.done).toBe(0);

    state = run(state, 224, 3); // 240 ms in total: the first turn has just finished
    expect(state.done).toBe(1);

    state = run(state, 240, 3);
    expect(state.done).toBe(2);
  });

  it("keeps exact time across turns whatever the frame length", () => {
    // One 600 ms step is two and a half turns.
    const state = stepSequence(initialSequence, 600, { target: 12, complete: true }, config);
    expect(state.done).toBe(2);
    expect(state.turn).toEqual({ dir: 1, elapsed: 120 });
  });

  it("stops at the target and resumes when it rises", () => {
    let state = run(initialSequence, 2000, 2);
    expect(state.done).toBe(2);
    expect(state.turn).toBeNull();
    state = run(state, 240, 3);
    expect(state.done).toBe(3);
  });

  it("turns back when the value falls, after finishing the turn in flight", () => {
    let state = run(initialSequence, 240 * 3 + 112, 5); // three done, the fourth in flight
    expect(state.done).toBe(3);
    expect(state.turn?.dir).toBe(1);

    state = run(state, 128, 1); // the fourth lands first
    expect(state.done).toBe(4);
    state = stepSequence(state, 16, { target: 1, complete: false }, config);
    expect(state.turn).toEqual({ dir: -1, elapsed: 16 });
    state = run(state, 240 * 3, 1);
    expect(state.done).toBe(1);
    expect(state.turn).toBeNull();
  });
});

describe("after the solve", () => {
  const solved = () => run(initialSequence, 240 * 12, 12);

  it("holds, then dollies, then lands", () => {
    let state = solved();
    expect(state.done).toBe(12);
    state = stepSequence(state, 16, { target: 12, complete: true }, config);
    expect(state.phase).toBe("hold");

    state = run(state, 224, 12); // 240 ms of hold
    expect(state.phase).toBe("dolly");
    expect(state.elapsed).toBe(0);

    state = run(state, 240, 12);
    expect(state.phase).toBe("dolly");
    expect(state.elapsed).toBe(240);

    state = run(state, 240, 12);
    expect(state.phase).toBe("landed");
  });

  it("does not start until the value is complete", () => {
    const state = run(solved(), 1000, 12, false);
    expect(state.phase).toBe("solving");
  });

  it("is locked once the hold begins: a falling value no longer turns the cube", () => {
    let state = stepSequence(solved(), 16, { target: 12, complete: true }, config);
    state = run(state, 2000, 0, false);
    expect(state.phase).toBe("landed");
    expect(state.done).toBe(12);
  });

  it("runs straight to the hold when there are no turns to play (the reduced-motion branch)", () => {
    const still: SequenceConfig = { ...config, total: 0 };
    expect(run(initialSequence, 1000, 0, false, still).phase).toBe("solving");
    expect(stepSequence(initialSequence, 16, { target: 0, complete: true }, still).phase).toBe("hold");
  });
});
