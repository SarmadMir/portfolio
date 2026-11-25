"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  CUBIE_RADIUS,
  CUBIE_SIZE,
  KEY_LIGHT,
  bevelTones,
  catchOf,
  cubieScale,
  frame,
  lightLevels,
  lightOf,
  poseAt,
  sheenOf,
  tone,
  type Palette,
} from "./framing";
import { GRAIN_SIZE, grainBytes } from "./grain";
import { MarkBevel, setBevelShift } from "./MarkBevel";
import type { Mark } from "./mark";
import { createCube, type Vec3 } from "./model";
import { cssMatrix, cubieMatrix, multiply, poseMatrix, transformNormal } from "./transforms";
import { useViewport } from "./viewport";
import type { CubeRendererProps } from "./WebGLCube";

/**
 * The mobile branch: the same cube, the same beats, as 162 CSS faces in 3D.
 * No WebGL and no three.js. Every face is lit in JavaScript with the shader's
 * model (framing.ts), so the light falls to the ground token the same way.
 */

interface Face {
  normal: Vec3;
  axis: 0 | 1 | 2;
  sign: 1 | -1;
  /** The face's place on its cubie, before the push out to the surface. */
  turn: string;
}

const FACES: readonly Face[] = [
  { normal: [0, 0, 1], axis: 2, sign: 1, turn: "" },
  { normal: [0, 0, -1], axis: 2, sign: -1, turn: "rotateY(180deg)" },
  { normal: [1, 0, 0], axis: 0, sign: 1, turn: "rotateY(90deg)" },
  { normal: [-1, 0, 0], axis: 0, sign: -1, turn: "rotateY(-90deg)" },
  // CSS y points down: rotateX(90deg) turns a face's normal up.
  { normal: [0, 1, 0], axis: 1, sign: 1, turn: "rotateX(90deg)" },
  { normal: [0, -1, 0], axis: 1, sign: -1, turn: "rotateX(-90deg)" },
];

const CUBIES = createCube();
/** Strongest grain, as the overlay's opacity. */
const GRAIN_OPACITY = 0.035;
// Transparent until the first frame has lit the face, so the carving never shows black.
const MARK_PALETTE: Palette = { stone: "", highlight: "var(--bevel-hi, transparent)", shadow: "var(--bevel-lo, transparent)" };

const dot = (a: Vec3, b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The grain tile as a data URL: light and dark specks on transparent. */
function grainUrl(): string {
  const canvas = document.createElement("canvas");
  canvas.width = GRAIN_SIZE;
  canvas.height = GRAIN_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return "none";
  const image = context.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  grainBytes().forEach((value, index) => {
    const light = value >= 128;
    image.data.set([light ? 255 : 0, light ? 255 : 0, light ? 255 : 0, Math.abs(value - 128) * 2], index * 4);
  });
  context.putImageData(image, 0, 0);
  return `url(${canvas.toDataURL()})`;
}

interface CssCubeProps extends CubeRendererProps {
  mark: Mark;
  /** The carving's edge, in the mark's viewBox units. */
  bevelShift: readonly [number, number];
}

export function CssCube({ rig, subscribe, ground, theme, stats, mark, bevelShift }: CssCubeProps) {
  const { width, height } = useViewport();
  // One cell in CSS pixels: the size a face reaches when it lands, so faces are never upscaled.
  const unit = Math.max(1, Math.round(frame({ width, height }).markRect.width / 3));

  const stage = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [grain, setGrain] = useState("none");

  useEffect(() => {
    // A canvas is needed, so this runs after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGrain(grainUrl());
  }, []);

  useEffect(() => {
    const stageEl = stage.current;
    const rootEl = root.current;
    if (!stageEl || !rootEl || width === 0) return;
    const cubieEls = [...rootEl.querySelectorAll<HTMLElement>("[data-cubie]")];
    const faceEls = cubieEls.map((cubie) => [...cubie.querySelectorAll<HTMLElement>(":scope > [data-face]")]);
    const colours = faceEls.map((faces) => faces.map(() => ""));
    const [vbX, vbY, vbWidth] = mark.viewBox;
    const perUnit = vbWidth / 3;

    const draw = () => {
      const run = rig.current;
      if (!run) return;
      const framing = frame({ width, height });
      const pose = poseAt(run.dolly, framing);
      const levels = lightLevels(run.dolly, theme);
      const scale = cubieScale(run.dolly);
      const poseM = poseMatrix(pose.yaw, pose.pitch);

      stageEl.style.perspective = `${framing.focalPx}px`;
      rootEl.style.transform = `translateZ(${framing.focalPx - pose.distance * unit}px) ${cssMatrix(poseM, unit)}`;
      rootEl.style.setProperty("--cube-grain", String(levels.grain * GRAIN_OPACITY));

      run.cubies.forEach((cubie, index) => {
        const placed = cubieMatrix(cubie, run.turn, scale);
        cubieEls[index].style.transform = cssMatrix(placed, unit);
        const world = multiply(poseM, placed);
        FACES.forEach((face, faceIndex) => {
          const element = faceEls[index][faceIndex];
          const facing = dot(transformNormal(world, face.normal), KEY_LIGHT);
          const outer = cubie.home[face.axis] === face.sign ? 1 : 0;
          const light = lightOf(facing, outer, levels);
          const colour = tone(ground, light, sheenOf(facing, levels) * (outer ? 1 : levels.occlusion));
          if (colours[index][faceIndex] !== colour) {
            colours[index][faceIndex] = colour;
            element.style.backgroundColor = colour;
          }
          if (face.axis === 2 && face.sign === 1 && cubie.home[2] === 1) {
            const tones = bevelTones(ground, light, theme, catchOf(facing, levels));
            element.style.setProperty("--bevel-hi", run.markOn ? tones.highlight : colour);
            element.style.setProperty("--bevel-lo", run.markOn ? tones.shadow : colour);
            // The face grows as the seams close; the mark stays put on the cube.
            const svg = element.querySelector("svg");
            const [hx, hy] = cubie.home;
            svg?.setAttribute(
              "viewBox",
              [vbX + (hx + 1.5 - scale / 2) * perUnit, vbY + (1.5 - hy - scale / 2) * perUnit, scale * perUnit, scale * perUnit].join(" "),
            );
          }
        });
      });
      stats.frame(performance.now(), run.turn !== null || run.sequence.phase === "hold" || run.sequence.phase === "dolly");
    };

    draw();
    return subscribe(draw);
  }, [rig, subscribe, ground, theme, stats, mark, width, height, unit]);

  useEffect(() => {
    for (const svg of root.current?.querySelectorAll("svg") ?? []) setBevelShift(svg, bevelShift);
  }, [bevelShift]);

  const half = unit / 2;
  const faceStyle: CSSProperties = {
    width: unit,
    height: unit,
    left: -half,
    top: -half,
    borderRadius: (CUBIE_RADIUS / CUBIE_SIZE) * unit,
  };

  return (
    <div ref={stage} className="pointer-events-none fixed inset-0 overflow-hidden" data-cube-renderer="css" aria-hidden>
      <div
        ref={root}
        className="absolute top-1/2 left-1/2 size-0 transform-3d"
        style={{ "--cube-grain-image": grain } as CSSProperties}
      >
        {CUBIES.map((cubie) => (
          <div key={cubie.home.join()} data-cubie className="absolute top-0 left-0 size-0 transform-3d">
            {FACES.map((face) => (
              <div
                key={face.normal.join()}
                data-face
                className="absolute overflow-hidden backface-hidden after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-(image:--cube-grain-image) after:opacity-(--cube-grain) after:[background-size:64px_64px]"
                style={{ ...faceStyle, transform: `${face.turn} translateZ(${half}px)` }}
              >
                {face.axis === 2 && face.sign === 1 && cubie.home[2] === 1 ? (
                  <MarkBevel mark={mark} palette={MARK_PALETTE} shift={bevelShift} className="size-full" />
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
