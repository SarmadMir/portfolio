import { describe, expect, it } from "vitest";
import { LENIS_OPTIONS, connectLenis } from "@/lib/motion/lenis";

function fakes() {
  const scrollHandlers = new Set<() => void>();
  const tickers = new Set<(time: number) => void>();
  const rafCalls: number[] = [];
  const lagSmoothing: number[][] = [];
  const lenis = {
    on: (_event: "scroll", handler: () => void) => {
      scrollHandlers.add(handler);
      return () => void scrollHandlers.delete(handler);
    },
    raf: (time: number) => void rafCalls.push(time),
  };
  const ticker = {
    add: (callback: (time: number) => void) => void tickers.add(callback),
    remove: (callback: (time: number) => void) => void tickers.delete(callback),
    lagSmoothing: (...args: number[]) => void lagSmoothing.push(args),
  };
  return { lenis, ticker, scrollHandlers, tickers, rafCalls, lagSmoothing };
}

describe("connectLenis", () => {
  it("updates ScrollTrigger on every Lenis scroll event", () => {
    const { lenis, ticker, scrollHandlers } = fakes();
    const update = () => {};
    connectLenis(lenis, ticker, update);
    expect([...scrollHandlers]).toEqual([update]);
  });

  it("steps Lenis from the GSAP ticker, in milliseconds", () => {
    const { lenis, ticker, tickers, rafCalls } = fakes();
    connectLenis(lenis, ticker, () => {});
    expect(tickers.size).toBe(1);
    for (const tick of tickers) tick(1.5);
    expect(rafCalls).toEqual([1500]);
  });

  it("turns off lag smoothing so scrubbed timelines never jump", () => {
    const { lenis, ticker, lagSmoothing } = fakes();
    connectLenis(lenis, ticker, () => {});
    expect(lagSmoothing).toEqual([[0]]);
  });

  it("disconnects cleanly: no ticker callback, no scroll listener, GSAP's default lag smoothing back", () => {
    const { lenis, ticker, scrollHandlers, tickers, lagSmoothing } = fakes();
    const disconnect = connectLenis(lenis, ticker, () => {});
    disconnect();
    expect(tickers.size).toBe(0);
    expect(scrollHandlers.size).toBe(0);
    expect(lagSmoothing.at(-1)).toEqual([500, 33]);
  });
});

describe("LENIS_OPTIONS", () => {
  it("leaves the frame loop to the GSAP ticker (one scroll runtime, one rAF)", () => {
    expect(LENIS_OPTIONS.autoRaf).toBe(false);
  });
});
