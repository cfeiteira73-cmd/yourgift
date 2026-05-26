'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type RequestType = 'erasure' | 'access' | 'portability';
type RequestStatus = 'pending' | 'processing' | 'completed' | 'rejected';

interface GDPRRequest {
  id: string;
  requestType: RequestType;
  subjectEmail: string;
  tenantId: string;
  status: RequestStatus;
  requestedAt: string;
  notes?: string;
}

interface LegalHold {
  id: string;
  scope: string;
  reason: string;
  placedBy: string;
  placedAt: string;
  expiresAt?: string;
}

interface RetentionPolicy {
  entityType: string;
  retentionDays: number;
  anonymizeAfterDays?: number;
  deleteAfterDays?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders() {
  return { Authorization: `Bearer ${getAdminToken()}`, 'Content-Type': 'application/json' };
}

const REQ_TYPE_CFG: Record<RequestType, { color: string; bg: string; label: string }> = {
  erasure:     { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Erasure' },
  access:      { color: '#4da3ff', bg: 'rgba(77,163,255,0.1)',  label: 'Access' },
  portability: { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', label: 'Portability' },
};

const STATUS_CFG: Record<RequestStatus, { color: string; bg: string }> = {
  pending:    { color: '#8ba8c7', bg: 'rgba(139,168,199,0.1)' },
  processing: { color: '#4da3ff', bg: 'rgba(77,163,255,0.1)' },
  completed:  { color: '#63e6be', bg: 'rgba(99,230,190,0.1)' },
  rejected:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

// ── Create Request Form ───────────────────────────────────────────────────────

function CreateRequestForm({ onCreated }: { onCreated: () => void }) {
  const [requestType, setRequestType] = useState<RequestType>('access');
  const [subjectEmail, setSubjectEmail] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const submit = async () => {
    if (!subjectEmail.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/v1/governance/requests`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ requestType, subjectEmail: subjectEmail.trim(), tenantId: tenantId.trim(), notes: notes.trim() }),
      });
      setSubjectEmail(''); setTenantId(''); setNotes('');
      setOpen(false);
      onCreated();
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#4da3ff]/10 border border-[#4da3ff]/30 text-[#4da3ff] rounded-lg text-[11px] font-medium hover:bg-[#4da3ff]/20 transition-colors"
      >
        + New Request
      </button>
    );
  }

  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4 space-y-3">
      <h3 className="text-[12px] font-semibold text-[#f0f6ff]">New GDPR Request</h3>
      <div className="flex gap-2">
        <select
          value={requestType}
          onChange={(e) => setRequestType(e.target.value as RequestType)}
          className="bg-[#07111f] border border-[#1a2f48] rounded-lg px-2 py-1.5 text-[12px] text-[#f0f6ff] focus:outline-none"
        >
          <option value="access">Access</option>
          <option value="erasure">Erasure</option>
          <option value="portability">Portability</option>
        </select>
        <input
          value={subjectEmail}
          onChange={(e) => setSubjectEmail(e.target.value)}
          placeholder="subject@email.com"
          type="email"
          className="flex-1 bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-1.5 text-[12px] text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/60"
        />
        <input
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          placeholder="Tenant ID"
          className="w-32 bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-1.5 text-[12px] text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/60"
        />
      </div>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-1.5 text-[12px] text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/60"
      />
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={submitting || !subjectEmail.trim()}
          className="px-3 py-1.5 bg-[#4da3ff] text-[#07111f] rounded-lg text-[11px] font-semibold hover:bg-[#3a92ee] disabled:opacity-50 transition-colors">
          {submitting ? '…' : 'Submit'}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="px-3 py-1.5 bg-[#0b1526] border border-[#1a2f48] text-[#4d6a87] rounded-lg text-[11px] hover:text-[#8ba8c7] transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Place Hold Form ───────────────────────────────────────────────────────────

function PlaceHoldForm({ onPlaced }: { onPlaced: () => void }) {
  const [scope, setScope] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const submit = async () => {
    if (!scope.trim() || !reason.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/v1/governance/holds`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ scope: scope.trim(), reason: reason.trim() }),
      });
      setScope(''); setReason('');
      setOpen(false);
      onPlaced();
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] rounded-lg text-[11px] font-medium hover:bg-[#f59e0b]/20 transition-colors">
        + Place Hold
      </button>
    );
  }

  return (
    <div className="bg-[#0b1526] border border-[#f59e0b]/30 rounded-xl p-4 space-y-2">
      <div className="text-[12px] font-semibold text-[#f59e0b]">Place Legal Hold</div>
      <input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Scope (e.g. tenant:abc or user:xyz)"
        className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-1.5 text-[12px] text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none" />
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Legal reason"
        className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-1.5 text-[12px] text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none" />
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={submitting || !scope.trim() || !reason.trim()}
          className="px-3 py-1.5 bg-[#f59e0b] text-[#07111f] rounded-lg text-[11px] font-semibold disabled:opacity-50 transition-colors">
          {submitting ? '…' : 'Place Hold'}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="px-3 py-1.5 bg-[#0b1526] border border-[#1a2f48] text-[#4d6a87] rounded-lg text-[11px] transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GovernanceDataPage() {
  const [requests, setRequests] = useState<GDPRRequest[]>([]);
  const [holds, setHolds] = useState<LegalHold[]>([]);
  const [retention, setRetention] = useState<RetentionPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const h = authHeaders();
    const [rqRes, hlRes, rtRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/v1/governance/requests`, { headers: h }),
      fetch(`${API_BASE}/api/v1/governance/holds`, { headers: h }),
      fetch(`${API_BASE}/api/v1/governance/retention`, { headers: h }),
    ]);
    if (rqRes.status === 'fulfilled' && rqRes.value.ok) {
      const data = await rqRes.value.json() as { requests: GDPRRequest[] };
      setRequests(data.requests ?? []);
    }
    if (hlRes.status === 'fulfilled' && hlRes.value.ok) {
      const data = await hlRes.value.json() as { holds: LegalHold[] };
      setHolds(data.holds ?? []);
    }
    if (rtRes.status === 'fulfilled' && rtRes.value.ok) {
      const data = await rtRes.value.json() as { policies: RetentionPolicy[] };
      setRetention(data.policies ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const processRequest = async (id: string) => {
    setProcessingId(id);
    await fetch(`${API_BASE}/api/v1/governance/requests/${id}/process`, {
      method: 'POST', headers: authHeaders(),
    });
    await fetchData();
    setProcessingId(null);
  };

  const releaseHold = async (id: string) => {
    setReleasingId(id);
    await fetch(`${API_BASE}/api/v1/governance/holds/${id}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    await fetchData();
    setReleasingId(null);
  };

  const pending = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="text-[#4da3ff]">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="2" width="12" height="14" rx="2" />
            <path d="M6 6h6M6 9h6M6 12h4" />
            <path d="M13 11l2 2-1 1" />
          </svg>
        </div>
        <div>
          <h1 className="text-[18px] font-semibold text-[#f0f6ff]">Data Governance & GDPR</h1>
          <p className="text-[12px] text-[#4d6a87] mt-0.5">GDPR Art. 17/20 · legal holds · retention policies</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Pending Requests', value: pending, color: pending > 0 ? '#f59e0b' : '#4d6a87' },
          { label: 'Active Holds', value: holds.length, color: holds.length > 0 ? '#ef4444' : '#4d6a87' },
          { label: 'Policies', value: retention.length, color: '#4da3ff' },
          { label: 'Total Requests', value: requests.length, color: '#63e6be' },
        ].map((k) => (
          <div key={k.label} className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
            <div className="text-[24px] font-bold tabular-nums" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[11px] text-[#4d6a87] mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Request queue */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2f48] bg-[#07111f]/50">
          <span className="text-[12px] font-semibold text-[#f0f6ff]">GDPR Request Queue</span>
          <CreateRequestForm onCreated={() => void fetchData()} />
        </div>
        <div className="grid grid-cols-[100px_1fr_140px_80px_120px_80px] gap-3 px-4 py-2 border-b border-[#1a2f48]/50 text-[10px] text-[#4d6a87] uppercase tracking-wider">
          <span>Type</span><span>Subject Email</span><span>Tenant</span><span>Status</span><span>Requested At</span><span>Action</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-[#4d6a87] text-[12px]">
            <span className="w-4 h-4 border border-[#4da3ff] border-t-transparent rounded-full animate-spin mr-2" />Loading…
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-10 text-[#4d6a87] text-[12px]">No GDPR requests.</div>
        ) : (
          requests.map((req) => {
            const typeCfg = REQ_TYPE_CFG[req.requestType];
            const stCfg = STATUS_CFG[req.status];
            const isProcessing = processingId === req.id;
            return (
              <div key={req.id} className="grid grid-cols-[100px_1fr_140px_80px_120px_80px] gap-3 items-center px-4 py-3 border-b border-[#1a2f48]/50 hover:bg-[#07111f]/40 transition-colors">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: typeCfg.bg, color: typeCfg.color }}>{typeCfg.label}</span>
                <span className="text-[12px] text-[#cfe4ff] truncate">{req.subjectEmail}</span>
                <span className="text-[11px] text-[#8ba8c7] font-mono truncate">{req.tenantId || '—'}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded capitalize" style={{ backgroundColor: stCfg.bg, color: stCfg.color }}>{req.status}</span>
                <span className="text-[11px] text-[#4d6a87]">{new Date(req.requestedAt).toLocaleDateString('pt-PT')}</span>
                <div>
                  {req.status === 'pending' && (
                    <button type="button" onClick={() => void processRequest(req.id)} disabled={isProcessing}
                      className="px-2 py-1 bg-[#4da3ff]/10 border border-[#4da3ff]/30 text-[#4da3ff] rounded text-[10px] font-medium hover:bg-[#4da3ff]/20 disabled:opacity-50 transition-colors">
                      {isProcessing ? '…' : 'Process'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-4">
        {/* Legal holds */}
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2f48] bg-[#07111f]/50">
            <span className="text-[12px] font-semibold text-[#f0f6ff]">Legal Holds ({holds.length})</span>
            <PlaceHoldForm onPlaced={() => void fetchData()} />
          </div>
          {holds.length === 0 ? (
            <div className="text-center py-10 text-[#4d6a87] text-[12px]">No active legal holds.</div>
          ) : (
            holds.map((hold) => {
              const isReleasing = releasingId === hold.id;
              return (
                <div key={hold.id} className="px-4 py-3 border-b border-[#1a2f48]/50 hover:bg-[#07111f]/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-[#f59e0b]">{hold.scope}</div>
                      <div className="text-[11px] text-[#8ba8c7] mt-0.5">{hold.reason}</div>
                      <div className="text-[10px] text-[#4d6a87] mt-1">
                        Placed by {hold.placedBy} · {new Date(hold.placedAt).toLocaleDateString('pt-PT')}
                        {hold.expiresAt ? ` · expires ${new Date(hold.expiresAt).toLocaleDateString('pt-PT')}` : ''}
                      </div>
                    </div>
                    <button type="button" onClick={() => void releaseHold(hold.id)} disabled={isReleasing}
                      className="px-2 py-1 bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] rounded text-[10px] font-medium hover:bg-[#ef4444]/20 disabled:opacity-50 transition-colors shrink-0">
                      {isReleasing ? '…' : 'Release'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Retention policy matrix */}
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a2f48] bg-[#07111f]/50">
            <span className="text-[12px] font-semibold text-[#f0f6ff]">Retention Policy Matrix</span>
          </div>
          <div className="grid grid-cols-[1fr_80px_100px_90px] gap-2 px-4 py-2 border-b border-[#1a2f48]/50 text-[10px] text-[#4d6a87] uppercase tracking-wider">
            <span>Entity Type</span><span className="text-right">Retention</span><span className="text-right">Anonymize</span><span className="text-right">Delete</span>
          </div>
          {retention.length === 0 ? (
            <div className="text-center py-10 text-[#4d6a87] text-[12px]">No policies configured.</div>
          ) : (
            retention.map((policy) => (
              <div key={policy.entityType} className="grid grid-cols-[1fr_80px_100px_90px] gap-2 items-center px-4 py-3 border-b border-[#1a2f48]/50 hover:bg-[#07111f]/40 transition-colors">
                <span className="text-[12px] text-[#cfe4ff] font-mono">{policy.entityType}</span>
                <span className="text-[12px] font-mono text-right text-[#4da3ff]">{policy.retentionDays}d</span>
                <span className="text-[12px] font-mono text-right text-[#f59e0b]">
                  {policy.anonymizeAfterDays != null ? `${policy.anonymizeAfterDays}d` : '—'}
                </span>
                <span className="text-[12px] font-mono text-right text-[#ef4444]">
                  {policy.deleteAfterDays != null ? `${policy.deleteAfterDays}d` : '—'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
