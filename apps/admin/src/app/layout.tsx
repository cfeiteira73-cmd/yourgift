import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import ShellLayout from '@/components/ShellLayout';
import { CommandBarProvider } from '@/components/CommandBar';
import { AICopilotProvider } from '@/components/AICopilotPanel';

export const metadata: Metadata = {
  title: { default: 'YourGift OS', template: '%s — YourGift OS' },
  description: 'Enterprise Procurement Operating System',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#07111f] text-[#f0f6ff] min-h-screen antialiased">
        <CommandBarProvider>
          <AICopilotProvider>
            <ShellLayout>{children}</ShellLayout>
          </AICopilotProvider>
        </CommandBarProvider>
      </body>
    </html>
  );
}
