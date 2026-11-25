import { describe, expect, it } from "vitest";
import { applyMove, createCube, type Move } from "@/app/lab/cube/model";
import { cssMatrix, cubieMatrix, multiply, poseMatrix, transformNormal, transformPoint } from "@/app/lab/cube/transforms";

const near = (actual: readonly number[], expected: readonly number[]) =>
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 9));

describe("a cubie's matrix", () => {
  it("places a solved cubie at its cell, at its scale", () => {
    const cubie = createCube().find((c) => c.home.join() === "1,-1,0")!;
    const m = cubieMatrix(cubie, null, 0.5);
    near(transformPoint(m, [0, 0, 0]), [1, -1, 0]);
    near(transformPoint(m, [1, 0, 0]), [1.5, -1, 0]);
  });

  it("follows the model: a landed turn and a finished in-flight turn put the cubie in the same place", () => {
    const move: Move = { axis: 1, layer: 1, turns: -1 };
    const cube = createCube();
    const index = cube.findIndex((c) => c.home.join() === "1,1,1");
    const inFlight = cubieMatrix(cube[index], { move, angle: (move.turns * Math.PI) / 2 }, 1);
    const landed = cubieMatrix(applyMove(cube, move)[index], null, 1);
    near(inFlight, landed);
  });

  it("leaves cubies outside the turning layer alone", () => {
    const move: Move = { axis: 0, layer: -1, turns: 1 };
    const cubie = createCube().find((c) => c.home.join() === "1,0,0")!;
    near(cubieMatrix(cubie, { move, angle: 0.7 }, 1), cubieMatrix(cubie, null, 1));
  });
});

describe("the pose", () => {
  it("turns the front face towards -x for a negative yaw and the top towards the camera for a positive pitch", () => {
    const front = transformNormal(poseMatrix(-0.5, 0), [0, 0, 1]);
    expect(front[0]).toBeLessThan(0);
    const top = transformNormal(poseMatrix(0, 0.3), [0, 1, 0]);
    expect(top[2]).toBeGreaterThan(0);
  });

  it("applies yaw before pitch", () => {
    const yawThenPitch = multiply(poseMatrix(0, 0.3), poseMatrix(-0.5, 0));
    near(poseMatrix(-0.5, 0.3), yawThenPitch);
  });
});

describe("CSS", () => {
  it("writes matrix3d in pixels with y pointing down", () => {
    const cubie = createCube().find((c) => c.home.join() === "0,1,0")!;
    expect(cssMatrix(cubieMatrix(cubie, null, 1), 100)).toBe("matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,-100,0,1)");
  });

  it("mirrors rotations into the y-down frame", () => {
    // A quarter turn about z carries +x to +y; on screen, +x goes up, which is -y in CSS.
    const turn = cssMatrix(poseMatrix(0, 0), 1);
    expect(turn).toBe("matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)");
    const cubie = createCube().find((c) => c.home.join() === "0,0,1")!;
    const css = cssMatrix(cubieMatrix(cubie, { move: { axis: 2, layer: 1, turns: 1 }, angle: Math.PI / 2 }, 1), 1);
    const values = css.slice("matrix3d(".length, -1).split(",").map(Number);
    // Column 0 is where local +x goes: (0, -1, 0) in CSS.
    near(values.slice(0, 3), [0, -1, 0]);
  });
});
