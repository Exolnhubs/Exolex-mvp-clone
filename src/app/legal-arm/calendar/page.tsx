'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  ChevronRight, ChevronLeft, Plus, RefreshCw, X, Calendar as CalendarIcon,
  Clock, MapPin, Users, Video, Phone, FileText, Bell, Check, AlertTriangle,
  Briefcase, Gavel, Link2, User, CheckSquare, Square, Filter
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getLegalArmId } from '@/lib/cookies'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════
interface CalendarEvent {
  id: string
  owner_type: string
  owner_id: string
  owner_name?: string
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
  ticket_number?: string
  is_private?: boolean
  status?: string
  court_requirements?: CourtRequirement[]
  color?: string
  icon?: string
}

interface CourtRequirement {
  key: string
  label: string
  done: boolean
}

interface Lawyer {
  id: string
  full_name: string
  lawyer_code: string
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

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════
export default function ArmCalendarPage() {
  const [armId, setArmId] = useState<string | null>(null)
  const [armName, setArmName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [myLawyers, setMyLawyers] = useState<Lawyer[]>([])
  
  // Filter
  const [viewMode, setViewMode] = useState<'all' | 'mine' | 'lawyers'>('all')
  const [selectedLawyerId, setSelectedLawyerId] = useState<string>('')
  
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  
  // New Event Form
  const [newEvent, setNewEvent] = useState({
    title: '',
    event_type: 'internal_meeting',
    start_date: '',
    start_time: '',
    all_day: false,
    location: '',
    description: '',
    is_private: false,
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // Load Data
  // ═══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const id = getLegalArmId()
    if (id) {
      setArmId(id)
      loadArmInfo(id)
      loadMyLawyers(id)
    } else {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (armId && myLawyers.length >= 0) {
      loadEvents()
    }
  }, [armId, currentDate, myLawyers, viewMode, selectedLawyerId])

  const loadArmInfo = async (id: string) => {
    const { data } = await supabase
      .from('legal_arms')
      .select('arm_name')
      .eq('id', id)
      .single()
    if (data) setArmName(data.arm_name)
  }

  const loadMyLawyers = async (id: string) => {
    // جلب محامي الشريك
    const { data } = await supabase
      .from('lawyers')
      .select('id, full_name, lawyer_code')
      .eq('arm_id', id)
      .eq('is_active', true)
    
    setMyLawyers(data || [])
  }

  const loadEvents = async () => {
    if (!armId) return
    
    try {
      setLoading(true)
      
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)
      
      let allEvents: CalendarEvent[] = []
      
      // 1. مواعيد الشريك الخاصة
      if (viewMode === 'all' || viewMode === 'mine') {
        const { data: myEvents } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('owner_type', 'partner')
          .eq('owner_id', armId)
          .gte('start_datetime', startOfMonth.toISOString())
          .lte('start_datetime', endOfMonth.toISOString())
        
        if (myEvents) allEvents = [...allEvents, ...myEvents]
      }
      
      // 2. مواعيد محامي الشريك (غير الخاصة)
      if ((viewMode === 'all' || viewMode === 'lawyers') && myLawyers.length > 0) {
        const lawyerIds = selectedLawyerId 
          ? [selectedLawyerId] 
          : myLawyers.map(l => l.id)
        
        const { data: lawyerEvents } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('owner_type', 'arm_lawyer')
          .in('owner_id', lawyerIds)
          .eq('is_private', false) // فقط غير الخاصة
          .gte('start_datetime', startOfMonth.toISOString())
          .lte('start_datetime', endOfMonth.toISOString())
        
        if (lawyerEvents) allEvents = [...allEvents, ...lawyerEvents]
      }
      
      // ترتيب حسب التاريخ
      allEvents.sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
      setEvents(allEvents)
      
    } catch (err) {
      console.error(err)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadEvents()
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
      event_type: 'internal_meeting',
      start_date: '',
      start_time: '',
      all_day: false,
      location: '',
      description: '',
      is_private: false,
    })
  }

  const handleAddEvent = async () => {
    if (!armId || !newEvent.title || !newEvent.start_date || (!newEvent.all_day && !newEvent.start_time)) {
      toast.error('يرجى ملء الحقول المطلوبة')
      return
    }

    try {
      const startDatetime = newEvent.all_day 
        ? `${newEvent.start_date}T00:00:00`
        : `${newEvent.start_date}T${newEvent.start_time}:00`

      const { error } = await supabase.from('calendar_events').insert({
        owner_type: 'arm',
        owner_id: armId,
        owner_name: armName,
        title: newEvent.title,
        description: newEvent.description || null,
        event_type: newEvent.event_type,
        start_datetime: startDatetime,
        all_day: newEvent.all_day,
        location: newEvent.location || null,
        is_private: newEvent.is_private,
        status: 'scheduled',
        created_by: armId,
      })

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
          <p className="text-sm text-gray-500 mt-1">مواعيدك ومواعيد فريقك</p>
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

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">عرض:</span>
          </div>
          
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button 
              onClick={() => setViewMode('all')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'all' ? 'bg-white shadow text-amber-600' : 'text-gray-600'}`}
            >
              الكل
            </button>
            <button 
              onClick={() => setViewMode('mine')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'mine' ? 'bg-white shadow text-amber-600' : 'text-gray-600'}`}
            >
              مواعيدي
            </button>
            <button 
              onClick={() => setViewMode('lawyers')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'lawyers' ? 'bg-white shadow text-amber-600' : 'text-gray-600'}`}
            >
              المحامين
            </button>
          </div>
          
          {(viewMode === 'all' || viewMode === 'lawyers') && myLawyers.length > 0 && (
            <select
              value={selectedLawyerId}
              onChange={(e) => setSelectedLawyerId(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">كل المحامين</option>
              {myLawyers.map(l => (
                <option key={l.id} value={l.id}>{l.full_name}</option>
              ))}
            </select>
          )}
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
              
              <button onClick={goToToday} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium">
                اليوم
              </button>
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
                      const isLawyerEvent = event.owner_type === 'arm_lawyer'
                      return (
                        <button
                          key={event.id}
                          onClick={() => { setSelectedEvent(event); setShowEventModal(true) }}
                          className={`w-full text-right px-2 py-1 rounded text-xs truncate ${config.bgColor} ${config.color} hover:opacity-80 transition ${isLawyerEvent ? 'border-r-2 border-amber-500' : ''}`}
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
            <p className="text-amber-100 text-sm mb-3">أضف موعد جديد</p>
            <button 
              onClick={() => setShowAddModal(true)}
              className="w-full py-2 bg-white text-amber-600 rounded-lg font-semibold hover:bg-amber-50 transition"
            >
              + موعد جديد
            </button>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-bold text-gray-800 mb-3">📊 الإحصائيات</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">إجمالي المواعيد:</span>
                <span className="font-bold">{events.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">جلسات المحكمة:</span>
                <span className="font-bold text-red-600">{events.filter(e => e.event_type === 'court_session').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">عدد المحامين:</span>
                <span className="font-bold">{myLawyers.length}</span>
              </div>
            </div>
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
                        </p>
                        {event.owner_name && event.owner_type === 'arm_lawyer' && (
                          <p className="text-xs text-amber-600">👤 {event.owner_name}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {showEventModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            {(() => {
              const config = eventTypeConfig[selectedEvent.event_type] || eventTypeConfig.other
              const Icon = config.icon
              const isMyEvent = selectedEvent.owner_type === 'arm' && selectedEvent.owner_id === armId
              return (
                <>
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
                    {selectedEvent.owner_type === 'arm_lawyer' && (
                      <p className="mt-2 text-sm bg-white/30 rounded px-2 py-1 inline-block">
                        👤 {selectedEvent.owner_name || 'محامي'}
                      </p>
                    )}
                  </div>
                  
                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3 text-gray-600">
                      <Clock className="w-5 h-5" />
                      <div>
                        <p className="font-medium">{formatDate(selectedEvent.start_datetime)}</p>
                        {!selectedEvent.all_day && <p className="text-sm">{formatTime(selectedEvent.start_datetime)}</p>}
                      </div>
                    </div>
                    
                    {(selectedEvent.location || selectedEvent.court_name) && (
                      <div className="flex items-center gap-3 text-gray-600">
                        <MapPin className="w-5 h-5" />
                        <p>{selectedEvent.court_name || selectedEvent.location}</p>
                      </div>
                    )}
                    
                    {selectedEvent.ticket_number && (
                      <div className="bg-amber-50 rounded-lg p-3">
                        <p className="text-sm text-amber-700">🎫 {selectedEvent.ticket_number}</p>
                      </div>
                    )}
                    
                    {selectedEvent.description && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-gray-700">{selectedEvent.description}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex gap-3">
                    {isMyEvent && (
                      <button 
                        onClick={() => deleteEvent(selectedEvent.id)}
                        className="flex-1 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-semibold text-sm"
                      >
                        🗑️ حذف
                      </button>
                    )}
                    <button 
                      onClick={() => setShowEventModal(false)}
                      className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold text-sm"
                    >
                      إغلاق
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">➕ إضافة موعد</h3>
                <button onClick={() => { setShowAddModal(false); resetNewEvent() }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">العنوان *</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="عنوان الموعد"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">النوع</label>
                <select
                  value={newEvent.event_type}
                  onChange={(e) => setNewEvent({...newEvent, event_type: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  {Object.entries(eventTypeConfig).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">التاريخ *</label>
                <input
                  type="date"
                  value={newEvent.start_date}
                  onChange={(e) => setNewEvent({...newEvent, start_date: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {!newEvent.all_day && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">الوقت *</label>
                  <input
                    type="time"
                    value={newEvent.start_time}
                    onChange={(e) => setNewEvent({...newEvent, start_time: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newEvent.all_day}
                  onChange={(e) => setNewEvent({...newEvent, all_day: e.target.checked})}
                  className="w-4 h-4 text-amber-500 rounded"
                />
                <span className="text-sm text-gray-600">طوال اليوم</span>
              </label>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">المكان</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="المكان"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">ملاحظات</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newEvent.is_private}
                  onChange={(e) => setNewEvent({...newEvent, is_private: e.target.checked})}
                  className="w-4 h-4 text-amber-500 rounded"
                />
                <span className="text-sm text-gray-600">🔒 موعد خاص</span>
              </label>
            </div>

            <div className="border-t p-4 flex gap-3">
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
