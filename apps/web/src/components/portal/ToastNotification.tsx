'use client';

// ── OMEGA PROTOCOL — S10: Realtime Engine — Toast Notification System ─────────
//
// Live toast notifications for realtime events.
// Subscribes to the yg:realtime-status DOM event from RealtimeWatcher.
// Also exposes a global `window.ygToast(...)` API for imperative use.
//
// Usage:
//   <ToastContainer />   — mount once in PortalLayout
//   window.ygToast({ type: 'success', message: 'Encomenda actualizada!' })
//
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'info' | 'warning' | 'error' | 'realtime';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  sub?: string;
  duration?: number; // ms, default 4000
}

// Extend Window for global imperative API
declare global {
  interface Window {
    ygToast?: (toast: Omit<Toast, 'id'>) => void;
  }
}

const TOAST_ICONS: Record<ToastType, string> = {
  success:  '✅',
  info:     '💡',
  warning:  '⚠️',
  error:    '🚨',
  realtime: '⚡',
};

const TOAST_COLORS: Record<ToastType, { border: string; bg: string; text: string }> = {
  success:  { border: 'rgba(99,230,190,0.3)',  bg: 'rgba(184,151,94,0.08)',  text: '#b8975e' },
  info:     { border: 'rgba(154,124,74,0.28)',  bg: 'rgba(154,124,74,0.08)',  text: '#d4b47a' },
  warning:  { border: 'rgba(245,158,11,0.3)',  bg: 'rgba(245,158,11,0.08)',  text: 'rgb(245,158,11)' },
  error:    { border: 'rgba(239,68,68,0.3)',   bg: 'rgba(239,68,68,0.08)',   text: 'rgb(239,68,68)' },
  realtime: { border: 'rgba(116,231,255,0.3)', bg: 'rgba(116,231,255,0.08)', text: '#b8975e' },
};

let toastIdCounter = 0;
function genId() { return `toast-${++toastIdCounter}-${Date.now()}`; }

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) { clearTimeout(t); timersRef.current.delete(id); }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = genId();
    const duration = toast.duration ?? 4200;
    setToasts(prev => {
      // Max 5 toasts at once — remove oldest if needed
      const next = [...prev, { ...toast, id }];
      return next.slice(-5);
    });
    const timer = setTimeout(() => dismiss(id), duration);
    timersRef.current.set(id, timer);
  }, [dismiss]);

  // Register global imperative API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.ygToast = addToast;
      return () => { delete window.ygToast; };
    }
  }, [addToast]);

  // Listen to realtime status events
  useEffect(() => {
    function handler(e: Event) {
      const { connected, lastEvent, reconnectAttempts } = (e as CustomEvent).detail as {
        connected: boolean; lastEvent?: string; reconnectAttempts: number;
      };

      if (!connected && reconnectAttempts === 1) {
        addToast({ type: 'warning', message: 'Conexão realtime interrompida', sub: 'A tentar reconectar…', duration: 5000 });
      } else if (connected && lastEvent) {
        // Translate event to friendly message
        const eventMessages: Record<string, { msg: string; sub?: string }> = {
          'orders:INSERT': { msg: 'Nova encomenda criada', sub: 'Actualizado em tempo real' },
          'orders:UPDATE': { msg: 'Encomenda actualizada', sub: 'Estado alterado' },
          'quotes:INSERT': { msg: 'Novo orçamento submetido', sub: 'Actualizado em tempo real' },
          'quotes:UPDATE': { msg: 'Orçamento actualizado', sub: 'Estado alterado' },
          'inventory_alerts:INSERT': { msg: '⚠️ Alerta de inventário', sub: 'Verificar stock' },
        };
        const ev = eventMessages[lastEvent];
        if (ev) {
          addToast({ type: 'realtime', message: ev.msg, sub: ev.sub, duration: 3500 });
        }
      }
    }

    window.addEventListener('yg:realtime-status', handler);
    return () => window.removeEventListener('yg:realtime-status', handler);
  }, [addToast]);

  return (
    <div
      aria-live="polite"
      aria-label="Notificações"
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        right: '1.25rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        pointerEvents: 'none',
        maxWidth: '360px',
        width: '100%',
      }}
    >
      <AnimatePresence mode="sync">
        {toasts.map(toast => {
          const colors = TOAST_COLORS[toast.type];
          return (
            <motion.div
              key={toast.id}
              role="status"
              aria-atomic="true"
              initial={{ opacity: 0, x: 48, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 48, scale: 0.9, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              onClick={() => dismiss(toast.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.625rem',
                padding: '0.75rem 0.875rem',
                background: 'rgba(7,17,31,0.95)',
                border: `1px solid ${colors.border}`,
                borderLeft: `3px solid ${colors.text}`,
                borderRadius: '12px',
                backdropFilter: 'blur(20px)',
                boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(240,236,228,0.04)`,
                cursor: 'pointer',
                pointerEvents: 'auto',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '1px' }}>{TOAST_ICONS[toast.type]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(240,236,228,0.75)', lineHeight: 1.3 }}>{toast.message}</div>
                {toast.sub && <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.42)', marginTop: '0.15rem' }}>{toast.sub}</div>}
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); dismiss(toast.id); }}
                aria-label="Fechar notificação"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,236,228,0.24)', fontSize: '0.8rem', padding: '0', flexShrink: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
