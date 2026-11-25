import { Bricolage_Grotesque, Geist_Mono, Instrument_Sans } from "next/font/google";

/**
 * The three faces of the design system, self-hosted by next/font.
 * Each sets its CSS variable on <html>; tokens.css turns the variables into
 * the font-display, font-text and font-mono utilities.
 */

/** Display: the hero name and titles. Optical size and width stay variable. */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "wdth"],
  variable: "--font-display",
});

/** Text: everything that is read. Width stays variable. */
const text = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
  variable: "--font-text",
});

/** Mono: the mark, labels, dates, code. */
const mono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

/** Class names for <html> that define --font-display, --font-text and --font-mono. */
export const fontVariables = `${display.variable} ${text.variable} ${mono.variable}`;
