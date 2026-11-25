import { expect, test, type Page } from "@playwright/test";

/** Records every value data-theme takes on <html>, starting before the document parses. */
async function recordThemes(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    const read = () => {
      const value = document.documentElement?.getAttribute("data-theme");
      if (value && seen.at(-1) !== value) seen.push(value);
    };
    new MutationObserver(read).observe(document, { attributes: true, attributeFilter: ["data-theme"], childList: true, subtree: true });
    const loop = () => {
      read();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    Object.assign(window, { __themesSeen: seen });
  });
  return () => page.evaluate(() => (window as unknown as { __themesSeen: string[] }).__themesSeen);
}

const groundOf = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("theme", () => {
  for (const [scheme, ground] of [
    ["dark", "rgb(20, 22, 25)"],
    ["light", "rgb(235, 231, 224)"],
  ] as const) {
    test(`a ${scheme} system gets the ${scheme} theme from the first paint`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: scheme });
      const page = await context.newPage();
      const themesSeen = await recordThemes(page);
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
      expect(await themesSeen()).toEqual([scheme]);
      expect(await groundOf(page)).toBe(ground);
      await context.close();
    });
  }

  test("a stored choice wins over the system and never flashes it", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    await context.addInitScript(() => window.localStorage.setItem("theme", "light"));
    const page = await context.newPage();
    const themesSeen = await recordThemes(page);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await themesSeen()).toEqual(["light"]);
    await context.close();
  });
});

test.describe("scroll runtime", () => {
  test("Lenis drives the scroll and native smooth scrolling is off", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/\blenis\b/);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
  });

  test("reduced motion leaves the page on native scroll", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).not.toHaveClass(/\blenis\b/);
    await context.close();
  });
});

test.describe("3D is lazy", () => {
  for (const path of ["/", "/lab"]) {
    test(`${path} creates no canvas and downloads no three.js`, async ({ page }) => {
      const scripts: Promise<string>[] = [];
      page.on("response", (response) => {
        if (/\.js(\?|$)/.test(response.url())) scripts.push(response.text().catch(() => ""));
      });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("canvas")).toHaveCount(0);
      const bodies = await Promise.all(scripts);
      expect(bodies.length).toBeGreaterThan(0);
      expect(bodies.filter((body) => body.includes("WebGLRenderer"))).toHaveLength(0);
    });
  }
});

test.describe("fonts", () => {
  test("the three faces load and the body is set in the text face", async ({ page }) => {
    await page.goto("/");
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        body: getComputedStyle(document.body).fontFamily,
        loaded: [...document.fonts].filter((face) => face.status === "loaded").map((face) => face.family.replace(/"/g, "")),
      };
    });
    expect(fonts.body).toMatch(/^"?Instrument Sans/);
    expect(fonts.loaded).toContain("Instrument Sans");
  });
});

test.describe("lab", () => {
  test("lists the four slots", async ({ page }) => {
    await page.goto("/lab");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lab");
    await expect(page.getByRole("listitem").getByRole("link")).toHaveText(["Cube", "Field", "Lens", "Fold"]);
  });

  for (const [slug, title] of [
    ["cube", "Cube"],
    ["field", "Field"],
    ["lens", "Lens"],
    ["fold", "Fold"],
  ]) {
    test(`/lab/${slug} is a noindex page with only its title`, async ({ page }) => {
      await page.goto(`/lab/${slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
      await expect(page.locator("main > *")).toHaveCount(2); // the Lab link and the title
    });
  }
});

test.describe("security headers", () => {
  test("every response carries the headers from next.config.ts", async ({ request }) => {
    const headers = (await request.get("/")).headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});
