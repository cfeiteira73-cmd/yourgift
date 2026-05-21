const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['cdn.yourgift.pt', 'www.midocean.com', 'cdn1.midocean.com'],
  },
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
    serverActions: { allowedOrigins: ['localhost:3000', 'yourgift.pt', 'www.yourgift.pt'] },
  },
};

module.exports = nextConfig;
