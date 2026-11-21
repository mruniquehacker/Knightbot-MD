import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RAPHAËL — Personal Intelligence System",
    short_name: "RAPHAËL",
    description: "Assistant IA personnel",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#05070d",
    theme_color: "#05070d",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
