'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Clock, FileText, CheckCircle, AlertTriangle, Eye, RefreshCw, X, User, Coins, Flag, Download, FileIcon, PlayCircle } from 'lucide-react'

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
  attachments: any[]
}

type FilterType = 'all' | 'in_progress' | 'overdue' | 'completed'

export default function MyTasksPage() {
  const searchParams = useSearchParams()
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all'
  
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterType>(initialFilter)
  const [lawyerId, setLawyerId] = useState<string | null>(null)
  
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

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
        .eq('is_accepted', true)
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

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `منذ ${days} يوم`
    if (hours > 0) return `منذ ${hours} ساعة`
    return `منذ ${minutes} دقيقة`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return { label: 'قيد التنفيذ', color: 'bg-blue-100 text-blue-700', icon: <PlayCircle className="w-4 h-4" /> }
      case 'completed':
        return { label: 'مكتملة', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-4 h-4" /> }
      case 'overdue':
        return { label: 'متأخرة', color: 'bg-red-100 text-red-700', icon: <AlertTriangle className="w-4 h-4" /> }
      default:
        return { label: 'بالانتظار', color: 'bg-gray-100 text-gray-700', icon: <Clock className="w-4 h-4" /> }
    }
  }

  const getPriorityBadge = (priority: string) => {
    if (priority === 'urgent') return { label: 'عاجل', color: 'bg-orange-100 text-orange-700' }
    if (priority === 'emergency') return { label: 'طارئ', color: 'bg-red-100 text-red-700' }
    return null
  }

  // تصفية المهام
  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true
    if (filter === 'in_progress') return task.status === 'in_progress'
    if (filter === 'completed') return task.status === 'completed'
    if (filter === 'overdue') return task.status === 'overdue'
    return true
  })

  // إحصائيات الفلاتر
  const stats = {
    all: tasks.length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
    completed: tasks.filter(t => t.status === 'completed').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
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
      <div className="bg-white rounded-xl border border-gray-200 p-2 mb-6 inline-flex gap-2">
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
            {filter === 'all' ? 'لا توجد مهام' : `لا توجد مهام ${getStatusBadge(filter).label}`}
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
            
            return (
              <div 
                key={task.id} 
                className={`bg-white rounded-xl border-2 p-6 transition-all hover:shadow-lg ${
                  task.status === 'overdue' ? 'border-red-300' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
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
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{task.title || 'طلب خدمة'}</h3>
                    
                    {task.description && (
                      <p className="text-gray-600 text-sm line-clamp-2 mb-3">{task.description}</p>
                    )}
                    
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

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { setSelectedTask(task); setShowDetailModal(true) }}
                      className="p-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {task.status === 'in_progress' && (
                      <button className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold">
                        إنهاء المهمة
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-[520px] max-h-[90vh] flex flex-col">
            
            <div className="bg-gradient-to-b from-blue-50 to-white rounded-t-xl px-6 py-5 border-b border-gray-200">
              <div className="flex items-start justify-between mb-3">
                <span className="inline-block px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-lg">
                  {selectedTask.ticket_number}
                </span>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">تفاصيل المهمة</h2>
            </div>

            <div className="overflow-y-auto px-6 py-5 flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-5">{selectedTask.title || 'طلب خدمة'}</h3>

              <div className="bg-gray-50 rounded-lg p-4 mb-5 space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-600 text-sm">كود المشترك:</span>
                  <span className="text-gray-900 font-semibold font-mono">USR-{selectedTask.member_id?.slice(0,8) || '****'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Coins className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-600 text-sm">السعر:</span>
                  <span className="text-gray-900 font-semibold">
                    {selectedTask.base_price ? `${selectedTask.base_price.toLocaleString()} ر.س` : 'غير محدد'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-600 text-sm">تاريخ القبول:</span>
                  <span className="text-gray-900 font-semibold">
                    {selectedTask.accepted_at ? getTimeAgo(selectedTask.accepted_at) : '-'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Flag className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-600 text-sm">الحالة:</span>
                  <span className={`inline-block px-3 py-1 text-sm font-bold rounded-lg ${getStatusBadge(selectedTask.status).color}`}>
                    {getStatusBadge(selectedTask.status).label}
                  </span>
                </div>
              </div>

              <div className="mb-5">
                <h4 className="text-base font-bold text-gray-800 mb-3">📝 وصف الطلب</h4>
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <p className="text-gray-700 leading-relaxed">{selectedTask.description || 'لا يوجد وصف'}</p>
                </div>
              </div>

              <div className="mb-5">
                <h4 className="text-base font-bold text-gray-800 mb-3">📎 المرفقات</h4>
                {selectedTask.attachments && selectedTask.attachments.length > 0 ? (
                  <div className="space-y-2">
                    {selectedTask.attachments.map((file: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white hover:bg-blue-50 cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <FileIcon className="w-5 h-5 text-gray-600" />
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{file.name || file}</p>
                        </div>
                        <Download className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-lg text-gray-500">لا توجد مرفقات</div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-b-xl px-6 py-4 border-t border-gray-200">
              <div className="flex gap-3">
                {selectedTask.status === 'in_progress' && (
                  <button className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    إنهاء المهمة
                  </button>
                )}
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-50"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
