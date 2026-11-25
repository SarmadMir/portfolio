"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { hostReducer, initialHostState, resolveRenderMode, type LoopMode } from "./host-state";

// three, R3F and drei are one lazy chunk, fetched when a scene first nears the viewport.
const SharedCanvas = dynamic(() => import("./SharedCanvas"), { ssr: false });

/** How far outside the viewport a scene starts loading and rendering. */
const VIEWPORT_MARGIN = "200px";

interface CanvasHostApi {
  /** Registers a scene's DOM element and returns the function that unregisters it. */
  register: (element: Element) => () => void;
  /** Changes how a registered scene renders, without unregistering it. */
  setLoop: (element: Element, loop: LoopMode) => void;
}

const CanvasHostContext = createContext<CanvasHostApi | null>(null);

/**
 * Owns the page's single WebGL context. Scenes never create a <Canvas>: they
 * register a DOM element with useSharedCanvas and render into it with drei's
 * <View>. The canvas is
 *   - lazy: nothing three-related loads until a scene nears the viewport,
 *   - viewport-gated: no frames are asked for while no scene is in view,
 *   - reduced-motion aware: frames only on demand, so scenes show their static state.
 * It is fixed at z-field, behind the page; a scene shows wherever the DOM above it is transparent.
 */
export function CanvasHost({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(hostReducer, initialHostState);
  const reducedMotion = useReducedMotion();
  const observerRef = useRef<IntersectionObserver | null>(null);

  const register = useCallback((element: Element) => {
    // Created on first use: a scene's effect runs before this component's own.
    observerRef.current ??= new IntersectionObserver(
      (entries) =>
        dispatch({
          type: "visibility",
          changes: entries.map((entry) => [entry.target, entry.isIntersecting] as const),
        }),
      { rootMargin: VIEWPORT_MARGIN },
    );
    dispatch({ type: "register", element });
    observerRef.current.observe(element);

    return () => {
      observerRef.current?.unobserve(element);
      dispatch({ type: "unregister", element });
    };
  }, []);

  const setLoop = useCallback((element: Element, loop: LoopMode) => {
    dispatch({ type: "loop", element, loop });
  }, []);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    },
    [],
  );

  const api = useMemo<CanvasHostApi>(() => ({ register, setLoop }), [register, setLoop]);
  const mode = resolveRenderMode(state.scenes.values(), reducedMotion);

  return (
    <CanvasHostContext value={api}>
      {state.mounted ? <SharedCanvas mode={mode} /> : null}
      {children}
    </CanvasHostContext>
  );
}

/**
 * Registers a scene with the shared canvas. Pass the ref of the element the
 * scene occupies (the one drei's <View> tracks).
 * `loop`: "always" for a scene that animates on its own, "demand" for one that
 * renders only when invalidated (scroll and resize invalidate automatically).
 * `loop` may change at any time, for example while audio plays.
 */
export function useSharedCanvas(target: RefObject<Element | null>, loop: LoopMode = "always"): void {
  const host = use(CanvasHostContext);
  if (!host) throw new Error("useSharedCanvas must be used inside <CanvasHost>");

  // Registration follows the element only. If it also followed `loop`, every
  // loop change would unregister the scene and, for a lone scene, destroy the context.
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    return host.register(element);
  }, [host, target]);

  useEffect(() => {
    const element = target.current;
    if (element) host.setLoop(element, loop);
  }, [host, target, loop]);
}
