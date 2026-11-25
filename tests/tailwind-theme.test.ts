import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { compile } from "tailwindcss";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Compiles src/app/globals.css with Tailwind itself and checks what the
 * utilities turn into: the contract between tokens.css and the class names
 * the site is written in.
 */
const require = createRequire(import.meta.url);
const entry = resolve(process.cwd(), "src/app/globals.css");

const ON_SYSTEM = [
  "bg-ground", "text-ink-2", "border-line-strong", "font-display", "font-mono",
  "text-hero", "text-label", "rounded-lg", "rounded-pill", "ease-spring",
  "t-fast", "t-base", "t-slow", "p-6", "shadow-stone", "shadow-frost", "transition-colors",
];
const OFF_SYSTEM = [
  "bg-red-500", "text-white", "bg-black", "rounded-2xl", "ease-in-out",
  "font-sans", "text-sm", "text-9xl", "shadow", "shadow-md",
];

let css = "";

beforeAll(async () => {
  const compiler = await compile(readFileSync(entry, "utf8"), {
    base: dirname(entry),
    from: entry,
    loadStylesheet: async (id, base) => {
      const path = id === "tailwindcss" ? require.resolve("tailwindcss/index.css") : resolve(base, id);
      return { path, base: dirname(path), content: readFileSync(path, "utf8") };
    },
  });
  css = compiler.build([...ON_SYSTEM, ...OFF_SYSTEM]);
});

/** Declarations of the rule for one utility class. */
function utility(name: string): string {
  const start = css.indexOf(`.${name} {`);
  if (start === -1) return "";
  return css.slice(start, css.indexOf("\n  }", start));
}

describe("utilities resolve to token variables", () => {
  it("colours read the theme variable directly, so a nested [data-theme] scope repaints", () => {
    expect(utility("bg-ground")).toContain("background-color: var(--ground)");
    expect(utility("text-ink-2")).toContain("color: var(--ink-2)");
    expect(utility("border-line-strong")).toContain("border-color: var(--line-strong)");
  });

  it("font utilities use the next/font variables with the system's fallbacks", () => {
    expect(utility("font-display")).toContain("font-family: var(--font-display), system-ui, sans-serif");
    expect(utility("font-mono")).toContain('font-family: var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace');
  });

  it("a type role sets size, line height, weight and tracking together", () => {
    const hero = utility("text-hero");
    expect(hero).toContain("font-size: var(--text-hero)");
    expect(hero).toContain("var(--text-hero--line-height)");
    expect(hero).toContain("var(--text-hero--font-weight)");
    expect(hero).toContain("var(--text-hero--letter-spacing)");
  });

  it("radii and easings are the system's", () => {
    expect(utility("rounded-lg")).toContain("border-radius: var(--radius-lg)");
    expect(utility("rounded-pill")).toContain("border-radius: var(--radius-pill)");
    expect(utility("ease-spring")).toContain("transition-timing-function: var(--ease-spring)");
  });

  it("shadows are the system's, never Tailwind's black ones", () => {
    expect(utility("shadow-stone")).toContain("--tw-shadow: var(--shadow-stone)");
    expect(utility("shadow-frost")).toContain("--tw-shadow: var(--shadow-frost)");
  });

  it("a transition with no t-* still runs on a system duration and curve", () => {
    expect(utility("transition-colors")).toContain("var(--default-transition-duration)");
    expect(css).toContain("--default-transition-duration: var(--duration-fast)");
    expect(css).toContain("--default-transition-timing-function: var(--ease-standard)");
  });

  it("t-fast, t-base and t-slow set the three durations", () => {
    expect(utility("t-fast")).toContain("transition-duration: var(--duration-fast)");
    expect(utility("t-base")).toContain("transition-duration: var(--duration-base)");
    expect(utility("t-slow")).toContain("transition-duration: var(--duration-slow)");
  });

  it("spacing steps are multiples of 4px", () => {
    expect(utility("p-6")).toContain("padding: calc(var(--spacing) * 6)");
    expect(css).toMatch(/--spacing: 4px;/);
  });
});

describe("nothing outside the system exists", () => {
  it.each(OFF_SYSTEM)("%s generates no rule", (name) => {
    expect(utility(name)).toBe("");
  });
});

describe("the theme layer", () => {
  it("never declares a variable as itself (tokens stay the single declaration)", () => {
    expect(css).not.toMatch(/(--[a-z0-9-]+): var\(\1\)/);
  });

  it("scans only the app's TypeScript for class names, not docs, tests or scripts", () => {
    const source = readFileSync(entry, "utf8");
    expect(source).toContain('@import "tailwindcss" source(none);');
    expect(source).toContain('@source "../**/*.{ts,tsx}";');
  });
});

describe("base rules", () => {
  it("paints the page in ground and ink and sets the text face", () => {
    expect(css).toMatch(/body\s*\{[^}]*background-color: var\(--ground\)/);
    expect(css).toMatch(/body\s*\{[^}]*color: var\(--ink\)/);
    expect(css).toContain("--default-font-family: var(--font-text), system-ui, sans-serif");
  });

  it("draws the focus ring the system specifies", () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline: 2px solid var\(--focus\)/);
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline-offset: 2px/);
  });

  it("never turns on native smooth scrolling (Lenis is the one scroll runtime)", () => {
    expect(css).not.toMatch(/scroll-behavior:\s*smooth/);
  });
});
