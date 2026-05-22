import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import ShellLayout from '@/components/ShellLayout';

export const metadata: Metadata = {
  title: 'YourGift Admin',
  description: 'Painel de administração YourGift OS',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt">
      <body className="bg-[#07111f] text-[#f0f6ff] min-h-screen">
        <ShellLayout>{children}</ShellLayout>
      </body>
    </html>
  );
}
