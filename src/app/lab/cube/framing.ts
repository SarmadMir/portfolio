/**
 * Camera, pose and light for the boot cube, as plain numbers. The WebGL scene
 * and the CSS cube both draw from these, so the two branches hit the same beats.
 *
 * World units: one cubie cell is 1, the cube is 3 across and sits at the origin.
 * The camera stays on the +z axis looking at the origin; the cube turns to face it.
 */

import type { ThemeId } from "@/lib/theme/theme";

/** Edge of one cubie while the cube solves. The rest of its cell is the seam. */
export const CUBIE_SIZE = 0.962;
/** Corner radius of a cubie at CUBIE_SIZE. It scales with the cubie. */
export const CUBIE_RADIUS = 0.034;
/**
 * Edge of a cubie once the cube has landed: just past the size at which
 * neighbouring flat faces meet over their rounded edges. The seams close over
 * the dolly, so the front face ends as one slab and the carved mark is
 * continuous when the page's mark takes over from it.
 */
export const LANDED_SIZE = 1.08;
/** z of the front face's surface once landed. */
export const FACE_Z = 1 + LANDED_SIZE / 2;
/** Vertical field of view, shared by both renderers. */
export const FOV_DEG = 30;

/** Width of the carved edge, as a share of the face. */
export const BEVEL_WIDTH = 0.007;

/** Direction to the key light: upper left, in front. Fixed in the world; unit length. */
export const KEY_LIGHT: readonly [number, number, number] = (() => {
  const raw = [-0.62, 0.2, 0.76];
  const length = Math.hypot(...raw);
  return [raw[0] / length, raw[1] / length, raw[2] / length] as const;
})();

/** The three-quarter view the solve is watched from. Radians. */
const START_YAW = -0.52;
const START_PITCH = 0.3;
/** Share of the stage's short side that the cube's bounding sphere spans at the start. */
export const START_FILL = 0.62;
/** How far past the stage's long side the front face reaches at the end. */
const END_OVERSCAN = 1.04;

const BOUNDING_RADIUS = Math.sqrt(3) * 1.5;

export interface Stage {
  width: number;
  height: number;
}

export interface Frame {
  /** Focal length in CSS pixels: the CSS cube's `perspective`. */
  focalPx: number;
  /** Camera distance from the cube's centre while it solves. */
  startDistance: number;
  /** Camera distance at which the front face's stone covers the stage. */
  endDistance: number;
  /** Where the mark's square (the whole face) sits on the stage at the end. */
  markRect: { left: number; top: number; width: number; height: number };
}

export function frame(stage: Stage): Frame {
  const focalPx = stage.height / 2 / Math.tan((FOV_DEG * Math.PI) / 360);
  const startDistance = (2 * BOUNDING_RADIUS * focalPx) / (START_FILL * Math.min(stage.width, stage.height));
  const pxPerUnit = (END_OVERSCAN * Math.max(stage.width, stage.height)) / (2 + LANDED_SIZE);
  const endDistance = FACE_Z + focalPx / pxPerUnit;
  const side = 3 * pxPerUnit;
  return {
    focalPx,
    startDistance,
    endDistance,
    markRect: { left: (stage.width - side) / 2, top: (stage.height - side) / 2, width: side, height: side },
  };
}

/** a at 0, exactly b at 1. */
function mix(a: number, b: number, k: number): number {
  return k >= 1 ? b : a + (b - a) * k;
}

export interface Pose {
  distance: number;
  /** Rotation about y, applied first. */
  yaw: number;
  /** Rotation about x, applied second. */
  pitch: number;
}

/** The dolly at eased progress k: the camera closes in while the cube squares up. */
export function poseAt(k: number, { startDistance, endDistance }: Frame): Pose {
  return { distance: mix(startDistance, endDistance, k), yaw: mix(START_YAW, 0, k), pitch: mix(START_PITCH, 0, k) };
}

/** Cubie edge at dolly progress k: the seams close as the face becomes the page. */
export function cubieScale(k: number): number {
  return mix(CUBIE_SIZE, LANDED_SIZE, k);
}

export interface LightLevels {
  /** Ambient light, in units where 1 shows a surface as its own colour. */
  ambient: number;
  /** Key light, same units, before the cosine of the angle to it. */
  key: number;
  /** Brightness of faces that are inside the cube when it is solved. */
  occlusion: number;
  /** Strength of the stone's grain. */
  grain: number;
  /** 0 while the cube is an object in light, 1 once its surface is the page. */
  landed: number;
}

/** The solve's light: low ambient, one key. Tuned by eye per theme. */
export const LIGHTING: Record<ThemeId, Omit<LightLevels, "landed">> = {
  dark: { ambient: 0.7, key: 2.6, occlusion: 0.35, grain: 1 },
  light: { ambient: 0.66, key: 0.52, occlusion: 0.55, grain: 1 },
};

/**
 * The key falls to the hero's ambient over the dolly (eased progress k). At
 * the end a stone surface, lit or not, shows as exactly its own colour, which
 * is the ground token: the face that fills the stage is the page.
 */
export function lightLevels(k: number, theme: ThemeId): LightLevels {
  const start = LIGHTING[theme];
  return {
    ambient: mix(start.ambient, 1, k),
    key: mix(start.key, 0, k),
    occlusion: mix(start.occlusion, 1, k),
    grain: mix(start.grain, 0, k),
    landed: mix(0, 1, k),
  };
}

const toLinear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
const toSrgb = (channel: number) => (channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055);

/** The light a stone surface receives: `facing` is the cosine between its normal and the key light. */
export function lightOf(facing: number, outer: number, levels: LightLevels): number {
  return (levels.ambient + levels.key * Math.max(facing, 0)) * mix(levels.occlusion, 1, outer);
}

/**
 * Specular per unit of key light at full facing, for MeshStandardMaterial at
 * roughness 0.9, metalness 0 (F0 0.04), seen from the front. Measured against
 * the WebGL render. On a dark stone it is most of what the key shows.
 */
const SHEEN = 0.0157;

/** The grey specular a stone surface shows, in linear light: none once the key is off. */
export function sheenOf(facing: number, levels: LightLevels): number {
  return SHEEN * levels.key * Math.max(facing, 0);
}

/**
 * The stone under `light`, plus `sheen` (grey, linear) on top, with no tone
 * mapping: the shader's model.
 */
export function tone(stoneHex: string, light: number, sheen = 0): string {
  const channels = [1, 3, 5].map((index) => {
    const linear = toLinear(parseInt(stoneHex.slice(index, index + 2), 16) / 255) * light + sheen;
    return Math.round(toSrgb(Math.min(1, linear)) * 255);
  });
  return `rgb(${channels.join(", ")})`;
}

/** The colour of a stone surface, for the CSS cube. */
export function shade(stoneHex: string, facing: number, outer: number, levels: LightLevels): string {
  return tone(stoneHex, lightOf(facing, outer, levels), sheenOf(facing, levels) * mix(levels.occlusion, 1, outer));
}

/**
 * The carving's two edges. The lit wall adds light (in ambient units), the
 * shadowed wall keeps a share of it. The shader uses the same two numbers.
 */
export const BEVEL_LIGHT: Record<ThemeId, { highlightAdd: number; shadowKeep: number }> = {
  dark: { highlightAdd: 8.5, shadowKeep: 0.42 },
  light: { highlightAdd: 0.12, shadowKeep: 0.62 },
};

/**
 * The carving's edges on a surface that receives `light`. `catchKey` (0–1) is
 * how much of the lit wall faces the key: a face turned from it shows only the
 * shadowed edge. Once landed the page's light catches it fully (1).
 */
export function bevelTones(
  stoneHex: string,
  light: number,
  theme: ThemeId,
  catchKey = 1,
): { highlight: string; shadow: string } {
  const { highlightAdd, shadowKeep } = BEVEL_LIGHT[theme];
  return { highlight: tone(stoneHex, light + highlightAdd * catchKey), shadow: tone(stoneHex, light * shadowKeep) };
}

/** How much a carving's lit wall catches: the face's share of the key, rising to all of it as the cube lands. */
export function catchOf(facing: number, levels: LightLevels): number {
  return mix(Math.max(facing, 0), 1, levels.landed);
}

export interface Palette {
  /** The stone: the ground token, as written. */
  stone: string;
  /** The carving's lit edge. */
  highlight: string;
  /** The carving's shadowed edge. */
  shadow: string;
}

/** The landed cube: every colour it shows is the ground token under more or less light. */
export function paletteFor(groundHex: string, theme: ThemeId): Palette {
  return { stone: groundHex, ...bevelTones(groundHex, 1, theme) };
}
