import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { metadata } from "@/app/lab/layout";
import { LAB_SLOTS } from "@/app/lab/slots";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { site } from "@/config/site";

const labDir = resolve(process.cwd(), "src/app/lab");

describe("lab slots", () => {
  it("are cube, field, lens and fold", () => {
    expect(LAB_SLOTS.map((slot) => slot.slug)).toEqual(["cube", "field", "lens", "fold"]);
  });

  it("each have a route, and the lab has no other routes", () => {
    const routes = readdirSync(labDir).filter((entry) => statSync(resolve(labDir, entry)).isDirectory());
    expect(routes.sort()).toEqual(LAB_SLOTS.map((slot) => slot.slug).sort());
  });

  it.each(LAB_SLOTS)("$slug is a client component that renders its title", ({ slug, title }) => {
    const file = resolve(labDir, slug, "page.tsx");
    expect(existsSync(file)).toBe(true);
    const source = readFileSync(file, "utf8");
    expect(source.trimStart().startsWith('"use client";')).toBe(true);
    expect(source).toContain(`>${title}</h1>`);
  });
});

describe("the lab stays out of search", () => {
  it("is noindex, nofollow for every page under /lab", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("is not in the sitemap", () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths.filter((path) => path.startsWith("/lab"))).toEqual([]);
  });

  it("is not hidden in robots.txt, so crawlers can read the noindex", () => {
    const rules = [robots().rules].flat();
    const disallowed = rules.flatMap((rule) => [rule.disallow ?? []].flat());
    expect(disallowed.filter((path) => path.startsWith("/lab"))).toEqual([]);
  });
});

describe("sitemap", () => {
  it("lists the home page on the production origin", () => {
    expect(sitemap().map((entry) => entry.url)).toEqual([`${site.url}/`]);
    expect(robots().sitemap).toBe(`${site.url}/sitemap.xml`);
  });
});
