import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { site } from "@/config/site";
import {
  THEMES,
  readTokens,
  type FontFamilyId,
  type ThemeId,
  type Token,
  type TokenSection,
  type TypeStyle,
} from "@/lib/tokens/model";

/**
 * Dev home: every token of the design system as it renders, straight from
 * the variables in tokens.css. A development page; M1 replaces this file with
 * the real home.
 */
export const metadata: Metadata = {
  // The root layout's title template skips pages in its own segment, so the suffix is written out.
  title: `Tokens · ${site.name}`,
  description:
    "Token swatches and the type scale of the Sarmad OS design system, rendered from tokens.css. A development page, not part of the site.",
  // Dev page only: the real home, which replaces this file, is indexed.
  robots: { index: false, follow: false },
};

const model = readTokens();
const themedSections = model.sections.filter((section) => section.themed);
const constantSections = model.sections.filter((section) => !section.themed);
const tokenCount = model.sections.reduce((total, section) => total + section.tokens.length, 0);
const typeStyleCount = model.typeGroups.reduce((total, group) => total + group.styles.length, 0);

// Whole class names, so Tailwind finds them in this file.
const FONT_CLASS: Record<FontFamilyId, string> = {
  display: "font-display",
  text: "font-text",
  mono: "font-mono",
};
const GRID: Record<string, string> = {
  color: "grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-4",
  shadow: "grid grid-cols-1 gap-8 sm:grid-cols-3",
  spacing: "flex flex-col gap-3",
  radius: "grid grid-cols-2 gap-4 sm:grid-cols-4",
};
const VALUE_GRID = "grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4";

const eyebrow = "font-mono text-label text-ink-2 uppercase";
const note = "max-w-[65ch] text-small text-ink-2";

/** The token drawn with its own variable, read in whatever theme scope it sits in. */
function TokenVisual({ sectionId, token }: { sectionId: string; token: Token }) {
  const value = `var(${token.variable})`;
  switch (sectionId) {
    case "color":
      return <div data-chip aria-hidden className="h-12 rounded-md border border-line" style={{ backgroundColor: value }} />;
    case "shadow":
      return <div data-chip aria-hidden className="h-12 rounded-md bg-surface" style={{ boxShadow: value }} />;
    case "spacing":
      return <div data-chip aria-hidden className="h-3 rounded-sm bg-accent" style={{ width: value }} />;
    case "radius":
      return <div data-chip aria-hidden className="size-12 border border-line-strong bg-surface-2" style={{ borderRadius: value }} />;
    default:
      return null;
  }
}

function TokenGroup({ section, theme }: { section: TokenSection; theme: ThemeId }) {
  return (
    <div data-section={section.id} className="flex flex-col gap-4">
      <h3 className={eyebrow}>{section.id}</h3>
      <p className={note}>{section.note}</p>
      <ul className={GRID[section.id] ?? VALUE_GRID}>
        {section.tokens.map((token) => (
          <li key={token.name} data-token={token.name} className="flex min-w-0 flex-col gap-2">
            <TokenVisual sectionId={section.id} token={token} />
            <div className="flex min-w-0 flex-col font-mono text-code">
              <span className="break-words">{token.name}</span>
              <span className="break-words text-ink-2">{token.value[theme]}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TypeRow({ style, family }: { style: TypeStyle; family: FontFamilyId }) {
  const part = (suffix = "") => `var(--text-${style.name}${suffix})`;
  const specimen: CSSProperties = {
    fontSize: part(),
    lineHeight: part("--line-height"),
    fontWeight: part("--font-weight"),
    ...(style.letterSpacing === undefined ? {} : { letterSpacing: part("--letter-spacing") }),
    ...(style.opticalSize === undefined ? {} : { fontVariationSettings: `"opsz" ${part("--optical-size")}` }),
  };
  const spec = [
    `${style.fontSize} / ${style.lineHeight}`,
    String(style.fontWeight),
    style.letterSpacing,
    style.opticalSize === undefined ? undefined : `opsz ${style.opticalSize}`,
  ].filter(Boolean);

  return (
    <li
      data-type-style={style.name}
      className="grid gap-x-8 gap-y-2 border-t border-line py-6 md:grid-cols-[14rem_minmax(0,1fr)] md:items-baseline"
    >
      <div className="flex flex-col font-mono text-code">
        <span>{style.name}</span>
        <span className="text-ink-2">{spec.join(" · ")}</span>
      </div>
      <p data-specimen className={`${FONT_CLASS[family]} min-w-0 break-words`} style={specimen}>
        {style.sample}
      </p>
    </li>
  );
}

export default function DevHome() {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-24 px-4 py-12 md:px-16 md:py-16">
      <header className="flex flex-col gap-4">
        <p className={eyebrow}>
          {model.name} v{model.version} · dev home
        </p>
        <h1 className="font-display text-title-1">Tokens</h1>
        <p className="max-w-[60ch] text-body-lg text-ink-2">
          {tokenCount} tokens and {typeStyleCount} type roles, rendered from the variables in tokens.css. Prototypes
          live in the{" "}
          <Link
            href="/lab"
            className="text-accent-text underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-accent-text"
          >
            Lab
          </Link>
          .
        </p>
      </header>

      <section aria-labelledby="themed" className="flex flex-col gap-8">
        <h2 id="themed" className="font-display text-title-2">
          Themed
        </h2>
        <div className="grid gap-8 xl:grid-cols-2">
          {THEMES.map((theme) => (
            <div
              key={theme}
              data-theme={theme}
              className="flex min-w-0 flex-col gap-12 rounded-lg bg-ground p-4 text-ink shadow-stone md:p-6"
            >
              <p className={eyebrow}>data-theme=&quot;{theme}&quot;</p>
              {themedSections.map((section) => (
                <TokenGroup key={section.id} section={section} theme={theme} />
              ))}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="constant" className="flex flex-col gap-12">
        <h2 id="constant" className="font-display text-title-2">
          Constant
        </h2>
        {constantSections.map((section) => (
          <TokenGroup key={section.id} section={section} theme={THEMES[0]} />
        ))}
      </section>

      <section aria-labelledby="type" className="flex flex-col gap-12">
        <h2 id="type" className="font-display text-title-2">
          Type scale
        </h2>
        {model.typeGroups.map((group) => (
          <div key={group.name} className="flex flex-col gap-4">
            <h3 className={eyebrow}>{group.name}</h3>
            {group.note ? <p className={note}>{group.note}</p> : null}
            <ul>
              {group.styles.map((style) => (
                <TypeRow key={style.name} style={style} family={group.family} />
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}
