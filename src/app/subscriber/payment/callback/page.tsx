'use client'

// ═══════════════════════════════════════════════════════════════
// Payment Callback Page
// Moyasar redirects here after 3DS:
//   /subscriber/payment/callback?id=PAY_ID&status=paid
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Status = 'verifying' | 'success' | 'failed'

export default function PaymentCallbackPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<Status>('verifying')
  const [message, setMessage] = useState('')
  const [ticketNumber, setTicketNumber] = useState<string | null>(null)
  const [paymentType, setPaymentType] = useState<string | null>(null)

  useEffect(() => {
    const paymentId = searchParams.get('id')
    const moyasarStatus = searchParams.get('status')

    // Retrieve pending payment details from sessionStorage
    const pendingRaw = sessionStorage.getItem('pending_payment')
    if (!pendingRaw || !paymentId) {
      setStatus('failed')
      setMessage('بيانات الدفع غير مكتملة')
      return
    }

    const pending = JSON.parse(pendingRaw)
    setPaymentType(pending.payment_type)

    // If Moyasar already indicates failure, skip verification
    if (moyasarStatus === 'failed') {
      setStatus('failed')
      setMessage('فشلت عملية الدفع. لم يتم خصم أي مبلغ.')
      sessionStorage.removeItem('pending_payment')
      return
    }

    // Verify with our backend
    const verify = async () => {
      try {
        const res = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_id: paymentId,
            expected_amount: pending.expected_amount,
            payment_type: pending.payment_type,
            member_id: pending.member_id,
            package_id: pending.package_id || null,
            service_id: pending.service_id || null,
          }),
        })

        const result = await res.json()

        if (result.success) {
          setStatus('success')
          setMessage(result.message || 'تمت العملية بنجاح')
          if (result.ticket_number) setTicketNumber(result.ticket_number)
        } else {
          setStatus('failed')
          setMessage(result.error || 'فشل التحقق من الدفع')
        }
      } catch {
        setStatus('failed')
        setMessage('حدث خطأ في الاتصال بالخادم')
      } finally {
        sessionStorage.removeItem('pending_payment')
      }
    }

    verify()
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {/* ── Verifying ────────────────────────────────────── */}
        {status === 'verifying' && (
          <>
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h1 className="text-xl font-bold text-gray-800 mb-2">جاري التحقق من الدفع</h1>
            <p className="text-gray-500">يرجى الانتظار...</p>
          </>
        )}

        {/* ── Success ──────────────────────────────────────── */}
        {status === 'success' && (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">تم الدفع بنجاح</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            {ticketNumber && (
              <p className="text-sm text-gray-500 mb-6">
                رقم الطلب: <span className="font-bold text-gray-800">{ticketNumber}</span>
              </p>
            )}
            {paymentType === 'subscription' ? (
              <Link
                href="/subscriber/dashboard"
                className="inline-block w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
              >
                الذهاب للوحة التحكم
              </Link>
            ) : (
              <Link
                href="/subscriber/requests"
                className="inline-block w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                متابعة طلباتي
              </Link>
            )}
          </>
        )}

        {/* ── Failed ───────────────────────────────────────── */}
        {status === 'failed' && (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">فشل الدفع</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => router.back()}
              className="inline-block w-full bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-700 transition-colors"
            >
              العودة والمحاولة مرة أخرى
            </button>
          </>
        )}
      </div>
    </div>
  )
}
