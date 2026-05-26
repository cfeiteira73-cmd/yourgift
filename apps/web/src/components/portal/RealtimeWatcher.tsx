'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Props {
  clientId: string;
}

/**
 * Invisible component that subscribes to Supabase Realtime for orders + quotes
 * belonging to the current client. When a change comes in, it calls router.refresh()
 * so the server component re-fetches and CommandCenter updates with fresh data.
 */
export function RealtimeWatcher({ clientId }: Props) {
  const router = useRouter();
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  useEffect(() => {
    if (!clientId) return;

    const supabase = createClient();

    // Subscribe to orders + quotes changes for this client
    const channel = supabase
      .channel(`client-realtime-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          router.refresh();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [clientId, router]);

  // Invisible — no UI
  return null;
}
