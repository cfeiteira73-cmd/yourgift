import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

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
  return (
    <html lang="pt">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
