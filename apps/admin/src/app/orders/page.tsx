'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import DataTable, { Column } from '@/components/DataTable';
import { formatCurrency, formatDate, API_BASE, getAdminToken } from '@/lib/utils';

interface Order {
  id: string;
  ref: string;
  status: string;
  totalAmount: number;
  supplier?: string;
  createdAt: string;
  client?: { email?: string; name?: string; company?: string };
  clientId?: string;
}

const ALL_STATUSES = ['created', 'paid', 'approved', 'producing', 'shipped', 'delivered', 'cancelled'];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/v1/orders?limit=200`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const suppliers = useMemo(() => {
    const set = new Set(orders.map((o) => o.supplier).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [orders]);

  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter) result = result.filter((o) => o.status === statusFilter);
    if (supplierFilter) result = result.filter((o) => o.supplier === supplierFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.ref?.toLowerCase().includes(q) ||
          o.id?.toLowerCase().includes(q) ||
          o.client?.email?.toLowerCase().includes(q) ||
          o.client?.name?.toLowerCase().includes(q) ||
          o.client?.company?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [orders, statusFilter, supplierFilter, search]);

  const totalRevenue = useMemo(
    () => filtered.reduce((s, o) => s + (o.totalAmount ?? 0), 0),
    [filtered]
  );

  const columns: Column<Order>[] = [
    {
      key: 'ref',
      label: 'REF',
      render: (row) => (
        <Link
          href={`/orders/${row.id}`}
          className="font-mono text-xs text-[#4da3ff] hover:text-[#74e7ff] transition-colors"
        >
          {row.ref ?? row.id.slice(0, 8).toUpperCase()}
        </Link>
      ),
    },
    {
      key: 'client',
      label: 'CLIENTE',
      render: (row) => (
        <div>
          <p className="text-sm text-white font-medium truncate max-w-[160px]">
            {row.client?.name ?? row.client?.company ?? '—'}
          </p>
          <p className="text-xs text-[#4d6a87] truncate max-w-[160px]">
            {row.client?.email ?? row.clientId?.slice(0, 8) ?? ''}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'STATUS',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'totalAmount',
      label: 'VALOR',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="text-sm font-semibold text-white tabular-nums">
          {row.totalAmount ? formatCurrency(row.totalAmount) : '—'}
        </span>
      ),
    },
    {
      key: 'supplier',
      label: 'FORNECEDOR',
      render: (row) => (
        <span className="text-xs text-[#8ba8c7]">{row.supplier ?? '—'}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'DATA',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-[#4d6a87] tabular-nums">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <Link
          href={`/orders/${row.id}`}
          className="text-xs text-[#4d6a87] hover:text-[#4da3ff] font-medium transition-colors"
        >
          Ver →
        </Link>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Encomendas</h1>
          <p className="text-sm text-[#4d6a87] mt-1">
            {loading ? '—' : `${filtered.length} resultados · ${formatCurrency(totalRevenue)} total`}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:bg-[#102131] hover:text-white transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 7A5 5 0 1 1 7 2c1.5 0 2.9.6 3.9 1.6L13 1v4H9" />
          </svg>
          Atualizar
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-[#f87171]/20 bg-[#2a0a0a]/50 p-4 flex items-center gap-3">
          <span className="text-[#f87171]">⚠</span>
          <p className="text-sm text-[#f87171]">Erro ao carregar encomendas.</p>
          <button
            type="button"
            onClick={load}
            className="ml-auto text-xs text-[#f87171] border border-[#f87171]/30 px-2 py-1 rounded hover:bg-[#f87171]/10 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4d6a87]"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="6" cy="6" r="4.5" />
            <path d="M9.5 9.5l3 3" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar REF, cliente, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-[#8ba8c7] focus:outline-none focus:border-[#4da3ff]/50 transition-colors appearance-none pr-8 cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5l3 3 3-3' stroke='%234d6a87' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
        >
          <option value="">Todos os estados</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        {/* Supplier filter */}
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-[#8ba8c7] focus:outline-none focus:border-[#4da3ff]/50 transition-colors appearance-none pr-8 cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5l3 3 3-3' stroke='%234d6a87' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
        >
          <option value="">Todos os fornecedores</option>
          {suppliers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Clear filters */}
        {(search || statusFilter || supplierFilter) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setStatusFilter(''); setSupplierFilter(''); }}
            className="px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:border-[#f87171]/30 hover:text-[#f87171] transition-all"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Status count pills */}
      {!loading && (
        <div className="flex flex-wrap gap-2 mb-6">
          {ALL_STATUSES.map((status) => {
            const count = orders.filter((o) => o.status === status).length;
            if (count === 0) return null;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  statusFilter === status
                    ? 'border-[#4da3ff]/50 bg-[#0d1f3a] text-[#4da3ff]'
                    : 'border-[#1a2f48] bg-[#0b1526] text-[#8ba8c7] hover:border-[#4da3ff]/30'
                }`}
              >
                <StatusBadge status={status} size="sm" />
                <span className="tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      <DataTable<Order>
        columns={columns}
        data={filtered}
        loading={loading}
        pageSize={25}
        getKey={(row) => row.id}
        emptyMessage="Nenhuma encomenda encontrada"
      />
    </div>
  );
}
