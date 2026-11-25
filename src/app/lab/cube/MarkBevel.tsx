"use client";

import { useId, type Ref, type SVGProps } from "react";
import type { Palette } from "./framing";
import type { Mark } from "./mark";

interface MarkBevelProps extends Omit<SVGProps<SVGSVGElement>, "viewBox" | "ref"> {
  ref?: Ref<SVGSVGElement>;
  mark: Mark;
  palette: Palette;
  /** Where the copy of the shape sits, away from the light, in viewBox units. */
  shift: readonly [x: number, y: number];
  /** The part of the face to show. Defaults to all of it. */
  viewBox?: readonly [x: number, y: number, width: number, height: number];
}

const translate = (shift: readonly [number, number]) => `translate(${shift[0]} ${shift[1]})`;

/**
 * The mark as the shader carves it: no fill, a lit edge and a shadowed edge.
 * Fills are styles, so the palette may be CSS variables (the CSS cube relights them per frame).
 * Both edges are the shape minus a copy of itself pushed away from the light:
 *   lit       inside the copy, outside the shape (the far wall catches the light)
 *   shadowed  inside the shape, outside the copy (the near wall hides it)
 */
export function MarkBevel({ mark, palette, shift, viewBox = mark.viewBox, ref, ...svg }: MarkBevelProps) {
  // useId may carry characters that url(#…) cannot.
  const id = `bevel-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const [x, y, width, height] = mark.viewBox;
  const area = { x: x - width, y: y - height, width: width * 3, height: height * 3 };

  return (
    <svg ref={ref} viewBox={viewBox.join(" ")} aria-hidden="true" focusable="false" {...svg}>
      <defs>
        <mask id={`${id}-outside`} maskUnits="userSpaceOnUse" {...area}>
          <rect {...area} fill="white" />
          <path d={mark.d} fill="black" />
        </mask>
        <mask id={`${id}-uncovered`} maskUnits="userSpaceOnUse" {...area}>
          <path d={mark.d} fill="white" />
          <path d={mark.d} fill="black" transform={translate(shift)} data-shift />
        </mask>
      </defs>
      <g mask={`url(#${id}-outside)`}>
        <path d={mark.d} style={{ fill: palette.highlight }} transform={translate(shift)} data-shift />
      </g>
      <path d={mark.d} style={{ fill: palette.shadow }} mask={`url(#${id}-uncovered)`} />
    </svg>
  );
}

/** Moves the copies without a render, for the frames of the landing. */
export function setBevelShift(svg: SVGSVGElement, shift: readonly [number, number]): void {
  for (const element of svg.querySelectorAll("[data-shift]")) element.setAttribute("transform", translate(shift));
}
