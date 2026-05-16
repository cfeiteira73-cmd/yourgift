export const ANALYTICS_EVENTS = {
  HERO_CTA_CLICK: 'hero_cta_click',
  RFQ_STARTED: 'rfq_started',
  CATALOG_VIEWED: 'catalog_viewed',
};

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    console.log('[analytics]', event, properties);
  }
}
