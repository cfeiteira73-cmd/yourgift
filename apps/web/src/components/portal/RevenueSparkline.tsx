'use client';

/**
 * RevenueSparkline — micro SVG line chart for billing/financial pages.
 *
 * Props:
 *   data    - array of { label, value } points
 *   color   - stroke color (default: rgb(99,230,190))
 *   height  - SVG height in px (default: 40)
 *   width   - SVG width in px (default: 120)
 *   filled  - show area fill below the line (default: true)
 *   showDot - show dot on latest point (default: true)
 */

import React, { useMemo } from 'react';

export interface SparklinePoint {
  label: string;
  value: number;
}

interface RevenueSparklineProps {
  data: SparklinePoint[];
  color?: string;
  height?: number;
  width?: number;
  filled?: boolean;
  showDot?: boolean;
  className?: string;
}

function normalize(values: number[], min: number, max: number, toMin: number, toMax: number): number[] {
  const range = max - min || 1;
  return values.map(v => toMin + ((v - min) / range) * (toMax - toMin));
}

export function RevenueSparkline({
  data,
  color = 'rgb(99,230,190)',
  height = 40,
  width = 120,
  filled = true,
  showDot = true,
  className,
}: RevenueSparklineProps) {
  const points = useMemo(() => {
    if (!data.length) return null;
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = 4;
    const ys = normalize(values, min, max, height - pad, pad); // SVG y is inverted
    const xs = data.map((_, i) => pad + (i / Math.max(data.length - 1, 1)) * (width - pad * 2));
    return { xs, ys, values };
  }, [data, height, width]);

  if (!points || !data.length) {
    return <div className={className} style={{ width, height, opacity: 0.3, background: 'rgba(255,255,255,0.03)', borderRadius: 4 }} />;
  }

  const { xs, ys } = points;
  const lineD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const fillD = `${lineD} L${xs[xs.length - 1].toFixed(1)},${height} L${xs[0].toFixed(1)},${height} Z`;
  const lastX = xs[xs.length - 1];
  const lastY = ys[ys.length - 1];

  // Determine trend for glow
  const trend = data.length > 1 ? data[data.length - 1].value - data[data.length - 2].value : 0;
  const dotColor = trend >= 0 ? color : 'rgb(239,68,68)';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="Revenue trend chart"
      style={{ overflow: 'visible', display: 'block' }}
    >
      <defs>
        <linearGradient id={`sg-fill-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Fill */}
      {filled && (
        <path
          d={fillD}
          fill={`url(#sg-fill-${color.replace(/[^a-z0-9]/gi, '')})`}
        />
      )}

      {/* Line */}
      <path
        d={lineD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Latest point dot */}
      {showDot && (
        <>
          {/* Outer glow ring */}
          <circle cx={lastX} cy={lastY} r={4} fill={dotColor} opacity={0.2} />
          {/* Inner dot */}
          <circle cx={lastX} cy={lastY} r={2} fill={dotColor} />
        </>
      )}
    </svg>
  );
}

/**
 * SparklineCard — KPI card with embedded sparkline.
 * Drop-in replacement/supplement for plain number cards.
 */
interface SparklineCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number; // percentage
  data: SparklinePoint[];
  color?: string;
  width?: number;
}

export function SparklineCard({ title, value, subtitle, trend, data, color = 'rgb(99,230,190)', width = 100 }: SparklineCardProps) {
  const positive = (trend ?? 0) >= 0;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '12px',
      padding: '1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
    }}>
      <div>
        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
          {title}
        </div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>
          {value}
        </div>
        {(trend !== undefined || subtitle) && (
          <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {trend !== undefined && (
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: positive ? 'rgb(99,230,190)' : 'rgb(239,68,68)',
                background: positive ? 'rgba(99,230,190,0.1)' : 'rgba(239,68,68,0.1)',
                borderRadius: '6px',
                padding: '0.1rem 0.35rem',
              }}>
                {positive ? '+' : ''}{trend.toFixed(1)}%
              </span>
            )}
            {subtitle && <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)' }}>{subtitle}</span>}
          </div>
        )}
      </div>
      <RevenueSparkline data={data} color={color} width={width} height={36} />
    </div>
  );
}
