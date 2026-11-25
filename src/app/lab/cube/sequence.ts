/**
 * The boot sequence as a pure state machine, advanced by elapsed time:
 *
 *   solving  turns play one at a time towards the target the progress value sets
 *   hold     the solved cube rests
 *   dolly    the camera pushes in (the reduced-motion branch crossfades instead)
 *   landed   the page takes over
 *
 * Time left over when a turn or a phase ends carries into the next, so twelve
 * turns take exactly twelve turn durations at any frame rate.
 */

export type Phase = "solving" | "hold" | "dolly" | "landed";

export interface SequenceConfig {
  /** Turns in the solution. Zero when the cube starts solved (reduced motion). */
  total: number;
  turnMs: number;
  holdMs: number;
  dollyMs: number;
}

export interface SequenceState {
  phase: Phase;
  /** Turns of the solution already applied. */
  done: number;
  /** The turn in flight: +1 plays solution[done], -1 undoes solution[done - 1]. */
  turn: { dir: 1 | -1; elapsed: number } | null;
  /** Milliseconds into the hold or the dolly. */
  elapsed: number;
}

export interface SequenceInput {
  /** How many turns the progress value asks for. */
  target: number;
  /** The progress value has reached 100. */
  complete: boolean;
}

export const initialSequence: SequenceState = { phase: "solving", done: 0, turn: null, elapsed: 0 };

/** 0–100 onto 0–total turns. The last turn waits for 100. */
export function targetTurns(progress: number, total: number): number {
  const clamped = Math.min(100, Math.max(0, progress));
  return Math.min(total, Math.floor((clamped / 100) * total + 1e-6));
}

export function stepSequence(state: SequenceState, dtMs: number, input: SequenceInput, config: SequenceConfig): SequenceState {
  let { phase, done, turn, elapsed } = state;
  let dt = dtMs;

  while (dt > 0 && phase !== "landed") {
    if (phase === "solving") {
      if (turn) {
        const used = Math.min(dt, config.turnMs - turn.elapsed);
        dt -= used;
        if (turn.elapsed + used >= config.turnMs) {
          done += turn.dir;
          turn = null;
        } else {
          turn = { dir: turn.dir, elapsed: turn.elapsed + used };
        }
      } else if (input.target > done) {
        turn = { dir: 1, elapsed: 0 };
      } else if (input.target < done) {
        turn = { dir: -1, elapsed: 0 };
      } else if (input.complete && done === config.total) {
        phase = "hold";
        elapsed = 0;
      } else {
        break; // waiting for the value to rise
      }
      continue;
    }

    const length = phase === "hold" ? config.holdMs : config.dollyMs;
    const used = Math.min(dt, length - elapsed);
    dt -= used;
    elapsed += used;
    if (elapsed >= length) {
      phase = phase === "hold" ? "dolly" : "landed";
      elapsed = 0;
    }
  }

  if (phase === state.phase && done === state.done && turn === state.turn && elapsed === state.elapsed) return state;
  return { phase, done, turn, elapsed };
}
