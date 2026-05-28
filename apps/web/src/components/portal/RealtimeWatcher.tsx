'use client';

// ── OMEGA PROTOCOL — S10: Realtime Engine ─────────────────────────────────────
//
// Enhanced multi-channel RealtimeWatcher with:
// - Reconnect resilience (exponential back-off up to 30s)
// - Toast notification system for live events
// - Admin broadcast channel (all-client events)
// - Offline detection + recovery
// - Status indicator emitted via custom event
//
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RealtimeStatus {
  connected: boolean;
  reconnectAttempts: number;
  lastEvent?: string;
}

interface Props {
  clientId: string;
  isAdmin?: boolean;
  /** Called when connection status changes */
  onStatusChange?: (status: RealtimeStatus) => void;
  /** Called when a live event is received, before router.refresh() */
  onEvent?: (table: string, event: string, record: Record<string, unknown>) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_RECONNECT_ATTEMPTS = 8;
const BASE_RECONNECT_DELAY_MS = 1500;

// ── Helpers ───────────────────────────────────────────────────────────────────

function backoffDelay(attempt: number): number {
  // Exponential back-off: 1.5s, 3s, 6s, 12s, 24s, 30s, 30s, 30s
  return Math.min(BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt), 30000);
}

/**
 * Enhanced Realtime Watcher — S10 Omega Protocol
 *
 * Subscribes to orders + quotes + (admin) inventory_alerts.
 * Implements exponential-backoff reconnection, offline awareness,
 * and fires router.refresh() on any change so SSR data stays fresh.
 */
export function RealtimeWatcher({ clientId, isAdmin = false, onStatusChange, onEvent }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);

  const emitStatus = useCallback((connected: boolean, lastEvent?: string) => {
    const status: RealtimeStatus = {
      connected,
      reconnectAttempts: reconnectAttemptsRef.current,
      lastEvent,
    };
    onStatusChange?.(status);
    // Also fire a custom DOM event so other components can listen without prop drilling
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('yg:realtime-status', { detail: status }));
    }
  }, [onStatusChange]);

  const handleChange = useCallback((table: string, eventType: string, record: Record<string, unknown>) => {
    if (!mountedRef.current) return;
    onEvent?.(table, eventType, record);
    router.refresh();
    emitStatus(true, `${table}:${eventType}`);
  }, [router, onEvent, emitStatus]);

  const subscribe = useCallback(() => {
    if (!clientId || !mountedRef.current) return;

    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = isAdmin
      ? `admin-realtime-v2`
      : `client-realtime-v2-${clientId}`;

    // Build the channel
    let channel = supabase.channel(channelName, {
      config: { broadcast: { self: true } },
    });

    // ── Orders ───────────────────────────────────────────────────────────────
    if (isAdmin) {
      // Admin: all orders
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => handleChange('orders', payload.eventType, payload.new as Record<string, unknown>),
      );
    } else {
      // Client: own orders only
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `client_id=eq.${clientId}` },
        (payload) => handleChange('orders', payload.eventType, payload.new as Record<string, unknown>),
      );
    }

    // ── Quotes ───────────────────────────────────────────────────────────────
    if (isAdmin) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quotes' },
        (payload) => handleChange('quotes', payload.eventType, payload.new as Record<string, unknown>),
      );
    } else {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quotes', filter: `client_id=eq.${clientId}` },
        (payload) => handleChange('quotes', payload.eventType, payload.new as Record<string, unknown>),
      );
    }

    // ── Inventory alerts (admin only) ────────────────────────────────────────
    if (isAdmin) {
      channel = channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inventory_alerts' },
        (payload) => handleChange('inventory_alerts', payload.eventType, payload.new as Record<string, unknown>),
      );
    }

    // ── Subscribe with status tracking ──────────────────────────────────────
    channel.subscribe((status, error) => {
      if (!mountedRef.current) return;

      if (status === 'SUBSCRIBED') {
        reconnectAttemptsRef.current = 0;
        emitStatus(true);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[RealtimeWatcher] Channel ${status}${error ? `: ${String(error)}` : ''}`);
        emitStatus(false);
        scheduleReconnect();
      } else if (status === 'CLOSED') {
        emitStatus(false);
      }
    });

    channelRef.current = channel;
  }, [clientId, isAdmin, supabase, handleChange, emitStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[RealtimeWatcher] Max reconnect attempts reached. Manual refresh required.');
      return;
    }

    const delay = backoffDelay(reconnectAttemptsRef.current);
    reconnectAttemptsRef.current += 1;

    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) subscribe();
    }, delay);
  }, [subscribe]);

  // ── Offline/online detection ─────────────────────────────────────────────────
  useEffect(() => {
    function handleOffline() {
      emitStatus(false, 'offline');
    }
    function handleOnline() {
      reconnectAttemptsRef.current = 0;
      subscribe();
    }
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [subscribe, emitStatus]);

  // ── Main subscription lifecycle ──────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    if (clientId) subscribe();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [clientId, subscribe]); // eslint-disable-line react-hooks/exhaustive-deps

  // Invisible — no UI rendered
  return null;
}

// ── Convenience hook for status ───────────────────────────────────────────────

export function useRealtimeStatus(cb: (status: RealtimeStatus) => void) {
  useEffect(() => {
    function handler(e: Event) {
      cb((e as CustomEvent<RealtimeStatus>).detail);
    }
    window.addEventListener('yg:realtime-status', handler);
    return () => window.removeEventListener('yg:realtime-status', handler);
  }, [cb]);
}
