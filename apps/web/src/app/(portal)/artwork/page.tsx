'use client';

// ── OMEGA PROTOCOL — S4: Artwork Intelligence — Collaborative Approvals ────────
//
// Full artwork approval lifecycle with version history, comment threads, and
// AI-powered analysis. Split-panel: list (left) + detail/approvals (right).
//
// States: submitted → in_review → approved / revision_requested / rejected
// Admin: approve / request revision / reject + comment
// Client: upload new version on revision request + view status
//
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { springSnappy, springGentle, fadeUp, tapScale } from '@/lib/motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Submission {
  id: string; order_id?: string | null; client_id?: string | null;
  submitted_by: string; submitter_email: string;
  title: string; file_url: string; file_type: string; file_size: number;
  notes: string; status: SubmissionStatus; version_count: number;
  review_note?: string; reviewed_by?: string; reviewed_at?: string;
  created_at: string; updated_at: string;
}

interface Version {
  id: string; submission_id: string; version_number: number;
  file_url: string; file_type: string; file_size: number;
  uploaded_by: string; notes: string; created_at: string;
}

interface Comment {
  id: string; submission_id: string; author_id: string; author_email: string;
  content: string; is_admin: boolean; created_at: string;
}

type SubmissionStatus = 'draft' | 'submitted' | 'in_review' | 'revision_requested' | 'approved' | 'rejected';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SubmissionStatus, { label: string; color: string; bg: string; emoji: string }> = {
  draft:              { label: 'Rascunho',            color: 'rgb(80,92,110)',    bg: 'rgba(80,92,110,0.15)',    emoji: '📝' },
  submitted:          { label: 'Submetido',            color: 'rgb(77,163,255)',   bg: 'rgba(77,163,255,0.12)',   emoji: '📤' },
  in_review:          { label: 'Em Revisão',           color: 'rgb(116,231,255)',  bg: 'rgba(116,231,255,0.12)',  emoji: '🔍' },
  revision_requested: { label: 'Revisão Pedida',       color: 'rgb(245,158,11)',   bg: 'rgba(245,158,11,0.12)',   emoji: '🔄' },
  approved:           { label: 'Aprovado',             color: 'rgb(99,230,190)',   bg: 'rgba(99,230,190,0.12)',   emoji: '✅' },
  rejected:           { label: 'Rejeitado',            color: 'rgb(239,68,68)',    bg: 'rgba(239,68,68,0.12)',    emoji: '❌' },
};

const FILTER_TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'submitted', label: 'Submetidos' },
  { id: 'in_review', label: 'Em Revisão' },
  { id: 'revision_requested', label: 'Revisão' },
  { id: 'approved', label: 'Aprovados' },
  { id: 'rejected', label: 'Rejeitados' },
];

function fmtTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'agora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m atrás`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
  return `${Math.floor(diff / 86400000)}d atrás`;
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(type: string, url: string) {
  return type?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url);
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.2rem 0.5rem', borderRadius: '6px',
      background: cfg.bg, color: cfg.color,
      fontSize: '0.62rem', fontWeight: 700,
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

// ─── Version Timeline ─────────────────────────────────────────────────────────

function VersionTimeline({ versions, currentUrl, onSelect }: { versions: Version[]; currentUrl: string; onSelect: (url: string) => void }) {
  if (versions.length === 0) return null;
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgb(80,92,110)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
        Histórico de Versões ({versions.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {[...versions].reverse().map(v => (
          <motion.div
            key={v.id}
            whileTap={tapScale}
            onClick={() => onSelect(v.file_url)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.5rem 0.75rem', borderRadius: '10px',
              background: currentUrl === v.file_url ? 'rgba(77,163,255,0.1)' : 'rgba(255,255,255,0.03)',
              border: currentUrl === v.file_url ? '1px solid rgba(77,163,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
              background: currentUrl === v.file_url ? 'rgba(77,163,255,0.3)' : 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem', fontWeight: 800, color: currentUrl === v.file_url ? 'rgb(77,163,255)' : 'rgb(120,135,155)',
            }}>
              v{v.version_number}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.68rem', color: 'rgb(170,185,205)', fontWeight: 600 }}>
                Versão {v.version_number}
                {v.version_number === versions.length && <span style={{ marginLeft: '0.35rem', color: 'rgb(99,230,190)', fontSize: '0.58rem' }}>• LATEST</span>}
              </div>
              <div style={{ fontSize: '0.58rem', color: 'rgb(80,92,110)' }}>
                {fmtTime(v.created_at)} · {fmtBytes(v.file_size)}
              </div>
              {v.notes && <div style={{ fontSize: '0.58rem', color: 'rgb(80,92,110)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.notes}</div>}
            </div>
            <a
              href={v.file_url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: '0.65rem', color: 'rgb(77,163,255)', textDecoration: 'none', flexShrink: 0 }}
            >
              ↗
            </a>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Comment Thread ────────────────────────────────────────────────────────────

function CommentThread({ comments, onAdd, loading }: { comments: Comment[]; onAdd: (content: string) => Promise<void>; loading: boolean }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    await onAdd(draft.trim());
    setDraft('');
    setSending(false);
  }

  return (
    <div>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgb(80,92,110)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
        Comentários ({comments.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem', maxHeight: '200px', overflowY: 'auto' }} className="scroll-thin">
        {comments.length === 0 && (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'rgb(80,92,110)', fontSize: '0.72rem' }}>
            Nenhum comentário ainda.
          </div>
        )}
        <AnimatePresence>
          {comments.map(c => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springSnappy}
              style={{
                padding: '0.625rem 0.75rem', borderRadius: '10px',
                background: c.is_admin ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.04)',
                border: c.is_admin ? '1px solid rgba(245,158,11,0.15)' : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: c.is_admin ? 'rgb(245,158,11)' : 'rgb(77,163,255)' }}>
                  {c.is_admin ? '🔑 Admin' : '👤 ' + (c.author_email?.split('@')[0] ?? 'Cliente')}
                </span>
                <span style={{ fontSize: '0.55rem', color: 'rgb(60,72,90)' }}>{fmtTime(c.created_at)}</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgb(170,185,205)', lineHeight: 1.5 }}>{c.content}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {/* Add comment */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }}
          placeholder="Adicionar comentário… (Ctrl+Enter para enviar)"
          rows={2}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', padding: '0.5rem 0.625rem', color: 'rgb(200,215,235)', fontSize: '0.72rem',
            resize: 'none', lineHeight: 1.4,
          }}
        />
        <motion.button
          whileTap={tapScale}
          onClick={send}
          disabled={!draft.trim() || sending || loading}
          style={{
            background: draft.trim() ? 'rgba(77,163,255,0.2)' : 'rgba(255,255,255,0.04)',
            border: draft.trim() ? '1px solid rgba(77,163,255,0.4)' : '1px solid rgba(255,255,255,0.06)',
            borderRadius: '8px', padding: '0.5rem 0.75rem',
            color: draft.trim() ? 'rgb(77,163,255)' : 'rgb(80,92,110)',
            fontSize: '0.72rem', fontWeight: 700, cursor: draft.trim() ? 'pointer' : 'not-allowed',
            flexShrink: 0,
          }}
        >
          {sending ? '…' : '→'}
        </motion.button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ArtworkPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [clientProfile, setClientProfile] = useState<{ name: string | null; company: string | null; tier: string | null } | null>(null);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // Admin actions
  const [reviewNote, setReviewNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // New version upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // AI analysis
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // ── Load list ───────────────────────────────────────────────────────────────

  const loadList = useCallback(async (status: string) => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({ mode: 'list' });
      if (status !== 'all') params.set('status', status);
      const res = await fetch(`/api/artwork?${params}`);
      if (res.ok) {
        const d = await res.json();
        setSubmissions(d.submissions ?? []);
        setIsAdmin(d.isAdmin ?? false);
      }
    } catch { /* non-fatal */ }
    setListLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/artwork'); return; }
      setUserEmail(user.email ?? '');
      const { data: c } = await supabase.from('clients').select('name,company,tier').eq('auth_user_id', user.id).single();
      setClientProfile(c as typeof clientProfile);
      await loadList('all');
    }
    init();
  }, [router, loadList]);

  // ── Load detail ─────────────────────────────────────────────────────────────

  async function loadDetail(sub: Submission) {
    setSelected(sub);
    setPreviewUrl(sub.file_url);
    setAiAnalysis(null);
    setActionSuccess('');
    setReviewNote('');
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/artwork?mode=detail&id=${sub.id}`);
      if (res.ok) {
        const d = await res.json();
        setVersions(d.versions ?? []);
        setComments(d.comments ?? []);
      }
    } catch { /* non-fatal */ }
    setDetailLoading(false);
  }

  // ── Admin actions ───────────────────────────────────────────────────────────

  async function doAction(action: 'approve' | 'revision' | 'reject') {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/artwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, submission_id: selected.id, note: reviewNote }),
      });
      if (res.ok) {
        const d = await res.json();
        const updated = d.submission as Submission;
        setSelected(updated);
        setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
        setActionSuccess(action);
        setReviewNote('');
        // Reload detail to get new comment
        if (reviewNote) {
          const detailRes = await fetch(`/api/artwork?mode=detail&id=${selected.id}`);
          if (detailRes.ok) {
            const dd = await detailRes.json();
            setComments(dd.comments ?? []);
          }
        }
      }
    } catch { /* non-fatal */ }
    setActionLoading(false);
  }

  // ── Add comment ─────────────────────────────────────────────────────────────

  async function addComment(content: string) {
    if (!selected) return;
    const res = await fetch('/api/artwork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'comment', submission_id: selected.id, content }),
    });
    if (res.ok) {
      const d = await res.json();
      setComments(prev => [...prev, d.comment as Comment]);
    }
  }

  // ── Upload new version ──────────────────────────────────────────────────────

  async function handleNewVersion(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setUploading(false); return; }

      const path = `artwork/${user.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const { data, error } = await supabase.storage.from('artwork').upload(path, file, { upsert: false });
      if (error || !data) { setUploading(false); return; }

      const { data: urlData } = supabase.storage.from('artwork').getPublicUrl(data.path);

      await fetch('/api/artwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          parent_id: selected.id,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          title: selected.title,
          notes: `Nova versão enviada por ${userEmail}`,
        }),
      });

      // Reload
      await loadList(statusFilter);
      await loadDetail({ ...selected, status: 'submitted', version_count: selected.version_count + 1 });
    } catch { /* non-fatal */ }
    setUploading(false);
  }

  // ── AI Analysis ─────────────────────────────────────────────────────────────

  async function runAiAnalysis() {
    if (!previewUrl) return;
    setAnalyzing(true);
    setAiAnalysis(null);
    try {
      const res = await fetch('/api/artwork-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: previewUrl }),
      });
      if (res.ok) {
        const d = await res.json();
        setAiAnalysis(d.analysis ?? d.result ?? JSON.stringify(d, null, 2));
      }
    } catch { /* non-fatal */ }
    setAnalyzing(false);
  }

  // ── Filter tabs ─────────────────────────────────────────────────────────────

  function handleFilterChange(f: string) {
    setStatusFilter(f);
    loadList(f);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const hasPendingAction = selected && ['submitted', 'in_review'].includes(selected.status);
  const canUploadNewVersion = selected && selected.status === 'revision_requested';

  return (
    <PortalLayout
      userName={clientProfile?.name ?? undefined}
      companyName={clientProfile?.company ?? undefined}
      tier={clientProfile?.tier ?? undefined}
    >
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1300px' }}>

        {/* Header */}
        <motion.div {...fadeUp(0)} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>
              Aprovação de Artes {isAdmin && <span style={{ fontSize: '0.7rem', color: 'rgb(245,158,11)', marginLeft: '0.5rem', fontWeight: 700 }}>ADMIN</span>}
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'rgb(80,92,110)' }}>
              {isAdmin ? 'Gestão completa de submissões de arte e aprovações.' : 'Submete e acompanha as tuas artes para aprovação.'}
            </p>
          </div>
          <motion.label
            whileTap={tapScale}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'linear-gradient(135deg,rgba(77,163,255,0.2),rgba(116,231,255,0.1))',
              border: '1px solid rgba(77,163,255,0.3)', borderRadius: '10px',
              padding: '0.6rem 1rem', color: 'rgb(77,163,255)', fontSize: '0.78rem', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span>+ Submeter Arte</span>
            <input
              type="file"
              accept="image/*,.pdf,.ai,.psd,.eps"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) { setUploading(false); return; }
                const path = `artwork/${user.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
                const { data, error } = await supabase.storage.from('artwork').upload(path, file, { upsert: false });
                if (!error && data) {
                  const { data: urlData } = supabase.storage.from('artwork').getPublicUrl(data.path);
                  await fetch('/api/artwork', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'submit',
                      title: file.name,
                      file_url: urlData.publicUrl,
                      file_type: file.type,
                      file_size: file.size,
                    }),
                  });
                  await loadList(statusFilter);
                }
                setUploading(false);
              }}
            />
            {uploading && <span style={{ fontSize: '0.65rem' }}>⏳</span>}
          </motion.label>
        </motion.div>

        {/* Layout: list + detail */}
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.25rem', alignItems: 'start' }}>

          {/* ── Left: Submission list ─────────────────────────────────────── */}
          <div>
            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
              {FILTER_TABS.slice(0, isAdmin ? 6 : 4).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleFilterChange(tab.id)}
                  style={{
                    background: statusFilter === tab.id ? 'rgba(77,163,255,0.2)' : 'rgba(255,255,255,0.04)',
                    border: statusFilter === tab.id ? '1px solid rgba(77,163,255,0.4)' : '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '8px', padding: '0.3rem 0.6rem',
                    color: statusFilter === tab.id ? 'rgb(77,163,255)' : 'rgb(100,112,130)',
                    fontSize: '0.62rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Submission list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {listLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton skeleton-card" style={{ borderRadius: '12px' }} />
                ))
              ) : submissions.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'rgb(80,92,110)', fontSize: '0.75rem' }}>
                  Nenhuma submissão encontrada.
                </div>
              ) : (
                <AnimatePresence>
                  {submissions.map((sub, i) => {
                    const cfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.draft;
                    const isSelected = selected?.id === sub.id;
                    return (
                      <motion.div
                        key={sub.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...springSnappy, delay: i * 0.04 }}
                        whileHover={{ x: 2, transition: springSnappy }}
                        whileTap={tapScale}
                        onClick={() => loadDetail(sub)}
                        style={{
                          padding: '0.875rem 1rem', borderRadius: '12px',
                          border: isSelected ? '1.5px solid rgba(77,163,255,0.5)' : '1px solid rgba(255,255,255,0.06)',
                          background: isSelected ? 'rgba(77,163,255,0.08)' : 'rgba(255,255,255,0.03)',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgb(200,215,235)', lineHeight: 1.3, flex: 1, paddingRight: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sub.title}
                          </div>
                          <StatusBadge status={sub.status} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.58rem', color: 'rgb(80,92,110)' }}>
                            {isAdmin ? sub.submitter_email?.split('@')[0] : fmtTime(sub.created_at)}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {sub.version_count > 1 && (
                              <span style={{ fontSize: '0.58rem', background: 'rgba(116,231,255,0.1)', color: 'rgb(116,231,255)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontWeight: 700 }}>
                                v{sub.version_count}
                              </span>
                            )}
                            <span style={{ fontSize: '0.55rem', color: 'rgb(60,72,90)' }}>{fmtTime(sub.updated_at)}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* ── Right: Detail panel ──────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {!selected ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  minHeight: '400px', color: 'rgb(80,92,110)', textAlign: 'center',
                  border: '1px dashed rgba(255,255,255,0.07)', borderRadius: '16px',
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem', opacity: 0.4 }}>🎨</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>Selecciona uma submissão</div>
                <div style={{ fontSize: '0.7rem' }}>para ver detalhes, versões e aprovação</div>
              </motion.div>
            ) : (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={springGentle}
              >
                {detailLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" style={{ borderRadius: '14px' }} />)}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* Preview card */}
                    <div className="yg-card" style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                        <div>
                          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'rgb(220,232,248)', marginBottom: '0.25rem' }}>
                            {selected.title}
                          </h2>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <StatusBadge status={selected.status} />
                            {selected.version_count > 1 && (
                              <span style={{ fontSize: '0.6rem', color: 'rgb(116,231,255)', fontWeight: 700 }}>v{selected.version_count}</span>
                            )}
                          </div>
                        </div>
                        <a
                          href={selected.file_url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '0.7rem', color: 'rgb(77,163,255)', textDecoration: 'none', fontWeight: 600 }}
                        >
                          ↗ Abrir
                        </a>
                      </div>

                      {/* Image preview */}
                      {isImage(selected.file_type, previewUrl ?? selected.file_url) && (
                        <div style={{
                          background: 'rgba(255,255,255,0.03)', borderRadius: '10px', overflow: 'hidden',
                          marginBottom: '0.875rem', border: '1px solid rgba(255,255,255,0.05)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          minHeight: '200px', maxHeight: '320px',
                        }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={previewUrl ?? selected.file_url}
                            alt={selected.title}
                            style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', padding: '1rem' }}
                            onError={e => { (e.target as HTMLImageElement).style.opacity = '0.1'; }}
                          />
                        </div>
                      )}

                      {/* Meta */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.875rem' }}>
                        {[
                          { label: 'Submetido por', value: selected.submitter_email?.split('@')[0] ?? '—' },
                          { label: 'Tamanho', value: fmtBytes(selected.file_size) },
                          { label: 'Data', value: new Date(selected.created_at).toLocaleDateString('pt-PT') },
                        ].map(m => (
                          <div key={m.label}>
                            <div style={{ fontSize: '0.58rem', color: 'rgb(80,92,110)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.15rem' }}>{m.label}</div>
                            <div style={{ fontSize: '0.72rem', color: 'rgb(170,185,205)', fontWeight: 600 }}>{m.value}</div>
                          </div>
                        ))}
                      </div>

                      {selected.notes && (
                        <div style={{ padding: '0.625rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.875rem' }}>
                          <div style={{ fontSize: '0.6rem', color: 'rgb(80,92,110)', marginBottom: '0.2rem' }}>Notas</div>
                          <div style={{ fontSize: '0.72rem', color: 'rgb(170,185,205)', lineHeight: 1.5 }}>{selected.notes}</div>
                        </div>
                      )}

                      {/* AI Analysis */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <motion.button
                          whileTap={tapScale}
                          onClick={runAiAnalysis}
                          disabled={analyzing || !isImage(selected.file_type, previewUrl ?? selected.file_url)}
                          style={{
                            background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)',
                            borderRadius: '8px', padding: '0.4rem 0.875rem',
                            color: 'rgb(167,139,250)', fontSize: '0.68rem', fontWeight: 700,
                            cursor: analyzing ? 'wait' : 'pointer',
                          }}
                        >
                          {analyzing ? '🧠 Analisando…' : '🧠 Análise AI'}
                        </motion.button>
                        {aiAnalysis && (
                          <span style={{ fontSize: '0.62rem', color: 'rgb(99,230,190)' }}>✓ Análise concluída</span>
                        )}
                      </div>

                      {aiAnalysis && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(167,139,250,0.06)', borderRadius: '10px', border: '1px solid rgba(167,139,250,0.15)' }}
                        >
                          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgb(167,139,250)', marginBottom: '0.35rem' }}>🧠 Análise AI</div>
                          <div style={{ fontSize: '0.7rem', color: 'rgb(170,185,205)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{aiAnalysis}</div>
                        </motion.div>
                      )}
                    </div>

                    {/* Version history */}
                    {versions.length > 0 && (
                      <div className="yg-card" style={{ padding: '1.25rem' }}>
                        <VersionTimeline
                          versions={versions}
                          currentUrl={previewUrl ?? selected.file_url}
                          onSelect={setPreviewUrl}
                        />
                      </div>
                    )}

                    {/* Admin approval panel */}
                    {isAdmin && hasPendingAction && (
                      <motion.div
                        {...fadeUp(0.1)}
                        className="yg-card"
                        style={{ padding: '1.25rem', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '16px' }}
                      >
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgb(245,158,11)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>
                          Decisão de Aprovação
                        </div>

                        {actionSuccess ? (
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            style={{ padding: '1rem', textAlign: 'center', color: 'rgb(99,230,190)', fontSize: '0.82rem', fontWeight: 700 }}
                          >
                            ✅ Acção registada com sucesso
                          </motion.div>
                        ) : (
                          <>
                            <textarea
                              value={reviewNote}
                              onChange={e => setReviewNote(e.target.value)}
                              placeholder="Nota de revisão (opcional, será visível ao cliente)…"
                              rows={3}
                              style={{
                                width: '100%', boxSizing: 'border-box',
                                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '8px', padding: '0.625rem 0.75rem', color: 'rgb(200,215,235)', fontSize: '0.75rem',
                                resize: 'vertical', lineHeight: 1.5, marginBottom: '0.875rem',
                              }}
                            />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                              {[
                                { action: 'approve' as const,  label: '✅ Aprovar',         bg: 'rgba(99,230,190,0.15)',  border: 'rgba(99,230,190,0.35)',  color: 'rgb(99,230,190)' },
                                { action: 'revision' as const, label: '🔄 Pedir Revisão',   bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)', color: 'rgb(245,158,11)' },
                                { action: 'reject' as const,   label: '❌ Rejeitar',         bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  color: 'rgb(239,68,68)' },
                              ].map(btn => (
                                <motion.button
                                  key={btn.action}
                                  whileTap={tapScale}
                                  onClick={() => doAction(btn.action)}
                                  disabled={actionLoading}
                                  style={{
                                    background: btn.bg, border: `1px solid ${btn.border}`,
                                    borderRadius: '10px', padding: '0.75rem 0.5rem',
                                    color: btn.color, fontSize: '0.72rem', fontWeight: 700,
                                    cursor: actionLoading ? 'wait' : 'pointer',
                                  }}
                                >
                                  {actionLoading ? '…' : btn.label}
                                </motion.button>
                              ))}
                            </div>
                          </>
                        )}
                      </motion.div>
                    )}

                    {/* Client: upload new version on revision */}
                    {!isAdmin && canUploadNewVersion && (
                      <motion.div {...fadeUp(0.1)} className="yg-card" style={{ padding: '1.25rem', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgb(245,158,11)', marginBottom: '0.5rem' }}>
                          🔄 Revisão Pedida
                        </div>
                        {selected.review_note && (
                          <div style={{ fontSize: '0.75rem', color: 'rgb(170,185,205)', marginBottom: '0.875rem', lineHeight: 1.5 }}>
                            {selected.review_note}
                          </div>
                        )}
                        <motion.label
                          whileTap={tapScale}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                            borderRadius: '10px', padding: '0.625rem 1rem',
                            color: 'rgb(245,158,11)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          {uploading ? '⏳ A enviar…' : '📎 Enviar Nova Versão'}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.pdf,.ai,.psd,.eps"
                            style={{ display: 'none' }}
                            onChange={handleNewVersion}
                          />
                        </motion.label>
                      </motion.div>
                    )}

                    {/* Comments */}
                    <div className="yg-card" style={{ padding: '1.25rem' }}>
                      <CommentThread comments={comments} onAdd={addComment} loading={detailLoading} />
                    </div>

                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </PortalLayout>
  );
}
