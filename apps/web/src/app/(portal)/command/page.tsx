'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface Snapshot {
  system_health: number;
  finance: {
    rev_7d: number; rev_30d: number; pipeline: number;
    settlements_7d: number; open_disputes: number; dispute_value: number;
    pending_orders: number;
  };
  operations: {
    open_incidents: number; critical_incidents: number;
    sla_breaches: number; autopilot_actions_7d: number;
  };
  customers: {
    total: number; avg_health: number; at_risk: number; champions: number;
  };
  infrastructure: {
    integration_health_pct: number; integrations_up: number; integrations_total: number;
  };
  security: { alerts_7d: number };
  generated_at: string;
}

interface Critical {
  urgent_disputes: Array<{ id: string; amount: number; reason: string | null; status: string; due_by: string | null }>;
  critical_incidents: Array<{ id: string; title: string; severity: string; created_at: string }>;
  security_alerts: Array<{ id: string; event_type: string; risk_score: number; created_at: string }>;
  sla_breaches: Array<{ id: string; entity_type: string; hours_overdue: number }>;
  at_risk_clients: Array<{ client_id: string; overall_score: number; risk_level: string }>;
}

function fmt(n: number) {
  if (n >= 1000000) return `€${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `€${(n / 1000).toFixed(0)}K`;
  return `€${n}`;
}

function SystemHealthRing({ score }: { score: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'OPERACIONAL' : score >= 60 ? 'ATENÇÃO' : 'CRÍTICO';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1.2s ease', filter: `drop-shadow(0 0 8px ${color}40)` }} />
        <text x={50} y={46} textAnchor="middle" fill="white" fontSize={20} fontWeight="700">{score}</text>
        <text x={50} y={60} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.4)">{label}</text>
      </svg>
    </div>
  );
}

function Block({
  title, href, icon, children, alert = false, pulse = false,
}: { title: string; href: string; icon: string; children: React.ReactNode; alert?: boolean; pulse?: boolean }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <motion.div whileHover={{ scale: 1.01, y: -1 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={`rounded-2xl border p-5 space-y-3 h-full cursor-pointer transition-colors ${
          alert
            ? 'border-red-500/25 bg-red-500/5 hover:bg-red-500/8'
            : 'border-white/8 bg-white/3 hover:bg-white/5'
        }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{icon}</span>
            <p className="text-white/60 text-[10px] font-medium uppercase tracking-wider">{title}</p>
          </div>
          {pulse && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </div>
        {children}
      </motion.div>
    </Link>
  );
}

function Metric({ label, value, color = 'text-white', sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-white/40 text-[10px]">{label}</p>
      {sub && <p className="text-white/25 text-[9px]">{sub}</p>}
    </div>
  );
}

export default function CommandPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [critical, setCritical] = useState<Critical | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [snapRes, critRes] = await Promise.all([
        fetch('/api/command?mode=full'),
        fetch('/api/command?mode=critical'),
      ]);
      const [sd, cd] = await Promise.all([snapRes.json(), critRes.json()]);
      setSnap(sd);
      setCritical(cd.critical);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 60s
    intervalRef.current = setInterval(load, 60000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const totalCritical = critical
    ? critical.urgent_disputes.length + critical.critical_incidents.length + critical.security_alerts.length
    : 0;

  const f = snap?.finance;
  const ops = snap?.operations;
  const cust = snap?.customers;
  const infra = snap?.infrastructure;
  const sec = snap?.security;

  return (
    <div className="p-6 space-y-5 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold flex items-center gap-2">
            Command Center
            {loading && <span className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white animate-spin" />}
          </h1>
          <p className="text-white/40 text-xs mt-0.5">
            Todos os sistemas · One screen
            {lastRefresh && <span className="ml-2 text-white/20">atualizado {lastRefresh.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalCritical > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <p className="text-red-400 text-xs font-medium">{totalCritical} acções críticas</p>
            </div>
          )}
          <button type="button" onClick={load}
            className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/60 text-xs transition-colors">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* System health + top KPIs */}
      <div className="grid grid-cols-7 gap-3 items-center">
        <div className="rounded-2xl border border-white/8 bg-white/3 p-4 flex items-center justify-center">
          <SystemHealthRing score={snap?.system_health ?? 100} />
        </div>
        {/* Finance block */}
        <div className="col-span-2 rounded-2xl border border-white/8 bg-white/3 p-4 grid grid-cols-2 gap-3">
          <Metric label="Receita 7d" value={f ? fmt(f.rev_7d) : '—'} color="text-emerald-400" />
          <Metric label="Receita 30d" value={f ? fmt(f.rev_30d) : '—'} color="text-emerald-300" />
          <Metric label="Pipeline" value={f ? fmt(f.pipeline) : '—'} color="text-blue-400" />
          <Metric label="Settlements 7d" value={f ? fmt(f.settlements_7d) : '—'} color="text-white" />
        </div>
        {/* Ops block */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-2">
          <p className="text-white/40 text-[9px] font-medium uppercase tracking-wider">Operações</p>
          <Metric label="Incidentes" value={ops?.open_incidents ?? '—'} color={ops && ops.open_incidents > 0 ? 'text-amber-400' : 'text-white'} />
          <Metric label="SLA Breaches" value={ops?.sla_breaches ?? '—'} color={ops && ops.sla_breaches > 0 ? 'text-red-400' : 'text-white'} />
        </div>
        {/* Customers block */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-2">
          <p className="text-white/40 text-[9px] font-medium uppercase tracking-wider">Clientes</p>
          <Metric label="Health Médio" value={cust ? `${cust.avg_health}/100` : '—'} color="text-blue-400" />
          <Metric label="Em Risco" value={cust?.at_risk ?? '—'} color={cust && cust.at_risk > 0 ? 'text-amber-400' : 'text-white'} />
        </div>
        {/* Security + Infra */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-2">
          <p className="text-white/40 text-[9px] font-medium uppercase tracking-wider">Segurança</p>
          <Metric label="Alertas 7d" value={sec?.alerts_7d ?? '—'} color={sec && sec.alerts_7d > 0 ? 'text-red-400' : 'text-white'} />
          <Metric label="Integrações" value={infra ? `${infra.integration_health_pct}%` : '—'} color={infra && infra.integration_health_pct < 80 ? 'text-amber-400' : 'text-emerald-400'} />
        </div>
        {/* Autopilot */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-2">
          <p className="text-white/40 text-[9px] font-medium uppercase tracking-wider">AI Autopilot</p>
          <Metric label="Acções 7d" value={ops?.autopilot_actions_7d ?? '—'} color="text-violet-400" />
          <Metric label="Campeões" value={cust?.champions ?? '—'} color="text-emerald-400" />
        </div>
      </div>

      {/* Main blocks grid */}
      <div className="grid grid-cols-4 gap-4">
        <Block title="Finance & Payments" href="/payments" icon="💰"
          alert={!!(f && (f.open_disputes > 0 || f.pending_orders > 5))}>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <p className="text-emerald-400 font-bold text-lg">{f ? fmt(f.rev_7d) : '—'}</p>
              <p className="text-white/30">Receita 7d</p>
            </div>
            <div>
              <p className={`font-bold text-lg ${f && f.open_disputes > 0 ? 'text-red-400' : 'text-white'}`}>{f?.open_disputes ?? '—'}</p>
              <p className="text-white/30">Disputas</p>
            </div>
          </div>
          {f && f.pending_orders > 0 && (
            <p className="text-amber-400 text-[9px]">⚠️ {f.pending_orders} encomendas pendentes</p>
          )}
        </Block>

        <Block title="Operations" href="/ops" icon="⚡"
          alert={!!(ops && (ops.critical_incidents > 0 || ops.sla_breaches > 0))}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={`font-bold text-lg ${ops && ops.open_incidents > 0 ? 'text-amber-400' : 'text-white'}`}>{ops?.open_incidents ?? '—'}</p>
              <p className="text-white/30 text-[10px]">Incidentes</p>
            </div>
            <div>
              <p className={`font-bold text-lg ${ops && ops.sla_breaches > 0 ? 'text-red-400' : 'text-white'}`}>{ops?.sla_breaches ?? '—'}</p>
              <p className="text-white/30 text-[10px]">SLA Breaks</p>
            </div>
          </div>
          {ops && ops.critical_incidents > 0 && (
            <p className="text-red-400 text-[9px]">🚨 {ops.critical_incidents} incidente(s) crítico(s)</p>
          )}
        </Block>

        <Block title="Customer Success" href="/client-success" icon="🤝"
          alert={!!(cust && cust.at_risk > 5)}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-blue-400 font-bold text-lg">{cust ? `${cust.avg_health}%` : '—'}</p>
              <p className="text-white/30 text-[10px]">Health Médio</p>
            </div>
            <div>
              <p className={`font-bold text-lg ${cust && cust.at_risk > 0 ? 'text-amber-400' : 'text-white'}`}>{cust?.at_risk ?? '—'}</p>
              <p className="text-white/30 text-[10px]">Em Risco</p>
            </div>
          </div>
          <p className="text-emerald-400 text-[9px]">🏆 {cust?.champions ?? 0} campeões</p>
        </Block>

        <Block title="Security" href="/security" icon="🛡️"
          alert={!!(sec && sec.alerts_7d > 0)}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={`font-bold text-lg ${sec && sec.alerts_7d > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{sec?.alerts_7d ?? '—'}</p>
              <p className="text-white/30 text-[10px]">Alertas 7d</p>
            </div>
            <div>
              <p className={`font-bold text-lg ${infra && infra.integration_health_pct < 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {infra ? `${infra.integration_health_pct}%` : '—'}
              </p>
              <p className="text-white/30 text-[10px]">Integrações</p>
            </div>
          </div>
          {snap?.system_health && snap.system_health < 70 && (
            <p className="text-red-400 text-[9px]">⚠️ System health degradado</p>
          )}
        </Block>
      </div>

      {/* Critical signals row */}
      <AnimatePresence>
        {critical && totalCritical > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <p className="text-red-400 text-[10px] font-medium uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Acções Requeridas Imediatamente ({totalCritical})
            </p>
            <div className="grid grid-cols-3 gap-3">
              {/* Urgent disputes */}
              {critical.urgent_disputes.length > 0 && (
                <Link href="/disputes" style={{ textDecoration: 'none' }}>
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 space-y-2 hover:bg-red-500/8 transition-colors cursor-pointer">
                    <p className="text-red-400 text-[10px] font-medium">⚖️ Disputas Urgentes</p>
                    {critical.urgent_disputes.map(d => (
                      <div key={d.id} className="flex justify-between text-[9px]">
                        <span className="text-white/60 truncate">{d.reason ?? 'Sem razão'}</span>
                        <span className="text-red-400 font-bold ml-2 shrink-0">€{d.amount}</span>
                      </div>
                    ))}
                  </div>
                </Link>
              )}

              {/* Critical incidents */}
              {critical.critical_incidents.length > 0 && (
                <Link href="/ops" style={{ textDecoration: 'none' }}>
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2 hover:bg-amber-500/8 transition-colors cursor-pointer">
                    <p className="text-amber-400 text-[10px] font-medium">🚨 Incidentes Críticos</p>
                    {critical.critical_incidents.map(i => (
                      <p key={i.id} className="text-white/60 text-[9px] truncate">{i.title}</p>
                    ))}
                  </div>
                </Link>
              )}

              {/* Security alerts */}
              {critical.security_alerts.length > 0 && (
                <Link href="/security" style={{ textDecoration: 'none' }}>
                  <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-2 hover:bg-orange-500/8 transition-colors cursor-pointer">
                    <p className="text-orange-400 text-[10px] font-medium">🛡️ Alertas de Segurança</p>
                    {critical.security_alerts.map(s => (
                      <div key={s.id} className="flex justify-between text-[9px]">
                        <span className="text-white/60 truncate">{s.event_type.replace(/_/g, ' ')}</span>
                        <span className="text-orange-400 ml-2 shrink-0">{s.risk_score}</span>
                      </div>
                    ))}
                  </div>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick navigation */}
      <div>
        <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider mb-3">Acesso Rápido</p>
        <div className="grid grid-cols-12 gap-2">
          {[
            { href: '/autopilot',      label: 'Autopilot',    icon: '🤖' },
            { href: '/intel',          label: 'Intelligence', icon: '🔮' },
            { href: '/forecasting',    label: 'Forecasting',  icon: '📈' },
            { href: '/reconciliation', label: 'Reconciliação',icon: '🧾' },
            { href: '/postmortems',    label: 'Postmortems',  icon: '📋' },
            { href: '/control-tower',  label: 'Supply Chain', icon: '🗼' },
            { href: '/ecosystem',      label: 'Ecosystem',    icon: '🌐' },
            { href: '/disputes',       label: 'Disputas',     icon: '⚖️' },
            { href: '/mobile',         label: 'Mobile Ops',   icon: '📱' },
            { href: '/approvals',      label: 'Approvals',    icon: '✅' },
            { href: '/support',        label: 'Support',      icon: '🎧' },
            { href: '/audit',          label: 'Audit',        icon: '🔒' },
          ].map(({ href, label, icon }) => (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="rounded-xl border border-white/8 bg-white/3 p-3 text-center hover:bg-white/6 transition-colors cursor-pointer">
                <p className="text-xl mb-1">{icon}</p>
                <p className="text-white/40 text-[9px]">{label}</p>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
