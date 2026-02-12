'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js'

/**
 * Subscribe to Realtime INSERT events on a Supabase table.
 * Automatically cleans up the channel on unmount.
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

    const channel = supabase.channel(channelName)

    channel.on(
      'postgres_changes' as any,
      {
        event: 'INSERT',
        schema: 'public',
        table,
        ...(filter ? { filter } : {}),
      },
      (payload: RealtimePostgresInsertPayload<{ [key: string]: any }>) => {
        console.log(`[Realtime] ${channelName} received INSERT:`, payload.new)
        callbackRef.current(payload.new)
      }
    )

    channel.subscribe((status: string, err?: Error) => {
      console.log(`[Realtime] ${channelName} status: ${status}`, err || '')
      if (status === 'CHANNEL_ERROR') {
        console.error(`[Realtime] ${channelName} error - check that table "${table}" is added to supabase_realtime publication and RLS allows SELECT`)
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelName, table, filter, enabled])
}

/**
 * Subscribe to Realtime notification inserts for a specific recipient.
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

    const channel = supabase.channel(`notifications-${recipientId}`)

    channel.on(
      'postgres_changes' as any,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `${recipientField}=eq.${recipientId}`,
      },
      (payload: RealtimePostgresInsertPayload<{ [key: string]: any }>) => {
        console.log(`[Realtime] notifications received INSERT:`, payload.new)
        callbackRef.current(payload.new)
      }
    )

    channel.subscribe((status: string, err?: Error) => {
      console.log(`[Realtime] notifications-${recipientId} status: ${status}`, err || '')
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [recipientId, recipientField])
}
