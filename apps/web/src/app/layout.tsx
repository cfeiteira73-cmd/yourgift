import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'YourGift — Merchandising B2B Premium',
  description: 'Plataforma B2B de merchandising personalizado para empresas portuguesas.',
  metadataBase: new URL('https://yourgift.pt'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className={inter.className}>
        <main>{children}</main>
      </body>
    </html>
  );
}
