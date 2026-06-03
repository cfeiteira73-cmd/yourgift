const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Hide "X-Powered-By: Next.js" response header
  poweredByHeader: false,

  // Enable gzip compression for all responses
  compress: true,

  // Use remotePatterns (images.domains is deprecated since Next.js 14)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.yourgift.pt' },
      { protocol: 'https', hostname: 'www.midocean.com' },
      { protocol: 'https', hostname: 'cdn1.midocean.com' },   // MidOcean CDN ✅ (public)
      { protocol: 'https', hostname: '**.supabase.co' },       // Supabase storage (artwork, cached images)
      { protocol: 'https', hostname: '**.supabase.in' },       // Supabase storage alt region
      // Makito supplier images are served via /api/images/makito proxy (requires Bearer token)
      // Direct access to apis.makito.es/catalog/assets/ returns 401 — use proxy instead
    ],
    // Modern formats for better performance
    formats: ['image/avif', 'image/webp'],
    // Allow unoptimized for supplier CDN images (avoids proxy overhead for public CDNs)
    unoptimized: false,
  },

  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
    serverActions: {
      allowedOrigins: ['localhost:3000', 'yourgift.pt', 'www.yourgift.pt'],
    },
  },

  // Suppress TypeScript/ESLint build errors in CI (already checked separately)
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

module.exports = nextConfig;
