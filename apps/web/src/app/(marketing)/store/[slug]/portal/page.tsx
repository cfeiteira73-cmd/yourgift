'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.yourgift.pt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmployeeInfo {
  id: string;
  name: string;
  email: string;
  department: string | null;
  allowance: number;
  spent: number;
  isActive: boolean;
  lastLoginAt: string | null;
}

interface StoreInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  bannerUrl: string | null;
  welcomeMessage: string | null;
}

interface ProductVariant {
  id: string;
  sku: string;
  color: string | null;
  size: string | null;
  price: number;
  stock: number;
}

interface StoreProductItem {
  id: string;
  customPrice: number | null;
  sortOrder: number;
  product: {
    id: string;
    title: string;
    description: string;
    images: string[];
    basePrice: number;
    variants: ProductVariant[];
  };
}

interface PortalData {
  employee: EmployeeInfo;
  store: StoreInfo;
  remainingAllowance: number;
  products: StoreProductItem[];
}

interface EmployeeOrder {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  totalAmount: number;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface OrderModalState {
  open: boolean;
  item: StoreProductItem | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDisplayPrice(item: StoreProductItem): number {
  if (item.customPrice != null) return item.customPrice;
  if (item.product.variants.length > 0) return item.product.variants[0].price;
  return item.product.basePrice;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending:   { bg: '#fef9c3', text: '#854d0e', label: 'Pendente' },
    approved:  { bg: '#dbeafe', text: '#1e40af', label: 'Aprovado' },
    fulfilled: { bg: '#dcfce7', text: '#166534', label: 'Entregue' },
    cancelled: { bg: '#fee2e2', text: '#991b1b', label: 'Cancelado' },
  };
  const s = map[status] ?? map['pending'];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 700,
        background: s.bg,
        color: s.text,
      }}
    >
      {s.label}
    </span>
  );
}

// ── OrderModal ────────────────────────────────────────────────────────────────

function OrderModal({
  item,
  accent,
  remaining,
  token,
  slug,
  onClose,
  onSuccess,
}: {
  item: StoreProductItem;
  accent: string;
  remaining: number;
  token: string;
  slug: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    item.product.variants[0]?.id ?? '',
  );
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const selectedVariant = item.product.variants.find((v) => v.id === selectedVariantId);
  const unitPrice =
    item.customPrice ??
    selectedVariant?.price ??
    item.product.basePrice;
  const totalAmount = unitPrice * quantity;
  const overBudget = remaining > 0 && totalAmount > remaining;

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        productId: item.product.id,
        quantity,
      };
      if (selectedVariantId) body['variantId'] = selectedVariantId;
      if (notes.trim()) body['notes'] = notes.trim();

      const res = await fetch(
        `${API_BASE}/api/v1/stores/${encodeURIComponent(slug)}/order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? 'Erro ao submeter encomenda');
      }

      setDone(true);
      setTimeout(() => {
        onSuccess();
      }, 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSubmitting(false);
    }
  }

  const thumb = item.product.images?.[0] ?? null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      />

      <div
        style={{
          position: 'relative',
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '480px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Color bar */}
        <div style={{ height: '4px', background: accent }} />

        <div style={{ padding: '28px' }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '40px', marginBottom: '14px' }}>✅</div>
              <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: '#07111f' }}>
                Encomenda submetida para aprovação!
              </h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                Receberá uma confirmação em breve.
              </p>
            </div>
          ) : (
            <>
              {/* Product info */}
              <div style={{ display: 'flex', gap: '14px', marginBottom: '24px', alignItems: 'center' }}>
                {thumb && (
                  <div style={{ flexShrink: 0, width: '72px', height: '72px', borderRadius: '12px', overflow: 'hidden', background: '#f1f5f9', position: 'relative' }}>
                    <Image
                      src={thumb}
                      alt={item.product.title}
                      fill
                      style={{ objectFit: 'cover' }}
                      unoptimized={thumb.startsWith('http')}
                    />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 800, color: '#07111f', lineHeight: 1.3 }}>
                    {item.product.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    Preço unit.: <strong style={{ color: '#07111f' }}>€{unitPrice.toFixed(2)}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ flexShrink: 0, padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '20px' }}
                >
                  ×
                </button>
              </div>

              {/* Variant selector */}
              {item.product.variants.length > 1 && (
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                    Variante
                  </label>
                  <select
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '2px solid #e2e8f0',
                      fontSize: '14px',
                      color: '#07111f',
                      background: '#ffffff',
                      outline: 'none',
                    }}
                  >
                    {item.product.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {[v.color, v.size].filter(Boolean).join(' / ')} — €{v.price.toFixed(2)}
                        {v.stock === 0 ? ' (Esgotado)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quantity */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Quantidade
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    style={{ width: '36px', height: '36px', borderRadius: '10px', border: '2px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    −
                  </button>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#07111f', minWidth: '28px', textAlign: 'center' }}>{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(20, quantity + 1))}
                    style={{ width: '36px', height: '36px', borderRadius: '10px', border: '2px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    +
                  </button>
                  <span style={{ marginLeft: 'auto', fontSize: '18px', fontWeight: 800, color: '#07111f' }}>
                    €{totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Notas (opcional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '2px solid #e2e8f0',
                    fontSize: '14px',
                    color: '#07111f',
                    resize: 'none',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Budget warning */}
              {overBudget && (
                <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '10px', background: '#fef9c3', border: '1px solid #fde047', fontSize: '13px', color: '#854d0e' }}>
                  ⚠ Esta encomenda (€{totalAmount.toFixed(2)}) excede o seu saldo disponível (€{remaining.toFixed(2)}).
                </div>
              )}

              {error && (
                <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fca5a5', fontSize: '13px', color: '#dc2626' }}>
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || overBudget}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '12px',
                  border: 'none',
                  background: submitting || overBudget ? '#cbd5e1' : accent,
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: submitting || overBudget ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.15s ease',
                }}
              >
                {submitting ? 'A submeter...' : 'Confirmar Encomenda'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main portal page ──────────────────────────────────────────────────────────

export default function EmployeePortalPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<PortalData | null>(null);
  const [orders, setOrders] = useState<EmployeeOrder[]>([]);
  const [loadingPortal, setLoadingPortal] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [activeTab, setActiveTab] = useState<'catalog' | 'orders'>('catalog');
  const [orderModal, setOrderModal] = useState<OrderModalState>({ open: false, item: null });
  const [portalError, setPortalError] = useState('');

  const fetchPortalData = useCallback(async (tok: string) => {
    setLoadingPortal(true);
    setPortalError('');
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/stores/${encodeURIComponent(slug)}/portal`,
        { headers: { Authorization: `Bearer ${tok}` } },
      );
      if (res.status === 401 || res.status === 403) {
        sessionStorage.removeItem('storeToken');
        router.push(`/store/${slug}/login`);
        return;
      }
      if (!res.ok) throw new Error('Erro ao carregar portal');
      const json = await res.json() as PortalData;
      setData(json);
    } catch {
      setPortalError('Não foi possível carregar os dados do portal.');
    } finally {
      setLoadingPortal(false);
    }
  }, [slug, router]);

  const fetchOrders = useCallback(async (tok: string) => {
    setLoadingOrders(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/stores/${encodeURIComponent(slug)}/orders`,
        { headers: { Authorization: `Bearer ${tok}` } },
      );
      if (!res.ok) return;
      const json = await res.json() as EmployeeOrder[];
      setOrders(Array.isArray(json) ? json : []);
    } catch {
      // non-critical
    } finally {
      setLoadingOrders(false);
    }
  }, [slug]);

  useEffect(() => {
    const tok = sessionStorage.getItem('storeToken');
    if (!tok) {
      router.push(`/store/${slug}/login`);
      return;
    }
    setToken(tok);
    fetchPortalData(tok);
  }, [slug, router, fetchPortalData]);

  function handleLogout() {
    sessionStorage.removeItem('storeToken');
    router.push(`/store/${slug}/login`);
  }

  function handleTabChange(tab: 'catalog' | 'orders') {
    setActiveTab(tab);
    if (tab === 'orders' && token && orders.length === 0) {
      fetchOrders(token);
    }
  }

  function handleOrderSuccess() {
    setOrderModal({ open: false, item: null });
    // Refresh portal data to update spent/remaining
    if (token) {
      fetchPortalData(token);
      fetchOrders(token);
    }
  }

  if (loadingPortal) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⟳</div>
          <p style={{ color: '#64748b', fontSize: '14px' }}>A carregar portal...</p>
        </div>
      </div>
    );
  }

  if (portalError || !data) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif",
          padding: '24px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '40px', marginBottom: '14px' }}>⚠</div>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: '#07111f' }}>
            Erro ao carregar
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b' }}>
            {portalError || 'Portal indisponível de momento.'}
          </p>
          <button
            type="button"
            onClick={() => { if (token) fetchPortalData(token); }}
            style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: '#4da3ff', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const { employee, store, remainingAllowance, products } = data;
  const accent = store.primaryColor ?? '#4da3ff';
  const spentPct = employee.allowance > 0
    ? Math.min(100, (employee.spent / employee.allowance) * 100)
    : 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif",
      }}
    >
      {/* ── Top nav ─────────────────────────────────────────────────────────── */}
      <nav
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e8ecf2',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {store.logoUrl ? (
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
              <Image
                src={store.logoUrl}
                alt={store.name}
                fill
                style={{ objectFit: 'contain', padding: '3px' }}
                unoptimized={store.logoUrl.startsWith('http')}
              />
            </div>
          ) : (
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
              🏪
            </div>
          )}
          <div>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#07111f', letterSpacing: '-0.02em' }}>
              {store.name}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Portal de Colaboradores</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right', display: 'none' }} className="portal-employee-info">
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#07111f' }}>{employee.name}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>{employee.email}</p>
          </div>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 800,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {employee.name.charAt(0).toUpperCase()}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: 'transparent',
              color: '#64748b',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Sair
          </button>
        </div>
      </nav>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* ── Employee allowance card ──────────────────────────────────────── */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e8ecf2',
            padding: '24px 28px',
            marginBottom: '28px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '16px',
              marginBottom: '18px',
            }}
          >
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Bem-vindo
              </p>
              <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800, color: '#07111f', letterSpacing: '-0.03em' }}>
                {employee.name}
              </h2>
              {employee.department && (
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{employee.department}</p>
              )}
            </div>

            {employee.allowance > 0 && (
              <div style={{ textAlign: 'right', minWidth: '180px' }}>
                <p style={{ margin: '0 0 3px', fontSize: '13px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Saldo disponível
                </p>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: accent, letterSpacing: '-0.04em' }}>
                  €{remainingAllowance.toFixed(2)}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  de €{employee.allowance.toFixed(2)} mensais
                </p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {employee.allowance > 0 && (
            <div>
              <div
                style={{
                  height: '8px',
                  borderRadius: '99px',
                  background: '#f1f5f9',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${spentPct}%`,
                    borderRadius: '99px',
                    background: spentPct > 85 ? '#f87171' : spentPct > 65 ? '#fb923c' : accent,
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Gasto: €{employee.spent.toFixed(2)}</span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{spentPct.toFixed(0)}% utilizado</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '24px',
            background: '#f1f5f9',
            padding: '4px',
            borderRadius: '12px',
            width: 'fit-content',
          }}
        >
          {(['catalog', 'orders'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              style={{
                padding: '8px 20px',
                borderRadius: '9px',
                border: 'none',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: activeTab === tab ? '#ffffff' : 'transparent',
                color: activeTab === tab ? '#07111f' : '#64748b',
                boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {tab === 'catalog' ? 'Catálogo' : 'As Minhas Encomendas'}
            </button>
          ))}
        </div>

        {/* ── Catálogo tab ─────────────────────────────────────────────────── */}
        {activeTab === 'catalog' && (
          <>
            {products.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '80px 24px',
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e8ecf2',
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎁</div>
                <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
                  Ainda não há artigos nesta loja. Volte em breve!
                </p>
              </div>
            ) : (
              <div id="portal-product-grid">
                {products.map((item) => {
                  const displayPrice = getDisplayPrice(item);
                  const thumb = item.product.images?.[0] ?? null;

                  return (
                    <div
                      key={item.id}
                      className="portal-product-card"
                      style={{
                        background: '#ffffff',
                        borderRadius: '16px',
                        border: '1px solid #e8ecf2',
                        overflow: 'hidden',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {/* Image */}
                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          aspectRatio: '4 / 3',
                          background: '#f1f5f9',
                          flexShrink: 0,
                          overflow: 'hidden',
                        }}
                      >
                        {thumb ? (
                          <Image
                            src={thumb}
                            alt={item.product.title}
                            fill
                            style={{ objectFit: 'cover' }}
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            unoptimized={thumb.startsWith('http')}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '48px', opacity: 0.3 }}>🎁</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                        <div style={{ flex: 1 }}>
                          <h3
                            style={{
                              margin: '0 0 5px',
                              fontSize: '14px',
                              fontWeight: 700,
                              color: '#07111f',
                              lineHeight: 1.4,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {item.product.title}
                          </h3>
                          {item.product.description && (
                            <p
                              style={{
                                margin: 0,
                                fontSize: '12px',
                                color: '#64748b',
                                lineHeight: 1.5,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {item.product.description}
                            </p>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <span style={{ fontSize: '17px', fontWeight: 800, color: '#07111f', letterSpacing: '-0.03em' }}>
                            €{displayPrice.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setOrderModal({ open: true, item })}
                            style={{
                              padding: '9px 16px',
                              borderRadius: '9px',
                              border: 'none',
                              background: accent,
                              color: '#ffffff',
                              fontSize: '13px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              transition: 'opacity 0.15s ease',
                            }}
                          >
                            Encomendar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Orders tab ────────────────────────────────────────────────────── */}
        {activeTab === 'orders' && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e8ecf2',
              overflow: 'hidden',
            }}
          >
            {loadingOrders ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                A carregar encomendas...
              </div>
            ) : orders.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>📦</div>
                <p style={{ margin: 0, fontSize: '15px', color: '#64748b' }}>Ainda não tem encomendas</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e8ecf2', background: '#f8fafc' }}>
                      {['Ref.', 'Qtd.', 'Valor', 'Estado', 'Data'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '12px 20px',
                            textAlign: 'left',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.07em',
                            color: '#94a3b8',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, idx) => (
                      <tr
                        key={order.id}
                        style={{
                          borderBottom: idx < orders.length - 1 ? '1px solid #f1f5f9' : 'none',
                          transition: 'background 0.1s',
                        }}
                      >
                        <td style={{ padding: '14px 20px', color: '#07111f', fontWeight: 600, fontFamily: 'monospace', fontSize: '12px' }}>
                          #{order.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td style={{ padding: '14px 20px', color: '#07111f' }}>{order.quantity}x</td>
                        <td style={{ padding: '14px 20px', color: '#07111f', fontWeight: 700 }}>€{order.totalAmount.toFixed(2)}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <StatusBadge status={order.status} />
                        </td>
                        <td style={{ padding: '14px 20px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {new Date(order.createdAt).toLocaleDateString('pt-PT', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Order modal ─────────────────────────────────────────────────────── */}
      {orderModal.open && orderModal.item && token && (
        <OrderModal
          item={orderModal.item}
          accent={accent}
          remaining={remainingAllowance}
          token={token}
          slug={slug}
          onClose={() => setOrderModal({ open: false, item: null })}
          onSuccess={handleOrderSuccess}
        />
      )}

      {/* ── Styles ──────────────────────────────────────────────────────────── */}
      <style>{`
        #portal-product-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        @media (max-width: 1024px) {
          #portal-product-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          #portal-product-grid { grid-template-columns: 1fr; }
        }
        .portal-product-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(0,0,0,0.09) !important;
        }
        @media (min-width: 640px) {
          .portal-employee-info { display: block !important; }
        }
      `}</style>
    </div>
  );
}
