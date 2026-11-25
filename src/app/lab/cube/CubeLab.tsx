"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { site } from "@/config/site";
import { Flip } from "@/lib/motion/flip";
import { gsap } from "@/lib/motion/gsap";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { CssCube } from "./CssCube";
import { BEVEL_WIDTH, KEY_LIGHT, START_FILL, frame, paletteFor } from "./framing";
import { MarkBevel, setBevelShift } from "./MarkBevel";
import { bevelOffset, parseMark, type Mark } from "./mark";
import { computeMarkField } from "./mark-field";
import type { MarkField } from "./mark-raster";
import { readMotionTokens, type MotionTokens } from "./motion-tokens";
import { advanceRig, createRig, type Rig } from "./rig";
import { freshView, patchView, runKey, viewFor, type RunView } from "./run-view";
import { createFrameStats } from "./stats";
import { useViewport } from "./viewport";

// three, R3F and the scene load only for the WebGL branch.
const WebGLCube = dynamic(() => import("./WebGLCube"), { ssr: false });

/** The scramble's seed. Fixed, so every run and every recording is the same solve. */
const SEED = 11;
/** The landed mark's slot, top centre. */
const SLOT_PX = 40;
/** The lab's stand-in for real loading: Play takes the value from 0 to 100 in this long. */
const PLAY_SECONDS = 2.4;
const MOBILE_QUERY = "(max-width: 767px), (pointer: coarse)";
/** The cube's radius on screen while it solves, as CSS: half its share of the short side. */
const CUBE_RADIUS_CSS = `${(START_FILL * 100) / 2}vmin`;

// ── external values, read without effects ──────────────────────────────────────

const mobileMedia = () => window.matchMedia(MOBILE_QUERY);
function subscribeMobile(onChange: () => void) {
  const media = mobileMedia();
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const readMobile = () => mobileMedia().matches;

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const readGround = () => getComputedStyle(document.documentElement).getPropertyValue("--ground").trim() || null;

let motionTokens: MotionTokens | null = null;
const subscribeNever = () => () => {};
const readMotionTokensOnce = () => (motionTokens ??= readMotionTokens(getComputedStyle(document.documentElement)));

const serverFalse = () => false;
const serverNull = () => null;

/** The bevel's width in viewBox units for a mark drawn `widthPx` wide: the carving, but never under 1 px. */
function bevelShiftFor(mark: Mark, widthPx: number): [number, number] {
  const viewBoxWidth = mark.viewBox[2];
  return bevelOffset(KEY_LIGHT, Math.max(BEVEL_WIDTH * viewBoxWidth, viewBoxWidth / Math.max(widthPx, 1)));
}

const isRunning = (rig: Rig) => rig.sequence.phase !== "solving" || rig.sequence.done > 0 || rig.turn !== null;

// ── the lab ────────────────────────────────────────────────────────────────────

export function CubeLab({ title }: { title: ReactNode }) {
  const osReduced = useReducedMotion();
  const mobile = useSyncExternalStore(subscribeMobile, readMobile, serverFalse);
  const [reducedChoice, setReducedChoice] = useState<boolean | null>(null);
  const [cssChoice, setCssChoice] = useState<boolean | null>(null);
  const reduced = reducedChoice ?? osReduced;
  const css = cssChoice ?? mobile;

  const { theme } = useTheme();
  const ground = useSyncExternalStore(subscribeTheme, readGround, serverNull);
  const tokens = useSyncExternalStore(subscribeNever, readMotionTokensOnce, serverNull);
  const [mark, setMark] = useState<Mark | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [field, setField] = useState<MarkField | null>(null);

  // Every run has its own id: Replay bumps it, and so does any change of branch,
  // whatever caused it (the panel, the OS setting, the breakpoint). Keys never repeat.
  const branch = `${reduced ? "reduced" : "full"} ${css ? "css" : "webgl"}`;
  const [runId, setRunId] = useState(0);
  const [runBranch, setRunBranch] = useState(branch);
  if (runBranch !== branch) {
    setRunBranch(branch);
    setRunId((id) => id + 1);
  }
  const key = runKey(runId, reduced, css);
  const [storedView, setStoredView] = useState<RunView>(() => freshView(key));
  const view = viewFor(storedView, key);
  const update = useCallback(
    (forKey: string, patch: Partial<Omit<RunView, "key">>) => setStoredView((current) => patchView(current, forKey, patch)),
    [],
  );

  /** The current run's rig, with the run it belongs to and whether its landing has been handled. */
  const rig = useRef<(Rig & { key: string; landed: boolean }) | null>(null);
  const autoplayFor = useRef<number | null>(null);
  const progress = useRef({ value: 0 });
  const playTween = useRef<gsap.core.Tween | null>(null);
  const listeners = useRef(new Set<() => void>());
  const stats = useMemo(() => createFrameStats(), []);
  const flipFrom = useRef<Flip.FlipState | null>(null);

  const slider = useRef<HTMLInputElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const phaseText = useRef<HTMLSpanElement>(null);
  const statsText = useRef<HTMLSpanElement>(null);
  const heroLayer = useRef<HTMLDivElement>(null);
  const markEl = useRef<HTMLDivElement>(null);
  const barFill = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  // Fetched once: the route shown again keeps the mark it has.
  useEffect(() => {
    if (mark) return;
    let cancelled = false;
    fetch("/lab/mark.svg")
      .then((response) => {
        if (!response.ok) throw new Error(`/lab/mark.svg: HTTP ${response.status}`);
        return response.text();
      })
      .then((svg) => {
        if (!cancelled) setMark(parseMark(svg));
      })
      .catch((error: unknown) => {
        if (!cancelled) setMarkError(`The mark did not load (${error instanceof Error ? error.message : String(error)}).`);
      });
    return () => {
      cancelled = true;
    };
  }, [mark]);

  // The shader's distance field: built once, off the main thread, and only for the WebGL branch.
  useEffect(() => {
    if (!mark || css || field) return;
    const abort = new AbortController();
    computeMarkField(mark, abort.signal)
      .then((result) => {
        setFieldError(null);
        setField(result);
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) setFieldError(`The carving could not be built (${error instanceof Error ? error.message : String(error)}).`);
      });
    return () => abort.abort();
  }, [mark, css, field]);

  const subscribe = useCallback((listener: () => void) => {
    listeners.current.add(listener);
    return () => void listeners.current.delete(listener);
  }, []);
  const notify = useCallback(() => listeners.current.forEach((listener) => listener()), []);

  const showProgress = useCallback(() => {
    const value = progress.current.value;
    const whole = String(Math.round(value));
    if (slider.current) {
      slider.current.value = String(value);
      slider.current.setAttribute("aria-valuetext", `${whole} percent`);
    }
    if (readout.current) readout.current.textContent = whole;
    if (bar.current) bar.current.setAttribute("aria-valuenow", whole);
    if (barFill.current) barFill.current.style.transform = `scaleX(${value / 100})`;
  }, []);

  const play = useCallback(() => {
    playTween.current?.kill();
    const remaining = 1 - progress.current.value / 100;
    if (remaining <= 0) return;
    playTween.current = gsap.to(progress.current, {
      value: 100,
      duration: PLAY_SECONDS * remaining,
      ease: "power1.inOut",
      onUpdate: showProgress,
    });
  }, [showProgress]);

  const replay = useCallback(() => {
    autoplayFor.current = runId + 1;
    setRunId(runId + 1);
  }, [runId]);

  const ready = Boolean(tokens && mark && ground && (css || field));

  // One run: the rig, advanced on the GSAP ticker, which is the page's one frame loop.
  // The rig belongs to the run's key, so when the effect re-runs for the same run
  // (the route shown again after cacheComponents hid it) it picks the run up where it was.
  useEffect(() => {
    if (!ready || !tokens) return;
    const reused = rig.current?.key === key ? rig.current : null;
    // A run that replaces another starts from 0. The page's first run keeps whatever
    // the slider was given while the cube was still loading.
    if (!reused && rig.current) {
      playTween.current?.kill();
      progress.current.value = 0;
    }
    const current = reused ?? Object.assign(createRig({ seed: SEED, motion: reduced ? "reduced" : "full", tokens }), { key, landed: false });
    if (reused) {
      stats.resume();
    } else {
      rig.current = current;
      stats.reset();
      if (statsText.current) statsText.current.textContent = "";
    }
    showProgress();
    notify();

    let revision = current.revision;
    let shownPhase = "";
    let moving: boolean | null = null;
    const tick = (_time: number, deltaMs: number) => {
      const busy = advanceRig(current, deltaMs, progress.current.value);
      // Only full motion moves the canvas: the reduced branch's hold and crossfade are DOM.
      const animating = busy && current.motion === "full";
      if (animating !== moving) {
        moving = animating;
        update(key, { animating });
      }
      if (current.revision !== revision) {
        revision = current.revision;
        notify();
      }
      const phase =
        current.sequence.phase === "solving"
          ? current.motion === "reduced"
            ? "loading"
            : `turn ${current.sequence.done} of ${current.config.total}`
          : current.sequence.phase === "dolly" && current.motion === "reduced"
            ? "crossfade"
            : current.sequence.phase;
      if (phase !== shownPhase && phaseText.current) {
        shownPhase = phase;
        phaseText.current.textContent = phase;
      }
      if (current.motion === "reduced") {
        if (heroLayer.current) heroLayer.current.style.opacity = String(current.fade);
        if (bar.current) bar.current.style.opacity = String(1 - current.fade);
      }

      if (current.sequence.phase === "landed" && !current.landed) {
        current.landed = true;
        const summary = stats.summary();
        const motion =
          current.motion === "reduced" || summary.frames === 0
            ? "static cube, no animated frames"
            : `${summary.averageFps.toFixed(1)} fps average · worst frame ${summary.worstMs.toFixed(1)} ms · ${summary.frames} frames`;
        const line = css
          ? `CSS cube, no draw calls · ${motion}`
          : `${stats.calls} draw call${stats.calls === 1 ? "" : "s"} · ${stats.triangles.toLocaleString("en")} triangles · ${motion}`;
        console.info(`[lab/cube] ${reduced ? "reduced motion" : "full motion"}, ${line}`);
        if (statsText.current) statsText.current.textContent = line;
        // Reduced motion: the crossfade is done and the cube can go. Full motion:
        // the page's mark goes in over the carved one, and the swap waits for it to paint.
        update(key, current.motion === "reduced" ? { stage: "landed", cubeShown: false } : { stage: "swap", markAt: "face" });
      }
    };
    gsap.ticker.add(tick);
    // Replay plays after a beat on the scrambled cube. The request is consumed when it
    // fires, so an effect that re-runs first (StrictMode, a hidden route) still plays.
    const autoplay =
      autoplayFor.current === runId && !isRunning(current)
        ? gsap.delayedCall(tokens.slowMs / 1000, () => {
            autoplayFor.current = null;
            play();
          })
        : null;

    return () => {
      gsap.ticker.remove(tick);
      autoplay?.kill();
      playTween.current?.kill();
    };
  }, [ready, tokens, key, runId, reduced, css, stats, play, showProgress, notify, update]);

  // The swap. The page's mark is over the carved one: the carving goes now (both
  // appear in the same frame, and they look the same), and two frames later,
  // with the mark surely painted, the mark flies to its slot.
  useLayoutEffect(() => {
    if (view.stage !== "swap") return;
    const swapKey = view.key;
    if (rig.current) rig.current.markOn = false;
    notify();
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if (markEl.current) flipFrom.current = Flip.getState(markEl.current);
        update(swapKey, { stage: "landed", markAt: "slot" });
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [view.stage, view.key, notify, update]);

  // The flight and the hero. The cube (now the bare ground) stays mounted until
  // both are done: releasing its WebGL context mid-flight costs a visible frame.
  useLayoutEffect(() => {
    const from = flipFrom.current;
    const element = markEl.current;
    if (view.markAt !== "slot" || !from || !element || !tokens || !mark) return;
    const landingKey = view.key;
    const svg = element.querySelector("svg");
    const reshift = () => {
      if (svg) setBevelShift(svg, bevelShiftFor(mark, element.getBoundingClientRect().width));
    };
    const lines = heroLayer.current?.querySelectorAll("[data-hero-line]") ?? [];
    const landing = gsap.timeline({
      onComplete: () => {
        flipFrom.current = null;
        update(landingKey, { cubeShown: false });
      },
    });
    landing.add(Flip.from(from, { duration: tokens.slowMs / 1000, ease: tokens.standard, onUpdate: reshift }), 0);
    landing.to(lines, { opacity: 1, duration: tokens.baseMs / 1000, ease: tokens.standard, stagger: tokens.fastMs / 1000 }, tokens.fastMs / 1000);
    reshift(); // Flip has put the mark back on the face: the carving's width before the first frame
    return () => {
      // Interrupted (StrictMode's second pass, the route hidden mid-flight): put the mark
      // and the lines back where React has them. While the Flip state is kept, the flight
      // starts again when the effect does.
      if (landing.progress() === 1) return;
      landing.kill();
      gsap.set(element, { clearProps: "all" });
      gsap.set(lines, { opacity: 0 });
    };
  }, [view.markAt, view.key, tokens, mark, update]);

  // ── what is drawn ──

  const viewport = useViewport();
  const markRect = frame(viewport).markRect;
  const markMode = reduced ? "slot" : view.markAt;
  const markShift = useMemo(
    () => (mark ? bevelShiftFor(mark, markMode === "face" ? markRect.width : SLOT_PX) : ([0, 0] as [number, number])),
    [mark, markMode, markRect.width],
  );
  const cubeShift = useMemo(() => (mark ? bevelShiftFor(mark, markRect.width) : ([0, 0] as [number, number])), [mark, markRect.width]);
  const palette = ground ? paletteFor(ground, theme) : null;
  const rendererProps = ground ? { rig, subscribe, ground, theme, stats } : null;

  const markStyle: CSSProperties =
    markMode === "face"
      ? { position: "fixed", left: markRect.left, top: markRect.top, width: markRect.width, height: markRect.height }
      : {};

  return (
    <div
      data-cube-lab
      data-stage={view.stage}
      data-animating={String(view.animating)}
      data-branch={branch}
    >
      {view.cubeShown && ready && rendererProps && mark ? (
        css ? (
          <CssCube key={`cube-${key}`} {...rendererProps} mark={mark} bevelShift={cubeShift} />
        ) : field ? (
          <WebGLCube {...rendererProps} field={field} animating={view.animating} />
        ) : null
      ) : null}

      {reduced && view.stage !== "landed" ? (
        <div
          key={`bar-${key}`}
          ref={bar}
          data-progress
          role="progressbar"
          aria-label="Loading"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          className="pointer-events-none fixed left-1/2 z-(--z-boot) h-1 w-40 -translate-x-1/2 overflow-hidden rounded-pill bg-line"
          style={{ top: `calc(50% + ${CUBE_RADIUS_CSS} + 24px)` }}
        >
          <div ref={barFill} className="h-full origin-left bg-ink-2" style={{ transform: "scaleX(0)" }} />
        </div>
      ) : null}

      <div
        key={`hero-${key}`}
        ref={heroLayer}
        data-hero
        aria-hidden={view.stage !== "landed"}
        className="pointer-events-none fixed inset-0 z-(--z-boot) flex flex-col items-center justify-center gap-4 px-4 text-center"
        style={{ opacity: reduced ? 0 : 1 }}
      >
        {reduced ? (
          // The crossfade covers the cube, not the page: a square of ground over where the cube stands.
          <div
            data-veil
            aria-hidden
            className="absolute top-1/2 left-1/2 -translate-1/2 bg-ground"
            style={{ width: `calc(2 * ${CUBE_RADIUS_CSS} + 32px)`, height: `calc(2 * ${CUBE_RADIUS_CSS} + 80px)` }}
          />
        ) : null}
        <div data-slot aria-hidden className="fixed top-6 left-1/2 size-10 -translate-x-1/2" />
        <p
          data-hero-line
          className="relative font-display text-title-1 md:text-hero"
          style={{ opacity: reduced ? 1 : 0, fontVariationSettings: '"opsz" var(--text-hero--optical-size)' }}
        >
          {site.name}
        </p>
        <p data-hero-line className="relative text-body-lg text-ink-2" style={{ opacity: reduced ? 1 : 0 }}>
          {site.role}
        </p>
        {mark && palette && markMode !== "hidden" ? (
          <div
            ref={markEl}
            data-mark
            className={markMode === "slot" ? "fixed top-6 left-1/2 size-10 -translate-x-1/2" : undefined}
            style={markStyle}
          >
            <MarkBevel mark={mark} palette={palette} shift={markShift} className="block size-full" />
          </div>
        ) : null}
      </div>

      <Panel
        title={title}
        reduced={reduced}
        css={css}
        error={markError ?? fieldError}
        onPlay={play}
        onReplay={replay}
        onReduced={setReducedChoice}
        onCss={setCssChoice}
        onScrub={(value) => {
          playTween.current?.kill();
          progress.current.value = value;
          showProgress();
        }}
        slider={slider}
        readout={readout}
        phaseText={phaseText}
        statsText={statsText}
      />
    </div>
  );
}

// ── the panel ──────────────────────────────────────────────────────────────────

interface PanelProps {
  title: ReactNode;
  reduced: boolean;
  css: boolean;
  error: string | null;
  onPlay: () => void;
  onReplay: () => void;
  onReduced: (value: boolean) => void;
  onCss: (value: boolean) => void;
  onScrub: (value: number) => void;
  slider: RefObject<HTMLInputElement | null>;
  readout: RefObject<HTMLSpanElement | null>;
  phaseText: RefObject<HTMLSpanElement | null>;
  statsText: RefObject<HTMLSpanElement | null>;
}

const button =
  "rounded-md border border-line-strong px-3 py-2 font-mono text-label uppercase transition-colors hover:border-ink-2 hover:text-ink";

function Panel(props: PanelProps) {
  const { title, reduced, css, error, onPlay, onReplay, onReduced, onCss, onScrub, slider, readout, phaseText, statsText } = props;
  const id = useId();
  return (
    <section
      aria-label="Cube controls"
      className="fixed inset-x-4 bottom-4 z-(--z-boot) flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-ink-2 shadow-frost md:right-auto md:bottom-6 md:left-6 md:w-80"
    >
      <div className="flex items-baseline justify-between gap-4">
        {title}
        <span ref={phaseText} data-phase className="font-mono text-label text-ink-3 uppercase" />
      </div>
      {error ? (
        <p role="alert" className="font-mono text-code text-negative">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="button" className={button} onClick={onPlay}>
          Play
        </button>
        <button type="button" className={button} onClick={onReplay}>
          Replay
        </button>
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor={`${id}-load`} className="font-mono text-label uppercase">
          Load
        </label>
        <input
          ref={slider}
          id={`${id}-load`}
          type="range"
          min={0}
          max={100}
          step={1}
          defaultValue={0}
          aria-valuetext="0 percent"
          onInput={(event) => onScrub(Number(event.currentTarget.value))}
          className="min-w-0 flex-1 accent-(--accent)"
        />
        {/* The slider's own value text is what assistive tech reads; this is for the eye. */}
        <span ref={readout} aria-hidden className="w-8 text-right font-mono text-code text-ink">
          0
        </span>
      </div>
      <div className="flex flex-col gap-2 font-mono text-label uppercase">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={reduced} onChange={(event) => onReduced(event.currentTarget.checked)} className="accent-(--accent)" />
          Reduced motion
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={css} onChange={(event) => onCss(event.currentTarget.checked)} className="accent-(--accent)" />
          Mobile (CSS cube)
        </label>
      </div>
      <span ref={statsText} data-stats className="font-mono text-code text-ink-3 empty:hidden" />
    </section>
  );
}
