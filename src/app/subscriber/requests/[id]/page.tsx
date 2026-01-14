'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 تفاصيل الطلب - المشترك (مع جدول العروض + Modal)
// 📅 تاريخ التحديث: 14 يناير 2026
// 🎯 التحديثات: جدول مختصر للعروض + Modal للتفاصيل + إصلاح خطأ القبول
// 📁 المسار: src/app/subscriber/requests/[id]/page.tsx
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import {
  ArrowRight, Clock, User, FileText, Calendar,
  Bot, AlertCircle, CheckCircle, XCircle,
  Timer, Star, ChevronDown, ChevronUp,
  History, DollarSign, CreditCard, Award, Eye, X
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════════════════════

interface ServiceQuote {
  id: string
  quote_number: string
  lawyer_id: string
  service_description: string
  price: number
  platform_fee_amount: number
  vat_amount: number
  total_amount: number
  lawyer_earnings: number
  installments_count: number
  status: 'pending' | 'accepted' | 'rejected'
  valid_until: string
  created_at: string
  quote_type: 'single' | 'multiple'
  accepted_at?: string
  rejected_at?: string
  lawyer?: {
    id: string
    lawyer_code: string
    full_name: string
    rating_average: number
    rating_count: number
    years_of_experience: number
    city: string
  }
}

interface QuoteInstallment {
  id: string
  quote_id: string
  installment_number: number
  description: string
  percentage: number
  amount: number
  status: 'pending' | 'not_due' | 'paid' | 'released'
  paid_at: string | null
  created_at: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// التكوينات
// ═══════════════════════════════════════════════════════════════════════════════

const statusConfig: Record<string, { label: string; color: string; icon: any; description: string }> = {
  pending: { 
    label: 'بانتظار التعيين', 
    color: 'bg-gray-100 text-gray-700', 
    icon: Clock,
    description: 'طلبك قيد المراجعة وسيتم تعيين محامي قريباً'
  },
  pending_quotes: { 
    label: 'بانتظار عروض الأسعار', 
    color: 'bg-blue-100 text-blue-700', 
    icon: DollarSign,
    description: 'طلبك متاح للمحامين لتقديم عروضهم'
  },
  pending_assignment: { 
    label: 'بانتظار التعيين', 
    color: 'bg-orange-100 text-orange-700', 
    icon: Clock,
    description: 'طلبك قيد المراجعة'
  },
  assigned: { 
    label: 'تم التعيين', 
    color: 'bg-blue-100 text-blue-700', 
    icon: User,
    description: 'تم تعيين محامي لطلبك وبانتظار قبوله'
  },
  accepted: { 
    label: 'قيد العمل', 
    color: 'bg-green-100 text-green-700', 
    icon: CheckCircle,
    description: 'المحامي قبل طلبك ويعمل عليه'
  },
  in_progress: { 
    label: 'قيد التنفيذ', 
    color: 'bg-indigo-100 text-indigo-700', 
    icon: Timer,
    description: 'المحامي يعمل على طلبك حالياً'
  },
  completed: { 
    label: 'مكتمل', 
    color: 'bg-emerald-100 text-emerald-700', 
    icon: CheckCircle,
    description: 'تم إكمال طلبك بنجاح'
  },
  closed: { 
    label: 'مغلق', 
    color: 'bg-slate-100 text-slate-700', 
    icon: XCircle,
    description: 'تم إغلاق الطلب'
  },
  cancelled: { 
    label: 'ملغي', 
    color: 'bg-red-100 text-red-700', 
    icon: XCircle,
    description: 'تم إلغاء الطلب'
  },
}

const typeConfig: Record<string, { label: string; color: string; icon: string }> = {
  consultation: { label: 'استشارة قانونية', color: 'bg-blue-500', icon: '💬' },
  case: { label: 'قضية', color: 'bg-purple-500', icon: '⚖️' },
  extra_service: { label: 'خدمة إضافية', color: 'bg-orange-500', icon: '✨' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  normal: { label: 'عادي', color: 'bg-slate-100 text-slate-600' },
  urgent: { label: 'عاجل', color: 'bg-orange-100 text-orange-600' },
  emergency: { label: 'طارئ', color: 'bg-red-100 text-red-600' },
}

// ═══════════════════════════════════════════════════════════════════════════════
// المكون الرئيسي
// ═══════════════════════════════════════════════════════════════════════════════

export default function SubscriberRequestDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = params.id as string

  // States
  const [isLoading, setIsLoading] = useState(true)
  const [request, setRequest] = useState<any>(null)
  const [lawyer, setLawyer] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<{ id: string; memberId: string; name: string } | null>(null)

  // العروض والدفعات
  const [quotes, setQuotes] = useState<ServiceQuote[]>([])
  const [installments, setInstallments] = useState<{[quoteId: string]: QuoteInstallment[]}>({})
  const [acceptingQuote, setAcceptingQuote] = useState<string | null>(null)
  
  // 🆕 Modal تفاصيل العرض
  const [selectedQuote, setSelectedQuote] = useState<ServiceQuote | null>(null)
  const [showQuoteModal, setShowQuoteModal] = useState(false)

  // محادثة NOLEX
  const [nolexConversation, setNolexConversation] = useState<any[]>([])
  const [showNolexArchive, setShowNolexArchive] = useState(false)

  // سجل الطلب
  const [requestHistory, setRequestHistory] = useState<any[]>([])

  // ═══════════════════════════════════════════════════════════════════════════════
  // تحميل البيانات
  // ═══════════════════════════════════════════════════════════════════════════════

  useEffect(() => { loadData() }, [requestId])

  const loadData = async () => {
    try {
      const userId = localStorage.getItem('exolex_user_id')
      if (!userId) { router.push('/auth/login'); return }

      // جلب معلومات المشترك
      const { data: memberData } = await supabase
        .from('members')
        .select('id, user_id')
        .eq('user_id', userId)
        .single()

      if (!memberData) { router.push('/auth/login'); return }

      const { data: userData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single()

      setCurrentUser({
        id: userId,
        memberId: memberData.id,
        name: userData?.full_name || 'مشترك'
      })

      // جلب الطلب
      const { data: requestData, error: requestError } = await supabase
        .from('service_requests')
        .select(`
          *,
          category:category_id(name_ar, icon),
          subcategory:subcategory_id(name_ar)
        `)
        .eq('id', requestId)
        .single()

      if (requestError) throw requestError

      // التحقق من الصلاحية
      if (requestData.member_id !== memberData.id) {
        toast.error('ليس لديك صلاحية لعرض هذا الطلب')
        router.push('/subscriber/requests')
        return
      }

      setRequest(requestData)

      // جلب محادثة NOLEX
      if (requestData.nolex_conversation) {
        setNolexConversation(requestData.nolex_conversation)
      }

      // جلب معلومات المحامي المعين
      if (requestData.assigned_lawyer_id) {
        const { data: lawyerData } = await supabase
          .from('lawyers')
          .select('id, full_name, lawyer_code, rating_average, rating_count, years_of_experience, city')
          .eq('id', requestData.assigned_lawyer_id)
          .single()
        setLawyer(lawyerData)
      }

      // ═══════════════════════════════════════════════════════════════════════════════
      // جلب عروض الأسعار من المحامين
      // ═══════════════════════════════════════════════════════════════════════════════
      const { data: quotesData, error: quotesError } = await supabase
        .from('service_quotes')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })

      console.log('📋 العروض:', quotesData, 'Error:', quotesError)

      if (quotesData && quotesData.length > 0) {
        // جلب بيانات المحامين بشكل منفصل
        const lawyerIds = Array.from(new Set(quotesData.map(q => q.lawyer_id).filter(Boolean)))
        
        let quotesWithLawyers = quotesData
        
        if (lawyerIds.length > 0) {
          const { data: lawyersData } = await supabase
            .from('lawyers')
            .select('id, lawyer_code, full_name, rating_average, rating_count, years_of_experience, city')
            .in('id', lawyerIds)
          
          quotesWithLawyers = quotesData.map(quote => ({
            ...quote,
            lawyer: lawyersData?.find(l => l.id === quote.lawyer_id) || null
          }))
        }
        
        setQuotes(quotesWithLawyers)
        console.log('📋 العروض مع المحامين:', quotesWithLawyers)

        // جلب الدفعات لكل عرض
        const quoteIds = quotesData.map(q => q.id)
        
        const { data: installmentsData } = await supabase
          .from('quote_installments')
          .select('*')
          .in('quote_id', quoteIds)
          .order('installment_number', { ascending: true })
        
        if (installmentsData) {
          const groupedInstallments: {[quoteId: string]: QuoteInstallment[]} = {}
          installmentsData.forEach(inst => {
            if (!groupedInstallments[inst.quote_id]) {
              groupedInstallments[inst.quote_id] = []
            }
            groupedInstallments[inst.quote_id].push(inst)
          })
          setInstallments(groupedInstallments)
          console.log('📊 الدفعات:', groupedInstallments)
        }
      }

      // جلب سجل الطلب
      const { data: historyData } = await supabase
        .from('request_history')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })
      setRequestHistory(historyData || [])

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // قبول عرض السعر - مُصحح
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleAcceptQuote = async (quote: ServiceQuote) => {
    const quoteInstallments = installments[quote.id] || []
    const firstPayment = quoteInstallments.length > 0 ? quoteInstallments[0].amount : quote.total_amount
    
    const confirmMsg = quoteInstallments.length > 1 
      ? `هل أنت متأكد من قبول العرض؟\n\nالإجمالي: ${quote.total_amount.toLocaleString()} ر.س\nالدفعة الأولى: ${firstPayment.toLocaleString()} ر.س`
      : `هل أنت متأكد من قبول العرض بقيمة ${quote.total_amount.toLocaleString()} ر.س؟`
    
    if (!confirm(confirmMsg)) return

    setAcceptingQuote(quote.id)

    try {
      // 1. تحديث حالة العرض المقبول
      const { error: updateQuoteError } = await supabase
        .from('service_quotes')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', quote.id)

      if (updateQuoteError) throw updateQuoteError

      // 2. رفض باقي العروض
      await supabase
        .from('service_quotes')
        .update({ 
          status: 'rejected',
          rejected_at: new Date().toISOString()
        })
        .eq('request_id', requestId)
        .neq('id', quote.id)
        .eq('status', 'pending')

      // 3. تحديث حالة الطلب + تعيين المحامي (بدون accepted_quote_id)
      const { error: updateRequestError } = await supabase
        .from('service_requests')
        .update({
          status: 'in_progress',
          assigned_lawyer_id: quote.lawyer_id,
          assigned_at: new Date().toISOString(),
          base_price: quote.price,
          total_amount: quote.total_amount,
          vat_amount: quote.vat_amount
        })
        .eq('id', requestId)

      if (updateRequestError) throw updateRequestError

      // 4. تحديث حالة الدفعة الأولى إلى pending (مستحقة)
      if (quoteInstallments.length > 0) {
        await supabase
          .from('quote_installments')
          .update({ status: 'pending' })
          .eq('quote_id', quote.id)
          .eq('installment_number', 1)
      }
// 5. إرسال إشعار للمحامي
try {
  await supabase.from('notifications').insert({
    recipient_type: 'lawyer',
    recipient_id: quote.lawyer_id,
    title: 'تم قبول عرضك! 🎉',
    body: `تم قبول عرضك رقم ${quote.quote_number} بقيمة ${quote.total_amount.toLocaleString()} ر.س`,
    icon: '✅',
    notification_type: 'quote_accepted',
    request_id: requestId,
    quote_id: quote.id,
    action_url: `/independent/tasks/${requestId}`,
    is_read: false
  })
} catch (notifError) {
  console.log('Notification error (non-critical):', notifError)
}
      toast.success('✅ تم قبول العرض بنجاح!')
      setShowQuoteModal(false)
      loadData()

    } catch (error) {
      console.error('Error accepting quote:', error)
      toast.error('حدث خطأ في قبول العرض')
    } finally {
      setAcceptingQuote(null)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // الدوال المساعدة
  // ═══════════════════════════════════════════════════════════════════════════════

  const formatDate = (date: string) => date ? new Date(date).toLocaleDateString('ar-SA') : '-'
  const formatDateTime = (date: string) => date ? new Date(date).toLocaleString('ar-SA') : '-'
  const formatPrice = (amount: number) => amount ? `${amount.toLocaleString()} ر.س` : '-'

  const isQuoteValid = (validUntil: string) => new Date(validUntil) > new Date()

  const getTimeRemaining = (validUntil: string) => {
    const diff = new Date(validUntil).getTime() - Date.now()
    if (diff <= 0) return { text: 'منتهي', color: 'text-red-600', bg: 'bg-red-100' }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (days > 0) return { text: `${days} يوم ${hours} ساعة`, color: 'text-green-600', bg: 'bg-green-100' }
    if (hours > 4) return { text: `${hours} ساعة`, color: 'text-yellow-600', bg: 'bg-yellow-100' }
    return { text: `${hours} ساعة`, color: 'text-red-600', bg: 'bg-red-100' }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // العرض
  // ═══════════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 mx-auto text-red-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">الطلب غير موجود</h2>
        <button onClick={() => router.push('/subscriber/requests')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          العودة للطلبات
        </button>
      </div>
    )
  }

  const StatusIcon = statusConfig[request.status]?.icon || Clock
  const pendingQuotes = quotes.filter(q => q.status === 'pending')
  const acceptedQuote = quotes.find(q => q.status === 'accepted')

  return (
    <div className="space-y-4 pb-8">
      
      {/* ════════════════════════════════════════════════════════════════════
          Header
      ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-start gap-4">
          <button onClick={() => router.push('/subscriber/requests')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors mt-1">
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <span className="text-2xl">{typeConfig[request.request_type]?.icon || '📋'}</span>
              <h1 className="text-xl font-bold text-slate-800">
                {request.ticket_number || `طلب #${requestId.slice(0, 8)}`}
              </h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5 ${statusConfig[request.status]?.color}`}>
                <StatusIcon className="w-4 h-4" />
                {statusConfig[request.status]?.label}
              </span>
              {pendingQuotes.length > 0 && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700 flex items-center gap-1.5">
                  💰 {pendingQuotes.length} عرض متاح
                </span>
              )}
            </div>
            
            <p className="text-slate-600 mb-3">{request.title || 'بدون عنوان'}</p>
            
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <span className={`px-2 py-1 rounded text-xs text-white ${typeConfig[request.request_type]?.color}`}>
                {typeConfig[request.request_type]?.label}
              </span>
              <span className={`px-2 py-1 rounded text-xs ${priorityConfig[request.priority]?.color}`}>
                {priorityConfig[request.priority]?.label}
              </span>
              <span className="text-slate-500 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(request.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* ════════════════════════════════════════════════════════════════════
            المحتوى الرئيسي
        ════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* ════════════════════════════════════════════════════════════════════
              🆕 جدول العروض المختصر
          ════════════════════════════════════════════════════════════════════ */}
          {pendingQuotes.length > 0 && !acceptedQuote && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-l from-amber-500 to-orange-500 text-white p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                    💰
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">عروض الأسعار المتاحة</h3>
                    <p className="text-sm opacity-90">{pendingQuotes.length} عرض من المحامين - اختر الأنسب لك</p>
                  </div>
                </div>
              </div>
              
              {/* جدول العروض */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="py-3 px-4 text-right text-xs font-bold text-slate-600">رقم العرض</th>
                      <th className="py-3 px-4 text-right text-xs font-bold text-slate-600">التاريخ</th>
                      <th className="py-3 px-4 text-right text-xs font-bold text-slate-600">المحامي</th>
                      <th className="py-3 px-4 text-center text-xs font-bold text-slate-600">التقييم</th>
                      <th className="py-3 px-4 text-center text-xs font-bold text-slate-600">الدفعات</th>
                      <th className="py-3 px-4 text-left text-xs font-bold text-slate-600">الإجمالي</th>
                      <th className="py-3 px-4 text-center text-xs font-bold text-slate-600">الصلاحية</th>
                      <th className="py-3 px-4 text-center text-xs font-bold text-slate-600">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingQuotes.map((quote, idx) => {
                      const timeRemaining = getTimeRemaining(quote.valid_until)
                      const isValid = isQuoteValid(quote.valid_until)
                      const quoteInstallments = installments[quote.id] || []
                      
                      return (
                        <tr key={quote.id} className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} ${!isValid ? 'opacity-50' : ''}`}>
                          <td className="py-3 px-4">
                            <span className="font-mono text-sm text-slate-700">{quote.quote_number}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-slate-600">{formatDate(quote.created_at)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                {quote.lawyer?.full_name?.[0] || '؟'}
                              </div>
                              <div>
                                <p className="font-bold text-blue-600 text-sm">{quote.lawyer?.lawyer_code || '-'}</p>
                                <p className="text-xs text-slate-400">{quote.lawyer?.city || '-'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {quote.lawyer?.rating_average ? (
                              <div className="flex items-center justify-center gap-1">
                                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                <span className="text-sm font-medium">{quote.lawyer.rating_average.toFixed(1)}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                              quoteInstallments.length > 1 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {quoteInstallments.length > 1 ? `${quoteInstallments.length} دفعات` : 'دفعة واحدة'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-left">
                            <span className="font-bold text-green-600">{formatPrice(quote.total_amount)}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${timeRemaining.bg} ${timeRemaining.color}`}>
                              {timeRemaining.text}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => { setSelectedQuote(quote); setShowQuoteModal(true); }}
                                className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                                title="عرض التفاصيل"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {isValid && (
                                <button
                                  onClick={() => handleAcceptQuote(quote)}
                                  disabled={acceptingQuote === quote.id}
                                  className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                                  title="قبول العرض"
                                >
                                  {acceptingQuote === quote.id ? (
                                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                  ) : (
                                    <CheckCircle className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* العرض المقبول */}
          {acceptedQuote && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-sm p-6 border-2 border-green-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white text-xl">
                  ✅
                </div>
                <div>
                  <h3 className="font-bold text-green-800 text-lg">تم قبول العرض</h3>
                  <p className="text-sm text-green-600">العرض رقم {acceptedQuote.quote_number}</p>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      {acceptedQuote.lawyer?.full_name?.[0] || '؟'}
                    </div>
                    <div>
                      <p className="font-bold text-blue-600">{acceptedQuote.lawyer?.lawyer_code}</p>
                      <p className="text-xs text-slate-500">{acceptedQuote.lawyer?.city}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold text-green-600">{formatPrice(acceptedQuote.total_amount)}</p>
                    <p className="text-xs text-slate-500">شامل الضريبة</p>
                  </div>
                </div>
                {acceptedQuote.service_description && (
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{acceptedQuote.service_description}</p>
                )}
                
                {/* عرض الدفعات للعرض المقبول */}
                {installments[acceptedQuote.id]?.length > 1 && (
                  <div className="mt-4">
                    <h4 className="font-bold text-slate-700 mb-2 text-sm">جدول الدفعات:</h4>
                    <div className="space-y-2">
                      {installments[acceptedQuote.id].map((inst) => (
                        <div key={inst.id} className={`flex items-center justify-between p-2 rounded-lg ${
                          inst.status === 'paid' ? 'bg-green-100' : inst.status === 'pending' ? 'bg-amber-100' : 'bg-slate-100'
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-600 text-white text-xs flex items-center justify-center">
                              {inst.installment_number}
                            </span>
                            <span className="text-sm">{inst.description}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold">{inst.amount.toLocaleString()} ر.س</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              inst.status === 'paid' ? 'bg-green-600 text-white' : 
                              inst.status === 'pending' ? 'bg-amber-600 text-white' : 
                              'bg-slate-400 text-white'
                            }`}>
                              {inst.status === 'paid' ? 'مدفوعة' : inst.status === 'pending' ? 'مستحقة' : 'قادمة'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* معلومات الطلب */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              تفاصيل الطلب
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">نوع الطلب</p>
                <p className="font-medium text-slate-800">{typeConfig[request.request_type]?.label}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">التصنيف</p>
                <p className="font-medium text-slate-800">{request.category?.name_ar || '-'}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">تاريخ الطلب</p>
                <p className="font-medium text-slate-800">{formatDateTime(request.created_at)}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">آخر تحديث</p>
                <p className="font-medium text-slate-800">{formatDateTime(request.updated_at)}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-xs text-slate-500 mb-2">وصف الطلب</p>
              <p className="text-slate-700 whitespace-pre-wrap">{request.description || 'لا يوجد وصف'}</p>
            </div>
          </div>

          {/* أرشيف محادثة NOLEX */}
          {nolexConversation && nolexConversation.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => setShowNolexArchive(!showNolexArchive)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <h3 className="font-bold text-slate-800">أرشيف محادثة NOLEX</h3>
                    <p className="text-sm text-slate-500">{nolexConversation.length} رسالة</p>
                  </div>
                </div>
                {showNolexArchive ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
              
              {showNolexArchive && (
                <div className="border-t p-4 bg-gradient-to-b from-blue-50 to-white max-h-[400px] overflow-y-auto">
                  <div className="space-y-3">
                    {nolexConversation.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-white border shadow-sm rounded-tl-sm'
                        }`}>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* سجل الطلب */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-purple-500" />
              سجل الطلب
            </h3>
            
            <div className="relative">
              <div className="absolute right-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
              
              <div className="space-y-4">
                <div className="flex gap-4 relative">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white z-10">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium text-slate-800">تم إنشاء الطلب</p>
                    <p className="text-sm text-slate-500">{formatDateTime(request.created_at)}</p>
                  </div>
                </div>

                {quotes.length > 0 && (
                  <div className="flex gap-4 relative">
                    <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white z-10">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-slate-800">تم استلام {quotes.length} عرض سعر</p>
                      <p className="text-sm text-slate-500">{formatDateTime(quotes[quotes.length - 1]?.created_at)}</p>
                    </div>
                  </div>
                )}

                {acceptedQuote && (
                  <div className="flex gap-4 relative">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white z-10">
                      <Award className="w-4 h-4" />
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-slate-800">تم قبول العرض {acceptedQuote.quote_number}</p>
                      <p className="text-sm text-slate-500">{formatDateTime(acceptedQuote.accepted_at || '')}</p>
                    </div>
                  </div>
                )}

                {lawyer && (
                  <div className="flex gap-4 relative">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white z-10">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-slate-800">
                        تم إسناد طلبك للمحامي <span className="text-blue-600 font-bold">{lawyer.lawyer_code}</span>
                      </p>
                      <p className="text-sm text-slate-500">{formatDateTime(request.assigned_at)}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-4 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white z-10 ${
                    request.status === 'completed' ? 'bg-emerald-500' : 
                    request.status === 'cancelled' ? 'bg-red-500' : 'bg-orange-500'
                  }`}>
                    <StatusIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{statusConfig[request.status]?.label}</p>
                    <p className="text-sm text-slate-500">{statusConfig[request.status]?.description}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            الشريط الجانبي
        ════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          
          {/* معلومات المحامي */}
          {lawyer ? (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" />
                المحامي المعين
              </h3>
              <div className="text-center mb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
                  {lawyer.full_name?.[0] || '؟'}
                </div>
                <p className="text-lg font-bold text-blue-600">{lawyer.lawyer_code}</p>
                {lawyer.city && <p className="text-sm text-slate-500">{lawyer.city}</p>}
              </div>
              
              {lawyer.rating_average && (
                <div className="flex items-center justify-center gap-1 mb-4">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  <span className="font-bold text-slate-800">{lawyer.rating_average?.toFixed(1)}</span>
                  <span className="text-sm text-slate-500">({lawyer.rating_count || 0} تقييم)</span>
                </div>
              )}
              
              {lawyer.years_of_experience && (
                <div className="text-center text-sm text-slate-600">
                  <Timer className="w-4 h-4 inline ml-1" />
                  {lawyer.years_of_experience} سنة خبرة
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" />
                المحامي
              </h3>
              <div className="text-center py-6 text-slate-500">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User className="w-8 h-8 text-slate-300" />
                </div>
                {pendingQuotes.length > 0 ? (
                  <p className="text-sm">اختر من العروض المتاحة</p>
                ) : (
                  <p className="text-sm">لم يتم تعيين محامي بعد</p>
                )}
              </div>
            </div>
          )}

          {/* ملخص التكلفة */}
          {(acceptedQuote || request.total_amount) && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
              <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                ملخص التكلفة
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">السعر الأساسي</span>
                  <span className="font-medium">{formatPrice(acceptedQuote?.price || request.base_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">الضريبة (15%)</span>
                  <span className="font-medium">{formatPrice(acceptedQuote?.vat_amount || request.vat_amount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-green-200">
                  <span className="font-bold text-slate-800">الإجمالي</span>
                  <span className="font-bold text-green-600">{formatPrice(acceptedQuote?.total_amount || request.total_amount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* مساعدة */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
            <h3 className="font-bold text-blue-800 mb-2">💡 تحتاج مساعدة؟</h3>
            <p className="text-sm text-blue-600 mb-3">يمكنك التواصل مع فريق الدعم في أي وقت</p>
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              تواصل مع الدعم
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          🆕 Modal تفاصيل العرض
      ════════════════════════════════════════════════════════════════════ */}
      {showQuoteModal && selectedQuote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-l from-slate-800 to-slate-900 text-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg">
                    {selectedQuote.lawyer?.full_name?.[0] || '؟'}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{selectedQuote.lawyer?.lawyer_code || 'محامي'}</p>
                    {selectedQuote.lawyer?.rating_average && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span>{selectedQuote.lawyer.rating_average.toFixed(1)}</span>
                        <span className="text-slate-400">({selectedQuote.lawyer.rating_count || 0} تقييم)</span>
                      </div>
                    )}
                    {selectedQuote.lawyer?.city && (
                      <p className="text-xs text-slate-300">📍 {selectedQuote.lawyer.city}</p>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => setShowQuoteModal(false)}
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm opacity-80">رقم العرض: {selectedQuote.quote_number}</span>
                <span className={`text-xs px-3 py-1 rounded-full ${getTimeRemaining(selectedQuote.valid_until).bg}`}>
                  ⏰ {getTimeRemaining(selectedQuote.valid_until).text}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* وصف الخدمة */}
              {selectedQuote.service_description && (
                <div className="mb-5">
                  <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    ما سيقوم به المحامي
                  </h4>
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedQuote.service_description}</p>
                  </div>
                </div>
              )}

              {/* جدول الدفعات */}
              {installments[selectedQuote.id]?.length > 1 && (
                <div className="mb-5">
                  <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-purple-500" />
                    جدول الدفعات ({installments[selectedQuote.id].length} دفعات)
                  </h4>
                  <div className="bg-purple-50 rounded-xl overflow-hidden border border-purple-100">
                    <table className="w-full">
                      <thead className="bg-purple-100">
                        <tr>
                          <th className="py-2 px-4 text-right text-xs font-bold text-purple-800">الدفعة</th>
                          <th className="py-2 px-4 text-right text-xs font-bold text-purple-800">المرحلة</th>
                          <th className="py-2 px-4 text-center text-xs font-bold text-purple-800">النسبة</th>
                          <th className="py-2 px-4 text-left text-xs font-bold text-purple-800">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installments[selectedQuote.id].map((inst, idx) => (
                          <tr key={inst.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-purple-50/50'}>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-600 text-white text-sm font-bold">
                                {inst.installment_number}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-700">{inst.description}</td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-block px-2 py-1 bg-purple-200 text-purple-800 rounded-full text-xs font-bold">
                                {inst.percentage}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-left font-bold text-slate-800">
                              {inst.amount.toLocaleString()} ر.س
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ملخص السعر */}
              <div className="bg-gradient-to-l from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">السعر الأساسي</p>
                    <p className="font-bold text-lg text-slate-800">{formatPrice(selectedQuote.price)}</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">الضريبة (15%)</p>
                    <p className="font-bold text-lg text-slate-700">{formatPrice(selectedQuote.vat_amount)}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-green-200">
                  <div>
                    <span className="text-slate-600 font-medium">الإجمالي شامل الضريبة</span>
                    {installments[selectedQuote.id]?.length > 1 && (
                      <p className="text-xs text-purple-600 mt-1">
                        💳 الدفعة الأولى عند القبول: {installments[selectedQuote.id][0]?.amount.toLocaleString()} ر.س فقط
                      </p>
                    )}
                  </div>
                  <span className="text-3xl font-black text-green-600">{formatPrice(selectedQuote.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-slate-50 flex gap-3">
              <button
                onClick={() => setShowQuoteModal(false)}
                className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300 transition-colors"
              >
                إغلاق
              </button>
              {isQuoteValid(selectedQuote.valid_until) && (
                <button
                  onClick={() => handleAcceptQuote(selectedQuote)}
                  disabled={acceptingQuote === selectedQuote.id}
                  className="flex-1 py-3 bg-gradient-to-l from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {acceptingQuote === selectedQuote.id ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      جاري القبول...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      قبول هذا العرض
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
