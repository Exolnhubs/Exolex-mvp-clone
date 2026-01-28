'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getLawyerId } from '@/lib/cookies'

// ═══════════════════════════════════════════════════════════════
// 📨 صفحة العروض - المحامي المستقل
// 📅 تاريخ: 31 ديسمبر 2025
// 🎯 الغرض: عرض العروض المتاحة وطلبات عروض الأسعار
// ═══════════════════════════════════════════════════════════════
// 📊 الجداول المستخدمة:
//    - service_offers: عروض بسعر ثابت (قبول/رفض)
//    - service_quotes: عروض أسعار مقدمة من المحامي
//    - service_requests: الطلبات المرتبطة
//    - categories: تصنيفات الخدمات
// ═══════════════════════════════════════════════════════════════

export default function IndependentOffersPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'available' | 'quote_needed' | 'my_quotes'>('available')
  
  const [availableOffers, setAvailableOffers] = useState<any[]>([])
  const [quoteNeededRequests, setQuoteNeededRequests] = useState<any[]>([])
  const [myQuotes, setMyQuotes] = useState<any[]>([])
  const [lawyerId, setLawyerId] = useState<string | null>(null)
  const [lawyerCategories, setLawyerCategories] = useState<string[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const id = getLawyerId()
      if (!id) {
        router.push('/auth/lawyer-login')
        return
      }
      setLawyerId(id)

      // جلب تخصصات المحامي
      const { data: categoriesData } = await supabase
        .from('lawyer_categories')
        .select('category_id')
        .eq('lawyer_id', id)
        .eq('is_active', true)

      const categoryIds = categoriesData?.map(c => c.category_id) || []
      setLawyerCategories(categoryIds)

      // 1. العروض المتاحة
      const { data: offersData } = await supabase
        .from('service_offers')
        .select(`*, category:required_category_id (id, name_ar)`)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      const filteredOffers = offersData?.filter(offer => {
        if (!offer.required_category_id) return true
        return categoryIds.includes(offer.required_category_id)
      }) || []
      setAvailableOffers(filteredOffers)

      // 2. طلبات تحتاج عرض سعر
      const { data: requestsData } = await supabase
        .from('service_requests')
        .select(`*, category:category_id (id, name_ar)`)
        .eq('request_type', 'extra_service')
        .is('base_price', null)
        .in('status', ['pending', 'awaiting_quote'])
        .order('created_at', { ascending: false })

      const { data: existingQuotes } = await supabase
        .from('service_quotes')
        .select('request_id')
        .eq('lawyer_id', id)

      const quotedIds = existingQuotes?.map(q => q.request_id) || []
      const availableRequests = requestsData?.filter(req => 
        !quotedIds.includes(req.id) && (!req.category_id || categoryIds.includes(req.category_id))
      ) || []
      setQuoteNeededRequests(availableRequests)

      // 3. عروضي المقدمة
      const { data: myQuotesData } = await supabase
        .from('service_quotes')
        .select(`*, request:request_id (id, ticket_number, title, category:category_id (name_ar))`)
        .eq('lawyer_id', id)
        .order('created_at', { ascending: false })

      setMyQuotes(myQuotesData || [])

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAcceptOffer = async (offerId: string) => {
    if (!lawyerId) return
    try {
      const { data: offer } = await supabase
        .from('service_offers')
        .select('status, expires_at')
        .eq('id', offerId)
        .single()

      if (!offer || offer.status !== 'pending' || new Date(offer.expires_at) < new Date()) {
        toast.error('العرض لم يعد متاحاً')
        loadData()
        return
      }

      await supabase
        .from('service_offers')
        .update({ status: 'accepted', accepted_by: lawyerId, accepted_at: new Date().toISOString() })
        .eq('id', offerId)

      toast.success('✅ تم قبول العرض بنجاح!')
      loadData()
    } catch (error) {
      toast.error('حدث خطأ في قبول العرض')
    }
  }

  const getTimeRemaining = (expiresAt: string) => {
    const diffMs = new Date(expiresAt).getTime() - Date.now()
    if (diffMs <= 0) return { text: 'منتهي', color: 'red' }
    const hours = Math.floor(diffMs / 3600000)
    if (hours < 2) return { text: `${hours}س`, color: 'red' }
    if (hours < 24) return { text: `${hours}س`, color: 'yellow' }
    return { text: `${Math.floor(hours/24)}ي`, color: 'green' }
  }

  const getQuoteStatus = (status: string) => {
    const map: Record<string, {text: string, color: string}> = {
      'pending': { text: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-700' },
      'accepted': { text: 'مقبول ✅', color: 'bg-green-100 text-green-700' },
      'rejected': { text: 'مرفوض', color: 'bg-red-100 text-red-700' }
    }
    return map[status] || { text: status, color: 'bg-gray-100 text-gray-700' }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100" dir="rtl">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/independent/dashboard" className="text-slate-400 hover:text-slate-600">→ العودة</Link>
            <h1 className="text-xl font-bold text-slate-800">📨 العروض</h1>
          </div>
          <button onClick={loadData} className="text-amber-600 hover:text-amber-700 text-sm">🔄 تحديث</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* التبويبات */}
        <div className="bg-white rounded-xl shadow-sm mb-6 flex border-b">
          {[
            { key: 'available', icon: '🟢', label: 'عروض متاحة', count: availableOffers.length, color: 'green' },
            { key: 'quote_needed', icon: '📝', label: 'تحتاج عرض سعر', count: quoteNeededRequests.length, color: 'amber' },
            { key: 'my_quotes', icon: '📤', label: 'عروضي المقدمة', count: myQuotes.length, color: 'blue' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 px-6 py-4 text-center font-medium transition-all ${
                activeTab === tab.key
                  ? `text-${tab.color}-600 border-b-2 border-${tab.color}-500 bg-${tab.color}-50`
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="text-xl block mb-1">{tab.icon}</span>
              {tab.label}
              <span className={`mr-2 px-2 py-0.5 rounded-full text-xs ${activeTab === tab.key ? `bg-${tab.color}-200` : 'bg-slate-200'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* العروض المتاحة */}
        {activeTab === 'available' && (
          <div className="space-y-4">
            {availableOffers.length > 0 ? availableOffers.map(offer => {
              const time = getTimeRemaining(offer.expires_at)
              return (
                <div key={offer.id} className="bg-white rounded-xl shadow-sm p-5 border-r-4 border-green-500">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">🟢</span>
                        <h3 className="text-lg font-bold text-slate-800">{offer.service_name_ar}</h3>
                      </div>
                      <p className="text-slate-600 text-sm mb-3">{offer.description_ar || 'لا يوجد وصف'}</p>
                      <div className="flex gap-4 text-sm text-slate-500">
                        <span>📂 {offer.category?.name_ar || 'عام'}</span>
                        <span>💰 {offer.price?.toLocaleString()} ر.س</span>
                        <span>📅 {offer.execution_days} يوم</span>
                      </div>
                    </div>
                    <div className="text-left mr-4">
                      <div className={`text-sm mb-3 px-3 py-1 rounded-full ${
                        time.color === 'red' ? 'bg-red-100 text-red-700' :
                        time.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                      }`}>⏰ {time.text}</div>
                      <button onClick={() => handleAcceptOffer(offer.id)} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium">
                        ✅ قبول
                      </button>
                    </div>
                  </div>
                </div>
              )
            }) : (
              <div className="bg-white rounded-xl p-12 text-center">
                <span className="text-6xl block mb-4">📭</span>
                <h3 className="text-xl font-bold text-slate-700">لا توجد عروض متاحة</h3>
              </div>
            )}
          </div>
        )}

        {/* تحتاج عرض سعر */}
        {activeTab === 'quote_needed' && (
          <div className="space-y-4">
            {quoteNeededRequests.length > 0 ? quoteNeededRequests.map(req => (
              <div key={req.id} className="bg-white rounded-xl shadow-sm p-5 border-r-4 border-amber-500">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">📝</span>
                      <h3 className="text-lg font-bold text-slate-800">{req.title || req.ticket_number}</h3>
                      <span className="text-xs text-slate-400">#{req.ticket_number}</span>
                    </div>
                    <p className="text-slate-600 text-sm mb-3">{req.description || 'لا يوجد وصف'}</p>
                    <div className="flex gap-4 text-sm text-slate-500">
                      <span>📂 {req.category?.name_ar || 'عام'}</span>
                      <span>📅 {new Date(req.created_at).toLocaleDateString('ar-SA')}</span>
                    </div>
                  </div>
                  <Link href={`/independent/offers/quote/${req.id}`} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium">
                    📤 تقديم عرض
                  </Link>
                </div>
              </div>
            )) : (
              <div className="bg-white rounded-xl p-12 text-center">
                <span className="text-6xl block mb-4">✨</span>
                <h3 className="text-xl font-bold text-slate-700">لا توجد طلبات تحتاج عرض سعر</h3>
              </div>
            )}
          </div>
        )}

        {/* عروضي المقدمة */}
        {activeTab === 'my_quotes' && (
          <div className="space-y-4">
            {myQuotes.length > 0 ? myQuotes.map(quote => {
              const status = getQuoteStatus(quote.status)
              return (
                <div key={quote.id} className={`bg-white rounded-xl shadow-sm p-5 border-r-4 ${
                  quote.status === 'accepted' ? 'border-green-500' : quote.status === 'rejected' ? 'border-red-500' : 'border-blue-500'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">📤</span>
                        <h3 className="text-lg font-bold text-slate-800">{quote.request?.title || quote.request?.ticket_number}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${status.color}`}>{status.text}</span>
                      </div>
                      <p className="text-slate-600 text-sm mb-3">{quote.service_description}</p>
                      <div className="flex gap-4 text-sm text-slate-500">
                        <span>💰 {quote.price?.toLocaleString()} ر.س</span>
                        <span>💵 أرباحك: {quote.lawyer_earnings?.toLocaleString()} ر.س</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }) : (
              <div className="bg-white rounded-xl p-12 text-center">
                <span className="text-6xl block mb-4">📋</span>
                <h3 className="text-xl font-bold text-slate-700">لم تقدم أي عروض بعد</h3>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
