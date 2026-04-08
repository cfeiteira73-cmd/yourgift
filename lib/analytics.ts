"use client";

import { ANALYTICS_EVENTS, type AnalyticsEvent } from "@/config/analytics-events";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function trackEvent(
  event: AnalyticsEvent,
  params?: Record<string, string | number | boolean>
) {
  if (typeof window === "undefined") return;

  // GA4
  if (typeof window.gtag === "function") {
    window.gtag("event", event, params);
  }

  // GTM dataLayer push
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event, ...params });
  }
}

export function trackPageView(url: string) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") {
    window.gtag("config", process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "", {
      page_path: url,
    });
  }
}

export { ANALYTICS_EVENTS };
