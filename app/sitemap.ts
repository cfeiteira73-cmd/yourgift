import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

const productSlugs = [
  "premium-leather-journal",
  "insulated-tumbler-500ml",
  "bamboo-tech-organizer",
  "organic-cotton-tee",
  "premium-gift-box-set",
  "wireless-charging-pad",
  "canvas-tote-bag",
  "embroidered-cap",
  "glass-water-bottle",
];

const blogSlugs = [
  "guia-corporate-gifts-2025",
  "onboarding-kits-melhores-praticas",
  "company-stores-vantagens",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const now = new Date();

  // Static marketing pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/catalog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/rfq`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/services`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    // Service sub-pages
    { url: `${base}/corporate-gifts`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/branded-merch`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/packaging`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/company-stores`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/fulfillment`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    // Informational pages
    { url: `${base}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    // Legal
    { url: `${base}/privacy-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Catalog product pages
  const catalogPages: MetadataRoute.Sitemap = productSlugs.map((slug) => ({
    url: `${base}/catalog/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Blog post pages
  const blogPages: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${base}/blog/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...catalogPages, ...blogPages];
}
