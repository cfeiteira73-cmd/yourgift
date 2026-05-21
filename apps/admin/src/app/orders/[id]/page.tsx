'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import OrderTimeline, { TimelineEvent } from '@/components/OrderTimeline';
import CostBreakdown from '@/components/CostBreakdown';
import { formatCurrency, formatDateTime, formatDate, API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrderDetail {
  id: string;
  ref: string;
  status: string;
  totalAmount: number;
  baseCost?: number;
  printCost?: number;
  printTechnique?: string;
  shippingCost?: number;
  margin?: number;
  vat?: number;
  supplier?: string;
  supplierOrderId?: string;
  trackingNumber?: string;
  artworkUrl?: string;
  artworkStatus?: string;
  artworkNotes?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  approvedAt?: string;
  producingAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  client?: {
    id: string;
    email?: string;
    name?: string;
    company?: string;
    phone?: string;
  };
  clientId?: string;
  items?: OrderItem[];
  approvals?: ApprovalRecord[];
  statusHistory?: StatusRecord[];
}

interface OrderItem {
  id: string;
  productId: string;
  productTitle?: string;
  quantity: number;
  unitPrice: number;
  variantLabel?: string;
  imageUrl?: string;
}

interface ApprovalRecord {
  id: string;
  stage: string;
  status: string;
  approver?: string;
  approvedAt?: string;
  notes?: string;
}

interface StatusRecord {
  id: string;
  status: string;
  createdAt: string;
  actor?: string;
  notes?: string;
}

// ── Timeline builder ───────────────────────────────────────────────────────────

function buildTimeline(order: OrderDetail): TimelineEvent[] {
  const statusMap: StatusRecord[] = order.statusHistory ?? [];

  const findRecord = (status: string): StatusRecord | undefined =>
    statusMap.find((r) => r.status === status);

  const steps = [
    {
      status: 'created',
      label: 'Encomenda criada',
      icon: '📋',
      color: '#8ba8c7',
      timestamp: order.createdAt,
      actor: order.client?.name ?? order.client?.email ?? undefined,
    },
    {
      status: 'paid',
      label: 'Pagamento confirmado',
      icon: '💳',
      color: '#4da3ff',
      timestamp: order.paidAt ?? findRecord('paid')?.createdAt ?? null,
      actor: findRecord('paid')?.actor ?? 'Stripe',
    },
    {
      status: 'approved',
      label: 'Aprovado',
      icon: '✓',
      color: '#a78bfa',
      timestamp: order.approvedAt ?? findRecord('approved')?.createdAt ?? null,
      actor: findRecord('approved')?.actor ?? undefined,
      notes: findRecord('approved')?.notes ?? undefined,
    },
    {
      status: 'producing',
      label: 'Em produção',
      icon: '🏭',
      color: '#f59e0b',
      timestamp: order.producingAt ?? findRecord('producing')?.createdAt ?? null,
      actor: order.supplier ?? undefined,
    },
    {
      status: 'shipped',
      label: 'Enviado',
      icon: '🚚',
      color: '#74e7ff',
      timestamp: order.shippedAt ?? findRecord('shipped')?.createdAt ?? null,
      actor: order.supplier ?? undefined,
      notes: order.trackingNumber ? `Tracking: ${order.trackingNumber}` : undefined,
    },
    {
      status: 'delivered',
      label: 'Entregue',
      icon: '🎉',
      color: '#63e6be',
      timestamp: order.deliveredAt ?? findRecord('delivered')?.createdAt ?? null,
      actor: undefined,
    },
  ];

  return steps.map((s) => ({
    status: s.status,
    label: s.label,
    icon: s.icon,
    color: s.color,
    timestamp: s.timestamp ?? null,
    actor: s.actor ?? null,
    notes: s.notes ?? null,
  }));
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonDetail() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-8 w-48 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="skeleton h-40 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
        <div className="space-y-6">
          <div className="skeleton h-48 rounded-xl" />
          <div className="skeleton h-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/v1/orders/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrder(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <SkeletonDetail />;

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-4xl text-[#f87171]">⚠</div>
        <p className="text-[#8ba8c7]">Encomenda não encontrada ou erro ao carregar.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 bg-[#4da3ff] text-white rounded-lg text-sm font-semibold hover:bg-[#3b8de0] transition-colors"
          >
            Tentar novamente
          </button>
          <Link
            href="/orders"
            className="px-4 py-2 border border-[#1a2f48] text-[#8ba8c7] rounded-lg text-sm hover:bg-[#102131] transition-colors"
          >
            Voltar à lista
          </Link>
        </div>
      </div>
    );
  }

  const timeline = buildTimeline(order);

  const baseCost = order.baseCost ?? 0;
  const printCost = order.printCost ?? 0;
  const shippingCost = order.shippingCost ?? 0;
  const margin = order.margin ?? (order.totalAmount * 0.25);
  const vat = order.vat ?? (order.totalAmount * 0.23);
  const total = order.totalAmount ?? (baseCost + printCost + shippingCost + margin + vat);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#4d6a87] mb-6">
        <Link href="/orders" className="hover:text-[#8ba8c7] transition-colors">
          Encomendas
        </Link>
        <span>/</span>
        <span className="text-white font-mono">
          {order.ref ?? order.id.slice(0, 8).toUpperCase()}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-white tracking-tight font-mono">
                {order.ref ?? `#${order.id.slice(0, 8).toUpperCase()}`}
              </h1>
              <StatusBadge status={order.status} />
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-[#4d6a87]">
              <span>
                {order.client?.name ?? order.client?.company ?? order.client?.email ?? '—'}
              </span>
              {order.client?.company && <span>·</span>}
              {order.client?.company && <span>{order.client.company}</span>}
              <span>·</span>
              <span>{formatDate(order.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:bg-[#102131] hover:text-white transition-all"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Order items */}
          {order.items && order.items.length > 0 && (
            <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1a2f48]">
                <h3 className="text-xs font-semibold text-[#8ba8c7] uppercase tracking-wider">
                  Itens da Encomenda
                </h3>
              </div>
              <div className="divide-y divide-[#102131]">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-12 h-12 rounded-lg border border-[#1a2f48] bg-[#102131] overflow-hidden flex-shrink-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.productTitle ?? ''}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#4d6a87]">
                          🎁
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {item.productTitle ?? item.productId}
                      </p>
                      {item.variantLabel && (
                        <p className="text-xs text-[#4d6a87] mt-0.5">{item.variantLabel}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-white tabular-nums">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </p>
                      <p className="text-xs text-[#4d6a87]">
                        {item.quantity}× {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1a2f48]">
              <h3 className="text-xs font-semibold text-[#8ba8c7] uppercase tracking-wider">
                Histórico de Estado
              </h3>
            </div>
            <div className="p-5">
              <OrderTimeline events={timeline} />
            </div>
          </div>

          {/* Approval history */}
          {order.approvals && order.approvals.length > 0 && (
            <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1a2f48]">
                <h3 className="text-xs font-semibold text-[#8ba8c7] uppercase tracking-wider">
                  Histórico de Aprovações
                </h3>
              </div>
              <div className="divide-y divide-[#102131]">
                {order.approvals.map((ap) => (
                  <div key={ap.id} className="px-5 py-4 flex items-start gap-4">
                    <div className="flex-shrink-0 mt-0.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          ap.status === 'approved'
                            ? 'bg-[#063e1f] text-[#63e6be]'
                            : ap.status === 'rejected'
                            ? 'bg-[#2a0a0a] text-[#f87171]'
                            : 'bg-[#2a1f00] text-[#f59e0b]'
                        }`}
                      >
                        {ap.stage}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">{ap.approver ?? '—'}</span>
                        {ap.approvedAt && (
                          <span className="text-xs text-[#4d6a87] tabular-nums">
                            {formatDateTime(ap.approvedAt)}
                          </span>
                        )}
                      </div>
                      {ap.notes && (
                        <p className="text-xs text-[#8ba8c7] mt-1 bg-[#102131] rounded-lg px-3 py-2 border border-[#1a2f48]">
                          {ap.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Cost breakdown */}
          <CostBreakdown
            baseCost={baseCost}
            printCost={printCost}
            printTechnique={order.printTechnique}
            shippingCost={shippingCost}
            margin={margin}
            vat={vat}
            total={total}
          />

          {/* Client card */}
          <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1a2f48]">
              <h3 className="text-xs font-semibold text-[#8ba8c7] uppercase tracking-wider">
                Cliente
              </h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {order.client?.name ?? '—'}
                </p>
                {order.client?.company && (
                  <p className="text-xs text-[#4da3ff] mt-0.5">{order.client.company}</p>
                )}
              </div>
              {order.client?.email && (
                <div className="flex items-center gap-2">
                  <span className="text-[#4d6a87] text-xs">Email</span>
                  <a
                    href={`mailto:${order.client.email}`}
                    className="text-xs text-[#8ba8c7] hover:text-[#4da3ff] transition-colors ml-auto"
                  >
                    {order.client.email}
                  </a>
                </div>
              )}
              {order.client?.phone && (
                <div className="flex items-center gap-2">
                  <span className="text-[#4d6a87] text-xs">Telefone</span>
                  <span className="text-xs text-[#8ba8c7] ml-auto">{order.client.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Supplier card */}
          <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1a2f48]">
              <h3 className="text-xs font-semibold text-[#8ba8c7] uppercase tracking-wider">
                Fornecedor
              </h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#4d6a87]">Fornecedor</span>
                <span className="text-sm font-semibold text-white">
                  {order.supplier ?? '—'}
                </span>
              </div>
              {order.supplierOrderId && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#4d6a87]">ID Pedido</span>
                  <span className="text-xs font-mono text-[#8ba8c7]">
                    {order.supplierOrderId}
                  </span>
                </div>
              )}
              {order.trackingNumber ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#4d6a87]">Tracking</span>
                  <span className="text-xs font-mono text-[#74e7ff]">
                    {order.trackingNumber}
                  </span>
                </div>
              ) : (
                <div className="text-xs text-[#4d6a87] italic">Tracking ainda não disponível</div>
              )}
            </div>
          </div>

          {/* Artwork card */}
          {(order.artworkUrl || order.artworkStatus) && (
            <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1a2f48]">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#8ba8c7] uppercase tracking-wider">
                    Artwork
                  </h3>
                  {order.artworkStatus && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        order.artworkStatus === 'approved'
                          ? 'bg-[#063e1f] text-[#63e6be]'
                          : order.artworkStatus === 'rejected'
                          ? 'bg-[#2a0a0a] text-[#f87171]'
                          : 'bg-[#2a1f00] text-[#f59e0b]'
                      }`}
                    >
                      {order.artworkStatus}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-5 space-y-3">
                {order.artworkUrl && (
                  <div className="rounded-lg border border-[#1a2f48] overflow-hidden bg-[#102131] aspect-video flex items-center justify-center">
                    <img
                      src={order.artworkUrl}
                      alt="Artwork"
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                {order.artworkNotes && (
                  <p className="text-xs text-[#8ba8c7] bg-[#102131] rounded-lg px-3 py-2 border border-[#1a2f48]">
                    {order.artworkNotes}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
