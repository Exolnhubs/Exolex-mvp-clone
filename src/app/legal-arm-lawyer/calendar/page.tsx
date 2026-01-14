'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  ChevronRight, ChevronLeft, Plus, RefreshCw, X, Calendar as CalendarIcon,
  Clock, MapPin, Users, Video, Phone, FileText, Bell, Check, AlertTriangle,
  Briefcase, Gavel, Link2, User, CheckSquare, Square
} from 'lucide-react'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════
interface CalendarEvent {
  id: string
  owner_type: string
  owner_id: string
  title: string
  description?: string
  event_type: string
  start_datetime: string
  end_datetime?: string
  all_day?: boolean
  location?: string
  location_type?: string
  meeting_link?: string
  court_name?: string
  court_room?: string
  request_id?: string
  case_id?: string
  ticket_number?: string
  is_private?: boolean
  notify_client?: boolean
  status?: string
  participants?: any[]
  reminder_settings?: any
  court_requirements?: CourtRequirement[]
  color?: string
  icon?: string
  created_at?: string
}

interface CourtRequirement {
  key: string
  label: string
  done: boolean
}

interface RequestOption {
  id: string
  ticket_number: string
  title: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════════════════
type IconComponent = React.ComponentType<{ className?: string }>

const eventTypeConfig: Record<string, { label: string; icon: IconComponent; color: string; bgColor: string }> = {
  court_session: { label: 'جلسة محكمة', icon: Gavel, color: 'text-red-700', bgColor: 'bg-red-100' },
  client_meeting: { label: 'اجتماع عميل', icon: Users, color: 'text-blue-700', bgColor: 'bg-blue-100' },
  consultation: { label: 'استشارة', icon: FileText, color: 'text-purple-700', bgColor: 'bg-purple-100' },
  phone_call: { label: 'مكالمة هاتفية', icon: Phone, color: 'text-green-700', bgColor: 'bg-green-100' },
  video_call: { label: 'اجتماع مرئي', icon: Video, color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  internal_meeting: { label: 'اجتماع داخلي', icon: Users, color: 'text-amber-700', bgColor: 'bg-amber-100' },
  deadline: { label: 'موعد نهائي', icon: AlertTriangle, color: 'text-orange-700', bgColor: 'bg-orange-100' },
  reminder: { label: 'تذكير', icon: Bell, color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  personal: { label: 'شخصي', icon: User, color: 'text-gray-700', bgColor: 'bg-gray-100' },
  task: { label: 'مهمة', icon: CheckSquare, color: 'text-teal-700', bgColor: 'bg-teal-100' },
  other: { label: 'أخرى', icon: CalendarIcon, color: 'text-slate-700', bgColor: 'bg-slate-100' },
}

const DEFAULT_COURT_REQUIREMENTS: CourtRequirement[] = [
  { key: 'memorandum', label: 'كتابة المذكرة', done: false },
  { key: 'pleading', label: 'المرافعة', done: false },
  { key: 'poa', label: 'وجود الوكالة', done: false },
  { key: 'formal_dress', label: 'اللباس الرسمي', done: false },
  { key: 'client_presence', label: 'حضور الموكل', done: false },
  { key: 'witnesses', label: 'الشهود', done: false },
  { key: 'documents', label: 'المستندات المطلوبة', done: false },
]

const REMINDER_OPTIONS = [
  { value: '2d', label: 'قبل يومين' },
  { value: '1d', label: 'قبل يوم' },
  { value: '12h', label: 'قبل 12 ساعة' },
  { value: '3h', label: 'قبل 3 ساعات' },
  { value: '1h', label: 'قبل ساعة' },
]

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════
export default function CalendarPage() {
  const [lawyerId, setLawyerId] = useState<string | null>(null)
  const [lawyerName, setLawyerName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [myRequests, setMyRequests] = useState<RequestOption[]>([])
  
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  
  // New Event Form
  const [newEvent, setNewEvent] = useState({
    title: '',
    event_type: 'client_meeting',
    start_date: '',
    start_time: '',
    end_time: '',
    all_day: false,
    location: '',
    location_type: 'physical',
    meeting_link: '',
    court_name: '',
    court_room: '',
    description: '',
    is_private: false,
    notify_client: false,
    request_id: '',
    reminder_times: ['1d', '3h'],
    court_requirements: [...DEFAULT_COURT_REQUIREMENTS],
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // Load Data
  // ═══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const id = localStorage.getItem('exolex_arm_lawyer_id')
    if (id) {
      setLawyerId(id)
      loadLawyerInfo(id)
      loadEvents(id)
      loadMyRequests(id)
    } else {
      setLoading(false)
    }
  }, [currentDate])

  const loadLawyerInfo = async (id: string) => {
    const { data } = await supabase
      .from('lawyers')
      .select('full_name')
      .eq('id', id)
      .single()
    if (data) setLawyerName(data.full_name)
  }

  const loadEvents = async (id: string) => {
    try {
      setLoading(true)
      
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)
      
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('owner_id', id)
        .gte('start_datetime', startOfMonth.toISOString())
        .lte('start_datetime', endOfMonth.toISOString())
        .order('start_datetime', { ascending: true })
      
      if (error) {
        console.error('Error loading events:', error)
        setEvents([])
      } else {
        setEvents(data || [])
      }
    } catch (err) {
      console.error(err)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const loadMyRequests = async (id: string) => {
    const { data } = await supabase
      .from('service_requests')
      .select('id, ticket_number, title')
      .eq('assigned_lawyer_id', id)
      .in('status', ['assigned', 'in_progress', 'pending'])
      .order('created_at', { ascending: false })
      .limit(50)
    
    setMyRequests(data || [])
  }

  const handleRefresh = async () => {
    if (!lawyerId) return
    setRefreshing(true)
    await loadEvents(lawyerId)
    setRefreshing(false)
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Calendar Navigation
  // ═══════════════════════════════════════════════════════════════════════════════
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Calendar Grid
  // ═══════════════════════════════════════════════════════════════════════════════
  const generateCalendarDays = useCallback(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    
    const startDay = firstDayOfMonth.getDay()
    const totalDays = lastDayOfMonth.getDate()
    
    const days: { date: Date; isCurrentMonth: boolean; events: CalendarEvent[] }[] = []
    
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i)
      days.push({ date, isCurrentMonth: false, events: [] })
    }
    
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(year, month, i)
      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.start_datetime)
        return eventDate.toDateString() === date.toDateString()
      })
      days.push({ date, isCurrentMonth: true, events: dayEvents })
    }
    
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i)
      days.push({ date, isCurrentMonth: false, events: [] })
    }
    
    return days
  }, [currentDate, events])

  // ═══════════════════════════════════════════════════════════════════════════════
  // Add Event
  // ═══════════════════════════════════════════════════════════════════════════════
  const resetNewEvent = () => {
    setNewEvent({
      title: '',
      event_type: 'client_meeting',
      start_date: '',
      start_time: '',
      end_time: '',
      all_day: false,
      location: '',
      location_type: 'physical',
      meeting_link: '',
      court_name: '',
      court_room: '',
      description: '',
      is_private: false,
      notify_client: false,
      request_id: '',
      reminder_times: ['1d', '3h'],
      court_requirements: [...DEFAULT_COURT_REQUIREMENTS],
    })
  }

  const handleAddEvent = async () => {
    if (!lawyerId || !newEvent.title || !newEvent.start_date || (!newEvent.all_day && !newEvent.start_time)) {
      toast.error('يرجى ملء الحقول المطلوبة')
      return
    }

    try {
      const startDatetime = newEvent.all_day 
        ? `${newEvent.start_date}T00:00:00`
        : `${newEvent.start_date}T${newEvent.start_time}:00`
      
      const endDatetime = newEvent.end_time 
        ? `${newEvent.start_date}T${newEvent.end_time}:00`
        : null

      // Get ticket_number if request selected
      let ticketNumber = null
      if (newEvent.request_id) {
        const req = myRequests.find(r => r.id === newEvent.request_id)
        if (req) ticketNumber = req.ticket_number
      }

      const eventData: any = {
        owner_type: 'arm_lawyer',
        owner_id: lawyerId,
        owner_name: lawyerName,
        title: newEvent.title,
        description: newEvent.description || null,
        event_type: newEvent.event_type,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        all_day: newEvent.all_day,
        location: newEvent.location || null,
        location_type: newEvent.location_type,
        meeting_link: newEvent.meeting_link || null,
        is_private: newEvent.is_private,
        notify_client: newEvent.notify_client,
        request_id: newEvent.request_id || null,
        ticket_number: ticketNumber,
        status: 'scheduled',
        created_by: lawyerId,
      }

      // Court session specific fields
      if (newEvent.event_type === 'court_session') {
        eventData.court_name = newEvent.court_name || null
        eventData.court_room = newEvent.court_room || null
        eventData.court_requirements = newEvent.court_requirements
        eventData.reminder_settings = {
          enabled: true,
          times: newEvent.reminder_times
        }
        eventData.color = '#DC2626' // Red for court
        eventData.icon = '⚖️'
      }

      const { error } = await supabase.from('calendar_events').insert(eventData)

      if (error) throw error

      toast.success('✅ تم إضافة الموعد')
      setShowAddModal(false)
      resetNewEvent()
      handleRefresh()
    } catch (error: any) {
      console.error('Error adding event:', error)
      toast.error(error.message || 'حدث خطأ')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Update Event
  // ═══════════════════════════════════════════════════════════════════════════════
  const updateEventStatus = async (eventId: string, status: string) => {
    try {
      await supabase
        .from('calendar_events')
        .update({ status })
        .eq('id', eventId)
      
      toast.success('✅ تم التحديث')
      setShowEventModal(false)
      handleRefresh()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  const toggleRequirement = async (eventId: string, reqKey: string) => {
    if (!selectedEvent?.court_requirements) return
    
    const updated = selectedEvent.court_requirements.map(r => 
      r.key === reqKey ? { ...r, done: !r.done } : r
    )
    
    try {
      await supabase
        .from('calendar_events')
        .update({ court_requirements: updated })
        .eq('id', eventId)
      
      setSelectedEvent({ ...selectedEvent, court_requirements: updated })
      setEvents(prev => prev.map(e => 
        e.id === eventId ? { ...e, court_requirements: updated } : e
      ))
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  const deleteEvent = async (eventId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الموعد؟')) return
    
    try {
      await supabase.from('calendar_events').delete().eq('id', eventId)
      toast.success('✅ تم الحذف')
      setShowEventModal(false)
      handleRefresh()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════════
  const formatTime = (datetime: string) => {
    return new Date(datetime).toLocaleTimeString('ar-SA', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
  }

  const formatDate = (datetime: string) => {
    return new Date(datetime).toLocaleDateString('ar-SA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const getUpcomingEvents = () => {
    const now = new Date()
    return events
      .filter(e => new Date(e.start_datetime) >= now)
      .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
      .slice(0, 5)
  }

  const calendarDays = generateCalendarDays()

  // ═══════════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════════
  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-7 h-7 text-amber-500" />
            التقويم
          </h1>
          <p className="text-sm text-gray-500 mt-1">إدارة مواعيدك وجلساتك</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition font-semibold"
          >
            <Plus className="w-5 h-5" />
            إضافة موعد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Calendar */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <button onClick={goToPreviousMonth} className="p-2 hover:bg-gray-100 rounded-lg transition">
                  <ChevronRight className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold text-gray-800 min-w-[180px] text-center">
                  {MONTHS_AR[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <button onClick={goToNextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button onClick={goToToday} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium">
                  اليوم
                </button>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  {(['month', 'week', 'day'] as const).map((mode) => (
                    <button 
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                        viewMode === mode ? 'bg-white shadow text-amber-600' : 'text-gray-600'
                      }`}
                    >
                      {mode === 'month' ? 'شهر' : mode === 'week' ? 'أسبوع' : 'يوم'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {DAYS_AR.map((day, idx) => (
                <div key={idx} className={`py-3 text-center text-sm font-semibold ${idx === 5 || idx === 6 ? 'text-red-600' : 'text-gray-600'}`}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => (
                <div 
                  key={idx}
                  className={`min-h-[100px] p-2 border-b border-l border-gray-100 ${!day.isCurrentMonth ? 'bg-gray-50' : ''} ${isToday(day.date) ? 'bg-amber-50' : ''}`}
                >
                  <div className={`text-sm font-semibold mb-1 ${!day.isCurrentMonth ? 'text-gray-400' : isToday(day.date) ? 'text-amber-600' : 'text-gray-700'}`}>
                    {day.date.getDate()}
                  </div>
                  
                  <div className="space-y-1">
                    {day.events.slice(0, 3).map((event) => {
                      const config = eventTypeConfig[event.event_type] || eventTypeConfig.other
                      return (
                        <button
                          key={event.id}
                          onClick={() => { setSelectedEvent(event); setShowEventModal(true) }}
                          className={`w-full text-right px-2 py-1 rounded text-xs truncate ${config.bgColor} ${config.color} hover:opacity-80 transition`}
                        >
                          {event.all_day ? '🌞' : formatTime(event.start_datetime)} {event.title}
                        </button>
                      )
                    })}
                    {day.events.length > 3 && (
                      <p className="text-xs text-gray-500 text-center">+{day.events.length - 3}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Add */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
            <h3 className="font-bold mb-2">📅 إضافة سريعة</h3>
            <p className="text-amber-100 text-sm mb-3">أضف موعد جديد بسرعة</p>
            <button 
              onClick={() => setShowAddModal(true)}
              className="w-full py-2 bg-white text-amber-600 rounded-lg font-semibold hover:bg-amber-50 transition"
            >
              + موعد جديد
            </button>
          </div>

          {/* Upcoming Events */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              المواعيد القادمة
            </h3>
            
            {getUpcomingEvents().length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <CalendarIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">لا توجد مواعيد قادمة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {getUpcomingEvents().map((event) => {
                  const config = eventTypeConfig[event.event_type] || eventTypeConfig.other
                  const Icon = config.icon
                  return (
                    <button
                      key={event.id}
                      onClick={() => { setSelectedEvent(event); setShowEventModal(true) }}
                      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition text-right"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bgColor}`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{event.title}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(event.start_datetime).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                          {!event.all_day && ` - ${formatTime(event.start_datetime)}`}
                        </p>
                        {event.ticket_number && (
                          <p className="text-xs text-amber-600">🎫 {event.ticket_number}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-bold text-gray-800 mb-3">🎨 دليل الألوان</h3>
            <div className="space-y-2">
              {Object.entries(eventTypeConfig).slice(0, 6).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <div className={`w-3 h-3 rounded ${val.bgColor}`}></div>
                  <span className="text-gray-600">{val.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          Event Detail Modal
          ═══════════════════════════════════════════════════════════════════════════════ */}
      {showEventModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {(() => {
              const config = eventTypeConfig[selectedEvent.event_type] || eventTypeConfig.other
              const Icon = config.icon
              return (
                <>
                  {/* Header */}
                  <div className={`${config.bgColor} rounded-t-2xl p-6`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/50 rounded-xl flex items-center justify-center">
                          <Icon className={`w-6 h-6 ${config.color}`} />
                        </div>
                        <div>
                          <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                          <h3 className="text-xl font-bold text-gray-800">{selectedEvent.title}</h3>
                        </div>
                      </div>
                      <button onClick={() => setShowEventModal(false)} className="text-gray-500 hover:text-gray-700">
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                    
                    {/* Status Badge */}
                    <div className="mt-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        selectedEvent.status === 'completed' ? 'bg-green-200 text-green-800' :
                        selectedEvent.status === 'cancelled' ? 'bg-red-200 text-red-800' :
                        selectedEvent.status === 'in_progress' ? 'bg-blue-200 text-blue-800' :
                        'bg-white/50 text-gray-700'
                      }`}>
                        {selectedEvent.status === 'scheduled' ? 'مجدول' :
                         selectedEvent.status === 'completed' ? 'مكتمل' :
                         selectedEvent.status === 'cancelled' ? 'ملغي' :
                         selectedEvent.status === 'in_progress' ? 'جاري' : selectedEvent.status}
                      </span>
                      {selectedEvent.is_private && (
                        <span className="mr-2 px-2 py-1 bg-gray-200 text-gray-700 rounded-full text-xs">🔒 خاص</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-6 space-y-4">
                    {/* Date & Time */}
                    <div className="flex items-center gap-3 text-gray-600">
                      <Clock className="w-5 h-5" />
                      <div>
                        <p className="font-medium">{formatDate(selectedEvent.start_datetime)}</p>
                        {!selectedEvent.all_day && (
                          <p className="text-sm">
                            {formatTime(selectedEvent.start_datetime)}
                            {selectedEvent.end_datetime && ` - ${formatTime(selectedEvent.end_datetime)}`}
                          </p>
                        )}
                        {selectedEvent.all_day && <p className="text-sm text-amber-600">طوال اليوم</p>}
                      </div>
                    </div>
                    
                    {/* Location */}
                    {(selectedEvent.location || selectedEvent.court_name) && (
                      <div className="flex items-center gap-3 text-gray-600">
                        <MapPin className="w-5 h-5" />
                        <div>
                          {selectedEvent.court_name && <p className="font-medium">{selectedEvent.court_name}</p>}
                          {selectedEvent.court_room && <p className="text-sm">قاعة: {selectedEvent.court_room}</p>}
                          {selectedEvent.location && <p>{selectedEvent.location}</p>}
                        </div>
                      </div>
                    )}
                    
                    {/* Meeting Link */}
                    {selectedEvent.meeting_link && (
                      <div className="flex items-center gap-3 text-gray-600">
                        <Video className="w-5 h-5" />
                        <a href={selectedEvent.meeting_link} target="_blank" rel="noopener noreferrer" 
                           className="text-blue-600 hover:underline truncate">
                          {selectedEvent.meeting_link}
                        </a>
                      </div>
                    )}
                    
                    {/* Linked Request */}
                    {selectedEvent.ticket_number && (
                      <div className="bg-amber-50 rounded-lg p-3">
                        <p className="text-sm text-amber-700 flex items-center gap-2">
                          <Link2 className="w-4 h-4" />
                          <span className="font-semibold">مرتبط بالطلب:</span>
                          <span className="font-mono">{selectedEvent.ticket_number}</span>
                        </p>
                      </div>
                    )}
                    
                    {/* Description */}
                    {selectedEvent.description && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-gray-700">{selectedEvent.description}</p>
                      </div>
                    )}
                    
                    {/* Court Requirements */}
                    {selectedEvent.event_type === 'court_session' && selectedEvent.court_requirements && (
                      <div className="border rounded-lg p-4">
                        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                          <CheckSquare className="w-5 h-5 text-amber-500" />
                          متطلبات الجلسة
                        </h4>
                        <div className="space-y-2">
                          {selectedEvent.court_requirements.map((req) => (
                            <button
                              key={req.key}
                              onClick={() => toggleRequirement(selectedEvent.id, req.key)}
                              className={`w-full flex items-center gap-3 p-2 rounded-lg transition ${
                                req.done ? 'bg-green-50' : 'bg-gray-50 hover:bg-gray-100'
                              }`}
                            >
                              {req.done ? (
                                <Check className="w-5 h-5 text-green-600" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-400" />
                              )}
                              <span className={req.done ? 'text-green-700 line-through' : 'text-gray-700'}>
                                {req.label}
                              </span>
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                          ✅ {selectedEvent.court_requirements.filter(r => r.done).length} / {selectedEvent.court_requirements.length} مكتمل
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="p-4 border-t bg-gray-50 rounded-b-2xl space-y-2">
                    {selectedEvent.status !== 'completed' && selectedEvent.status !== 'cancelled' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => updateEventStatus(selectedEvent.id, 'completed')}
                          className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold text-sm"
                        >
                          ✅ إكمال
                        </button>
                        <button 
                          onClick={() => updateEventStatus(selectedEvent.id, 'cancelled')}
                          className="flex-1 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 font-semibold text-sm"
                        >
                          ❌ إلغاء
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button 
                        onClick={() => deleteEvent(selectedEvent.id)}
                        className="flex-1 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-semibold text-sm"
                      >
                        🗑️ حذف
                      </button>
                      <button 
                        onClick={() => setShowEventModal(false)}
                        className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold text-sm"
                      >
                        إغلاق
                      </button>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════════
          Add Event Modal
          ═══════════════════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">➕ إضافة موعد جديد</h3>
                <button onClick={() => { setShowAddModal(false); resetNewEvent() }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">عنوان الموعد *</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="مثال: جلسة محكمة - قضية رقم 123"
                />
              </div>

              {/* Event Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">نوع الموعد *</label>
                <select
                  value={newEvent.event_type}
                  onChange={(e) => setNewEvent({...newEvent, event_type: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  {Object.entries(eventTypeConfig).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">التاريخ *</label>
                  <input
                    type="date"
                    value={newEvent.start_date}
                    onChange={(e) => setNewEvent({...newEvent, start_date: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                {!newEvent.all_day && (
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">الوقت *</label>
                    <input
                      type="time"
                      value={newEvent.start_time}
                      onChange={(e) => setNewEvent({...newEvent, start_time: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* All Day */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newEvent.all_day}
                  onChange={(e) => setNewEvent({...newEvent, all_day: e.target.checked})}
                  className="w-4 h-4 text-amber-500 rounded"
                />
                <span className="text-sm text-gray-600">طوال اليوم</span>
              </label>

              {/* Court Session Fields */}
              {newEvent.event_type === 'court_session' && (
                <div className="bg-red-50 rounded-lg p-4 space-y-4">
                  <h4 className="font-bold text-red-800 flex items-center gap-2">
                    <Gavel className="w-5 h-5" />
                    تفاصيل جلسة المحكمة
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">اسم المحكمة</label>
                      <input
                        type="text"
                        value={newEvent.court_name}
                        onChange={(e) => setNewEvent({...newEvent, court_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="المحكمة العامة"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">رقم القاعة</label>
                      <input
                        type="text"
                        value={newEvent.court_room}
                        onChange={(e) => setNewEvent({...newEvent, court_room: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="قاعة 5"
                      />
                    </div>
                  </div>

                  {/* Reminders */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">التذكيرات</label>
                    <div className="flex flex-wrap gap-2">
                      {REMINDER_OPTIONS.map((opt) => (
                        <label key={opt.value} className="flex items-center gap-1 bg-white px-3 py-1 rounded-full border cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newEvent.reminder_times.includes(opt.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewEvent({...newEvent, reminder_times: [...newEvent.reminder_times, opt.value]})
                              } else {
                                setNewEvent({...newEvent, reminder_times: newEvent.reminder_times.filter(t => t !== opt.value)})
                              }
                            }}
                            className="w-3 h-3"
                          />
                          <span className="text-xs">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Requirements */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">متطلبات الجلسة</label>
                    <div className="space-y-1">
                      {newEvent.court_requirements.map((req, idx) => (
                        <label key={req.key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={req.done}
                            onChange={(e) => {
                              const updated = [...newEvent.court_requirements]
                              updated[idx] = { ...req, done: e.target.checked }
                              setNewEvent({...newEvent, court_requirements: updated})
                            }}
                            className="w-4 h-4"
                          />
                          <span>{req.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Location */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">المكان</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="عنوان أو مكان الموعد"
                />
              </div>

              {/* Meeting Link (for video calls) */}
              {(newEvent.event_type === 'video_call' || newEvent.location_type === 'virtual') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">رابط الاجتماع</label>
                  <input
                    type="url"
                    value={newEvent.meeting_link}
                    onChange={(e) => setNewEvent({...newEvent, meeting_link: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    placeholder="https://zoom.us/..."
                  />
                </div>
              )}

              {/* Link to Request */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">ربط بطلب (اختياري)</label>
                <select
                  value={newEvent.request_id}
                  onChange={(e) => setNewEvent({...newEvent, request_id: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- بدون ربط --</option>
                  {myRequests.map((req) => (
                    <option key={req.id} value={req.id}>
                      {req.ticket_number} - {req.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">ملاحظات</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="ملاحظات إضافية..."
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newEvent.is_private}
                    onChange={(e) => setNewEvent({...newEvent, is_private: e.target.checked})}
                    className="w-4 h-4 text-amber-500 rounded"
                  />
                  <span className="text-sm text-gray-600">🔒 موعد خاص (لا يظهر للمدير)</span>
                </label>
                
                {newEvent.request_id && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newEvent.notify_client}
                      onChange={(e) => setNewEvent({...newEvent, notify_client: e.target.checked})}
                      className="w-4 h-4 text-amber-500 rounded"
                    />
                    <span className="text-sm text-gray-600">📢 إشعار العميل بالموعد</span>
                  </label>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t p-4 rounded-b-2xl flex gap-3">
              <button 
                onClick={() => { setShowAddModal(false); resetNewEvent() }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
              >
                إلغاء
              </button>
              <button 
                onClick={handleAddEvent}
                disabled={!newEvent.title || !newEvent.start_date || (!newEvent.all_day && !newEvent.start_time)}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold disabled:opacity-50"
              >
                ✅ إضافة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
