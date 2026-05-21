'use client';

export default function StoresPage() {
  return (
    <div>
      <h1 className="text-2xl font-black text-white tracking-tight mb-8">Lojas</h1>
      <div className="rounded-xl border border-dashed border-[#1a2f48] p-16 text-center">
        <p className="text-3xl mb-3 text-[#4d6a87]">🏪</p>
        <p className="text-sm text-[#4d6a87] font-medium">Gestão de lojas de empresa em desenvolvimento</p>
        <p className="text-xs text-[#4d6a87] mt-1">
          <code className="font-mono bg-[#102131] px-1 py-0.5 rounded">GET /api/v1/stores</code>
        </p>
      </div>
    </div>
  );
}
