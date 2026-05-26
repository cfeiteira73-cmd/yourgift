'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken, formatDateTime, timeAgo } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface Job {
  id: string;
  type: string;
  status: string;
  error?: string | null;
  createdAt: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface Integration {
  key: string;
  name: string;
  description: string;
  envVar: string;
  category: 'supplier' | 'crm' | 'comms' | 'hr';
  syncEndpoint?: string;
  docsUrl?: string;
  icon: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INTEGRATIONS: Integration[] = [
  {
    key: 'midocean',
    name: 'Midocean',
    description: 'Catálogo de produtos e gestão de encomendas.',
    envVar: 'MIDOCEAN_KEY',
    category: 'supplier',
    syncEndpoint: '/api/v1/suppliers/sync/midocean',
    icon: '📦',
  },
  {
    key: 'pf_concept',
    name: 'PF Concept',
    description: 'Fornecedor alternativo de produtos personalizados.',
    envVar: 'PF_CONCEPT_KEY',
    category: 'supplier',
    syncEndpoint: '/api/v1/suppliers/sync/pf-concept',
    icon: '🎁',
  },
  {
    key: 'slack',
    name: 'Slack',
    description: 'Notificações de encomendas e alertas de equipa.',
    envVar: 'SLACK_WEBHOOK_URL',
    category: 'comms',
    docsUrl: 'https://api.slack.com/messaging/webhooks',
    icon: '💬',
  },
  {
    key: 'hubspot',
    name: 'HubSpot CRM',
    description: 'Sincronização de contactos e pipeline de vendas.',
    envVar: 'HUBSPOT_API_KEY',
    category: 'crm',
    docsUrl: 'https://developers.hubspot.com/',
    icon: '🟠',
  },
  {
    key: 'notion',
    name: 'Notion',
    description: 'Exportação de relatórios e documentação.',
    envVar: 'NOTION_SECRET',
    category: 'crm',
    docsUrl: 'https://developers.notion.com/',
    icon: '📝',
  },
  {
    key: 'resend',
    name: 'Resend',
    description: 'Envio de emails transacionais.',
    envVar: 'RESEND_API_KEY',
    category: 'comms',
    docsUrl: 'https://resend.com/docs',
    icon: '✉️',
  },
  {
    key: 'bamboohr',
    name: 'BambooHR',
    description: 'Sincronização de colaboradores e departamentos.',
    envVar: 'BAMBOOHR_API_KEY',
    category: 'hr',
    docsUrl: 'https://documentation.bamboohr.com/',
    icon: '👥',
  },
];

const TABS = ['Integrações', 'Sistema', 'Segurança', 'Notificações'] as const;
type Tab = (typeof TABS)[number];

const SECURITY_ITEMS = [
  { label: 'Rate Limiting', value: 'Activo — 20 req/s · 200 req/min', ok: true },
  { label: 'JWT Expiry', value: '8 horas', ok: true },
  { label: 'Webhook Signature', value: 'HMAC-SHA256', ok: true },
  { label: 'CORS', value: 'Configurado via env CORS_ORIGIN', ok: true },
  { label: 'Bcrypt rounds', value: '12', ok: true },
];

const NOTIFICATION_EVENTS = [
  { event: 'Encomenda criada', email: true, slack: true },
  { event: 'Pagamento confirmado', email: true, slack: true },
  { event: 'Aprovação pendente', email: true, slack: true },
  { event: 'Aprovação aprovada', email: true, slack: false },
  { event: 'Aprovação rejeitada', email: true, slack: true },
  { event: 'Sync de produtos concluído', email: false, slack: true },
  { event: 'Falha em job', email: true, slack: true },
  { event: 'Stock em baixo', email: false, slack: true },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
        connected ? 'bg-[#4ade80] shadow-[0_0_6px_#4ade80]' : 'bg-[#4d6a87]'
      }`}
    />
  );
}

function Badge({
  connected,
}: {
  connected: boolean;
}) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
        connected
          ? 'bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/20'
          : 'bg-[#4d6a87]/10 text-[#4d6a87] border border-[#4d6a87]/20'
      }`}
    >
      {connected ? 'Activo' : 'Não configurado'}
    </span>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20',
    processing: 'bg-[#4da3ff]/10 text-[#4da3ff] border-[#4da3ff]/20',
    completed: 'bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/20',
    failed: 'bg-[#f87171]/10 text-[#f87171] border-[#f87171]/20',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
        map[status] ?? 'bg-[#4d6a87]/10 text-[#4d6a87] border-[#4d6a87]/20'
      }`}
    >
      {status}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Integrações');

  // Integration tab state
  const [syncingKey, setSyncingKey] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, string>>({});

  // System tab state
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  // Security tab state
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: '', name: '', role: 'manager', password: '' });
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [addAdminError, setAddAdminError] = useState('');

  const authHeaders = useCallback(() => {
    const token = getAdminToken();
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }, []);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const [statsRes, recentRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/jobs/stats`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/jobs/recent`, { headers: authHeaders() }),
      ]);
      const [stats, recent] = await Promise.all([statsRes.json(), recentRes.json()]);
      setJobStats(stats as JobStats);
      setRecentJobs(Array.isArray(recent) ? (recent as Job[]) : []);
    } catch {
      // ignore
    } finally {
      setJobsLoading(false);
    }
  }, [authHeaders]);

  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin-auth/admins`, { headers: authHeaders() });
      const data = await res.json();
      setAdmins(Array.isArray(data) ? (data as AdminUser[]) : []);
    } catch {
      // ignore
    } finally {
      setAdminsLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (activeTab === 'Sistema') loadJobs();
    if (activeTab === 'Segurança') loadAdmins();
  }, [activeTab, loadJobs, loadAdmins]);

  const handleSync = async (integration: Integration) => {
    if (!integration.syncEndpoint) return;
    setSyncingKey(integration.key);
    setSyncResults((prev) => ({ ...prev, [integration.key]: '' }));
    try {
      const res = await fetch(`${API_BASE}${integration.syncEndpoint}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json() as Record<string, unknown>;
      const msg = res.ok
        ? `${data['productsUpserted'] ?? '?'} produtos · ${data['variantsUpserted'] ?? '?'} variantes · ${data['durationMs'] ?? '?'}ms`
        : `Erro: ${String(data['message'] ?? 'Falha')}`;
      setSyncResults((prev) => ({ ...prev, [integration.key]: msg }));
    } catch {
      setSyncResults((prev) => ({ ...prev, [integration.key]: 'Erro de ligação' }));
    } finally {
      setSyncingKey(null);
    }
  };

  const handleAddAdmin = async () => {
    setAddAdminError('');
    if (!newAdmin.email || !newAdmin.name || !newAdmin.password) {
      setAddAdminError('Todos os campos são obrigatórios.');
      return;
    }
    setAddingAdmin(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin-auth/admins`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newAdmin),
      });
      if (!res.ok) {
        const err = await res.json() as Record<string, unknown>;
        setAddAdminError(String(err['message'] ?? 'Erro ao criar administrador'));
        return;
      }
      setShowAddAdmin(false);
      setNewAdmin({ email: '', name: '', role: 'manager', password: '' });
      await loadAdmins();
    } catch {
      setAddAdminError('Erro de ligação');
    } finally {
      setAddingAdmin(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white tracking-tight">Definições</h1>
        <p className="text-sm text-[#4d6a87] mt-1">Integrações, sistema, segurança e notificações</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-[#1a2f48]">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-[#4da3ff] text-[#4da3ff]'
                : 'border-transparent text-[#4d6a87] hover:text-[#8ba8c7]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── TAB: Integrações ─────────────────────────────────────────────── */}
      {activeTab === 'Integrações' && (
        <div className="space-y-4">
          {(['supplier', 'crm', 'comms', 'hr'] as const).map((cat) => {
            const items = INTEGRATIONS.filter((i) => i.category === cat);
            const labels: Record<string, string> = {
              supplier: 'Fornecedores',
              crm: 'CRM & Produtividade',
              comms: 'Comunicações',
              hr: 'Recursos Humanos',
            };
            return (
              <div key={cat}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-3">
                  {labels[cat]}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {items.map((integration) => {
                    const connected = integration.key === 'midocean' || integration.key === 'pf_concept';
                    const syncing = syncingKey === integration.key;
                    const result = syncResults[integration.key];
                    return (
                      <div
                        key={integration.key}
                        className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-4"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl leading-none">{integration.icon}</span>
                            <div>
                              <p className="text-sm font-semibold text-white leading-none">{integration.name}</p>
                              <p className="text-xs text-[#4d6a87] mt-0.5">{integration.description}</p>
                            </div>
                          </div>
                          <Badge connected={connected} />
                        </div>

                        <div className="flex items-center gap-2 mt-3">
                          <StatusDot connected={connected} />
                          <span className="text-xs text-[#8ba8c7]">
                            {connected ? `Env: ${integration.envVar}` : `Configure ${integration.envVar}`}
                          </span>
                        </div>

                        {result && (
                          <p className="mt-2 text-xs text-[#4ade80] font-mono bg-[#4ade80]/5 border border-[#4ade80]/10 rounded px-2 py-1">
                            {result}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-3">
                          {integration.syncEndpoint && (
                            <button
                              type="button"
                              onClick={() => handleSync(integration)}
                              disabled={syncing}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4da3ff]/10 border border-[#4da3ff]/20 text-[#4da3ff] text-xs font-medium hover:bg-[#4da3ff]/20 transition-all disabled:opacity-50"
                            >
                              {syncing ? (
                                <>
                                  <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 8A6 6 0 1 1 8 2" strokeLinecap="round" />
                                  </svg>
                                  A sincronizar...
                                </>
                              ) : (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                    <path d="M10 6A4 4 0 1 1 6 2c1.2 0 2.3.5 3.1 1.3L11 1v3H8" />
                                  </svg>
                                  Sincronizar
                                </>
                              )}
                            </button>
                          )}
                          {integration.docsUrl && (
                            <a
                              href={integration.docsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#1a2f48] text-[#4d6a87] text-xs hover:text-[#8ba8c7] transition-colors"
                            >
                              Docs
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M2 8l6-6M8 8V2H2" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: Sistema ─────────────────────────────────────────────────── */}
      {activeTab === 'Sistema' && (
        <div className="space-y-6">
          {/* Job Queue Stats */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Job Queue</h2>
              <button
                type="button"
                onClick={loadJobs}
                className="text-xs text-[#4d6a87] hover:text-[#4da3ff] transition-colors"
              >
                Atualizar
              </button>
            </div>

            {jobsLoading ? (
              <div className="grid grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 rounded-xl bg-[#0b1526] border border-[#1a2f48] animate-pulse" />
                ))}
              </div>
            ) : jobStats ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Pendente', value: jobStats.pending, color: 'text-[#fbbf24]', bg: 'bg-[#fbbf24]/5 border-[#fbbf24]/10' },
                  { label: 'A processar', value: jobStats.processing, color: 'text-[#4da3ff]', bg: 'bg-[#4da3ff]/5 border-[#4da3ff]/10' },
                  { label: 'Concluído', value: jobStats.completed, color: 'text-[#4ade80]', bg: 'bg-[#4ade80]/5 border-[#4ade80]/10' },
                  { label: 'Falhado', value: jobStats.failed, color: 'text-[#f87171]', bg: 'bg-[#f87171]/5 border-[#f87171]/10' },
                ].map((stat) => (
                  <div key={stat.label} className={`rounded-xl border p-4 ${stat.bg}`}>
                    <p className={`text-2xl font-black ${stat.color} tabular-nums`}>{stat.value}</p>
                    <p className="text-xs text-[#4d6a87] mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Recent Jobs */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Jobs recentes</h3>
            <div className="rounded-xl border border-[#1a2f48] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a2f48]">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Tipo</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Status</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Data</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.slice(0, 20).map((job) => (
                    <tr key={job.id} className="border-b border-[#1a2f48]/50 hover:bg-[#102131]/50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[#8ba8c7]">{job.type}</td>
                      <td className="px-4 py-2.5">
                        <JobStatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-2.5 text-[#4d6a87] tabular-nums">{timeAgo(job.createdAt)}</td>
                      <td className="px-4 py-2.5 text-[#f87171] max-w-[200px] truncate">
                        {job.error ?? '—'}
                      </td>
                    </tr>
                  ))}
                  {recentJobs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-[#4d6a87]">
                        Nenhum job registado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Segurança ───────────────────────────────────────────────── */}
      {activeTab === 'Segurança' && (
        <div className="space-y-6">
          {/* Security items */}
          <div>
            <h2 className="text-sm font-semibold text-white mb-4">Configuração de Segurança</h2>
            <div className="rounded-xl border border-[#1a2f48] overflow-hidden">
              {SECURITY_ITEMS.map((item, idx) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between px-4 py-3 ${
                    idx < SECURITY_ITEMS.length - 1 ? 'border-b border-[#1a2f48]/50' : ''
                  }`}
                >
                  <span className="text-sm text-[#8ba8c7]">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#f0f6ff]">{item.value}</span>
                    {item.ok && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round">
                        <path d="M11.5 3.5L5.5 9.5l-3-3" />
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Admin Users */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Administradores</h2>
              <button
                type="button"
                onClick={() => setShowAddAdmin(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4da3ff]/10 border border-[#4da3ff]/20 text-[#4da3ff] text-xs font-medium hover:bg-[#4da3ff]/20 transition-all"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 1v10M1 6h10" />
                </svg>
                Adicionar
              </button>
            </div>

            {adminsLoading ? (
              <div className="h-20 rounded-xl bg-[#0b1526] border border-[#1a2f48] animate-pulse" />
            ) : (
              <div className="rounded-xl border border-[#1a2f48] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1a2f48]">
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Nome</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Email</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Role</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Estado</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Criado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin) => (
                      <tr key={admin.id} className="border-b border-[#1a2f48]/50 hover:bg-[#102131]/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-white">{admin.name}</td>
                        <td className="px-4 py-3 text-[#8ba8c7]">{admin.email}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[#4da3ff]/10 text-[#4da3ff] border border-[#4da3ff]/20">
                            {admin.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusDot connected={admin.isActive} />
                        </td>
                        <td className="px-4 py-3 text-[#4d6a87] tabular-nums">{timeAgo(admin.createdAt)}</td>
                      </tr>
                    ))}
                    {admins.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-[#4d6a87]">
                          Nenhum administrador encontrado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Admin Modal */}
          {showAddAdmin && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md bg-[#0b1526] border border-[#1a2f48] rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-bold text-white">Adicionar Administrador</h3>
                  <button
                    type="button"
                    onClick={() => { setShowAddAdmin(false); setAddAdminError(''); }}
                    className="text-[#4d6a87] hover:text-white transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 3l10 10M13 3L3 13" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {[
                    { label: 'Email', key: 'email', type: 'email', placeholder: 'admin@yourgift.pt' },
                    { label: 'Nome', key: 'name', type: 'text', placeholder: 'Nome completo' },
                    { label: 'Password', key: 'password', type: 'password', placeholder: '••••••••' },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-[#8ba8c7] mb-1.5">{field.label}</label>
                      <input
                        type={field.type}
                        placeholder={field.placeholder}
                        value={newAdmin[field.key as keyof typeof newAdmin]}
                        onChange={(e) => setNewAdmin((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                      />
                    </div>
                  ))}

                  <div>
                    <label className="block text-xs font-medium text-[#8ba8c7] mb-1.5">Role</label>
                    <select
                      value={newAdmin.role}
                      onChange={(e) => setNewAdmin((prev) => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>

                  {addAdminError && (
                    <p className="text-xs text-[#f87171] bg-[#f87171]/5 border border-[#f87171]/20 rounded px-3 py-2">
                      {addAdminError}
                    </p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setShowAddAdmin(false); setAddAdminError(''); }}
                      className="flex-1 px-4 py-2 rounded-lg border border-[#1a2f48] text-sm text-[#8ba8c7] hover:bg-[#102131] transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddAdmin}
                      disabled={addingAdmin}
                      className="flex-1 px-4 py-2 rounded-lg bg-[#4da3ff] text-sm font-semibold text-[#07111f] hover:bg-[#74e7ff] transition-all disabled:opacity-50"
                    >
                      {addingAdmin ? 'A criar...' : 'Criar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Notificações ────────────────────────────────────────────── */}
      {activeTab === 'Notificações' && (
        <div className="space-y-6">
          {/* Channels */}
          <div>
            <h2 className="text-sm font-semibold text-white mb-4">Canais de Notificação</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  icon: '✉️',
                  name: 'Email (Resend)',
                  desc: 'Envio de emails transacionais e alertas.',
                  envVar: 'RESEND_API_KEY',
                  active: true,
                },
                {
                  icon: '💬',
                  name: 'Slack',
                  desc: 'Notificações em canal #yourgift-ops.',
                  envVar: 'SLACK_WEBHOOK_URL',
                  active: true,
                },
              ].map((channel) => (
                <div key={channel.name} className="rounded-xl border border-[#1a2f48] bg-[#0b1526] p-4 flex items-start gap-3">
                  <span className="text-2xl leading-none">{channel.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{channel.name}</p>
                      <Badge connected={channel.active} />
                    </div>
                    <p className="text-xs text-[#4d6a87] mt-0.5">{channel.desc}</p>
                    <p className="text-xs font-mono text-[#8ba8c7] mt-1">{channel.envVar}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notification events */}
          <div>
            <h2 className="text-sm font-semibold text-white mb-4">Eventos configurados</h2>
            <div className="rounded-xl border border-[#1a2f48] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a2f48]">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Evento</th>
                    <th className="text-center px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Email</th>
                    <th className="text-center px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">Slack</th>
                  </tr>
                </thead>
                <tbody>
                  {NOTIFICATION_EVENTS.map((ev, idx) => (
                    <tr key={ev.event} className={`${idx < NOTIFICATION_EVENTS.length - 1 ? 'border-b border-[#1a2f48]/50' : ''} hover:bg-[#102131]/50 transition-colors`}>
                      <td className="px-4 py-3 text-[#8ba8c7]">{ev.event}</td>
                      <td className="px-4 py-3 text-center">
                        {ev.email ? (
                          <svg className="inline-block" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round">
                            <path d="M11.5 3.5L5.5 9.5l-3-3" />
                          </svg>
                        ) : (
                          <span className="text-[#4d6a87]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {ev.slack ? (
                          <svg className="inline-block" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round">
                            <path d="M11.5 3.5L5.5 9.5l-3-3" />
                          </svg>
                        ) : (
                          <span className="text-[#4d6a87]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
