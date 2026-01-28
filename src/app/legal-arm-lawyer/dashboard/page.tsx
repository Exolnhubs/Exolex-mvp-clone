'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getLawyerId } from '@/lib/cookies'
import toast from 'react-hot-toast'
import { RefreshCw } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// 📊 لوحة تحكم محامي الذراع القانوني
// 📅 تاريخ التحديث: 21 يناير 2026
// 🎯 التحديث: جلب التقييمات من request_reviews مباشرة
// ═══════════════════════════════════════════════════════════════

export default function ArmLawyerDashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [lawyer, setLawyer] = useState<any>(null)
  const [legalArm, setLegalArm] = useState<any>(null)
  
  const [stats, setStats] = useState({
    earnings: 0,
    rating: 0,
    ratingsCount: 0,
    upcomingSessions: 0,
    activeCases: 0,
    completed: 0,
    delayed: 0,
    myTasks: 0
  })
  
  // العروض والطلبات
  const [pendingQuotes, setPendingQuotes] = useState<any[]>([])
  const [newRequests, setNewRequests] = useState<any[]>([])
  const [packageRequests, setPackageRequests] = useState<any[]>([])
  const [platformRequests, setPlatformRequests] = useState<any[]>([])
  const [activeCases, setActiveCases] = useState<any[]>([])
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  
  const [activeTab, setActiveTab] = useState<'pending' | 'new'>('new')

  useEffect(() => { loadDashboardData() }, [])

  const loadDashboardData = async () => {
    try {
      const lawyerId = getLawyerId()
      if (!lawyerId) { router.push('/auth/lawyer-login'); return }

      // بيانات المحامي
      const { data: lawyerData } = await supabase
        .from('lawyers')
        .select('*, legal_arms(id, name_ar, logo_url)')
        .eq('id', lawyerId)
        .single()
      
      if (lawyerData) {
        setLawyer(lawyerData)
        if (lawyerData.legal_arms) setLegalArm(lawyerData.legal_arms)
      }

      // ═══════════════════════════════════════════════════════════════
      // 🔥 جلب التقييمات الفعلية من request_reviews
      // ═══════════════════════════════════════════════════════════════
      const { data: ratingsData } = await supabase
        .from('request_reviews')
        .select('lawyer_overall_rating, lawyer_rating')
        .eq('lawyer_id', lawyerId)

      let avgRating = 0
      let ratingsCount = 0
      if (ratingsData && ratingsData.length > 0) {
        ratingsCount = ratingsData.length
        const totalRating = ratingsData.reduce((sum, r) => {
          return sum + (r.lawyer_overall_rating || r.lawyer_rating || 0)
        }, 0)
        avgRating = Math.round((totalRating / ratingsCount) * 10) / 10
      }

      // الإحصائيات
      const { count: tasksCount } = await supabase
        .from('service_requests')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_lawyer_id', lawyerId)
        .in('status', ['assigned', 'in_progress'])

      const { count: completedCount } = await supabase
        .from('service_requests')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_lawyer_id', lawyerId)
        .eq('status', 'completed')

      const { data: casesData } = await supabase
        .from('case_management')
        .select('*')
        .eq('lawyer_id', lawyerId)
        .eq('status', 'active')

      const { count: sessionsCount } = await supabase
        .from('calendar_events')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', lawyerId)
        .eq('event_type', 'court_session')
        .gte('start_datetime', new Date().toISOString())

      // عروض بانتظار الترسية (العروض المقدمة من المحامي)
      const { data: quotesData } = await supabase
        .from('service_quotes')
        .select('*, service_requests(id, ticket_number, title)')
        .eq('lawyer_id', lawyerId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5)
      setPendingQuotes(quotesData || [])

      // طلبات جديدة (متاحة للقبول أو تقديم عرض)
      const { data: newReqData } = await supabase
        .from('service_requests')
        .select('id, ticket_number, title, base_price, created_at, priority')
        .neq('source', 'package')
        .is('assigned_lawyer_id', null)
        .in('status', ['pending_assignment', 'pending_quotes'])
        .order('created_at', { ascending: false })
        .limit(5)
      setNewRequests(newReqData || [])

      // طلبات الباقات (المسندة للمحامي)
      const { data: pkgData } = await supabase
        .from('service_requests')
        .select('id, ticket_number, title, status, sla_deadline, created_at, categories(name_ar)')
        .eq('assigned_lawyer_id', lawyerId)
        .eq('source', 'package')
        .in('status', ['assigned', 'in_progress'])
        .order('sla_deadline', { ascending: true })
        .limit(5)
      setPackageRequests(pkgData || [])

      // طلبات المنصة الموحدة (الخدمات الإضافية المتاحة)
      const { data: platformData } = await supabase
        .from('service_requests')
        .select('id, ticket_number, title, base_price, created_at')
        .neq('source', 'package')
        .is('assigned_lawyer_id', null)
        .in('status', ['pending_assignment', 'pending_quotes'])
        .order('created_at', { ascending: false })
        .limit(5)
      setPlatformRequests(platformData || [])

      // القضايا النشطة
      const { data: casesListData } = await supabase
        .from('case_management')
        .select('id, case_number, title, status, next_session_date, members(full_name)')
        .eq('lawyer_id', lawyerId)
        .eq('status', 'active')
        .order('next_session_date', { ascending: true })
        .limit(3)
      setActiveCases(casesListData || [])

      // الجلسات القادمة
      const { data: sessionsData } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('owner_id', lawyerId)
        .gte('start_datetime', new Date().toISOString())
        .order('start_datetime', { ascending: true })
        .limit(3)
      setUpcomingSessions(sessionsData || [])

      // الإشعارات
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', lawyerId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5)
      setNotifications(notifData || [])

      setStats({
        earnings: lawyerData?.total_earnings || 0,
        rating: avgRating,
        ratingsCount: ratingsCount,
        upcomingSessions: sessionsCount || 0,
        activeCases: casesData?.length || 0,
        completed: completedCount || 0,
        delayed: casesData?.filter((c: any) => c.is_delayed)?.length || 0,
        myTasks: tasksCount || 0
      })

    } catch (error) { 
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally { 
      setIsLoading(false) 
    }
  }

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `منذ ${days} يوم`
    if (hours > 0) return `منذ ${hours} ساعة`
    return `منذ ${minutes} دقيقة`
  }

  const getSLAStatus = (deadline: string) => {
    if (!deadline) return { text: '-', color: 'gray' }
    const hoursLeft = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursLeft < 0) return { text: 'متأخر!', color: 'red' }
    if (hoursLeft < 4) return { text: `${Math.floor(hoursLeft)}س`, color: 'red' }
    if (hoursLeft < 12) return { text: `${Math.floor(hoursLeft)}س`, color: 'yellow' }
    return { text: `${Math.floor(hoursLeft)}س`, color: 'green' }
  }

  // ═══════════════════════════════════════════════════════════════
  // دالة عرض النجوم
  // ═══════════════════════════════════════════════════════════════
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <span key={star} className={`text-sm ${star <= Math.round(rating) ? 'text-amber-400' : 'text-slate-300'}`}>★</span>
        ))}
      </div>
    )
  }

  if (isLoading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">الرئيسية</h1>
            <p className="text-slate-500">مرحباً، {lawyer?.full_name}</p>
          </div>
          <button 
            onClick={() => { setIsLoading(true); loadDashboardData() }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث
          </button>
        </div>

        {/* الإحصائيات */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl mb-1">💰</div>
            <div className="text-xl font-bold text-emerald-600">{stats.earnings.toLocaleString()}</div>
            <p className="text-xs text-slate-500">أرباحي (ر.س)</p>
          </div>
          
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 🔥 بطاقة التقييم المحدثة - تعرض المعدل الفعلي مع النجوم */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <Link href="/legal-arm-lawyer/ratings" className="bg-white rounded-xl p-4 shadow-sm text-center hover:shadow-md hover:border-amber-300 border-2 border-transparent transition-all cursor-pointer">
            <div className="text-2xl mb-1">⭐</div>
            <div className="text-xl font-bold text-yellow-600">{stats.rating > 0 ? stats.rating.toFixed(1) : '---'}</div>
            {stats.ratingsCount > 0 && (
              <div className="flex justify-center mt-1">
                {renderStars(stats.rating)}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {stats.ratingsCount > 0 ? `${stats.ratingsCount} تقييم` : 'لا توجد تقييمات'}
            </p>
          </Link>
          
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl mb-1">📅</div>
            <div className="text-xl font-bold text-blue-600">{stats.upcomingSessions}</div>
            <p className="text-xs text-slate-500">جلسات قادمة</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl mb-1">⚖️</div>
            <div className="text-xl font-bold text-purple-600">{stats.activeCases}</div>
            <p className="text-xs text-slate-500">قضايا</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl mb-1">✅</div>
            <div className="text-xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-slate-500">مكتملة</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl mb-1">⚠️</div>
            <div className="text-xl font-bold text-red-600">{stats.delayed}</div>
            <p className="text-xs text-slate-500">متأخرة</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl mb-1">📋</div>
            <div className="text-xl font-bold text-teal-600">{stats.myTasks}</div>
            <p className="text-xs text-slate-500">مهامي</p>
          </div>
        </div>

        {/* عروض بانتظار الترسية + طلبات جديدة */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-100">
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('pending')} 
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeTab === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}
              >
                🕐 عروض بانتظار الترسية
                {pendingQuotes.length > 0 && <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingQuotes.length}</span>}
              </button>
              <button 
                onClick={() => setActiveTab('new')} 
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeTab === 'new' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
              >
                🆕 طلبات جديدة
                {newRequests.length > 0 && <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full">{newRequests.length}</span>}
              </button>
            </div>
          </div>
          <div className="p-4">
            {activeTab === 'pending' ? (
              pendingQuotes.length > 0 ? (
                <div className="space-y-3">
                  {pendingQuotes.map((quote) => (
                    <div key={quote.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-amber-500 text-xl">🕐</span>
                        <div>
                          <p className="font-medium text-slate-800">{quote.service_requests?.title || 'عرض سعر'}</p>
                          <p className="text-sm text-slate-500">{quote.service_requests?.ticket_number}</p>
                        </div>
                      </div>
                      <span className="text-amber-600 font-bold">{quote.total_amount?.toLocaleString()} ر.س</span>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-8 text-slate-400">📭 لا توجد عروض بانتظار الترسية</div>
            ) : (
              newRequests.length > 0 ? (
                <div className="space-y-3">
                  {newRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${req.base_price ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                        <div>
                          <p className="font-medium text-slate-800">{req.title}</p>
                          <p className="text-sm text-slate-500">{req.ticket_number} • {getTimeAgo(req.created_at)}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${req.base_price ? 'text-green-600' : 'text-amber-600'}`}>
                        {req.base_price ? `${req.base_price.toLocaleString()} ر.س` : 'عرض سعر'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-8 text-slate-400">📭 لا توجد طلبات جديدة</div>
            )}
          </div>
          <div className="p-3 bg-slate-50 border-t text-center">
            <Link href="/legal-arm-lawyer/my-tasks" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">
              عرض جميع الطلبات ←
            </Link>
          </div>
        </div>

        {/* طلبات الباقات + طلبات المنصة */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* طلبات الباقات */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                📦 طلبات الباقات
                {packageRequests.length > 0 && <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">{packageRequests.length}</span>}
              </h2>
              <Link href="/legal-arm-lawyer/package-requests" className="text-emerald-600 text-sm">الكل ←</Link>
            </div>
            <div className="p-4">
              {packageRequests.length > 0 ? (
                <div className="space-y-3">
                  {packageRequests.map((req) => {
                    const sla = getSLAStatus(req.sla_deadline)
                    return (
                      <Link key={req.id} href={`/legal-arm-lawyer/my-tasks/${req.id}`} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                        <div>
                          <p className="font-medium text-slate-800">{req.title}</p>
                          <p className="text-sm text-slate-500">{req.ticket_number}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded font-medium ${sla.color === 'red' ? 'bg-red-100 text-red-700' : sla.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                          SLA: {sla.text}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              ) : <div className="text-center py-8 text-slate-400">📦 لا توجد طلبات باقات</div>}
            </div>
          </div>

          {/* طلبات المنصة الموحدة */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                🌐 طلبات المنصة الموحدة
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              </h2>
              <Link href="/marketplace/requests" className="text-emerald-600 text-sm">الكل ←</Link>
            </div>
            <div className="p-4">
              {platformRequests.length > 0 ? (
                <div className="space-y-3">
                  {platformRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${req.base_price ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                        <div>
                          <p className="font-medium text-slate-800">{req.title}</p>
                          <p className="text-sm text-slate-500">{getTimeAgo(req.created_at)}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${req.base_price ? 'text-green-600' : 'text-amber-600'}`}>
                        {req.base_price ? `${req.base_price.toLocaleString()} ر.س` : 'عرض سعر'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-8 text-slate-400">🌐 لا توجد طلبات متاحة</div>}
            </div>
          </div>
        </div>

        {/* القضايا + الإشعارات + الجلسات */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* القضايا النشطة */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">⚖️ القضايا النشطة</h2>
              <Link href="/legal-arm-lawyer/cases" className="text-emerald-600 text-sm">الكل ←</Link>
            </div>
            <div className="p-4">
              {activeCases.length > 0 ? (
                <div className="space-y-3">
                  {activeCases.map((c) => (
                    <Link key={c.id} href={`/legal-arm-lawyer/cases/${c.id}`} className="block p-3 bg-slate-50 rounded-lg hover:bg-slate-100">
                      <p className="font-medium text-slate-800">{c.title}</p>
                      <p className="text-sm text-slate-500">{c.case_number}</p>
                    </Link>
                  ))}
                </div>
              ) : <div className="text-center py-6 text-slate-400">لا توجد قضايا نشطة</div>}
            </div>
          </div>

          {/* آخر الإشعارات */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">🔔 آخر الإشعارات</h2>
              <Link href="/legal-arm-lawyer/notifications" className="text-emerald-600 text-sm">الكل ←</Link>
            </div>
            <div className="p-4">
              {notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((n) => (
                    <div key={n.id} className="p-3 bg-slate-50 rounded-lg">
                      <p className="font-medium text-slate-800 text-sm">{n.title}</p>
                      <p className="text-xs text-slate-500">{getTimeAgo(n.created_at)}</p>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-6 text-slate-400">لا توجد إشعارات</div>}
            </div>
          </div>

          {/* الجلسات القادمة */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">📅 الجلسات القادمة</h2>
              <Link href="/legal-arm-lawyer/calendar" className="text-emerald-600 text-sm">التقويم ←</Link>
            </div>
            <div className="p-4">
              {upcomingSessions.length > 0 ? (
                <div className="space-y-3">
                  {upcomingSessions.map((s) => (
                    <div key={s.id} className="p-3 bg-slate-50 rounded-lg">
                      <p className="font-medium text-slate-800 text-sm">{s.title}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(s.start_datetime).toLocaleDateString('ar-SA')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-6 text-slate-400">لا توجد جلسات قادمة</div>}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
