'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getLawyerId } from '@/lib/cookies'

// ═══════════════════════════════════════════════════════════════
// ⚖️ قائمة القضايا - المحامي المستقل
// 📅 تاريخ: 21 يناير 2026
// 📝 عرض جميع القضايا المسندة للمحامي المستقل
// ═══════════════════════════════════════════════════════════════

export default function CasesPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [cases, setCases] = useState<any[]>([])
  const [filteredCases, setFilteredCases] = useState<any[]>([])
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadCases()
  }, [])

  useEffect(() => {
    filterCases()
  }, [cases, activeFilter, searchTerm])

  const loadCases = async () => {
    try {
      const lawyerId = getLawyerId()
      if (!lawyerId) {
        router.push('/auth/lawyer-login')
        return
      }

      // التحقق من نوع المحامي
      const { data: lawyerData } = await supabase
        .from('lawyers')
        .select('lawyer_type')
        .eq('id', lawyerId)
        .single()

      if (lawyerData?.lawyer_type !== 'independent') {
        router.push('/auth/lawyer-login')
        return
      }

      // جلب القضايا
      const { data: casesData, error } = await supabase
        .from('case_management')
        .select('*')
        .eq('assigned_lawyer_id', lawyerId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setCases(casesData || [])
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل القضايا')
    } finally {
      setIsLoading(false)
    }
  }

  const filterCases = () => {
    let result = [...cases]

    // فلترة حسب الحالة
    switch (activeFilter) {
      case 'ongoing':
        result = result.filter(c => !c.closed_at && !c.judgment_date && !c.is_appealed)
        break
      case 'pending_session':
        result = result.filter(c => c.next_session_date && !c.closed_at)
        break
      case 'judged':
        result = result.filter(c => c.judgment_date && !c.is_appealed && !c.closed_at)
        break
      case 'appealed':
        result = result.filter(c => c.is_appealed)
        break
      case 'closed':
        result = result.filter(c => c.closed_at)
        break
    }

    // فلترة حسب البحث
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(c =>
        c.court_case_number?.toLowerCase().includes(term) ||
        c.plaintiff_name?.toLowerCase().includes(term) ||
        c.defendant_name?.toLowerCase().includes(term) ||
        c.court_name?.toLowerCase().includes(term) ||
        c.court_city?.toLowerCase().includes(term)
      )
    }

    setFilteredCases(result)
  }

  const getStatusBadge = (caseItem: any) => {
    if (caseItem.closed_at) return { text: 'مغلقة', color: 'bg-gray-100 text-gray-700', icon: '✅' }
    if (caseItem.is_appealed) return { text: 'استئناف', color: 'bg-purple-100 text-purple-700', icon: '🔄' }
    if (caseItem.judgment_date) return { text: 'صدر حكم', color: 'bg-amber-100 text-amber-700', icon: '⚖️' }
    if (caseItem.next_session_date) return { text: 'بانتظار جلسة', color: 'bg-blue-100 text-blue-700', icon: '📅' }
    return { text: 'جارية', color: 'bg-green-100 text-green-700', icon: '🔵' }
  }

  const getNextSession = (date: string) => {
    if (!date) return null
    const sessionDate = new Date(date)
    const now = new Date()
    const diffDays = Math.ceil((sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return { text: 'منتهية', color: 'text-red-600' }
    if (diffDays === 0) return { text: 'اليوم!', color: 'text-red-600' }
    if (diffDays === 1) return { text: 'غداً', color: 'text-orange-600' }
    if (diffDays <= 7) return { text: `بعد ${diffDays} أيام`, color: 'text-yellow-600' }
    return { text: `${diffDays} يوم`, color: 'text-green-600' }
  }

  const filters = [
    { key: 'all', label: 'الكل', icon: '📋' },
    { key: 'ongoing', label: 'جارية', icon: '🔵' },
    { key: 'pending_session', label: 'بانتظار جلسة', icon: '📅' },
    { key: 'judged', label: 'صدر حكم', icon: '⚖️' },
    { key: 'appealed', label: 'استئناف', icon: '🔄' },
    { key: 'closed', label: 'مغلقة', icon: '✅' },
  ]

  // إحصائيات
  const stats = {
    total: cases.length,
    ongoing: cases.filter(c => !c.closed_at && !c.judgment_date && !c.is_appealed).length,
    pending: cases.filter(c => c.next_session_date && !c.closed_at).length,
    judged: cases.filter(c => c.judgment_date && !c.is_appealed && !c.closed_at).length,
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">جاري تحميل القضايا...</p>
        </div>
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
              <p className="text-slate-500 mt-1">إدارة ومتابعة القضايا المسندة إليك</p>
            </div>
            <Link
              href="/independent/dashboard"
              className="text-blue-600 hover:underline text-sm"
            >
              ← العودة للوحة التحكم
            </Link>
          </div>
        </div>

        {/* الإحصائيات */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <span className="text-3xl font-bold text-slate-800">{stats.total}</span>
            <p className="text-slate-500 text-sm mt-1">إجمالي القضايا</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <span className="text-3xl font-bold text-green-600">{stats.ongoing}</span>
            <p className="text-slate-500 text-sm mt-1">قضايا جارية</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <span className="text-3xl font-bold text-blue-600">{stats.pending}</span>
            <p className="text-slate-500 text-sm mt-1">بانتظار جلسة</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <span className="text-3xl font-bold text-amber-600">{stats.judged}</span>
            <p className="text-slate-500 text-sm mt-1">صدر حكم</p>
          </div>
        </div>

        {/* الفلاتر والبحث */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* التبويبات */}
            <div className="flex flex-wrap gap-2">
              {filters.map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeFilter === filter.key
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter.icon} {filter.label}
                  {filter.key === 'all' && ` (${cases.length})`}
                </button>
              ))}
            </div>

            {/* البحث */}
            <div className="relative w-full md:w-64">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث..."
                className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            </div>
          </div>
        </div>

        {/* قائمة القضايا */}
        {filteredCases.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <span className="text-6xl">📂</span>
            <h3 className="text-xl font-bold text-slate-700 mt-4">لا توجد قضايا</h3>
            <p className="text-slate-500 mt-2">
              {searchTerm ? 'لا توجد نتائج مطابقة للبحث' : 'ستظهر هنا القضايا عند فتحها'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCases.map((caseItem) => {
              const status = getStatusBadge(caseItem)
              const nextSession = getNextSession(caseItem.next_session_date)

              return (
                <Link
                  key={caseItem.id}
                  href={`/independent/cases/${caseItem.id}`}
                  className="block bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-slate-500">{caseItem.court_case_number || '---'}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${status.color}`}>
                          {status.icon} {status.text}
                        </span>
                        {caseItem.sla_breached && (
                          <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">🔴 متأخر</span>
                        )}
                      </div>
                      
                      <h3 className="text-lg font-bold text-slate-800">
                        {caseItem.case_type || caseItem.domain || 'قضية'}
                      </h3>
                      
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        <span>🏛️ {caseItem.court_name || '---'}</span>
                        <span>📍 {caseItem.court_city || '---'}</span>
                      </div>

                      {/* أطراف الدعوى */}
                      <div className="flex items-center gap-4 mt-3 text-sm">
                        <span className="text-green-600">👤 {caseItem.plaintiff_name || '---'}</span>
                        <span className="text-slate-400">ضد</span>
                        <span className="text-red-600">👤 {caseItem.defendant_name || '---'}</span>
                      </div>
                    </div>

                    {/* الجلسة القادمة */}
                    {nextSession && (
                      <div className="text-left px-4 py-2 bg-blue-50 rounded-lg">
                        <span className={`text-sm font-bold ${nextSession.color}`}>
                          📅 {nextSession.text}
                        </span>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(caseItem.next_session_date).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* معلومات إضافية */}
                  <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-100 text-sm text-slate-500">
                    {caseItem.claim_amount && (
                      <span>💰 المطالبة: {caseItem.claim_amount.toLocaleString()} ر.س</span>
                    )}
                    {caseItem.judgment_amount > 0 && (
                      <span>⚖️ المحكوم: {caseItem.judgment_amount.toLocaleString()} ر.س</span>
                    )}
                    <span>📅 {new Date(caseItem.created_at).toLocaleDateString('ar-SA')}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
