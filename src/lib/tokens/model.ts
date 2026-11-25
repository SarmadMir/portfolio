import tokensJson from "@/styles/tokens.json";

/**
 * Typed, validated view of src/styles/tokens.json (the Sarmad OS design system).
 * The first theme is the default: it is the one :root carries.
 */
export const THEMES = ["dark", "light"] as const;
export type ThemeId = (typeof THEMES)[number];

export const FONT_FAMILIES = ["display", "text", "mono"] as const;
export type FontFamilyId = (typeof FONT_FAMILIES)[number];

export interface Token {
  /** Name as the design system writes it, e.g. "surface-2". */
  name: string;
  /** The CSS custom property that carries it, e.g. "--surface-2". */
  variable: string;
  usage: string;
  /** CSS value per theme. An unthemed token carries the same value for both. */
  value: Record<ThemeId, string>;
}

export interface TokenSection {
  id: string;
  note: string;
  /** True when any token in the section differs between themes. */
  themed: boolean;
  tokens: Token[];
}

export interface TypeStyle {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
  opticalSize?: number;
  sample: string;
  usage: string;
}

export interface TypeGroup {
  name: string;
  family: FontFamilyId;
  note?: string;
  styles: TypeStyle[];
}

export interface TokenModel {
  name: string;
  version: number;
  sections: TokenSection[];
  /** font-family lists from the design system, keyed by role. */
  families: Record<FontFamilyId, string>;
  /** Web font family names the system names; next/font supplies them at runtime. */
  webFonts: string[];
  typeGroups: TypeGroup[];
  /** Spacing grid unit in px: space-N is N × unit. */
  spacingUnit: number;
}

const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const REFERENCE = /^\{([a-z0-9-]+)\}$/;

function fail(message: string): never {
  throw new Error(`tokens.json: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, where: string): Record<string, unknown> {
  return isRecord(value) ? value : fail(`${where} must be an object`);
}

function list(value: unknown, where: string): unknown[] {
  return Array.isArray(value) ? value : fail(`${where} must be an array`);
}

function text(value: unknown, where: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fail(`${where} must be a non-empty string`);
}

function count(value: unknown, where: string): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fail(`${where} must be a number`);
}

function tokenName(value: unknown, where: string): string {
  const name = text(value, where);
  return NAME.test(name) ? name : fail(`${where} "${name}" is not a valid token name`);
}

/** A literal stays as written; "{other-token}" becomes var(--other-token). */
function cssValue(raw: unknown, where: string, references: Map<string, string[]>, owner: string): string {
  const value = text(raw, where);
  const reference = REFERENCE.exec(value);
  if (!reference) return value;
  references.set(owner, [...(references.get(owner) ?? []), reference[1]]);
  return `var(--${reference[1]})`;
}

function readToken(raw: unknown, where: string, references: Map<string, string[]>): Token {
  const entry = record(raw, where);
  const name = tokenName(entry.name, `${where}.name`);
  const value = isRecord(entry.value)
    ? (Object.fromEntries(
        THEMES.map((theme) => [
          theme,
          cssValue((entry.value as Record<string, unknown>)[theme], `${name}.value.${theme}`, references, name),
        ]),
      ) as Record<ThemeId, string>)
    : (() => {
        const single = cssValue(entry.value, `${name}.value`, references, name);
        return Object.fromEntries(THEMES.map((theme) => [theme, single])) as Record<ThemeId, string>;
      })();
  return {
    name,
    variable: `--${name}`,
    usage: typeof entry.usage === "string" ? entry.usage : "",
    value,
  };
}

function readTypeStyle(raw: unknown, where: string): TypeStyle {
  const entry = record(raw, where);
  const name = tokenName(entry.name, `${where}.name`);
  return {
    name,
    fontSize: text(entry.fontSize, `${name}.fontSize`),
    lineHeight: text(entry.lineHeight, `${name}.lineHeight`),
    fontWeight: count(entry.fontWeight, `${name}.fontWeight`),
    ...(entry.letterSpacing === undefined ? {} : { letterSpacing: text(entry.letterSpacing, `${name}.letterSpacing`) }),
    ...(entry.opticalSize === undefined ? {} : { opticalSize: count(entry.opticalSize, `${name}.opticalSize`) }),
    sample: text(entry.sample, `${name}.sample`),
    usage: typeof entry.usage === "string" ? entry.usage : "",
  };
}

function readSpacingUnit(sections: TokenSection[]): number {
  const spacing = sections.find((section) => section.id === "spacing") ?? fail("the spacing section is missing");
  let unit: number | undefined;
  for (const token of spacing.tokens) {
    const step = /^space-(\d+)$/.exec(token.name);
    const px = /^(\d+(?:\.\d+)?)px$/.exec(token.value.dark);
    if (!step || !px) fail(`${token.name}: spacing tokens are space-N with a px value`);
    const size = Number(px[1]);
    unit ??= size / Number(step[1]);
    if (size !== unit * Number(step[1])) {
      fail(`${token.name} is ${size}px; the ${unit}px grid makes it ${unit * Number(step[1])}px`);
    }
  }
  return unit ?? fail("the spacing section has no tokens");
}

export function readTokens(input: unknown = tokensJson): TokenModel {
  const file = record(input, "the file");
  const references = new Map<string, string[]>();
  const sections: TokenSection[] = [];

  for (const [id, raw] of Object.entries(file)) {
    if (id === "type" || !isRecord(raw) || !Array.isArray(raw.tokens)) continue;
    const tokens = raw.tokens.map((entry, index) => readToken(entry, `${id}.tokens[${index}]`, references));
    sections.push({
      id,
      note: typeof raw.note === "string" ? raw.note : "",
      themed: tokens.some((token) => THEMES.some((theme) => token.value[theme] !== token.value[THEMES[0]])),
      tokens,
    });
  }

  const sectionOf = new Map<string, TokenSection>();
  for (const section of sections) {
    for (const token of section.tokens) {
      if (sectionOf.has(token.name)) fail(`duplicate token name "${token.name}"`);
      sectionOf.set(token.name, section);
    }
  }
  for (const [owner, targets] of references) {
    for (const target of targets) {
      const targetSection = sectionOf.get(target) ?? fail(`${owner} refers to {${target}}, which does not exist`);
      // A :root-only token cannot follow a themed one into a nested [data-theme] scope.
      if (targetSection.themed && !sectionOf.get(owner)?.themed) {
        fail(`${owner} is unthemed but refers to the themed token {${target}}`);
      }
    }
  }

  const type = record(file.type, "type");
  const rawFamilies = record(type.families, "type.families");
  const families = Object.fromEntries(
    FONT_FAMILIES.map((family) => [family, text(rawFamilies[family], `type.families.${family}`)]),
  ) as Record<FontFamilyId, string>;
  const webFonts = list(type.fonts, "type.fonts").map((font, index) =>
    text(record(font, `type.fonts[${index}]`).family, `type.fonts[${index}].family`),
  );

  const styleNames = new Set<string>();
  const typeGroups = list(type.groups, "type.groups").map((raw, index): TypeGroup => {
    const group = record(raw, `type.groups[${index}]`);
    const family = text(group.family, `type.groups[${index}].family`);
    if (!FONT_FAMILIES.includes(family as FontFamilyId)) fail(`type.groups[${index}].family "${family}" is unknown`);
    const styles = list(group.styles, `type.groups[${index}].styles`).map((style, at) =>
      readTypeStyle(style, `type.groups[${index}].styles[${at}]`),
    );
    for (const style of styles) {
      if (styleNames.has(style.name)) fail(`duplicate type style "${style.name}"`);
      styleNames.add(style.name);
    }
    return {
      name: text(group.name, `type.groups[${index}].name`),
      family: family as FontFamilyId,
      ...(typeof group.note === "string" ? { note: group.note } : {}),
      styles,
    };
  });

  return {
    name: text(file.name, "name"),
    version: count(file.version, "version"),
    sections,
    families,
    webFonts,
    typeGroups,
    spacingUnit: readSpacingUnit(sections),
  };
}
