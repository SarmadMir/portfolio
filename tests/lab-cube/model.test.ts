import { describe, expect, it } from "vitest";
import {
  applyMove,
  createCube,
  inLayer,
  invert,
  isSolved,
  scramble,
  solutionFor,
  type Move,
} from "@/app/lab/cube/model";

const play = (moves: readonly Move[]) => moves.reduce(applyMove, createCube());

describe("the cube", () => {
  it("has 27 cubies, each at its own home cell, solved", () => {
    const cube = createCube();
    expect(cube).toHaveLength(27);
    expect(new Set(cube.map((cubie) => cubie.home.join())).size).toBe(27);
    expect(isSolved(cube)).toBe(true);
  });

  it("turns only the nine cubies of the layer", () => {
    const cube = createCube();
    const move: Move = { axis: 2, layer: 1, turns: 1 };
    expect(cube.filter((cubie) => inLayer(cubie, move))).toHaveLength(9);

    const turned = applyMove(cube, move);
    const moved = turned.filter((cubie, index) => cubie !== cube[index]);
    expect(moved.every((cubie) => cubie.home[2] === 1)).toBe(true);
    expect(isSolved(turned)).toBe(false);
  });

  it("turns a quarter by the right-hand rule: +z carries +x to +y", () => {
    const turned = applyMove(createCube(), { axis: 2, layer: 1, turns: 1 });
    const edge = turned.find((cubie) => cubie.home.join() === "1,0,1");
    expect(edge?.position).toEqual([0, 1, 1]);
    // The cubie turned with its cell: its own x axis now points along +y (row-major matrix).
    expect(edge?.orientation.slice(0, 3)).toEqual([0, -1, 0]);
    expect(edge?.orientation.slice(3, 6)).toEqual([1, 0, 0]);
  });

  it("returns to solved after four quarter turns, and after a move and its inverse", () => {
    const move: Move = { axis: 0, layer: -1, turns: 1 };
    expect(isSolved(play([move, move, move, move]))).toBe(true);
    expect(isSolved(play([move, invert(move)]))).toBe(true);
  });

  it("keeps orientation: a centre turned in place is not solved", () => {
    const twisted = play([{ axis: 2, layer: 1, turns: 1 }]);
    const centre = twisted.find((cubie) => cubie.home.join() === "0,0,1");
    expect(centre?.position).toEqual([0, 0, 1]);
    expect(isSolved([centre!])).toBe(false);
  });
});

describe("the scramble", () => {
  it("is twelve quarter turns of outer layers", () => {
    const moves = scramble(7);
    expect(moves).toHaveLength(12);
    for (const move of moves) {
      expect([0, 1, 2]).toContain(move.axis);
      expect([-1, 1]).toContain(move.layer);
      expect([-1, 1]).toContain(move.turns);
    }
  });

  it("is the same for the same seed and differs between seeds", () => {
    expect(scramble(7)).toEqual(scramble(7));
    expect(scramble(7)).not.toEqual(scramble(8));
  });

  it("never turns the same layer twice running, and never sandwiches a layer between two turns of its opposite", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const moves = scramble(seed);
      for (let i = 1; i < moves.length; i += 1) {
        const sameLayer = moves[i].axis === moves[i - 1].axis && moves[i].layer === moves[i - 1].layer;
        expect(sameLayer, `seed ${seed}, move ${i}`).toBe(false);
        if (i >= 2) {
          const sandwich =
            moves[i].axis === moves[i - 1].axis &&
            moves[i].axis === moves[i - 2].axis &&
            moves[i].layer === moves[i - 2].layer;
          expect(sandwich, `seed ${seed}, move ${i}`).toBe(false);
        }
      }
    }
  });

  it("leaves the cube scrambled", () => {
    for (let seed = 1; seed <= 50; seed += 1) expect(isSolved(play(scramble(seed)))).toBe(false);
  });
});

describe("the solution", () => {
  it("is the scramble inverted, last move first", () => {
    const moves = scramble(3);
    const solution = solutionFor(moves);
    expect(solution).toHaveLength(12);
    expect(solution[0]).toEqual(invert(moves[11]));
    expect(solution[11]).toEqual(invert(moves[0]));
  });

  it("solves the scrambled cube, and not before its last turn", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const moves = scramble(seed);
      let cube = play(moves);
      const solution = solutionFor(moves);
      solution.forEach((move, index) => {
        cube = applyMove(cube, move);
        expect(isSolved(cube), `seed ${seed}, turn ${index + 1}`).toBe(index === solution.length - 1);
      });
    }
  });
});
