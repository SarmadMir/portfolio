import type { LenisOptions } from "lenis";

/**
 * autoRaf is off because the GSAP ticker steps Lenis (see connectLenis): two
 * frame loops would double-step the scroll. lerp 0.11 is the value tuned on
 * the Input2PDF stage: close tracking with a short inertia tail.
 */
export const LENIS_OPTIONS = {
  autoRaf: false,
  lerp: 0.11,
  smoothWheel: true,
} satisfies LenisOptions;

interface ScrollSource {
  on(event: "scroll", handler: () => void): () => void;
  raf(time: number): void;
}

interface Ticker {
  add(callback: (time: number) => void): void;
  remove(callback: (time: number) => void): void;
  lagSmoothing(threshold: number, adjustedLag?: number): void;
}

/**
 * Makes Lenis and GSAP one scroll runtime: Lenis scroll events update
 * ScrollTrigger, and the GSAP ticker is the only frame loop.
 * Returns the disconnect function.
 */
export function connectLenis(lenis: ScrollSource, ticker: Ticker, onScroll: () => void): () => void {
  const stopListening = lenis.on("scroll", onScroll);
  // The ticker reports seconds; Lenis expects milliseconds.
  const step = (time: number) => lenis.raf(time * 1000);
  ticker.add(step);
  // No lag smoothing: a scrubbed timeline must never skip to catch up.
  ticker.lagSmoothing(0);

  return () => {
    ticker.remove(step);
    ticker.lagSmoothing(500, 33); // GSAP's defaults
    stopListening();
  };
}
