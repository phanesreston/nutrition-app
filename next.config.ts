import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set NEXT_PUBLIC_BASE_PATH (e.g. "/nutrition-app") to serve the app under a sub-path.
  // It is read at build time, so rebuild after changing it.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
