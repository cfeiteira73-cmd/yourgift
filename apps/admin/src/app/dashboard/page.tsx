'use client';

import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [health, setHealth] = useState<any>(null);
  const [productCount, setProductCount] = useState('—');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/health`)
      .then((r) => r.json()).then(setHealth).catch(() => {});
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/products?limit=1`)
      .then((r) => r.json()).then((d) => setProductCount(d.total?.toLocaleString('pt-PT') ?? '—')).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Encomendas', value: '—', icon: '📦' },
          { label: 'Receita Mês', value: '—', icon: '💶' },
          { label: 'Em Produção', value: '—', icon: '🏭' },
          { label: 'Produtos Midocean', value: productCount, icon: '🎁' },
        ].map((k) => (
          <div key={k.label} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="text-2xl mb-2">{k.icon}</div>
            <p className="text-gray-400 text-xs mb-1">{k.label}</p>
            <p className="text-2xl font-black text-white">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Estado dos Serviços</h2>
        {health ? (
          <div className="space-y-3">
            {Object.entries(health.services ?? {}).map(([name, status]) => (
              <div key={name} className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-300 capitalize">{name}</span>
                <span className={`ml-auto text-xs font-semibold ${status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{String(status).toUpperCase()}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-gray-800 text-xs text-gray-500">
              <span>Latência</span><span>{health.latencyMs}ms</span>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 text-sm py-4">A verificar serviços...</div>
        )}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { href: '/products', icon: '⟳', title: 'Sync Midocean', desc: 'Importar 2.428 produtos' },
            { href: '/orders', icon: '📋', title: 'Ver Encomendas', desc: 'Estado e tracking' },
            { href: `${process.env.NEXT_PUBLIC_API_URL}/docs`, icon: '📖', title: 'Swagger API', desc: 'Documentação completa' },
          ].map((a) => (
            <a key={a.title} href={a.href} className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 hover:border-brand-500 transition-colors">
              <span className="text-xl">{a.icon}</span>
              <div>
                <p className="text-sm font-medium text-white">{a.title}</p>
                <p className="text-xs text-gray-500">{a.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
