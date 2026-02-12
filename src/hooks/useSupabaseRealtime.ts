'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Realtime chat hook using Supabase Broadcast.
 * Both parties join the same channel. When one sends a message,
 * the other receives it instantly via WebSocket broadcast.
 *
 * Returns a `broadcast` function to send messages to the channel.
 */
export function useRealtimeChat(
  requestId: string | null,
  eventName: string,
  onMessage: (msg: any) => void,
  enabled: boolean = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const callbackRef = useRef(onMessage)
  callbackRef.current = onMessage

  useEffect(() => {
    if (!enabled || !requestId) return

    const channelName = `chat-${eventName}-${requestId}`
    const channel = supabase.channel(channelName)

    channel.on('broadcast', { event: 'new-message' }, (payload: any) => {
      console.log(`[Broadcast] ${channelName} received:`, payload.payload)
      callbackRef.current(payload.payload)
    })

    channel.subscribe((status: string, err?: Error) => {
      console.log(`[Broadcast] ${channelName} status: ${status}`, err || '')
    })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [requestId, eventName, enabled])

  const broadcast = useCallback((message: any) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'new-message',
        payload: message,
      })
    }
  }, [])

  return { broadcast }
}

/**
 * Keep the old hooks for notification badges (they work on some setups).
 * Can be removed once broadcast is confirmed working everywhere.
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
      (payload: any) => {
        callbackRef.current(payload.new)
      }
    )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [recipientId, recipientField])
}
