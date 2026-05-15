import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YourGift Admin',
  description: 'Painel de administracao YourGift',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className="bg-gray-950 text-white min-h-screen">
        <aside className="fixed left-0 top-0 h-full w-60 bg-gray-900 border-r border-gray-800 p-6">
          <h1 className="text-lg font-bold text-white mb-8">YG Admin</h1>
          <nav className="space-y-2">
            {[
              { href: '/dashboard', label: 'Dashboard' },
              { href: '/orders', label: 'Encomendas' },
              { href: '/products', label: 'Produtos' },
              { href: '/clients', label: 'Clientes' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors text-sm"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>
        <main className="ml-60 p-8">{children}</main>
      </body>
    </html>
  );
}
