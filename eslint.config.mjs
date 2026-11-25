import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Brief §7: one animation runtime, one scroll runtime. These never ship.
const banned = [
  { name: "animejs", message: "anime.js is dropped: GSAP (MorphSVG, DrawSVG) covers it." },
  { name: "rellax", message: "Rellax is dropped: a scrubbed ScrollTrigger covers it." },
];
const bannedPatterns = [{ group: ["@barba/*"], message: "Barba fights the Next router: use View Transitions and GSAP Flip." }];

// Each runtime has one owner module; everything else goes through it.
const gsapOwner = [
  { name: "gsap", message: 'Import gsap from "@/lib/motion/gsap": it is registered once there.' },
  { name: "@gsap/react", message: 'Import useGSAP from "@/lib/motion/gsap".' },
];
const gsapOwnerPatterns = [
  {
    group: ["gsap/*"],
    message: 'Import ScrollTrigger from "@/lib/motion/gsap" and effect plugins from "@/lib/motion/{flip,split-text,draw-svg,morph-svg}".',
  },
];
const lenisOwner = [{ name: "lenis", message: "One scroll runtime: use useLenis() from @/lib/motion/SmoothScroll." }];
const lenisOwnerPatterns = [{ group: ["lenis/*"], message: "One scroll runtime: use useLenis() from @/lib/motion/SmoothScroll." }];
const canvasOwner = [
  {
    name: "@react-three/fiber",
    importNames: ["Canvas"],
    message: "One WebGL context per page: register with useSharedCanvas() and render into drei's <View>.",
  },
];

const restrict = (paths, patterns) => ({ "no-restricted-imports": ["error", { paths, patterns }] });

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: restrict(
      [...banned, ...gsapOwner, ...lenisOwner, ...canvasOwner],
      [...bannedPatterns, ...gsapOwnerPatterns, ...lenisOwnerPatterns],
    ),
  },
  {
    // The motion runtime owns GSAP and Lenis.
    files: ["src/lib/motion/**"],
    rules: restrict([...banned, ...canvasOwner], bannedPatterns),
  },
  {
    // The shared canvas owns <Canvas>.
    files: ["src/lib/three/SharedCanvas.tsx"],
    rules: restrict([...banned, ...gsapOwner, ...lenisOwner], [...bannedPatterns, ...gsapOwnerPatterns, ...lenisOwnerPatterns]),
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
