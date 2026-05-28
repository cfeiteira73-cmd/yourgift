'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';

// ── Constants ─────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientProfile {
  id: string;
  name: string | null;
  company: string | null;
  tier: string | null;
  budget_limit: number | null;
  auth_user_id: string;
  created_at?: string;
  phone?: string | null;
  address?: string | null;
}

interface ClientWithStats extends ClientProfile {
  orders?: number;
  quotes?: number;
  totalSpend?: number;
  activeOrders?: number;
}

interface Stats { orders: number; quotes: number; totalSpend: number; }

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  premium:    { label: 'Premium',    color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.1)',  border: 'rgba(99,230,190,0.25)'  },
  enterprise: { label: 'Enterprise', color: 'rgb(116,231,255)', bg: 'rgba(116,231,255,0.1)', border: 'rgba(116,231,255,0.25)' },
  standard:   { label: 'Standard',   color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.1)', border: 'rgba(120,130,150,0.2)'  },
  trial:      { label: 'Trial',       color: 'rgb(245,158,11)', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)'   },
};

function fmtEur(n: number) {
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n);
}

function timeAgo(iso?: string) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return 'hoje';
  if (d < 30) return `há ${d}d`;
  if (d < 365) return `há ${Math.floor(d / 30)}m`;
  return `há ${Math.floor(d / 365)}a`;
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: '0.72rem', color: 'rgb(100,112,130)' }}>{label}</span>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: accent ? 'rgb(77,163,255)' : 'rgb(210,220,235)' }}>{value}</span>
    </div>
  );
}

// ── Admin: Client Row ─────────────────────────────────────────────────────────

function ClientRow({ client, index, onSelect }: {
  client: ClientWithStats;
  index: number;
  onSelect: (c: ClientWithStats) => void;
}) {
  const tc = TIER_CFG[client.tier ?? 'standard'] ?? TIER_CFG.standard;
  const initials = (client.name ?? client.company ?? 'C').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.03 }}
      onClick={() => onSelect(client)}
      style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <td style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0, background: `${tc.color}18`, border: `1px solid ${tc.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, color: tc.color }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgb(200,215,235)' }}>{client.name ?? '—'}</div>
            <div style={{ fontSize: '0.65rem', color: 'rgb(80,92,110)' }}>{client.company ?? '—'}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: tc.color, background: tc.bg, border: `1px solid ${tc.border}`, borderRadius: '9999px', padding: '0.15rem 0.45rem' }}>
          {tc.label}
        </span>
      </td>
      <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: 'rgb(99,230,190)' }}>
        {fmtEur(client.totalSpend ?? 0)}
      </td>
      <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: 'rgb(77,163,255)', fontWeight: 600 }}>
        {client.orders ?? 0}
      </td>
      <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: 'rgb(245,158,11)', fontWeight: 600 }}>
        {client.quotes ?? 0}
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        {client.budget_limit ? (
          <span style={{ fontSize: '0.72rem', color: 'rgb(167,139,250)' }}>{fmtEur(client.budget_limit)}</span>
        ) : (
          <span style={{ fontSize: '0.68rem', color: 'rgb(60,72,90)' }}>Ilimitado</span>
        )}
      </td>
      <td style={{ padding: '0.75rem 1rem', fontSize: '0.68rem', color: 'rgb(70,82,100)' }}>
        {timeAgo(client.created_at)}
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: (client.activeOrders ?? 0) > 0 ? 'rgb(99,230,190)' : 'rgb(50,62,80)', boxShadow: (client.activeOrders ?? 0) > 0 ? '0 0 6px rgba(99,230,190,0.5)' : 'none' }} />
      </td>
    </motion.tr>
  );
}

// ── Client Detail Drawer ──────────────────────────────────────────────────────

function ClientDrawer({ client, onClose }: { client: ClientWithStats; onClose: () => void }) {
  const tc = TIER_CFG[client.tier ?? 'standard'] ?? TIER_CFG.standard;
  const initials = (client.name ?? client.company ?? 'C').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '340px', background: 'rgb(10,20,38)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        zIndex: 50, overflowY: 'auto', padding: '1.5rem',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'rgb(245,247,251)' }}>Detalhe do Cliente</h3>
        <button type="button" onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer', color: 'rgb(120,130,150)', fontSize: '0.9rem' }}>✕</button>
      </div>

      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.025)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0, background: `linear-gradient(135deg, ${tc.color}, ${tc.color}80)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800, color: 'rgb(7,17,31)' }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'rgb(245,247,251)' }}>{client.name ?? '—'}</div>
          <div style={{ fontSize: '0.72rem', color: 'rgb(100,112,130)' }}>{client.company ?? '—'}</div>
          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: tc.color, background: tc.bg, border: `1px solid ${tc.border}`, borderRadius: '9999px', padding: '0.1rem 0.4rem', marginTop: '0.25rem', display: 'inline-block' }}>
            {tc.label}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Encomendas', value: String(client.orders ?? 0), color: 'rgb(77,163,255)' },
          { label: 'Orçamentos', value: String(client.quotes ?? 0), color: 'rgb(245,158,11)' },
          { label: 'Volume Total', value: fmtEur(client.totalSpend ?? 0), color: 'rgb(99,230,190)' },
        ].map(s => (
          <div key={s.label} style={{ padding: '0.625rem', background: 'rgba(255,255,255,0.025)', borderRadius: '9px', border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
            <div style={{ fontSize: '0.58rem', color: 'rgb(70,82,100)', marginTop: '0.1rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Details */}
      <div style={{ marginBottom: '1.25rem' }}>
        <InfoRow label="ID" value={client.id.slice(0, 8).toUpperCase()} />
        <InfoRow label="Budget Limite" value={client.budget_limit ? fmtEur(client.budget_limit) : 'Ilimitado'} />
        <InfoRow label="Telefone" value={client.phone ?? '—'} />
        <InfoRow label="Morada" value={client.address ?? '—'} />
        <InfoRow label="Registado" value={client.created_at ? new Date(client.created_at).toLocaleDateString('pt-PT') : '—'} />
        <InfoRow label="Encomendas Ativas" value={String(client.activeOrders ?? 0)} accent />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <a href={`mailto:?subject=YourGift — ${client.company ?? client.name}`}
          style={{ display: 'block', textAlign: 'center', padding: '0.6rem', background: 'rgba(77,163,255,0.1)', border: '1px solid rgba(77,163,255,0.25)', borderRadius: '9px', fontSize: '0.75rem', fontWeight: 600, color: 'rgb(77,163,255)', textDecoration: 'none' }}>
          ✉ Contactar cliente
        </a>
        <a href="/orders"
          style={{ display: 'block', textAlign: 'center', padding: '0.6rem', background: 'rgba(99,230,190,0.06)', border: '1px solid rgba(99,230,190,0.2)', borderRadius: '9px', fontSize: '0.75rem', fontWeight: 600, color: 'rgb(99,230,190)', textDecoration: 'none' }}>
          📦 Ver encomendas
        </a>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [allClients, setAllClients] = useState<ClientWithStats[]>([]);
  const [stats, setStats] = useState<Stats>({ orders: 0, quotes: 0, totalSpend: 0 });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/auth/login?next=/clients'); return; }
        setUserEmail(user.email ?? '');
        const admin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
        setIsAdmin(admin);

        const { data: c } = await supabase.from('clients').select('*').eq('auth_user_id', user.id).single();
        setClient(c as ClientProfile | null);

        if (admin) {
          // Fetch ALL clients
          const { data: clients } = await supabase
            .from('clients')
            .select('id, name, company, tier, budget_limit, auth_user_id, created_at, phone, address')
            .order('created_at', { ascending: false });

          if (clients && clients.length > 0) {
            // Fetch order/quote stats for each client in parallel
            const withStats: ClientWithStats[] = await Promise.all(
              (clients as ClientProfile[]).map(async (cli) => {
                const [ordRes, quotRes, spendRes, activeRes] = await Promise.all([
                  supabase.from('orders').select('id', { count: 'exact', head: true }).eq('client_id', cli.id),
                  supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('client_id', cli.id),
                  supabase.from('orders').select('total_amount').eq('client_id', cli.id).not('status', 'eq', 'cancelled'),
                  supabase.from('orders').select('id', { count: 'exact', head: true }).eq('client_id', cli.id).not('status', 'in', '("delivered","cancelled","draft")'),
                ]);
                return {
                  ...cli,
                  orders: ordRes.count ?? 0,
                  quotes: quotRes.count ?? 0,
                  totalSpend: (spendRes.data ?? []).reduce((s, o: any) => s + (o.total_amount ?? 0), 0),
                  activeOrders: activeRes.count ?? 0,
                };
              })
            );
            setAllClients(withStats);
          }
        } else if (c) {
          const [ordersRes, quotesRes, spendRes] = await Promise.all([
            supabase.from('orders').select('id', { count: 'exact', head: true }).eq('client_id', c.id),
            supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('client_id', c.id),
            supabase.from('orders').select('total_amount').eq('client_id', c.id).not('status', 'eq', 'cancelled'),
          ]);
          const totalSpend = (spendRes.data ?? []).reduce((s, o: any) => s + (o.total_amount ?? 0), 0);
          setStats({ orders: ordersRes.count ?? 0, quotes: quotesRes.count ?? 0, totalSpend });
        }
      } catch (err) {
        console.error('[clients] load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // Admin: filtered + searched clients
  const filteredClients = allClients.filter(c => {
    const matchesSearch = !search ||
      (c.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.company ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesTier = !tierFilter || c.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  // Admin: tier distribution
  const tierCounts = allClients.reduce<Record<string, number>>((acc, c) => {
    const t = c.tier ?? 'standard';
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  const totalRevenue = allClients.reduce((s, c) => s + (c.totalSpend ?? 0), 0);
  const activeCount = allClients.filter(c => (c.activeOrders ?? 0) > 0).length;

  // Non-admin: profile view
  const tc = TIER_CFG[(client?.tier ?? 'standard') as keyof typeof TIER_CFG] ?? TIER_CFG.standard;
  const initials = (client?.name ?? 'YG').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* ── Admin: Click backdrop ── */}
      <AnimatePresence>
        {selectedClient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedClient(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedClient && (
          <ClientDrawer client={selectedClient} onClose={() => setSelectedClient(null)} />
        )}
      </AnimatePresence>

      {isAdmin ? (
        // ── ADMIN VIEW ──────────────────────────────────────────────────────
        <div style={{ padding: '1.5rem 2rem 3rem' }}>

          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>
              Enterprise Client Management
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'rgb(80,92,110)' }}>
              Visão global de todos os clientes · {allClients.length} registados
            </p>
          </motion.div>

          {/* KPI strip */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.625rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Total Clientes',    value: String(allClients.length),    color: 'rgb(77,163,255)',   icon: '👥' },
              { label: 'Com Encomendas Ativas', value: String(activeCount),      color: 'rgb(99,230,190)',   icon: '📦' },
              { label: 'Receita Global',    value: fmtEur(totalRevenue),          color: 'rgb(167,139,250)', icon: '💶' },
              { label: 'Premium + Enterprise', value: String((tierCounts.premium ?? 0) + (tierCounts.enterprise ?? 0)), color: 'rgb(116,231,255)', icon: '💎' },
              { label: 'Média por Cliente', value: allClients.length > 0 ? fmtEur(totalRevenue / allClients.length) : '—', color: 'rgb(245,158,11)', icon: '📊' },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05 }}
                className="yg-card" style={{ padding: '0.875rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.58rem', fontWeight: 600, color: 'rgb(80,92,110)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{kpi.label}</span>
                  <span style={{ fontSize: '0.8rem' }}>{kpi.icon}</span>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: kpi.color, letterSpacing: '-0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kpi.value}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Tier distribution */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}
            style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setTierFilter(null)}
              style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.3rem 0.75rem', borderRadius: '9999px', border: `1px solid ${!tierFilter ? 'rgba(77,163,255,0.4)' : 'rgba(255,255,255,0.07)'}`, background: !tierFilter ? 'rgba(77,163,255,0.12)' : 'rgba(255,255,255,0.03)', color: !tierFilter ? 'rgb(77,163,255)' : 'rgb(80,92,110)', cursor: 'pointer' }}>
              Todos ({allClients.length})
            </button>
            {Object.entries(TIER_CFG).map(([tier, cfg]) => {
              const count = tierCounts[tier] ?? 0;
              return count > 0 ? (
                <button type="button" key={tier}  onClick={() => setTierFilter(tierFilter === tier ? null : tier)}
                  style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.3rem 0.75rem', borderRadius: '9999px', border: `1px solid ${tierFilter === tier ? cfg.border : 'rgba(255,255,255,0.07)'}`, background: tierFilter === tier ? cfg.bg : 'rgba(255,255,255,0.02)', color: tierFilter === tier ? cfg.color : 'rgb(80,92,110)', cursor: 'pointer' }}>
                  {cfg.label} ({count})
                </button>
              ) : null;
            })}
          </motion.div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <svg style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'rgb(80,92,110)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input type="text" placeholder="Pesquisar por nome ou empresa..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '11px', padding: '0.6rem 1rem 0.6rem 2.5rem', fontSize: '0.82rem', color: 'rgb(200,210,225)', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.35)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
            />
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[1, 2, 3, 4].map(i => <div key={i} style={{ height: '56px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
            </div>
          ) : (
            <div style={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Cliente', 'Plano', 'Volume Total', 'Encomendas', 'Orçamentos', 'Budget', 'Registo', 'Ativo'].map(h => (
                      <th key={h} style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.62rem', fontWeight: 700, color: 'rgb(80,92,110)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'rgb(60,72,90)', fontSize: '0.78rem' }}>Nenhum cliente encontrado</td></tr>
                  ) : (
                    filteredClients.map((c, i) => (
                      <ClientRow key={c.id} client={c} index={i} onSelect={setSelectedClient} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        // ── CLIENT SELF VIEW ────────────────────────────────────────────────
        <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '860px' }}>

          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '1.75rem' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>A Minha Conta</h1>
            <p style={{ fontSize: '0.78rem', color: 'rgb(80,92,110)' }}>Perfil e informações da sua conta YourGift</p>
          </motion.div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[1, 2, 3].map(i => <div key={i} style={{ height: '120px', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>

              {/* Profile card */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}
                className="yg-card" style={{ padding: '1.5rem', gridColumn: '1 / -1', display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '18px', flexShrink: 0, background: 'linear-gradient(135deg,rgb(77,163,255),rgb(116,231,255))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, color: 'rgb(7,17,31)', boxShadow: '0 0 20px rgba(77,163,255,0.3)' }}>
                  {initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.02em' }}>{client?.name ?? 'Utilizador'}</h2>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: tc.color, background: tc.bg, border: `1px solid ${tc.border}`, borderRadius: '9999px', padding: '0.2rem 0.6rem' }}>{tc.label}</span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'rgb(120,130,150)', marginBottom: '0.25rem' }}>{client?.company ?? '—'}</p>
                  <p style={{ fontSize: '0.75rem', color: 'rgb(80,92,110)' }}>{userEmail}</p>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'center' }}>
                  {[
                    { label: 'Encomendas', value: stats.orders, color: 'rgb(77,163,255)' },
                    { label: 'Orçamentos', value: stats.quotes, color: 'rgb(245,158,11)' },
                    { label: 'Total Gasto', value: fmtEur(stats.totalSpend), color: 'rgb(99,230,190)' },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: s.color, letterSpacing: '-0.03em' }}>{s.value}</div>
                      <div style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Account details */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}
                className="yg-card" style={{ padding: '1.25rem 1.375rem' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgb(245,247,251)', marginBottom: '0.625rem' }}>Detalhes da Conta</h3>
                <InfoRow label="Nome" value={client?.name ?? '—'} />
                <InfoRow label="Empresa" value={client?.company ?? '—'} />
                <InfoRow label="Email" value={userEmail} accent />
                <InfoRow label="Plano" value={tc.label} accent />
                <InfoRow label="Budget limite" value={client?.budget_limit ? fmtEur(client.budget_limit) : 'Ilimitado'} />
                <InfoRow label="ID cliente" value={client?.id?.slice(0, 8).toUpperCase() ?? '—'} />
              </motion.div>

              {/* Activity */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.15 }}
                className="yg-card" style={{ padding: '1.25rem 1.375rem' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgb(245,247,251)', marginBottom: '0.625rem' }}>Atividade</h3>
                {[
                  { icon: '📦', label: 'Total de encomendas', value: String(stats.orders),      color: 'rgb(77,163,255)'  },
                  { icon: '📋', label: 'Total de orçamentos', value: String(stats.quotes),      color: 'rgb(245,158,11)'  },
                  { icon: '💶', label: 'Volume total',         value: fmtEur(stats.totalSpend), color: 'rgb(99,230,190)'  },
                  { icon: '⭐', label: 'Nível de cliente',     value: tc.label,                  color: tc.color           },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                    <span style={{ fontSize: '0.75rem', color: 'rgb(130,142,160)', flex: 1 }}>{item.label}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </motion.div>
            </div>
          )}
        </div>
      )}
    </PortalLayout>
  );
}
