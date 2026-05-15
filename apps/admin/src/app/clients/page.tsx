'use client';

import { useEffect, useState } from 'react';

const TIER_COLORS: Record<string, string> = {
  standard: 'bg-gray-700 text-gray-300',
  premium: 'bg-yellow-900/40 text-yellow-400',
  enterprise: 'bg-purple-900/40 text-purple-400',
};

export default function AdminClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false); // placeholder — wire to admin API
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Clientes</h1>
      </div>
      {loading ? (
        <div className="text-center py-20 text-gray-500">A carregar...</div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center text-gray-500">
          <p className="text-4xl mb-4">👥</p>
          <p className="font-medium">Endpoint de clientes a implementar no admin API</p>
          <p className="text-xs mt-2">POST /api/v1/admin/clients</p>
        </div>
      )}
    </div>
  );
}
