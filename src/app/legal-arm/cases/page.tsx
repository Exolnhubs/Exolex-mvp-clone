'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { 
  Scale, Search, Filter, Eye, Calendar, Clock,
  FileText, Users, AlertCircle, ChevronLeft, ChevronRight,
  Gavel, Building2, User, Briefcase, TrendingUp
} from 'lucide-react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════
// ⚖️ إدارة القضايا - الشريك القانوني
// ═══════════════════════════════════════════════════════════════

const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: 'جديدة', color: 'bg-gray-100 text-gray-700' },
  registered: { label: 'مسجلة', color: 'bg-indigo-100 text-indigo-700' },
  active: { label: 'نشطة', color: 'bg-emerald-100 text-emerald-700' },
  under_consideration: { label: 'منظورة', color: 'bg-emerald-100 text-emerald-700' },
  postponed: { label: 'مؤجلة', color: 'bg-orange-100 text-orange-700' },
  pleading: { label: 'مرافعة', color: 'bg-purple-100 text-purple-700' },
  pending_judgment: { label: 'بانتظار حكم', color: 'bg-yellow-100 text-yellow-700' },
  awaiting_verdict: { label: 'بانتظار الحكم', color: 'bg-yellow-100 text-yellow-700' },
  judged: { label: 'محكوم فيها', color: 'bg-teal-100 text-teal-700' },
  won: { label: 'كسبناها', color: 'bg-green-100 text-green-700' },
  lost: { label: 'خسرناها', color: 'bg-red-100 text-red-700' },
  appealed: { label: 'مستأنفة', color: 'bg-amber-100 text-amber-700' },
  appeal_verdict: { label: 'حكم استئناف', color: 'bg-cyan-100 text-cyan-700' },
  completed: { label: 'مكتملة', color: 'bg-green-100 text-green-700' },
  closed: { label: 'منتهية', color: 'bg-gray-100 text-gray-700' },
}

const domainConfig: Record<string, { label: string; color: string }> = {
  labor: { label: 'عمالي', color: 'bg-emerald-500' },
  family: { label: 'أحوال شخصية', color: 'bg-pink-500' },
  commercial: { label: 'تجاري', color: 'bg-emerald-500' },
  civil: { label: 'مدني', color: 'bg-purple-500' },
  criminal: { label: 'جزائي', color: 'bg-red-500' },
  administrative: { label: 'إداري', color: 'bg-amber-500' },
}

export default function PartnerCasesPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [cases, setCases] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  
  // الفلاتر
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDomain, setFilterDomain] = useState('')
  const [filterLawyer, setFilterLawyer] = useState('')
  
  // الترقيم
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const partnerId = localStorage.getItem('exolex_arm_id')
      if (!partnerId) return

      // جلب القضايا مع العلاقات
      const { data: casesData, error } = await supabase
        .from('case_management')
        .select(`
          *,
          assigned_lawyer:assigned_lawyer_id(id, full_name),
          sessions:case_sessions(count)
        `)
        .eq('arm_id', partnerId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCases(casesData || [])

      // جلب الموظفين للفلتر
      const { data: empsData } = await supabase
        .from('lawyers')
        .select('id, full_name')
        .eq('arm_id', partnerId)
        .eq('status', 'active')

      setEmployees(empsData || [])

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // الفلترة
  const filteredCases = cases.filter(c => {
    const matchesSearch = !searchQuery || 
      c.court_case_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.plaintiff_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.defendant_name?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !filterStatus || c.court_status === filterStatus
    const matchesDomain = !filterDomain || c.domain === filterDomain
    const matchesLawyer = !filterLawyer || c.assigned_lawyer_id === filterLawyer
    return matchesSearch && matchesStatus && matchesDomain && matchesLawyer
  })

  // الترقيم
  const totalPages = Math.ceil(filteredCases.length / itemsPerPage)
  const paginatedCases = filteredCases.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // الإحصائيات
  const stats = {
    total: cases.length,
    active: cases.filter(c => ['active', 'under_consideration', 'pleading'].includes(c.court_status)).length,
    pending: cases.filter(c => ['pending_judgment', 'awaiting_verdict'].includes(c.court_status)).length,
    won: cases.filter(c => c.court_status === 'won').length,
    upcomingSessions: cases.filter(c => c.next_session_date && new Date(c.next_session_date) >= new Date()).length,
  }

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-700' }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    )
  }

  const getDomainBadge = (domain: string) => {
    const config = domainConfig[domain] || { label: domain, color: 'bg-gray-500' }
    return (
      <span className={`px-2 py-0.5 rounded text-xs text-white ${config.color}`}>
        {config.label}
      </span>
    )
  }

  const formatDate = (date: string) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('ar-SA')
  }

  const getDaysUntil = (date: string) => {
    if (!date) return null
    const diff = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">⚖️ إدارة القضايا</h1>
          <p className="text-slate-500 mt-1">إجمالي {stats.total} قضية</p>
        </div>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Scale className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">إجمالي القضايا</p>
              <p className="text-xl font-bold text-slate-800">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">قضايا نشطة</p>
              <p className="text-xl font-bold text-slate-800">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">بانتظار حكم</p>
              <p className="text-xl font-bold text-slate-800">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">قضايا مكسوبة</p>
              <p className="text-xl font-bold text-slate-800">{stats.won}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">جلسات قادمة</p>
              <p className="text-xl font-bold text-slate-800">{stats.upcomingSessions}</p>
            </div>
          </div>
        </div>
      </div>

      {/* الفلاتر */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="بحث برقم القضية أو اسم الطرف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white"
          >
            <option value="">كل الحالات</option>
            {Object.entries(statusConfig).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <select
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white"
          >
            <option value="">كل المجالات</option>
            {Object.entries(domainConfig).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <select
            value={filterLawyer}
            onChange={(e) => setFilterLawyer(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white"
          >
            <option value="">كل المحامين</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* جدول القضايا */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {paginatedCases.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">رقم القضية</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">المجال</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الأطراف</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">المحكمة</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">المحامي</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الجلسة القادمة</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الحالة</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedCases.map(caseItem => {
                    const daysUntil = getDaysUntil(caseItem.next_session_date)
                    return (
                      <tr key={caseItem.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-slate-800">{caseItem.court_case_number || '-'}</p>
                            <p className="text-xs text-slate-500">{formatDate(caseItem.filing_date)}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {caseItem.domain ? getDomainBadge(caseItem.domain) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <p className="text-slate-700 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {caseItem.plaintiff_name || 'المدعي'}
                            </p>
                            <p className="text-slate-500 flex items-center gap-1">
                              <span className="text-xs">ضد</span>
                              {caseItem.defendant_name || 'المدعى عليه'}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <p className="text-slate-700">{caseItem.court_name || '-'}</p>
                            <p className="text-xs text-slate-500">{caseItem.court_city}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {caseItem.assigned_lawyer?.full_name || '-'}
                        </td>
                        <td className="px-4 py-3">
                          {caseItem.next_session_date ? (
                            <div className="text-sm">
                              <p className="text-slate-700">{formatDate(caseItem.next_session_date)}</p>
                              {daysUntil !== null && daysUntil >= 0 && daysUntil <= 7 && (
                                <p className={`text-xs ${daysUntil <= 2 ? 'text-red-600' : 'text-amber-600'}`}>
                                  بعد {daysUntil} يوم
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(caseItem.court_status)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/partner/cases/${caseItem.id}`}
                            className="p-2 hover:bg-emerald-50 rounded-lg text-emerald-600 inline-flex"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* الترقيم */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  عرض {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredCases.length)} من {filteredCases.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-slate-600">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <Scale className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-800 mb-2">لا توجد قضايا</h3>
            <p className="text-slate-500">لم يتم العثور على قضايا مطابقة للبحث</p>
          </div>
        )}
      </div>

    </div>
  )
}
