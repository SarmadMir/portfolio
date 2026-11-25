import type { RenderMode } from "./host-state";

/**
 * Decides when the shared canvas is asked for frames, and keeps its clock
 * honest across the gaps.
 *
 * The R3F frameloop itself never changes (it stays "demand"). R3F resets its
 * clock to zero whenever the frameloop prop changes, which would snap every
 * time-driven animation back to its start each time a scene scrolled out of
 * view and back. So this driver asks for the frames instead:
 *   always  a frame at once, then another after every frame
 *   demand  one frame on entry (the static state), then only on request()
 *   never   nothing
 *
 * The clock runs only while frames are being drawn. Once they stop it is
 * paused, so clock.elapsedTime continues where it left off, and the first
 * frame after any pause has a delta of zero instead of the whole pause. That
 * holds whoever asks for the frame: this driver, a scene calling invalidate(),
 * or R3F itself when React re-renders a scene.
 */

/** No frame for this long means the canvas is idle. Longer than any real frame gap. */
const IDLE_MS = 100;

/** The parts of THREE.Clock the driver controls. */
interface PausableClock {
  oldTime: number;
  running: boolean;
  autoStart: boolean;
}

interface FrameDriverDeps<Timer> {
  /** R3F's invalidate for this canvas. */
  invalidate: () => void;
  clock: PausableClock;
  /** performance.now(). */
  now: () => number;
  setTimer: (run: () => void, delay: number) => Timer;
  clearTimer: (timer: Timer) => void;
}

export interface FrameDriver {
  setMode(mode: RenderMode): void;
  /** Call from useFrame, on every frame the canvas draws. */
  onFrame(): void;
  /** One frame now, for things that move tracked views (scroll, resize). */
  request(): void;
  dispose(): void;
}

export function createFrameDriver<Timer>({
  invalidate,
  clock,
  now,
  setTimer,
  clearTimer,
}: FrameDriverDeps<Timer>): FrameDriver {
  let mode: RenderMode = "never";
  let lastFrame = 0;
  let watchdog: Timer | null = null;

  const pauseIfIdle = () => {
    watchdog = null;
    const idleFor = now() - lastFrame;
    if (idleFor < IDLE_MS) {
      watchdog = setTimer(pauseIfIdle, IDLE_MS - idleFor);
      return;
    }
    // A stopped THREE.Clock with autoStart on restarts from zero on its next read.
    clock.autoStart = false;
    clock.running = false;
  };

  return {
    setMode(next) {
      if (next === mode) return;
      mode = next;
      if (next !== "never") invalidate();
    },
    onFrame() {
      // This frame was drawn with the clock paused, so it saw no time pass. Time moves on from here.
      if (!clock.running) {
        clock.oldTime = now();
        clock.running = true;
      }
      lastFrame = now();
      watchdog ??= setTimer(pauseIfIdle, IDLE_MS);
      if (mode === "always") invalidate();
    },
    request() {
      if (mode !== "never") invalidate();
    },
    dispose() {
      if (watchdog !== null) clearTimer(watchdog);
      watchdog = null;
      mode = "never";
    },
  };
}
