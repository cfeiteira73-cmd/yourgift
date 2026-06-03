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

  // Portuguese URL redirects → English routes
  // Marketing pages use English slugs internally but PT content
  async redirects() {
    return [
      { source: '/sobre', destination: '/about', permanent: true },
      { source: '/como-funciona', destination: '/how-it-works', permanent: true },
      { source: '/catalogo', destination: '/catalog', permanent: true },
      { source: '/empresa', destination: '/about', permanent: true },
      { source: '/contacto', destination: '/quote', permanent: true },
      { source: '/orcamento', destination: '/quote', permanent: true },
      { source: '/merchandising', destination: '/catalog', permanent: true },
      { source: '/brindes', destination: '/catalog', permanent: true },
      { source: '/brindes-corporativos', destination: '/corporate-gifts', permanent: true },
      { source: '/lojas-empresa', destination: '/company-stores', permanent: true },
      { source: '/embalagem', destination: '/packaging', permanent: true },
      { source: '/fulfillment-pt', destination: '/fulfillment', permanent: true },
    ];
  },

  // Suppress TypeScript/ESLint build errors in CI (already checked separately)
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

module.exports = nextConfig;
