"use client";

import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { gsap } from "./gsap";

// Enables the `morphSVG` tween property. Import this module wherever it is used.
gsap.registerPlugin(MorphSVGPlugin);

export { MorphSVGPlugin };
