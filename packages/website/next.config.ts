import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
} satisfies NextConfig;

const withMDX = createMDX();

export default withMDX(nextConfig);
