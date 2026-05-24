import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Página não encontrada — YourGift',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="text-[72px] font-black text-gray-100 leading-none select-none mb-2">404</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Página não encontrada</h1>
      <p className="text-gray-500 max-w-sm mb-8">
        O endereço que procuras não existe ou foi movido.
        Verifica o URL ou regressa à página inicial.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          Página inicial
        </Link>
        <Link
          href="/products"
          className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
        >
          Ver catálogo
        </Link>
      </div>
    </div>
  );
}
