import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  canonical?: string;
  noIndex?: boolean;
  keywords?: string[];
}

export function constructMetadata({
  title,
  description = siteConfig.description,
  image = siteConfig.ogImage,
  canonical,
  noIndex = false,
  keywords = [],
}: SEOProps = {}): Metadata {
  const metaTitle = title
    ? `${title} | yourgift.pt`
    : "yourgift.pt — Corporate Gifts, Branded Merch & Company Stores";

  const baseKeywords = [
    "corporate gifts Portugal",
    "branded merchandise Portugal",
    "company stores",
    "merchandising personalizado empresas",
    "onboarding kits",
    "presentes corporativos",
    "merchandising premium",
    "packaging personalizado",
  ];

  return {
    title: metaTitle,
    description,
    keywords: [...baseKeywords, ...keywords],
    authors: [{ name: "yourgift.pt" }],
    creator: "yourgift.pt",
    metadataBase: new URL(siteConfig.url),
    alternates: {
      canonical: canonical || siteConfig.url,
      languages: {
        "pt-PT": canonical || siteConfig.url,
      },
    },
    openGraph: {
      title: metaTitle,
      description,
      url: canonical || siteConfig.url,
      siteName: siteConfig.name,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: metaTitle,
        },
      ],
      locale: "pt_PT",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description,
      images: [image],
      creator: siteConfig.social.twitter,
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}
