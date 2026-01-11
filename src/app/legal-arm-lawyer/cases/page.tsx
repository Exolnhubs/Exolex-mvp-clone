'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════
// 📌 صفحة القضايا - محامي الذراع القانوني
// 📅 تاريخ الإنشاء: 12 يناير 2026
// ═══════════════════════════════════════════════════════════════

interface Case {
  id: string
  case_number: string
  title: string
  client_name: string
  domain: string
  status: string
  court_name: string
  next_session_date: string | null
  created_at: string
  total_amount: number
}

type FilterType = 'all' | 'active' | 'pending' | 'closed'

export default function CasesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [cases, setCases] = useState<Case[]>([])
  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    loadCases()
  }, [])

  const loadCases = async () => {
    const lawyerId = localStorage.getItem('exolex_lawyer_id')
    if (!lawyerId) {
      router.push('/auth/lawyer-login')
      return
    }

    try {
      const { data, error } = await supabase
        .from('case_management')
        .select(`
          id,
          case_number,
          title,
          domain,
          status,
          court_name,
          next_session_date,
          created_at,
          total_amount,
          members (full_name)
        `)
        .eq('assigned_lawyer_id', lawyerId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setCases(data.map((c: any) => ({
          id: c.id,
          case_number: c.case_number || 'N/A',
          title: c.title || 'قضية',
          client_name: c.members?.full_name || 'عميل',
          domain: c.domain || 'عام',
          status: c.status || 'active',
          court_name: c.court_name || '',
          next_session_date: c.next_session_date,
          created_at: c.created_at,
          total_amount: c.total_amount || 0
        })))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return { label: 'نشطة', color: 'bg-green-100 text-green-700' }
      case 'in_progress': return { label: 'قيد النظر', color: 'bg-blue-100 text-blue-700' }
      case 'pending': return { label: 'معلقة', color: 'bg-yellow-100 text-yellow-700' }
      case 'closed': return { label: 'مغلقة', color: 'bg-gray-100 text-gray-700' }
      case 'won': return { label: 'مكسوبة', color: 'bg-emerald-100 text-emerald-700' }
      case 'lost': return { label: 'خاسرة', color: 'bg-red-100 text-red-700' }
      default: return { label: status, color: 'bg-gray-100 text-gray-700' }
    }
  }

  const getDomainAr = (domain: string) => {
    const domains: Record<string, string> = {
      labor: 'عمالي', family: 'أسري', commercial: 'تجاري', 
      criminal: 'جنائي', real_estate: 'عقاري', administrative: 'إداري'
    }
    return domains[domain] || domain
  }

  const filteredCases = cases.filter(c => {
    if (filter === 'all') return true
    if (filter === 'active') return c.status === 'active' || c.status === 'in_progress'
    if (filter === 'pending') return c.status === 'pending'
    if (filter === 'closed') return c.status === 'closed' || c.status === 'won' || c.status === 'lost'
    return true
  })

  const stats = {
    all: cases.length,
    active: cases.filter(c => c.status === 'active' || c.status === 'in_progress').length,
    pending: cases.filter(c => c.status === 'pending').length,
    closed: cases.filter(c => c.status === 'closed' || c.status === 'won' || c.status === 'lost').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-2">
        <div className="flex gap-2">
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              filter === 'all' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            الكل ({stats.all})
          </button>
          <button 
            onClick={() => setFilter('active')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              filter === 'active' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            نشطة ({stats.active})
          </button>
          <button 
            onClick={() => setFilter('pending')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              filter === 'pending' ? 'bg-yellow-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            معلقة ({stats.pending})
          </button>
          <button 
            onClick={() => setFilter('closed')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              filter === 'closed' ? 'bg-gray-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            مغلقة ({stats.closed})
          </button>
        </div>
      </div>

      {/* Cases List */}
      {filteredCases.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="text-5xl mb-4">⚖️</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">لا توجد قضايا</h3>
          <p className="text-gray-500">
            {filter === 'all' && 'لا توجد قضايا مسندة إليك حالياً'}
            {filter === 'active' && 'لا توجد قضايا نشطة'}
            {filter === 'pending' && 'لا توجد قضايا معلقة'}
            {filter === 'closed' && 'لا توجد قضايا مغلقة'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCases.map((caseItem) => {
            const status = getStatusBadge(caseItem.status)
            return (
              <div key={caseItem.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-600 text-xl">⚖️</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-800">{caseItem.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">{caseItem.case_number}</p>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">👤</span>
                          <span className="text-gray-700">{caseItem.client_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">📁</span>
                          <span className="text-gray-700">{getDomainAr(caseItem.domain)}</span>
                        </div>
                        {caseItem.court_name && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">🏛️</span>
                            <span className="text-gray-700">{caseItem.court_name}</span>
                          </div>
                        )}
                        {caseItem.next_session_date && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">📅</span>
                            <span className="text-amber-600 font-medium">
                              الجلسة: {new Date(caseItem.next_session_date).toLocaleDateString('ar-SA')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {caseItem.total_amount > 0 && (
                      <span className="text-xl font-bold text-gray-800">
                        {caseItem.total_amount.toLocaleString()} ر.س
                      </span>
                    )}
                    <Link
                      href={`/legal-arm-lawyer/cases/${caseItem.id}`}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition"
                    >
                      فتح القضية
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
