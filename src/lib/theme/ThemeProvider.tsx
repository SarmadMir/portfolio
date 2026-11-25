"use client";

import { createContext, use, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  SYSTEM_LIGHT_QUERY,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  oppositeTheme,
  parseTheme,
  resolveTheme,
  type ThemeId,
  type ThemePreference,
} from "./theme";

interface ThemeContextValue {
  /** The theme on <html> right now. */
  theme: ThemeId;
  /** "system" until the visitor chooses. */
  preference: ThemePreference;
  /** Choose a theme and persist it; "system" clears the choice. */
  setTheme: (preference: ThemePreference) => void;
  /** Flip to the other theme and persist it. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// The stored choice, as an external store over localStorage.
// `undefined` means "not read yet"; the cache saves a storage read per render.
const listeners = new Set<() => void>();
let stored: ThemeId | null | undefined;

function readStored(): ThemeId | null {
  if (stored === undefined) {
    try {
      stored = parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      stored = null;
    }
  }
  return stored;
}

function writeStored(next: ThemeId | null): void {
  stored = next;
  try {
    if (next) window.localStorage.setItem(THEME_STORAGE_KEY, next);
    else window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Storage is blocked: the choice still holds for this page view.
  }
  for (const notify of listeners) notify();
}

function subscribeStored(onChange: () => void): () => void {
  // Another tab changed (or cleared) the choice.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    stored = undefined;
    onChange();
  };
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function readSystemLight(): boolean {
  return window.matchMedia(SYSTEM_LIGHT_QUERY).matches;
}

function subscribeSystem(onChange: () => void): () => void {
  const media = window.matchMedia(SYSTEM_LIGHT_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const serverStored = () => null;
const serverSystemLight = () => false;

/**
 * Owns data-theme on <html>: the system's theme by default, the visitor's
 * choice once they toggle, persisted in localStorage.
 * The inline script in the root layout sets the attribute before first paint.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const choice = useSyncExternalStore(subscribeStored, readStored, serverStored);
  const systemLight = useSyncExternalStore(subscribeSystem, readSystemLight, serverSystemLight);
  const theme = resolveTheme(choice, systemLight);

  // Reads the live sources, not `theme`: the hydration render still holds the
  // server's default, and writing that would flash the wrong theme. It also
  // restores the attribute after React's Strict Mode remount clears it in dev.
  useLayoutEffect(() => {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, resolveTheme(readStored(), readSystemLight()));
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      preference: choice ?? "system",
      setTheme: (preference) => writeStored(preference === "system" ? null : preference),
      toggle: () => writeStored(oppositeTheme(theme)),
    }),
    [theme, choice],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = use(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}
