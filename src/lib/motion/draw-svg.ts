"use client";

import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { gsap } from "./gsap";

// Enables the `drawSVG` tween property. Import this module wherever it is used.
gsap.registerPlugin(DrawSVGPlugin);

export { DrawSVGPlugin };
