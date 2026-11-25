// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasHost, useSharedCanvas } from "@/lib/three/CanvasHost";
import type { LoopMode } from "@/lib/three/host-state";

/** Counts real mounts of the (mocked) canvas: a second mount means the WebGL context was rebuilt. */
const canvas = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));

vi.mock("@/lib/three/SharedCanvas", async () => {
  const { useEffect } = await import("react");
  return {
    default: function FakeCanvas({ mode }: { mode: string }) {
      useEffect(() => {
        canvas.mounts += 1;
        return () => void (canvas.unmounts += 1);
      }, []);
      return <div data-testid="canvas" data-mode={mode} />;
    },
  };
});

/** An IntersectionObserver the test drives by hand. */
class FakeObserver {
  static current: FakeObserver | null = null;
  readonly observed = new Set<Element>();
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeObserver.current = this;
  }
  observe(element: Element) {
    this.observed.add(element);
  }
  unobserve(element: Element) {
    this.observed.delete(element);
  }
  disconnect() {
    this.observed.clear();
  }
  report(element: Element, isIntersecting: boolean) {
    this.callback([{ target: element, isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

let reducedMotion = false;
const motionListeners = new Set<() => void>();

function Scene({ loop }: { loop: LoopMode }) {
  const ref = useRef<HTMLDivElement>(null);
  useSharedCanvas(ref, loop);
  return <div ref={ref} data-testid="scene" />;
}

function Page() {
  const [loop, setLoop] = useState<LoopMode>("always");
  const [shown, setShown] = useState(true);
  return (
    <CanvasHost>
      {shown ? <Scene loop={loop} /> : null}
      <button onClick={() => setLoop((current) => (current === "always" ? "demand" : "always"))}>switch loop</button>
      <button onClick={() => setShown(false)}>remove scene</button>
    </CanvasHost>
  );
}

const scene = () => screen.getByTestId("scene");
const setVisible = (visible: boolean) => act(() => FakeObserver.current?.report(scene(), visible));

beforeEach(() => {
  canvas.mounts = 0;
  canvas.unmounts = 0;
  reducedMotion = false;
  motionListeners.clear();
  FakeObserver.current = null;
  vi.stubGlobal("IntersectionObserver", FakeObserver);
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

describe("CanvasHost + useSharedCanvas", () => {
  it("creates no canvas for a registered scene that is far from the viewport", async () => {
    render(<Page />);
    await act(async () => {});
    expect(FakeObserver.current?.observed.has(scene())).toBe(true);
    expect(screen.queryByTestId("canvas")).toBeNull();
  });

  it("mounts the one canvas when the scene nears the viewport and renders continuously", async () => {
    render(<Page />);
    setVisible(true);
    expect((await screen.findByTestId("canvas")).dataset.mode).toBe("always");
    expect(canvas.mounts).toBe(1);
  });

  it("stops rendering when the scene leaves, and keeps the context for its return", async () => {
    render(<Page />);
    setVisible(true);
    await screen.findByTestId("canvas");
    setVisible(false);
    expect(screen.getByTestId("canvas").dataset.mode).toBe("never");
    setVisible(true);
    expect(screen.getByTestId("canvas").dataset.mode).toBe("always");
    expect(canvas.mounts).toBe(1);
    expect(canvas.unmounts).toBe(0);
  });

  it("switches a scene between always and demand without rebuilding the WebGL context", async () => {
    render(<Page />);
    setVisible(true);
    await screen.findByTestId("canvas");

    fireEvent.click(screen.getByText("switch loop"));
    expect(screen.getByTestId("canvas").dataset.mode).toBe("demand");
    fireEvent.click(screen.getByText("switch loop"));
    expect(screen.getByTestId("canvas").dataset.mode).toBe("always");

    expect(canvas.mounts).toBe(1);
    expect(canvas.unmounts).toBe(0);
  });

  it("renders on demand under reduced motion, and follows the setting live", async () => {
    reducedMotion = true;
    render(<Page />);
    setVisible(true);
    expect((await screen.findByTestId("canvas")).dataset.mode).toBe("demand");

    act(() => {
      reducedMotion = false;
      for (const notify of motionListeners) notify();
    });
    expect(screen.getByTestId("canvas").dataset.mode).toBe("always");
  });

  it("releases the canvas when the last scene goes away", async () => {
    render(<Page />);
    setVisible(true);
    await screen.findByTestId("canvas");

    fireEvent.click(screen.getByText("remove scene"));
    expect(screen.queryByTestId("canvas")).toBeNull();
    expect(canvas.unmounts).toBe(1);
    expect(FakeObserver.current?.observed.size).toBe(0);
  });
});
