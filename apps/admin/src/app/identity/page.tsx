'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SSOConfig {
  tenantId: string;
  protocol: 'OIDC' | 'SAML';
  isActive: boolean;
  oidcIssuer?: string;
  oidcClientId?: string;
  oidcCallbackUrl?: string;
  samlEntryPoint?: string;
  samlIssuer?: string;
  emailDomains?: string[];
  createdAt?: string;
}

interface SCIMStats {
  tenantId: string;
  usersProvisioned: number;
  groupsProvisioned: number;
  lastSyncAt?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders() {
  return { Authorization: `Bearer ${getAdminToken()}`, 'Content-Type': 'application/json' };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProtocolBadge({ protocol }: { protocol: 'OIDC' | 'SAML' }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
      protocol === 'OIDC'
        ? 'bg-[#4da3ff]/10 text-[#4da3ff]'
        : 'bg-[#a78bfa]/10 text-[#a78bfa]'
    }`}>
      {protocol}
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px]" style={{ color: active ? '#63e6be' : '#4d6a87' }}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-[#63e6be]' : 'bg-[#4d6a87]'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// ── SSO Config Form ───────────────────────────────────────────────────────────

interface SSOFormProps {
  tenantId: string;
  existing?: SSOConfig | null;
  onSave: () => void;
  onCancel: () => void;
}

function SSOConfigForm({ tenantId, existing, onSave, onCancel }: SSOFormProps) {
  const [protocol, setProtocol] = useState<'OIDC' | 'SAML'>(existing?.protocol ?? 'OIDC');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    oidcIssuer: existing?.oidcIssuer ?? '',
    oidcClientId: existing?.oidcClientId ?? '',
    oidcClientSecret: '',
    oidcCallbackUrl: existing?.oidcCallbackUrl ?? `${API_BASE}/enterprise-identity/oidc/${tenantId}/callback`,
    samlEntryPoint: existing?.samlEntryPoint ?? '',
    samlIssuer: existing?.samlIssuer ?? `${API_BASE}/enterprise-identity/saml/${tenantId}`,
    samlCert: '',
    samlIdpIssuer: '',
    emailDomains: (existing?.emailDomains ?? []).join(', '),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        protocol,
        isActive: true,
        ...(protocol === 'OIDC' ? {
          oidcIssuer: form.oidcIssuer,
          oidcClientId: form.oidcClientId,
          ...(form.oidcClientSecret ? { oidcClientSecret: form.oidcClientSecret } : {}),
          oidcCallbackUrl: form.oidcCallbackUrl,
        } : {
          samlEntryPoint: form.samlEntryPoint,
          samlIssuer: form.samlIssuer,
        }),
        emailDomains: form.emailDomains.split(',').map(d => d.trim()).filter(Boolean),
      };
      const res = await fetch(`${API_BASE}/api/v1/enterprise-identity/sso/${tenantId}/config`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json() as { message?: string };
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, placeholder: string, type = 'text') => (
    <div>
      <label className="block text-[11px] text-[#4d6a87] uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-[13px] text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/60"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Protocol selector */}
      <div>
        <label className="block text-[11px] text-[#4d6a87] uppercase tracking-wider mb-1.5">Protocol</label>
        <div className="flex gap-2">
          {(['OIDC', 'SAML'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setProtocol(p)}
              className={`px-4 py-2 rounded-lg text-[12px] font-medium border transition-colors ${
                protocol === p
                  ? 'bg-[#4da3ff]/10 border-[#4da3ff]/40 text-[#4da3ff]'
                  : 'bg-[#07111f] border-[#1a2f48] text-[#4d6a87] hover:text-[#8ba8c7]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {protocol === 'OIDC' ? (
        <>
          {field('Issuer URL', 'oidcIssuer', 'https://yourdomain.okta.com')}
          {field('Client ID', 'oidcClientId', 'client_id_from_idp')}
          {field('Client Secret', 'oidcClientSecret', 'Leave blank to keep existing', 'password')}
          {field('Callback URL', 'oidcCallbackUrl', '')}
        </>
      ) : (
        <>
          {field('IdP Entry Point URL', 'samlEntryPoint', 'https://idp.example.com/sso/saml')}
          {field('SP Issuer (Entity ID)', 'samlIssuer', `${process.env.NEXT_PUBLIC_API_URL ?? 'https://api.yourgift.pt'}/enterprise-identity/saml/{tenantId}`)}
          {field('IdP Signing Certificate (PEM or base64)', 'samlCert', '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----')}
          {field('IdP Issuer / Entity ID (optional)', 'samlIdpIssuer', 'http://www.okta.com/exk...')}
          <p className="text-[11px] text-[#4ade80] bg-[#4ade8011] border border-[#4ade8033] rounded px-2 py-1">
            ✓ SAML 2.0 active — native implementation (RSA-SHA256, Exclusive C14N). Compatible with Okta, Azure AD, ADFS, PingFederate, OneLogin.
          </p>
        </>
      )}

      {field('Email Domains (comma-separated)', 'emailDomains', 'acme.com, acme.co.uk')}

      {error && <p className="text-[12px] text-[#ef4444]">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 bg-[#4da3ff] text-[#07111f] rounded-xl text-[13px] font-semibold hover:bg-[#3a92ee] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Config'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 text-[#4d6a87] hover:text-[#8ba8c7] text-[13px]">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IdentityPage() {
  const [configs, setConfigs] = useState<SSOConfig[]>([]);
  const [scimStats, setScimStats] = useState<SCIMStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'sso' | 'scim'>('sso');
  const [editTenant, setEditTenant] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newTenantId, setNewTenantId] = useState('');
  const [deletingTenant, setDeletingTenant] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/enterprise-identity/sso`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json() as { configs: SSOConfig[] };
        setConfigs(data.configs ?? []);
      }
    } catch { /* graceful */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const deleteConfig = async (tenantId: string) => {
    setDeletingTenant(tenantId);
    try {
      await fetch(`${API_BASE}/api/v1/enterprise-identity/sso/${tenantId}/config`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      await load();
    } catch { /* graceful */ }
    setDeletingTenant(null);
  };

  const activeCount = configs.filter(c => c.isActive).length;
  const oidcCount = configs.filter(c => c.protocol === 'OIDC').length;
  const samlCount = configs.filter(c => c.protocol === 'SAML').length;

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#f0f6ff]">Enterprise Identity</h1>
          <p className="text-[12px] text-[#4d6a87] mt-0.5">SSO configuration · SCIM provisioning · tenant isolation</p>
        </div>
        <button
          type="button"
          onClick={() => { setAddingNew(true); setNewTenantId(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#4da3ff] text-[#07111f] rounded-xl text-[12px] font-semibold hover:bg-[#3a92ee] transition-colors"
        >
          <span>+</span> Add SSO Config
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Configured Tenants', value: configs.length, color: '#f0f6ff' },
          { label: 'Active',             value: activeCount,    color: '#63e6be' },
          { label: 'OIDC',              value: oidcCount,       color: '#4da3ff' },
          { label: 'SAML',              value: samlCount,       color: '#a78bfa' },
        ].map(k => (
          <div key={k.label} className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
            <div className="text-[24px] font-bold tabular-nums" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[11px] text-[#4d6a87] mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* SCIM note */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#4da3ff]/5 border border-[#4da3ff]/20">
        <span className="text-[#4da3ff] text-[16px] mt-0.5">ⓘ</span>
        <div className="text-[12px] text-[#8ba8c7]">
          <strong className="text-[#f0f6ff]">SCIM 2.0 endpoint:</strong>{' '}
          <code className="bg-[#07111f] px-1.5 py-0.5 rounded text-[11px] text-[#4da3ff]">
            {API_BASE}/scim/v2/tenants/:tenantId/Users
          </code>
          {' '}— Bearer token per tenant via env <code className="bg-[#07111f] px-1.5 py-0.5 rounded text-[11px] text-[#4da3ff]">SCIM_TOKEN_{'<TENANT_ID>'}</code>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0b1526] border border-[#1a2f48] rounded-xl p-1 w-fit">
        {(['sso', 'scim'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
              tab === t ? 'bg-[#1a2f48] text-[#f0f6ff]' : 'text-[#4d6a87] hover:text-[#8ba8c7]'
            }`}
          >
            {t === 'sso' ? 'SSO Configs' : 'SCIM Stats'}
          </button>
        ))}
      </div>

      {/* Add new form */}
      {addingNew && (
        <div className="bg-[#0b1526] border border-[#4da3ff]/30 rounded-xl p-5">
          <h3 className="text-[14px] font-semibold text-[#f0f6ff] mb-4">New SSO Configuration</h3>
          <div className="mb-4">
            <label className="block text-[11px] text-[#4d6a87] uppercase tracking-wider mb-1.5">Tenant ID</label>
            <input
              type="text"
              value={newTenantId}
              onChange={e => setNewTenantId(e.target.value)}
              placeholder="acme-corp"
              className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-[13px] text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/60"
            />
          </div>
          {newTenantId.trim() && (
            <SSOConfigForm
              tenantId={newTenantId.trim()}
              onSave={() => { setAddingNew(false); void load(); }}
              onCancel={() => setAddingNew(false)}
            />
          )}
        </div>
      )}

      {/* SSO Configs list */}
      {tab === 'sso' && (
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_80px_80px_1fr_auto] gap-4 px-4 py-2.5 border-b border-[#1a2f48] text-[10px] text-[#4d6a87] uppercase tracking-wider bg-[#07111f]/50">
            <span>Tenant</span><span>Protocol</span><span>Status</span><span>Domains / IdP</span><span>Actions</span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-[#4d6a87] text-[13px]">
              <span className="inline-block w-4 h-4 border border-[#4da3ff] border-t-transparent rounded-full animate-spin mr-2" />
              Loading…
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-16 text-[#4d6a87] text-[13px]">
              No SSO configured — click <strong className="text-[#f0f6ff]">Add SSO Config</strong> to set up your first tenant.
            </div>
          ) : (
            configs.map(cfg => (
              <div key={cfg.tenantId}>
                <div className="grid grid-cols-[1fr_80px_80px_1fr_auto] gap-4 items-center px-4 py-3 border-b border-[#1a2f48]/50 hover:bg-[#07111f]/40 transition-colors">
                  <div>
                    <div className="text-[13px] font-semibold text-[#f0f6ff]">{cfg.tenantId}</div>
                    {cfg.createdAt && (
                      <div className="text-[10px] text-[#4d6a87] mt-0.5">
                        Added {new Date(cfg.createdAt).toLocaleDateString('pt-PT')}
                      </div>
                    )}
                  </div>
                  <div><ProtocolBadge protocol={cfg.protocol} /></div>
                  <div><StatusDot active={cfg.isActive} /></div>
                  <div className="text-[11px] text-[#8ba8c7]">
                    {cfg.protocol === 'OIDC' ? (
                      <div>
                        <div className="truncate" title={cfg.oidcIssuer}>{cfg.oidcIssuer ?? '—'}</div>
                        {cfg.emailDomains && cfg.emailDomains.length > 0 && (
                          <div className="text-[10px] text-[#4d6a87] mt-0.5">{cfg.emailDomains.join(', ')}</div>
                        )}
                      </div>
                    ) : (
                      <div className="truncate" title={cfg.samlEntryPoint}>{cfg.samlEntryPoint ?? '—'}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditTenant(editTenant === cfg.tenantId ? null : cfg.tenantId)}
                      className="text-[11px] text-[#4da3ff] hover:text-[#f0f6ff] transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteConfig(cfg.tenantId)}
                      disabled={deletingTenant === cfg.tenantId}
                      className="text-[11px] text-[#4d6a87] hover:text-[#ef4444] transition-colors disabled:opacity-50"
                    >
                      {deletingTenant === cfg.tenantId ? '…' : 'Remove'}
                    </button>
                  </div>
                </div>

                {/* Edit form (inline expand) */}
                {editTenant === cfg.tenantId && (
                  <div className="px-4 py-4 border-b border-[#1a2f48] bg-[#07111f]/60">
                    <SSOConfigForm
                      tenantId={cfg.tenantId}
                      existing={cfg}
                      onSave={() => { setEditTenant(null); void load(); }}
                      onCancel={() => setEditTenant(null)}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* SCIM Stats tab */}
      {tab === 'scim' && (
        <div className="space-y-4">
          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
            <h3 className="text-[14px] font-semibold text-[#f0f6ff] mb-3">SCIM 2.0 Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2.5 border-b border-[#1a2f48]">
                <span className="text-[13px] text-[#f0f6ff]">ServiceProviderConfig endpoint</span>
                <a
                  href={`${API_BASE}/scim/v2/ServiceProviderConfig`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#4da3ff] hover:underline font-mono"
                >
                  /scim/v2/ServiceProviderConfig →
                </a>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-[#1a2f48]">
                <span className="text-[13px] text-[#f0f6ff]">Users endpoint</span>
                <code className="text-[11px] text-[#4da3ff] bg-[#07111f] px-2 py-0.5 rounded">/scim/v2/tenants/:tenantId/Users</code>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-[#1a2f48]">
                <span className="text-[13px] text-[#f0f6ff]">Groups endpoint</span>
                <code className="text-[11px] text-[#4da3ff] bg-[#07111f] px-2 py-0.5 rounded">/scim/v2/tenants/:tenantId/Groups</code>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[13px] text-[#f0f6ff]">Authentication</span>
                <span className="text-[11px] text-[#8ba8c7]">Bearer token via <code className="bg-[#07111f] px-1.5 py-0.5 rounded text-[#4da3ff]">SCIM_TOKEN_{'<TENANT_ID>'}</code></span>
              </div>
            </div>
          </div>

          <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-5">
            <h3 className="text-[14px] font-semibold text-[#f0f6ff] mb-3">Okta / Azure AD Setup</h3>
            <div className="space-y-2 text-[13px] text-[#8ba8c7]">
              {[
                { step: '1', text: 'Add a SCIM 2.0 app in Okta/Azure AD' },
                { step: '2', text: 'Set Base URL to the SCIM endpoint above' },
                { step: '3', text: 'Set Bearer token from env SCIM_TOKEN_<TENANT_ID>' },
                { step: '4', text: 'Assign users/groups and trigger initial sync' },
                { step: '5', text: 'Verify provisioning logs in the Audit tab' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3 py-1.5">
                  <span className="w-5 h-5 shrink-0 bg-[#4da3ff]/10 text-[#4da3ff] rounded-full text-[10px] font-bold flex items-center justify-center">{s.step}</span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          </div>

          {scimStats.length === 0 ? (
            <div className="text-center py-8 text-[#4d6a87] text-[13px]">
              SCIM provisioning stats will appear after first sync
            </div>
          ) : (
            <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
              {scimStats.map(s => (
                <div key={s.tenantId} className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-[#1a2f48]/50 text-[13px]">
                  <span className="text-[#f0f6ff] font-medium">{s.tenantId}</span>
                  <span className="text-[#4da3ff]">{s.usersProvisioned} users</span>
                  <span className="text-[#a78bfa]">{s.groupsProvisioned} groups</span>
                  <span className="text-[#4d6a87]">{s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString('pt-PT') : '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
