import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Le micro sera demandé par la page elle-même (Phase 4), jamais par un iframe tiers.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
];

// Adresse interne de l'API (côté serveur Next.js uniquement, jamais envoyée au navigateur).
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Le navigateur appelle /v1/* sur la même origine ; Next.js relaie vers l'API.
  // Une seule adresse à exposer (utile sur iPad / Codespaces) et cookies same-origin.
  async rewrites() {
    return [{ source: "/v1/:path*", destination: `${API_INTERNAL_URL}/v1/:path*` }];
  },
  // Autorise le serveur de dev derrière l'URL HTTPS de GitHub Codespaces.
  allowedDevOrigins: ["*.app.github.dev"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
