'use client'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 صفحة لوحة التحكم - المشترك
// 📅 تاريخ التحديث: 6 يناير 2026
// 🎯 الغرض: عرض خدمات الباقة + طلب استشارة/قضية + الخدمات الإضافية
// 📝 التحديث: فصل نموذج الطلب في RequestFormModal منفصل
// 📁 المسار: src/app/subscriber/dashboard/page.tsx
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Sidebar from '@/components/layout/Sidebar'
import toast from 'react-hot-toast'
import FloatingNolex, { FloatingNolexRef } from '@/components/FloatingNolex'
import RequestFormModal from '@/components/subscriber/RequestFormModal'

// ═══════════════════════════════════════════════════════════════════════════════
// الواجهات (Interfaces)
// ═══════════════════════════════════════════════════════════════════════════════

interface User {
  id: string
  full_name: string
  phone: string
  email: string
  national_id: string
}

interface Member {
  id: string
  member_code: string
  free_searches_remaining: number
}

interface Subscription {
  id: string
  status: string
  package_name: string
  consultations_remaining: number
  cases_remaining: number
  nolex_remaining: number
  library_remaining: number
}

interface ExtraService {
  id: string
  name_ar: string
  description_ar: string | null
  price: number | null
  pricing_type: string
  icon: string | null
  category?: {
    code: string
    name_ar: string
    color: string
    icon: string
  }
}

interface Category {
  id: string
  code: string
  name_ar: string
  color: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// الثوابت
// ═══════════════════════════════════════════════════════════════════════════════

// المجالات المشمولة في الباقة
const PACKAGE_CATEGORIES = ['labor', 'personal_status']

// تحويل أسماء Lucide إلى Emoji
const ICON_MAP: { [key: string]: string } = {
  'globe': '🌐', 'file-text': '📄', 'stamp': '✍️', 'zap': '⚡',
  'scale': '⚖️', 'briefcase': '💼', 'building': '🏢', 'users': '👥',
  'shield': '🛡️', 'home': '🏠', 'file-signature': '📝',
}

const getIcon = (iconName: string | null): string => {
  if (!iconName) return '📦'
  if (/[\u{1F300}-\u{1F9FF}]/u.test(iconName)) return iconName
  return ICON_MAP[iconName.toLowerCase()] || '📦'
}

// ═══════════════════════════════════════════════════════════════════════════════
// المكون الرئيسي
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [extraServices, setExtraServices] = useState<ExtraService[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [nolexUsed, setNolexUsed] = useState(0)
  const FREE_NOLEX_LIMIT = 10
  
  // مرجع NOLEX للتحكم فيه من الخارج
  const nolexRef = useRef<FloatingNolexRef>(null)

  // ─────────────────────────────────────────────────────────────
  // حالات نموذج طلب الاستشارة/القضية
  // ─────────────────────────────────────────────────────────────
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestType, setRequestType] = useState<'consultation' | 'case'>('consultation')
  const [categories, setCategories] = useState<Category[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // بحث المكتبة
  const [librarySearch, setLibrarySearch] = useState('')

  // ═══════════════════════════════════════════════════════════════════════════════
  // جلب البيانات
  // ═══════════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const userId = localStorage.getItem('exolex_user_id')
    
    if (!userId) {
      router.push('/auth/login')
      return
    }

    const fetchData = async () => {
      // جلب بيانات المستخدم
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError || !userData) {
        localStorage.removeItem('exolex_user_id')
        router.push('/auth/login')
        return
      }

      if (!userData.is_profile_complete) {
        router.push('/auth/complete-profile')
        return
      }

      setUser(userData)

      // جلب member_id أولاً
      const { data: memberData } = await supabase
        .from('members')
        .select('id, member_code, free_searches_remaining')
        .eq('user_id', userId)
        .single()
      
      if (memberData) {
        setMember(memberData)
        setNolexUsed(FREE_NOLEX_LIMIT - (memberData.free_searches_remaining || 0))
      }
      
      // جلب بيانات الاشتراك (إذا وجد)
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*, packages(*)')
        .eq('member_id', memberData?.id)
        .eq('status', 'active')
        .single()

      if (subData) {
        setSubscription({
          id: subData.id,
          status: subData.status,
          package_name: subData.packages?.name_ar || 'غير معروف',
          consultations_remaining: subData.consultations_remaining || 0,
          cases_remaining: subData.cases_remaining || 0,
          nolex_remaining: subData.nolex_remaining || 0,
          library_remaining: subData.library_remaining || 0,
        })
      }

      // جلب الخدمات الإضافية من DB (أول 6 فقط)
      const { data: servicesData } = await supabase
        .from('extra_services')
        .select('id, name_ar, description_ar, price, pricing_type, icon, category:categories(code, name_ar, color, icon)')
        .eq('is_active', true)
        .order('sort_order')
        .limit(6)

      if (servicesData) {
        setExtraServices(servicesData)
      }

      // جلب المجالات المشمولة في الباقة (العمالي + الأحوال الشخصية)
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, code, name_ar, color')
        .in('code', PACKAGE_CATEGORIES)
        .eq('is_active', true)

      if (categoriesData) {
        setCategories(categoriesData)
      }

      setIsLoading(false)
    }

    fetchData()
  }, [router])

  // ═══════════════════════════════════════════════════════════════════════════════
  // الدوال
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleLogout = () => {
    localStorage.removeItem('exolex_user_id')
    localStorage.removeItem('exolex_phone')
    router.push('/auth/login')
  }

  // فتح نموذج الطلب
  const openRequestModal = (type: 'consultation' | 'case') => {
    // التحقق من الرصيد
    if (type === 'consultation' && subscription?.consultations_remaining === 0) {
      toast.error('لا يوجد رصيد استشارات متبقي')
      return
    }
    if (type === 'case' && subscription?.cases_remaining === 0) {
      toast.error('لا يوجد رصيد قضايا متبقي')
      return
    }

    setRequestType(type)
    setShowRequestModal(true)
  }

  // إرسال الطلب للمحامي فعلياً (يُستدعى من NOLEX)
  const handleSendToLawyer = async (context: {
    type: 'consultation' | 'case'
    category_name: string
    category_id: string
    subcategory_name?: string
    subcategory_id?: string
    title: string
    description: string
  }, isEmergency?: boolean, conversationLog?: any[]) => {
    if (!member || !subscription) return

    setIsSubmitting(true)

    try {
      // توليد رقم الطلب
      const prefix = context.type === 'consultation' ? 'CON' : 'CAS'
      const { data: seqData } = await supabase.rpc('generate_sequence_number', { p_type: prefix })
      const ticketNumber = seqData || `${prefix}-${Date.now()}`

      // تحويل المحادثة إلى JSON للحفظ في العمود الجديد
      const nolexConversationJson = conversationLog 
        ? conversationLog.map(m => ({ role: m.role, content: m.content }))
        : []

      // بيانات الطلب الأساسية
      const requestData: any = {
        ticket_number: ticketNumber,
        member_id: member.id,
        subscription_id: subscription.id,
        request_type: context.type,
        source: 'package',
        handler_type: 'legal_arm',
        category_id: context.category_id,
        subcategory_id: context.subcategory_id || null,
        title: context.title,
        description: context.description,
        status: 'pending_assignment',
        priority: isEmergency ? 'urgent' : 'normal',
        credit_consumed: !isEmergency,
        sla_hours: isEmergency ? 4 : (context.type === 'consultation' ? 24 : 48),
        notes: isEmergency ? '🚨 حالة طارئة - يرجى التعامل الفوري' : null,
        // حفظ محادثة NOLEX كـ JSON
        nolex_conversation: nolexConversationJson,
        // توليد توجيه NOLEX من المحادثة
        nolex_guidance: conversationLog && conversationLog.length > 0 
          ? conversationLog.filter(m => m.role === 'assistant').slice(-1)[0]?.content || null
          : null
      }

      // إنشاء الطلب
      const { data: newRequest, error } = await supabase
        .from('service_requests')
        .insert(requestData)
        .select()
        .single()

      if (error) throw error

      // خصم من الرصيد فقط إذا ليست حالة طارئة
      if (!isEmergency) {
        const updateField = context.type === 'consultation' ? 'consultations_remaining' : 'cases_remaining'
        const newValue = context.type === 'consultation' 
          ? subscription.consultations_remaining - 1 
          : subscription.cases_remaining - 1

        await supabase
          .from('subscriptions')
          .update({ [updateField]: newValue })
          .eq('id', subscription.id)

        setSubscription(prev => prev ? { ...prev, [updateField]: newValue } : null)
      }

      setShowRequestModal(false)
      
      if (isEmergency) {
        toast.success(`🚨 تم إرسال طلبك كحالة طارئة برقم ${ticketNumber}`, { duration: 5000 })
      } else {
        toast.success(`تم إرسال طلبك برقم ${ticketNumber}`)
      }
      
      router.push('/subscriber/requests')

    } catch (error: any) {
      console.error('Error:', error)
      toast.error(`حدث خطأ: ${error.message || 'في إرسال الطلب'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // عند إغلاق NOLEX بدون إرسال للمحامي (المشترك راضي)
  const handleNolexResolved = () => {
    setShowRequestModal(false)
    toast.success('سعيدون أننا استطعنا مساعدتك! 💚')
  }

  // البحث في المكتبة
  const handleLibrarySearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && librarySearch.trim()) {
      router.push(`/subscriber/library?q=${encodeURIComponent(librarySearch)}`)
    }
  }

  // تنسيق السعر
  const formatPrice = (service: ExtraService): string => {
    if (service.pricing_type === 'quote' || service.price === null) {
      return 'طلب عرض سعر'
    }
    return `${Number(service.price).toLocaleString('ar-SA')} ريال`
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // العرض - التحميل
  // ═══════════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  const isSubscribed = !!subscription

  // ═══════════════════════════════════════════════════════════════════════════════
  // العرض الرئيسي
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar 
        isSubscribed={isSubscribed} 
        userName={user?.full_name || ''} 
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 mr-64 p-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">مرحباً، {user?.full_name} 👋</h1>
          <p className="text-gray-500 mt-1">نتمنى لك يوماً سعيداً</p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* بطاقة الباقة */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {!isSubscribed ? (
          // غير مشترك
          <div className="card mb-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-l from-gray-100 to-transparent opacity-50"></div>
            <div className="relative">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl">⚠️</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">أنت غير مشترك حالياً</h2>
                  <p className="text-gray-500">اشترك الآن للحصول على حماية قانونية كاملة</p>
                </div>
              </div>

              {/* خدمات الباقة - مظللة */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 opacity-60">
                <div className="bg-gray-100 rounded-xl p-4 text-center">
                  <span className="text-2xl mb-2 block">💬</span>
                  <p className="text-sm font-medium text-gray-600">الاستشارات</p>
                  <p className="text-xs text-gray-400">الرصيد: --</p>
                </div>
                <div className="bg-gray-100 rounded-xl p-4 text-center">
                  <span className="text-2xl mb-2 block">⚖️</span>
                  <p className="text-sm font-medium text-gray-600">القضايا</p>
                  <p className="text-xs text-gray-400">الرصيد: --</p>
                </div>
                <div className="bg-gray-100 rounded-xl p-4 text-center">
                  <span className="text-2xl mb-2 block">🤖</span>
                  <p className="text-sm font-medium text-gray-600">NOLEX AI</p>
                  <p className="text-xs text-gray-400">الرصيد: --</p>
                </div>
                <div className="bg-gray-100 rounded-xl p-4 text-center">
                  <span className="text-2xl mb-2 block">📚</span>
                  <p className="text-sm font-medium text-gray-600">المكتبة</p>
                  <p className="text-xs text-gray-400">الرصيد: --</p>
                </div>
              </div>

              <Link href="/subscriber/subscription">
                <button className="btn-primary">
                  اشترك الآن واحصل على حماية قانونية كاملة
                </button>
              </Link>
            </div>
          </div>
        ) : (
          // مشترك - التصميم الجديد مع الأزرار
          <div className="card mb-8 border-2 border-green-200 bg-green-50">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-3xl">✓</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">باقة {subscription.package_name}</h2>
                <p className="text-green-600">اشتراك فعّال</p>
              </div>
            </div>

            {/* خدمات الباقة مع أزرار الطلب */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* الاستشارات */}
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <span className="text-2xl mb-2 block">💬</span>
                <p className="text-sm font-medium text-gray-600">الاستشارات</p>
                <p className="text-lg font-bold text-primary-600 mb-3">{subscription.consultations_remaining}</p>
                <button
                  onClick={() => openRequestModal('consultation')}
                  disabled={subscription.consultations_remaining === 0}
                  className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    subscription.consultations_remaining > 0
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  اطلب استشارة
                </button>
              </div>

              {/* القضايا */}
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <span className="text-2xl mb-2 block">⚖️</span>
                <p className="text-sm font-medium text-gray-600">القضايا</p>
                <p className="text-lg font-bold text-primary-600 mb-3">{subscription.cases_remaining}</p>
                <button
                  onClick={() => openRequestModal('case')}
                  disabled={subscription.cases_remaining === 0}
                  className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    subscription.cases_remaining > 0
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  اطلب قضية
                </button>
              </div>

              {/* NOLEX AI */}
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <span className="text-2xl mb-2 block">🤖</span>
                <p className="text-sm font-medium text-gray-600">NOLEX AI</p>
                <p className="text-lg font-bold text-primary-600 mb-3">
                  {subscription.nolex_remaining === -1 ? '∞' : subscription.nolex_remaining}
                </p>
                <Link href="/subscriber/nolex">
                  <button className="w-full py-2 px-3 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors">
                    جرب NOLEX
                  </button>
                </Link>
              </div>

              {/* المكتبة مع البحث */}
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <span className="text-2xl mb-2 block">📚</span>
                <p className="text-sm font-medium text-gray-600">المكتبة</p>
                <p className="text-lg font-bold text-primary-600 mb-3">
                  {subscription.library_remaining === -1 ? '∞' : subscription.library_remaining}
                </p>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 ابحث..."
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    onKeyDown={handleLibrarySearch}
                    className="w-full py-2 px-3 rounded-lg text-sm border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-right"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* NOLEX Section */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img src="/nolex-avatar.jpg" alt="NOLEX" className="w-12 h-12 rounded-full object-cover" />
              <div>
                <h3 className="text-lg font-semibold">NOLEX - المساعد القانوني الذكي</h3>
                <p className="text-sm text-gray-500">اسأل أي سؤال قانوني واحصل على إجابة فورية</p>
              </div>
            </div>
            {!isSubscribed && (
              <div className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                {FREE_NOLEX_LIMIT - nolexUsed} استخدام متبقي
              </div>
            )}
          </div>
          <Link href="/subscriber/nolex">
            <div className="bg-gray-100 rounded-lg p-4 hover:bg-gray-200 transition-colors cursor-pointer">
              <div className="flex items-center gap-3 text-gray-500">
                <span>💬</span>
                <span>اسأل NOLEX أي سؤال قانوني...</span>
              </div>
            </div>
          </Link>
          <p className="text-xs text-gray-400 mt-2">
            أمثلة: "ما هي حقوقي كعامل؟" | "كيف أرفع قضية عمالية؟" | "ما إجراءات الطلاق؟"
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* الفاصل */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-gray-200"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-gray-50 px-4 text-sm text-gray-500 font-medium">
              الخدمات الإضافية (خارج الباقة)
            </span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* الخدمات الإضافية */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">الخدمات الإضافية</h3>
            <Link href="/subscriber/extra-services" className="text-primary-600 text-sm hover:underline">
              عرض الكل ←
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {extraServices.map((service) => (
              <Link 
                key={service.id}
                href="/subscriber/extra-services"
                className="block"
              >
                <div 
                  className="bg-white rounded-xl p-4 hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-opacity-50"
                  style={{ 
                    borderColor: service.category?.color || '#E5E7EB',
                    borderTopWidth: '4px',
                    borderTopColor: service.category?.color || '#6B7280'
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                      style={{ backgroundColor: `${service.category?.color}20` }}
                    >
                      {getIcon(service.icon || service.category?.icon)}
                    </div>
                    {service.category && (
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: service.category.color }}
                      >
                        {service.category.name_ar}
                      </span>
                    )}
                  </div>
                  <h4 className="font-semibold text-gray-800">{service.name_ar}</h4>
                  <p className="text-xs text-gray-500 mt-1 mb-3 line-clamp-1">
                    {service.description_ar || 'خدمة قانونية متخصصة'}
                  </p>
                  <p 
                    className="font-medium text-sm"
                    style={{ color: service.category?.color || '#2563EB' }}
                  >
                    {formatPrice(service)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* نموذج طلب استشارة / قضية - Component منفصل */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <RequestFormModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        requestType={requestType}
        nolexRef={nolexRef}
        subscription={subscription}
        member={member}
        categories={categories}
        onSuccess={() => {
          setShowRequestModal(false)
          router.push('/subscriber/requests')
        }}
      />

      {/* NOLEX العائم */}
      <FloatingNolex 
        ref={nolexRef}
        onSendToLawyer={handleSendToLawyer}
        onResolved={handleNolexResolved}
      />
    </div>
  )
}
