// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme";

/** A controllable prefers-color-scheme: light. */
let systemLight = false;
const systemListeners = new Set<() => void>();
function setSystemLight(next: boolean) {
  systemLight = next;
  for (const notify of systemListeners) notify();
}

/** Mounts a fresh copy of the provider (its storage cache is module state) with a probe inside. */
async function mount() {
  vi.resetModules();
  const { ThemeProvider, useTheme } = await import("@/lib/theme/ThemeProvider");
  function Probe() {
    const { theme, preference, toggle, setTheme } = useTheme();
    return (
      <>
        <output>{`${preference}:${theme}`}</output>
        <button onClick={toggle}>toggle</button>
        <button onClick={() => setTheme("system")}>system</button>
      </>
    );
  }
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

const state = () => screen.getByRole("status").textContent;
const onHtml = () => document.documentElement.getAttribute("data-theme");

beforeEach(() => {
  systemLight = false;
  systemListeners.clear();
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === "(prefers-color-scheme: light)" ? systemLight : false;
    },
    addEventListener: (_: "change", listener: () => void) => void systemListeners.add(listener),
    removeEventListener: (_: "change", listener: () => void) => void systemListeners.delete(listener),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ThemeProvider", () => {
  it("follows the system until the visitor chooses", async () => {
    systemLight = true;
    await mount();
    expect(state()).toBe("system:light");
    expect(onHtml()).toBe("light");
  });

  it("toggle flips the theme on <html> and persists the choice", async () => {
    await mount();
    expect(state()).toBe("system:dark");

    fireEvent.click(screen.getByText("toggle"));

    expect(state()).toBe("light:light");
    expect(onHtml()).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("restores a persisted choice on the next visit, over the system theme", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    await mount();
    expect(state()).toBe("light:light");
    expect(onHtml()).toBe("light");
  });

  it("goes back to the system when the choice is cleared", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    await mount();

    fireEvent.click(screen.getByText("system"));

    expect(state()).toBe("system:dark");
    expect(onHtml()).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("tracks a system change while the visitor has not chosen", async () => {
    await mount();
    act(() => setSystemLight(true));
    expect(state()).toBe("system:light");
    expect(onHtml()).toBe("light");
  });

  it("ignores a system change once the visitor has chosen", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    await mount();
    act(() => setSystemLight(true));
    expect(state()).toBe("dark:dark");
  });

  it("picks up a choice made in another tab", async () => {
    await mount();
    act(() => {
      window.localStorage.setItem(THEME_STORAGE_KEY, "light");
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY }));
    });
    expect(state()).toBe("light:light");
    expect(onHtml()).toBe("light");
  });

  it("still switches for this page view when storage is blocked", async () => {
    await mount();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage is blocked");
    });

    fireEvent.click(screen.getByText("toggle"));

    expect(state()).toBe("light:light");
    expect(onHtml()).toBe("light");
  });
});
