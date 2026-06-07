'use client';

import { useState } from 'react';

// ── Types (mirror API DecisionCard interface) ─────────────────────────────────

export interface DecisionCardData {
  cardId: string;
  tenantId: string;
  quoteId?: string;
  generatedAt: string;
  summary: string;

  cost: {
    unitPrice: number;
    quantity: number;
    productTotal: number;
    shipping: number;
    duties: number;
    vat: number;
    handling: number;
    insurance: number;
    totalLandedCost: number;
    costPerUnit: number;
    landingMarkupPct: number;
    carrier: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  };

  budget: {
    available: number | null;
    required: number;
    withinBudget: boolean;
    utilizationPct: number | null;
    remainingAfter: number | null;
    status: 'OK' | 'TIGHT' | 'OVER' | 'UNKNOWN';
  };

  supplier: {
    id: string;
    name: string;
    trustScore: number | null;
    tier: 'GOLD' | 'SILVER' | 'BRONZE' | 'PROBATION' | 'NEW';
    totalOrders: number;
    onTimeDeliveryRate: number | null;
    costAccuracyRate: number | null;
    recommendation: string;
  };

  delivery: {
    quotedLeadDays: number;
    estimatedArrival: string | null;
    requiredByDate: string | null;
    daysBuffer: number | null;
    feasible: boolean;
    status: 'ON_TIME' | 'TIGHT' | 'LATE' | 'UNKNOWN';
  };

  risk: {
    level: 'GREEN' | 'AMBER' | 'RED';
    score: number;
    factors: string[];
  };

  recommendation: {
    action: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'REQUEST_REVISION' | 'REJECT';
    label: string;
    reasoning: string;
    conditions?: string[];
    alternatives?: string[];
  };
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const RISK_CONFIG = {
  GREEN:  { bg: 'rgba(184,151,94,0.08)',  border: 'rgba(184,151,94,0.18)',  text: '#b8975e',  dot: '#63e6be', label: 'RISCO BAIXO' },
  AMBER:  { bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)',  text: 'rgb(251,191,36)',  dot: '#fbbf24', label: 'RISCO MÉDIO' },
  RED:    { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   text: 'rgb(239,68,68)',   dot: '#ef4444', label: 'RISCO ALTO'  },
};

const ACTION_CONFIG = {
  APPROVE:                  { bg: '#b8975e',  text: '#090907',      label: 'Aprovar' },
  APPROVE_WITH_CONDITIONS:  { bg: 'rgb(251,191,36)',  text: '#090907',      label: 'Aprovar com condições' },
  REQUEST_REVISION:         { bg: '#d4b47a',  text: '#090907',      label: 'Pedir revisão' },
  REJECT:                   { bg: 'rgb(239,68,68)',   text: '#f0ece4',  label: 'Rejeitar' },
};

const TIER_CONFIG = {
  GOLD:      { bg: 'rgba(251,191,36,0.1)',  text: 'rgb(251,191,36)',  border: 'rgba(251,191,36,0.2)'  },
  SILVER:    { bg: 'rgba(170,180,198,0.1)', text: 'rgb(170,180,198)', border: 'rgba(170,180,198,0.2)' },
  BRONZE:    { bg: 'rgba(234,179,8,0.1)',   text: 'rgb(234,179,8)',   border: 'rgba(234,179,8,0.2)'   },
  PROBATION: { bg: 'rgba(239,68,68,0.1)',   text: 'rgb(239,68,68)',   border: 'rgba(239,68,68,0.2)'   },
  NEW:       { bg: 'rgba(154,124,74,0.10)',  text: '#d4b47a',  border: 'rgba(154,124,74,0.18)'  },
};

// ── Helper components ─────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('pt-PT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.42)', marginBottom: '0.875rem' }}>
      {children}
    </p>
  );
}

function Row({ label, value, accent, large }: { label: string; value: string; accent?: boolean; large?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.5rem 0', borderBottom: '1px solid rgba(240,236,228,0.04)' }}>
      <span style={{ fontSize: '0.8rem', color: 'rgba(240,236,228,0.42)' }}>{label}</span>
      <span style={{ fontSize: large ? '1.1rem' : '0.875rem', fontWeight: large ? 800 : 600, color: accent ? '#b8975e' : '#f0ece4', letterSpacing: large ? '-0.02em' : 'normal' }}>
        {value}
      </span>
    </div>
  );
}

function Pill({ children, color, bg, border }: { children: React.ReactNode; color: string; bg: string; border: string }) {
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color, background: bg, border: `1px solid ${border}`, borderRadius: '9999px', padding: '0.2rem 0.6rem' }}>
      {children}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DecisionCardProps {
  card: DecisionCardData;
  onApprove?: (cardId: string) => Promise<void>;
  onReject?: (cardId: string) => Promise<void>;
  onRequestRevision?: (cardId: string) => Promise<void>;
}

export function DecisionCard({ card, onApprove, onReject, onRequestRevision }: DecisionCardProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const risk = RISK_CONFIG[card.risk.level];
  const action = ACTION_CONFIG[card.recommendation.action];

  async function handleAction(type: 'approve' | 'reject' | 'revision') {
    setLoading(true);
    try {
      if (type === 'approve') await onApprove?.(card.cardId);
      if (type === 'reject') await onReject?.(card.cardId);
      if (type === 'revision') await onRequestRevision?.(card.cardId);
      setDone(type);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    const labels = { approve: '✓ Aprovado', reject: '✗ Rejeitado', revision: '↩ Revisão solicitada' };
    const colors = { approve: '#b8975e', reject: 'rgb(239,68,68)', revision: '#d4b47a' };
    return (
      <div className="yg-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
        <p style={{ fontSize: '2rem', fontWeight: 800, color: colors[done as keyof typeof colors], marginBottom: '0.5rem' }}>
          {labels[done as keyof typeof labels]}
        </p>
        <p style={{ color: 'rgba(240,236,228,0.42)', fontSize: '0.875rem' }}>Decisão registada · {card.cardId}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: '1.25rem', alignItems: 'start' }}>

      {/* ── LEFT COLUMN ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Header */}
        <div className="yg-card" style={{ padding: '1.5rem 1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.42)', marginBottom: '0.25rem' }}>
                Decisão de compra
              </p>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f0ece4', lineHeight: 1.3 }}>
                {card.summary}
              </h2>
            </div>
            {/* Risk badge */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: '10px', padding: '0.5rem 0.875rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: risk.dot, boxShadow: `0 0 8px ${risk.dot}` }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.07em', color: risk.text }}>{risk.label}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: risk.text }}>{card.risk.score}/100</span>
              </div>
            </div>
          </div>

          {/* Risk factors */}
          {card.risk.factors.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.25rem' }}>
              {card.risk.factors.map((f) => (
                <span key={f} style={{ fontSize: '0.7rem', color: risk.text, background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: '6px', padding: '0.2rem 0.5rem' }}>
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Landed cost breakdown */}
        <div className="yg-card" style={{ padding: '1.5rem 1.75rem' }}>
          <SectionLabel>Custo real (landed cost)</SectionLabel>
          <Row label="Produto" value={`€${fmt(card.cost.productTotal)}`} />
          <Row label="Transporte" value={`€${fmt(card.cost.shipping)}`} />
          <Row label="Direitos aduaneiros" value={`€${fmt(card.cost.duties)}`} />
          <Row label="IVA" value={`€${fmt(card.cost.vat)}`} />
          {card.cost.handling > 0 && <Row label="Manuseamento" value={`€${fmt(card.cost.handling)}`} />}
          {card.cost.insurance > 0 && <Row label="Seguro" value={`€${fmt(card.cost.insurance)}`} />}
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(240,236,228,0.10)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgb(170,180,198)' }}>Total landed</span>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#b8975e', letterSpacing: '-0.03em' }}>€{fmt(card.cost.totalLandedCost)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(240,236,228,0.42)' }}>€{fmt(card.cost.costPerUnit)} / unidade · {card.cost.carrier.toUpperCase()} · markup +{card.cost.landingMarkupPct.toFixed(1)}%</span>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', color: card.cost.confidence === 'HIGH' ? '#b8975e' : card.cost.confidence === 'MEDIUM' ? 'rgb(251,191,36)' : 'rgb(239,68,68)', background: 'rgba(240,236,228,0.06)', borderRadius: '4px', padding: '0.1rem 0.4rem' }}>
              Confiança: {card.cost.confidence}
            </span>
          </div>
        </div>

        {/* Supplier */}
        <div className="yg-card" style={{ padding: '1.5rem 1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <SectionLabel>Fornecedor</SectionLabel>
            <Pill
              color={TIER_CONFIG[card.supplier.tier].text}
              bg={TIER_CONFIG[card.supplier.tier].bg}
              border={TIER_CONFIG[card.supplier.tier].border}
            >
              {card.supplier.tier}
            </Pill>
          </div>
          <p style={{ fontSize: '1rem', fontWeight: 700, color: '#f0ece4', marginBottom: '0.875rem' }}>{card.supplier.name}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
            {[
              { label: 'Encomendas', value: card.supplier.totalOrders > 0 ? String(card.supplier.totalOrders) : '—' },
              { label: 'Entrega a tempo', value: card.supplier.onTimeDeliveryRate !== null ? `${card.supplier.onTimeDeliveryRate}%` : '—' },
              { label: 'Precisão de custo', value: card.supplier.costAccuracyRate !== null ? `${card.supplier.costAccuracyRate}%` : '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'rgba(240,236,228,0.04)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f0ece4', marginBottom: '0.2rem' }}>{value}</p>
                <p style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.42)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'rgb(170,180,198)', fontStyle: 'italic' }}>{card.supplier.recommendation}</p>
          {card.supplier.trustScore !== null && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.42)' }}>Trust score</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f0ece4' }}>{card.supplier.trustScore}/100</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(240,236,228,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${card.supplier.trustScore}%`, background: card.supplier.trustScore >= 80 ? '#b8975e' : card.supplier.trustScore >= 60 ? 'rgb(251,191,36)' : 'rgb(239,68,68)', borderRadius: '2px', transition: 'width 800ms ease' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT COLUMN ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'sticky', top: '1.5rem' }}>

        {/* Recommendation */}
        <div className="yg-card" style={{ padding: '1.5rem' }}>
          <SectionLabel>Recomendação</SectionLabel>
          <div style={{ background: action.bg, borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 800, color: action.text, letterSpacing: '0.02em' }}>{action.label}</p>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'rgb(170,180,198)', lineHeight: 1.6, marginBottom: '1rem' }}>
            {card.recommendation.reasoning}
          </p>
          {card.recommendation.conditions && card.recommendation.conditions.length > 0 && (
            <div style={{ marginBottom: '0.875rem' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgb(251,191,36)', marginBottom: '0.5rem' }}>Condições</p>
              <ul style={{ margin: 0, padding: '0 0 0 1rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {card.recommendation.conditions.map((c) => (
                  <li key={c} style={{ fontSize: '0.8rem', color: 'rgb(170,180,198)' }}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {card.recommendation.alternatives && card.recommendation.alternatives.length > 0 && (
            <div style={{ marginBottom: '0.875rem' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.42)', marginBottom: '0.5rem' }}>Alternativas</p>
              <ul style={{ margin: 0, padding: '0 0 0 1rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {card.recommendation.alternatives.map((a) => (
                  <li key={a} style={{ fontSize: '0.8rem', color: 'rgb(170,180,198)' }}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Budget */}
        <div className="yg-card" style={{ padding: '1.5rem' }}>
          <SectionLabel>Orçamento</SectionLabel>
          {card.budget.available !== null ? (
            <>
              <Row label="Necessário" value={`€${fmt(card.budget.required)}`} />
              <Row label="Disponível" value={`€${fmt(card.budget.available)}`} />
              {card.budget.remainingAfter !== null && (
                <Row label="Restante após" value={`€${fmt(card.budget.remainingAfter)}`} accent={card.budget.remainingAfter > 0} />
              )}
              {card.budget.utilizationPct !== null && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ height: '6px', background: 'rgba(240,236,228,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, card.budget.utilizationPct)}%`, background: card.budget.status === 'OVER' ? 'rgb(239,68,68)' : card.budget.status === 'TIGHT' ? 'rgb(251,191,36)' : '#b8975e', borderRadius: '3px', transition: 'width 600ms ease' }} />
                  </div>
                  <p style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.42)', marginTop: '0.375rem', textAlign: 'right' }}>{card.budget.utilizationPct.toFixed(1)}% utilizado</p>
                </div>
              )}
            </>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'rgba(240,236,228,0.42)', fontStyle: 'italic' }}>Orçamento não configurado</p>
          )}
        </div>

        {/* Delivery */}
        <div className="yg-card" style={{ padding: '1.5rem' }}>
          <SectionLabel>Entrega</SectionLabel>
          <Row label="Prazo do fornecedor" value={`${card.delivery.quotedLeadDays} dias`} />
          {card.delivery.estimatedArrival && (
            <Row label="Chegada estimada" value={new Date(card.delivery.estimatedArrival).toLocaleDateString('pt-PT')} />
          )}
          {card.delivery.requiredByDate && (
            <Row label="Necessário até" value={new Date(card.delivery.requiredByDate).toLocaleDateString('pt-PT')} />
          )}
          {card.delivery.daysBuffer !== null && (
            <Row
              label="Margem"
              value={`${card.delivery.daysBuffer >= 0 ? '+' : ''}${card.delivery.daysBuffer} dias`}
              accent={card.delivery.daysBuffer >= 3}
            />
          )}
          <div style={{ marginTop: '0.875rem', textAlign: 'center' }}>
            <span style={{
              fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
              color: card.delivery.status === 'ON_TIME' ? '#b8975e' : card.delivery.status === 'TIGHT' ? 'rgb(251,191,36)' : card.delivery.status === 'LATE' ? 'rgb(239,68,68)' : 'rgba(240,236,228,0.42)',
              background: card.delivery.status === 'ON_TIME' ? 'rgba(184,151,94,0.08)' : card.delivery.status === 'TIGHT' ? 'rgba(251,191,36,0.08)' : card.delivery.status === 'LATE' ? 'rgba(239,68,68,0.08)' : 'rgba(240,236,228,0.04)',
              border: `1px solid ${card.delivery.status === 'ON_TIME' ? 'rgba(184,151,94,0.18)' : card.delivery.status === 'TIGHT' ? 'rgba(251,191,36,0.2)' : card.delivery.status === 'LATE' ? 'rgba(239,68,68,0.2)' : 'rgba(240,236,228,0.06)'}`,
              borderRadius: '6px', padding: '0.3rem 0.75rem',
            }}>
              {card.delivery.status === 'ON_TIME' ? 'Entrega atempada' : card.delivery.status === 'TIGHT' ? 'Janela apertada' : card.delivery.status === 'LATE' ? 'Chegada com atraso' : 'Data não definida'}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {(card.recommendation.action === 'APPROVE' || card.recommendation.action === 'APPROVE_WITH_CONDITIONS') && (
            <button
              type="button"
              disabled={loading}
              onClick={() => handleAction('approve')}
              style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: '#b8975e', color: '#090907', fontSize: '0.875rem', fontWeight: 800, letterSpacing: '0.02em', opacity: loading ? 0.6 : 1, transition: 'opacity 150ms ease' }}
            >
              {loading ? 'A processar…' : '✓ Aprovar'}
            </button>
          )}
          {card.recommendation.action !== 'APPROVE' && (
            <button
              type="button"
              disabled={loading}
              onClick={() => handleAction('revision')}
              style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '1px solid rgba(154,124,74,0.28)', cursor: loading ? 'not-allowed' : 'pointer', background: 'rgba(154,124,74,0.08)', color: '#d4b47a', fontSize: '0.875rem', fontWeight: 700, opacity: loading ? 0.6 : 1 }}
            >
              ↩ Pedir revisão
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAction('reject')}
            style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)', cursor: loading ? 'not-allowed' : 'pointer', background: 'transparent', color: 'rgb(239,68,68)', fontSize: '0.875rem', fontWeight: 700, opacity: loading ? 0.6 : 1 }}
          >
            ✗ Rejeitar
          </button>
        </div>

        {/* Metadata */}
        <p style={{ fontSize: '0.65rem', color: 'rgb(80,90,110)', textAlign: 'center', lineHeight: 1.5 }}>
          Cartão gerado {new Date(card.generatedAt).toLocaleString('pt-PT')}
          {card.cardId && <><br />{card.cardId}</>}
        </p>
      </div>
    </div>
  );
}
