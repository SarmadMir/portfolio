// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarkBevel, setBevelShift } from "@/app/lab/cube/MarkBevel";

afterEach(cleanup);

const mark = { d: "M1 2L3 4Z", viewBox: [0, 0, 24, 24] as [number, number, number, number] };
const palette = { stone: "#141619", highlight: "rgb(70, 74, 82)", shadow: "rgb(10, 11, 13)" };

describe("the bevel mark", () => {
  it("is decoration: hidden from assistive technology", () => {
    const { container } = render(<MarkBevel mark={mark} palette={palette} shift={[1, 1.5]} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
  });

  it("draws a lit edge outside the shape and a shadowed edge inside it, and never fills the shape", () => {
    const { container } = render(<MarkBevel mark={mark} palette={palette} shift={[1, 1.5]} />);
    const drawn = [...container.querySelectorAll("svg > g, svg > path")];
    expect(drawn).toHaveLength(2);
    const [lit, shadowed] = drawn;
    // Fills are styles, so a palette may also be CSS variables that change per frame.
    expect((lit.querySelector("path") as SVGPathElement).style.fill).toBe(palette.highlight);
    expect((shadowed as SVGPathElement).style.fill).toBe(palette.shadow);
    // Each edge is the shape minus a copy of itself: two masks, each referenced once.
    const masks = [...container.querySelectorAll("mask")].map((mask) => mask.id);
    expect(masks).toHaveLength(2);
    expect(lit.getAttribute("mask")).toBe(`url(#${masks[0]})`);
    expect(shadowed.getAttribute("mask")).toBe(`url(#${masks[1]})`);
  });

  it("pushes the two copies away from the light by the shift, and can be re-shifted without rendering", () => {
    const { container } = render(<MarkBevel mark={mark} palette={palette} shift={[1, 1.5]} />);
    const svg = container.querySelector("svg")!;
    const shifted = [...svg.querySelectorAll("[data-shift]")];
    expect(shifted).toHaveLength(2);
    for (const element of shifted) expect(element.getAttribute("transform")).toBe("translate(1 1.5)");

    setBevelShift(svg, [0.25, 0.5]);
    for (const element of shifted) expect(element.getAttribute("transform")).toBe("translate(0.25 0.5)");
  });

  it("takes CSS variables for its colours", () => {
    const { container } = render(<MarkBevel mark={mark} palette={{ stone: "", highlight: "var(--hi)", shadow: "var(--lo)" }} shift={[1, 1]} />);
    const fills = [...container.querySelectorAll<SVGPathElement>("g > path, svg > path")].map((path) => path.style.fill);
    expect(fills).toEqual(["var(--hi)", "var(--lo)"]);
  });

  it("can show one part of the face, for a cubie", () => {
    const { container } = render(<MarkBevel mark={mark} palette={palette} shift={[1, 1]} viewBox={[8, 8, 8, 8]} />);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("8 8 8 8");
  });

  it("gives every instance its own mask ids", () => {
    const { container } = render(
      <>
        <MarkBevel mark={mark} palette={palette} shift={[1, 1]} />
        <MarkBevel mark={mark} palette={palette} shift={[1, 1]} />
      </>,
    );
    const ids = [...container.querySelectorAll("mask")].map((mask) => mask.id);
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z][\w-]*$/);
  });
});
