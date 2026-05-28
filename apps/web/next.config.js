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
      { protocol: 'https', hostname: 'cdn1.midocean.com' },
      { protocol: 'https', hostname: '**.supabase.co' }, // Supabase storage
    ],
    // Modern formats for better performance
    formats: ['image/avif', 'image/webp'],
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
