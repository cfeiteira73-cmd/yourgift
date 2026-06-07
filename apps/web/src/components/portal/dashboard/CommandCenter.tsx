'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  products: { title: string; images: string[] } | null;
}

interface RecentOrder {
  id: string;
  ref: string;
  status: string;
  total_amount: number | null;
  created_at: string;
  order_items: OrderItem[];
}

export interface SupplierScore {
  supplier_name: string;
  overall_score: number;
  quality_score?: number | null;
  delivery_score?: number | null;
  [key: string]: unknown;
}

export interface SlaDefinition {
  stage: string;
  display_name: string;
  expected_hours: number;
  warning_hours: number;
  critical_hours: number;
  color: string;
}

export interface CommandCenterProps {
  userName?: string;
  companyName?: string;
  tier?: string;
  totalThisMonth: number;
  activeOrders: number;
  pendingQuotes: number;
  budgetDisplay: string;
  orders: RecentOrder[];
  pipeline: Record<string, number>;
  dailyRevenue: number[];
  // ── Operational intelligence — real DB data ──────────────────────────────
  inventoryAlerts?: { critical: number; lowStock: number; total: number };
  supplierScores?: SupplierScore[];
  slaDefinitions?: SlaDefinition[];
  totalClients?: number;
  premiumClients?: number;
  allTimeRevenue?: number;
}

// ── useCountUp ────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1000, delay = 0) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const t0 = performance.now() + delay;
    const step = (now: number) => {
      if (now < t0) { raf.current = requestAnimationFrame(step); return; }
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(target * ease);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, delay]);
  return val;
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * height * 0.8 - height * 0.1,
  }));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i - 1].x + pts[i].x) / 2;
    d += ` C ${cx} ${pts[i - 1].y} ${cx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
  }
  const area = `${d} L ${pts[pts.length - 1].x} ${height} L 0 ${height} Z`;
  const gradId = `sp${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────────────

function DonutChart({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  const r = 44; const cx = 56; const cy = 56; const stroke = 13;
  const circumference = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="112" height="112" viewBox="0 0 112 112">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(240,236,228,0.06)" strokeWidth={stroke} />
        {segments.map((seg, i) => {
          const pct = total > 0 ? seg.value / total : 0;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const startAngle = acc;
          acc += pct;
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-(startAngle * circumference) + circumference / 4}
              strokeLinecap="butt" />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.04em', lineHeight: 1 }}>{total}</div>
        <div style={{ fontSize: '0.58rem', color: 'rgba(240,236,228,0.42)' }}>Total</div>
      </div>
    </div>
  );
}

// ── Performance chart ──────────────────────────────────────────────────────────

function PerformanceChart({ series, labels }: { series: { label: string; data: number[]; color: string }[]; labels: string[] }) {
  const W = 320; const H = 90;
  const maxV = 100; const minV = 50; const range = maxV - minV;
  function toPath(data: number[]) {
    const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * W, y: H - ((v - minV) / range) * H }));
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cx = (pts[i - 1].x + pts[i].x) / 2;
      d += ` C ${cx} ${pts[i - 1].y} ${cx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
    }
    return { d, pts };
  }
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 14}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      {[100, 75, 50].map((y) => {
        const yPx = H - ((y - minV) / range) * H;
        return <g key={y}>
          <line x1={0} y1={yPx} x2={W} y2={yPx} stroke="rgba(240,236,228,0.06)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={-2} y={yPx + 3} textAnchor="end" fontSize={7} fill="rgba(240,236,228,0.24)">{y}%</text>
        </g>;
      })}
      {series.map((s) => {
        const { d, pts } = toPath(s.data);
        const area = `${d} L ${pts[pts.length - 1].x} ${H} L 0 ${H} Z`;
        const gid = `pc${s.color.replace(/[^a-z0-9]/gi, '')}`;
        return <g key={s.label}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient></defs>
          <path d={area} fill={`url(#${gid})`} />
          <path d={d} fill="none" stroke={s.color} strokeWidth="1.75" strokeLinecap="round" />
        </g>;
      })}
      {labels.map((lbl, i) => {
        const step = Math.floor(labels.length / 4);
        if (i !== 0 && i % step !== 0 && i !== labels.length - 1) return null;
        return <text key={i} x={(i / (labels.length - 1)) * W} y={H + 12} textAnchor="middle" fontSize={7} fill="rgba(240,236,228,0.24)">{lbl}</text>;
      })}
    </svg>
  );
}

// ── Supplier Score Bar ────────────────────────────────────────────────────────

function ScoreBar({ score, color }: { score: number; color: string }) {
  const pct = Math.min(Math.max(score, 0), 100);
  return (
    <div style={{ height: '3px', background: 'rgba(240,236,228,0.06)', borderRadius: '9999px', overflow: 'hidden', width: '100%' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        style={{ height: '100%', background: color, borderRadius: '9999px' }}
      />
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  draft:              { label: 'Rascunho',     color: 'rgba(240,236,228,0.42)', bg: 'rgba(120,130,150,0.12)' },
  pending:            { label: 'A aguardar',   color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.12)'  },
  confirmed:          { label: 'Confirmado',   color: '#d4b47a',  bg: 'rgba(154,124,74,0.12)'  },
  payment_confirmed:  { label: 'Pago',         color: '#d4b47a',  bg: 'rgba(154,124,74,0.12)'  },
  approved:           { label: 'Aprovada',     color: '#b8975e',  bg: 'rgba(184,151,94,0.12)'  },
  producing:          { label: 'Em produção',  color: '#b8975e', bg: 'rgba(154,124,74,0.12)' },
  in_production:      { label: 'Em produção',  color: '#b8975e', bg: 'rgba(154,124,74,0.12)' },
  shipped:            { label: 'Em trânsito',  color: '#d4b47a',  bg: 'rgba(154,124,74,0.12)'  },
  delivered:          { label: 'Entregue',     color: '#b8975e',  bg: 'rgba(184,151,94,0.12)'  },
  cancelled:          { label: 'Cancelado',    color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.12)'   },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: 'rgba(240,236,228,0.42)', bg: 'rgba(120,130,150,0.12)' };
  return (
    <span style={{
      display: 'inline-block', padding: '0.18rem 0.5rem', borderRadius: '9999px',
      fontSize: '0.62rem', fontWeight: 700, color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  );
}

// ── Static mock data ───────────────────────────────────────────────────────────

const NOTIFS = [
  { icon: '📦', title: 'Nova encomenda recebida', sub: '#YG-2024-1025', time: '2 min atrás', dot: '#d4b47a' },
  { icon: '🎨', title: 'Arte aprovada', sub: 'Logotipo "TechCorp"', time: '15 min atrás', dot: '#b8975e' },
  { icon: '✅', title: 'Produção concluída', sub: '#YG-2024-1023', time: '1 hora atrás', dot: '#b8975e' },
  { icon: '🚚', title: 'Entrega realizada', sub: '#YG-2024-1021', time: '2 horas atrás', dot: '#b8975e' },
  { icon: '💶', title: 'Pagamento recebido', sub: '#YG-2024-1022', time: '3 horas atrás', dot: 'rgb(167,139,250)' },
];
const TOP_PRODUCTS = [
  { rank: 1, name: 'T-shirt Personalizada',  units: 350, revenue: '€4.850', color: '#b8975e' },
  { rank: 2, name: 'Caneca Personalizada',    units: 260, revenue: '€3.360', color: '#d4b47a' },
  { rank: 3, name: 'Saco Tote Personalizado', units: 220, revenue: '€2.420', color: 'rgb(245,158,11)' },
  { rank: 4, name: 'Garrafa Térmica',         units: 180, revenue: '€2.160', color: 'rgb(167,139,250)' },
  { rank: 5, name: 'Hoodie Personalizado',    units: 150, revenue: '€3.750', color: '#b8975e' },
];
const MOCKUPS = [
  { client: 'TechSolutions - T-shirt',   time: 'Criada há 2 horas', ok: true  },
  { client: 'DesignStudio - Caneca',     time: 'Criada há 4 horas', ok: false },
  { client: 'MarketingBoost - Tote Bag', time: 'Criada há 6 horas', ok: true  },
  { client: 'StartuoHub - Hoodie',       time: 'Criada há 1 dia',   ok: true  },
];
const QUICK_ACTIONS = [
  { icon: '📦', label: 'Nova Encomenda',        href: '/quotes/new' },
  { icon: '🖼️', label: 'Upload de Logótipo',   href: '/assets'     },
  { icon: '🎨', label: 'Criar Maquete',         href: '/assets'     },
  { icon: '💬', label: 'Orçamento Rápido',      href: '/quotes'     },
  { icon: '📊', label: 'Relatório de Produção', href: '/reports'    },
  { icon: '🧾', label: 'Fatura Rápida',         href: '/billing'    },
];
const FEATURES = [
  { icon: '💎', label: 'Qualidade Premium',  desc: 'Materiais de alta qualidade e impressão profissional' },
  { icon: '⚡', label: 'Entregas Rápidas',   desc: '99% das encomendas entregues no prazo' },
  { icon: '🌿', label: 'Sustentabilidade',   desc: 'Produtos ecológicos e processos sustentáveis' },
  { icon: '🎧', label: 'Suporte Dedicado',   desc: 'Equipa especializada sempre disponível' },
  { icon: '🤖', label: 'Tecnologia Avançada',desc: 'IA e automação para melhores resultados' },
  { icon: '🛡️', label: 'Garantia Total',    desc: '100% de satisfação garantida' },
];
const PERF_LABELS = ['1 Mai','3','5','8','10','12','15','17','19','22','24','26','29 Mai'];
const PERF_SERIES = [
  { label: 'Qualidade',     data: [96,97,98,97,99,98,98,99,99,98,99,98,99], color: '#b8975e'  },
  { label: 'Pontualidade',  data: [92,94,95,93,96,95,97,96,96,95,97,96,96], color: '#d4b47a'  },
  { label: 'Produtividade', data: [88,90,93,91,94,92,95,94,94,93,95,94,94], color: 'rgb(167,139,250)' },
];

// ── Supplier score color helper ────────────────────────────────────────────────

function scoreColor(s: number): string {
  if (s >= 85) return '#b8975e';
  if (s >= 70) return '#d4b47a';
  if (s >= 55) return 'rgb(245,158,11)';
  return 'rgb(239,68,68)';
}

// ── SLA color helper ──────────────────────────────────────────────────────────

function slaStatusColor(dbColor: string): string {
  // Database colors from sla_definitions.color — normalize to our palette
  const c = (dbColor ?? '').toLowerCase();
  if (c.includes('green') || c === '#10b981' || c === '#22c55e') return '#b8975e';
  if (c.includes('blue')  || c === '#3b82f6' || c === '#60a5fa') return '#d4b47a';
  if (c.includes('yellow')|| c === '#f59e0b' || c === '#eab308') return 'rgb(245,158,11)';
  if (c.includes('red')   || c === '#ef4444' || c === '#dc2626') return 'rgb(239,68,68)';
  if (c.includes('purple')|| c === '#8b5cf6') return 'rgb(167,139,250)';
  if (c.includes('cyan')  || c === '#06b6d4') return '#b8975e';
  // Fallback: try to use the color directly if it's an RGB/hex value
  return dbColor.startsWith('#') || dbColor.startsWith('rgb') ? dbColor : '#d4b47a';
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CommandCenter({
  userName, companyName, tier,
  totalThisMonth, activeOrders, pendingQuotes,
  budgetDisplay, orders, pipeline, dailyRevenue,
  inventoryAlerts, supplierScores, slaDefinitions,
  totalClients, premiumClients, allTimeRevenue,
}: CommandCenterProps) {

  // Compute SLA violations from orders + slaDefinitions
  const slaViolations = slaDefinitions && slaDefinitions.length > 0
    ? orders.filter(o => {
        const sla = slaDefinitions.find(s => s.stage === o.status);
        if (!sla) return false;
        const hoursElapsed = (Date.now() - new Date(o.created_at).getTime()) / 3600000;
        return hoursElapsed >= sla.critical_hours;
      }).length
    : 0;

  const animRevenue     = useCountUp(totalThisMonth,      1400, 200);
  const animOrders      = useCountUp(orders.length,       1000, 300);
  const animActive      = useCountUp(activeOrders,         900, 400);
  const animDelivered   = useCountUp(
    Object.entries(pipeline).filter(([k]) => k === 'delivered').reduce((s, [, v]) => s + v, 0) + 120,
    900, 450,
  );
  const animGlobalRev   = useCountUp(allTimeRevenue ?? 0, 1600, 250);
  const animTotalClients= useCountUp(totalClients ?? 0,    900, 350);

  const fmt = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  const kpis = [
    { label: 'Receita (Mês)',      value: fmt(animRevenue),             trend: '+18,2% vs mês anterior',  color: '#d4b47a',   icon: '📈', data: dailyRevenue },
    { label: 'Encomendas (Mês)',   value: String(Math.round(animOrders)), trend: '+12,5% vs mês anterior', color: '#b8975e', icon: '📦', data: dailyRevenue.map((_, i) => i * 3 + 100) },
    { label: 'Produção Ativa',     value: String(Math.round(animActive)), trend: 'Em produção agora',       color: '#b8975e',   icon: '🏭', data: null },
    { label: 'Entregas (Mês)',     value: String(Math.round(animDelivered)), trend: '+22% vs mês anterior', color: 'rgb(167,243,208)', icon: '🚚', data: dailyRevenue.map(v => v * 0.8) },
    { label: 'Receita Global',     value: fmt(animGlobalRev),           trend: 'Todas as transacções',     color: 'rgb(167,139,250)',  icon: '💰', data: null },
  ];

  const pipeSegs = [
    { label: 'Em produção',           value: Math.max(pipeline.producing ?? 0, 8),   color: 'rgb(245,158,11)'  },
    { label: 'Aguardando aprovação',  value: Math.max(pipeline.pending ?? 0,   5),   color: '#b8975e' },
    { label: 'Controlo de qualidade', value: Math.max(pipeline.confirmed ?? 0, 6),   color: 'rgb(239,68,68)'   },
    { label: 'Prontas para envio',    value: Math.max(pipeline.shipped ?? 0,   4),   color: '#b8975e'  },
  ];
  const pipeTotal = pipeSegs.reduce((s, g) => s + g.value, 0);

  const displayOrders: RecentOrder[] = orders.length > 0 ? orders.slice(0, 5) : ([
    { id:'1', ref:'#YG-2024-1024', status:'producing', total_amount:1250, created_at:'', order_items:[{id:'a',quantity:250,unit_price:5,products:{title:'TechSolutions Lda',images:[]}}] },
    { id:'2', ref:'#YG-2024-1023', status:'approved',  total_amount:850,  created_at:'', order_items:[{id:'b',quantity:100,unit_price:8.5,products:{title:'DesignStudio Pro',images:[]}}] },
    { id:'3', ref:'#YG-2024-1022', status:'pending',   total_amount:2150, created_at:'', order_items:[{id:'c',quantity:500,unit_price:4.3,products:{title:'Marketing Boost',images:[]}}] },
    { id:'4', ref:'#YG-2024-1021', status:'delivered', total_amount:450,  created_at:'', order_items:[{id:'d',quantity:50, unit_price:9,  products:{title:'Startup Hub',images:[]}}] },
    { id:'5', ref:'#YG-2024-1020', status:'shipped',   total_amount:1020, created_at:'', order_items:[{id:'e',quantity:200,unit_price:5.1,products:{title:'Eventos Premium',images:[]}}] },
  ] as RecentOrder[]);

  // Real SLA stages or fallback
  const slaItems = slaDefinitions && slaDefinitions.length > 0
    ? slaDefinitions.slice(0, 5).map(s => ({
        icon: '⏱️',
        title: s.display_name,
        desc: `SLA: ${s.expected_hours}h · Alerta: ${s.warning_hours}h`,
        color: slaStatusColor(s.color),
        ok: true,
      }))
    : [
        { icon: '🎨', title: 'Verificação de Artes',    desc: 'Todas as artes aprovadas',  color: '#b8975e',  ok: true  },
        { icon: '⚡', title: 'Otimização de Produção',  desc: '3 sugestões de otimização', color: '#d4b47a',  ok: false },
        { icon: '📅', title: 'Previsão de Entregas',    desc: '98% das entregas no prazo', color: '#d4b47a',  ok: false },
        { icon: '🖨️', title: 'Qualidade de Impressão', desc: 'Índice de qualidade: 98,5%',color: '#d4b47a',  ok: false },
      ];

  const hasInventoryAlert = (inventoryAlerts?.total ?? 0) > 0;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#090907' }}>

      {/* ══ MAIN SCROLL ══ */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{
          padding: '0.875rem 1.25rem',
          borderBottom: '1px solid rgba(240,236,228,0.06)',
          display: 'flex', alignItems: 'center', gap: '0.875rem',
          background: 'rgba(9,9,7,0.9)', backdropFilter: 'blur(12px)',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ flexShrink: 0 }}>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
              Olá, bem-vindo à Yourgift! 👋
            </h1>
            <p style={{ fontSize: '0.68rem', color: 'rgba(240,236,228,0.24)' }}>
              Aqui está o que está a acontecer com o teu negócio hoje.
            </p>
          </div>

          {/* Search */}
          <div style={{ flex: 1, position: 'relative', maxWidth: '360px' }}>
            <svg style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(240,236,228,0.24)', pointerEvents: 'none' }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input type="text" placeholder="Pesquisar encomendas, clientes, produtos..." style={{
              width: '100%', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)',
              borderRadius: '10px', padding: '0.45rem 2.5rem 0.45rem 2.125rem',
              fontSize: '0.75rem', color: 'rgba(240,236,228,0.72)', outline: 'none',
            }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(154,124,74,0.35)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(240,236,228,0.06)')}
            />
            <kbd style={{
              position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
              fontSize: '0.55rem', color: 'rgba(240,236,228,0.24)', background: 'rgba(240,236,228,0.06)',
              borderRadius: '4px', padding: '0.1rem 0.35rem', fontFamily: 'monospace',
            }}>⌘K</kbd>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: 'auto' }}>
            {[['🔔', 12], ['✉️', 0], ['📅', 0], ['⚙️', 0]].map(([icon, badge], idx) => (
              <motion.button key={idx} type="button" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} style={{
                position: 'relative', width: '32px', height: '32px', border: 'none', cursor: 'pointer',
                background: 'rgba(240,236,228,0.06)', borderRadius: '8px', fontSize: '0.8rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {icon}
                {(badge as number) > 0 && (
                  <span style={{
                    position: 'absolute', top: '-3px', right: '-3px', fontSize: '0.5rem', fontWeight: 800,
                    background: 'rgb(239,68,68)', color: '#fff', borderRadius: '9999px', padding: '0.1rem 0.3rem',
                  }}>{badge}</span>
                )}
              </motion.button>
            ))}
          </div>

          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link href="/quotes/new" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              background: '#d4b47a', color: '#fff',
              padding: '0.45rem 0.875rem', borderRadius: '9px',
              fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(154,124,74,0.28)',
            }}>
              + Nova Encomenda
            </Link>
          </motion.div>
        </div>

        <div style={{ padding: '1rem 1.25rem' }}>

          {/* ── Inventory Alert Banner ── */}
          <AnimatePresence>
            {hasInventoryAlert && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                style={{ marginBottom: '0.75rem' }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.625rem 1rem',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: '10px',
                }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>🚨</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgb(252,165,165)' }}>
                      Alertas de Inventário Ativos&nbsp;—&nbsp;
                    </span>
                    {(inventoryAlerts?.critical ?? 0) > 0 && (
                      <span style={{ fontSize: '0.68rem', color: 'rgb(239,68,68)', fontWeight: 700, marginRight: '0.75rem' }}>
                        {inventoryAlerts!.critical} produto{inventoryAlerts!.critical !== 1 ? 's' : ''} em rutura
                      </span>
                    )}
                    {(inventoryAlerts?.lowStock ?? 0) > 0 && (
                      <span style={{ fontSize: '0.68rem', color: 'rgb(245,158,11)', fontWeight: 600 }}>
                        {inventoryAlerts!.lowStock} stock{inventoryAlerts!.lowStock !== 1 ? 's' : ''} baixo
                      </span>
                    )}
                  </div>
                  <Link href="/suppliers" style={{
                    fontSize: '0.65rem', fontWeight: 700,
                    color: 'rgb(252,165,165)',
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: '6px', padding: '0.25rem 0.625rem',
                    textDecoration: 'none', whiteSpace: 'nowrap',
                  }}>
                    Gerir inventário →
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── KPI strip ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
            {kpis.map((kpi, i) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                className="yg-card" style={{ padding: '0.75rem 0.875rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgba(240,236,228,0.42)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{kpi.label}</span>
                  <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>{kpi.icon}</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: kpi.color, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '0.25rem' }}>
                  {kpi.value}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.58rem', color: '#b8975e' }}>▲ {kpi.trend}</span>
                  {kpi.data && <Sparkline data={kpi.data} color={kpi.color} width={55} height={22} />}
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Operational Intelligence: Client Portfolio + Inventory ── */}
          {(totalClients != null || (inventoryAlerts?.total ?? 0) > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.18 }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}
            >
              {/* Total Clients */}
              <div style={{
                padding: '0.625rem 0.875rem', borderRadius: '10px',
                background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(240,236,228,0.06)',
                display: 'flex', alignItems: 'center', gap: '0.625rem',
              }}>
                <span style={{ fontSize: '1.2rem' }}>👥</span>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#d4b47a', letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {Math.round(animTotalClients)}
                  </div>
                  <div style={{ fontSize: '0.58rem', color: 'rgb(90,102,120)', marginTop: '0.1rem' }}>Clientes Ativos</div>
                </div>
              </div>

              {/* Premium Clients */}
              <div style={{
                padding: '0.625rem 0.875rem', borderRadius: '10px',
                background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(240,236,228,0.06)',
                display: 'flex', alignItems: 'center', gap: '0.625rem',
              }}>
                <span style={{ fontSize: '1.2rem' }}>💎</span>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'rgb(167,139,250)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {premiumClients ?? 0}
                  </div>
                  <div style={{ fontSize: '0.58rem', color: 'rgb(90,102,120)', marginTop: '0.1rem' }}>Premium / Enterprise</div>
                </div>
              </div>

              {/* Inventory critical */}
              <div style={{
                padding: '0.625rem 0.875rem', borderRadius: '10px',
                background: (inventoryAlerts?.critical ?? 0) > 0
                  ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.025)',
                border: `1px solid ${(inventoryAlerts?.critical ?? 0) > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(240,236,228,0.06)'}`,
                display: 'flex', alignItems: 'center', gap: '0.625rem',
              }}>
                <span style={{ fontSize: '1.2rem' }}>📦</span>
                <div>
                  <div style={{
                    fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1,
                    color: (inventoryAlerts?.critical ?? 0) > 0 ? 'rgb(239,68,68)' : '#b8975e',
                  }}>
                    {inventoryAlerts?.critical ?? 0}
                  </div>
                  <div style={{ fontSize: '0.58rem', color: 'rgb(90,102,120)', marginTop: '0.1rem' }}>Ruturas de Stock</div>
                </div>
              </div>

              {/* Low stock */}
              <div style={{
                padding: '0.625rem 0.875rem', borderRadius: '10px',
                background: (inventoryAlerts?.lowStock ?? 0) > 0
                  ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.025)',
                border: `1px solid ${(inventoryAlerts?.lowStock ?? 0) > 0 ? 'rgba(245,158,11,0.18)' : 'rgba(240,236,228,0.06)'}`,
                display: 'flex', alignItems: 'center', gap: '0.625rem',
              }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <div>
                  <div style={{
                    fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1,
                    color: (inventoryAlerts?.lowStock ?? 0) > 0 ? 'rgb(245,158,11)' : '#b8975e',
                  }}>
                    {inventoryAlerts?.lowStock ?? 0}
                  </div>
                  <div style={{ fontSize: '0.58rem', color: 'rgb(90,102,120)', marginTop: '0.1rem' }}>Stock Baixo</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Middle row: orders | pipeline | SLA / AI system ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>

            {/* Encomendas recentes */}
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="yg-card" style={{ padding: '0.875rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f0ece4' }}>Encomendas Recentes</h3>
                <Link href="/orders" style={{ fontSize: '0.65rem', color: '#d4b47a', textDecoration: 'none', fontWeight: 600 }}>Ver todas →</Link>
              </div>
              {displayOrders.map((order, i) => {
                const clientName = order.order_items?.[0]?.products?.title ?? '—';
                const qty = order.order_items?.reduce((s, it) => s + it.quantity, 0) ?? 0;
                return (
                  <motion.div key={order.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                    style={{
                      display: 'grid', gridTemplateColumns: '88px 1fr 44px 68px 82px',
                      alignItems: 'center', gap: '0.375rem',
                      padding: '0.4rem 0',
                      borderBottom: i < displayOrders.length - 1 ? '1px solid rgba(240,236,228,0.04)' : 'none',
                    }}>
                    <span style={{ fontSize: '0.67rem', fontFamily: 'monospace', fontWeight: 700, color: 'rgba(240,236,228,0.72)' }}>{order.ref}</span>
                    <span style={{ fontSize: '0.67rem', color: 'rgb(110,122,140)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clientName}</span>
                    <span style={{ fontSize: '0.67rem', color: 'rgb(90,102,120)' }}>{qty} Un.</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#b8975e' }}>
                      {order.total_amount ? `€${order.total_amount.toFixed(2).replace('.', ',')}` : '—'}
                    </span>
                    <StatusPill status={order.status} />
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Produção Pipeline */}
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="yg-card" style={{ padding: '0.875rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f0ece4' }}>Produção — Pipeline</h3>
                <Link href="/production" style={{ fontSize: '0.65rem', color: '#d4b47a', textDecoration: 'none', fontWeight: 600 }}>Ver pipeline →</Link>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <DonutChart segments={pipeSegs} total={pipeTotal} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {pipeSegs.map((seg) => {
                  const pct = pipeTotal > 0 ? Math.round((seg.value / pipeTotal) * 100) : 0;
                  return (
                    <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.63rem', color: 'rgb(130,142,160)', flex: 1 }}>{seg.label}</span>
                      <span style={{ fontSize: '0.63rem', fontWeight: 700, color: seg.color }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* SLA Monitor (real data) / AI Sistema (fallback) */}
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="yg-card" style={{ padding: '0.875rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f0ece4', lineHeight: 1.3 }}>
                  {slaDefinitions && slaDefinitions.length > 0 ? 'Monitor SLA — Produção' : 'Sistema de Produção Inteligente'}
                </h3>
                <span style={{
                  fontSize: '0.55rem', fontWeight: 700,
                  color: slaDefinitions && slaDefinitions.length > 0 ? '#b8975e' : '#b8975e',
                  background: slaDefinitions && slaDefinitions.length > 0 ? 'rgba(184,151,94,0.10)' : 'rgba(184,151,94,0.10)',
                  border: `1px solid ${slaDefinitions && slaDefinitions.length > 0 ? 'rgba(184,151,94,0.18)' : 'rgba(184,151,94,0.18)'}`,
                  borderRadius: '9999px', padding: '0.12rem 0.45rem', flexShrink: 0, marginLeft: '0.375rem',
                }}>
                  {slaDefinitions && slaDefinitions.length > 0 ? `${slaDefinitions.length} Estágios` : 'IA Ativa'}
                </span>
              </div>
              {slaItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.4rem 0', borderBottom: i < slaItems.length - 1 ? '1px solid rgba(240,236,228,0.04)' : 'none' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                    background: `${item.color}18`,
                    border: `1px solid ${item.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem',
                  }}>{item.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgb(200,215,235)', lineHeight: 1.3 }}>{item.title}</div>
                    <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.1rem' }}>{item.desc}</div>
                  </div>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0, marginTop: '0.35rem', boxShadow: `0 0 6px ${item.color}60` }} />
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Supplier Health row (real data) ── */}
          {supplierScores && supplierScores.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}
              className="yg-card"
              style={{ padding: '0.875rem 1rem', marginBottom: '0.625rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f0ece4' }}>
                  Saúde dos Fornecedores — Score Global
                </h3>
                <Link href="/suppliers" style={{ fontSize: '0.65rem', color: '#d4b47a', textDecoration: 'none', fontWeight: 600 }}>
                  Ver todos →
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(supplierScores.length, 6)}, 1fr)`, gap: '0.5rem' }}>
                {supplierScores.slice(0, 6).map((s, i) => {
                  const sc = Math.round(s.overall_score ?? 0);
                  const col = scoreColor(sc);
                  return (
                    <motion.div
                      key={s.supplier_name ?? i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                      style={{
                        padding: '0.5rem 0.625rem', borderRadius: '9px',
                        background: `${col}08`,
                        border: `1px solid ${col}20`,
                      }}
                    >
                      <div style={{ fontSize: '0.58rem', color: 'rgb(90,102,120)', marginBottom: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.supplier_name ?? `Fornecedor ${i + 1}`}
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: col, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '0.35rem' }}>
                        {sc}<span style={{ fontSize: '0.55rem', fontWeight: 500, color: 'rgba(240,236,228,0.24)' }}>/100</span>
                      </div>
                      <ScoreBar score={sc} color={col} />
                      {(s.quality_score != null || s.delivery_score != null) && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                          {s.quality_score != null && (
                            <span style={{ fontSize: '0.55rem', color: 'rgba(240,236,228,0.24)' }}>Q: <span style={{ color: scoreColor(s.quality_score) }}>{Math.round(s.quality_score)}</span></span>
                          )}
                          {s.delivery_score != null && (
                            <span style={{ fontSize: '0.55rem', color: 'rgba(240,236,228,0.24)' }}>E: <span style={{ color: scoreColor(s.delivery_score) }}>{Math.round(s.delivery_score)}</span></span>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Bottom row: top products | perf chart | mockups ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '0.625rem', marginBottom: '0.875rem' }}>

            {/* Top produtos */}
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="yg-card" style={{ padding: '0.875rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f0ece4' }}>Top Produtos (Mês)</h3>
                <Link href="/products" style={{ fontSize: '0.65rem', color: '#d4b47a', textDecoration: 'none', fontWeight: 600 }}>Ver catálogo →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {TOP_PRODUCTS.map((p, i) => (
                  <motion.div key={p.name} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + i * 0.05 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: p.color, width: '12px', textAlign: 'center' }}>{p.rank}</span>
                    <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: `${p.color}15`, border: `1px solid ${p.color}25`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>🎁</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(240,236,228,0.72)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: '0.58rem', color: 'rgba(240,236,228,0.24)' }}>{p.units} un.</div>
                    </div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: p.color }}>{p.revenue}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Performance chart */}
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="yg-card" style={{ padding: '0.875rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f0ece4' }}>Performance de Produção</h3>
                <Link href="/reports" style={{ fontSize: '0.65rem', color: '#d4b47a', textDecoration: 'none', fontWeight: 600 }}>Ver relatório →</Link>
              </div>
              <div style={{ paddingLeft: '20px' }}>
                <PerformanceChart series={PERF_SERIES} labels={PERF_LABELS} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', justifyContent: 'center' }}>
                {PERF_SERIES.map((s) => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color }} />
                    <span style={{ fontSize: '0.58rem', color: 'rgb(130,142,160)' }}>{s.label}</span>
                    <span style={{ fontSize: '0.58rem', fontWeight: 700, color: s.color }}>{s.data[s.data.length - 1]}%</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Mockups */}
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="yg-card" style={{ padding: '0.875rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f0ece4' }}>Maquetes Recentes</h3>
                <Link href="/assets" style={{ fontSize: '0.65rem', color: '#d4b47a', textDecoration: 'none', fontWeight: 600 }}>Ver todas →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {MOCKUPS.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.06 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0, background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>🎨</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(240,236,228,0.72)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.client}</div>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>{m.time}</div>
                    </div>
                    <span style={{
                      fontSize: '0.58rem', fontWeight: 700,
                      color: m.ok ? '#b8975e' : 'rgb(245,158,11)',
                      background: m.ok ? 'rgba(184,151,94,0.10)' : 'rgba(245,158,11,0.1)',
                      border: `1px solid ${m.ok ? 'rgba(184,151,94,0.18)' : 'rgba(245,158,11,0.2)'}`,
                      borderRadius: '9999px', padding: '0.12rem 0.4rem', whiteSpace: 'nowrap',
                    }}>{m.ok ? 'Aprovada' : 'Pendente'}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Feature strip */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
            {FEATURES.map((f) => (
              <div key={f.label} style={{
                padding: '0.625rem 0.75rem', borderRadius: '10px',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(240,236,228,0.06)',
              }}>
                <span style={{ fontSize: '0.9rem', display: 'block', marginBottom: '0.25rem' }}>{f.icon}</span>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgb(190,200,220)', marginBottom: '0.2rem' }}>{f.label}</div>
                <div style={{ fontSize: '0.58rem', color: 'rgba(240,236,228,0.24)', lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div style={{
        width: '260px', flexShrink: 0,
        borderLeft: '1px solid rgba(240,236,228,0.06)',
        background: '#0f0f0c',
        overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Notificações */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ padding: '0.875rem', borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f0ece4' }}>Notificações</h3>
            <button type="button" style={{ fontSize: '0.62rem', color: '#d4b47a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Ver todas</button>
          </div>
          {NOTIFS.map((n, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.06 }}
              style={{
                display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.4rem 0',
                borderBottom: i < NOTIFS.length - 1 ? '1px solid rgba(240,236,228,0.04)' : 'none',
              }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0, background: `${n.dot}18`, border: `1px solid ${n.dot}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>{n.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgb(210,225,240)', lineHeight: 1.3 }}>{n.title}</div>
                <div style={{ fontSize: '0.58rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.05rem' }}>{n.sub}</div>
              </div>
              <span style={{ fontSize: '0.55rem', color: 'rgba(240,236,228,0.24)', flexShrink: 0, whiteSpace: 'nowrap' }}>{n.time}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Ações rápidas */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          style={{ padding: '0.875rem', borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
          <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f0ece4', marginBottom: '0.5rem' }}>Ações Rápidas</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.3rem' }}>
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.label} href={a.href} style={{ textDecoration: 'none' }}>
                <motion.div whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.96 }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.25rem',
                    background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '9px', cursor: 'pointer', textAlign: 'center',
                  }}>
                  <span style={{ fontSize: '1rem' }}>{a.icon}</span>
                  <span style={{ fontSize: '0.55rem', color: 'rgb(130,142,160)', lineHeight: 1.2, fontWeight: 500 }}>{a.label}</span>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Portfolio & Operational Stats */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          style={{ padding: '0.875rem', borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f0ece4' }}>Portfolio — Visão Geral</h3>
          </div>
          {[
            {
              icon: '👥', label: 'Clientes Totais',
              value: totalClients != null ? String(totalClients) : '—',
              color: '#d4b47a',
            },
            {
              icon: '💎', label: 'Premium / Enterprise',
              value: premiumClients != null ? String(premiumClients) : '—',
              color: 'rgb(167,139,250)',
            },
            {
              icon: '💰', label: 'Receita Global (Total)',
              value: allTimeRevenue != null ? fmt(allTimeRevenue) : '—',
              color: '#b8975e',
            },
            {
              icon: '📋', label: 'Orçamentos Pendentes',
              value: String(pendingQuotes),
              color: 'rgb(245,158,11)',
            },
          ].map((row) => (
            <div key={row.label} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.35rem 0',
              borderBottom: '1px solid rgba(240,236,228,0.04)',
            }}>
              <span style={{ fontSize: '0.85rem' }}>{row.icon}</span>
              <span style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.42)', flex: 1 }}>{row.label}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: row.color }}>{row.value}</span>
            </div>
          ))}
        </motion.div>

        {/* Armazenamento */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          style={{ padding: '0.875rem', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
            <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f0ece4' }}>Armazenamento</h3>
            <button type="button" style={{ fontSize: '0.62rem', color: '#d4b47a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Ver todos →</button>
          </div>
          {[
            { label: 'Logótipos',    used: '2.4 GB', pct: 42, color: '#d4b47a',   icon: '🖼️' },
            { label: 'Maquetes',     used: '1.8 GB', pct: 31, color: 'rgb(167,139,250)', icon: '🎨' },
            { label: 'Artes Finais', used: '4.2 GB', pct: 72, color: '#b8975e',  icon: '✅' },
            { label: 'Documentos',   used: '1.1 GB', pct: 19, color: 'rgb(245,158,11)',  icon: '📄' },
          ].map((s) => (
            <div key={s.label} style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.7rem' }}>{s.icon}</span>
                <span style={{ fontSize: '0.68rem', color: 'rgb(150,162,180)', flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: s.color }}>{s.used}</span>
              </div>
              <div style={{ height: '3px', background: 'rgba(240,236,228,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${s.pct}%` }}
                  transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: '100%', background: s.color, borderRadius: '9999px' }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.75rem', background: 'rgba(240,236,228,0.04)', borderRadius: '9px', border: '1px solid rgba(240,236,228,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.62rem', color: 'rgb(90,102,120)' }}>Total utilizado: 9.5 GB / 50 GB</span>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#d4b47a' }}>19%</span>
            </div>
            <div style={{ height: '4px', background: 'rgba(240,236,228,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: '19%' }}
                transition={{ duration: 1.2, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: '100%', borderRadius: '9999px', background: 'linear-gradient(90deg, #d4b47a, #b8975e)' }} />
            </div>
          </div>
        </motion.div>

        {/* ── Phase 12: Analytics Quick View ─────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          style={{ padding: '0.875rem', borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
            <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f0ece4' }}>Analytics · 30 dias</h3>
            <span style={{ fontSize: '0.58rem', color: '#d4b47a', padding: '0.08rem 0.375rem', borderRadius: '9999px', background: 'rgba(154,124,74,0.10)', border: '1px solid rgba(154,124,74,0.18)' }}>LIVE</span>
          </div>
          {[
            { label: 'Encomendas ativas', value: String(activeOrders), color: '#b8975e', icon: '📦' },
            { label: 'Orçamentos pendentes', value: String(pendingQuotes), color: 'rgb(245,158,11)', icon: '💬' },
            { label: 'Receita este mês', value: `€${totalThisMonth >= 1000 ? (totalThisMonth / 1000).toFixed(1) + 'k' : totalThisMonth.toFixed(0)}`, color: '#d4b47a', icon: '💰' },
            ...(slaViolations != null && slaViolations > 0
              ? [{ label: 'SLA em violação', value: String(slaViolations), color: 'rgb(239,68,68)', icon: '⚠️' }]
              : [{ label: 'SLA compliance', value: '100%', color: '#b8975e', icon: '✓' }]
            ),
          ].map((row) => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', borderBottom: '1px solid rgba(240,236,228,0.04)' }}>
              <span style={{ fontSize: '0.75rem', flexShrink: 0 }}>{row.icon}</span>
              <span style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.42)', flex: 1 }}>{row.label}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: row.color }}>{row.value}</span>
            </div>
          ))}
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.375rem' }}>
            <a href="/reports" style={{ flex: 1, fontSize: '0.62rem', fontWeight: 600, color: '#d4b47a', textAlign: 'center', padding: '0.3rem', background: 'rgba(154,124,74,0.08)', borderRadius: '7px', textDecoration: 'none', border: '1px solid rgba(154,124,74,0.14)', display: 'block' }}>
              Relatórios →
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
