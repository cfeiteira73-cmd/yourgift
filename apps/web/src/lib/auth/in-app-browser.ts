export type InAppBrowser = 'instagram' | 'facebook' | 'whatsapp' | 'linkedin' | 'tiktok' | 'webview' | null;

export interface BrowserEnv {
  isInApp: boolean;
  browser: InAppBrowser;
  shouldForceExternal: boolean;
  isSafariITP: boolean;   // Safari Intelligent Tracking Prevention
  isPrivateMode: boolean; // can't detect reliably, but flag is set false
}

export function detectBrowserEnv(userAgent: string): BrowserEnv {
  const ua = userAgent.toLowerCase();

  const isInstagram = ua.includes('instagram');
  const isFacebook = ua.includes('fban') || ua.includes('fbav');
  const isWhatsApp = ua.includes('whatsapp');
  const isLinkedIn = ua.includes('linkedin');
  const isTikTok = ua.includes('musical_ly') || ua.includes('tiktok');
  const isAndroidWebView = ua.includes('wv') && ua.includes('android');
  // Safari ITP: Safari on iOS/macOS (not Chrome on iOS)
  const isSafari = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('android');

  let browser: InAppBrowser = null;
  if (isInstagram) browser = 'instagram';
  else if (isFacebook) browser = 'facebook';
  else if (isWhatsApp) browser = 'whatsapp';
  else if (isLinkedIn) browser = 'linkedin';
  else if (isTikTok) browser = 'tiktok';
  else if (isAndroidWebView) browser = 'webview';

  const isInApp = browser !== null;

  return {
    isInApp,
    browser,
    shouldForceExternal: isInApp,
    isSafariITP: isSafari && !isInApp,
    isPrivateMode: false,
  };
}

// Generate canonical open-in-browser URL
// iOS: x-safari-https:// doesn't work universally — best is a user-copyable link
export function getExternalOpenUrl(currentHref: string): string {
  return currentHref;
}
