import { describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, oppositeTheme, parseTheme, resolveTheme, themeInitScript } from "@/lib/theme/theme";

/** Runs the inline bootstrap against a fake page and returns the data-theme it set on <html>. */
function runInitScript(page: { stored?: string | null; systemLight: boolean; storageThrows?: boolean }): string | undefined {
  const attributes = new Map<string, string>();
  const document = {
    documentElement: { setAttribute: (name: string, value: string) => void attributes.set(name, value) },
  };
  const localStorage = {
    getItem: (key: string) => {
      if (page.storageThrows) throw new Error("storage is blocked");
      return key === THEME_STORAGE_KEY ? (page.stored ?? null) : null;
    },
  };
  const matchMedia = (query: string) => ({
    matches: query === "(prefers-color-scheme: light)" ? page.systemLight : false,
  });
  new Function("document", "localStorage", "matchMedia", themeInitScript)(document, localStorage, matchMedia);
  return attributes.get("data-theme");
}

describe("resolveTheme", () => {
  it("follows the system when the visitor has not chosen", () => {
    expect(resolveTheme(null, false)).toBe("dark");
    expect(resolveTheme(null, true)).toBe("light");
  });

  it("lets a stored choice win over the system", () => {
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", true)).toBe("dark");
  });
});

describe("parseTheme", () => {
  it("accepts the two themes and nothing else", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("system")).toBeNull();
    expect(parseTheme("")).toBeNull();
    expect(parseTheme(null)).toBeNull();
  });
});

describe("oppositeTheme", () => {
  it("flips between dark and light", () => {
    expect(oppositeTheme("dark")).toBe("light");
    expect(oppositeTheme("light")).toBe("dark");
  });
});

describe("themeInitScript (runs before first paint)", () => {
  const stored = [null, "dark", "light", "sepia", ""];

  it.each(stored.flatMap((value) => [true, false].map((systemLight) => ({ value, systemLight }))))(
    "stored=$value, system light=$systemLight sets the same theme React will resolve",
    ({ value, systemLight }) => {
      expect(runInitScript({ stored: value, systemLight })).toBe(resolveTheme(parseTheme(value), systemLight));
    },
  );

  it("falls back to the system when storage is blocked", () => {
    expect(runInitScript({ systemLight: true, storageThrows: true })).toBe("light");
    expect(runInitScript({ systemLight: false, storageThrows: true })).toBe("dark");
  });
});
