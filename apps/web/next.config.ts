import type { NextConfig } from "next";

// Bundle Analyzer (optional, aktivieren mit ANALYZE=true)
let withBundleAnalyzer: (config: NextConfig) => NextConfig = (config) => config;
try {
  const bundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  });
  withBundleAnalyzer = bundleAnalyzer;
} catch {
  // Bundle Analyzer not installed - skip it
  console.warn('@next/bundle-analyzer not found, skipping bundle analysis');
}

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005",
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "images.clerk.dev",
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  // Optimize package imports (Tree-shaking)
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Transpile shared packages
  transpilePackages: ["@accounts/shared", "@tanstack/react-query"],
};

export default withBundleAnalyzer(nextConfig);








