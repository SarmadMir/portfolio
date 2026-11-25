import { describe, expect, it } from "vitest";
import {
  CUBIE_RADIUS,
  CUBIE_SIZE,
  FACE_Z,
  FOV_DEG,
  LANDED_SIZE,
  LIGHTING,
  bevelTones,
  cubieScale,
  sheenOf,
  tone,
  frame,
  lightLevels,
  paletteFor,
  poseAt,
  shade,
} from "@/app/lab/cube/framing";

const desktop = { width: 1440, height: 900 };
const phone = { width: 375, height: 812 };

describe("framing", () => {
  it("starts with the whole cube inside the stage", () => {
    for (const stage of [desktop, phone]) {
      const { focalPx, startDistance } = frame(stage);
      // The cube's bounding sphere, projected.
      const radiusPx = (Math.sqrt(3) * 1.5 * focalPx) / startDistance;
      expect(radiusPx * 2).toBeLessThan(Math.min(stage.width, stage.height));
      expect(radiusPx * 2).toBeGreaterThan(Math.min(stage.width, stage.height) * 0.4);
    }
  });

  it("ends with the front face's stone covering the stage on both axes", () => {
    for (const stage of [desktop, phone]) {
      const { focalPx, endDistance } = frame(stage);
      const pxPerUnit = focalPx / (endDistance - FACE_Z);
      const stone = (2 + LANDED_SIZE) * pxPerUnit; // outer edge to outer edge of the nine cubies, seams closed
      expect(stone).toBeGreaterThan(Math.max(stage.width, stage.height));
      expect(stone).toBeLessThan(Math.max(stage.width, stage.height) * 1.1);
    }
  });

  it("gives the mark's square at the end: the whole face, centred on the stage", () => {
    const { markRect, focalPx, endDistance } = frame(desktop);
    const side = (3 * focalPx) / (endDistance - FACE_Z);
    expect(markRect.width).toBeCloseTo(side, 6);
    expect(markRect.height).toBeCloseTo(side, 6);
    expect(markRect.left + markRect.width / 2).toBeCloseTo(720, 6);
    expect(markRect.top + markRect.height / 2).toBeCloseTo(450, 6);
  });

  it("uses one field of view for both renderers", () => {
    const { focalPx } = frame(desktop);
    expect(focalPx).toBeCloseTo(450 / Math.tan((FOV_DEG * Math.PI) / 360), 6);
  });
});

describe("the dolly", () => {
  it("moves the camera along the face normal from the start to the end distance", () => {
    const { startDistance, endDistance } = frame(desktop);
    expect(poseAt(0, frame(desktop)).distance).toBe(startDistance);
    expect(poseAt(1, frame(desktop)).distance).toBe(endDistance);
    expect(poseAt(0.5, frame(desktop)).distance).toBeCloseTo((startDistance + endDistance) / 2, 6);
  });

  it("squares the cube: three-quarter view at the start, no rotation at the end", () => {
    const start = poseAt(0, frame(desktop));
    expect(start.yaw).toBeLessThan(0); // front face turned towards the light on the left
    expect(start.pitch).toBeGreaterThan(0); // top face visible
    const end = poseAt(1, frame(desktop));
    expect(end.yaw).toBe(0);
    expect(end.pitch).toBe(0);
  });
});

describe("the seams", () => {
  it("are open while the cube solves and closed when it lands", () => {
    expect(cubieScale(0)).toBe(CUBIE_SIZE);
    expect(cubieScale(1)).toBe(LANDED_SIZE);
    expect(cubieScale(0.5)).toBeGreaterThan(CUBIE_SIZE);
  });

  it("close fully: neighbouring flat faces meet past their rounded edges, so the face is one slab", () => {
    const flatHalf = LANDED_SIZE * (0.5 - CUBIE_RADIUS / CUBIE_SIZE);
    expect(flatHalf).toBeGreaterThanOrEqual(0.5);
  });

  it("put the landed front face at FACE_Z", () => {
    expect(FACE_Z).toBe(1 + LANDED_SIZE / 2);
  });
});

describe("the light", () => {
  it("falls to the hero's ambient: no key, full ambient, nothing occluded, no grain", () => {
    for (const theme of ["dark", "light"] as const) {
      expect(lightLevels(1, theme)).toEqual({ ambient: 1, key: 0, occlusion: 1, grain: 0, landed: 1 });
    }
  });

  it("starts low in ambient with a key far above it", () => {
    const start = lightLevels(0, "dark");
    expect(start).toEqual({ ...LIGHTING.dark, landed: 0 });
    expect(start.ambient).toBeLessThan(1);
    expect(start.key).toBeGreaterThan(start.ambient);
  });

  it("ends every surface as the page ground, whatever it faces", () => {
    const ground = "#141619";
    for (const facing of [-1, 0, 0.4, 1]) {
      for (const outer of [0, 1]) expect(shade(ground, facing, outer, lightLevels(1, "dark"))).toBe("rgb(20, 22, 25)");
    }
    expect(shade("#ebe7e0", 0.7, 1, lightLevels(1, "light"))).toBe("rgb(235, 231, 224)");
  });

  it("lights the face that catches the key above the ground and leaves the far side below it", () => {
    const levels = lightLevels(0, "dark");
    const channels = (rgb: string) => rgb.match(/\d+/g)!.map(Number);
    const lit = channels(shade("#141619", 0.84, 1, levels));
    const unlit = channels(shade("#141619", -0.2, 1, levels));
    expect(lit[0]).toBeGreaterThan(20 * 2);
    expect(unlit[0]).toBeLessThan(20);
    // An inner face in the same light is darker than an outer one.
    expect(channels(shade("#141619", 0.84, 0, levels))[0]).toBeLessThan(lit[0]);
  });
});

describe("the sheen", () => {
  it("is the specular a roughness-0.9 dielectric shows under the key, and none without it", () => {
    expect(sheenOf(0.84, lightLevels(0, "dark"))).toBeGreaterThan(0);
    expect(sheenOf(-0.2, lightLevels(0, "dark"))).toBe(0);
    expect(sheenOf(0.84, lightLevels(1, "dark"))).toBe(0);
  });

  it("is grey light added on top of the stone: it lifts every channel", () => {
    const plain = tone("#141619", 3).match(/\d+/g)!.map(Number);
    const sheened = tone("#141619", 3, 0.02).match(/\d+/g)!.map(Number);
    sheened.forEach((channel, index) => expect(channel).toBeGreaterThan(plain[index]));
  });
});

describe("the palette", () => {
  const channels = (rgb: string) => rgb.match(/\d+/g)!.map(Number);

  it("is the ground token and two tones of it: a lit edge and a shadowed edge", () => {
    for (const [theme, ground] of [
      ["dark", "#141619"],
      ["light", "#ebe7e0"],
    ] as const) {
      const palette = paletteFor(ground, theme);
      expect(palette.stone).toBe(ground);
      const stone = channels(shade(ground, 0, 1, lightLevels(1, theme)));
      expect(channels(palette.highlight)[0]).toBeGreaterThan(stone[0]);
      expect(channels(palette.shadow)[0]).toBeLessThan(stone[0]);
    }
  });

  it("lights the carving with the surface: the lit edge adds light, the shadowed edge takes it away", () => {
    const channels2 = (rgb: string) => rgb.match(/\d+/g)!.map(Number);
    const dim = bevelTones("#141619", 1, "dark");
    const bright = bevelTones("#141619", 6, "dark");
    expect(channels2(bright.highlight)[0]).toBeGreaterThan(channels2(dim.highlight)[0]);
    expect(channels2(bright.shadow)[0]).toBeGreaterThan(channels2(dim.shadow)[0]);
    expect(paletteFor("#141619", "dark")).toEqual({ stone: "#141619", ...dim });
  });

  it("gives the carving on a face turned from the key no lit edge, only its shadow", () => {
    const away = bevelTones("#141619", 0.5, "dark", 0);
    expect(away.highlight).toBe(shade("#141619", -1, 1, { ambient: 0.5, key: 0, occlusion: 1, grain: 0, landed: 0 }));
    const toward = bevelTones("#141619", 0.5, "dark", 1);
    expect(toward.highlight).not.toBe(away.highlight);
  });

  it("never reaches pure white or pure black", () => {
    for (const [theme, ground] of [
      ["dark", "#141619"],
      ["light", "#ebe7e0"],
    ] as const) {
      const { highlight, shadow } = paletteFor(ground, theme);
      expect(highlight).not.toBe("rgb(255, 255, 255)");
      expect(shadow).not.toBe("rgb(0, 0, 0)");
      expect(Math.max(...channels(highlight))).toBeLessThan(250);
      expect(Math.min(...channels(shadow))).toBeGreaterThan(4);
    }
  });

  it("keeps the ground's hue: no colour is introduced", () => {
    const [r, g, b] = channels(paletteFor("#141619", "dark").highlight);
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
  });
});
