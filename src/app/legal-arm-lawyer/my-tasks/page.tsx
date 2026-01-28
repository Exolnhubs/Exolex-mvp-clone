'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Clock, FileText, CheckCircle, AlertTriangle, RefreshCw, 
  PlayCircle, ArrowLeft, CheckCheck, Bell, Package, Briefcase
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getLawyerId } from '@/lib/cookies'

// ═══════════════════════════════════════════════════════════════
// 📌 صفحة مهامي - محامي الذراع القانوني
// 📅 تاريخ التحديث: 20 يناير 2026
// 🎯 الغرض: عرض المهام (طلبات الباقات + طلبات المنصة) مع SLA ديناميكي
// ═══════════════════════════════════════════════════════════════

interface Task {
  id: string
  ticket_number: string
  title: string
  description: string
  status: string
  priority: 'normal' | 'urgent' | 'emergency'
  base_price: number | null
  source: string
  created_at: string
  assigned_at: string | null
  accepted_at: string | null
  is_accepted: boolean
  sla_deadline: string | null
  member_id: string | null
  handler_type: string | null
}

type FilterType = 'all' | 'pending_acceptance' | 'in_progress' | 'completed'

export default function LegalArmLawyerMyTasksPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all'
  
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterType>(initialFilter)
  const [lawyerId, setLawyerId] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  useEffect(() => {
    const id = getLawyerId()
    if (id) {
      setLawyerId(id)
      fetchTasks(id)
      
      // Check SLA warnings every minute
      const interval = setInterval(() => checkSlaWarnings(), 60000)
      return () => clearInterval(interval)
    } else {
      router.push('/auth/lawyer-login')
    }
  }, [])

  useEffect(() => {
    const urlFilter = searchParams.get('filter') as FilterType
    if (urlFilter && ['all', 'pending_acceptance', 'in_progress', 'completed'].includes(urlFilter)) {
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
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching tasks:', error)
        toast.error('حدث خطأ في جلب المهام')
      } else {
        setTasks(data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // تنبيهات SLA عند وصول 90%
  const checkSlaWarnings = () => {
    tasks.forEach(task => {
      if (task.is_accepted && task.sla_deadline && task.accepted_at) {
        const sla = getSlaStatus(task.sla_deadline, task.is_accepted, task.accepted_at)
        if (sla && sla.percentage >= 90 && sla.percentage < 100) {
          toast.error(`⚠️ تنبيه: الطلب ${task.ticket_number} على وشك تجاوز SLA!`, {
            duration: 5000,
            id: `sla-warning-${task.id}`
          })
        }
      }
    })
  }

  const handleAcceptTask = async (taskId: string) => {
    if (!lawyerId) return
    
    setAcceptingId(taskId)
    try {
      const { error } = await supabase
        .from('service_requests')
        .update({
          is_accepted: true,
          accepted_at: new Date().toISOString(),
          status: 'in_progress'
        })
        .eq('id', taskId)
        .eq('assigned_lawyer_id', lawyerId)

      if (error) throw error
      
      toast.success('✅ تم قبول الطلب - بدأ احتساب SLA')
      fetchTasks(lawyerId)
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ')
    } finally {
      setAcceptingId(null)
    }
  }

  const handleRefresh = async () => {
    if (!lawyerId) return
    setRefreshing(true)
    await fetchTasks(lawyerId)
    setRefreshing(false)
    toast.success('تم التحديث')
  }

  const openTaskDetails = (taskId: string) => {
    router.push(`/legal-arm-lawyer/my-tasks/${taskId}`)
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

  // ═══════════════════════════════════════════════════════════════
  // SLA ديناميكي بالألوان
  // ═══════════════════════════════════════════════════════════════
  const getSlaStatus = (deadline: string | null, isAccepted: boolean, acceptedAt: string | null) => {
    if (!deadline) return null
    if (!isAccepted) return { text: 'يبدأ عند القبول', color: 'bg-gray-400', textColor: 'text-gray-600', percentage: 0 }
    
    const now = Date.now()
    const deadlineTime = new Date(deadline).getTime()
    const startTime = acceptedAt ? new Date(acceptedAt).getTime() : now
    const totalTime = deadlineTime - startTime
    const elapsed = now - startTime
    const percentage = Math.min(100, Math.max(0, (elapsed / totalTime) * 100))
    const remaining = deadlineTime - now
    
    // حساب الوقت المتبقي
    const remainingHours = Math.max(0, Math.floor(remaining / 3600000))
    const remainingMinutes = Math.max(0, Math.floor((remaining % 3600000) / 60000))
    
    let timeText = ''
    if (remaining <= 0) {
      timeText = 'متأخر!'
    } else if (remainingHours >= 24) {
      timeText = `${Math.floor(remainingHours / 24)} يوم`
    } else if (remainingHours > 0) {
      timeText = `${remainingHours}س ${remainingMinutes}د`
    } else {
      timeText = `${remainingMinutes} دقيقة`
    }
    
    // تحديد اللون حسب النسبة
    if (percentage >= 100) {
      return { text: 'متأخر!', color: 'bg-red-600', textColor: 'text-red-600', percentage: 100, urgent: true }
    }
    if (percentage >= 90) {
      return { text: timeText, color: 'bg-red-500', textColor: 'text-red-500', percentage, urgent: true, warning: true }
    }
    if (percentage >= 70) {
      return { text: timeText, color: 'bg-red-500', textColor: 'text-red-500', percentage, urgent: true }
    }
    if (percentage >= 30) {
      return { text: timeText, color: 'bg-yellow-500', textColor: 'text-yellow-600', percentage }
    }
    return { text: timeText, color: 'bg-green-500', textColor: 'text-green-600', percentage }
  }

  const getStatusBadge = (task: Task) => {
    if (!task.is_accepted) {
      return { label: 'بانتظار القبول', color: 'bg-yellow-100 text-yellow-700', icon: <Bell className="w-4 h-4" /> }
    }
    switch (task.status) {
      case 'in_progress':
        return { label: 'قيد التنفيذ', color: 'bg-blue-100 text-blue-700', icon: <PlayCircle className="w-4 h-4" /> }
      case 'completed':
        return { label: 'مكتملة', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-4 h-4" /> }
      case 'pending_poa':
        return { label: 'بانتظار الوكالة', color: 'bg-purple-100 text-purple-700', icon: <FileText className="w-4 h-4" /> }
      default:
        return { label: task.status, color: 'bg-gray-100 text-gray-700', icon: <Clock className="w-4 h-4" /> }
    }
  }

  // فصل طلبات الباقات عن طلبات المنصة
  const filteredTasks = tasks.filter(task => {
    switch (filter) {
      case 'pending_acceptance': return !task.is_accepted
      case 'in_progress': return task.is_accepted && task.status !== 'completed'
      case 'completed': return task.status === 'completed'
      default: return true
    }
  })

  const packageTasks = filteredTasks.filter(t => t.source === 'package')
  const platformTasks = filteredTasks.filter(t => t.source !== 'package')

  const pendingCount = tasks.filter(t => !t.is_accepted).length
  const inProgressCount = tasks.filter(t => t.is_accepted && t.status !== 'completed').length
  const completedCount = tasks.filter(t => t.status === 'completed').length

  // ═══════════════════════════════════════════════════════════════
  // Render Task Card
  // ═══════════════════════════════════════════════════════════════
  const renderTaskCard = (task: Task) => {
    const statusBadge = getStatusBadge(task)
    const sla = getSlaStatus(task.sla_deadline, task.is_accepted, task.accepted_at)

    return (
      <div
        key={task.id}
        className={`bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all border-r-4 ${
          !task.is_accepted ? 'border-yellow-500' : 
          sla?.percentage && sla.percentage >= 70 ? 'border-red-500' :
          sla?.percentage && sla.percentage >= 30 ? 'border-yellow-500' :
          task.status === 'completed' ? 'border-green-500' : 'border-emerald-500'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-sm font-mono text-gray-500">{task.ticket_number}</span>
              <span className={`px-2 py-1 rounded-full text-xs ${statusBadge.color} flex items-center gap-1`}>
                {statusBadge.icon}
                {statusBadge.label}
              </span>
              {task.priority === 'urgent' && (
                <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">عاجل</span>
              )}
            </div>
            
            <h3 className="font-semibold text-gray-800 mb-2">
              {task.title || task.description?.slice(0, 60) || 'طلب خدمة قانونية'}
            </h3>
            
            <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {getTimeAgo(task.created_at)}
              </span>
              {task.base_price && task.base_price > 0 && (
                <span className="font-medium text-emerald-600">
                  {task.base_price.toLocaleString()} ر.س
                </span>
              )}
            </div>

            {/* SLA Progress Bar */}
            {sla && task.is_accepted && (
              <div className="mt-3 flex items-center gap-3">
                <span className={`text-sm font-medium ${sla.textColor}`}>
                  SLA: {sla.text}
                </span>
                <div className="flex-1 max-w-[200px] h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${sla.color} transition-all duration-500 ${sla.warning ? 'animate-pulse' : ''}`}
                    style={{ width: `${sla.percentage}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-400">{Math.round(sla.percentage)}%</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mr-4">
            {!task.is_accepted ? (
              <>
                <button
                  onClick={() => handleAcceptTask(task.id)}
                  disabled={acceptingId === task.id}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {acceptingId === task.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCheck className="w-4 h-4" />
                  )}
                  قبول
                </button>
                <button
                  onClick={() => openTaskDetails(task.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <FileText className="w-4 h-4" />
                  التفاصيل
                </button>
              </>
            ) : (
              <button
                onClick={() => openTaskDetails(task.id)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                <PlayCircle className="w-4 h-4" />
                إدارة الطلب
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">مهامي</h1>
            <p className="text-gray-500 text-sm">إدارة الطلبات المسندة إليك</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div 
          onClick={() => setFilter('all')}
          className={`p-4 rounded-xl cursor-pointer transition-all ${filter === 'all' ? 'bg-gray-800 text-white' : 'bg-white hover:shadow-md'}`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${filter === 'all' ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-sm ${filter === 'all' ? 'text-gray-300' : 'text-gray-500'}`}>الكل</p>
              <p className="text-xl font-bold">{tasks.length}</p>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setFilter('pending_acceptance')}
          className={`p-4 rounded-xl cursor-pointer transition-all ${filter === 'pending_acceptance' ? 'bg-yellow-500 text-white' : 'bg-white hover:shadow-md'}`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${filter === 'pending_acceptance' ? 'bg-yellow-400' : 'bg-yellow-100'}`}>
              <Bell className={`w-5 h-5 ${filter === 'pending_acceptance' ? 'text-white' : 'text-yellow-600'}`} />
            </div>
            <div>
              <p className={`text-sm ${filter === 'pending_acceptance' ? 'text-yellow-100' : 'text-gray-500'}`}>بانتظار القبول</p>
              <p className="text-xl font-bold">{pendingCount}</p>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setFilter('in_progress')}
          className={`p-4 rounded-xl cursor-pointer transition-all ${filter === 'in_progress' ? 'bg-blue-500 text-white' : 'bg-white hover:shadow-md'}`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${filter === 'in_progress' ? 'bg-blue-400' : 'bg-blue-100'}`}>
              <PlayCircle className={`w-5 h-5 ${filter === 'in_progress' ? 'text-white' : 'text-blue-600'}`} />
            </div>
            <div>
              <p className={`text-sm ${filter === 'in_progress' ? 'text-blue-100' : 'text-gray-500'}`}>قيد التنفيذ</p>
              <p className="text-xl font-bold">{inProgressCount}</p>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setFilter('completed')}
          className={`p-4 rounded-xl cursor-pointer transition-all ${filter === 'completed' ? 'bg-green-500 text-white' : 'bg-white hover:shadow-md'}`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${filter === 'completed' ? 'bg-green-400' : 'bg-green-100'}`}>
              <CheckCircle className={`w-5 h-5 ${filter === 'completed' ? 'text-white' : 'text-green-600'}`} />
            </div>
            <div>
              <p className={`text-sm ${filter === 'completed' ? 'text-green-100' : 'text-gray-500'}`}>مكتملة</p>
              <p className="text-xl font-bold">{completedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tasks Content */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">لا توجد مهام</h3>
          <p className="text-gray-400">
            {filter === 'pending_acceptance' && 'لا توجد طلبات بانتظار القبول'}
            {filter === 'in_progress' && 'لا توجد طلبات قيد التنفيذ'}
            {filter === 'completed' && 'لا توجد طلبات مكتملة'}
            {filter === 'all' && 'لم يتم إسناد أي طلبات إليك بعد'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* طلبات الباقات */}
          {packageTasks.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Package className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-gray-800">طلبات الباقات</h2>
                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-sm">
                  {packageTasks.length}
                </span>
              </div>
              <div className="space-y-4">
                {packageTasks.map(task => renderTaskCard(task))}
              </div>
            </section>
          )}

          {/* شريط فاصل */}
          {packageTasks.length > 0 && platformTasks.length > 0 && (
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-gray-200 border-dashed"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-gray-100 px-4 py-1 rounded-full text-sm text-gray-500">
                  ─────────────────
                </span>
              </div>
            </div>
          )}

          {/* طلبات المنصة */}
          {platformTasks.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Briefcase className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-800">طلبات المنصة (الخدمات الإضافية)</h2>
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-sm">
                  {platformTasks.length}
                </span>
              </div>
              <div className="space-y-4">
                {platformTasks.map(task => renderTaskCard(task))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}