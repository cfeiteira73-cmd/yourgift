import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    domains: ['cdn.yourgift.pt'],
  },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000', 'yourgift.pt'] },
  },
};

export default nextConfig;
