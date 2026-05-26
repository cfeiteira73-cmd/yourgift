import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Login · YourGift Admin',
};

// Standalone layout — no sidebar, no shell
export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
