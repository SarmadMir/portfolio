@AGENTS.md

# sarmadmir.dev — v2 (branch `v2`)

The full portfolio. `main` is the holding page that production serves; it stays untouched until M1 replaces it.
Read `../command-center/PORTFOLIO_BRIEF.md` first. Its stack (§7), budgets (§9) and process (§10) are binding.
This branch is the scaffold: runtime and gates. No sections, no components beyond providers.

## Map
- `src/styles/tokens.json` → `npm run tokens` → `src/styles/tokens.css`. Generated, never hand-edited; see `src/styles/README.md`. Model and renderer: `src/lib/tokens/`.
- `src/styles/fonts.ts`: next/font sets `--font-display`, `--font-text`, `--font-mono` on `<html>`.
- `src/lib/motion/`: `gsap.ts` (gsap, ScrollTrigger, useGSAP), `flip.ts` / `split-text.ts` / `draw-svg.ts` / `morph-svg.ts` (opt-in plugins, registered on import), `SmoothScroll.tsx` (the one Lenis, `useLenis()`), `useReducedMotion.ts`.
- `src/lib/three/`: `CanvasHost.tsx` (the one WebGL context, `useSharedCanvas()`), `SharedCanvas.tsx` (the only `<Canvas>`), `host-state.ts` (which scenes exist, when the canvas mounts), `frame-driver.ts` (when frames are drawn, and the clock).
- `src/lib/theme/`: `ThemeProvider.tsx` (`useTheme()`), `theme.ts` (rules and the inline bootstrap).
- `src/app/providers.tsx` composes the three providers. `src/app/page.tsx` is the dev home (token swatches, type scale). `src/app/lab/` holds the prototype slots: cube, field, lens, fold.
- `src/app/lab/cube/`: the boot prototype. Pure modules (`model` cube and moves, `sequence` timing, `rig` one run, `run-view` the page state keyed by run, `framing` camera, light and palette, `transforms` matrices, `mark` SVG and distance field) are shared by two renderers: `WebGLCube.tsx` (one instanced mesh, `stone-material.ts`; the mark's field is built in `mark-field.worker.ts` via `mark-field.ts` / `mark-raster.ts`) and `CssCube.tsx` (the mobile branch, no three). `CubeLab.tsx` runs the rig on the GSAP ticker and owns the landing and the panel. Tuning knobs live in `framing.ts`.

## Rules
- System values only. The colour, font, text, radius, shadow and ease namespaces of Tailwind are reset, so `bg-red-500`, `text-sm`, `rounded-2xl`, `shadow-md`, `ease-in-out` do not exist. Use `bg-ground`, `text-ink-2`, `text-title-1`, `rounded-lg`, `shadow-stone`, `ease-spring`, `t-fast`. Spacing is N × 4px. A `transition-*` with no `t-*` runs at `duration-fast` on `ease-standard`.
- Tailwind scans only `src/**/*.{ts,tsx}` for class names (`source(none)` in `globals.css`). A class written anywhere else generates nothing.
- Theming is `data-theme` on `<html>`; it also works on any nested element. Never hard-code a colour.
- One scroll runtime: import GSAP only from `@/lib/motion/*`; never import `lenis` or native-smooth-scroll anything. ESLint enforces it. No anime.js, Barba or Rellax.
- One WebGL context per page: never render `<Canvas>`. A scene registers its element and renders through drei's `<View>`:

  ```tsx
  "use client";
  import { View } from "@react-three/drei";
  import { useRef, type Ref } from "react";
  import { useSharedCanvas } from "@/lib/three/CanvasHost";

  export function Scene() {
    const ref = useRef<HTMLElement>(null);
    useSharedCanvas(ref, "always"); // "demand": render only when invalidated
    return (
      <View ref={ref as Ref<HTMLElement>} className="size-80">
        {/* camera, lights, meshes */}
      </View>
    );
  }
  ```

  The canvas is fixed at `z-field`, behind the page: a scene shows wherever the DOM above it is transparent. It loads when a scene nears the viewport and draws no frames while none is in view. `loop` may change at any time (for example while audio plays) without rebuilding the context. The clock runs only while frames are drawn: `clock.elapsedTime` continues where it stopped and the first delta after a pause is zero, so time-driven animation never jumps.
- Lenis is created in an effect, after its descendants' effects have run. `useLenis()` returns the instance or `null` and re-renders when that changes, so depend on it: `useEffect(() => { if (!lenis) return; lenis.stop(); return () => lenis.start(); }, [lenis])`.
- Every moving thing branches on `useReducedMotion()` to its static state.
- Write the standard `backdrop-filter` only.
- Copy: facts only, no emoji. Pending content is `[placeholder]`.

## Gotchas
- `cacheComponents` is on. Routes you navigate away from stay mounted but hidden (React Activity); their effects clean up and re-run. Read `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md` before adding stateful UI.
- A layout's `title.template` does not apply to a page in the same segment (`/` sets its full title).
- `text-hero` sets size, line height, weight and tracking, but Tailwind's text utilities cannot set the optical size. The hero also needs `font-variation-settings: "opsz" var(--text-hero--optical-size)` (the token asks for 96; the browser's automatic value at 72px is 72). The dev home does this inline.
- A scene animated from outside R3F (the GSAP ticker) must ask for `loop: "always"` while it moves. Calling `invalidate()` once per tick halves the rate: R3F's demand loop stops after each frame and the next request lands a frame late (measured 30 fps on /lab/cube; 60 with "always").
- The React Compiler lint (`react-hooks/immutability`) rejects assigning to a `useMemo` value inside `useFrame` (uniforms, scratch matrices). Put per-frame writes behind a method on the object or a module-level function.
- Web workers: `new Worker(new URL("./x.worker.ts", import.meta.url), { type: "module" })` works. Turbopack ships it as a same-origin classic worker (`importScripts`, no `blob:`), so the CSP's `'self'` covers it.
- R3F resets its clock whenever the `frameloop` prop changes. `SharedCanvas` keeps it at `demand` for that reason; never make it dynamic.
- `three` is pinned to 0.182.0: R3F 9.8 constructs `THREE.Clock`, and r183+ logs a deprecation warning for it on every canvas mount. Unpin when R3F moves to `THREE.Timer`.
- The CSP in `next.config.ts` has no `blob:` or `worker-src`. GLB textures, Draco and KTX2 loaders will need them.
- `npm run typecheck` needs a prior build or `next dev` run: route types (`LayoutProps`) are generated into `.next/types`.

## Ports
- Dev and `next start` are pinned to 3200. QA tools (crawl, Playwright, Lighthouse) use 3100.
- Never start a server on 3001 (Input2PDF). Never run an unpinned `next dev`: it falls through to 3001 when 3000 is busy.

## Commands and gates
- `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`
- `npm run test:run`: Vitest (tokens, Tailwind theme contract, theme and its provider, canvas host and frame driver, Lenis wiring and provider, lab, and in `tests/lab-cube/` the cube's model, sequence, rig, run view, framing, transforms, motion tokens, mark, distance-field worker, material, grain, stats and SVG bevel).
- `npm run qa:crawl`: route crawl of the production build at 375 / 768 / 1440. `--strict` exits 1 on a blocker.
- `npm run e2e`: Playwright runtime specs (needs a build).
- `npm run qa:lighthouse`: the §9 budgets on `/` (needs a build and Node 22.19+).
- CI (`.github/workflows/ci.yml`) runs all of them on every push to `v2`.
