import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const upstream = process.env.LOCAL_AUTH_UPSTREAM;
    return upstream ? [
      { source: "/auth/v1/:path*", destination: `${upstream}/:path*` },
      { source: "/api/:path*", destination: "http://api:8000/:path*" },
    ] : [];
  },
};

export default nextConfig;
