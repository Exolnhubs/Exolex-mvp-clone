'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Subscribe to Realtime INSERT events on a Supabase table.
 * Automatically cleans up the channel on unmount.
 *
 * @param channelName - Unique channel identifier
 * @param table - Supabase table name
 * @param filter - Optional filter string (e.g. "request_id=eq.abc-123")
 * @param onInsert - Callback with the new row
 * @param enabled - Set to false to skip subscription
 */
export function useRealtimeInsert(
  channelName: string,
  table: string,
  filter: string | undefined,
  onInsert: (newRow: any) => void,
  enabled: boolean = true
) {
  const callbackRef = useRef(onInsert)
  callbackRef.current = onInsert

  useEffect(() => {
    if (!enabled) return

    const config: Record<string, any> = {
      event: 'INSERT',
      schema: 'public',
      table,
    }
    if (filter) {
      config.filter = filter
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', config, (payload: any) => {
        callbackRef.current(payload.new)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelName, table, filter, enabled])
}

/**
 * Subscribe to Realtime notification inserts for a specific recipient.
 * Calls onNewNotification whenever a new notification is inserted.
 *
 * @param recipientId - The user/member/lawyer ID to filter by
 * @param recipientField - Column name to filter on (default: "recipient_id")
 * @param onNewNotification - Callback with the new notification row
 */
export function useRealtimeNotifications(
  recipientId: string | null,
  recipientField: string,
  onNewNotification: (notification: any) => void
) {
  const callbackRef = useRef(onNewNotification)
  callbackRef.current = onNewNotification

  useEffect(() => {
    if (!recipientId) return

    const channel = supabase
      .channel(`notifications-${recipientId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `${recipientField}=eq.${recipientId}`,
      }, (payload: any) => {
        callbackRef.current(payload.new)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [recipientId, recipientField])
}
