import { describe, expect, it } from "vitest";
import { hostReducer, initialHostState, resolveRenderMode, type HostState } from "@/lib/three/host-state";

const hero = { id: "hero" } as unknown as Element;
const about = { id: "about" } as unknown as Element;

function run(...actions: Parameters<typeof hostReducer>[1][]): HostState {
  return actions.reduce(hostReducer, initialHostState);
}

describe("shared canvas: when the one WebGL context exists", () => {
  it("does not mount for a scene that is registered but far from the viewport", () => {
    const state = run({ type: "register", element: hero });
    expect(state.scenes.size).toBe(1);
    expect(state.mounted).toBe(false);
  });

  it("mounts when a registered scene comes near the viewport", () => {
    const state = run(
      { type: "register", element: hero },
      { type: "visibility", changes: [[hero, true]] },
    );
    expect(state.mounted).toBe(true);
  });

  it("keeps the context while the scene scrolls away, so coming back is instant", () => {
    const state = run(
      { type: "register", element: hero },
      { type: "visibility", changes: [[hero, true]] },
      { type: "visibility", changes: [[hero, false]] },
    );
    expect(state.mounted).toBe(true);
  });

  it("releases the context when the last scene unregisters", () => {
    const state = run(
      { type: "register", element: hero },
      { type: "visibility", changes: [[hero, true]] },
      { type: "unregister", element: hero },
    );
    expect(state.scenes.size).toBe(0);
    expect(state.mounted).toBe(false);
  });

  it("serves two scenes from the same mounted canvas", () => {
    const state = run(
      { type: "register", element: hero },
      { type: "register", element: about },
      { type: "loop", element: about, loop: "demand" },
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
      { type: "register", element: hero },
      { type: "visibility", changes: [[hero, true]] },
    );
    expect(hostReducer(before, { type: "visibility", changes: [[hero, true]] })).toBe(before);
    expect(hostReducer(before, { type: "register", element: hero })).toBe(before);
    expect(hostReducer(before, { type: "loop", element: hero, loop: "always" })).toBe(before);
    expect(hostReducer(before, { type: "loop", element: about, loop: "demand" })).toBe(before);
    expect(hostReducer(before, { type: "unregister", element: about })).toBe(before);
  });

  it("registers a scene as continuous until told otherwise", () => {
    const state = run({ type: "register", element: hero });
    expect(state.scenes.get(hero)).toEqual({ visible: false, loop: "always" });
  });

  it("changes a scene's loop mode in place: still registered, still visible, context kept", () => {
    const state = run(
      { type: "register", element: hero },
      { type: "visibility", changes: [[hero, true]] },
      { type: "loop", element: hero, loop: "demand" },
    );
    expect(state.scenes.get(hero)).toEqual({ visible: true, loop: "demand" });
    expect(state.mounted).toBe(true);
  });
});

describe("shared canvas: how often it renders", () => {
  it("never renders when no scene is in view", () => {
    expect(resolveRenderMode([], false)).toBe("never");
    expect(resolveRenderMode([{ visible: false, loop: "always" }], false)).toBe("never");
  });

  it("runs continuously when a visible scene asks for it", () => {
    expect(resolveRenderMode([{ visible: true, loop: "always" }], false)).toBe("always");
    expect(
      resolveRenderMode(
        [
          { visible: true, loop: "demand" },
          { visible: true, loop: "always" },
        ],
        false,
      ),
    ).toBe("always");
  });

  it("renders on demand when every visible scene is static until invalidated", () => {
    expect(resolveRenderMode([{ visible: true, loop: "demand" }], false)).toBe("demand");
    expect(
      resolveRenderMode(
        [
          { visible: false, loop: "always" },
          { visible: true, loop: "demand" },
        ],
        false,
      ),
    ).toBe("demand");
  });

  it("drops to on-demand frames under reduced motion, whatever the scene asked for", () => {
    expect(resolveRenderMode([{ visible: true, loop: "always" }], true)).toBe("demand");
    expect(resolveRenderMode([{ visible: false, loop: "always" }], true)).toBe("never");
  });
});
