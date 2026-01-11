'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Clock, FileText, CheckCircle, AlertTriangle, Eye, RefreshCw, PlayCircle } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// 📌 صفحة مهامي - محامي الذراع القانوني
// 📅 تاريخ الإنشاء: 12 يناير 2026
// 🎯 الغرض: عرض المهام المسندة للمحامي
// ═══════════════════════════════════════════════════════════════

interface Task {
  id: string
  request_number: string
  title: string
  description: string
  status: string
  priority: string
  is_urgent: boolean
  sla_deadline: string
  created_at: string
  started_at: string | null
  member_code: string
  service_type: string
  domain: string
}

type FilterType = 'all' | 'in_progress' | 'overdue' | 'completed'

export default function LegalArmMyTasksPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all'
  
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterType>(initialFilter)

  useEffect(() => {
    fetchTasks()
  }, [])

  useEffect(() => {
    const urlFilter = searchParams.get('filter') as FilterType
    if (urlFilter) setFilter(urlFilter)
  }, [searchParams])

  const fetchTasks = async () => {
    const lawyerId = localStorage.getItem('exolex_lawyer_id')
    if (!lawyerId) {
      router.push('/auth/lawyer-login')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('requests')
        .select(`
          id,
          request_number,
          service_type,
          domain,
          status,
          priority,
          is_urgent,
          sla_deadline,
          created_at,
          started_at,
          description,
          members (member_code)
        `)
        .eq('assigned_lawyer_id', lawyerId)
        .in('status', ['new', 'in_progress', 'completed', 'overdue'])
        .order('created_at', { ascending: false })

      if (!error && data) {
        setTasks(data.map((t: any) => ({
          id: t.id,
          request_number: t.request_number,
          title: t.description?.slice(0, 50) || 'طلب خدمة',
          description: t.description,
          status: t.status,
          priority: t.priority,
          is_urgent: t.is_urgent,
          sla_deadline: t.sla_deadline,
          created_at: t.created_at,
          started_at: t.started_at,
          member_code: t.members?.member_code || 'USR-XXXXX',
          service_type: t.service_type,
          domain: t.domain
        })))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchTasks()
    setRefreshing(false)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new': return { label: 'جديد', color: 'bg-amber-100 text-amber-700', icon: <Clock className="w-4 h-4" /> }
      case 'in_progress': return { label: 'قيد التنفيذ', color: 'bg-blue-100 text-blue-700', icon: <PlayCircle className="w-4 h-4" /> }
      case 'completed': return { label: 'مكتمل', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-4 h-4" /> }
      case 'overdue': return { label: 'متأخر SLA', color: 'bg-red-100 text-red-700', icon: <AlertTriangle className="w-4 h-4" /> }
      default: return { label: status, color: 'bg-gray-100 text-gray-700', icon: <Clock className="w-4 h-4" /> }
    }
  }

  const getSlaStatus = (deadline: string) => {
    if (!deadline) return { label: '-', color: 'text-slate-400', urgent: false }
    const now = new Date()
    const sla = new Date(deadline)
    const hoursLeft = (sla.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    if (hoursLeft < 0) return { label: 'تجاوز SLA', color: 'text-red-600', urgent: true }
    if (hoursLeft < 2) return { label: `${Math.floor(hoursLeft * 60)} دقيقة`, color: 'text-red-600', urgent: true }
    if (hoursLeft < 6) return { label: `${Math.floor(hoursLeft)} ساعات`, color: 'text-orange-600', urgent: true }
    if (hoursLeft < 24) return { label: `${Math.floor(hoursLeft)} ساعة`, color: 'text-amber-600', urgent: false }
    return { label: `${Math.floor(hoursLeft / 24)} يوم`, color: 'text-green-600', urgent: false }
  }

  const getServiceTypeAr = (type: string) => {
    const types: Record<string, string> = { 'consultation': 'استشارة', 'case': 'قضية', 'drafting': 'صياغة' }
    return types[type] || type
  }

  const getDomainAr = (domain: string) => {
    const domains: Record<string, string> = { 'labor': 'عمالي', 'family': 'أسري', 'commercial': 'تجاري', 'criminal': 'جنائي', 'real_estate': 'عقاري', 'administrative': 'إداري' }
    return domains[domain] || domain
  }

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true
    if (filter === 'in_progress') return task.status === 'in_progress' || task.status === 'new'
    if (filter === 'overdue') return task.status === 'overdue'
    if (filter === 'completed') return task.status === 'completed'
    return true
  })

  const stats = {
    all: tasks.length,
    in_progress: tasks.filter(t => t.status === 'in_progress' || t.status === 'new').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
    completed: tasks.filter(t => t.status === 'completed').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">جاري تحميل المهام...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">📋 مهامي</h1>
          <p className="text-sm text-slate-500 mt-1">الطلبات المسندة إليك</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="p-2 hover:bg-slate-100 rounded-lg transition">
          <RefreshCw className={`w-5 h-5 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter('all')} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${filter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            الكل ({stats.all})
          </button>
          <button onClick={() => setFilter('in_progress')} className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition ${filter === 'in_progress' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            <PlayCircle className="w-4 h-4" />قيد التنفيذ ({stats.in_progress})
          </button>
          <button onClick={() => setFilter('overdue')} className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition ${filter === 'overdue' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            <AlertTriangle className="w-4 h-4" />متأخرة SLA ({stats.overdue})
          </button>
          <button onClick={() => setFilter('completed')} className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition ${filter === 'completed' ? 'bg-green-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            <CheckCircle className="w-4 h-4" />مكتملة ({stats.completed})
          </button>
        </div>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-700 mb-2">لا توجد مهام</h3>
          <p className="text-slate-500">
            {filter === 'all' && 'لا توجد مهام مسندة إليك حالياً'}
            {filter === 'in_progress' && 'لا توجد مهام قيد التنفيذ'}
            {filter === 'overdue' && 'لا توجد مهام متأخرة - أحسنت!'}
            {filter === 'completed' && 'لا توجد مهام مكتملة'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => {
            const status = getStatusBadge(task.status)
            const sla = getSlaStatus(task.sla_deadline)
            
            return (
              <div
                key={task.id}
                className={`bg-white rounded-2xl shadow-sm border-2 transition-all hover:shadow-md ${
                  task.is_urgent || task.status === 'overdue'
                    ? 'border-red-300 hover:border-red-400' 
                    : 'border-slate-200 hover:border-amber-300'
                }`}
              >
                <div className={`px-4 py-3 border-b rounded-t-2xl ${
                  task.is_urgent || task.status === 'overdue' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{task.request_number}</span>
                    <div className="flex items-center gap-2">
                      {task.is_urgent && (
                        <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-bold">عاجل</span>
                      )}
                      <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.icon}
                        {status.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium">
                      {getServiceTypeAr(task.service_type)}
                    </span>
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm">
                      {getDomainAr(task.domain)}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 line-clamp-2">{task.description || 'لا يوجد وصف'}</p>

                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>{task.member_code}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className={`font-medium ${sla.color}`}>SLA: {sla.label}</span>
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                  {task.status === 'new' && (
                    <Link
                      href={`/legal-arm-lawyer/requests/${task.id}`}
                      className="block w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-medium text-center transition-all"
                    >
                      مباشرة الطلب
                    </Link>
                  )}
                  {task.status === 'in_progress' && (
                    <Link
                      href={`/legal-arm-lawyer/requests/${task.id}`}
                      className="block w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium text-center transition-all"
                    >
                      فتح الطلب
                    </Link>
                  )}
                  {task.status === 'completed' && (
                    <Link
                      href={`/legal-arm-lawyer/requests/${task.id}`}
                      className="block w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium text-center transition-all"
                    >
                      عرض التفاصيل
                    </Link>
                  )}
                  {task.status === 'overdue' && (
                    <Link
                      href={`/legal-arm-lawyer/requests/${task.id}`}
                      className="block w-full py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-medium text-center transition-all"
                    >
                      متابعة فوراً
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
