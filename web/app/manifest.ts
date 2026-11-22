import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Corella: AI agent testing",
    short_name: "Corella",
    description: "Test your AI chat and voice agents with realistic customers in 13 Indian languages.",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f3f4f8",
    theme_color: "#1b2140",
    categories: ["business", "developer", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Agents", url: "/agents", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Test runs", url: "/runs", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
