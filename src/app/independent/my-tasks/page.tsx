'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Clock, FileText, CheckCircle, AlertTriangle, RefreshCw, Coins, PlayCircle, ArrowLeft } from 'lucide-react'

interface Task {
  id: string
  ticket_number: string
  title: string
  description: string
  status: string
  priority: 'normal' | 'urgent' | 'emergency'
  base_price: number | null
  created_at: string
  accepted_at: string | null
  sla_deadline: string | null
  member_id: string | null
}

type FilterType = 'all' | 'in_progress' | 'overdue' | 'completed'

export default function MyTasksPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all'
  
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterType>(initialFilter)
  const [lawyerId, setLawyerId] = useState<string | null>(null)

  useEffect(() => {
    const id = localStorage.getItem('exolex_lawyer_id')
    if (id) {
      setLawyerId(id)
      fetchTasks(id)
    } else {
      setLoading(false)
    }
  }, [])

  // تحديث الفلتر عند تغيير URL
  useEffect(() => {
    const urlFilter = searchParams.get('filter') as FilterType
    if (urlFilter && ['all', 'in_progress', 'overdue', 'completed'].includes(urlFilter)) {
      setFilter(urlFilter)
    }
  }, [searchParams])

  const fetchTasks = async (id: string) => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('assigned_lawyer_id', id)
        .in('status', ['in_progress', 'accepted', 'pending_poa', 'poa_submitted', 'poa_approved', 'case_opened', 'completed', 'objected', 'objection_raised', 'objection_responded'])
        .order('accepted_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching tasks:', error)
      } else {
        setTasks(data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (!lawyerId) return
    setRefreshing(true)
    await fetchTasks(lawyerId)
    setRefreshing(false)
  }

  // ═══════════════════════════════════════════════════════════════
  // 🚀 فتح صفحة معالجة الطلب (Dashboard)
  // ═══════════════════════════════════════════════════════════════
  const openTaskDashboard = (taskId: string) => {
    router.push(`/independent/my-tasks/${taskId}`)
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

  const getSlaRemaining = (deadline: string | null) => {
    if (!deadline) return null
    const remaining = new Date(deadline).getTime() - Date.now()
    if (remaining < 0) return { text: 'متأخر', color: 'bg-red-500', urgent: true }
    
    const hours = Math.floor(remaining / (1000 * 60 * 60))
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours < 2) return { text: `${hours}س ${minutes}د`, color: 'bg-red-500', urgent: true }
    if (hours < 6) return { text: `${hours}س ${minutes}د`, color: 'bg-orange-500', urgent: false }
    if (hours < 24) return { text: `${hours} ساعة`, color: 'bg-blue-500', urgent: false }
    return { text: `${Math.floor(hours / 24)} يوم`, color: 'bg-green-500', urgent: false }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return { label: 'قيد التنفيذ', color: 'bg-blue-100 text-blue-700', icon: <PlayCircle className="w-4 h-4" /> }
      case 'completed':
        return { label: 'مكتملة', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-4 h-4" /> }
      case 'overdue':
        return { label: 'متأخرة', color: 'bg-red-100 text-red-700', icon: <AlertTriangle className="w-4 h-4" /> }
      case 'assigned':
      case 'accepted':
        return { label: 'جديدة', color: 'bg-amber-100 text-amber-700', icon: <Clock className="w-4 h-4" /> }
      default:
        return { label: 'بالانتظار', color: 'bg-gray-100 text-gray-700', icon: <Clock className="w-4 h-4" /> }
    }
  }

  const getPriorityBadge = (priority: string) => {
    if (priority === 'urgent') return { label: 'عاجل', color: 'bg-orange-100 text-orange-700' }
    if (priority === 'emergency') return { label: 'طارئ', color: 'bg-red-100 text-red-700' }
    return null
  }

  // تحديد نص الزر حسب حالة المهمة
  const getActionButton = (task: Task) => {
    switch (task.status) {
      case 'assigned':
      case 'accepted':
        return { text: 'بدء المهمة', icon: <PlayCircle className="w-5 h-5" />, color: 'bg-amber-500 hover:bg-amber-600' }
      case 'in_progress':
        return { text: 'متابعة العمل', icon: <ArrowLeft className="w-5 h-5" />, color: 'bg-blue-600 hover:bg-blue-700' }
      case 'completed':
        return { text: 'عرض التفاصيل', icon: <FileText className="w-5 h-5" />, color: 'bg-gray-500 hover:bg-gray-600' }
      default:
        return { text: 'فتح', icon: <ArrowLeft className="w-5 h-5" />, color: 'bg-gray-500 hover:bg-gray-600' }
    }
  }

  // تصفية المهام
  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true
    if (filter === 'in_progress') return ['in_progress', 'assigned', 'accepted'].includes(task.status)
    if (filter === 'completed') return task.status === 'completed'
    if (filter === 'overdue') return task.status === 'overdue'
    return true
  })

  // إحصائيات الفلاتر
  const stats = {
    all: tasks.length,
    in_progress: tasks.filter(t => ['in_progress', 'assigned', 'accepted'].includes(t.status)).length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
    completed: tasks.filter(t => t.status === 'completed').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-6" dir="rtl">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">📋 مهامي</h1>
          <p className="text-sm text-gray-500 mt-1">الطلبات التي قبلتها وتعمل عليها</p>
        </div>
        <button 
          onClick={handleRefresh} 
          disabled={refreshing}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-2 mb-6 inline-flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'all' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          الكل ({stats.all})
        </button>
        <button
          onClick={() => setFilter('in_progress')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            filter === 'in_progress' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <PlayCircle className="w-4 h-4" />
          قيد التنفيذ ({stats.in_progress})
        </button>
        <button
          onClick={() => setFilter('overdue')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            filter === 'overdue' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          متأخرة ({stats.overdue})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            filter === 'completed' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          مكتملة ({stats.completed})
        </button>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {filter === 'all' ? 'لا توجد مهام' : `لا توجد مهام ${getStatusBadge(filter === 'in_progress' ? 'in_progress' : filter).label}`}
          </h3>
          <p className="text-gray-500">
            {filter === 'all' 
              ? 'عندما تقبل طلبات جديدة ستظهر هنا'
              : 'جرب تغيير الفلتر لرؤية مهام أخرى'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => {
            const status = getStatusBadge(task.status)
            const priority = getPriorityBadge(task.priority)
            const action = getActionButton(task)
            const sla = getSlaRemaining(task.sla_deadline)
            
            return (
              <div 
                key={task.id} 
                onClick={() => openTaskDashboard(task.id)}
                className={`bg-white rounded-xl border-2 p-6 transition-all hover:shadow-lg cursor-pointer ${
                  task.status === 'overdue' ? 'border-red-300 hover:border-red-400' : 'border-gray-200 hover:border-amber-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Header Row */}
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="font-mono text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {task.ticket_number}
                      </span>
                      <span className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full ${status.color}`}>
                        {status.icon}
                        {status.label}
                      </span>
                      {priority && (
                        <span className={`text-xs px-3 py-1 rounded-full ${priority.color}`}>
                          {priority.label}
                        </span>
                      )}
                      {sla && (
                        <span className={`${sla.color} text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 ${sla.urgent ? 'animate-pulse' : ''}`}>
                          ⏰ {sla.text}
                        </span>
                      )}
                    </div>
                    
                    {/* Title */}
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{task.title || 'طلب خدمة'}</h3>
                    
                    {/* Description */}
                    {task.description && (
                      <p className="text-gray-600 text-sm line-clamp-2 mb-3">{task.description}</p>
                    )}
                    
                    {/* Meta Info */}
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        قُبل {task.accepted_at ? getTimeAgo(task.accepted_at) : getTimeAgo(task.created_at)}
                      </span>
                      {task.base_price && task.base_price > 0 && (
                        <span className="flex items-center gap-1">
                          <Coins className="w-4 h-4" />
                          {task.base_price.toLocaleString()} ر.س
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="flex items-center">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        openTaskDashboard(task.id)
                      }}
                      className={`px-5 py-3 ${action.color} text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-sm hover:shadow-md`}
                    >
                      {action.icon}
                      {action.text}
                    </button>
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
