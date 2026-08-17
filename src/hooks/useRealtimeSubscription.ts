import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface RealtimeSubscriptionOptions {
  tables: string[];
  channelName: string;
  onEvent?: (payload: any) => void;
  callback: () => void | Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Reusable Supabase Realtime hook that safely subscribes to postgres_changes (INSERT, UPDATE, DELETE)
 * across specified tables, debounces rapid successive updates, and cleans up channels on unmount.
 */
export function useRealtimeSubscription({
  tables,
  channelName,
  onEvent,
  callback,
  debounceMs = 250,
  enabled = true,
}: RealtimeSubscriptionOptions) {
  const callbackRef = useRef(callback);
  const onEventRef = useRef(onEvent);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
    onEventRef.current = onEvent;
  });

  const tablesKey = JSON.stringify(tables);

  useEffect(() => {
    if (!enabled || !tables || tables.length === 0) return;

    const triggerCallback = (payload?: any) => {
      if (onEventRef.current && payload) {
        onEventRef.current(payload);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        callbackRef.current();
      }, debounceMs);
    };

    // Ensure unique channel identifier
    const uniqueChannelId = `${channelName}_${Math.random().toString(36).substring(2, 7)}`;
    let channel = supabase.channel(uniqueChannelId);

    tables.forEach((table) => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          triggerCallback(payload);
        }
      );
    });

    channel.subscribe();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [channelName, enabled, tablesKey, debounceMs]);
}
