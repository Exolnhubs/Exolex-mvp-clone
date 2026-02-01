// ═══════════════════════════════════════════════════════════════
// Moyasar Payment Gateway - Server-side helpers
// API v1 · https://docs.moyasar.com
// ═══════════════════════════════════════════════════════════════

const MOYASAR_API = 'https://api.moyasar.com/v1'

function getSecretKey(): string {
  const key = process.env.MOYASAR_SECRET_KEY
  if (!key) throw new Error('MOYASAR_SECRET_KEY is not configured')
  return key
}

function authHeader(): string {
  // Moyasar uses HTTP Basic Auth: secret key as username, empty password
  return 'Basic ' + Buffer.from(getSecretKey() + ':').toString('base64')
}

// ─── Types ──────────────────────────────────────────────────

export interface MoyasarPayment {
  id: string
  status: 'initiated' | 'paid' | 'failed' | 'authorized' | 'captured' | 'refunded' | 'voided'
  amount: number          // in halalas (smallest unit)
  fee: number
  currency: string
  refunded: number
  refunded_at: string | null
  captured: number
  captured_at: string | null
  voided_at: string | null
  description: string
  amount_format: string
  fee_format: string
  refunded_format: string
  captured_format: string
  invoice_id: string | null
  ip: string | null
  callback_url: string
  created_at: string
  updated_at: string
  metadata: Record<string, string> | null
  source: {
    type: string
    company: string | null
    name: string | null
    number: string | null
    gateway_id: string | null
    reference_number: string | null
    token: string | null
    message: string | null
    transaction_url: string | null
  }
}

export interface MoyasarWebhookPayload {
  id: string
  type: string
  data: MoyasarPayment
  secret_token?: string
}

// ─── API Functions ──────────────────────────────────────────

/**
 * Fetch a payment by ID from the Moyasar API.
 * Used to verify payment status after 3DS callback redirect.
 */
export async function fetchPayment(paymentId: string): Promise<MoyasarPayment> {
  const res = await fetch(`${MOYASAR_API}/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: { Authorization: authHeader() },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Moyasar GET /payments/${paymentId} failed (${res.status}): ${body}`)
  }

  return res.json()
}

/**
 * Verify a payment is legitimate:
 * - status is "paid"
 * - amount matches expected (in halalas)
 * - currency matches expected
 */
export function verifyPayment(
  payment: MoyasarPayment,
  expectedAmountHalalas: number,
  expectedCurrency = 'SAR'
): { valid: boolean; reason?: string } {
  if (payment.status !== 'paid') {
    return { valid: false, reason: `Payment status is "${payment.status}", expected "paid"` }
  }
  if (payment.amount !== expectedAmountHalalas) {
    return { valid: false, reason: `Amount mismatch: got ${payment.amount}, expected ${expectedAmountHalalas}` }
  }
  if (payment.currency !== expectedCurrency) {
    return { valid: false, reason: `Currency mismatch: got ${payment.currency}, expected ${expectedCurrency}` }
  }
  return { valid: true }
}

/**
 * Convert SAR (riyals) to halalas for Moyasar API.
 * Moyasar expects amounts in the smallest currency unit.
 */
export function toHalalas(sar: number): number {
  return Math.round(sar * 100)
}

/**
 * Convert halalas back to SAR for display.
 */
export function toSAR(halalas: number): number {
  return halalas / 100
}

/**
 * Check if Moyasar is configured with the required env variables.
 */
export function isMoyasarConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY &&
    process.env.MOYASAR_SECRET_KEY
  )
}
