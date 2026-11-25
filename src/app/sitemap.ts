import type { MetadataRoute } from "next";
import { site } from "@/config/site";

/** Public routes only. /lab is noindex and never listed here (tests/lab.test.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${site.url}/`, changeFrequency: "monthly", priority: 1 }];
}
