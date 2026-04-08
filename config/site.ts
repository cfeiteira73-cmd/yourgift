export const siteConfig = {
  name: "yourgift",
  fullName: "yourgift.pt",
  description:
    "Merch premium, corporate gifts e company stores com experiência B2B de novo nível. Da recomendação à produção, do mockup ao fulfillment.",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://yourgift.pt",
  ogImage: "/og-image.jpg",
  links: {
    linkedin: "https://linkedin.com/company/yourgift",
    instagram: "https://instagram.com/yourgift.pt",
    email: "hello@yourgift.pt",
    phone: "+351 210 000 000",
  },
  company: {
    address: "Lisboa, Portugal",
    vat: "PT000000000",
  },
  social: {
    twitter: "@yourgiftpt",
  },
} as const;

export type SiteConfig = typeof siteConfig;
