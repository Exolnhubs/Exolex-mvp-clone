'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getLawyerId } from '@/lib/cookies'
import toast from 'react-hot-toast'

export default function IndependentDashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [lawyer, setLawyer] = useState<any>(null)
  const [isAvailable, setIsAvailable] = useState(true)
  
  const [stats, setStats] = useState({
    activeServices: 0,
    activeCases: 0,
    delayedCases: 0,
    completedThisMonth: 0,
    completedLastMonth: 0,
    rating: 0,
    ratingLastMonth: 0,
    totalRatings: 0,
    ratingsThisMonth: 0,
    earningsThisMonth: 0,
    earningsLastMonth: 0,
    pendingPayment: 0,
    slaCompliance: 0,
    totalSubscribersServed: 0
  })
  
  const [availableOffers, setAvailableOffers] = useState<any[]>([])
  const [quoteNeededOffers, setQuoteNeededOffers] = useState<any[]>([])
  const [activeRequests, setActiveRequests] = useState<any[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
  const [offersTab, setOffersTab] = useState<'available' | 'quote'>('available')

  useEffect(() => { loadDashboardData() }, [])

  const loadDashboardData = async () => {
    try {
      const lawyerId = getLawyerId()
      if (!lawyerId) { router.push('/auth/lawyer-login'); return }

      const { data: lawyerData } = await supabase.from('lawyers').select('*').eq('id', lawyerId).single()
      if (lawyerData) { setLawyer(lawyerData); setIsAvailable(lawyerData.is_available ?? true) }

      const { count: activeServicesCount } = await supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('assigned_lawyer_id', lawyerId).in('status', ['in_progress', 'pending_review'])

      const { data: casesData } = await supabase.from('case_management').select('*').eq('lawyer_id', lawyerId).eq('status', 'active')
      const activeCases = casesData?.length || 0
      const delayedCases = casesData?.filter(c => c.is_delayed)?.length || 0

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { count: completedCount } = await supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('assigned_lawyer_id', lawyerId).eq('status', 'completed').gte('completed_at', startOfMonth.toISOString())

      const { data: offersData } = await supabase.from('service_offers').select('*, category:required_category_id (id, name_ar)').eq('status', 'pending').order('created_at', { ascending: false }).limit(5)
      setAvailableOffers(offersData || [])

      const { data: requestsData } = await supabase.from('service_requests').select('*, category:category_id (name_ar)').eq('assigned_lawyer_id', lawyerId).in('status', ['in_progress', 'pending_review']).order('sla_deadline', { ascending: true }).limit(5)
      setActiveRequests(requestsData || [])

      const { data: eventsData } = await supabase.from('calendar_events').select('*').eq('lawyer_id', lawyerId).gte('start_time', new Date().toISOString()).order('start_time', { ascending: true }).limit(3)
      setUpcomingEvents(eventsData || [])

      setStats({
        activeServices: activeServicesCount || 0,
        activeCases,
        delayedCases,
        completedThisMonth: completedCount || 0,
        completedLastMonth: 0,
        rating: lawyerData?.average_rating || 4.5,
        ratingLastMonth: 4.7,
        totalRatings: 89,
        ratingsThisMonth: 12,
        earningsThisMonth: 15200,
        earningsLastMonth: 12700,
        pendingPayment: 8500,
        slaCompliance: 94,
        totalSubscribersServed: 42
      })
    } catch (error) { console.error('Error:', error); toast.error('حدث خطأ') } 
    finally { setIsLoading(false) }
  }

  const toggleAvailability = async () => {
    const newStatus = !isAvailable
    setIsAvailable(newStatus)
    const lawyerId = getLawyerId()
    if (lawyerId) {
      await supabase.from('lawyers').update({ is_available: newStatus }).eq('id', lawyerId)
      toast.success(newStatus ? '✅ أنت الآن متاح' : '⏸️ أنت الآن غير متاح')
    }
  }

  const getSLAStatus = (deadline: string) => {
    if (!deadline) return { text: '-', color: 'gray' }
    const hoursLeft = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursLeft < 0) return { text: 'متأخر!', color: 'red' }
    if (hoursLeft < 4) return { text: `${Math.floor(hoursLeft)}س`, color: 'red' }
    if (hoursLeft < 12) return { text: `${Math.floor(hoursLeft)}س`, color: 'yellow' }
    return { text: `${Math.floor(hoursLeft)}س`, color: 'green' }
  }

  if (isLoading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* الإحصائيات */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-3xl mb-2">📋</div>
            <div className="text-3xl font-bold text-blue-600">{stats.activeServices}</div>
            <p className="text-sm text-slate-500">خدمات نشطة</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-3xl mb-2">⚖️</div>
            <div className="text-3xl font-bold text-purple-600">{stats.activeCases}</div>
            <p className="text-sm text-slate-500">قضايا حالية</p>
            {stats.delayedCases > 0 && <p className="text-xs text-red-500">({stats.delayedCases} متأخرة)</p>}
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-3xl mb-2">✅</div>
            <div className="text-3xl font-bold text-green-600">{stats.completedThisMonth}</div>
            <p className="text-sm text-slate-500">مكتملة هذا الشهر</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-3xl mb-2">⭐</div>
            <div className="text-3xl font-bold text-yellow-600">{stats.rating.toFixed(1)}</div>
            <p className="text-sm text-slate-500">تقييمي</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-3xl mb-2">💰</div>
            <div className="text-2xl font-bold text-emerald-600">{stats.earningsThisMonth.toLocaleString()}</div>
            <p className="text-sm text-slate-500">ر.س هذا الشهر</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-3xl mb-2">⏱️</div>
            <div className="text-3xl font-bold text-cyan-600">{stats.slaCompliance}%</div>
            <p className="text-sm text-slate-500">التزام SLA</p>
          </div>
        </div>

        {/* العروض الجديدة */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">🆕 العروض الجديدة</h2>
              <Link href="/independent/offers" className="text-amber-600 hover:text-amber-700 text-sm">عرض الكل ←</Link>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setOffersTab('available')} className={`px-4 py-2 rounded-lg text-sm font-medium ${offersTab === 'available' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                🟢 عروض متاحة ({availableOffers.length})
              </button>
              <button onClick={() => setOffersTab('quote')} className={`px-4 py-2 rounded-lg text-sm font-medium ${offersTab === 'quote' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                📝 تحتاج عرض سعر ({quoteNeededOffers.length})
              </button>
            </div>
          </div>
          <div className="p-4">
            {offersTab === 'available' ? (
              availableOffers.length > 0 ? (
                <div className="space-y-3">
                  {availableOffers.map((offer) => (
                    <div key={offer.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-green-500 text-xl">🟢</span>
                        <div>
                          <p className="font-medium text-slate-800">{offer.service_name_ar || 'خدمة'}</p>
                          <p className="text-sm text-slate-500">{offer.price?.toLocaleString()} ر.س</p>
                        </div>
                      </div>
                      <Link href={`/independent/offers/${offer.id}`} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm">قبول</Link>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-8 text-slate-400">📭 لا توجد عروض متاحة</div>
            ) : (
              quoteNeededOffers.length > 0 ? (
                <div className="space-y-3">
                  {quoteNeededOffers.map((quote) => (
                    <div key={quote.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-amber-500 text-xl">📝</span>
                        <div>
                          <p className="font-medium text-slate-800">{quote.title || 'طلب عرض سعر'}</p>
                        </div>
                      </div>
                      <Link href={`/independent/offers/quote/${quote.id}`} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm">تقديم عرض</Link>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-8 text-slate-400">📭 لا توجد طلبات</div>
            )}
          </div>
        </div>

        {/* قيد التنفيذ */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">📋 قيد التنفيذ</h2>
            <Link href="/independent/requests" className="text-amber-600 hover:text-amber-700 text-sm">عرض الكل ←</Link>
          </div>
          <div className="p-4">
            {activeRequests.length > 0 ? (
              <div className="space-y-3">
                {activeRequests.map((request) => {
                  const sla = getSLAStatus(request.sla_deadline)
                  return (
                    <Link key={request.id} href={`/independent/requests/${request.id}`} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-xl">📋</span>
                        <div>
                          <p className="font-medium text-slate-800">{request.title || request.ticket_number}</p>
                          <p className="text-sm text-slate-500">{request.category?.name_ar || 'عام'}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded font-medium ${sla.color === 'red' ? 'bg-red-100 text-red-700' : sla.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                        ⏰ SLA: {sla.text}
                      </span>
                    </Link>
                  )
                })}
              </div>
            ) : <div className="text-center py-8 text-slate-400">✨ لا توجد طلبات قيد التنفيذ</div>}
          </div>
        </div>

        {/* التقييمات والإيرادات */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">⭐ تقييماتي</h2>
              <Link href="/independent/ratings" className="text-amber-600 text-sm">التفاصيل ←</Link>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-slate-600">هذا الشهر:</span><span className="font-bold text-yellow-600">{stats.rating.toFixed(1)} ⭐ ({stats.ratingsThisMonth} تقييم)</span></div>
              <div className="flex justify-between"><span className="text-slate-600">الإجمالي:</span><span className="font-bold text-slate-700">{stats.rating.toFixed(1)} ⭐ ({stats.totalRatings} تقييم)</span></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">💰 الإيرادات</h2>
              <Link href="/independent/earnings" className="text-amber-600 text-sm">التفاصيل ←</Link>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-slate-600">هذا الشهر:</span><span className="font-bold text-emerald-600">{stats.earningsThisMonth.toLocaleString()} ر.س</span></div>
              <div className="flex justify-between"><span className="text-slate-600">بانتظار التحويل:</span><span className="font-bold text-amber-600">{stats.pendingPayment.toLocaleString()} ر.س</span></div>
            </div>
          </div>
        </div>

        {/* التقويم */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">📅 التقويم القادم</h2>
            <Link href="/independent/calendar" className="text-amber-600 text-sm">عرض التقويم ←</Link>
          </div>
          <div className="p-4">
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map((event) => {
                  const eventDate = new Date(event.start_time)
                  const isToday = eventDate.toDateString() === new Date().toDateString()
                  return (
                    <div key={event.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                      <div className="text-center min-w-[60px]">
                        <div className={`text-xs font-medium ${isToday ? 'text-red-600' : 'text-slate-500'}`}>{isToday ? 'اليوم' : eventDate.toLocaleDateString('ar-SA', { weekday: 'short' })}</div>
                        <div className="text-sm font-bold text-slate-700">{eventDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">{event.title}</p>
                        {event.location && <p className="text-sm text-slate-500">📍 {event.location}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <div className="text-center py-8 text-slate-400">📅 لا توجد أحداث قادمة</div>}
          </div>
        </div>

        {/* إحصائية إضافية */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">👥</span>
              <div>
                <p className="text-amber-100 text-sm">المشتركون الذين خدمتهم</p>
                <p className="text-2xl font-bold">{stats.totalSubscribersServed} مشترك</p>
              </div>
            </div>
            <Link href="/independent/reports" className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm">عرض التقارير ←</Link>
          </div>
        </div>

      </div>
    </div>
  )
}
