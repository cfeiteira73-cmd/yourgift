'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AuthState, AuthProvider, AuthStateEvent, canTransition } from '@/lib/auth/auth-state';

interface UseAuthMachineReturn {
  state: AuthState;
  provider: AuthProvider | null;
  error: string | null;
  history: AuthStateEvent[];
  transition: (to: AuthState, meta?: Partial<AuthStateEvent>) => void;
  reset: () => void;
}

export function useAuthMachine(initialState: AuthState = 'IDLE'): UseAuthMachineReturn {
  const [state, setState] = useState<AuthState>(initialState);
  const [provider, setProvider] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AuthStateEvent[]>([]);
  const stateRef = useRef<AuthState>(initialState);

  const transition = useCallback((to: AuthState, meta: Partial<AuthStateEvent> = {}) => {
    const from = stateRef.current;
    if (!canTransition(from, to)) {
      console.warn(`[AuthMachine] Invalid transition: ${from} → ${to}`);
      return;
    }
    const event: AuthStateEvent = {
      state: to,
      timestamp: Date.now(),
      provider: meta.provider,
      error: meta.error,
      attemptId: meta.attemptId,
    };
    stateRef.current = to;
    setState(to);
    if (meta.provider) setProvider(meta.provider);
    if (meta.error) setError(meta.error);
    else if (!['CALLBACK_FAILED', 'SESSION_INVALID', 'PROVIDER_ERROR'].includes(to)) setError(null);
    setHistory((h) => [...h.slice(-19), event]); // keep last 20 events
  }, []);

  const reset = useCallback(() => {
    stateRef.current = 'IDLE';
    setState('IDLE');
    setProvider(null);
    setError(null);
  }, []);

  // Listen to Supabase auth events and map to machine states
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') transition('LOGGED_IN');
      if (event === 'SIGNED_OUT') reset();
      if (event === 'TOKEN_REFRESHED') {
        if (stateRef.current !== 'LOGGED_IN') transition('SESSION_VALIDATED');
      }
    });
    return () => subscription.unsubscribe();
  }, [transition, reset]);

  return { state, provider, error, history, transition, reset };
}
