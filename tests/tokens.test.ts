import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderTokensCss, typeStyleVariables } from "@/lib/tokens/css";
import { readTokens } from "@/lib/tokens/model";
import source from "@/styles/tokens.json";

const css = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");
const model = readTokens();

/** Body of the first rule whose prelude is exactly `prelude` (generator output has no nested braces in these rules). */
function ruleBody(prelude: string): string {
  const start = css.indexOf(`${prelude} {\n`);
  if (start === -1) throw new Error(`no rule "${prelude}" in tokens.css`);
  const open = start + prelude.length + 2;
  return css.slice(open, css.indexOf("\n}", open));
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of body.split("\n")) {
    const match = /^\s*(--[a-z0-9-*]+|color-scheme):\s*(.+);$/.exec(line);
    if (match) out.set(match[1], match[2]);
  }
  return out;
}

/** A deep copy of the source file that tests may break on purpose. */
function editableSource() {
  return structuredClone(source) as unknown as Record<string, { tokens: { name: string; value: unknown }[] }>;
}

const dark = declarations(ruleBody(':root,\n[data-theme="dark"]'));
const light = declarations(ruleBody('[data-theme="light"]'));
const constants = declarations(ruleBody(":root"));
const themeInline = declarations(ruleBody("@theme inline reference"));
const themeStatic = declarations(ruleBody("@theme"));

describe("tokens.json → model", () => {
  it("reads the Sarmad OS v2 file", () => {
    expect(model.name).toBe("Sarmad OS");
    expect(model.version).toBe(2);
  });

  it("covers every token entry in the source file", () => {
    const sourceNames = Object.values(source as Record<string, unknown>)
      .flatMap((section) =>
        typeof section === "object" && section !== null && "tokens" in section
          ? (section as { tokens: { name: string }[] }).tokens.map((t) => t.name)
          : [],
      )
      .sort();
    const modelNames = model.sections.flatMap((s) => s.tokens.map((t) => t.name)).sort();
    expect(modelNames).toEqual(sourceNames);
    expect(modelNames.length).toBeGreaterThan(60);
  });

  it("rejects a reference to a token that does not exist", () => {
    const broken = editableSource();
    broken.color.tokens[13].value = "{no-such-token}";
    expect(() => readTokens(broken)).toThrow(/no-such-token/);
  });

  it("rejects duplicate token names", () => {
    const broken = editableSource();
    broken.radius.tokens[0].name = "ground";
    expect(() => readTokens(broken)).toThrow(/duplicate/i);
  });

  it("rejects spacing that is off the 4px grid", () => {
    const broken = editableSource();
    broken.spacing.tokens[2].value = "13px";
    expect(() => readTokens(broken)).toThrow(/space-3/);
  });
});

describe("tokens.css", () => {
  it("has a variable for every token", () => {
    const missing: string[] = [];
    for (const section of model.sections) {
      for (const token of section.tokens) {
        const where = section.themed ? dark : constants;
        if (!where.has(token.variable)) missing.push(token.variable);
      }
    }
    expect(missing).toEqual([]);
  });

  it("declares themed tokens with their dark value on :root and [data-theme=dark]", () => {
    expect(dark.get("--ground")).toBe("#141619");
    expect(dark.get("--ink")).toBe("#e7e4de");
    expect(dark.get("--accent")).toBe("#b08a5a");
  });

  it("declares themed tokens with their light value on [data-theme=light]", () => {
    expect(light.get("--ground")).toBe("#ebe7e0");
    expect(light.get("--ink")).toBe("#1f1e1b");
    expect(light.get("--accent")).toBe("#a67c4c");
  });

  it("repeats every token of a themed section in both theme blocks so nested scopes are complete", () => {
    for (const section of model.sections.filter((s) => s.themed)) {
      for (const token of section.tokens) {
        expect(dark.get(token.variable), `${token.variable} dark`).toBe(token.value.dark);
        expect(light.get(token.variable), `${token.variable} light`).toBe(token.value.light);
      }
    }
  });

  it("writes references as var() so they follow the active theme", () => {
    expect(dark.get("--focus")).toBe("var(--accent-text)");
    expect(light.get("--focus")).toBe("var(--accent-text)");
    expect(dark.get("--cube-orange")).toBe("var(--accent)");
  });

  it("sets color-scheme per theme", () => {
    expect(dark.get("color-scheme")).toBe("dark");
    expect(light.get("color-scheme")).toBe("light");
  });

  it("declares unthemed tokens once, on :root", () => {
    expect(constants.get("--space-6")).toBe("24px");
    expect(constants.get("--radius-lg")).toBe("20px");
    expect(constants.get("--duration-base")).toBe("240ms");
    expect(constants.get("--ease-spring")).toBe("cubic-bezier(0.34, 1.4, 0.64, 1)");
    expect(constants.get("--z-taskbar")).toBe("20");
    expect(light.has("--space-6")).toBe(false);
  });

  it("has variables for every role of the type scale", () => {
    const styles = model.typeGroups.flatMap((g) => g.styles);
    expect(styles.map((s) => s.name)).toEqual([
      "hero", "title-1", "title-2", "title-3",
      "body-lg", "body", "small", "taskbar",
      "mark", "label", "code",
    ]);
    for (const style of styles) {
      for (const [variable, value] of typeStyleVariables(style)) {
        expect(constants.get(variable), variable).toBe(value);
      }
    }
    expect(constants.get("--text-hero")).toBe("72px");
    expect(constants.get("--text-hero--font-weight")).toBe("300");
    expect(constants.get("--text-hero--letter-spacing")).toBe("-0.02em");
    expect(constants.get("--text-body--line-height")).toBe("24px");
  });
});

describe("tokens.css → Tailwind theme", () => {
  it("aliases the build-notes colours onto the token variables", () => {
    const expected = [
      "ground", "surface", "surface-2", "line", "line-strong",
      "ink", "ink-2", "ink-3", "accent", "accent-text", "on-accent",
      "positive", "negative",
    ];
    for (const name of expected) {
      expect(themeInline.get(`--color-${name}`), name).toBe(`var(--${name})`);
    }
    const aliased = [...themeInline.keys()].filter((k) => k.startsWith("--color-") && k !== "--color-*");
    expect(aliased).toHaveLength(expected.length);
  });

  it("points the font utilities at the next/font variables with the system's fallbacks", () => {
    expect(themeInline.get("--font-display")).toBe("var(--font-display), system-ui, sans-serif");
    expect(themeInline.get("--font-text")).toBe("var(--font-text), system-ui, sans-serif");
    expect(themeInline.get("--font-mono")).toBe('var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace');
  });

  it("aliases radii and easings, and nothing outside the system", () => {
    for (const name of ["radius-sm", "radius-md", "radius-lg", "radius-pill", "ease-standard", "ease-spring"]) {
      expect(themeInline.get(`--${name}`), name).toBe(`var(--${name})`);
    }
    for (const namespace of ["--color-*", "--font-*", "--text-*", "--radius-*", "--shadow-*", "--ease-*"]) {
      expect(themeInline.get(namespace), namespace).toBe("initial");
    }
  });

  it("aliases the three system shadows", () => {
    for (const name of ["shadow-frost", "shadow-stone", "shadow-pill"]) {
      expect(themeInline.get(`--${name}`), name).toBe(`var(--${name})`);
    }
  });

  it("makes a bare transition use a system duration and curve", () => {
    expect(themeStatic.get("--default-transition-duration")).toBe("var(--duration-fast)");
    expect(themeStatic.get("--default-transition-timing-function")).toBe("var(--ease-standard)");
  });

  it("maps the type scale onto text-* utilities", () => {
    expect(themeInline.get("--text-title-1")).toBe("var(--text-title-1)");
    expect(themeInline.get("--text-title-1--line-height")).toBe("var(--text-title-1--line-height)");
    expect(themeInline.get("--text-title-1--font-weight")).toBe("var(--text-title-1--font-weight)");
    expect(themeInline.get("--text-title-1--letter-spacing")).toBe("var(--text-title-1--letter-spacing)");
    expect(themeInline.has("--text-body--letter-spacing")).toBe(false);
  });

  it("sets the spacing unit to the 4px grid", () => {
    expect(themeStatic.get("--spacing")).toBe("4px");
  });

  it("defines t-fast, t-base and t-slow from the duration tokens", () => {
    for (const step of ["fast", "base", "slow"]) {
      expect(css).toContain(`@utility t-${step} {\n  transition-duration: var(--duration-${step});\n}`);
    }
  });
});

describe("tokens.css is generated", () => {
  it("matches the generator output byte for byte (never hand-edited)", () => {
    expect(css).toBe(renderTokensCss(model));
  });

  it("says so at the top of the file", () => {
    expect(css.startsWith("/*\n * GENERATED FILE")).toBe(true);
  });
});
