import { FONT_FAMILIES, THEMES, type FontFamilyId, type TokenModel, type TokenSection, type TypeStyle } from "./model";

/**
 * Renders src/styles/tokens.css from the token model. Layout of the output:
 *   1. one rule per theme with every themed token (dark doubles as :root),
 *   2. :root with every unthemed token and the type scale,
 *   3. @theme: the Tailwind aliases from the design system's build notes (plus the
 *      type scale and shadows), with the colour, font, text, radius, shadow and
 *      ease namespaces reset so nothing outside the system has a utility,
 *   4. @utility t-*: one transition-duration utility per duration token.
 */

/** The colours the build notes expose as utilities (bg-ground, text-ink-2, border-line …). */
export const UTILITY_COLORS = [
  "ground",
  "surface",
  "surface-2",
  "line",
  "line-strong",
  "ink",
  "ink-2",
  "ink-3",
  "accent",
  "accent-text",
  "on-accent",
  "positive",
  "negative",
] as const;

/** Tailwind reads font-size plus these three modifiers from a --text-* theme key. */
const TEXT_UTILITY_PARTS = ["", "--line-height", "--font-weight", "--letter-spacing"];

/** CSS variables for one role of the type scale, in Tailwind's --text-* naming. */
export function typeStyleVariables(style: TypeStyle): [variable: string, value: string][] {
  const base = `--text-${style.name}`;
  const variables: [string, string][] = [
    [base, style.fontSize],
    [`${base}--line-height`, style.lineHeight],
    [`${base}--font-weight`, String(style.fontWeight)],
  ];
  if (style.letterSpacing !== undefined) variables.push([`${base}--letter-spacing`, style.letterSpacing]);
  if (style.opticalSize !== undefined) variables.push([`${base}--optical-size`, String(style.opticalSize)]);
  return variables;
}

/** The generic fonts that follow the web font in the system's family list. */
function fallbackFonts(model: TokenModel, family: FontFamilyId): string {
  const loaded = new Set(model.webFonts.flatMap((name) => [name, name.replace(/ Variable$/, "")]));
  return model.families[family]
    .split(",")
    .map((part) => part.trim())
    .filter((part) => !loaded.has(part.replace(/^"|"$/g, "")))
    .join(", ");
}

/** next/font sets --font-<role> on <html>; the system's fallbacks follow it. */
function fontStack(model: TokenModel, family: FontFamilyId): string {
  return `var(--font-${family}), ${fallbackFonts(model, family)}`;
}

function section(model: TokenModel, id: string): TokenSection {
  const found = model.sections.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`tokens.json: the ${id} section is missing`);
  return found;
}

function prefixed(model: TokenModel, id: string, prefix: string): string[] {
  return section(model, id).tokens.map((token) => {
    if (!token.name.startsWith(prefix)) throw new Error(`tokens.json: ${id} token "${token.name}" must start with ${prefix}`);
    return token.name;
  });
}

function rule(prelude: string, groups: string[][]): string {
  const body = groups
    .filter((group) => group.length > 0)
    .map((group) => group.map((line) => `  ${line}`).join("\n"))
    .join("\n\n");
  return `${prelude} {\n${body}\n}`;
}

export function renderTokensCss(model: TokenModel): string {
  const themed = model.sections.filter((candidate) => candidate.themed);
  const constant = model.sections.filter((candidate) => !candidate.themed);
  const styles = model.typeGroups.flatMap((group) => group.styles);

  const colors = new Set(section(model, "color").tokens.map((token) => token.name));
  for (const name of UTILITY_COLORS) {
    if (!colors.has(name)) throw new Error(`tokens.json: the utility colour "${name}" is not a colour token`);
  }

  // Hover, press and colour changes are the common case: the fastest duration, the arriving curve.
  const defaultDuration = prefixed(model, "duration", "duration-")[0];
  const defaultEasing = prefixed(model, "easing", "ease-")[0];

  const header = [
    "/*",
    " * GENERATED FILE — do not edit.",
    ` * Source: src/styles/tokens.json (${model.name} v${model.version}).`,
    " * Regenerate with `npm run tokens`; tests/tokens.test.ts fails when this file drifts.",
    " */",
  ].join("\n");

  const themeRules = THEMES.map((theme, index) =>
    rule(index === 0 ? `:root,\n[data-theme="${theme}"]` : `[data-theme="${theme}"]`, [
      [`color-scheme: ${theme};`],
      ...themed.map((part) => [`/* ${part.id} */`, ...part.tokens.map((token) => `${token.variable}: ${token.value[theme]};`)]),
    ]),
  );

  const constants = rule(":root", [
    ...constant.map((part) => [
      `/* ${part.id} */`,
      ...part.tokens.map((token) => `${token.variable}: ${token.value[THEMES[0]]};`),
    ]),
    ["/* type scale */", ...styles.flatMap((style) => typeStyleVariables(style).map(([name, value]) => `${name}: ${value};`))],
  ]);

  const alias = (name: string) => `--${name}: var(--${name});`;
  // inline: utilities read the token variable itself, so a nested [data-theme] repaints.
  // reference: Tailwind emits no variables of its own here; the rules above stay the only declarations.
  const themeAliases = rule("@theme inline reference", [
    ["--color-*: initial;", ...UTILITY_COLORS.map((name) => `--color-${name}: var(--${name});`)],
    ["--font-*: initial;", ...FONT_FAMILIES.map((family) => `--font-${family}: ${fontStack(model, family)};`)],
    [
      "--text-*: initial;",
      ...styles.flatMap((style) => {
        const defined = new Set(typeStyleVariables(style).map(([name]) => name));
        return TEXT_UTILITY_PARTS.map((part) => `--text-${style.name}${part}`)
          .filter((name) => defined.has(name))
          .map((name) => `${name}: var(${name});`);
      }),
    ],
    ["--radius-*: initial;", ...prefixed(model, "radius", "radius-").map(alias)],
    ["--shadow-*: initial;", ...prefixed(model, "shadow", "shadow-").map(alias)],
    ["--ease-*: initial;", ...prefixed(model, "easing", "ease-").map(alias)],
  ]);

  const themeValues = rule("@theme", [
    [
      `--spacing: ${model.spacingUnit}px;`,
      `--default-font-family: ${fontStack(model, "text")};`,
      `--default-mono-font-family: ${fontStack(model, "mono")};`,
      // A transition utility without t-* or ease-* still lands on system values.
      `--default-transition-duration: var(--${defaultDuration});`,
      `--default-transition-timing-function: var(--${defaultEasing});`,
    ],
  ]);

  const utilities = prefixed(model, "duration", "duration-").map((name) => {
    const step = name.slice("duration-".length);
    return `@utility t-${step} {\n  transition-duration: var(--${name});\n}`;
  });

  return [header, ...themeRules, constants, themeAliases, themeValues, ...utilities].join("\n\n") + "\n";
}
