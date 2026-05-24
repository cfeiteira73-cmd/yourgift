import { MetadataRoute } from 'next';

/**
 * Next.js robots.ts — generates /robots.txt dynamically.
 * Complements the static /public/robots.txt as the canonical source.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/auth/', '/dashboard/', '/orders/', '/quotes/', '/api/'],
      },
      {
        userAgent: ['GPTBot', 'Claude-Web', 'PerplexityBot'],
        allow: '/',
      },
    ],
    sitemap: 'https://www.yourgift.pt/sitemap.xml',
  };
}
