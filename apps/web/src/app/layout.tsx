import type { Metadata } from 'next';
import { Inter, Playfair_Display, Source_Serif_4, Montserrat } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-playfair' });
const sourceSerif = Source_Serif_4({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-source-serif' });
const montserrat = Montserrat({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-montserrat' });

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
      </head>
      <body className={`${inter.variable} ${playfair.variable} ${sourceSerif.variable} ${montserrat.variable} ${inter.className}`}>
        {children}
      </body>
    </html>
  );
}
