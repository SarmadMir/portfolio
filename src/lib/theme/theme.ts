/**
 * Light/dark theme rules, free of React and the DOM so the inline bootstrap,
 * the provider and the tests all share one definition.
 * The first theme is the default: the one :root carries in tokens.css.
 */
export const THEMES = ["dark", "light"] as const;
export type ThemeId = (typeof THEMES)[number];

/** "system" until the visitor chooses a theme. */
export type ThemePreference = ThemeId | "system";

export const THEME_STORAGE_KEY = "theme";
export const THEME_ATTRIBUTE = "data-theme";
export const SYSTEM_LIGHT_QUERY = "(prefers-color-scheme: light)";

/** A stored value is only trusted when it names a theme. */
export function parseTheme(value: unknown): ThemeId | null {
  return value === "dark" || value === "light" ? value : null;
}

/** The visitor's stored choice wins; otherwise follow the system. */
export function resolveTheme(stored: ThemeId | null, systemPrefersLight: boolean): ThemeId {
  return stored ?? (systemPrefersLight ? "light" : "dark");
}

export function oppositeTheme(theme: ThemeId): ThemeId {
  return theme === "dark" ? "light" : "dark";
}

/**
 * Sets data-theme on <html> while the document is still parsing, so the first
 * paint is already in the right theme. Same rules as resolveTheme, written out
 * because it runs before any module loads (tests/theme.test.ts keeps them equal).
 */
export const themeInitScript = `(function(){try{var t=null;try{t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})}catch(e){}if(t!=="dark"&&t!=="light"){t=matchMedia(${JSON.stringify(
  SYSTEM_LIGHT_QUERY,
)}).matches?"light":"dark"}document.documentElement.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)},t)}catch(e){}})()`;
