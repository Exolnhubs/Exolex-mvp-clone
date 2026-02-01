// ═══════════════════════════════════════════════════════════════
// WhatsApp Cloud API Service
// Sends OTP verification codes via WhatsApp Business Platform
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
// ═══════════════════════════════════════════════════════════════

const GRAPH_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0'

function getConfig() {
  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    templateName: process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'exolex_otp_code',
  }
}

/**
 * Check if WhatsApp Cloud API is properly configured.
 */
export function isWhatsAppConfigured(): boolean {
  const { phoneNumberId, accessToken } = getConfig()
  return Boolean(phoneNumberId && accessToken)
}

/**
 * Send an OTP code via WhatsApp using the Cloud API authentication template.
 *
 * @param to - Recipient phone number in E.164 format (e.g. +9665xxxxxxxx)
 * @param code - The 6-digit OTP code
 * @param purpose - The purpose of the OTP (for logging)
 * @returns Object with success status and optional error/messageId
 */
export async function sendOtpWhatsApp(
  to: string,
  code: string,
  purpose: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isWhatsAppConfigured()) {
    console.warn('[WhatsApp] Not configured — falling back to console logging')
    console.log('═══════════════════════════════════════')
    console.log(`[OTP-WhatsApp] Code: ${code}`)
    console.log(`[OTP-WhatsApp] Phone: ${to}`)
    console.log(`[OTP-WhatsApp] Purpose: ${purpose}`)
    console.log('═══════════════════════════════════════')
    return { success: true, messageId: 'dev-fallback-whatsapp' }
  }

  const { phoneNumberId, accessToken, templateName } = getConfig()

  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace('+', ''), // WhatsApp API expects without leading +
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'ar', policy: 'deterministic' },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: code }],
            },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [{ type: 'text', text: code }],
            },
          ],
        },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      const errorMsg = data?.error?.message || JSON.stringify(data)
      console.error('[WhatsApp] API error:', errorMsg)
      return { success: false, error: errorMsg }
    }

    const messageId = data?.messages?.[0]?.id || 'unknown'
    return { success: true, messageId }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[WhatsApp] Failed to send OTP:', errorMessage)
    return { success: false, error: errorMessage }
  }
}
