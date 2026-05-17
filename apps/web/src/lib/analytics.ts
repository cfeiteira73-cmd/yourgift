export const ANALYTICS_EVENTS = {
  HERO_CTA_CLICK: 'hero_cta_click',
  CLICK_HERO_CTA: 'hero_cta_click',
  CTA_CLICK: 'cta_click',
  RFQ_STARTED: 'rfq_started',
  CATALOG_VIEWED: 'catalog_viewed',
  COMPLETE_AI_BUILDER: 'complete_ai_builder',
  AI_BUILDER_TO_RFQ: 'ai_builder_to_rfq',
};

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    console.log('[analytics]', event, properties);
  }
}
