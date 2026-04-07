import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
        source: "/dashboard/rent",
        destination: "/dashboard/rent-tracker",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
