'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { formatCurrency, API_BASE, getAdminToken } from '@/lib/utils';

interface Order {
  id: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  supplier?: string;
}

function buildDailyRevenue(orders: Order[], days = 30) {
  const result: { date: string; revenue: number; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOrders = orders.filter((o) => o.createdAt?.slice(0, 10) === dateStr);
    result.push({
      date: d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }),
      revenue: dayOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0),
      count: dayOrders.length,
    });
  }
  return result;
}

function buildStatusDistrib(orders: Order[]) {
  const map: Record<string, number> = {};
  for (const o of orders) {
    map[o.status] = (map[o.status] ?? 0) + 1;
  }
  return Object.entries(map).map(([status, count]) => ({ status, count }));
}

export default function AnalyticsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/v1/orders?limit=500`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const daily = buildDailyRevenue(orders, 30);
  const statusDistrib = buildStatusDistrib(orders);
  const totalRevenue = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0;

  const customTooltipStyle = {
    contentStyle: {
      background: '#102131',
      border: '1px solid #1a2f48',
      borderRadius: 8,
      fontSize: 12,
      color: '#f0f6ff',
    },
    itemStyle: { color: '#4da3ff' },
    labelStyle: { color: '#8ba8c7' },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Analytics</h1>
          <p className="text-sm text-[#4d6a87] mt-1">Últimos 30 dias</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:bg-[#102131] hover:text-white transition-all"
        >
          Atualizar
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Receita Total', value: formatCurrency(totalRevenue), color: '#63e6be' },
          { label: 'Total Encomendas', value: String(orders.length), color: '#4da3ff' },
          { label: 'Ticket Médio', value: formatCurrency(avgOrder), color: '#a78bfa' },
          {
            label: 'Taxa de Entrega',
            value: orders.length > 0
              ? `${((orders.filter((o) => o.status === 'delivered').length / orders.length) * 100).toFixed(1)}%`
              : '—',
            color: '#74e7ff',
          },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-5">
            <p className="text-xs font-medium text-[#4d6a87] uppercase tracking-wider mb-2">{m.label}</p>
            <p className="text-xl font-black tabular-nums" style={{ color: m.color }}>
              {loading ? '—' : m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-6 mb-6">
        <h3 className="text-xs font-semibold text-[#8ba8c7] uppercase tracking-wider mb-6">
          Receita Diária — 30 dias
        </h3>
        {loading ? (
          <div className="skeleton h-48 rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#102131" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#4d6a87' }}
                tickLine={false}
                axisLine={{ stroke: '#1a2f48' }}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#4d6a87' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `€${v}`}
                width={50}
              />
              <Tooltip
                {...customTooltipStyle}
                formatter={(v: number) => [formatCurrency(v), 'Receita']}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#4da3ff"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#4da3ff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Status distribution */}
      <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-6">
        <h3 className="text-xs font-semibold text-[#8ba8c7] uppercase tracking-wider mb-6">
          Distribuição por Estado
        </h3>
        {loading ? (
          <div className="skeleton h-48 rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusDistrib} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#102131" vertical={false} />
              <XAxis
                dataKey="status"
                tick={{ fontSize: 10, fill: '#4d6a87' }}
                tickLine={false}
                axisLine={{ stroke: '#1a2f48' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#4d6a87' }}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <Tooltip
                {...customTooltipStyle}
                formatter={(v: number) => [v, 'Encomendas']}
              />
              <Bar dataKey="count" fill="#4da3ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
