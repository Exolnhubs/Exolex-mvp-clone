'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import toast from 'react-hot-toast'

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

type PaymentMethod = 'moyasar' | 'tabby' | 'tamara'

export default function CheckoutPage() {
  const router = useRouter()
  const params = useParams()
  const serviceId = params.id as string

  const [service, setService] = useState<ExtraService | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('moyasar')
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // حساب الضريبة والإجمالي
  const vatRate = 0.15
  const basePrice = service?.price || 0
  const vatAmount = basePrice * vatRate
  const totalAmount = basePrice + vatAmount

  useEffect(() => {
    const userId = localStorage.getItem('exolex_user_id')
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
  // معالجة الدفع (محاكاة)
  // ═══════════════════════════════════════════════════════════════
  const handlePayment = async () => {
    if (!agreedToTerms) {
      toast.error('يجب الموافقة على الشروط والأحكام')
      return
    }

    if (!member || !service) return

    setIsProcessing(true)

    try {
      // 1. توليد رقم الطلب من النظام المركزي
      const { data: ticketData, error: ticketError } = await supabase
        .rpc('generate_sequence_number', { p_code: 'SVC' })

      if (ticketError) throw ticketError
      const ticketNumber = ticketData

      // 2. إنشاء الطلب في service_requests
      const { data: requestData, error: requestError } = await supabase
        .from('service_requests')
        .insert({
          ticket_number: ticketNumber,
          member_id: member.id,
          request_type: 'extra_service',
          source: 'extra_services_page',
          extra_service_id: service.id,
          category_id: service.category?.id,
          title: service.name_ar,
          description: service.description_ar || service.name_ar,
          status: 'pending_assignment',
          priority: 'normal',
          base_price: basePrice,
          vat_amount: vatAmount,
          total_amount: totalAmount,
          sla_hours: 24,
          sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single()

      if (requestError) throw requestError

      // 3. توليد رقم الدفعة
      const { data: paymentNumber } = await supabase
        .rpc('generate_sequence_number', { p_code: 'PAY' })

      // 4. إنشاء سجل الدفع
      await supabase.from('payments').insert({
        payment_reference: paymentNumber,
        member_id: member.id,
        request_id: requestData.id,
        amount: totalAmount,
        payment_method: paymentMethod,
        status: 'completed',
        
      })

      // 5. إرسال إشعار للذراع القانوني (أولوية)
      const { data: legalArmLawyers } = await supabase
        .from('lawyers')
        .select('user_id')
        .eq('lawyer_type', 'legal_arm')
        .eq('status', 'active')

      if (legalArmLawyers && legalArmLawyers.length > 0) {
        const notifications = legalArmLawyers.map(lawyer => ({
          user_id: lawyer.user_id,
          notification_type: 'new_request',
          title_ar: '🔔 طلب خدمة جديد (أولوية)',
          title_en: 'New Service Request (Priority)',
          body_ar: `طلب جديد: ${service.name_ar} - لديك أولوية القبول لمدة ساعة`,
          body_en: `New request: ${service.name_en || service.name_ar}`,
          action_url: `/legal-arm-lawyer/requests/${requestData.id}`,
          action_type: 'view_request',
          reference_type: 'service_request',
          reference_id: requestData.id,
          priority: 'high',
          send_push: true,
        }))

        await supabase.from('notifications').insert(notifications)
      }

      // 6. إشعار للمحامين المستقلين والشركاء (متأخر ساعة)
      const { data: otherLawyers } = await supabase
        .from('lawyers')
        .select('user_id')
        .neq('lawyer_type', 'legal_arm')
        .eq('status', 'active')

      if (otherLawyers && otherLawyers.length > 0) {
        const delayedNotifications = otherLawyers.map(lawyer => ({
          user_id: lawyer.user_id,
          notification_type: 'new_request',
          title_ar: '🔔 طلب خدمة جديد',
          title_en: 'New Service Request',
          body_ar: `طلب جديد متاح: ${service.name_ar}`,
          body_en: `New request available: ${service.name_en || service.name_ar}`,
          action_url: `/lawyer/requests/${requestData.id}`,
          action_type: 'view_request',
          reference_type: 'service_request',
          reference_id: requestData.id,
          priority: 'normal',
          send_push: true,
        }))

        await supabase.from('notifications').insert(delayedNotifications)
      }

      toast.success(`تم إنشاء طلبكم رقم ${ticketNumber} بنجاح! يمكنكم متابعة حالة الطلب في صفحة طلباتي`, { duration: 5000 })
      router.push("/subscriber/requests?new=" + requestData.id)

    } catch (error) {
      console.error('Payment error:', error)
      toast.error('حدث خطأ في معالجة الدفع')
    } finally {
      setIsProcessing(false)
    }
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

            {/* طريقة الدفع */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>💳</span>
                طريقة الدفع
              </h3>

              <div className="space-y-3">
                {/* Moyasar */}
                <label 
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'moyasar' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="moyasar"
                    checked={paymentMethod === 'moyasar'}
                    onChange={() => setPaymentMethod('moyasar')}
                    className="w-5 h-5 text-blue-600"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">بطاقة ائتمان / مدى</p>
                    <p className="text-sm text-gray-500">Visa, Mastercard, Mada</p>
                  </div>
                  <div className="flex gap-2 text-2xl">
                    💳
                  </div>
                </label>

                {/* Tabby */}
                <label 
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'tabby' 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="tabby"
                    checked={paymentMethod === 'tabby'}
                    onChange={() => setPaymentMethod('tabby')}
                    className="w-5 h-5 text-purple-600"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">تابي - قسّمها على 4</p>
                    <p className="text-sm text-gray-500">ادفع {formatPrice(totalAmount / 4)} ر.س × 4 دفعات</p>
                  </div>
                  <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                    Tabby
                  </div>
                </label>

                {/* Tamara */}
                <label 
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'tamara' 
                      ? 'border-teal-500 bg-teal-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="tamara"
                    checked={paymentMethod === 'tamara'}
                    onChange={() => setPaymentMethod('tamara')}
                    className="w-5 h-5 text-teal-600"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">تمارا - قسّمها على 3</p>
                    <p className="text-sm text-gray-500">ادفع {formatPrice(totalAmount / 3)} ر.س × 3 دفعات</p>
                  </div>
                  <div className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-sm font-medium">
                    Tamara
                  </div>
                </label>
              </div>
            </div>

            {/* الشروط والأحكام */}
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

              <button
                onClick={handlePayment}
                disabled={isProcessing || !agreedToTerms}
                className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
                  isProcessing || !agreedToTerms
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    جاري المعالجة...
                  </span>
                ) : (
                  `ادفع ${formatPrice(totalAmount)} ر.س`
                )}
              </button>

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
                    <span>يتم إنشاء طلبك فوراً ويظهر في "طلباتي"</span>
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
