/**
 * What the lab logs about a run: frames drawn while the sequence was moving,
 * and the renderer's draw calls. A renderer feeds it once per drawn frame.
 */
export interface FrameStats {
  /** Draw calls of the last rendered frame. */
  readonly calls: number;
  readonly triangles: number;
  /** Call once per drawn frame with the time in ms and whether the sequence is moving. */
  frame(nowMs: number, busy: boolean): void;
  renderer(calls: number, triangles: number): void;
  summary(): { frames: number; averageFps: number; worstMs: number };
  /** The page was hidden: the next frame starts a new stretch instead of closing one across the gap. */
  resume(): void;
  reset(): void;
}

export function createFrameStats(): FrameStats {
  let calls = 0;
  let triangles = 0;
  let frames = 0;
  let totalMs = 0;
  let worstMs = 0;
  /** Time of the previous frame, when it was a busy one. */
  let previous: number | null = null;

  return {
    get calls() {
      return calls;
    },
    get triangles() {
      return triangles;
    },
    frame(nowMs, busy) {
      if (busy && previous !== null) {
        const delta = nowMs - previous;
        frames += 1;
        totalMs += delta;
        worstMs = Math.max(worstMs, delta);
      }
      previous = busy ? nowMs : null;
    },
    renderer(nextCalls, nextTriangles) {
      calls = nextCalls;
      triangles = nextTriangles;
    },
    summary() {
      return { frames, averageFps: totalMs > 0 ? (frames * 1000) / totalMs : 0, worstMs };
    },
    resume() {
      previous = null;
    },
    reset() {
      frames = 0;
      totalMs = 0;
      worstMs = 0;
      previous = null;
    },
  };
}
