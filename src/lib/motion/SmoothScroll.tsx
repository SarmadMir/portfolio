"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { createContext, use, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { ScrollTrigger, gsap } from "./gsap";
import { LENIS_OPTIONS, connectLenis } from "./lenis";
import { prefersReducedMotion, useReducedMotion } from "./useReducedMotion";

const LenisContext = createContext<RefObject<Lenis | null> | null>(null);

/**
 * The one scroll runtime. Lenis smooths the scroll, ScrollTrigger reads it and
 * the GSAP ticker steps both. Native smooth scrolling is never used.
 * Under reduced motion Lenis is not created: the page scrolls natively and
 * ScrollTrigger keeps working against that.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // The hook reports false until hydration finishes; ask the browser as well.
    if (reducedMotion || prefersReducedMotion()) return;

    const lenis = new Lenis(LENIS_OPTIONS);
    const disconnect = connectLenis(lenis, gsap.ticker, ScrollTrigger.update);
    lenisRef.current = lenis;

    return () => {
      lenisRef.current = null;
      disconnect();
      lenis.destroy();
    };
  }, [reducedMotion]);

  return <LenisContext value={lenisRef}>{children}</LenisContext>;
}

/**
 * The Lenis instance, for scrollTo, stop and start. Read `.current` inside
 * handlers and effects; it is null under reduced motion and before mount.
 */
export function useLenis(): RefObject<Lenis | null> {
  const ref = use(LenisContext);
  if (!ref) throw new Error("useLenis must be used inside <SmoothScroll>");
  return ref;
}
