'use client';

import { formatPrice } from '@yourgift/shared';

export interface CostBreakdownData {
  baseCost: number;
  printCost: number;
  printTechnique?: string;
  shippingCost: number;
  margin: number;
  tax: number;
  total: number;
}

interface CostBreakdownProps {
  data: CostBreakdownData;
}

export function CostBreakdown({ data }: CostBreakdownProps) {
  const rows: { label: string; value: number; muted?: boolean }[] = [
    { label: 'Custo base', value: data.baseCost },
    {
      label: data.printTechnique ? `Impressão (${data.printTechnique})` : 'Impressão',
      value: data.printCost,
    },
    { label: 'Transporte', value: data.shippingCost },
    { label: 'Margem', value: data.margin, muted: true },
    { label: 'IVA (23%)', value: data.tax },
  ];

  return (
    <div
      className="yg-card"
      style={{ padding: '1.5rem' }}
    >
      <h3
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgb(170,180,198)',
          marginBottom: '1rem',
        }}
      >
        Resumo de custos
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.875rem',
            }}
          >
            <span style={{ color: row.muted ? 'rgb(120,130,150)' : 'rgb(170,180,198)' }}>{row.label}</span>
            <span style={{ color: row.muted ? 'rgb(120,130,150)' : 'rgb(245,247,251)', fontWeight: 500 }}>
              {formatPrice(row.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div
        style={{
          height: '1px',
          background: 'rgba(255,255,255,0.07)',
          margin: '1rem 0 0.875rem',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 700,
            color: 'rgb(245,247,251)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          TOTAL
        </span>
        <span
          style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: 'rgb(99,230,190)',
            letterSpacing: '-0.02em',
          }}
        >
          {formatPrice(data.total)}
        </span>
      </div>
    </div>
  );
}
