import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'YourGift Admin',
  description: 'Painel de administração YourGift OS',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt">
      <body className="bg-[#07111f] text-[#f0f6ff] min-h-screen">
        <Sidebar />
        <main className="ml-56 min-h-screen">
          <div className="max-w-[1400px] mx-auto px-8 py-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
