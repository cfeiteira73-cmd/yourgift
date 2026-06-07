'use client';

// ── OMEGA PROTOCOL — S10: Realtime Engine — Connection Status Indicator ────────
//
// Tiny dot in the portal header showing live Supabase connection state.
// Subscribes to yg:realtime-status DOM events (no prop drilling needed).
//
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import type { RealtimeStatus } from './RealtimeWatcher';

export function RealtimeIndicator() {
  const [status, setStatus] = useState<RealtimeStatus>({ connected: false, reconnectAttempts: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show indicator after a brief delay (avoid flash on initial load)
    const timer = setTimeout(() => setVisible(true), 2500);

    function handler(e: Event) {
      setStatus((e as CustomEvent<RealtimeStatus>).detail);
    }
    window.addEventListener('yg:realtime-status', handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('yg:realtime-status', handler);
    };
  }, []);

  if (!visible) return null;

  const isConnected = status.connected;
  const isReconnecting = !isConnected && status.reconnectAttempts > 0;

  return (
    <div
      title={
        isConnected
          ? 'Realtime: conectado'
          : isReconnecting
          ? `Realtime: a reconectar (tentativa ${status.reconnectAttempts})`
          : 'Realtime: desconectado'
      }
      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'default', userSelect: 'none' }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: isConnected
            ? '#b8975e'
            : isReconnecting
            ? 'rgb(245,158,11)'
            : 'rgba(240,236,228,0.24)',
          boxShadow: isConnected
            ? '0 0 6px rgba(99,230,190,0.7)'
            : isReconnecting
            ? '0 0 6px rgba(245,158,11,0.6)'
            : 'none',
          animation: isConnected
            ? 'none'
            : isReconnecting
            ? 'pulse 1.4s ease-in-out infinite'
            : 'none',
          transition: 'background 300ms, box-shadow 300ms',
        }}
      />
      <span style={{ fontSize: '0.58rem', color: isConnected ? '#b8975e' : 'rgba(240,236,228,0.24)', fontWeight: 600 }}>
        {isConnected ? 'LIVE' : isReconnecting ? '…' : 'OFF'}
      </span>
    </div>
  );
}
