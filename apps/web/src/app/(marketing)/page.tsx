import type { Metadata } from 'next';
import { HeroSection } from '@/components/marketing/hero';
import { ClientLogos } from '@/components/marketing/client-logos';
import { TrustStrip } from '@/components/marketing/trust-strip';
import { ProductCategoriesShowcase } from '@/components/marketing/product-categories-showcase';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { FeaturedCatalog } from '@/components/marketing/featured-catalog';
import { TestimonialsSection } from '@/components/marketing/testimonials-section';
import { BeforeAfterSection } from '@/components/marketing/before-after-section';
import { NumbersSection } from '@/components/marketing/numbers-section';
import { SolutionsGrid } from '@/components/marketing/solutions-grid';
import { PricingTransparencySection } from '@/components/marketing/pricing-transparency-section';
import { AIProjectBuilder } from '@/components/marketing/ai-project-builder';
import { CompanyStoresShowcase } from '@/components/marketing/company-stores-showcase';
import { OperationsSection } from '@/components/marketing/operations-section';
import { PartnersCertifications } from '@/components/marketing/partners-certifications';
import { FAQSection } from '@/components/marketing/faq-section';
import { CTAFinal } from '@/components/marketing/cta-final';

export const metadata: Metadata = {
  title: 'Corporate Gifts, Branded Merch & Company Stores — 20.000+ Produtos | yourgift.pt',
  description:
    'Plataforma premium B2B de corporate gifts, branded merchandise, packaging personalizado e company stores para empresas em Portugal. 20.000+ produtos, 312 clientes activos, resposta em 48h garantida.',
};

export default function HomePage() {
  return (
    <>
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
