/**
 * State of the shared WebGL canvas, free of React and three so it can be
 * tested on its own: which scenes are registered, whether the canvas is
 * mounted, and how often it renders.
 */

/** How often the canvas renders: every frame, only when asked, or not at all. */
export type RenderMode = "always" | "demand" | "never";

/** "always": the scene animates on its own. "demand": it renders when invalidated. */
export type LoopMode = "always" | "demand";

export interface SceneState {
  /** In or near the viewport. */
  visible: boolean;
  loop: LoopMode;
}

export interface HostState {
  scenes: ReadonlyMap<Element, SceneState>;
  /** Whether the canvas (and its WebGL context) exists. */
  mounted: boolean;
}

export type HostAction =
  | { type: "register"; element: Element }
  | { type: "loop"; element: Element; loop: LoopMode }
  | { type: "unregister"; element: Element }
  | { type: "visibility"; changes: readonly (readonly [Element, boolean])[] };

export const initialHostState: HostState = { scenes: new Map(), mounted: false };

/**
 * Lazy and sticky: the canvas mounts when the first scene nears the viewport,
 * stays while any scene is registered (so scrolling back is instant), and
 * unmounts with the last scene, which releases the context.
 */
function withScenes(state: HostState, scenes: ReadonlyMap<Element, SceneState>): HostState {
  let anyVisible = false;
  for (const scene of scenes.values()) {
    if (scene.visible) {
      anyVisible = true;
      break;
    }
  }
  return { scenes, mounted: scenes.size > 0 && (state.mounted || anyVisible) };
}

export function hostReducer(state: HostState, action: HostAction): HostState {
  switch (action.type) {
    case "register": {
      if (state.scenes.has(action.element)) return state;
      const scenes = new Map(state.scenes);
      scenes.set(action.element, { visible: false, loop: "always" });
      return withScenes(state, scenes);
    }
    // Its own action, so changing how a scene loops never unregisters it:
    // dropping the last scene would destroy the WebGL context.
    case "loop": {
      const current = state.scenes.get(action.element);
      if (!current || current.loop === action.loop) return state;
      const scenes = new Map(state.scenes);
      scenes.set(action.element, { ...current, loop: action.loop });
      return withScenes(state, scenes);
    }
    case "unregister": {
      if (!state.scenes.has(action.element)) return state;
      const scenes = new Map(state.scenes);
      scenes.delete(action.element);
      return withScenes(state, scenes);
    }
    case "visibility": {
      let scenes: Map<Element, SceneState> | undefined;
      for (const [element, visible] of action.changes) {
        const current = (scenes ?? state.scenes).get(element);
        if (!current || current.visible === visible) continue;
        scenes ??= new Map(state.scenes);
        scenes.set(element, { ...current, visible });
      }
      return scenes ? withScenes(state, scenes) : state;
    }
  }
}

/**
 * One decision for the one canvas. Nothing in view: no frames at all.
 * Reduced motion: frames only when a scene invalidates (its static state).
 */
export function resolveRenderMode(scenes: Iterable<SceneState>, reducedMotion: boolean): RenderMode {
  let anyVisible = false;
  let anyContinuous = false;
  for (const scene of scenes) {
    if (!scene.visible) continue;
    anyVisible = true;
    if (scene.loop === "always") anyContinuous = true;
  }
  if (!anyVisible) return "never";
  if (reducedMotion) return "demand";
  return anyContinuous ? "always" : "demand";
}
