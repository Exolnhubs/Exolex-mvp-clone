'use client'

// ═══════════════════════════════════════════════════════════════
// Moyasar Payment Form Component
// Loads the Moyasar CDN script and renders the drop-in form.
// Docs: https://docs.moyasar.com/guides/card-payments/basic-integration
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

// Extend window to include Moyasar global
declare global {
  interface Window {
    Moyasar?: {
      init: (config: MoyasarConfig) => void
    }
  }
}

interface MoyasarConfig {
  element: string
  amount: number          // in halalas
  currency: string
  description: string
  publishable_api_key: string
  callback_url: string
  methods: string[]
  supported_networks?: string[]
  metadata?: Record<string, string>
  on_completed?: (payment: MoyasarCallbackPayment) => void
}

export interface MoyasarCallbackPayment {
  id: string
  status: string
  amount: number
  currency: string
  description: string
}

interface MoyasarPaymentFormProps {
  /** Amount in SAR (e.g. 499.00) — will be converted to halalas internally */
  amount: number
  /** Description shown on payment page / bank statement */
  description: string
  /** URL to redirect after 3DS completes */
  callbackUrl: string
  /** Metadata to attach to the payment (e.g. member_id, package_id) */
  metadata?: Record<string, string>
  /** Called when payment is completed (before 3DS redirect) */
  onCompleted?: (payment: MoyasarCallbackPayment) => void
}

const MOYASAR_CSS = 'https://cdn.moyasar.com/mpf/1.14.0/moyasar.css'
const MOYASAR_JS = 'https://cdn.moyasar.com/mpf/1.14.0/moyasar.js'
const FORM_ELEMENT_ID = 'moyasar-payment-form'

export default function MoyasarPaymentForm({
  amount,
  description,
  callbackUrl,
  metadata,
  onCompleted,
}: MoyasarPaymentFormProps) {
  const [scriptReady, setScriptReady] = useState(false)
  const initialized = useRef(false)

  // Initialize the form once the script is loaded
  useEffect(() => {
    if (!scriptReady || initialized.current) return
    if (!window.Moyasar) return

    const publishableKey = process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY
    if (!publishableKey) {
      console.error('[Moyasar] NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY is not set')
      return
    }

    // Convert SAR to halalas
    const amountHalalas = Math.round(amount * 100)

    window.Moyasar.init({
      element: `#${FORM_ELEMENT_ID}`,
      amount: amountHalalas,
      currency: 'SAR',
      description,
      publishable_api_key: publishableKey,
      callback_url: callbackUrl,
      methods: ['creditcard'],
      supported_networks: ['visa', 'mastercard', 'mada'],
      metadata,
      on_completed: onCompleted,
    })

    initialized.current = true
  }, [scriptReady, amount, description, callbackUrl, metadata, onCompleted])

  return (
    <>
      {/* Load Moyasar CSS */}
      <link rel="stylesheet" href={MOYASAR_CSS} />

      {/* Load Moyasar JS via next/script for proper loading */}
      <Script
        src={MOYASAR_JS}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />

      {/* Payment form container — Moyasar renders into this div */}
      <div id={FORM_ELEMENT_ID} />
    </>
  )
}
