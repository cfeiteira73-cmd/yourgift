/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['cdn.yourgift.pt', 'www.midocean.com', 'cdn1.midocean.com'],
  },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000', 'yourgift.pt'] },
  },
};

module.exports = nextConfig;
