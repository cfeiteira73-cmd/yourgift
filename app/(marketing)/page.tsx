import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";
import { HeroSection } from "@/components/marketing/hero";
import { ClientLogos } from "@/components/marketing/client-logos";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { ProductCategoriesShowcase } from "@/components/marketing/product-categories-showcase";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { FeaturedCatalog } from "@/components/marketing/featured-catalog";
import { TestimonialsSection } from "@/components/marketing/testimonials-section";
import { SolutionsGrid } from "@/components/marketing/solutions-grid";
import { AIProjectBuilder } from "@/components/marketing/ai-project-builder";
import { CompanyStoresShowcase } from "@/components/marketing/company-stores-showcase";
import { OperationsSection } from "@/components/marketing/operations-section";
import { FAQSection } from "@/components/marketing/faq-section";
import { CTAFinal } from "@/components/marketing/cta-final";
import { BeforeAfterSection } from "@/components/marketing/before-after-section";
import { PricingTransparencySection } from "@/components/marketing/pricing-transparency-section";
import { PartnersCertifications } from "@/components/marketing/partners-certifications";
import { NumbersSection } from "@/components/marketing/numbers-section";

export const metadata: Metadata = constructMetadata({
  title: "Corporate Gifts, Branded Merch & Company Stores — 20.000+ Produtos",
  description:
    "Plataforma premium B2B de corporate gifts, branded merchandise, packaging personalizado e company stores para empresas em Portugal. 20.000+ produtos, 312 clientes activos, resposta em 48h garantida.",
  keywords: [
    "corporate gifts Portugal",
    "branded merchandise Portugal",
    "merchandising empresas",
    "company stores privadas",
    "onboarding kits",
    "presentes corporativos premium",
    "merch personalizado",
    "brindes empresariais",
  ],
});

export default function HomePage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yourgift.pt";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${appUrl}/#organization`,
        name: "yourgift.pt",
        url: appUrl,
        logo: {
          "@type": "ImageObject",
          url: `${appUrl}/icon.svg`,
        },
        description:
          "Plataforma B2B premium para corporate gifts, branded merchandise, packaging e company stores em Portugal. 20.000+ produtos, 312 clientes activos.",
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "sales",
          email: "hello@yourgift.pt",
          availableLanguage: "Portuguese",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.9",
          reviewCount: "312",
          bestRating: "5",
        },
        sameAs: [],
      },
      {
        "@type": "WebSite",
        "@id": `${appUrl}/#website`,
        url: appUrl,
        name: "yourgift.pt",
        description:
          "Corporate gifts, branded merchandise, packaging e company stores para empresas em Portugal. 20.000+ produtos disponíveis.",
        publisher: { "@id": `${appUrl}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${appUrl}/catalog?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HeroSection />
      <ClientLogos />
      <TrustStrip />
      <ProductCategoriesShowcase />
      <HowItWorks />
      <FeaturedCatalog />
      <TestimonialsSection />
      <BeforeAfterSection />
      <NumbersSection />
      <SolutionsGrid />
      <PricingTransparencySection />
      <AIProjectBuilder />
      <CompanyStoresShowcase />
      <OperationsSection />
      <PartnersCertifications />
      <FAQSection />
      <CTAFinal />
    </>
  );
}
