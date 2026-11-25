import { describe, expect, it } from "vitest";
import { hostReducer, initialHostState, resolveFrameloop, type HostState } from "@/lib/three/host-state";

const hero = { id: "hero" } as unknown as Element;
const about = { id: "about" } as unknown as Element;

function run(...actions: Parameters<typeof hostReducer>[1][]): HostState {
  return actions.reduce(hostReducer, initialHostState);
}

describe("shared canvas: when the one WebGL context exists", () => {
  it("does not mount for a scene that is registered but far from the viewport", () => {
    const state = run({ type: "register", element: hero, loop: "always" });
    expect(state.scenes.size).toBe(1);
    expect(state.mounted).toBe(false);
  });

  it("mounts when a registered scene comes near the viewport", () => {
    const state = run(
      { type: "register", element: hero, loop: "always" },
      { type: "visibility", changes: [[hero, true]] },
    );
    expect(state.mounted).toBe(true);
  });

  it("keeps the context while the scene scrolls away, so coming back is instant", () => {
    const state = run(
      { type: "register", element: hero, loop: "always" },
      { type: "visibility", changes: [[hero, true]] },
      { type: "visibility", changes: [[hero, false]] },
    );
    expect(state.mounted).toBe(true);
  });

  it("releases the context when the last scene unregisters", () => {
    const state = run(
      { type: "register", element: hero, loop: "always" },
      { type: "visibility", changes: [[hero, true]] },
      { type: "unregister", element: hero },
    );
    expect(state.scenes.size).toBe(0);
    expect(state.mounted).toBe(false);
  });

  it("serves two scenes from the same mounted canvas", () => {
    const state = run(
      { type: "register", element: hero, loop: "always" },
      { type: "register", element: about, loop: "demand" },
      { type: "visibility", changes: [[about, true]] },
      { type: "unregister", element: about },
    );
    expect(state.scenes.size).toBe(1);
    expect(state.mounted).toBe(true);
  });

  it("ignores visibility reports for elements that never registered", () => {
    const state = run({ type: "visibility", changes: [[hero, true]] });
    expect(state).toBe(initialHostState);
  });

  it("returns the same state when nothing changed, so React skips the render", () => {
    const before = run(
      { type: "register", element: hero, loop: "always" },
      { type: "visibility", changes: [[hero, true]] },
    );
    expect(hostReducer(before, { type: "visibility", changes: [[hero, true]] })).toBe(before);
    expect(hostReducer(before, { type: "register", element: hero, loop: "always" })).toBe(before);
    expect(hostReducer(before, { type: "unregister", element: about })).toBe(before);
  });

  it("keeps a scene's visibility when it registers again with another loop mode", () => {
    const state = run(
      { type: "register", element: hero, loop: "always" },
      { type: "visibility", changes: [[hero, true]] },
      { type: "register", element: hero, loop: "demand" },
    );
    expect(state.scenes.get(hero)).toEqual({ visible: true, loop: "demand" });
  });
});

describe("shared canvas: frameloop", () => {
  it("never renders when no scene is in view", () => {
    expect(resolveFrameloop([], false)).toBe("never");
    expect(resolveFrameloop([{ visible: false, loop: "always" }], false)).toBe("never");
  });

  it("runs continuously when a visible scene asks for it", () => {
    expect(resolveFrameloop([{ visible: true, loop: "always" }], false)).toBe("always");
    expect(
      resolveFrameloop(
        [
          { visible: true, loop: "demand" },
          { visible: true, loop: "always" },
        ],
        false,
      ),
    ).toBe("always");
  });

  it("renders on demand when every visible scene is static until invalidated", () => {
    expect(resolveFrameloop([{ visible: true, loop: "demand" }], false)).toBe("demand");
    expect(
      resolveFrameloop(
        [
          { visible: false, loop: "always" },
          { visible: true, loop: "demand" },
        ],
        false,
      ),
    ).toBe("demand");
  });

  it("drops to on-demand frames under reduced motion, whatever the scene asked for", () => {
    expect(resolveFrameloop([{ visible: true, loop: "always" }], true)).toBe("demand");
    expect(resolveFrameloop([{ visible: false, loop: "always" }], true)).toBe("never");
  });
});
