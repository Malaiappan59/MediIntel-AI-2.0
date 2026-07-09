import type { NextConfig } from "next";

const publicApiBasePath = (process.env.NEXT_PUBLIC_API_BASE_PATH ?? "/api/backend/v1").replace(/\/$/, "");
const backendOrigin = (process.env.NEXT_PRIVATE_BACKEND_ORIGIN ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    if (!publicApiBasePath.startsWith("/")) {
      return [];
    }

    return [
      {
        source: `${publicApiBasePath}/:path*`,
        destination: `${backendOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
