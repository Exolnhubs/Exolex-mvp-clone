'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUserId } from '@/lib/cookies'
import Link from 'next/link'
import toast from 'react-hot-toast'
import MoyasarPaymentForm from '@/components/payment/MoyasarPaymentForm'

// ═══════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════
interface ExtraService {
  id: string
  name_ar: string
  name_en: string
  description_ar: string | null
  pricing_type: 'fixed' | 'quote'
  price: number
  icon: string | null
  category: {
    id: string
    name_ar: string
    color: string
    icon: string
  } | null
}

interface Member {
  id: string
  user_id: string
  member_code: string
}

export default function CheckoutPage() {
  const router = useRouter()
  const params = useParams()
  const serviceId = params.id as string

  const [service, setService] = useState<ExtraService | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)

  // حساب الضريبة والإجمالي
  const vatRate = 0.15
  const basePrice = service?.price || 0
  const vatAmount = basePrice * vatRate
  const totalAmount = basePrice + vatAmount

  useEffect(() => {
    const userId = getUserId()
    if (!userId) {
      router.push('/auth/login')
      return
    }

    const fetchData = async () => {
      // جلب بيانات العضو
      const { data: memberData } = await supabase
        .from('members')
        .select('id, user_id, member_code')
        .eq('user_id', userId)
        .single()

      if (memberData) setMember(memberData)

      // جلب بيانات الخدمة
      const { data: serviceData } = await supabase
        .from('extra_services')
        .select('*, category:categories(id, name_ar, color, icon)')
        .eq('id', serviceId)
        .single()

      if (serviceData) {
        setService(serviceData)
      } else {
        toast.error('الخدمة غير موجودة')
        router.push('/subscriber/extra-services')
      }

      setIsLoading(false)
    }

    fetchData()
  }, [serviceId, router])

  // ═══════════════════════════════════════════════════════════════
  // Proceed to payment — stores pending info and shows Moyasar form
  // ═══════════════════════════════════════════════════════════════
  const handleProceedToPayment = () => {
    if (!agreedToTerms) {
      toast.error('يجب الموافقة على الشروط والأحكام')
      return
    }
    if (!member || !service) return

    // Store pending payment details for the callback page
    sessionStorage.setItem('pending_payment', JSON.stringify({
      payment_type: 'extra_service',
      expected_amount: totalAmount,
      member_id: member.id,
      service_id: service.id,
    }))

    setShowPaymentForm(true)
  }

  // ═══════════════════════════════════════════════════════════════
  // تنسيق السعر
  // ═══════════════════════════════════════════════════════════════
  const formatPrice = (price: number) => {
    return price.toLocaleString('ar-SA', { minimumFractionDigits: 2 })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!service) return null

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/subscriber/extra-services"
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            ←
          </Link>
          <div>
            <h1 className="font-bold text-gray-800">إتمام الطلب</h1>
            <p className="text-sm text-gray-500">الدفع الآمن</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6">

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* تفاصيل الخدمة وطريقة الدفع */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className="md:col-span-2 space-y-6">

            {/* بطاقة الخدمة */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                  style={{ backgroundColor: `${service.category?.color || '#3B82F6'}20` }}
                >
                  {service.icon || service.category?.icon || '📄'}
                </div>
                <div className="flex-1">
                  <span
                    className="text-xs px-2 py-1 rounded-full text-white inline-block mb-2"
                    style={{ backgroundColor: service.category?.color || '#3B82F6' }}
                  >
                    {service.category?.name_ar || 'خدمة قانونية'}
                  </span>
                  <h2 className="text-xl font-bold text-gray-800 mb-2">{service.name_ar}</h2>
                  <p className="text-gray-600">{service.description_ar || 'خدمة قانونية متخصصة'}</p>
                </div>
              </div>
            </div>

            {/* طريقة الدفع — Moyasar Form */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>💳</span>
                {showPaymentForm ? 'أدخل بيانات البطاقة' : 'طريقة الدفع'}
              </h3>

              {showPaymentForm ? (
                <div>
                  <p className="text-sm text-gray-500 mb-4">
                    بطاقة ائتمان / مدى (Visa, Mastercard, Mada)
                  </p>
                  <MoyasarPaymentForm
                    amount={totalAmount}
                    description={`خدمة ${service.name_ar} - ExoLex`}
                    callbackUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/subscriber/payment/callback`}
                    metadata={{
                      payment_type: 'extra_service',
                      service_id: service.id,
                      member_id: member?.id || '',
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Moyasar */}
                  <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-blue-500 bg-blue-50">
                    <div className="w-5 h-5 rounded-full border-4 border-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">بطاقة ائتمان / مدى</p>
                      <p className="text-sm text-gray-500">Visa, Mastercard, Mada</p>
                    </div>
                    <div className="flex gap-2 text-2xl">💳</div>
                  </div>

                  {/* Tabby — coming soon */}
                  <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 opacity-50">
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">تابي - قسّمها على 4</p>
                      <p className="text-sm text-gray-500">ادفع {formatPrice(totalAmount / 4)} ر.س × 4 دفعات</p>
                    </div>
                    <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                      قريباً
                    </div>
                  </div>

                  {/* Tamara — coming soon */}
                  <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 opacity-50">
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">تمارا - قسّمها على 3</p>
                      <p className="text-sm text-gray-500">ادفع {formatPrice(totalAmount / 3)} ر.س × 3 دفعات</p>
                    </div>
                    <div className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-sm font-medium">
                      قريباً
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* الشروط والأحكام — only shown before payment form */}
            {!showPaymentForm && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="w-5 h-5 mt-1 text-blue-600 rounded"
                  />
                  <span className="text-gray-600">
                    أوافق على{' '}
                    <a href="#" className="text-blue-600 hover:underline">الشروط والأحكام</a>
                    {' '}و{' '}
                    <a href="#" className="text-blue-600 hover:underline">سياسة الخصوصية</a>
                    {' '}وأفهم أن هذه الخدمة غير قابلة للاسترداد بعد بدء العمل عليها.
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* ملخص الطلب */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
              <h3 className="font-bold text-gray-800 mb-4">ملخص الطلب</h3>

              <div className="space-y-3 pb-4 border-b">
                <div className="flex justify-between text-gray-600">
                  <span>سعر الخدمة</span>
                  <span>{formatPrice(basePrice)} ر.س</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>ضريبة القيمة المضافة (15%)</span>
                  <span>{formatPrice(vatAmount)} ر.س</span>
                </div>
              </div>

              <div className="flex justify-between py-4 text-lg font-bold">
                <span>الإجمالي</span>
                <span className="text-blue-600">{formatPrice(totalAmount)} ر.س</span>
              </div>

              {/* Show proceed button only before payment form is visible */}
              {!showPaymentForm && (
                <button
                  onClick={handleProceedToPayment}
                  disabled={!agreedToTerms}
                  className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
                    !agreedToTerms
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg'
                  }`}
                >
                  متابعة الدفع — {formatPrice(totalAmount)} ر.س
                </button>
              )}

              <p className="text-center text-xs text-gray-500 mt-4 flex items-center justify-center gap-1">
                <span>🔒</span> دفع آمن ومشفر
              </p>

              {/* معلومات ما بعد الدفع */}
              <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <h4 className="font-medium text-gray-800 mb-3 text-sm flex items-center gap-2">
                  <span>✨</span>
                  ماذا يحدث بعد الدفع؟
                </h4>
                <ul className="text-xs text-gray-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>يتم إنشاء طلبك فوراً ويظهر في &quot;طلباتي&quot;</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>يُعيّن محامي متخصص خلال 24 ساعة كحد أقصى</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>ستصلك إشعارات بكل تحديث على طلبك</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>يمكنك التواصل مع المحامي عبر المنصة</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
