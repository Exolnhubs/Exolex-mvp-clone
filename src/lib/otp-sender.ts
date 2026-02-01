// ═══════════════════════════════════════════════════════════════
// Unified OTP Delivery Service
// Routes OTP delivery to the appropriate channel:
//   - sms:      Twilio SMS
//   - whatsapp: WhatsApp Cloud API (Meta)
//   - dev:      Console log only (for testing)
// ═══════════════════════════════════════════════════════════════

import { sendOtpSms } from '@/lib/twilio'
import { sendOtpWhatsApp } from '@/lib/whatsapp'

export type OtpChannel = 'sms' | 'whatsapp' | 'dev'

export interface OtpDeliveryResult {
  success: boolean
  channel: OtpChannel
  messageId?: string
  error?: string
}

/**
 * Send an OTP code through the specified channel.
 * Falls back gracefully: if the chosen channel is not configured,
 * it logs to console instead of failing silently.
 */
export async function sendOtp(
  to: string,
  code: string,
  purpose: string,
  channel: OtpChannel
): Promise<OtpDeliveryResult> {
  switch (channel) {
    case 'sms': {
      const result = await sendOtpSms(to, code, purpose)
      return { ...result, channel: 'sms' }
    }

    case 'whatsapp': {
      const result = await sendOtpWhatsApp(to, code, purpose)
      return { ...result, channel: 'whatsapp' }
    }

    case 'dev': {
      console.log('═══════════════════════════════════════')
      console.log(`[DEV OTP] Code: ${code}`)
      console.log(`[DEV OTP] Phone: ${to}`)
      console.log(`[DEV OTP] Purpose: ${purpose}`)
      console.log('═══════════════════════════════════════')
      return { success: true, channel: 'dev', messageId: 'dev-console' }
    }

    default: {
      return { success: false, channel, error: `Unknown channel: ${channel}` }
    }
  }
}
