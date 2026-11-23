import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/agents", "/runs", "/billing", "/settings"] }],
    sitemap: "https://corella.live/sitemap.xml" };
}
