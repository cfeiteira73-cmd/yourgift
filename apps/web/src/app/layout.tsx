import type { Metadata } from 'next';
import { Inter, Libre_Baskerville, Montserrat, DM_Mono } from 'next/font/google';
import './globals.css';
import CookieConsent from '@/components/CookieConsent';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const libreBaskerville = Libre_Baskerville({ subsets: ['latin'], weight: ['400', '700'], style: ['normal', 'italic'], variable: '--font-baskerville' });
const montserrat = Montserrat({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-montserrat' });
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['300', '400'], variable: '--font-dm-mono' });

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#090907',
};

export const metadata: Metadata = {
  title: { default: 'YourGift — Merchandising B2B Premium', template: '%s | YourGift' },
  description: 'Plataforma B2B de merchandising personalizado. 2.400+ produtos Midocean com bordado, DTF, laser e pad printing. Entrega em toda a Europa.',
  metadataBase: new URL('https://yourgift.pt'),
  keywords: ['merchandising b2b', 'brindes empresariais', 'midocean', 'bordado', 'dtf', 'personalização', 'portugal'],
  authors: [{ name: 'YourGift' }],
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    url: 'https://yourgift.pt',
    siteName: 'YourGift',
    title: 'YourGift — Merchandising B2B Premium',
    description: '2.400+ produtos Midocean. Bordado, DTF, laser. Entrega EU em 5–10 dias.',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const betterStackKey = process.env.NEXT_PUBLIC_BETTERSTACK_KEY;

  return (
    <html lang="pt">
      <head>
        {/* BetterStack Uptime — real user monitoring */}
        {betterStackKey && (
          <script
            src="https://cdn.betterstack.com/rum/v1/index.js"
            data-key={betterStackKey}
            async
          />
        )}
        {/* Material Symbols for Stitch design */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
        {/* Preload hero poster — LCP element for homepage */}
        <link rel="preload" as="image" href="/images/hero-fallback.jpg" fetchPriority="high" />
      </head>
      <body className={`${inter.variable} ${libreBaskerville.variable} ${montserrat.variable} ${dmMono.variable}`}>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
