'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getLawyerId } from '@/lib/cookies'

// ═══════════════════════════════════════════════════════════════
// ⚖️ صفحة القضايا - محامي الذراع القانوني
// 📅 تاريخ: 21 يناير 2026
// ═══════════════════════════════════════════════════════════════
// 📊 الجدول: case_management
// 🔗 الروابط: service_requests, calendar_events, members
// ═══════════════════════════════════════════════════════════════

export default function CasesPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [cases, setCases] = useState<any[]>([])
  const [sourceTab, setSourceTab] = useState<'exolex' | 'external'>('exolex')
  const [statusTab, setStatusTab] = useState<string>('all')
  const [categories, setCategories] = useState<any[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const lawyerId = getLawyerId()
      if (!lawyerId) { router.push('/auth/lawyer-login'); return }

      // التحقق من نوع المحامي
      const { data: lawyerCheck } = await supabase
        .from('lawyers')
        .select('lawyer_type')
        .eq('id', lawyerId)
        .single()

      if (lawyerCheck?.lawyer_type !== 'legal_arm') {
        router.push('/auth/lawyer-login')
        return
      }

      // جلب التصنيفات
      const { data: catData } = await supabase
        .from('categories')
        .select('id, name_ar')
        .eq('is_active', true)
        .order('sort_order')
      setCategories(catData || [])

      // جلب القضايا المسندة للمحامي
      const { data: casesData } = await supabase
        .from('case_management')
        .select('*')
        .eq('assigned_lawyer_id', lawyerId)
        .order('created_at', { ascending: false })

      setCases(casesData || [])
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل القضايا')
    } finally {
      setIsLoading(false)
    }
  }

  // حساب عدد كل حالة
  const getStatusCount = (status: string) => {
    if (status === 'all') return cases.length
    if (status === 'active') return cases.filter(c => c.court_status === 'active').length
    if (status === 'waiting_session') return cases.filter(c => c.court_status === 'waiting_session' || c.next_session_date).length
    if (status === 'judgment') return cases.filter(c => c.court_status === 'judgment_issued' || c.judgment_date).length
    if (status === 'appeal') return cases.filter(c => c.is_appealed || c.appeal_status).length
    if (status === 'closed') return cases.filter(c => c.court_status === 'closed' || c.closed_at).length
    return 0
  }

  // تبويبات الحالات
  const statusTabs = [
    { key: 'all', label: 'الكل', icon: '📊' },
    { key: 'active', label: 'جارية', icon: '🔵' },
    { key: 'waiting_session', label: 'بانتظار جلسة', icon: '📅' },
    { key: 'judgment', label: 'صدر حكم', icon: '⚖️' },
    { key: 'appeal', label: 'استئناف', icon: '🔄' },
    { key: 'closed', label: 'مغلقة', icon: '✅' },
  ]

  // حالة القضية
  const getStatusBadge = (caseItem: any) => {
    if (caseItem.closed_at) return { text: 'مغلقة', color: 'bg-gray-100 text-gray-700', icon: '✅' }
    if (caseItem.is_appealed) return { text: 'استئناف', color: 'bg-purple-100 text-purple-700', icon: '🔄' }
    if (caseItem.judgment_date) return { text: 'صدر حكم', color: 'bg-amber-100 text-amber-700', icon: '⚖️' }
    if (caseItem.next_session_date) return { text: 'بانتظار جلسة', color: 'bg-blue-100 text-blue-700', icon: '📅' }
    return { text: 'جارية', color: 'bg-green-100 text-green-700', icon: '🔵' }
  }

  // الجلسة القادمة
  const getNextSession = (date: string) => {
    if (!date) return null
    const sessionDate = new Date(date)
    const now = new Date()
    const diffDays = Math.ceil((sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return { text: 'منتهية', color: 'text-red-600', date: sessionDate }
    if (diffDays === 0) return { text: 'اليوم', color: 'text-red-600', date: sessionDate }
    if (diffDays === 1) return { text: 'غداً', color: 'text-orange-600', date: sessionDate }
    if (diffDays <= 7) return { text: `بعد ${diffDays} أيام`, color: 'text-yellow-600', date: sessionDate }
    return { text: sessionDate.toLocaleDateString('ar-SA'), color: 'text-green-600', date: sessionDate }
  }

  // فلترة القضايا
  const filteredCases = cases.filter(caseItem => {
    // فلتر الحالة
    if (statusTab === 'active' && (caseItem.closed_at || caseItem.is_appealed || caseItem.judgment_date)) return false
    if (statusTab === 'waiting_session' && !caseItem.next_session_date) return false
    if (statusTab === 'judgment' && !caseItem.judgment_date) return false
    if (statusTab === 'appeal' && !caseItem.is_appealed) return false
    if (statusTab === 'closed' && !caseItem.closed_at) return false
    // فلتر التصنيف
    if (categoryFilter !== 'all' && caseItem.case_category !== categoryFilter) return false
    return true
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">⚖️ القضايا</h1>
              <p className="text-slate-500 mt-1">إدارة ومتابعة القضايا والترافع</p>
            </div>
            <button
              onClick={() => toast('🚧 قريباً - إضافة قضية لعميل خارجي')}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg flex items-center gap-2"
            >
              <span>➕</span>
              إضافة قضية
            </button>
          </div>
        </div>

        {/* الإحصائيات السريعة */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-slate-700">{cases.length}</div>
            <p className="text-xs text-slate-500">إجمالي القضايا</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-green-600">{getStatusCount('active')}</div>
            <p className="text-xs text-slate-500">جارية</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-blue-600">{getStatusCount('waiting_session')}</div>
            <p className="text-xs text-slate-500">بانتظار جلسة</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-amber-600">{getStatusCount('judgment')}</div>
            <p className="text-xs text-slate-500">صدر حكم</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-gray-600">{getStatusCount('closed')}</div>
            <p className="text-xs text-slate-500">مغلقة</p>
          </div>
        </div>

        {/* التبويب الرئيسي: ExoLex / خارجيين */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="flex border-b">
            <button
              onClick={() => setSourceTab('exolex')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-all ${
                sourceTab === 'exolex'
                  ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              🔵 مشتركي ExoLex
              <span className="mr-2 px-2 py-0.5 rounded-full text-xs bg-blue-100">{cases.length}</span>
            </button>
            <button
              onClick={() => setSourceTab('external')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-all ${
                sourceTab === 'external'
                  ? 'text-purple-600 border-b-2 border-purple-500 bg-purple-50'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              🟣 عملاء خارجيين
              <span className="mr-2 px-2 py-0.5 rounded-full text-xs bg-purple-100">قريباً</span>
            </button>
          </div>
        </div>

        {/* محتوى ExoLex */}
        {sourceTab === 'exolex' && (
          <>
            {/* تبويبات الحالات */}
            <div className="bg-white rounded-xl shadow-sm p-2">
              <div className="flex flex-wrap gap-2">
                {statusTabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setStatusTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      statusTab === tab.key
                        ? 'bg-amber-500 text-white shadow-md'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      statusTab === tab.key ? 'bg-white/20' : 'bg-slate-200'
                    }`}>
                      {getStatusCount(tab.key)}
                    </span>
                  </button>
                ))}

                {/* فلتر التصنيف */}
                <div className="mr-auto">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="all">كل التصنيفات</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name_ar}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* قائمة القضايا */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {filteredCases.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {filteredCases.map((caseItem) => {
                    const status = getStatusBadge(caseItem)
                    const nextSession = getNextSession(caseItem.next_session_date)
                    return (
                      <Link
                        key={caseItem.id}
                        href={`/legal-arm-lawyer/cases/${caseItem.id}`}
                        className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          {/* أيقونة */}
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                            caseItem.sla_breached ? 'bg-red-100' : 'bg-slate-100'
                          }`}>
                            ⚖️
                          </div>
                          
                          {/* التفاصيل */}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-slate-500">
                                {caseItem.court_case_number || '---'}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
                                {status.icon} {status.text}
                              </span>
                              {caseItem.sla_breached && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">🔴 متأخر</span>
                              )}
                            </div>
                            <h3 className="font-medium text-slate-800 mt-1">
                              {caseItem.case_type || caseItem.domain || 'قضية'}
                            </h3>
                            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                              <span>🏛️ {caseItem.court_name || '---'}</span>
                              <span>📍 {caseItem.court_city || '---'}</span>
                            </div>
                            {/* أطراف الدعوى - مكشوفة للقضايا */}
                            <div className="flex items-center gap-3 mt-1 text-sm">
                              <span className="text-green-600">👤 {caseItem.plaintiff_name || 'المدعي'}</span>
                              <span className="text-slate-400">ضد</span>
                              <span className="text-red-600">👤 {caseItem.defendant_name || 'المدعى عليه'}</span>
                            </div>
                          </div>
                        </div>

                        {/* الجانب الأيسر */}
                        <div className="flex items-center gap-6">
                          {/* الجلسة القادمة */}
                          {nextSession && (
                            <div className="text-center">
                              <span className={`text-sm font-medium ${nextSession.color}`}>
                                📅 {nextSession.text}
                              </span>
                              <p className="text-xs text-slate-400">الجلسة القادمة</p>
                            </div>
                          )}
                          
                          {/* مبلغ المطالبة */}
                          {caseItem.claim_amount > 0 && (
                            <div className="text-center">
                              <span className="text-sm font-bold text-emerald-600">
                                {caseItem.claim_amount?.toLocaleString()} ر.س
                              </span>
                              <p className="text-xs text-slate-400">المطالبة</p>
                            </div>
                          )}

                          {/* السهم */}
                          <span className="text-slate-400">←</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <span className="text-6xl block mb-4">⚖️</span>
                  <h3 className="text-xl font-bold text-slate-700">لا توجد قضايا</h3>
                  <p className="text-slate-400 mt-2">
                    {statusTab !== 'all' ? 'لا توجد قضايا في هذه الحالة' : 'ستظهر القضايا هنا عند فتحها'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* محتوى خارجيين */}
        {sourceTab === 'external' && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <span className="text-6xl block mb-4">🟣</span>
            <h3 className="text-xl font-bold text-slate-700">قضايا العملاء الخارجيين</h3>
            <p className="text-slate-400 mt-2">قريباً - إدارة قضايا عملائك الخاصين</p>
            <button
              onClick={() => toast('🚧 قريباً - إضافة قضية لعميل خارجي')}
              className="mt-6 px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg"
            >
              ➕ إضافة قضية لعميل خارجي
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
