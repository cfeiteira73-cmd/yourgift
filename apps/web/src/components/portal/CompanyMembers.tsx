'use client';

/**
 * CompanyMembers — multi-user team management panel.
 *
 * Shows current members, pending invites, and lets admins:
 *   - Invite by email
 *   - Change member role
 *   - Remove members
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Member {
  id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'active' | 'pending';
  joined_at: string | null;
  created_at: string;
}

const ROLE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  admin:  { bg: 'rgba(139,92,246,0.15)', color: 'rgb(167,139,250)', label: 'Admin' },
  member: { bg: 'rgba(154,124,74,0.12)', color: '#d4b47a',  label: 'Membro' },
  viewer: { bg: 'rgba(100,112,130,0.12)', color: 'rgba(240,236,228,0.42)', label: 'Viewer' },
};

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  active:  { bg: 'rgba(184,151,94,0.10)',  color: '#b8975e',  label: 'Ativo' },
  pending: { bg: 'rgba(245,158,11,0.12)', color: 'rgb(245,158,11)', label: 'Convite pendente' },
};

export function CompanyMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/company?mode=members');
      if (!res.ok) throw new Error('Failed to load members');
      const json = await res.json();
      setMembers(json.members ?? []);
      setCompanyName(json.companyName ?? 'A sua empresa');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite_member', email: inviteEmail, role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Invite failed');
      setInviteResult(`✓ Convite enviado para ${inviteEmail}`);
      setInviteEmail('');
      load();
    } catch (e) {
      setInviteResult(`✗ ${(e as Error).message}`);
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberId: string) {
    if (!window.confirm('Remover este membro da empresa?')) return;
    await fetch('/api/company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_member', memberId }),
    });
    load();
  }

  async function handleRoleChange(memberId: string, role: 'admin' | 'member' | 'viewer') {
    await fetch('/api/company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_member_role', memberId, role }),
    });
    load();
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '52px', borderRadius: '10px', background: 'rgba(240,236,228,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '1rem', color: 'rgb(239,68,68)', fontSize: '0.78rem' }}>
        Erro ao carregar membros: {error}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'rgb(230,240,255)' }}>Equipa — {companyName}</div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.1rem' }}>{members.length} membro{members.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Invite form */}
      <form onSubmit={handleInvite}
        style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>EMAIL</label>
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="colaborador@empresa.com"
            required
            style={{
              width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px',
              background: 'rgba(240,236,228,0.06)', border: '1px solid rgba(240,236,228,0.10)',
              color: 'rgba(240,236,228,0.75)', fontSize: '0.82rem', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>PAPEL</label>
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value as typeof inviteRole)}
            style={{
              padding: '0.5rem 0.75rem', borderRadius: '8px',
              background: 'rgba(240,236,228,0.06)', border: '1px solid rgba(240,236,228,0.10)',
              color: 'rgba(240,236,228,0.75)', fontSize: '0.82rem', cursor: 'pointer',
            }}
          >
            <option value="admin">Admin</option>
            <option value="member">Membro</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={inviting || !inviteEmail}
          style={{
            padding: '0.5rem 1.25rem', borderRadius: '8px', fontSize: '0.8rem',
            fontWeight: 600, cursor: inviting ? 'default' : 'pointer',
            background: 'rgba(154,124,74,0.14)', border: '1px solid rgba(154,124,74,0.28)',
            color: '#d4b47a', opacity: inviting ? 0.6 : 1, transition: 'opacity 150ms',
          }}
        >
          {inviting ? 'A enviar…' : 'Convidar'}
        </button>
      </form>

      {/* Invite result */}
      <AnimatePresence>
        {inviteResult && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              padding: '0.5rem 0.75rem', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.78rem',
              background: inviteResult.startsWith('✓') ? 'rgba(184,151,94,0.10)' : 'rgba(239,68,68,0.1)',
              color: inviteResult.startsWith('✓') ? '#b8975e' : 'rgb(239,68,68)',
              border: `1px solid ${inviteResult.startsWith('✓') ? 'rgba(184,151,94,0.18)' : 'rgba(239,68,68,0.2)'}`,
            }}
          >
            {inviteResult}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Members list */}
      {members.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(240,236,228,0.10)',
          borderRadius: '12px', padding: '2rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>👥</div>
          <div style={{ fontSize: '0.82rem', color: 'rgb(120,135,155)' }}>Ainda sem membros. Convida a tua equipa acima.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {members.map((m, i) => {
            const roleMeta = ROLE_COLORS[m.role] ?? ROLE_COLORS.member;
            const statusMeta = STATUS_COLORS[m.status] ?? STATUS_COLORS.pending;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)',
                  borderRadius: '10px', padding: '0.625rem 0.875rem',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${roleMeta.color}33, ${roleMeta.color}66)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, color: roleMeta.color,
                }}>
                  {m.email[0].toUpperCase()}
                </div>

                {/* Email */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgb(210,222,240)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                  {m.joined_at && <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>Entrou a {new Date(m.joined_at).toLocaleDateString('pt-PT')}</div>}
                </div>

                {/* Status badge */}
                <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '9999px', background: statusMeta.bg, color: statusMeta.color, flexShrink: 0 }}>
                  {statusMeta.label}
                </span>

                {/* Role selector */}
                <select
                  value={m.role}
                  onChange={e => handleRoleChange(m.id, e.target.value as 'admin' | 'member' | 'viewer')}
                  style={{
                    padding: '0.2rem 0.4rem', borderRadius: '6px', fontSize: '0.68rem',
                    fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                    background: roleMeta.bg, border: `1px solid ${roleMeta.color}33`,
                    color: roleMeta.color,
                  }}
                >
                  <option value="admin">Admin</option>
                  <option value="member">Membro</option>
                  <option value="viewer">Viewer</option>
                </select>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => handleRemove(m.id)}
                  title="Remover membro"
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'rgba(240,236,228,0.42)', fontSize: '0.9rem', flexShrink: 0,
                    padding: '0.1rem 0.2rem', borderRadius: '4px',
                    transition: 'color 150ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgb(239,68,68)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,236,228,0.42)')}
                >
                  ✕
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
