"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { createContext, use, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { ScrollTrigger, gsap } from "./gsap";
import { LENIS_OPTIONS, connectLenis } from "./lenis";
import { prefersReducedMotion, useReducedMotion } from "./useReducedMotion";

/** Holds the Lenis instance outside React state, so consumers re-render when it appears or goes. */
interface LenisStore {
  get: () => Lenis | null;
  set: (next: Lenis | null) => void;
  subscribe: (listener: () => void) => () => void;
}

function createLenisStore(): LenisStore {
  let current: Lenis | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      current = next;
      for (const notify of listeners) notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

const LenisContext = createContext<LenisStore | null>(null);
const serverLenis = () => null;

/**
 * The one scroll runtime. Lenis smooths the scroll, ScrollTrigger reads it and
 * the GSAP ticker steps both. Native smooth scrolling is never used.
 * Under reduced motion Lenis is not created: the page scrolls natively and
 * ScrollTrigger keeps working against that.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const [store] = useState(createLenisStore);

  useEffect(() => {
    // The hook reports false until hydration finishes; ask the browser as well.
    if (reducedMotion || prefersReducedMotion()) return;

    const lenis = new Lenis(LENIS_OPTIONS);
    const disconnect = connectLenis(lenis, gsap.ticker, ScrollTrigger.update);
    store.set(lenis);

    return () => {
      store.set(null);
      disconnect();
      lenis.destroy();
    };
  }, [reducedMotion, store]);

  return <LenisContext value={store}>{children}</LenisContext>;
}

/**
 * The Lenis instance, for scrollTo, stop and start. It is null on the server,
 * under reduced motion, and during the first render: Lenis is created in an
 * effect that runs after its descendants' effects. So depend on it:
 *
 *   const lenis = useLenis();
 *   useEffect(() => {
 *     if (!lenis) return;
 *     lenis.stop();
 *     return () => lenis.start();
 *   }, [lenis]);
 */
export function useLenis(): Lenis | null {
  const store = use(LenisContext);
  if (!store) throw new Error("useLenis must be used inside <SmoothScroll>");
  return useSyncExternalStore(store.subscribe, store.get, serverLenis);
}
