'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════
// 📌 صفحة عروضي - محامي الذراع القانوني
// 📅 تاريخ الإنشاء: 4 يناير 2026
// 🎯 الغرض: عرض وإدارة عروض الأسعار المرسلة
// ═══════════════════════════════════════════════════════════════
//
// 📋 التبويبات:
// - بانتظار الترسية: عروض أرسلتها (pending, expired, rejected)
// - المقبولة/المرساة: عروض تم قبولها (accepted)
//
// ⚠️ كل عنصر فيه إجراء
// ═══════════════════════════════════════════════════════════════

interface MyQuote {
  id: string
  quote_request_id: string
  request_number: string
  domain: string
  category: string
  description: string
  total_price: number
  total_with_vat: number
  status: string
  expires_at: string
  created_at: string
  responded_at?: string
  rejection_reason?: string
  // طلب تفاصيل من المشترك
  has_detail_request: boolean
  detail_request?: {
    id: string
    question: string
    created_at: string
  }
}

const tabs = [
  { id: 'pending', label: 'بانتظار الترسية' },
  { id: 'accepted', label: 'المقبولة / المرساة' },
]

export default function MyQuotesPage() {
  const router = useRouter()
  
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pending')
  const [quotes, setQuotes] = useState<MyQuote[]>([])
  const [tabCounts, setTabCounts] = useState({ pending: 0, accepted: 0 })
  
  // Modal الرد على طلب التفاصيل
  const [showReplyModal, setShowReplyModal] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<MyQuote | null>(null)
  const [replyText, setReplyText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ─────────────────────────────────────────────────────────────
  // جلب البيانات
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchMyQuotes = async () => {
      const lawyerId = localStorage.getItem('exolex_lawyer_id')
      
      if (!lawyerId) {
        router.push('/auth/lawyer-login')
        return
      }

      setIsLoading(true)

      try {
        // جلب عروض المحامي
        const { data: quotesData, error } = await supabase
          .from('lawyer_quotes')
          .select(`
            *,
            quote_requests (
              request_number,
              domain,
              category,
              description
            )
          `)
          .eq('lawyer_id', lawyerId)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('خطأ في جلب العروض:', error)
          setQuotes([])
          return
        }

        // جلب طلبات التفاصيل
        const quoteIds = quotesData?.map(q => q.id) || []
        let detailRequests: any[] = []
        
        if (quoteIds.length > 0) {
          const { data: detailData } = await supabase
            .from('quote_detail_requests')
            .select('*')
            .in('lawyer_quote_id', quoteIds)
            .eq('sender_type', 'member')
            .eq('status', 'pending')

          detailRequests = detailData || []
        }

        // تنسيق البيانات
        const formattedQuotes = (quotesData || []).map(q => ({
          id: q.id,
          quote_request_id: q.quote_request_id,
          request_number: q.quote_requests?.request_number || 'غير معروف',
          domain: q.quote_requests?.domain || '',
          category: q.quote_requests?.category || '',
          description: q.quote_requests?.description || '',
          total_price: q.total_price,
          total_with_vat: q.total_with_vat,
          status: q.status,
          expires_at: q.expires_at,
          created_at: q.created_at,
          responded_at: q.responded_at,
          rejection_reason: q.rejection_reason,
          has_detail_request: detailRequests.some(dr => dr.lawyer_quote_id === q.id),
          detail_request: detailRequests.find(dr => dr.lawyer_quote_id === q.id),
        }))

        setQuotes(formattedQuotes)

        // حساب الأعداد
        const pendingCount = formattedQuotes.filter(q => 
          ['pending', 'expired', 'rejected'].includes(q.status)
        ).length
        const acceptedCount = formattedQuotes.filter(q => q.status === 'accepted').length
        
        setTabCounts({ pending: pendingCount, accepted: acceptedCount })

      } catch (error) {
        console.error('خطأ:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMyQuotes()
  }, [router])

  // ─────────────────────────────────────────────────────────────
  // دوال مساعدة
  // ─────────────────────────────────────────────────────────────
  
  const getDomainAr = (domain: string) => {
    const domains: Record<string, string> = {
      'labor': 'عمالي',
      'family': 'أسري',
      'commercial': 'تجاري',
      'criminal': 'جنائي',
      'real_estate': 'عقاري',
      'administrative': 'إداري',
    }
    return domains[domain] || domain
  }

  const getStatusInfo = (status: string) => {
    const statuses: Record<string, { label: string; color: string; bg: string }> = {
      'pending': { label: 'بانتظار رد المشترك', color: 'text-amber-700', bg: 'bg-amber-100' },
      'accepted': { label: 'مقبول - تم الترسية', color: 'text-green-700', bg: 'bg-green-100' },
      'rejected': { label: 'مرفوض', color: 'text-red-700', bg: 'bg-red-100' },
      'expired': { label: 'انتهت الصلاحية', color: 'text-slate-700', bg: 'bg-slate-200' },
      'withdrawn': { label: 'تم سحبه', color: 'text-slate-700', bg: 'bg-slate-200' },
    }
    return statuses[status] || { label: status, color: 'text-slate-700', bg: 'bg-slate-100' }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('ar-SA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTimeRemaining = (expiresAt: string) => {
    if (!expiresAt) return { text: '-', expired: false }
    
    const now = new Date()
    const end = new Date(expiresAt)
    const diff = end.getTime() - now.getTime()
    
    if (diff < 0) return { text: 'انتهت', expired: true }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (days > 0) return { text: `${days} يوم`, expired: false }
    return { text: `${hours} ساعة`, expired: false }
  }

  // ─────────────────────────────────────────────────────────────
  // إجراءات
  // ─────────────────────────────────────────────────────────────

  // فتح modal الرد
  const openReplyModal = (quote: MyQuote) => {
    setSelectedQuote(quote)
    setReplyText('')
    setShowReplyModal(true)
  }

  // إرسال الرد على طلب التفاصيل
  const handleSubmitReply = async () => {
    if (!selectedQuote || !selectedQuote.detail_request || !replyText.trim()) {
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('quote_detail_requests')
        .update({
          answer: replyText.trim(),
          answered_at: new Date().toISOString(),
          status: 'answered',
        })
        .eq('id', selectedQuote.detail_request.id)

      if (error) throw error

      // تحديث القائمة
      setQuotes(prev => prev.map(q => 
        q.id === selectedQuote.id 
          ? { ...q, has_detail_request: false, detail_request: undefined }
          : q
      ))

      setShowReplyModal(false)
      alert('تم إرسال الرد بنجاح')
    } catch (error) {
      console.error('خطأ:', error)
      alert('حدث خطأ في إرسال الرد')
    } finally {
      setIsSubmitting(false)
    }
  }

  // سحب العرض
  const handleWithdrawQuote = async (quoteId: string) => {
    if (!confirm('هل أنت متأكد من سحب هذا العرض؟')) return

    try {
      const { error } = await supabase
        .from('lawyer_quotes')
        .update({ status: 'withdrawn' })
        .eq('id', quoteId)

      if (error) throw error

      setQuotes(prev => prev.map(q => 
        q.id === quoteId ? { ...q, status: 'withdrawn' } : q
      ))
      alert('تم سحب العرض')
    } catch (error) {
      console.error('خطأ:', error)
      alert('حدث خطأ')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // فلترة العروض حسب التبويب
  // ─────────────────────────────────────────────────────────────
  const filteredQuotes = quotes.filter(q => {
    if (activeTab === 'pending') {
      return ['pending', 'expired', 'rejected', 'withdrawn'].includes(q.status)
    }
    return q.status === 'accepted'
  })

  // فصل العروض النشطة عن المنتهية في تبويب "بانتظار"
  const activeQuotes = filteredQuotes.filter(q => q.status === 'pending')
  const inactiveQuotes = filteredQuotes.filter(q => ['expired', 'rejected', 'withdrawn'].includes(q.status))

  // ─────────────────────────────────────────────────────────────
  // شاشة التحميل
  // ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">جاري تحميل العروض...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* العنوان */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">عروضي</h1>
        <Link
          href="/legal-arm-lawyer/requests?status=quotes"
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors"
        >
          تصفح طلبات العروض
        </Link>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* التبويبات */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              {tabCounts[tab.id as keyof typeof tabCounts] > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {tabCounts[tab.id as keyof typeof tabCounts]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* قائمة العروض */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {filteredQuotes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <h3 className="text-xl font-semibold text-slate-700 mb-2">لا توجد عروض</h3>
          <p className="text-slate-500 mb-4">
            {activeTab === 'pending' 
              ? 'لم ترسل أي عروض بعد' 
              : 'لا توجد عروض مقبولة حالياً'}
          </p>
          <Link
            href="/legal-arm-lawyer/requests?status=quotes"
            className="inline-block px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors"
          >
            تصفح طلبات العروض
          </Link>
        </div>
      ) : activeTab === 'pending' ? (
        <div className="space-y-6">
          {/* العروض النشطة (بانتظار الرد) */}
          {activeQuotes.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-amber-700 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></span>
                بانتظار رد المشترك ({activeQuotes.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {activeQuotes.map((quote) => {
                  const statusInfo = getStatusInfo(quote.status)
                  const timeRemaining = getTimeRemaining(quote.expires_at)
                  
                  return (
                    <div
                      key={quote.id}
                      className="bg-white rounded-2xl shadow-sm border-2 border-amber-200 hover:border-amber-400 transition-all"
                    >
                      {/* Header */}
                      <div className="p-4 border-b border-amber-100 bg-amber-50 rounded-t-2xl">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{quote.request_number}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="p-4 space-y-3">
                        {/* طلب تفاصيل من المشترك */}
                        {quote.has_detail_request && quote.detail_request && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                              <span className="text-sm font-medium text-blue-700">طلب تفاصيل من المشترك</span>
                            </div>
                            <p className="text-sm text-blue-800 mb-2">"{quote.detail_request.question}"</p>
                            <button
                              onClick={() => openReplyModal(quote)}
                              className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              الرد على الاستفسار
                            </button>
                          </div>
                        )}

                        {/* المجال */}
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm">
                            {getDomainAr(quote.domain)}
                          </span>
                          {quote.category && (
                            <span className="px-2 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs">
                              {quote.category}
                            </span>
                          )}
                        </div>

                        {/* الوصف */}
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {quote.description}
                        </p>

                        {/* السعر */}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-sm">قيمة العرض:</span>
                          <span className="font-bold text-green-600">{quote.total_with_vat?.toLocaleString()} ر.س</span>
                        </div>

                        {/* التواريخ */}
                        <div className="flex items-center justify-between text-sm text-slate-500">
                          <span>تاريخ الإرسال: {formatDate(quote.created_at)}</span>
                          <span className={timeRemaining.expired ? 'text-red-500' : 'text-amber-600'}>
                            صالح: {timeRemaining.text}
                          </span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                        <div className="flex gap-2">
                          <Link
                            href={`/legal-arm-lawyer/requests?quote=${quote.quote_request_id}`}
                            className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium text-center transition-all text-sm"
                          >
                            عرض الطلب
                          </Link>
                          <button
                            onClick={() => handleWithdrawQuote(quote.id)}
                            className="px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-medium transition-all text-sm"
                          >
                            سحب العرض
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* العروض المنتهية/المرفوضة */}
          {inactiveQuotes.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-slate-500 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-slate-400 rounded-full"></span>
                منتهية أو مرفوضة ({inactiveQuotes.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {inactiveQuotes.map((quote) => {
                  const statusInfo = getStatusInfo(quote.status)
                  
                  return (
                    <div
                      key={quote.id}
                      className="bg-slate-100 rounded-2xl shadow-sm border border-slate-200 opacity-70"
                    >
                      <div className="p-4 border-b border-slate-200 bg-slate-200 rounded-t-2xl">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-600">{quote.request_number}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-slate-200 text-slate-600 rounded-lg text-sm">
                            {getDomainAr(quote.domain)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">قيمة العرض:</span>
                          <span className="text-slate-600">{quote.total_with_vat?.toLocaleString()} ر.س</span>
                        </div>
                        {quote.rejection_reason && (
                          <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                            سبب الرفض: {quote.rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        // ═══════════════════════════════════════════════════════════
        // تبويب المقبولة/المرساة
        // ═══════════════════════════════════════════════════════════
        <div className="grid gap-4 md:grid-cols-2">
          {filteredQuotes.map((quote) => {
            const statusInfo = getStatusInfo(quote.status)
            
            return (
              <div
                key={quote.id}
                className="bg-white rounded-2xl shadow-sm border-2 border-green-200 hover:border-green-400 transition-all"
              >
                <div className="p-4 border-b border-green-100 bg-green-50 rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{quote.request_number}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm">
                      {getDomainAr(quote.domain)}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 line-clamp-2">
                    {quote.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-sm">قيمة العرض:</span>
                    <span className="font-bold text-green-600">{quote.total_with_vat?.toLocaleString()} ر.س</span>
                  </div>

                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>تاريخ القبول: {formatDate(quote.responded_at || '')}</span>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                  <Link
                    href={`/legal-arm-lawyer/requests/${quote.quote_request_id}`}
                    className="block w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium text-center transition-all"
                  >
                    فتح الطلب
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Modal: الرد على طلب التفاصيل */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showReplyModal && selectedQuote && selectedQuote.detail_request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">الرد على استفسار المشترك</h2>
              <button
                onClick={() => setShowReplyModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* بيانات الطلب */}
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm text-slate-500 mb-1">رقم الطلب</p>
                <p className="font-medium">{selectedQuote.request_number}</p>
              </div>

              {/* السؤال */}
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-600 mb-1">استفسار المشترك:</p>
                <p className="text-blue-800">"{selectedQuote.detail_request.question}"</p>
                <p className="text-xs text-blue-500 mt-2">
                  {formatDateTime(selectedQuote.detail_request.created_at)}
                </p>
              </div>

              {/* الرد */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  ردك *
                </label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                  placeholder="اكتب ردك على استفسار المشترك..."
                />
              </div>

              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-sm text-amber-700">
                  ⚠️ تنبيه: لا تكتب معلومات التواصل الخاصة بك
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4 flex gap-3">
              <button
                onClick={() => setShowReplyModal(false)}
                className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmitReply}
                disabled={isSubmitting || !replyText.trim()}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'جاري الإرسال...' : 'إرسال الرد'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
