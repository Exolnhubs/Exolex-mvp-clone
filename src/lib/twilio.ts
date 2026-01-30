// ═══════════════════════════════════════════════════════════════
// Twilio SMS Service
// Handles sending OTP verification codes via SMS
// ═══════════════════════════════════════════════════════════════

import twilio from 'twilio'

// Twilio configuration from environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromPhone = process.env.TWILIO_PHONE_NUMBER

/**
 * Check if Twilio is properly configured with all required env variables.
 */
export function isTwilioConfigured(): boolean {
  return Boolean(accountSid && authToken && fromPhone)
}

/**
 * Send an OTP code via SMS using Twilio.
 *
 * @param to - Recipient phone number in E.164 format (e.g. +9665xxxxxxxx)
 * @param code - The 6-digit OTP code
 * @param purpose - The purpose of the OTP (for logging)
 * @returns Object with success status and optional error/messageId
 */
export async function sendOtpSms(
  to: string,
  code: string,
  purpose: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // If Twilio is not configured, fall back to console logging (development)
  if (!isTwilioConfigured()) {
    console.warn('[Twilio] Not configured — falling back to console logging')
    console.log('═══════════════════════════════════════')
    console.log(`[OTP] Code: ${code}`)
    console.log(`[OTP] Phone: ${to}`)
    console.log(`[OTP] Purpose: ${purpose}`)
    console.log('═══════════════════════════════════════')
    return { success: true, messageId: 'dev-fallback' }
  }

  try {
    const client = twilio(accountSid, authToken)

    const message = await client.messages.create({
      body: `رمز التحقق من ExoLex: ${code}\nصالح لمدة 5 دقائق. لا تشاركه مع أحد.`,
      from: fromPhone,
      to,
    })

    return { success: true, messageId: message.sid }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[Twilio] Failed to send SMS:', errorMessage)
    return { success: false, error: errorMessage }
  }
}
