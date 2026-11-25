/**
 * What the page shows for one run, tied to that run. Every run has a new id
 * (Replay, and any change of branch, bump it), so keys never repeat. Keying
 * the view means nothing has to reset it in an effect, and a late update from
 * an older run is dropped.
 */

export type Stage = "boot" | "swap" | "landed";
export type MarkAt = "hidden" | "face" | "slot";

export interface RunView {
  key: string;
  stage: Stage;
  /** Where the page's mark is: not yet shown, over the carved one, or in its slot. */
  markAt: MarkAt;
  /** False once the cube has gone (after the landing). */
  cubeShown: boolean;
  /** The rig is moving, so the canvas draws every frame. */
  animating: boolean;
}

export function runKey(id: number, reduced: boolean, css: boolean): string {
  return `${id}:${reduced ? "reduced" : "full"}:${css ? "css" : "webgl"}`;
}

export function freshView(key: string): RunView {
  return { key, stage: "boot", markAt: "hidden", cubeShown: true, animating: false };
}

/** The view to render for the current run. */
export function viewFor(stored: RunView, key: string): RunView {
  return stored.key === key ? stored : freshView(key);
}

const idOf = (key: string) => Number(key.slice(0, key.indexOf(":")));

/**
 * A run's update. An older run's is dropped; a newer run's starts from its fresh
 * view and is stored even if it changes nothing, so the stored view follows the run.
 */
export function patchView(current: RunView, key: string, patch: Partial<Omit<RunView, "key">>): RunView {
  if (key === current.key) {
    const changed = (Object.keys(patch) as (keyof typeof patch)[]).some((name) => current[name] !== patch[name]);
    return changed ? { ...current, ...patch } : current;
  }
  if (idOf(key) < idOf(current.key)) return current;
  return { ...freshView(key), ...patch };
}
