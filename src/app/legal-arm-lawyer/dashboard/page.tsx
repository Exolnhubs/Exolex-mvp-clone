'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════
// 📌 لوحة تحكم محامي الذراع القانوني
// 📅 تاريخ التحديث: 12 يناير 2026
// 🎯 الغرض: عرض الإحصائيات + طلبات المنصة الجديدة (حسب التصميم)
// ═══════════════════════════════════════════════════════════════

interface PlatformRequest {
  id: string
  ticket_number: string
  title: string
  base_price: number | null
  created_at: string
  deadline?: string
}

interface Stats {
  newRequests: number
  inProgress: number
  overdueSLA: number
  activeCases: number
  rating: number
  ratingCount: number
}

export default function LegalArmLawyerDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lawyerId, setLawyerId] = useState<string | null>(null)
  const [lawyerName, setLawyerName] = useState('')
  
  const [platformRequests, setPlatformRequests] = useState<PlatformRequest[]>([])
  const [stats, setStats] = useState<Stats>({
    newRequests: 0,
    inProgress: 0,
    overdueSLA: 0,
    activeCases: 0,
    rating: 0,
    ratingCount: 0
  })
  
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    const id = localStorage.getItem('exolex_lawyer_id')
    if (!id) {
      router.push('/auth/lawyer-login')
      return
    }
    setLawyerId(id)
    loadAllData(id)
    
    // Real-time subscription
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => {
        loadPlatformRequests()
      })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [])

  const loadAllData = async (id: string) => {
    setLoading(true)
    await Promise.all([
      loadLawyerInfo(id),
      loadPlatformRequests(),
      loadStats(id),
      loadUpcomingSessions(id),
      loadNotifications(id)
    ])
    setLoading(false)
  }

  const loadLawyerInfo = async (id: string) => {
    const { data } = await supabase.from('lawyers').select('full_name').eq('id', id).single()
    if (data) setLawyerName(data.full_name)
  }

  const loadPlatformRequests = async () => {
    const { data } = await supabase
      .from('service_requests')
      .select('id, ticket_number, title, base_price, created_at, sla_deadline')
      .in('status', ['pending_assignment', 'pending_quotes', 'assigned_to_arm'])
      .order('created_at', { ascending: false })
      .limit(5)
    
    setPlatformRequests((data || []).map(r => ({
      id: r.id,
      ticket_number: r.ticket_number,
      title: r.title,
      base_price: r.base_price,
      created_at: r.created_at,
      deadline: r.sla_deadline
    })))
  }

  const loadStats = async (id: string) => {
    // إحصائيات الطلبات
    const { count: newCount } = await supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending_assignment', 'pending_quotes'])
    
    const { count: progressCount } = await supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_lawyer_id', id)
      .eq('status', 'in_progress')
    
    const { count: overdueCount } = await supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_lawyer_id', id)
      .lt('sla_deadline', new Date().toISOString())
      .not('status', 'in', '("completed","cancelled")')
    
    const { count: casesCount } = await supabase
      .from('case_management')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_lawyer_id', id)
      .in('status', ['active', 'in_progress'])
    
    // التقييم
    const { data: lawyer } = await supabase
      .from('lawyers')
      .select('avg_rating, rating_count')
      .eq('id', id)
      .single()
    
    setStats({
      newRequests: newCount || 0,
      inProgress: progressCount || 0,
      overdueSLA: overdueCount || 0,
      activeCases: casesCount || 0,
      rating: lawyer?.avg_rating || 0,
      ratingCount: lawyer?.rating_count || 0
    })
  }

  const loadUpcomingSessions = async (id: string) => {
    const { data } = await supabase
      .from('case_sessions')
      .select('id, session_date, session_time, case_id, notes')
      .eq('lawyer_id', id)
      .gte('session_date', new Date().toISOString().split('T')[0])
      .order('session_date', { ascending: true })
      .limit(3)
    
    setUpcomingSessions(data || [])
  }

  const loadNotifications = async (id: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, type, created_at, is_read')
      .eq('recipient_id', id)
      .order('created_at', { ascending: false })
      .limit(3)
    
    setNotifications(data || [])
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadPlatformRequests()
    setRefreshing(false)
  }

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) return `منذ ${hours} ساعة`
    if (minutes > 0) return `منذ ${minutes} دقيقة`
    return 'الآن'
  }

  const getDeadlineText = (deadline?: string) => {
    if (!deadline) return null
    const now = new Date()
    const deadlineDate = new Date(deadline)
    const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return { text: 'منتهي', color: 'text-red-600' }
    if (diffDays === 0) return { text: 'اليوم', color: 'text-red-600' }
    if (diffDays === 1) return { text: 'غداً', color: 'text-orange-600' }
    return { text: `متبقي: ${diffDays} أيام`, color: 'text-orange-600' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* قسم طلبات المنصة الجديدة */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              {platformRequests.length}
            </span>
            <h3 className="text-xl font-bold text-gray-800">طلبات المنصة الجديدة</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-gray-600">تحديث تلقائي</span>
            </div>
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-gray-100 transition-all"
            >
              <span className={`text-gray-600 ${refreshing ? 'animate-spin' : ''}`}>🔄</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {platformRequests.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">📭</div>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">لا توجد طلبات جديدة</h4>
              <p className="text-gray-500">ستظهر الطلبات الجديدة هنا فور وصولها</p>
            </div>
          ) : (
            platformRequests.map((req) => {
              const deadline = getDeadlineText(req.deadline)
              return (
                <div key={req.id} className="p-6 hover:bg-gray-50 transition-all cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <span className={`w-3 h-3 rounded-full ${req.base_price ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-gray-800 mb-1">{req.title || 'طلب خدمة قانونية'}</h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className={`font-bold ${req.base_price ? 'text-amber-700' : 'text-blue-600'}`}>
                            {req.base_price ? `${req.base_price.toLocaleString()} ر.س` : 'عرض سعر'}
                          </span>
                          <span className="flex items-center gap-1">
                            <span>🕐</span>
                            {getTimeAgo(req.created_at)}
                          </span>
                          {deadline && (
                            <span className={`flex items-center gap-1 ${deadline.color}`}>
                              <span>⏳</span>
                              {deadline.text}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/legal-arm-lawyer/requests/${req.id}`}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all"
                      >
                        تفاصيل
                      </Link>
                      {req.base_price ? (
                        <button className="px-4 py-2 bg-amber-600 rounded-lg text-sm font-semibold text-white hover:bg-amber-700 transition-all">
                          قبول
                        </button>
                      ) : (
                        <button className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-semibold text-white hover:bg-blue-700 transition-all">
                          تقديم عرض
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* بطاقات الإحصائيات */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-5 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-blue-600 text-xl">📋</span>
            </div>
            <span className="text-xs text-green-600 font-semibold">+0%</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-800 mb-1">{stats.newRequests}</h3>
          <p className="text-sm text-gray-600">طلبات جديدة</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <span className="text-amber-600 text-xl">⏳</span>
            </div>
            <span className="text-xs text-blue-600 font-semibold">+0%</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-800 mb-1">{stats.inProgress}</h3>
          <p className="text-sm text-gray-600">قيد التنفيذ</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-red-600 text-xl">⚠️</span>
            </div>
            <span className="text-xs text-red-600 font-semibold">-0%</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-800 mb-1">{stats.overdueSLA}</h3>
          <p className="text-sm text-gray-600">متأخرة SLA</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-purple-600 text-xl">⚖️</span>
            </div>
            <span className="text-xs text-green-600 font-semibold">+0%</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-800 mb-1">{stats.activeCases}</h3>
          <p className="text-sm text-gray-600">قضايا نشطة</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-yellow-600 text-xl">⭐</span>
            </div>
          </div>
          <h3 className="text-3xl font-bold text-gray-800 mb-1">{stats.rating.toFixed(1)}</h3>
          <p className="text-sm text-gray-600">تقييمي ({stats.ratingCount} تقييم)</p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* الجلسات والإشعارات والقضايا */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-3 gap-6">
        
        {/* الجلسات القادمة */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">📅 الجلسات القادمة</h3>
            <Link href="/legal-arm-lawyer/calendar" className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
              عرض التقويم ←
            </Link>
          </div>
          <div className="p-6">
            {upcomingSessions.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl block mb-2">📅</span>
                <p className="text-gray-500 text-sm">لا توجد جلسات قادمة</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingSessions.map((session) => (
                  <div key={session.id} className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-semibold text-gray-800">{session.notes || 'جلسة محكمة'}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(session.session_date).toLocaleDateString('ar-SA')} - {session.session_time}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* الإشعارات */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">🔔 آخر الإشعارات</h3>
            <Link href="/legal-arm-lawyer/notifications" className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
              عرض الكل ←
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <span className="text-4xl block mb-2">🔔</span>
                <p className="text-gray-500 text-sm">لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className="p-6 hover:bg-gray-50 transition-all cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      notif.type === 'request' ? 'bg-blue-100' :
                      notif.type === 'case' ? 'bg-amber-100' :
                      notif.type === 'rating' ? 'bg-purple-100' : 'bg-gray-100'
                    }`}>
                      <span>{
                        notif.type === 'request' ? '📋' :
                        notif.type === 'case' ? '⚖️' :
                        notif.type === 'rating' ? '⭐' : '🔔'
                      }</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-800 mb-1">{notif.message || notif.title}</p>
                      <span className="text-xs text-gray-500">{getTimeAgo(notif.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* القضايا النشطة */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">⚖️ القضايا النشطة</h3>
            <Link href="/legal-arm-lawyer/cases" className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
              عرض الكل ←
            </Link>
          </div>
          <div className="p-6">
            {stats.activeCases === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-gray-400 text-2xl">⚖️</span>
                </div>
                <p className="text-gray-500 text-sm">لا توجد قضايا نشطة حالياً</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-3xl font-bold text-gray-800">{stats.activeCases}</p>
                <p className="text-gray-600">قضية نشطة</p>
                <Link 
                  href="/legal-arm-lawyer/cases"
                  className="inline-block mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700"
                >
                  عرض القضايا
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* إحصائيات سريعة */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">إجمالي الأرباح</h3>
            <span className="text-2xl opacity-75">📈</span>
          </div>
          <p className="text-3xl font-bold mb-2">0 ر.س</p>
          <p className="text-sm opacity-90">هذا الشهر</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">معدل القبول</h3>
            <span className="text-2xl opacity-75">📊</span>
          </div>
          <p className="text-3xl font-bold mb-2">0%</p>
          <p className="text-sm opacity-90">من إجمالي العروض</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">وقت الاستجابة</h3>
            <span className="text-2xl opacity-75">⏱️</span>
          </div>
          <p className="text-3xl font-bold mb-2">- ساعة</p>
          <p className="text-sm opacity-90">متوسط الرد</p>
        </div>
      </section>

    </div>
  )
}
