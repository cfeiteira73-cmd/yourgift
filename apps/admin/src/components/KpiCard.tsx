'use client';

import type { ReactNode } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

interface KpiCardProps {
  label: string;
  value: string;
  trend?: number; // percentage change, positive = up
  sparkline?: { v: number }[];
  urgent?: boolean;
  urgentThreshold?: number;
  loading?: boolean;
  icon?: ReactNode;
  accentColor?: string;
}

function SkeletonKpiCard() {
  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5">
      <div className="skeleton h-3 w-24 rounded mb-4" />
      <div className="skeleton h-8 w-32 rounded mb-3" />
      <div className="skeleton h-3 w-16 rounded" />
    </div>
  );
}

export default function KpiCard({
  label,
  value,
  trend,
  sparkline,
  urgent,
  loading,
  icon,
  accentColor = '#4da3ff',
}: KpiCardProps) {
  if (loading) return <SkeletonKpiCard />;

  const trendUp = (trend ?? 0) >= 0;
  const trendColor = trendUp ? 'text-[#63e6be]' : 'text-[#f87171]';
  const trendIcon = trendUp ? '↑' : '↓';

  return (
    <div
      className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5 relative overflow-hidden"
      style={{
        boxShadow: `0 0 0 1px #1a2f48`,
      }}
    >
      {/* Subtle top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-60"
        style={{ background: `linear-gradient(90deg, ${accentColor}80, transparent)` }}
      />

      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-[#8ba8c7] uppercase tracking-wider">
          {label}
        </span>
        {icon && (
          <span className="text-[#4d6a87]" style={{ color: accentColor }}>
            {icon}
          </span>
        )}
        {urgent && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f87171]/10 text-[#f87171] border border-[#f87171]/20">
            URGENTE
          </span>
        )}
      </div>

      <div className="text-2xl font-black text-white tracking-tight mb-2">{value}</div>

      <div className="flex items-center justify-between">
        {trend !== undefined && (
          <span className={`text-xs font-semibold ${trendColor}`}>
            {trendIcon} {Math.abs(trend).toFixed(1)}% vs mês anterior
          </span>
        )}

        {sparkline && sparkline.length > 0 && (
          <div className="h-8 w-24 ml-auto">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkline}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={accentColor}
                  strokeWidth={1.5}
                  dot={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#102131',
                    border: '1px solid #1a2f48',
                    borderRadius: 6,
                    fontSize: 10,
                    color: '#f0f6ff',
                  }}
                  itemStyle={{ color: accentColor }}
                  labelStyle={{ display: 'none' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
