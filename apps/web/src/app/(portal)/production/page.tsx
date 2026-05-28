'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';

// ── Constants ──────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  ref: string;
  status: string;
  total_amount: number | null;
  created_at: string;
  updated_at?: string | null;
  client?: { name: string | null; company: string | null } | null;
  order_items: {
    id: string;
    quantity: number;
    products: { title: string; images: string[] } | null;
  }[];
}

interface SlaDefinition {
  stage: string;
  display_name: string;
  expected_hours: number;
  warning_hours: number;
  critical_hours: number;
  color: string;
}

interface ClientProfile {
  id: string;
  name: string | null;
  company: string | null;
  tier: string | null;
}

// ── SLA helpers ───────────────────────────────────────────────────────────────

function getSlaStatus(order: Order, slaMap: Record<string, SlaDefinition>): 'ok' | 'warning' | 'critical' | 'none' {
  const sla = slaMap[order.status];
  if (!sla) return 'none';
  const ref = order.updated_at ?? order.created_at;
  const hoursElapsed = (Date.now() - new Date(ref).getTime()) / 3600000;
  if (hoursElapsed >= sla.critical_hours) return 'critical';
  if (hoursElapsed >= sla.warning_hours) return 'warning';
  return 'ok';
}

function getSlaHours(order: Order, slaMap: Record<string, SlaDefinition>): number {
  const ref = order.updated_at ?? order.created_at;
  return (Date.now() - new Date(ref).getTime()) / 3600000;
}

const SLA_STATUS_CFG = {
  ok:       { color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.1)',  label: 'No prazo',  dot: '●' },
  warning:  { color: 'rgb(245,158,11)', bg: 'rgba(245,158,11,0.1)', label: 'Em risco',   dot: '◐' },
  critical: { color: 'rgb(239,68,68)',  bg: 'rgba(239,68,68,0.1)',  label: 'SLA violado', dot: '⚠' },
  none:     { color: 'rgb(80,92,110)',  bg: 'rgba(80,92,110,0.08)', label: '—',           dot: '○' },
};

// ── Stage config ──────────────────────────────────────────────────────────────

const STAGES = [
  { key: 'pending',       label: 'Pendente',              color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.08)', border: 'rgba(120,130,150,0.15)', icon: '⏳' },
  { key: 'confirmed',     label: 'Confirmado',            color: 'rgb(77,163,255)',  bg: 'rgba(77,163,255,0.08)',  border: 'rgba(77,163,255,0.15)',  icon: '✅' },
  { key: 'producing',     label: 'Em Produção',           color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)',  icon: '🏭' },
  { key: 'quality',       label: 'Controlo QA',           color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.15)',   icon: '🔍' },
  { key: 'shipped',       label: 'Em Trânsito',           color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.08)', border: 'rgba(99,230,190,0.15)',  icon: '🚚' },
  { key: 'delivered',     label: 'Entregue',              color: 'rgb(167,243,208)', bg: 'rgba(167,243,208,0.08)',border: 'rgba(167,243,208,0.15)', icon: '🎉' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'agora';
  if (h < 24) return `${h}h atrás`;
  if (d === 1) return 'ontem';
  return `há ${d} dias`;
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

// ── Pipeline Card ─────────────────────────────────────────────────────────────

function PipelineCard({
  order,
  stage,
  slaMap,
  isAdmin,
}: {
  order: Order;
  stage: typeof STAGES[number];
  slaMap: Record<string, SlaDefinition>;
  isAdmin: boolean;
}) {
  const title = order.order_items?.[0]?.products?.title ?? 'Produto';
  const qty = order.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const slaStatus = getSlaStatus(order, slaMap);
  const slaCfg = SLA_STATUS_CFG[slaStatus];
  const hoursInStage = getSlaHours(order, slaMap);
  const sla = slaMap[order.status];
  const slaPct = sla ? Math.min((hoursInStage / sla.critical_hours) * 100, 100) : 0;
  const clientLabel = isAdmin
    ? (order.client?.company ?? order.client?.name ?? '—')
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2, boxShadow: `0 6px 20px ${stage.color}18` }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid ${slaStatus === 'critical' ? 'rgba(239,68,68,0.3)' : stage.border}`,
        borderRadius: '11px',
        padding: '0.7rem 0.8rem',
        cursor: 'default',
        marginBottom: '0.4rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* SLA progress bar at bottom */}
      {sla && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: 'rgba(255,255,255,0.04)' }}>
          <div style={{
            height: '100%',
            width: `${slaPct}%`,
            background: slaStatus === 'critical' ? 'rgb(239,68,68)' : slaStatus === 'warning' ? 'rgb(245,158,11)' : 'rgb(99,230,190)',
            transition: 'width 0.5s ease',
          }} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700, color: 'rgb(200,210,225)' }}>{order.ref}</span>
        <Link href={`/orders/${order.id}`} style={{ fontSize: '0.58rem', color: 'rgb(77,163,255)', textDecoration: 'none', flexShrink: 0, marginLeft: '0.3rem' }}>→</Link>
      </div>

      <p style={{ fontSize: '0.68rem', color: 'rgb(150,165,185)', marginBottom: '0.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>

      {isAdmin && clientLabel && (
        <p style={{ fontSize: '0.6rem', color: 'rgb(77,163,255)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
          {clientLabel}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
        <span style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)' }}>{qty} un. · {daysAgo(order.created_at)}</span>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: stage.color }}>
          {order.total_amount ? `€${order.total_amount.toLocaleString('pt-PT')}` : '—'}
        </span>
      </div>

      {/* SLA badge */}
      {slaStatus !== 'none' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{
            fontSize: '0.58rem', fontWeight: 700,
            color: slaCfg.color, background: slaCfg.bg,
            borderRadius: '9999px', padding: '0.1rem 0.35rem',
            whiteSpace: 'nowrap',
          }}>
            {slaCfg.dot} {slaCfg.label}
          </span>
          <span style={{ fontSize: '0.56rem', color: 'rgb(70,82,100)' }}>
            {fmtHours(hoursInStage)}{sla ? ` / ${fmtHours(sla.critical_hours)}` : ''}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProductionPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [slaMap, setSlaMap] = useState<Record<string, SlaDefinition>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/production'); return; }

      const admin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
      setIsAdmin(admin);

      // Fetch SLA definitions
      const { data: slaData } = await supabase
        .from('sla_definitions')
        .select('stage,display_name,expected_hours,warning_hours,critical_hours,color')
        .eq('is_active', true);

      const map: Record<string, SlaDefinition> = {};
      for (const s of slaData ?? []) map[s.stage] = s as SlaDefinition;
      setSlaMap(map);

      if (admin) {
        // Admin: all orders with client info
        const { data } = await supabase
          .from('orders')
          .select(`id,ref,status,total_amount,created_at,updated_at,
            order_items(id,quantity,products(title,images)),
            clients(name,company)`)
          .not('status', 'in', '("delivered","cancelled")')
          .order('created_at', { ascending: false })
          .limit(300);

        setOrders((data ?? []).map((o: any) => ({
          ...o,
          client: o.clients ?? null,
        })) as Order[]);
      } else {
        const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
        setClient(c as ClientProfile | null);
        if (c) {
          const { data } = await supabase
            .from('orders')
            .select('id,ref,status,total_amount,created_at,updated_at,order_items(id,quantity,products(title,images))')
            .eq('client_id', c.id)
            .not('status', 'in', '("delivered","cancelled")')
            .order('created_at', { ascending: false });
          setOrders((data ?? []) as unknown as Order[]);
        }
      }

      setLastRefresh(new Date());
    } catch (err) {
      console.error('[production] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(() => load(), 60000);
    return () => clearInterval(t);
  }, [load]);

  const visibleStages = stageFilter ? STAGES.filter(s => s.key === stageFilter) : STAGES;

  const byStage = STAGES.reduce((acc, stage) => {
    const keys = stage.key === 'producing' ? ['producing', 'in_production'] : [stage.key];
    acc[stage.key] = orders.filter(o => keys.includes(o.status));
    return acc;
  }, {} as Record<string, Order[]>);

  // SLA metrics
  const totalActive = orders.length;
  const criticalSla = orders.filter(o => getSlaStatus(o, slaMap) === 'critical').length;
  const warningSla = orders.filter(o => getSlaStatus(o, slaMap) === 'warning').length;
  const onTimeSla = orders.filter(o => getSlaStatus(o, slaMap) === 'ok').length;
  const slaCompliancePct = totalActive > 0 ? Math.round(((onTimeSla + warningSla) / totalActive) * 100) : 100;

  // Bottleneck: stage with most orders
  const bottleneck = STAGES.reduce((max, s) =>
    (byStage[s.key]?.length ?? 0) > (byStage[max]?.length ?? 0) ? s.key : max,
    STAGES[0].key
  );

  // Total value in production
  const totalValue = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0);

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ padding: '1.25rem 1.5rem', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.15rem' }}>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em' }}>
                Manufacturing OS
              </h1>
              {isAdmin && (
                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgb(116,231,255)', background: 'rgba(116,231,255,0.1)', border: '1px solid rgba(116,231,255,0.2)', borderRadius: '9999px', padding: '0.15rem 0.5rem' }}>
                  ADMIN — VISÃO GLOBAL
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'rgb(80,92,110)' }}>
              {totalActive} encomendas ativas · Atualizado {lastRefresh.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <motion.button
              type="button"
              onClick={() => { setLoading(true); load(); }}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              style={{ fontSize: '0.72rem', color: 'rgb(77,163,255)', background: 'rgba(77,163,255,0.08)', border: '1px solid rgba(77,163,255,0.2)', borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer' }}
            >
              ↻ Atualizar
            </motion.button>
            <Link href="/orders" style={{ fontSize: '0.72rem', color: 'rgb(77,163,255)', textDecoration: 'none', fontWeight: 600, padding: '0.35rem 0.75rem', background: 'rgba(77,163,255,0.08)', borderRadius: '8px', border: '1px solid rgba(77,163,255,0.2)' }}>
              Ver todas as encomendas →
            </Link>
          </div>
        </motion.div>

        {/* ── Operational KPIs ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', marginBottom: '0.875rem' }}>
          {[
            { label: 'Em produção',    value: String(totalActive),        color: 'rgb(77,163,255)',   icon: '🏭' },
            { label: 'No prazo',       value: String(onTimeSla),           color: 'rgb(99,230,190)',   icon: '✅' },
            { label: 'Em risco',       value: String(warningSla),          color: 'rgb(245,158,11)',   icon: '⚡' },
            { label: 'SLA violado',    value: String(criticalSla),         color: criticalSla > 0 ? 'rgb(239,68,68)' : 'rgb(99,230,190)', icon: '🚨' },
            { label: 'Compliance SLA', value: `${slaCompliancePct}%`,      color: slaCompliancePct >= 90 ? 'rgb(99,230,190)' : slaCompliancePct >= 70 ? 'rgb(245,158,11)' : 'rgb(239,68,68)', icon: '📊' },
            { label: 'Valor em curso', value: `€${Math.round(totalValue / 1000)}k`, color: 'rgb(167,139,250)', icon: '💶' },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.04 }}
              style={{ padding: '0.6rem 0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.55rem', color: 'rgb(80,92,110)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{kpi.label}</span>
                <span style={{ fontSize: '0.75rem' }}>{kpi.icon}</span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: kpi.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{kpi.value}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── SLA alert banner ── */}
        <AnimatePresence>
          {criticalSla > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: '0.5rem 0.875rem', marginBottom: '0.75rem',
                background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: '9px',
              }}
            >
              <span style={{ fontSize: '0.85rem' }}>🚨</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgb(252,165,165)' }}>
                {criticalSla} encomenda{criticalSla !== 1 ? 's' : ''} com SLA violado — ação imediata necessária
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stage filter pills ── */}
        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setStageFilter(null)}
            style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.25rem 0.625rem', borderRadius: '9999px', border: `1px solid ${!stageFilter ? 'rgba(77,163,255,0.4)' : 'rgba(255,255,255,0.07)'}`, background: !stageFilter ? 'rgba(77,163,255,0.12)' : 'rgba(255,255,255,0.03)', color: !stageFilter ? 'rgb(77,163,255)' : 'rgb(80,92,110)', cursor: 'pointer' }}>
            Todos ({totalActive})
          </button>
          {STAGES.map(stage => {
            const count = byStage[stage.key]?.length ?? 0;
            const isBottleneck = stage.key === bottleneck && count > 0;
            return (
              <button type="button" key={stage.key} type="button" onClick={() => setStageFilter(stageFilter === stage.key ? null : stage.key)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', fontWeight: count > 0 ? 700 : 400, padding: '0.25rem 0.625rem', borderRadius: '9999px', border: `1px solid ${stageFilter === stage.key ? stage.border : count > 0 ? stage.border : 'rgba(255,255,255,0.07)'}`, background: stageFilter === stage.key ? stage.bg : 'rgba(255,255,255,0.02)', color: count > 0 ? stage.color : 'rgb(60,72,90)', cursor: 'pointer' }}>
                {stage.icon} {count}
                {isBottleneck && <span style={{ fontSize: '0.52rem', color: 'rgb(245,158,11)', fontWeight: 700 }}>▲</span>}
              </button>
            );
          })}
          {Object.keys(slaMap).length > 0 && (
            <span style={{ fontSize: '0.62rem', color: 'rgb(60,72,90)', alignSelf: 'center', marginLeft: '0.25rem' }}>
              · {Object.keys(slaMap).length} estágios SLA definidos
            </span>
          )}
        </div>

        {/* ── Kanban board ── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleStages.length}, 1fr)`, gap: '0.5rem', flex: 1 }}>
            {visibleStages.map((_, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '0.875rem', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleStages.length}, 1fr)`, gap: '0.5rem', flex: 1, minHeight: 0, overflowX: visibleStages.length > 5 ? 'auto' : 'hidden' }}>
            {visibleStages.map((stage, si) => {
              const items = byStage[stage.key] ?? [];
              const criticalInStage = items.filter(o => getSlaStatus(o, slaMap) === 'critical').length;
              const isBottleneckStage = stage.key === bottleneck && items.length > 0;
              return (
                <motion.div key={stage.key}
                  initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: si * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    background: 'rgba(255,255,255,0.018)',
                    border: `1px solid ${criticalInStage > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: '12px', padding: '0.75rem 0.625rem',
                    overflowY: 'auto', display: 'flex', flexDirection: 'column',
                    minWidth: '180px',
                  }}>
                  {/* Column header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.625rem', paddingBottom: '0.5rem', borderBottom: `1px solid ${stage.border}` }}>
                    <span style={{ fontSize: '0.85rem' }}>{stage.icon}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: stage.color, flex: 1 }}>{stage.label}</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, background: stage.bg, border: `1px solid ${stage.border}`, color: stage.color, borderRadius: '9999px', padding: '0.1rem 0.4rem' }}>{items.length}</span>
                    {isBottleneckStage && (
                      <span style={{ fontSize: '0.55rem', color: 'rgb(245,158,11)', fontWeight: 700 }} title="Bottleneck">▲</span>
                    )}
                    {criticalInStage > 0 && (
                      <span style={{ fontSize: '0.55rem', background: 'rgba(239,68,68,0.15)', color: 'rgb(239,68,68)', borderRadius: '9999px', padding: '0.1rem 0.3rem', fontWeight: 800 }}>
                        {criticalInStage}⚠
                      </span>
                    )}
                  </div>

                  {/* SLA legend for this stage */}
                  {slaMap[stage.key] && (
                    <div style={{ fontSize: '0.57rem', color: 'rgb(60,72,90)', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                      SLA: {fmtHours(slaMap[stage.key].expected_hours)} · Alerta: {fmtHours(slaMap[stage.key].warning_hours)} · Crítico: {fmtHours(slaMap[stage.key].critical_hours)}
                    </div>
                  )}

                  {/* Cards */}
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <AnimatePresence>
                      {items.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.25rem 0', color: 'rgb(50,62,80)', fontSize: '0.65rem' }}>
                          Nenhuma encomenda
                        </div>
                      ) : (
                        items.map(order => (
                          <PipelineCard
                            key={order.id}
                            order={order}
                            stage={stage}
                            slaMap={slaMap}
                            isAdmin={isAdmin}
                          />
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
