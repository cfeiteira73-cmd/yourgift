'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── OMEGA FINAL — Unified Notification Center ─────────────────────────────────

interface Notification {
  id: string;
  type: string;
  category: string | null;
  title: string;
  message: string | null;
  action_url: string | null;
  action_label: string | null;
  priority: number;
  read_at: string | null;
  dismissed_at: string | null;
  source: string | null;
  created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  error:   'bg-red-500/20 border-red-500/30 text-red-400',
  warning: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
  success: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
  alert:   'bg-orange-500/20 border-orange-500/30 text-orange-400',
  info:    'bg-blue-500/20 border-blue-500/30 text-blue-400',
};

const PRIORITY_DOT: Record<number, string> = {
  3: 'bg-red-400',
  2: 'bg-amber-400',
  1: 'bg-blue-400',
  0: 'bg-white/20',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        fetch('/api/notifications?mode=list'),
        fetch('/api/notifications?mode=unread_count'),
      ]);
      const [listData, countData] = await Promise.all([listRes.json(), countRes.json()]);
      setNotifications(listData.notifications ?? []);
      setUnreadCount(countData.count ?? 0);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 30s
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function markRead(id: string) {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'read', id }),
    });
    setNotifications(n => n.map(x => x.id === id ? { ...x, read_at: new Date().toISOString() } : x));
    setUnreadCount(c => Math.max(0, c - 1));
  }

  async function dismiss(id: string) {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', id }),
    });
    setNotifications(n => n.filter(x => x.id !== id));
    setUnreadCount(c => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'read_all' }),
    });
    setNotifications(n => n.map(x => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (!open) loadNotifications(); }}
        style={{
          position: 'relative',
          width: 32, height: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8,
          background: open ? 'rgba(240,236,228,0.06)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'rgba(240,236,228,0.42)',
          transition: 'all 0.15s',
        }}
        aria-label="Notificações"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            style={{
              position: 'absolute', top: 3, right: 3,
              width: 14, height: 14,
              background: 'rgb(239,68,68)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: 'white',
              border: '1.5px solid #0a0c10',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'absolute', right: 0, top: 40,
              width: 360,
              background: '#0e1015',
              border: '1px solid rgba(240,236,228,0.10)',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              zIndex: 200,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid rgba(240,236,228,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'white', fontSize: 12, fontWeight: 600 }}>Notificações</span>
                {unreadCount > 0 && (
                  <span style={{
                    background: 'rgba(239,68,68,0.15)', color: 'rgb(248,113,113)',
                    fontSize: 10, fontWeight: 600,
                    padding: '1px 6px', borderRadius: 20,
                  }}>
                    {unreadCount} novas
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button" onClick={markAllRead}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(184,151,94,0.65)', fontSize: 10, fontWeight: 500,
                  }}
                >
                  Marcar todas lidas
                </button>
              )}
            </div>

            {/* Notification list */}
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {loading && notifications.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(240,236,228,0.22)', fontSize: 11 }}>
                  A carregar…
                </div>
              ) : notifications.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🔔</div>
                  <p style={{ color: 'rgba(240,236,228,0.28)', fontSize: 11 }}>Sem notificações</p>
                </div>
              ) : notifications.map((n) => (
                <motion.div
                  key={n.id}
                  layout
                  style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid rgba(240,236,228,0.04)',
                    background: n.read_at ? 'transparent' : 'rgba(154,124,74,0.04)',
                    cursor: 'pointer',
                  }}
                  onClick={() => { if (!n.read_at) markRead(n.id); }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      marginTop: 5, flexShrink: 0,
                      background: n.read_at ? 'rgba(240,236,228,0.10)' : (PRIORITY_DOT[n.priority] ?? 'rgba(240,236,228,0.18)'),
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <p style={{
                          color: n.read_at ? 'rgba(255,255,255,0.6)' : 'white',
                          fontSize: 11, fontWeight: n.read_at ? 400 : 500,
                          lineHeight: 1.4, margin: 0,
                        }}>
                          {n.title}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ color: 'rgba(240,236,228,0.18)', fontSize: 9 }}>
                            {timeAgo(n.created_at)}
                          </span>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'rgba(240,236,228,0.18)', fontSize: 12, padding: '0 2px',
                              lineHeight: 1,
                            }}
                          >×</button>
                        </div>
                      </div>
                      {n.message && (
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, margin: '2px 0 0', lineHeight: 1.4 }}>
                          {n.message}
                        </p>
                      )}
                      {n.action_url && n.action_label && (
                        <a
                          href={n.action_url}
                          onClick={e => { e.stopPropagation(); setOpen(false); }}
                          style={{
                            display: 'inline-block', marginTop: 4,
                            color: 'rgba(184,151,94,0.65)', fontSize: 10, fontWeight: 500,
                            textDecoration: 'none',
                          }}
                        >
                          {n.action_label} →
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: '8px 16px',
              borderTop: '1px solid rgba(240,236,228,0.06)',
              display: 'flex', justifyContent: 'center',
            }}>
              <a href="/activity" onClick={() => setOpen(false)}
                style={{ color: 'rgba(240,236,228,0.28)', fontSize: 10, textDecoration: 'none' }}>
                Ver toda a actividade →
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
