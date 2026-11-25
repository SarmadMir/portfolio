"use client";

/**
 * The one place GSAP core is imported. Every route loads this: gsap,
 * ScrollTrigger (the scroll runtime needs it) and useGSAP, registered once.
 *
 * The effect plugins are separate modules so a route only pays for the ones
 * it uses. Importing the module registers the plugin:
 *   @/lib/motion/flip        Flip        9.5 KB gz
 *   @/lib/motion/split-text  SplitText   3.6 KB gz
 *   @/lib/motion/draw-svg    DrawSVG     2.2 KB gz
 *   @/lib/motion/morph-svg   MorphSVG    9.3 KB gz
 *
 * Never import from "gsap" or "@gsap/react" directly (ESLint enforces it).
 */
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export { ScrollTrigger, gsap, useGSAP };
