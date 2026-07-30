import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sandberg Estates – Funnel Intelligence",
    short_name: "Funnel Intel",
    description: "AI-fueled paid-performance operating system for Sandberg Estates",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#002b47",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
