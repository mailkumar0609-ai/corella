import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/login", "/terms", "/privacy", "/refunds", "/delivery", "/contact"].map((p) => ({ url: `https://corella.live${p}` }));
}
