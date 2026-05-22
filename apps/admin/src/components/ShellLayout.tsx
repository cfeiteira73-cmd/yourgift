'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import Sidebar from './Sidebar';

export default function ShellLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <main className="ml-56 min-h-screen">
        <div className="max-w-[1400px] mx-auto px-8 py-8">{children}</div>
      </main>
    </>
  );
}
