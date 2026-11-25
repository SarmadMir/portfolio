import { expect, test } from "@playwright/test";
import tokens from "../../src/styles/tokens.json";

const colours = tokens.color.tokens.map((token) => token.name);
const typeStyles = tokens.type.groups.flatMap((group) => group.styles.map((style) => style.name));

test.describe("dev home", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("is a dev page: titled Tokens and kept out of search", async ({ page }) => {
    await expect(page).toHaveTitle("Tokens · Sarmad Mir");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tokens");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  });

  test("shows a swatch for every colour token, in both themes at once", async ({ page }) => {
    for (const theme of ["dark", "light"]) {
      const panel = page.locator(`main [data-theme="${theme}"]`);
      await expect(panel.locator('[data-section="color"] [data-token]')).toHaveCount(colours.length);
      for (const name of ["ground", "ink", "accent", "cube-orange"]) {
        await expect(panel.locator(`[data-section="color"] [data-token="${name}"]`)).toBeVisible();
      }
    }
  });

  test("paints each panel from its own theme's variables", async ({ page }) => {
    const chip = (theme: string, name: string) =>
      page
        .locator(`main [data-theme="${theme}"] [data-token="${name}"] [data-chip]`)
        .evaluate((el) => getComputedStyle(el).backgroundColor);

    // The page itself follows the system (dark here); the light panel must not inherit that.
    expect(await chip("dark", "ground")).toBe("rgb(20, 22, 25)");
    expect(await chip("light", "ground")).toBe("rgb(235, 231, 224)");
    expect(await chip("dark", "accent")).toBe("rgb(176, 138, 90)");
    expect(await chip("light", "accent")).toBe("rgb(166, 124, 76)");
    // A reference token follows the theme it is read in.
    expect(await chip("dark", "focus")).toBe("rgb(207, 169, 122)");
    expect(await chip("light", "focus")).toBe("rgb(107, 76, 37)");

    const light = page.locator('main [data-theme="light"]');
    expect(await light.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(235, 231, 224)");
    expect(await light.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(31, 30, 27)");
  });

  test("shows the other token groups too", async ({ page }) => {
    for (const section of ["shadow", "spacing", "radius", "material", "duration", "easing", "z-index"]) {
      await expect(page.locator(`[data-section="${section}"] [data-token]`).first()).toBeVisible();
    }
    await expect(page.locator('[data-section="spacing"] [data-token]')).toHaveCount(tokens.spacing.tokens.length);
  });

  test("sets every role of the type scale in its real face and size", async ({ page }) => {
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("[data-type-style]")).toHaveCount(typeStyles.length);

    const computed = (name: string) =>
      page.locator(`[data-type-style="${name}"] [data-specimen]`).evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          family: style.fontFamily.split(",")[0].replace(/"/g, ""),
          size: style.fontSize,
          lineHeight: style.lineHeight,
          weight: style.fontWeight,
          tracking: style.letterSpacing,
          variation: style.fontVariationSettings,
        };
      });

    expect(await computed("hero")).toEqual({
      family: "Bricolage Grotesque",
      size: "72px",
      lineHeight: "72px",
      weight: "300",
      tracking: "-1.44px",
      variation: '"opsz" 96',
    });
    expect(await computed("body")).toMatchObject({ family: "Instrument Sans", size: "16px", lineHeight: "24px", weight: "400" });
    expect(await computed("label")).toMatchObject({ family: "Geist Mono", size: "12px", lineHeight: "16px", weight: "500", tracking: "0.96px" });
  });

  test("links to the lab", async ({ page }) => {
    await page.getByRole("link", { name: "Lab" }).click();
    await expect(page).toHaveURL(/\/lab$/);
  });
});
