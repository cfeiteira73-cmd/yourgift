'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { springSnappy, springGentle } from '@/lib/motion';

// ── ReorderIntelligence ───────────────────────────────────────────────────────
//
// X5 Customer OS: Procurement intelligence panel.
// Calls /api/reorder-brain to surface reorder suggestions, repeat products,
// budget utilization, and predicted next order date.
//
// Usage:
//   <ReorderIntelligence />
//
// ─────────────────────────────────────────────────────────────────────────────

interface ReorderPattern {
  totalOrders: number;
  avgOrderValue: number;
  avgIntervalDays: number;
  predictedNextDate: string;
  daysUntilReorder: number;
  isOverdue: boolean;
  topCategories: Array<{ category: string; totalUnits: number }>;
  repeatProducts: Array<{ title: string; count: number; lastOrdered: string; image: string | null }>;
}

interface BudgetInfo {
  limit: number;
  spentThisMonth: number;
  remaining: number;
  utilizationPct: number | null;
}

interface LastOrder {
  id: string;
  ref: string;
  status: string;
  amount: number;
  date: string;
}

interface ReorderData {
  client: { id: string; name: string; company: string; tier: string };
  pattern: ReorderPattern;
  budget: BudgetInfo;
  insight: string;
  lastOrders: LastOrder[];
  generatedAt: string;
}

const fmt = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtCompact = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', notation: 'compact' });

function StatusDot({ overdue }: { overdue: boolean }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
      {overdue && (
        <motion.span
          animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgb(239,68,68)', opacity: 0.4 }}
        />
      )}
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: overdue ? 'rgb(239,68,68)' : 'rgb(99,230,190)',
      }} />
    </span>
  );
}

function BudgetRing({ pct, size = 72 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(100, pct);
  const color = fill > 90 ? 'rgb(239,68,68)' : fill > 70 ? 'rgb(245,158,11)' : 'rgb(77,163,255)';

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - fill / 100) }}
        transition={{ ...springGentle, delay: 0.3 }}
      />
      <text
        x={size / 2} y={size / 2 + 6}
        textAnchor="middle" fill={color}
        fontSize={13} fontWeight={700}
        style={{ transform: `rotate(90deg) translate(0, -${size / 2}px) translate(${size / 2}px, 0)`, transformOrigin: 'center' }}
      />
    </svg>
  );
}

function CountdownBadge({ days, isOverdue }: { days: number; isOverdue: boolean }) {
  const color = isOverdue ? 'rgb(239,68,68)' : days <= 7 ? 'rgb(245,158,11)' : 'rgb(77,163,255)';
  const bg = isOverdue ? 'rgba(239,68,68,0.1)' : days <= 7 ? 'rgba(245,158,11,0.1)' : 'rgba(77,163,255,0.1)';
  const border = isOverdue ? 'rgba(239,68,68,0.25)' : days <= 7 ? 'rgba(245,158,11,0.25)' : 'rgba(77,163,255,0.25)';

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: 9999,
        background: bg, border: `1px solid ${border}`,
        fontSize: 13, fontWeight: 700, color,
      }}
    >
      <StatusDot overdue={isOverdue} />
      {isOverdue
        ? `${Math.abs(days)}d em atraso`
        : days === 0
        ? 'Hoje'
        : `Em ${days}d`}
    </motion.div>
  );
}

function RepeatProductCard({ product, index, onReorder }: {
  product: ReorderPattern['repeatProducts'][0];
  index: number;
  onReorder: (title: string) => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...springSnappy, delay: index * 0.06 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px',
        background: hover ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10,
        cursor: 'default',
        transition: 'background 180ms ease',
      }}
    >
      {/* Product image or placeholder */}
      <div style={{
        width: 38, height: 38, borderRadius: 8, flexShrink: 0,
        background: 'rgba(77,163,255,0.1)',
        border: '1px solid rgba(77,163,255,0.15)',
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 16 }}>📦</span>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'rgb(245,247,251)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.title}
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
          Encomendado {product.count}× · Último: {new Date(product.lastOrdered).toLocaleDateString('pt-PT')}
        </p>
      </div>

      {/* Reorder count badge */}
      <span style={{
        flexShrink: 0, fontSize: 11, fontWeight: 700,
        padding: '3px 8px', borderRadius: 9999,
        background: 'rgba(99,230,190,0.1)', color: 'rgb(99,230,190)',
        border: '1px solid rgba(99,230,190,0.2)',
      }}>
        ×{product.count}
      </span>

      {/* Quick reorder button */}
      <AnimatePresence>
        {hover && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={springSnappy}
            onClick={() => onReorder(product.title)}
            style={{
              flexShrink: 0, fontSize: 11, fontWeight: 600,
              padding: '4px 10px', borderRadius: 7,
              background: 'rgba(77,163,255,0.15)', color: 'rgb(77,163,255)',
              border: '1px solid rgba(77,163,255,0.3)', cursor: 'pointer',
            }}
          >
            Reencomendar
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ReorderIntelligence() {
  const [data, setData] = useState<ReorderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/reorder-brain?mode=suggestions');
      if (!res.ok) throw new Error('Falha ao carregar dados');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReorder = useCallback(async (title: string) => {
    // Find the last order that contained this product to reorder from
    const lastOrder = data?.lastOrders?.[0];
    if (!lastOrder) return;

    setReordering(title);
    try {
      const res = await fetch('/api/reorder-brain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', orderId: lastOrder.id }),
      });
      const json = await res.json();
      if (json.redirect) window.location.href = json.redirect;
    } catch {
      // silent — user sees nothing happened
    } finally {
      setReordering(null);
    }
  }, [data]);

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[80, 140, 200].map((h, i) => (
          <div key={i} className="skeleton-dark" style={{ height: h, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: 24, borderRadius: 12, textAlign: 'center',
        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
      }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>{error}</p>
        <button
          onClick={load}
          style={{
            fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!data?.pattern) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
          Sem histórico de encomendas suficiente para análise.
        </p>
      </div>
    );
  }

  const { pattern, budget, insight, lastOrders } = data;
  const budgetPct = budget.utilizationPct ?? 0;
  const budgetColor = budgetPct > 90 ? 'rgb(239,68,68)' : budgetPct > 70 ? 'rgb(245,158,11)' : 'rgb(77,163,255)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Next Reorder Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springGentle }}
        style={{
          padding: '18px 20px',
          background: pattern.isOverdue
            ? 'rgba(239,68,68,0.06)'
            : pattern.daysUntilReorder <= 7
            ? 'rgba(245,158,11,0.06)'
            : 'rgba(77,163,255,0.05)',
          border: `1px solid ${pattern.isOverdue ? 'rgba(239,68,68,0.2)' : pattern.daysUntilReorder <= 7 ? 'rgba(245,158,11,0.2)' : 'rgba(77,163,255,0.15)'}`,
          borderRadius: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Próxima Recomenda Prevista
            </p>
            <CountdownBadge days={pattern.daysUntilReorder} isOverdue={pattern.isOverdue} />
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
              {new Date(pattern.predictedNextDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Intervalo médio</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'rgb(245,247,251)' }}>{pattern.avgIntervalDays}<span style={{ fontSize: 13, fontWeight: 500, marginLeft: 2 }}>d</span></p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{pattern.totalOrders} encomendas históricas</p>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 16 }}>
          <div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Valor médio</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'rgb(245,247,251)' }}>{fmt.format(pattern.avgOrderValue)}</p>
          </div>
          {pattern.topCategories.length > 0 && (
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Categoria #1</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'rgb(245,247,251)', textTransform: 'capitalize' }}>
                {pattern.topCategories[0].category}
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Budget Utilization ── */}
      {budget.limit > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springGentle, delay: 0.08 }}
          style={{
            padding: '16px 20px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Budget Mensal
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, color: budgetColor, marginTop: 4 }}>
                {budgetPct}%
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>
                {fmtCompact.format(budget.spentThisMonth)} de {fmtCompact.format(budget.limit)}
              </p>
              <p style={{ fontSize: 12, color: budget.remaining > 0 ? 'rgb(99,230,190)' : 'rgb(239,68,68)', fontWeight: 600 }}>
                {budget.remaining >= 0 ? `+${fmtCompact.format(budget.remaining)} disponível` : `${fmtCompact.format(Math.abs(budget.remaining))} excedido`}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 9999, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, budgetPct)}%` }}
              transition={{ ...springGentle, delay: 0.2 }}
              style={{ height: '100%', background: budgetColor, borderRadius: 9999 }}
            />
          </div>
        </motion.div>
      )}

      {/* ── AI Insight ── */}
      {insight && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springGentle, delay: 0.12 }}
          style={{
            padding: '14px 16px',
            background: 'rgba(99,230,190,0.05)',
            border: '1px solid rgba(99,230,190,0.12)',
            borderRadius: 12,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>✦</span>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>{insight}</p>
        </motion.div>
      )}

      {/* ── Repeat Products ── */}
      {pattern.repeatProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springGentle, delay: 0.16 }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Produtos Recorrentes
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pattern.repeatProducts.map((product, i) => (
              <RepeatProductCard
                key={product.title}
                product={product}
                index={i}
                onReorder={handleReorder}
              />
            ))}
          </div>
          {reordering && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 8, textAlign: 'center' }}>
              A criar nova proposta…
            </p>
          )}
        </motion.div>
      )}

      {/* ── Top Categories ── */}
      {pattern.topCategories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springGentle, delay: 0.2 }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Categorias por Volume
          </p>
          {pattern.topCategories.map((cat, i) => {
            const maxUnits = pattern.topCategories[0].totalUnits;
            const pct = Math.round((cat.totalUnits / maxUnits) * 100);
            return (
              <motion.div
                key={cat.category}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...springSnappy, delay: 0.2 + i * 0.05 }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}
              >
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', width: 90, flexShrink: 0, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cat.category}
                </span>
                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 9999, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ ...springGentle, delay: 0.3 + i * 0.05 }}
                    style={{ height: '100%', background: 'rgba(77,163,255,0.7)', borderRadius: 9999 }}
                  />
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', width: 48, textAlign: 'right', flexShrink: 0 }}>
                  {cat.totalUnits.toLocaleString('pt-PT')} un
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* ── Recent Orders ── */}
      {lastOrders?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springGentle, delay: 0.24 }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Últimas Encomendas
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lastOrders.map((order, i) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...springSnappy, delay: 0.24 + i * 0.04 }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.02)', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgb(245,247,251)' }}>{order.ref}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>
                    {new Date(order.date).toLocaleDateString('pt-PT')}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  {fmt.format(order.amount)}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
