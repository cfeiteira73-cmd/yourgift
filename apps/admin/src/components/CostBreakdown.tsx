'use client';

import { formatCurrency } from '@/lib/utils';

interface CostBreakdownProps {
  baseCost: number;
  printCost: number;
  printTechnique?: string;
  shippingCost: number;
  margin: number;
  vat: number;
  total: number;
}

export default function CostBreakdown({
  baseCost,
  printCost,
  printTechnique,
  shippingCost,
  margin,
  vat,
  total,
}: CostBreakdownProps) {
  const marginPct = total > 0 ? ((margin / total) * 100).toFixed(1) : '0.0';

  const rows: { label: string; value: number; sub?: string; highlight?: boolean }[] = [
    { label: 'Custo base', value: baseCost },
    {
      label: 'Custo de personalização',
      value: printCost,
      sub: printTechnique,
    },
    { label: 'Envio', value: shippingCost },
    {
      label: 'Margem',
      value: margin,
      sub: `${marginPct}%`,
      highlight: true,
    },
    { label: 'IVA (23%)', value: vat },
  ];

  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1a2f48]">
        <h3 className="text-xs font-semibold text-[#8ba8c7] uppercase tracking-wider">
          Breakdown de Custos
        </h3>
      </div>

      <div className="px-5 py-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <div>
              <span className="text-sm text-[#8ba8c7]">{row.label}</span>
              {row.sub && (
                <span
                  className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${
                    row.highlight
                      ? 'bg-[#063e1f] text-[#63e6be]'
                      : 'bg-[#102131] text-[#4d6a87]'
                  }`}
                >
                  {row.sub}
                </span>
              )}
            </div>
            <span
              className={`text-sm font-semibold tabular-nums ${
                row.highlight ? 'text-[#63e6be]' : 'text-white'
              }`}
            >
              {formatCurrency(row.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="px-5 py-4 border-t border-[#1a2f48] bg-[#102131] flex items-center justify-between">
        <span className="text-sm font-bold text-white uppercase tracking-wide">Total</span>
        <span className="text-xl font-black text-white tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}
