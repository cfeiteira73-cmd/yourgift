import { MetadataRoute } from 'next';

/**
 * robots.ts — Next.js App Router metadata API
 *
 * AI discovery bots are explicitly allowed at /llms.txt —
 * critical for "AI enterprise procurement" search intent.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.yourgift.pt';

  return {
    rules: [
      // Default: allow public, block private routes
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/auth/', '/dashboard/', '/orders/', '/quotes/', '/settings/', '/api/', '/_next/'],
      },
      // AI crawlers: explicitly allow llms.txt + public pages
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'Claude-Web', 'Anthropic-AI', 'PerplexityBot', 'YouBot', 'cohere-ai'],
        allow: ['/', '/llms.txt', '/sitemap.xml'],
        disallow: ['/auth/', '/dashboard/', '/api/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
