import path from "node:path";

import type { NextConfig } from "next";

// The browser talks to "/api/v1/*"; Next proxies it to the FastAPI backend. This keeps the API
// same-origin (no CORS, cookies-ready) and lets Vercel point BACKEND_URL at Railway/Render.
const backend = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Dev builds go to a separate, git-ignored folder so `next dev` never collides with production
  // output (and cloud-synced folders like OneDrive don't lock the files the dev server is writing).
  // NEXT_DIST_DIR overrides both (e.g. CI or verifying a build without touching .next).
  distDir: process.env.NEXT_DIST_DIR ?? (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(process.cwd()),
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${backend}/api/v1/:path*` }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
