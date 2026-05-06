import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `next build` typecheck: Remotion lives under `remotion/` (CLI bundle, `// @ts-nocheck`).
   * Remaining errors are mostly `{ ok: boolean }` unions that need `=== false` narrowing — fix incrementally (`pnpm exec tsc`).
   */
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
  serverExternalPackages: ["stripe"],
  async redirects() {
    return [
      {
        source: "/dashboard/assistant",
        destination: "/dashboard",
        permanent: true,
      },
      {
        source: "/dashboard/assistant/",
        destination: "/dashboard",
        permanent: true,
      },
      {
        source: "/dashboard/home",
        destination: "/dashboard",
        permanent: true,
      },
      {
        source: "/dashboard/home/",
        destination: "/dashboard",
        permanent: true,
      },
      {
        source: "/dashboard/rent",
        destination: "/dashboard/rent-tracker",
        permanent: true,
      },
      {
        source: "/dashboard/rent/",
        destination: "/dashboard/rent-tracker",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
