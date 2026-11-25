import { expect, test, type Page } from "@playwright/test";

/**
 * /lab/cube, the boot prototype. Each branch must reach the landing:
 * the mark in its 40 px slot top centre, the hero up, the cube gone.
 */

const play = (page: Page) => page.getByRole("button", { name: "Play", exact: true }).click();
const lab = (page: Page) => page.locator("[data-cube-lab]");

async function expectLanded(page: Page, width: number) {
  await expect(lab(page)).toHaveAttribute("data-stage", "landed", { timeout: 20_000 });
  const mark = page.locator("[data-mark]");
  await expect(mark).toBeVisible();
  // Flip has finished when the mark sits exactly in the slot.
  await expect
    .poll(async () => {
      const box = await mark.boundingBox();
      return box && [Math.round(box.x + box.width / 2), Math.round(box.y), Math.round(box.width), Math.round(box.height)];
    })
    .toEqual([Math.round(width / 2), 24, 40, 40]);
  for (const line of await page.locator("[data-hero-line]").all()) {
    await expect.poll(() => line.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  }
  await expect(page.locator("[data-hero]")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("[data-cube-renderer]")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
}

test("is a noindex lab page with its title", async ({ page }) => {
  await page.goto("/lab/cube");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cube");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});

test.describe("full motion at 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("solves on one WebGL canvas, dollies, and lands; logs its draw calls", async ({ page }) => {
    const info: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "info") info.push(message.text());
    });
    await page.goto("/lab/cube");
    await expect(page.locator('[data-cube-renderer="webgl"]')).toHaveCount(1);
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.locator("[data-phase]")).toHaveText("turn 0 of 12");

    await play(page);
    await expect(page.locator("[data-phase]")).toHaveText(/turn [1-9]/);
    await expect(page.locator("canvas")).toHaveCount(1);
    await expectLanded(page, 1440);

    const line = info.find((text) => text.startsWith("[lab/cube]"));
    expect(line).toMatch(/full motion, 1 draw call · [\d,]+ triangles · [\d.]+ fps average/);
    await expect(page.locator("[data-stats]")).toContainText("1 draw call");
  });

  test("the slider drives the turns, and turns back when it falls", async ({ page }) => {
    await page.goto("/lab/cube");
    const slider = page.getByLabel("Load");
    await slider.fill("50");
    await expect(page.locator("[data-phase]")).toHaveText("turn 6 of 12");
    await slider.fill("10");
    await expect(page.locator("[data-phase]")).toHaveText("turn 1 of 12");
    await expect(lab(page)).toHaveAttribute("data-stage", "boot");
  });

  test("leaving after the landing and coming back keeps the landing; Play does not run it again", async ({ page }) => {
    await page.goto("/lab/cube");
    await play(page);
    await expectLanded(page, 1440);
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Lab" }).click();
    await expect(page).toHaveURL(/\/lab$/);
    await page.getByRole("link", { name: "Cube" }).click();
    await expect(page).toHaveURL(/\/lab\/cube$/);
    await expect(lab(page)).toHaveAttribute("data-stage", "landed");
    await expect(page.locator("[data-phase]")).toHaveText("landed");
    await play(page);
    await page.waitForTimeout(1500);
    await expect(lab(page)).toHaveAttribute("data-stage", "landed");
    await expect(page.locator("canvas")).toHaveCount(0);
    await expectLanded(page, 1440);
  });

  test("crossing the mobile breakpoint mid-run starts over, visibly, on the CSS cube", async ({ page }) => {
    await page.goto("/lab/cube");
    await page.getByRole("button", { name: "Replay" }).click();
    await expect(page.locator("[data-phase]")).toHaveText(/turn [1-9]/);
    await page.setViewportSize({ width: 700, height: 900 });
    await expect(lab(page)).toHaveAttribute("data-branch", "full css");
    await expect(lab(page)).toHaveAttribute("data-stage", "boot");
    await expect(page.locator('[data-cube-renderer="css"]')).toHaveCount(1);
    await page.waitForTimeout(1200);
    await expect(page.locator("[data-phase]")).toHaveText("turn 0 of 12");
    await expect(page.locator("[data-mark]")).toHaveCount(0);
  });

  test("a round trip across the breakpoint after the landing is a new run each way, and it lands again", async ({ page }) => {
    await page.goto("/lab/cube");
    await play(page);
    await expectLanded(page, 1440);
    await page.setViewportSize({ width: 700, height: 900 });
    await expect(lab(page)).toHaveAttribute("data-branch", "full css");
    await expect(lab(page)).toHaveAttribute("data-stage", "boot");
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(lab(page)).toHaveAttribute("data-branch", "full webgl");
    await expect(lab(page)).toHaveAttribute("data-stage", "boot");
    await expect(page.locator("[data-phase]")).toHaveText("turn 0 of 12");
    await expect(page.locator("canvas")).toHaveCount(1);
    await play(page);
    await expectLanded(page, 1440);
  });

  test("a branch switch mid-turn leaves the canvas idle", async ({ page }) => {
    await page.goto("/lab/cube");
    await page.getByLabel("Load").fill("40");
    await expect(lab(page)).toHaveAttribute("data-animating", "true");
    await page.getByLabel("Reduced motion").check();
    await expect(lab(page)).toHaveAttribute("data-animating", "false");
  });

  test("the slider moves in whole steps from the keyboard", async ({ page }) => {
    await page.goto("/lab/cube");
    const slider = page.getByLabel("Load");
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveValue("2");
    await expect(slider).toHaveAttribute("aria-valuetext", "2 percent");
    // The value is announced through the slider only: no live region repeats it.
    await expect(page.locator("output")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("replay starts over from the scrambled cube and lands again", async ({ page }) => {
    await page.goto("/lab/cube");
    await play(page);
    await expectLanded(page, 1440);
    await page.getByRole("button", { name: "Replay" }).click();
    await expect(lab(page)).toHaveAttribute("data-stage", "boot");
    await expect(page.locator("canvas")).toHaveCount(1);
    await expectLanded(page, 1440);
  });
});

test.describe("reduced motion", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

  test("shows the solved cube and a bar, then crossfades; nothing turns", async ({ page }) => {
    await page.goto("/lab/cube");
    await expect(lab(page)).toHaveAttribute("data-branch", "reduced webgl");
    const bar = page.getByRole("progressbar", { name: "Loading" });
    await expect(bar).toBeVisible();
    await expect(page.locator("[data-phase]")).toHaveText("loading");

    // Nothing moves on the canvas: it never asks for continuous frames, crossfade included.
    const animating: string[] = [];
    const watch = setInterval(() => {
      lab(page)
        .getAttribute("data-animating")
        .then((value) => animating.push(value ?? ""))
        .catch(() => {});
    }, 50);
    await play(page);
    await expect(bar).toHaveAttribute("aria-valuenow", "100", { timeout: 10_000 });
    await expect(page.locator("[data-phase]")).not.toHaveText(/turn/);
    await expectLanded(page, 1440);
    clearInterval(watch);
    expect(animating.length).toBeGreaterThan(10);
    expect(animating).not.toContain("true");
    await expect(page.locator("[data-stats]")).toContainText("static cube");
    await expect(page.locator("[data-hero]")).toHaveCSS("opacity", "1");
    // The crossfade covers the cube, not the page: the breadcrumb stays visible and usable.
    const veil = await page.locator("[data-veil]").boundingBox();
    const crumbs = await page.getByRole("navigation", { name: "Breadcrumb" }).boundingBox();
    expect(veil && crumbs).toBeTruthy();
    const overlaps =
      veil!.x < crumbs!.x + crumbs!.width && crumbs!.x < veil!.x + veil!.width && veil!.y < crumbs!.y + crumbs!.height && crumbs!.y < veil!.y + veil!.height;
    expect(overlaps).toBe(false);
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Lab" }).click();
    await expect(page).toHaveURL(/\/lab$/);
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("runs the CSS cube with no canvas and no three.js, and lands", async ({ page }) => {
    const scripts: Promise<string>[] = [];
    page.on("response", (response) => {
      if (/\.js(\?|$)/.test(response.url())) scripts.push(response.text().catch(() => ""));
    });
    await page.goto("/lab/cube");
    await expect(lab(page)).toHaveAttribute("data-branch", "full css");
    await expect(page.locator('[data-cube-renderer="css"] [data-face]')).toHaveCount(27 * 6);
    await expect(page.locator('[data-cube-renderer="css"] svg')).toHaveCount(9);

    await play(page);
    await expect(page.locator("canvas")).toHaveCount(0);
    await expectLanded(page, 375);

    const bodies = await Promise.all(scripts);
    expect(bodies.filter((body) => body.includes("WebGLRenderer"))).toHaveLength(0);
  });
});
