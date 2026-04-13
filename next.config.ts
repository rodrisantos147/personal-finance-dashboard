import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  transpilePackages: ["pdfjs-dist"],
};

export default nextConfig;
