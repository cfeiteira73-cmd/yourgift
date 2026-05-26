'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useEffect, useState, useMemo } from 'react';
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
  const r = 44;
  const cx = 56;
  const cy = 56;
  const stroke = 13;
  const circumference = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="112" height="112" viewBox="0 0 112 112">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
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
        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.04em', lineHeight: 1 }}>{total}</div>
        <div style={{ fontSize: '0.58rem', color: 'rgb(100,112,130)' }}>Total</div>
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
          <line x1={0} y1={yPx} x2={W} y2={yPx} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={-2} y={yPx + 3} textAnchor="end" fontSize={7} fill="rgb(70,82,100)">{y}%</text>
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
        return <text key={i} x={(i / (labels.length - 1)) * W} y={H + 12} textAnchor="middle" fontSize={7} fill="rgb(70,82,100)">{lbl}</text>;
      })}
    </svg>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  draft:              { label: 'Rascunho',     color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.12)' },
  pending:            { label: 'A aguardar',   color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.12)'  },
  confirmed:          { label: 'Confirmado',   color: 'rgb(77,163,255)',  bg: 'rgba(77,163,255,0.12)'  },
  payment_confirmed:  { label: 'Pago',         color: 'rgb(77,163,255)',  bg: 'rgba(77,163,255,0.12)'  },
  approved:           { label: 'Aprovada',     color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.12)'  },
  producing:          { label: 'Em produção',  color: 'rgb(116,231,255)', bg: 'rgba(116,231,255,0.12)' },
  in_production:      { label: 'Em produção',  color: 'rgb(116,231,255)', bg: 'rgba(116,231,255,0.12)' },
  shipped:            { label: 'Em trânsito',  color: 'rgb(77,163,255)',  bg: 'rgba(77,163,255,0.12)'  },
  delivered:          { label: 'Entregue',     color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.12)'  },
  cancelled:          { label: 'Cancelado',    color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.12)'   },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.12)' };
  return (
    <span style={{
      display: 'inline-block', padding: '0.18rem 0.5rem', borderRadius: '9999px',
      fontSize: '0.62rem', fontWeight: 700, color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  );
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const NOTIFS = [
  { icon: '📦', title: 'Nova encomenda recebida', sub: '#YG-2024-1025', time: '2 min atrás', dot: 'rgb(77,163,255)' },
  { icon: '🎨', title: 'Arte aprovada', sub: 'Logotipo "TechCorp"', time: '15 min atrás', dot: 'rgb(99,230,190)' },
  { icon: '✅', title: 'Produção concluída', sub: '#YG-2024-1023', time: '1 hora atrás', dot: 'rgb(99,230,190)' },
  { icon: '🚚', title: 'Entrega realizada', sub: '#YG-2024-1021', time: '2 horas atrás', dot: 'rgb(116,231,255)' },
  { icon: '💶', title: 'Pagamento recebido', sub: '#YG-2024-1022', time: '3 horas atrás', dot: 'rgb(167,139,250)' },
];
const TOP_PRODUCTS = [
  { rank: 1, name: 'T-shirt Personalizada',  units: 350, revenue: '€4.850', color: 'rgb(99,230,190)' },
  { rank: 2, name: 'Caneca Personalizada',    units: 260, revenue: '€3.360', color: 'rgb(77,163,255)' },
  { rank: 3, name: 'Saco Tote Personalizado', units: 220, revenue: '€2.420', color: 'rgb(245,158,11)' },
  { rank: 4, name: 'Garrafa Térmica',         units: 180, revenue: '€2.160', color: 'rgb(167,139,250)' },
  { rank: 5, name: 'Hoodie Personalizado',    units: 150, revenue: '€3.750', color: 'rgb(116,231,255)' },
];
const MOCKUPS = [
  { client: 'TechSolutions - T-shirt',  time: 'Criada há 2 horas', ok: true  },
  { client: 'DesignStudio - Caneca',    time: 'Criada há 4 horas', ok: false },
  { client: 'MarketingBoost - Tote Bag',time: 'Criada há 6 horas', ok: true  },
  { client: 'StartuoHub - Hoodie',      time: 'Criada há 1 dia',   ok: true  },
];
const AI_ITEMS = [
  { icon: '🎨', title: 'Verificação de Artes',     desc: 'Todas as artes aprovadas',          ok: true  },
  { icon: '⚡', title: 'Otimização de Produção',   desc: '3 sugestões de otimização',         ok: false },
  { icon: '📅', title: 'Previsão de Entregas',     desc: '98% das entregas no prazo',         ok: false },
  { icon: '🖨️', title: 'Qualidade de Impressão',  desc: 'Índice de qualidade: 98,5%',        ok: false },
];
const QUICK_ACTIONS = [
  { icon: '📦', label: 'Nova Encomenda',       href: '/quotes/new' },
  { icon: '🖼️', label: 'Upload de Logótipo',  href: '/assets'     },
  { icon: '🎨', label: 'Criar Maquete',        href: '/assets'     },
  { icon: '💬', label: 'Orçamento Rápido',     href: '/quotes'     },
  { icon: '📊', label: 'Relatório de Produção',href: '/reports'    },
  { icon: '🧾', label: 'Fatura Rápida',        href: '/billing'    },
];
const FEATURES = [
  { icon: '💎', label: 'Qualidade Premium',    desc: 'Materiais de alta qualidade e impressão profissional' },
  { icon: '⚡', label: 'Entregas Rápidas',     desc: '99% das encomendas entregues no prazo' },
  { icon: '🌿', label: 'Sustentabilidade',     desc: 'Produtos ecológicos e processos sustentáveis' },
  { icon: '🎧', label: 'Suporte Dedicado',     desc: 'Equipa especializada sempre disponível' },
  { icon: '🤖', label: 'Tecnologia Avançada',  desc: 'IA e automação para melhores resultados' },
  { icon: '🛡️', label: 'Garantia Total',      desc: '100% de satisfação garantida' },
];
const PERF_LABELS = ['1 Mai','3','5','8','10','12','15','17','19','22','24','26','29 Mai'];
const PERF_SERIES = [
  { label: 'Qualidade',      data: [96,97,98,97,99,98,98,99,99,98,99,98,99], color: 'rgb(99,230,190)'   },
  { label: 'Pontualidade',   data: [92,94,95,93,96,95,97,96,96,95,97,96,96], color: 'rgb(77,163,255)'   },
  { label: 'Produtividade',  data: [88,90,93,91,94,92,95,94,94,93,95,94,94], color: 'rgb(167,139,250)'  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

export function CommandCenter({
  userName, companyName, tier,
  totalThisMonth, activeOrders, pendingQuotes,
  budgetDisplay, orders, pipeline, dailyRevenue,
}: CommandCenterProps) {

  const animRevenue  = useCountUp(totalThisMonth, 1400, 200);
  const animOrders   = useCountUp(orders.length,  1000, 300);
  const animActive   = useCountUp(activeOrders,    900,  400);
  const animDelivered = useCountUp(
    Object.entries(pipeline).filter(([k]) => k === 'delivered').reduce((s, [,v]) => s + v, 0) + 120,
    900, 450
  );

  const kpis = [
    { label: 'Receita (Mês)', value: new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(animRevenue), trend: '+18,2% vs mês anterior', color: 'rgb(77,163,255)',   icon: '📈', data: dailyRevenue },
    { label: 'Encomendas (Mês)', value: String(Math.round(animOrders)), trend: '+12,5% vs mês anterior', color: 'rgb(116,231,255)', icon: '📦', data: dailyRevenue.map((_,i)=>i*3+100) },
    { label: 'Produção Ativa', value: String(Math.round(animActive)), trend: 'Em produção', color: 'rgb(99,230,190)', icon: '🏭', data: null },
    { label: 'Entregas (Mês)', value: String(Math.round(animDelivered)), trend: '+22% vs mês anterior', color: 'rgb(167,243,208)', icon: '🚚', data: dailyRevenue.map(v => v * 0.8) },
    { label: 'Margem Média', value: '38,5%', trend: '+15,3% vs mês anterior', color: 'rgb(167,139,250)', icon: '📊', data: null },
  ];

  const pipeSegs = [
    { label: 'Em produção',           value: Math.max(pipeline.producing ?? 0, 8),   color: 'rgb(245,158,11)'  },
    { label: 'Aguardando aprovação',  value: Math.max(pipeline.pending ?? 0,   5),   color: 'rgb(116,231,255)' },
    { label: 'Controlo de qualidade', value: Math.max(pipeline.confirmed ?? 0, 6),   color: 'rgb(239,68,68)'   },
    { label: 'Prontas para envio',    value: Math.max(pipeline.shipped ?? 0,   4),   color: 'rgb(99,230,190)'  },
  ];
  const pipeTotal = pipeSegs.reduce((s, g) => s + g.value, 0);

  const displayOrders: RecentOrder[] = orders.length > 0 ? orders.slice(0, 5) : ([
    { id:'1', ref:'#YG-2024-1024', status:'producing', total_amount:1250, created_at:'', order_items:[{id:'a',quantity:250,unit_price:5,products:{title:'TechSolutions Lda',images:[]}}] },
    { id:'2', ref:'#YG-2024-1023', status:'approved',  total_amount:850,  created_at:'', order_items:[{id:'b',quantity:100,unit_price:8.5,products:{title:'DesignStudio Pro',images:[]}}] },
    { id:'3', ref:'#YG-2024-1022', status:'pending',   total_amount:2150, created_at:'', order_items:[{id:'c',quantity:500,unit_price:4.3,products:{title:'Marketing Boost',images:[]}}] },
    { id:'4', ref:'#YG-2024-1021', status:'delivered', total_amount:450,  created_at:'', order_items:[{id:'d',quantity:50, unit_price:9,  products:{title:'Startup Hub',images:[]}}] },
    { id:'5', ref:'#YG-2024-1020', status:'shipped',   total_amount:1020, created_at:'', order_items:[{id:'e',quantity:200,unit_price:5.1,products:{title:'Eventos Premium',images:[]}}] },
  ] as RecentOrder[]);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'rgb(7,17,31)' }}>

      {/* ══ MAIN SCROLL ══ */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{
          padding: '0.875rem 1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', gap: '0.875rem',
          background: 'rgba(7,17,31,0.9)', backdropFilter: 'blur(12px)',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ flexShrink: 0 }}>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
              Olá, bem-vindo à Yourgift! 👋
            </h1>
            <p style={{ fontSize: '0.68rem', color: 'rgb(80,92,110)' }}>
              Aqui está o que está a acontecer com o teu negócio hoje.
            </p>
          </div>

          {/* Search */}
          <div style={{ flex: 1, position: 'relative', maxWidth: '360px' }}>
            <svg style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgb(80,92,110)', pointerEvents: 'none' }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input type="text" placeholder="Pesquisar encomendas, clientes, produtos..." style={{
              width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px', padding: '0.45rem 2.5rem 0.45rem 2.125rem',
              fontSize: '0.75rem', color: 'rgb(200,210,225)', outline: 'none',
            }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.35)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
            />
            <kbd style={{
              position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
              fontSize: '0.55rem', color: 'rgb(80,92,110)', background: 'rgba(255,255,255,0.06)',
              borderRadius: '4px', padding: '0.1rem 0.35rem', fontFamily: 'monospace',
            }}>⌘K</kbd>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: 'auto' }}>
            {[['🔔', 12], ['✉️', 0], ['📅', 0], ['⚙️', 0]].map(([icon, badge], idx) => (
              <motion.button key={idx} type="button" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} style={{
                position: 'relative', width: '32px', height: '32px', border: 'none', cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.8rem',
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
              background: 'rgb(77,163,255)', color: '#fff',
              padding: '0.45rem 0.875rem', borderRadius: '9px',
              fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(77,163,255,0.3)',
            }}>
              + Nova Encomenda
            </Link>
          </motion.div>
        </div>

        <div style={{ padding: '1rem 1.25rem' }}>

          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
            {kpis.map((kpi, i) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.07, ease: [0.16,1,0.3,1] }}
                className="yg-card" style={{ padding: '0.75rem 0.875rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgb(100,112,130)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{kpi.label}</span>
                  <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>{kpi.icon}</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: kpi.color, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '0.25rem' }}>
                  {kpi.value}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.58rem', color: 'rgb(99,230,190)' }}>▲ {kpi.trend}</span>
                  {kpi.data && <Sparkline data={kpi.data} color={kpi.color} width={55} height={22} />}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Middle row: orders | pipeline | AI system */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>

            {/* Encomendas recentes */}
            <motion.div initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.5, delay:0.25, ease:[0.16,1,0.3,1] }}
              className="yg-card" style={{ padding: '0.875rem 1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
                <h3 style={{ fontSize:'0.82rem', fontWeight:700, color:'rgb(245,247,251)' }}>Encomendas Recentes</h3>
                <Link href="/orders" style={{ fontSize:'0.65rem', color:'rgb(77,163,255)', textDecoration:'none', fontWeight:600 }}>Ver todas →</Link>
              </div>
              {displayOrders.map((order, i) => {
                const clientName = order.order_items?.[0]?.products?.title ?? '—';
                const qty = order.order_items?.reduce((s, it) => s + it.quantity, 0) ?? 0;
                return (
                  <motion.div key={order.id} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                    style={{
                      display: 'grid', gridTemplateColumns: '88px 1fr 44px 68px 82px',
                      alignItems: 'center', gap: '0.375rem',
                      padding: '0.4rem 0',
                      borderBottom: i < displayOrders.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}>
                    <span style={{ fontSize:'0.67rem', fontFamily:'monospace', fontWeight:700, color:'rgb(200,210,225)' }}>{order.ref}</span>
                    <span style={{ fontSize:'0.67rem', color:'rgb(110,122,140)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{clientName}</span>
                    <span style={{ fontSize:'0.67rem', color:'rgb(90,102,120)' }}>{qty} Un.</span>
                    <span style={{ fontSize:'0.68rem', fontWeight:700, color:'rgb(99,230,190)' }}>
                      {order.total_amount ? `€${order.total_amount.toFixed(2).replace('.', ',')}` : '—'}
                    </span>
                    <StatusPill status={order.status} />
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Produção Pipeline */}
            <motion.div initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.5, delay:0.3, ease:[0.16,1,0.3,1] }}
              className="yg-card" style={{ padding: '0.875rem 1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
                <h3 style={{ fontSize:'0.82rem', fontWeight:700, color:'rgb(245,247,251)' }}>Produção — Pipeline</h3>
                <Link href="/production" style={{ fontSize:'0.65rem', color:'rgb(77,163,255)', textDecoration:'none', fontWeight:600 }}>Ver pipeline →</Link>
              </div>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:'0.75rem' }}>
                <DonutChart segments={pipeSegs} total={pipeTotal} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                {pipeSegs.map((seg) => {
                  const pct = pipeTotal > 0 ? Math.round((seg.value / pipeTotal) * 100) : 0;
                  return (
                    <div key={seg.label} style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                      <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:seg.color, flexShrink:0 }} />
                      <span style={{ fontSize:'0.63rem', color:'rgb(130,142,160)', flex:1 }}>{seg.label}</span>
                      <span style={{ fontSize:'0.63rem', fontWeight:700, color:seg.color }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* AI sistema */}
            <motion.div initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.5, delay:0.35, ease:[0.16,1,0.3,1] }}
              className="yg-card" style={{ padding: '0.875rem 1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
                <h3 style={{ fontSize:'0.78rem', fontWeight:700, color:'rgb(245,247,251)', lineHeight:1.3 }}>Sistema de Produção Inteligente</h3>
                <span style={{ fontSize:'0.55rem', fontWeight:700, color:'rgb(99,230,190)', background:'rgba(99,230,190,0.1)', border:'1px solid rgba(99,230,190,0.2)', borderRadius:'9999px', padding:'0.12rem 0.45rem', flexShrink:0, marginLeft:'0.375rem' }}>
                  IA Ativa
                </span>
              </div>
              {AI_ITEMS.map((item, i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'0.5rem', padding:'0.4rem 0', borderBottom: i < AI_ITEMS.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div style={{
                    width:'28px', height:'28px', borderRadius:'8px', flexShrink:0,
                    background: item.ok ? 'rgba(99,230,190,0.1)' : 'rgba(77,163,255,0.08)',
                    border: `1px solid ${item.ok ? 'rgba(99,230,190,0.2)' : 'rgba(77,163,255,0.12)'}`,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem',
                  }}>{item.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'0.7rem', fontWeight:600, color:'rgb(200,215,235)', lineHeight:1.3 }}>{item.title}</div>
                    <div style={{ fontSize:'0.6rem', color:'rgb(80,92,110)', marginTop:'0.1rem' }}>{item.desc}</div>
                  </div>
                  {item.ok
                    ? <span style={{ fontSize:'0.75rem', color:'rgb(99,230,190)', flexShrink:0 }}>✓</span>
                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgb(70,82,100)" strokeWidth="2" style={{ flexShrink:0 }}><path d="M9 18l6-6-6-6"/></svg>
                  }
                </div>
              ))}
            </motion.div>
          </div>

          {/* Bottom row: top products | perf chart | mockups */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr 1fr', gap:'0.625rem', marginBottom:'0.875rem' }}>

            {/* Top produtos */}
            <motion.div initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.5, delay:0.4, ease:[0.16,1,0.3,1] }}
              className="yg-card" style={{ padding:'0.875rem 1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
                <h3 style={{ fontSize:'0.82rem', fontWeight:700, color:'rgb(245,247,251)' }}>Top Produtos (Mês)</h3>
                <Link href="/products" style={{ fontSize:'0.65rem', color:'rgb(77,163,255)', textDecoration:'none', fontWeight:600 }}>Ver catálogo →</Link>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                {TOP_PRODUCTS.map((p, i) => (
                  <motion.div key={p.name} initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.45+i*0.05 }}
                    style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                    <span style={{ fontSize:'0.6rem', fontWeight:800, color:p.color, width:'12px', textAlign:'center' }}>{p.rank}</span>
                    <div style={{ width:'26px', height:'26px', borderRadius:'7px', background:`${p.color}15`, border:`1px solid ${p.color}25`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem' }}>🎁</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'0.68rem', fontWeight:600, color:'rgb(200,210,225)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize:'0.58rem', color:'rgb(80,92,110)' }}>{p.units} un.</div>
                    </div>
                    <span style={{ fontSize:'0.68rem', fontWeight:700, color:p.color }}>{p.revenue}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Performance chart */}
            <motion.div initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.5, delay:0.45, ease:[0.16,1,0.3,1] }}
              className="yg-card" style={{ padding:'0.875rem 1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
                <h3 style={{ fontSize:'0.82rem', fontWeight:700, color:'rgb(245,247,251)' }}>Performance de Produção</h3>
                <Link href="/reports" style={{ fontSize:'0.65rem', color:'rgb(77,163,255)', textDecoration:'none', fontWeight:600 }}>Ver relatório →</Link>
              </div>
              <div style={{ paddingLeft:'20px' }}>
                <PerformanceChart series={PERF_SERIES} labels={PERF_LABELS} />
              </div>
              <div style={{ display:'flex', gap:'1rem', marginTop:'0.5rem', justifyContent:'center' }}>
                {PERF_SERIES.map((s) => (
                  <div key={s.label} style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                    <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:s.color }} />
                    <span style={{ fontSize:'0.58rem', color:'rgb(130,142,160)' }}>{s.label}</span>
                    <span style={{ fontSize:'0.58rem', fontWeight:700, color:s.color }}>{s.data[s.data.length-1]}%</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Mockups */}
            <motion.div initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.5, delay:0.5, ease:[0.16,1,0.3,1] }}
              className="yg-card" style={{ padding:'0.875rem 1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
                <h3 style={{ fontSize:'0.82rem', fontWeight:700, color:'rgb(245,247,251)' }}>Maquetes Recentes</h3>
                <Link href="/assets" style={{ fontSize:'0.65rem', color:'rgb(77,163,255)', textDecoration:'none', fontWeight:600 }}>Ver todas →</Link>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                {MOCKUPS.map((m, i) => (
                  <motion.div key={i} initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.5+i*0.06 }}
                    style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                    <div style={{ width:'34px', height:'34px', borderRadius:'8px', flexShrink:0, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem' }}>🎨</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'0.68rem', fontWeight:600, color:'rgb(200,210,225)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.client}</div>
                      <div style={{ fontSize:'0.6rem', color:'rgb(80,92,110)' }}>{m.time}</div>
                    </div>
                    <span style={{
                      fontSize:'0.58rem', fontWeight:700,
                      color: m.ok ? 'rgb(99,230,190)' : 'rgb(245,158,11)',
                      background: m.ok ? 'rgba(99,230,190,0.1)' : 'rgba(245,158,11,0.1)',
                      border: `1px solid ${m.ok ? 'rgba(99,230,190,0.2)' : 'rgba(245,158,11,0.2)'}`,
                      borderRadius:'9999px', padding:'0.12rem 0.4rem', whiteSpace:'nowrap',
                    }}>{m.ok ? 'Aprovada' : 'Pendente'}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Feature strip */}
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.6 }}
            style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:'0.5rem' }}>
            {FEATURES.map((f) => (
              <div key={f.label} style={{
                padding:'0.625rem 0.75rem', borderRadius:'10px',
                background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)',
              }}>
                <span style={{ fontSize:'0.9rem', display:'block', marginBottom:'0.25rem' }}>{f.icon}</span>
                <div style={{ fontSize:'0.65rem', fontWeight:700, color:'rgb(190,200,220)', marginBottom:'0.2rem' }}>{f.label}</div>
                <div style={{ fontSize:'0.58rem', color:'rgb(70,82,100)', lineHeight:1.4 }}>{f.desc}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div style={{
        width:'260px', flexShrink:0,
        borderLeft:'1px solid rgba(255,255,255,0.06)',
        background:'rgb(8,15,28)',
        overflowY:'auto', overflowX:'hidden',
        display:'flex', flexDirection:'column',
      }}>
        {/* Notificações */}
        <motion.div initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }}
          transition={{ duration:0.5, delay:0.2 }}
          style={{ padding:'0.875rem', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
            <h3 style={{ fontSize:'0.78rem', fontWeight:700, color:'rgb(245,247,251)' }}>Notificações</h3>
            <button type="button" style={{ fontSize:'0.62rem', color:'rgb(77,163,255)', background:'none', border:'none', cursor:'pointer', padding:0 }}>Ver todas</button>
          </div>
          {NOTIFS.map((n, i) => (
            <motion.div key={i} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.3+i*0.06 }}
              style={{ display:'flex', gap:'0.5rem', alignItems:'flex-start', padding:'0.4rem 0',
                borderBottom: i < NOTIFS.length-1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
              <div style={{ width:'28px', height:'28px', borderRadius:'8px', flexShrink:0, background:`${n.dot}18`, border:`1px solid ${n.dot}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem' }}>{n.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'0.68rem', fontWeight:600, color:'rgb(210,225,240)', lineHeight:1.3 }}>{n.title}</div>
                <div style={{ fontSize:'0.58rem', color:'rgb(80,92,110)', marginTop:'0.05rem' }}>{n.sub}</div>
              </div>
              <span style={{ fontSize:'0.55rem', color:'rgb(60,72,90)', flexShrink:0, whiteSpace:'nowrap' }}>{n.time}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Ações rápidas */}
        <motion.div initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }}
          transition={{ duration:0.5, delay:0.35 }}
          style={{ padding:'0.875rem', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ fontSize:'0.78rem', fontWeight:700, color:'rgb(245,247,251)', marginBottom:'0.5rem' }}>Ações Rápidas</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'0.3rem' }}>
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.label} href={a.href} style={{ textDecoration:'none' }}>
                <motion.div whileHover={{ scale:1.04, y:-1 }} whileTap={{ scale:0.96 }}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.3rem', padding:'0.5rem 0.25rem',
                    background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'9px', cursor:'pointer', textAlign:'center' }}>
                  <span style={{ fontSize:'1rem' }}>{a.icon}</span>
                  <span style={{ fontSize:'0.55rem', color:'rgb(130,142,160)', lineHeight:1.2, fontWeight:500 }}>{a.label}</span>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Armazenamento */}
        <motion.div initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }}
          transition={{ duration:0.5, delay:0.5 }}
          style={{ padding:'0.875rem', flex:1 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.625rem' }}>
            <h3 style={{ fontSize:'0.78rem', fontWeight:700, color:'rgb(245,247,251)' }}>Armazenamento</h3>
            <button type="button" style={{ fontSize:'0.62rem', color:'rgb(77,163,255)', background:'none', border:'none', cursor:'pointer', padding:0 }}>Ver todos →</button>
          </div>
          {[
            { label:'Logótipos',   used:'2.4 GB', pct: 42, color:'rgb(77,163,255)',   icon:'🖼️' },
            { label:'Maquetes',    used:'1.8 GB', pct: 31, color:'rgb(167,139,250)', icon:'🎨' },
            { label:'Artes Finais',used:'4.2 GB', pct: 72, color:'rgb(99,230,190)',  icon:'✅' },
            { label:'Documentos',  used:'1.1 GB', pct: 19, color:'rgb(245,158,11)',  icon:'📄' },
          ].map((s) => (
            <div key={s.label} style={{ marginBottom:'0.5rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.375rem', marginBottom:'0.2rem' }}>
                <span style={{ fontSize:'0.7rem' }}>{s.icon}</span>
                <span style={{ fontSize:'0.68rem', color:'rgb(150,162,180)', flex:1 }}>{s.label}</span>
                <span style={{ fontSize:'0.65rem', fontWeight:600, color:s.color }}>{s.used}</span>
              </div>
              <div style={{ height:'3px', background:'rgba(255,255,255,0.06)', borderRadius:'9999px', overflow:'hidden' }}>
                <motion.div initial={{ width:0 }} animate={{ width:`${s.pct}%` }}
                  transition={{ duration:1, delay:0.6, ease:[0.16,1,0.3,1] }}
                  style={{ height:'100%', background:s.color, borderRadius:'9999px' }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop:'0.75rem', padding:'0.625rem 0.75rem', background:'rgba(255,255,255,0.03)', borderRadius:'9px', border:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.3rem' }}>
              <span style={{ fontSize:'0.62rem', color:'rgb(90,102,120)' }}>Total utilizado: 9.5 GB / 50 GB</span>
              <span style={{ fontSize:'0.62rem', fontWeight:700, color:'rgb(77,163,255)' }}>19%</span>
            </div>
            <div style={{ height:'4px', background:'rgba(255,255,255,0.06)', borderRadius:'9999px', overflow:'hidden' }}>
              <motion.div initial={{ width:0 }} animate={{ width:'19%' }}
                transition={{ duration:1.2, delay:0.65, ease:[0.16,1,0.3,1] }}
                style={{ height:'100%', borderRadius:'9999px', background:'linear-gradient(90deg, rgb(77,163,255), rgb(99,230,190))' }} />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
