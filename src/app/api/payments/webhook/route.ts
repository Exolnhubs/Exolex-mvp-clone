// ═══════════════════════════════════════════════════════════════
// API: Moyasar Webhook
// POST /api/payments/webhook
// Receives real-time payment status events from Moyasar
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { MoyasarWebhookPayload } from '@/lib/moyasar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const payload: MoyasarWebhookPayload = await request.json()

    // ── 1. Verify webhook secret ────────────────────────────
    const webhookSecret = process.env.MOYASAR_WEBHOOK_SECRET
    if (webhookSecret && payload.secret_token !== webhookSecret) {
      console.error('[Webhook] Invalid secret token')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type, data: payment } = payload

    console.log(`[Webhook] Received ${type} for payment ${payment.id}`)

    // ── 2. Handle event types ───────────────────────────────
    switch (type) {
      case 'payment_paid': {
        // Update payment record status to completed
        const { error } = await supabase
          .from('payments')
          .update({
            status: 'completed',
            metadata: {
              moyasar_id: payment.id,
              card_company: payment.source?.company || null,
              card_last4: payment.source?.number || null,
              webhook_event: type,
              webhook_received_at: new Date().toISOString(),
            },
          })
          .eq('payment_reference', payment.id)

        if (error) {
          // The payment might be stored with a different reference — try metadata match
          await supabase
            .from('payments')
            .update({ status: 'completed' })
            .contains('metadata', { moyasar_id: payment.id } as never)
        }

        break
      }

      case 'payment_failed': {
        await supabase
          .from('payments')
          .update({
            status: 'failed',
            metadata: {
              moyasar_id: payment.id,
              failure_message: payment.source?.message || 'Unknown',
              webhook_event: type,
              webhook_received_at: new Date().toISOString(),
            },
          })
          .eq('payment_reference', payment.id)

        break
      }

      case 'payment_refunded': {
        await supabase
          .from('payments')
          .update({
            status: 'refunded',
            metadata: {
              moyasar_id: payment.id,
              refunded_amount: payment.refunded,
              webhook_event: type,
              webhook_received_at: new Date().toISOString(),
            },
          })
          .eq('payment_reference', payment.id)

        break
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${type}`)
    }

    // Always return 200 so Moyasar doesn't retry
    return NextResponse.json({ received: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Webhook] Processing error:', message)
    // Return 200 even on internal errors to prevent webhook retries for bad payloads
    return NextResponse.json({ received: true, error: 'Internal processing error' })
  }
}
