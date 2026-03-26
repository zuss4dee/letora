import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["stripe"],
  async redirects() {
    return [
      {
        source: "/dashboard/rent",
        destination: "/dashboard/rent-tracker",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
