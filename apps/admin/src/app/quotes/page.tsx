'use client';

export default function QuotesPage() {
  return (
    <div>
      <h1 className="text-2xl font-black text-white tracking-tight mb-8">Orçamentos</h1>
      <div className="rounded-xl border border-dashed border-[#1a2f48] p-16 text-center">
        <p className="text-3xl mb-3 text-[#4d6a87]">📋</p>
        <p className="text-sm text-[#4d6a87] font-medium">Módulo de orçamentos em desenvolvimento</p>
        <p className="text-xs text-[#4d6a87] mt-1">
          <code className="font-mono bg-[#102131] px-1 py-0.5 rounded">POST /api/v1/quotes</code>
        </p>
      </div>
    </div>
  );
}
