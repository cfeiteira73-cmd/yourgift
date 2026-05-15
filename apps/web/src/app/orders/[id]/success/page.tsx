import Link from 'next/link';

export default function OrderSuccessPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-gray-100 p-12 max-w-md w-full text-center">
        <div className="text-6xl mb-6">✅</div>
        <h1 className="text-2xl font-black text-gray-900 mb-3">Encomenda confirmada!</h1>
        <p className="text-gray-500 mb-2">Referência: <span className="font-semibold text-gray-900">{params.id}</span></p>
        <p className="text-sm text-gray-400 mb-8">
          O pagamento foi processado e a tua encomenda foi enviada para produção na Midocean.
          Receberás atualizações por email.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/dashboard" className="bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors">
            Ver encomendas
          </Link>
          <Link href="/products" className="border border-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors">
            Continuar a comprar
          </Link>
        </div>
      </div>
    </div>
  );
}
