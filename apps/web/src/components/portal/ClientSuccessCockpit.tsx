'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { springGentle, springSnappy } from '@/lib/motion';

// ── ClientSuccessCockpit ──────────────────────────────────────────────────────
//
// X5 Customer OS: Account manager intelligence panel.
// Aggregates client health, upsell signals, and margin data for the admin view.
//
// Usage:
//   <ClientSuccessCockpit />
//
// ─────────────────────────────────────────────────────────────────────────────

interface UpsellOpportunity {
  clientId: string;
  clientName: string;
  clientTier: string;
  type: 'dormant' | 'category_expansion' | 'volume_growth';
  signal: string;
  daysSinceLastOrder: number;
  totalSpend90d: number;
  topCategory: string;
}

interface MarginLeak {
  orderRef: string;
  productTitle: string;
  category: string;
  actualMarginPct: number;
  targetMarginPct: number;
  marginGapPct: number;
  leakAmount: number;
  severity: 'critical' | 'warning';
}

const fmt = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtCompact = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', notation: 'compact' });

const TIER_COLOR: Record<string, string> = {
  enterprise: 'rgb(167,139,250)',
  premium: '#d4b47a',
  standard: 'rgba(240,236,228,0.45)',
};

const TYPE_LABEL: Record<UpsellOpportunity['type'], { label: string; icon: string; color: string }> = {
  dormant:            { label: 'Dormido', icon: '💤', color: 'rgb(245,158,11)' },
  category_expansion: { label: 'Cross-sell', icon: '↗', color: '#d4b47a' },
  volume_growth:      { label: 'Volume', icon: '📈', color: '#b8975e' },
};

type Tab = 'upsells' | 'leaks';

export function ClientSuccessCockpit() {
  const [tab, setTab] = useState<Tab>('upsells');
  const [upsells, setUpsells] = useState<UpsellOpportunity[]>([]);
  const [leaks, setLeaks] = useState<MarginLeak[]>([]);
  const [leakSummary, setLeakSummary] = useState<{ totalLeaks: number; totalLeakAmount: number; criticalCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUpsells = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/margin-intelligence?mode=upsells');
      if (!res.ok) throw new Error('Falha ao carregar');
      const data = await res.json();
      setUpsells(data.opportunities ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLeaks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/margin-intelligence?mode=leaks');
      if (!res.ok) throw new Error('Falha ao carregar');
      const data = await res.json();
      setLeaks(data.leaks ?? []);
      setLeakSummary(data.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'upsells') loadUpsells();
    else loadLeaks();
  }, [tab, loadUpsells, loadLeaks]);

  // ── Tab bar ──────────────────────────────────────────────────────────────

  function TabBtn({ id, label, badge }: { id: Tab; label: string; badge?: number }) {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          flex: 1, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', border: 'none',
          fontSize: 12, fontWeight: 600,
          background: active ? 'rgba(154,124,74,0.14)' : 'transparent',
          color: active ? '#d4b47a' : 'rgba(240,236,228,0.35)',
          transition: 'all 160ms ease',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        {label}
        {badge !== undefined && badge > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 9999,
            background: active ? 'rgba(154,124,74,0.28)' : 'rgba(240,236,228,0.10)',
            color: active ? '#d4b47a' : 'rgba(240,236,228,0.35)',
          }}>
            {badge}
          </span>
        )}
      </button>
    );
  }

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-dark" style={{ height: 72, borderRadius: 10 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'rgba(240,236,228,0.35)', marginBottom: 8 }}>{error}</p>
        <button
          onClick={() => tab === 'upsells' ? loadUpsells() : loadLeaks()}
          style={{
            fontSize: 11, padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
            background: 'rgba(240,236,228,0.06)', color: 'rgba(240,236,228,0.45)',
            border: '1px solid rgba(240,236,228,0.10)',
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Tab switcher */}
      <div style={{
        display: 'flex', gap: 4, padding: '4px',
        background: 'rgba(240,236,228,0.04)', borderRadius: 10,
        marginBottom: 14,
      }}>
        <TabBtn id="upsells" label="Upsells" badge={upsells.length} />
        <TabBtn id="leaks" label="Margem" badge={leakSummary?.criticalCount} />
      </div>

      {/* ── Upsell Opportunities ── */}
      {tab === 'upsells' && (
        <div>
          {upsells.length === 0 ? (
            <p style={{ fontSize: 12, color: 'rgba(240,236,228,0.28)', textAlign: 'center', padding: 20 }}>
              Nenhuma oportunidade de upsell detectada.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {upsells.map((opp, i) => {
                const typeCfg = TYPE_LABEL[opp.type];
                const tierColor = TIER_COLOR[opp.clientTier] ?? TIER_COLOR.standard;
                return (
                  <motion.div
                    key={opp.clientId + opp.type}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...springSnappy, delay: i * 0.05 }}
                    style={{
                      padding: '11px 14px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(240,236,228,0.06)',
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 13 }}>{typeCfg.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#f0ece4' }}>
                          {opp.clientName}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999,
                          color: tierColor, background: `${tierColor}18`,
                          border: `1px solid ${tierColor}30`,
                          textTransform: 'capitalize',
                        }}>
                          {opp.clientTier}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 9999,
                        color: typeCfg.color, background: `${typeCfg.color}15`,
                      }}>
                        {typeCfg.label}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.35)', marginBottom: 5 }}>
                      {opp.signal}
                    </p>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                      <span>Spend 90d: <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{fmtCompact.format(opp.totalSpend90d)}</strong></span>
                      <span>Categoria: <strong style={{ color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' }}>{opp.topCategory}</strong></span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Margin Leaks ── */}
      {tab === 'leaks' && (
        <div>
          {/* Summary */}
          {leakSummary && leakSummary.totalLeaks > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springGentle}
              style={{
                padding: '12px 14px', marginBottom: 12,
                background: leakSummary.criticalCount > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                border: `1px solid ${leakSummary.criticalCount > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                borderRadius: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: leakSummary.criticalCount > 0 ? 'rgb(239,68,68)' : 'rgb(245,158,11)' }}>
                    {leakSummary.criticalCount > 0 ? `⚠ ${leakSummary.criticalCount} vazamentos críticos` : `◐ ${leakSummary.totalLeaks} vazamentos detectados`}
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.35)', marginTop: 2 }}>
                    Perda de margem estimada (30d)
                  </p>
                </div>
                <p style={{ fontSize: 18, fontWeight: 800, color: 'rgb(239,68,68)' }}>
                  {fmt.format(leakSummary.totalLeakAmount)}
                </p>
              </div>
            </motion.div>
          )}

          {leaks.length === 0 ? (
            <p style={{ fontSize: 12, color: 'rgba(240,236,228,0.28)', textAlign: 'center', padding: 20 }}>
              Sem vazamentos de margem detectados. ✓
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {leaks.slice(0, 8).map((leak, i) => (
                <motion.div
                  key={`${leak.orderRef}-${leak.productTitle}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...springSnappy, delay: i * 0.04 }}
                  style={{
                    padding: '10px 13px',
                    background: leak.severity === 'critical' ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)',
                    border: `1px solid ${leak.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)'}`,
                    borderRadius: 9,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#f0ece4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                      {leak.productTitle}
                    </p>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: leak.severity === 'critical' ? 'rgb(239,68,68)' : 'rgb(245,158,11)',
                    }}>
                      -{fmt.format(leak.leakAmount)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                    <span>Margem real: <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{leak.actualMarginPct}%</strong></span>
                    <span>Target: {leak.targetMarginPct}%</span>
                    <span>Gap: <strong style={{ color: leak.severity === 'critical' ? 'rgb(239,68,68)' : 'rgb(245,158,11)' }}>-{leak.marginGapPct}pp</strong></span>
                  </div>
                  <p style={{ fontSize: 10, color: 'rgba(240,236,228,0.22)', marginTop: 3 }}>
                    {leak.orderRef} · {leak.category}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
