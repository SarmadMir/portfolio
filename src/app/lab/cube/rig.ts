import { applyMove, createCube, invert, scramble, solutionFor, type Cubie, type Move } from "./model";
import type { MotionTokens } from "./motion-tokens";
import { initialSequence, stepSequence, targetTurns, type SequenceConfig, type SequenceState } from "./sequence";

export type MotionMode = "full" | "reduced";

/**
 * Everything a renderer needs to draw one frame of the boot cube. One mutable
 * object per run: the lab advances it on the GSAP ticker, the renderers read
 * it in their own frame callbacks. It never goes through React state.
 */
export interface Rig {
  readonly motion: MotionMode;
  readonly tokens: MotionTokens;
  readonly config: SequenceConfig;
  /** The turns that solve the scramble. Empty in reduced motion: the cube starts solved. */
  readonly solution: readonly Move[];
  /** The cube with every finished turn applied. */
  cubies: Cubie[];
  sequence: SequenceState;
  /** The layer in flight and how far it has turned, in radians, eased. */
  turn: { move: Move; angle: number } | null;
  /** Eased progress of the camera's push-in. Stays 0 in reduced motion. */
  dolly: number;
  /** Eased progress of the reduced-motion crossfade. Stays 0 in full motion. */
  fade: number;
  /** False once the DOM mark has taken over from the carved one. */
  markOn: boolean;
  /** Rises whenever something the renderers draw has changed. */
  revision: number;
}

interface RigOptions {
  seed: number;
  motion: MotionMode;
  tokens: MotionTokens;
}

export function createRig({ seed, motion, tokens }: RigOptions): Rig {
  const moves = motion === "full" ? scramble(seed) : [];
  return {
    motion,
    tokens,
    // Turn at duration-base, hold for 240 ms (the same token), dolly or fade at duration-slow.
    config: { total: moves.length, turnMs: tokens.baseMs, holdMs: tokens.baseMs, dollyMs: tokens.slowMs },
    solution: solutionFor(moves),
    cubies: moves.reduce(applyMove, createCube()),
    sequence: initialSequence,
    turn: null,
    dolly: 0,
    fade: 0,
    markOn: true,
    revision: 0,
  };
}

/**
 * Moves the rig forward by `dtMs` with the progress value at `progress` (0–100).
 * Returns whether it is still animating, so the caller knows when frames are needed.
 */
export function advanceRig(rig: Rig, dtMs: number, progress: number): boolean {
  const { config, solution, tokens } = rig;
  const before = rig.sequence;
  const next = stepSequence(before, dtMs, { target: targetTurns(progress, config.total), complete: progress >= 100 }, config);

  if (next !== before) {
    for (let done = before.done; done !== next.done; ) {
      if (next.done > done) {
        rig.cubies = applyMove(rig.cubies, solution[done]);
        done += 1;
      } else {
        rig.cubies = applyMove(rig.cubies, invert(solution[done - 1]));
        done -= 1;
      }
    }
    rig.sequence = next;

    if (next.turn) {
      const move = next.turn.dir === 1 ? solution[next.done] : invert(solution[next.done - 1]);
      rig.turn = { move, angle: move.turns * (Math.PI / 2) * tokens.standard(next.turn.elapsed / config.turnMs) };
    } else {
      rig.turn = null;
    }

    const push = next.phase === "landed" ? 1 : next.phase === "dolly" ? tokens.standard(next.elapsed / config.dollyMs) : 0;
    if (rig.motion === "full") {
      rig.dolly = push;
      rig.revision += 1;
    } else {
      rig.fade = push;
    }
  }

  return next.turn !== null || next.phase === "hold" || next.phase === "dolly";
}
