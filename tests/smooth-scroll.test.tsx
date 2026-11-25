// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SmoothScroll, useLenis } from "@/lib/motion/SmoothScroll";

interface FakeLenisInstance {
  destroyed: boolean;
}
const lenis = vi.hoisted(() => ({ instances: [] as { destroyed: boolean }[] }));

vi.mock("lenis", () => ({
  default: class FakeLenis {
    destroyed = false;
    constructor() {
      lenis.instances.push(this);
    }
    on() {
      return () => {};
    }
    raf() {}
    destroy() {
      this.destroyed = true;
    }
  },
}));

let reducedMotion = false;
const motionListeners = new Set<() => void>();
function setReducedMotion(next: boolean) {
  reducedMotion = next;
  for (const notify of motionListeners) notify();
}

/** What a consumer's effect was handed, in order. A boot loader stopping the scroll looks like this. */
let seenInEffect: (FakeLenisInstance | null)[] = [];
function Consumer() {
  const instance = useLenis() as unknown as FakeLenisInstance | null;
  useEffect(() => {
    seenInEffect.push(instance);
  }, [instance]);
  return null;
}

beforeEach(() => {
  lenis.instances.length = 0;
  seenInEffect = [];
  reducedMotion = false;
  motionListeners.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === "(prefers-reduced-motion: reduce)" ? reducedMotion : false;
    },
    addEventListener: (_: "change", listener: () => void) => void motionListeners.add(listener),
    removeEventListener: (_: "change", listener: () => void) => void motionListeners.delete(listener),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SmoothScroll + useLenis", () => {
  it("hands the instance to a consumer's effect, although that effect first runs before Lenis exists", () => {
    render(
      <SmoothScroll>
        <Consumer />
      </SmoothScroll>,
    );
    expect(lenis.instances).toHaveLength(1);
    expect(seenInEffect.at(-1)).toBe(lenis.instances[0]);
  });

  it("creates no Lenis under reduced motion", () => {
    reducedMotion = true;
    render(
      <SmoothScroll>
        <Consumer />
      </SmoothScroll>,
    );
    expect(lenis.instances).toHaveLength(0);
    expect(seenInEffect).toEqual([null]);
  });

  it("tells consumers when reduced motion turns Lenis off and on again", () => {
    render(
      <SmoothScroll>
        <Consumer />
      </SmoothScroll>,
    );
    const first = lenis.instances[0];

    act(() => setReducedMotion(true));
    expect(first.destroyed).toBe(true);
    expect(seenInEffect.at(-1)).toBeNull();

    act(() => setReducedMotion(false));
    expect(lenis.instances).toHaveLength(2);
    expect(seenInEffect.at(-1)).toBe(lenis.instances[1]);
  });

  it("destroys Lenis when the provider unmounts", () => {
    const { unmount } = render(
      <SmoothScroll>
        <Consumer />
      </SmoothScroll>,
    );
    unmount();
    expect(lenis.instances[0].destroyed).toBe(true);
  });
});
