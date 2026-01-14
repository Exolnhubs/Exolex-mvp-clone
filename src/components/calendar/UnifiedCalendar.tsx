'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  ChevronRight, ChevronLeft, Plus, RefreshCw, X, Calendar as CalendarIcon,
  Clock, MapPin, Users, Video, Phone, FileText, Bell, Check, AlertTriangle,
  Gavel, Link2, User, CheckSquare, Square, Filter, ExternalLink, Trash2,
  Edit3, Copy, MoreVertical
} from 'lucide-react'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════
export interface CalendarEvent {
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
  case_id?: string
  ticket_number?: string
  is_private?: boolean
  notify_client?: boolean
  status?: string
  participants?: any[]
  reminder_settings?: { enabled: boolean; times: string[] }
  court_requirements?: CourtRequirement[]
  color?: string
  icon?: string
  created_at?: string
}

export interface CourtRequirement {
  key: string
  label: string
  done: boolean
}

export interface RequestOption {
  id: string
  ticket_number: string
  title: string
}

export interface LawyerOption {
  id: string
  full_name: string
  lawyer_code?: string
}

export type UserType = 'lawyer' | 'arm_lawyer' | 'partner_lawyer' | 'member' | 'partner' | 'arm'
export type ViewMode = 'month' | 'week' | 'day'

// ═══════════════════════════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════════════════════════
export interface UnifiedCalendarProps {
  userType: UserType
  userId: string
  userName?: string
  // صلاحيات
  canAddCourtSession?: boolean
  canAddConsultation?: boolean
  canLinkToRequest?: boolean
  canNotifyClient?: boolean
  canSeeOthersEvents?: boolean
  canEditOthersEvents?: boolean
  // للمديرين
  managedLawyerIds?: string[]
  managedLawyers?: LawyerOption[]
  // تخصيص
  allowedEventTypes?: string[]
  defaultEventType?: string
  showRequirements?: boolean
  // Callbacks
  onEventClick?: (event: CalendarEvent) => void
  onEventAdd?: (event: CalendarEvent) => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════════════════
type IconComponent = React.ComponentType<{ className?: string }>

export const eventTypeConfig: Record<string, { 
  label: string
  icon: IconComponent
  color: string
  bgColor: string
  borderColor: string 
}> = {
  court_session: { 
    label: 'جلسة محكمة', 
    icon: Gavel, 
    color: 'text-red-700', 
    bgColor: 'bg-red-100',
    borderColor: 'border-red-400'
  },
  consultation: { 
    label: 'استشارة', 
    icon: FileText, 
    color: 'text-purple-700', 
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-400'
  },
  client_meeting: { 
    label: 'اجتماع عميل', 
    icon: Users, 
    color: 'text-blue-700', 
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-400'
  },
  phone_call: { 
    label: 'مكالمة هاتفية', 
    icon: Phone, 
    color: 'text-green-700', 
    bgColor: 'bg-green-100',
    borderColor: 'border-green-400'
  },
  video_call: { 
    label: 'اجتماع مرئي', 
    icon: Video, 
    color: 'text-indigo-700', 
    bgColor: 'bg-indigo-100',
    borderColor: 'border-indigo-400'
  },
  internal_meeting: { 
    label: 'اجتماع داخلي', 
    icon: Users, 
    color: 'text-amber-700', 
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-400'
  },
  deadline: { 
    label: 'موعد نهائي', 
    icon: AlertTriangle, 
    color: 'text-orange-700', 
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-400'
  },
  reminder: { 
    label: 'تذكير', 
    icon: Bell, 
    color: 'text-yellow-700', 
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-400'
  },
  personal: { 
    label: 'شخصي', 
    icon: User, 
    color: 'text-gray-700', 
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-400'
  },
  task: { 
    label: 'مهمة', 
    icon: CheckSquare, 
    color: 'text-teal-700', 
    bgColor: 'bg-teal-100',
    borderColor: 'border-teal-400'
  },
  other: { 
    label: 'أخرى', 
    icon: CalendarIcon, 
    color: 'text-slate-700', 
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-400'
  },
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
  { value: '1w', label: 'قبل أسبوع' },
  { value: '2d', label: 'قبل يومين' },
  { value: '1d', label: 'قبل يوم' },
  { value: '12h', label: 'قبل 12 ساعة' },
  { value: '3h', label: 'قبل 3 ساعات' },
  { value: '1h', label: 'قبل ساعة' },
  { value: '30m', label: 'قبل 30 دقيقة' },
]

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

// أنواع المواعيد للمشتركين فقط
const MEMBER_EVENT_TYPES = ['reminder', 'personal', 'deadline', 'task', 'other']

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
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

const formatDateShort = (date: Date) => {
  return date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })
}

const isToday = (date: Date) => {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

const isSameDay = (date1: Date, date2: Date) => {
  return date1.toDateString() === date2.toDateString()
}

// Google Calendar URL Generator
const generateGoogleCalendarUrl = (event: CalendarEvent) => {
  const startDate = new Date(event.start_datetime)
  const endDate = event.end_datetime ? new Date(event.end_datetime) : new Date(startDate.getTime() + 60 * 60 * 1000)
  
  const formatGoogleDate = (date: Date) => {
    return date.toISOString().replace(/-|:|\.\d{3}/g, '').slice(0, -1)
  }
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`,
    details: event.description || '',
    location: event.court_name || event.location || '',
  })
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════
export default function UnifiedCalendar({
  userType,
  userId,
  userName = '',
  canAddCourtSession = false,
  canAddConsultation = false,
  canLinkToRequest = false,
  canNotifyClient = false,
  canSeeOthersEvents = false,
  canEditOthersEvents = false,
  managedLawyerIds = [],
  managedLawyers = [],
  allowedEventTypes,
  defaultEventType = 'reminder',
  showRequirements = false,
  onEventClick,
  onEventAdd,
}: UnifiedCalendarProps) {
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════════
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [myRequests, setMyRequests] = useState<RequestOption[]>([])
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  
  // Filter for managers
  const [filterLawyerId, setFilterLawyerId] = useState<string>('')
  const [filterView, setFilterView] = useState<'all' | 'mine' | 'others'>('all')
  
  // Double click detection
  const lastClickTime = useRef<number>(0)
  const lastClickDate = useRef<string>('')
  
  // Drag state
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null)

  // Determine available event types
  const availableEventTypes = allowedEventTypes || (
    userType === 'member' 
      ? MEMBER_EVENT_TYPES 
      : Object.keys(eventTypeConfig).filter(type => {
          if (type === 'court_session' && !canAddCourtSession) return false
          if (type === 'consultation' && !canAddConsultation) return false
          return true
        })
  )

  // New Event Form
  const getInitialEventForm = (date?: Date) => ({
    title: '',
    event_type: availableEventTypes.includes(defaultEventType) ? defaultEventType : availableEventTypes[0],
    start_date: date ? date.toISOString().split('T')[0] : '',
    start_time: '09:00',
    end_time: '10:00',
    all_day: false,
    location: '',
    location_type: 'physical' as const,
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
  
  const [newEvent, setNewEvent] = useState(getInitialEventForm())

  // ═══════════════════════════════════════════════════════════════════════════════
  // Load Data
  // ═══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (userId) {
      loadEvents()
      if (canLinkToRequest) {
        loadMyRequests()
      }
    } else {
      setLoading(false)
    }
  }, [userId, currentDate, filterLawyerId, filterView])

  const loadEvents = async () => {
    try {
      setLoading(true)
      
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)
      
      let allEvents: CalendarEvent[] = []
      
      // 1. مواعيد المستخدم الحالي
      if (filterView === 'all' || filterView === 'mine') {
        const { data: myEvents, error } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('owner_id', userId)
          .gte('start_datetime', startOfMonth.toISOString())
          .lte('start_datetime', endOfMonth.toISOString())
        
        if (!error && myEvents) {
          allEvents = [...allEvents, ...myEvents]
        }
      }
      
      // 2. مواعيد المحامين (للمديرين)
      if (canSeeOthersEvents && managedLawyerIds.length > 0 && (filterView === 'all' || filterView === 'others')) {
        const lawyerIds = filterLawyerId ? [filterLawyerId] : managedLawyerIds
        
        const { data: lawyerEvents, error } = await supabase
          .from('calendar_events')
          .select('*')
          .in('owner_id', lawyerIds)
          .eq('is_private', false) // فقط غير الخاصة
          .gte('start_datetime', startOfMonth.toISOString())
          .lte('start_datetime', endOfMonth.toISOString())
        
        if (!error && lawyerEvents) {
          allEvents = [...allEvents, ...lawyerEvents]
        }
      }
      
      // 3. مواعيد مرتبطة بطلبات المشترك (إذا كان مشترك)
      if (userType === 'member') {
        const { data: requestEvents, error } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('owner_type', 'member')
          .eq('owner_id', userId)
          .gte('start_datetime', startOfMonth.toISOString())
          .lte('start_datetime', endOfMonth.toISOString())
        
        // هذه المواعيد أضافها المحامي ونسخها Trigger للعميل
        if (!error && requestEvents) {
          // إزالة التكرار
          const existingIds = new Set(allEvents.map(e => e.id))
          const newEvents = requestEvents.filter(e => !existingIds.has(e.id))
          allEvents = [...allEvents, ...newEvents]
        }
      }
      
      // ترتيب حسب التاريخ
      allEvents.sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
      
      // إزالة التكرار النهائي
      const uniqueEvents = Array.from(new Map(allEvents.map(e => [e.id, e])).values())
      setEvents(uniqueEvents)
      
    } catch (err) {
      console.error('Error loading events:', err)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const loadMyRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('id, ticket_number, title')
        .eq('assigned_lawyer_id', userId)
        .in('status', ['assigned', 'in_progress', 'pending'])
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (!error) {
        setMyRequests(data || [])
      }
    } catch (err) {
      console.error('Error loading requests:', err)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadEvents()
    setRefreshing(false)
    toast.success('تم التحديث')
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
    setSelectedDate(new Date())
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Calendar Grid Generation
  // ═══════════════════════════════════════════════════════════════════════════════
  const generateCalendarDays = useCallback(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    
    const startDay = firstDayOfMonth.getDay()
    const totalDays = lastDayOfMonth.getDate()
    
    const days: { date: Date; isCurrentMonth: boolean; events: CalendarEvent[] }[] = []
    
    // أيام الشهر السابق
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i)
      days.push({ date, isCurrentMonth: false, events: [] })
    }
    
    // أيام الشهر الحالي
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(year, month, i)
      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.start_datetime)
        return eventDate.toDateString() === date.toDateString()
      })
      days.push({ date, isCurrentMonth: true, events: dayEvents })
    }
    
    // أيام الشهر التالي
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i)
      days.push({ date, isCurrentMonth: false, events: [] })
    }
    
    return days
  }, [currentDate, events])

  // ═══════════════════════════════════════════════════════════════════════════════
  // Day Click Handler (Single & Double Click)
  // ═══════════════════════════════════════════════════════════════════════════════
  const handleDayClick = (date: Date) => {
    const now = Date.now()
    const dateStr = date.toDateString()
    
    // Check for double click (within 300ms on same date)
    if (now - lastClickTime.current < 300 && lastClickDate.current === dateStr) {
      // Double click - open add modal
      setNewEvent(getInitialEventForm(date))
      setShowAddModal(true)
      lastClickTime.current = 0
      lastClickDate.current = ''
    } else {
      // Single click - select date
      setSelectedDate(date)
      lastClickTime.current = now
      lastClickDate.current = dateStr
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Drag & Drop
  // ═══════════════════════════════════════════════════════════════════════════════
  const handleDragStart = (event: CalendarEvent, e: React.DragEvent) => {
    // فقط صاحب الموعد يستطيع السحب
    if (event.owner_id !== userId && !canEditOthersEvents) return
    
    setDraggedEvent(event)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (date: Date, e: React.DragEvent) => {
    e.preventDefault()
    
    if (!draggedEvent) return
    
    try {
      const oldDate = new Date(draggedEvent.start_datetime)
      const newDateTime = new Date(date)
      newDateTime.setHours(oldDate.getHours(), oldDate.getMinutes())
      
      const { error } = await supabase
        .from('calendar_events')
        .update({ 
          start_datetime: newDateTime.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', draggedEvent.id)
      
      if (error) throw error
      
      toast.success('✅ تم نقل الموعد')
      handleRefresh()
    } catch (error) {
      toast.error('حدث خطأ في نقل الموعد')
    } finally {
      setDraggedEvent(null)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Add Event
  // ═══════════════════════════════════════════════════════════════════════════════
  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.start_date || (!newEvent.all_day && !newEvent.start_time)) {
      toast.error('يرجى ملء الحقول المطلوبة')
      return
    }

    try {
      const startDatetime = newEvent.all_day 
        ? `${newEvent.start_date}T00:00:00`
        : `${newEvent.start_date}T${newEvent.start_time}:00`
      
      const endDatetime = newEvent.end_time && !newEvent.all_day
        ? `${newEvent.start_date}T${newEvent.end_time}:00`
        : null

      // Get ticket_number if request selected
      let ticketNumber = null
      if (newEvent.request_id) {
        const req = myRequests.find(r => r.id === newEvent.request_id)
        if (req) ticketNumber = req.ticket_number
      }

      const eventData: any = {
        owner_type: userType,
        owner_id: userId,
        owner_name: userName,
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
        notify_client: newEvent.notify_client && canNotifyClient,
        request_id: newEvent.request_id || null,
        ticket_number: ticketNumber,
        status: 'scheduled',
        created_by: userId,
        reminder_settings: {
          enabled: true,
          times: newEvent.reminder_times
        },
      }

      // Court session specific fields
      if (newEvent.event_type === 'court_session') {
        eventData.court_name = newEvent.court_name || null
        eventData.court_room = newEvent.court_room || null
        eventData.court_requirements = newEvent.court_requirements
        eventData.color = '#DC2626'
        eventData.icon = '⚖️'
      }

      const { data, error } = await supabase
        .from('calendar_events')
        .insert(eventData)
        .select()
        .single()

      if (error) throw error

      toast.success('✅ تم إضافة الموعد')
      
      if (onEventAdd && data) {
        onEventAdd(data)
      }
      
      setShowAddModal(false)
      setNewEvent(getInitialEventForm())
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
      const { error } = await supabase
        .from('calendar_events')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', eventId)
      
      if (error) throw error
      
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
      const { error } = await supabase
        .from('calendar_events')
        .update({ court_requirements: updated })
        .eq('id', eventId)
      
      if (error) throw error
      
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
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId)
      
      if (error) throw error
      
      toast.success('✅ تم الحذف')
      setShowEventModal(false)
      handleRefresh()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Computed Values
  // ═══════════════════════════════════════════════════════════════════════════════
  const calendarDays = generateCalendarDays()
  
  const selectedDayEvents = selectedDate 
    ? events.filter(e => isSameDay(new Date(e.start_datetime), selectedDate))
    : []

  const upcomingEvents = events
    .filter(e => new Date(e.start_datetime) >= new Date())
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
    .slice(0, 5)

  const stats = {
    total: events.length,
    courtSessions: events.filter(e => e.event_type === 'court_session').length,
    upcoming: upcomingEvents.length,
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════════
  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* ═══════════════════════════════════════════════════════════════════════════════
          Header
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-7 h-7 text-amber-500" />
            التقويم
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {userType === 'member' ? 'مواعيدك وتذكيراتك' : 'إدارة مواعيدك وجلساتك'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="تحديث"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => {
              setNewEvent(getInitialEventForm(selectedDate || new Date()))
              setShowAddModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition font-semibold"
          >
            <Plus className="w-5 h-5" />
            إضافة موعد
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          Filters (للمديرين)
          ═══════════════════════════════════════════════════════════════════════════════ */}
      {canSeeOthersEvents && managedLawyers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">عرض:</span>
            </div>
            
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['all', 'mine', 'others'] as const).map((view) => (
                <button 
                  key={view}
                  onClick={() => setFilterView(view)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                    filterView === view ? 'bg-white shadow text-amber-600' : 'text-gray-600'
                  }`}
                >
                  {view === 'all' ? 'الكل' : view === 'mine' ? 'مواعيدي' : 'المحامين'}
                </button>
              ))}
            </div>
            
            {(filterView === 'all' || filterView === 'others') && (
              <select
                value={filterLawyerId}
                onChange={(e) => setFilterLawyerId(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">كل المحامين</option>
                {managedLawyers.map(l => (
                  <option key={l.id} value={l.id}>{l.full_name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ═══════════════════════════════════════════════════════════════════════════════
            Main Calendar
            ═══════════════════════════════════════════════════════════════════════════════ */}
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
                <button 
                  onClick={goToToday} 
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                >
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
                <div 
                  key={idx} 
                  className={`py-3 text-center text-sm font-semibold ${
                    idx === 5 || idx === 6 ? 'text-red-600' : 'text-gray-600'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const isSelected = selectedDate && isSameDay(day.date, selectedDate)
                const isTodayDate = isToday(day.date)
                
                return (
                  <div 
                    key={idx}
                    onClick={() => handleDayClick(day.date)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(day.date, e)}
                    className={`min-h-[100px] p-2 border-b border-l border-gray-100 cursor-pointer transition
                      ${!day.isCurrentMonth ? 'bg-gray-50' : 'hover:bg-gray-50'}
                      ${isTodayDate ? 'bg-amber-50' : ''}
                      ${isSelected ? 'ring-2 ring-amber-500 ring-inset' : ''}
                    `}
                  >
                    <div className={`text-sm font-semibold mb-1 ${
                      !day.isCurrentMonth ? 'text-gray-400' : 
                      isTodayDate ? 'text-amber-600' : 'text-gray-700'
                    }`}>
                      {day.date.getDate()}
                    </div>
                    
                    <div className="space-y-1">
                      {day.events.slice(0, 3).map((event) => {
                        const config = eventTypeConfig[event.event_type] || eventTypeConfig.other
                        const isOthersEvent = event.owner_id !== userId
                        
                        return (
                          <div
                            key={event.id}
                            draggable={event.owner_id === userId || canEditOthersEvents}
                            onDragStart={(e) => handleDragStart(event, e)}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedEvent(event)
                              setShowEventModal(true)
                              if (onEventClick) onEventClick(event)
                            }}
                            className={`w-full text-right px-2 py-1 rounded text-xs truncate cursor-pointer
                              ${config.bgColor} ${config.color} hover:opacity-80 transition
                              ${isOthersEvent ? 'border-r-2 ' + config.borderColor : ''}
                            `}
                            title={event.title}
                          >
                            {event.all_day ? '🌞' : formatTime(event.start_datetime).slice(0, 5)} {event.title}
                          </div>
                        )
                      })}
                      {day.events.length > 3 && (
                        <p className="text-xs text-gray-500 text-center">
                          +{day.events.length - 3} المزيد
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Double-click hint */}
            <div className="p-3 bg-gray-50 border-t text-center text-xs text-gray-500">
              💡 اضغط مرتين على أي يوم لإضافة موعد جديد
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════════
            Sidebar
            ═══════════════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-6">
          {/* Quick Add */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
            <h3 className="font-bold mb-2">📅 إضافة سريعة</h3>
            <p className="text-amber-100 text-sm mb-3">
              {userType === 'member' ? 'أضف تذكير أو موعد شخصي' : 'أضف موعد جديد'}
            </p>
            <button 
              onClick={() => {
                setNewEvent(getInitialEventForm(selectedDate || new Date()))
                setShowAddModal(true)
              }}
              className="w-full py-2 bg-white text-amber-600 rounded-lg font-semibold hover:bg-amber-50 transition"
            >
              + موعد جديد
            </button>
          </div>

          {/* Selected Day Events */}
          {selectedDate && selectedDayEvents.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-amber-500" />
                {formatDateShort(selectedDate)}
              </h3>
              <div className="space-y-2">
                {selectedDayEvents.map((event) => {
                  const config = eventTypeConfig[event.event_type] || eventTypeConfig.other
                  const Icon = config.icon
                  return (
                    <button
                      key={event.id}
                      onClick={() => {
                        setSelectedEvent(event)
                        setShowEventModal(true)
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition text-right"
                    >
                      <Icon className={`w-4 h-4 ${config.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{event.title}</p>
                        <p className="text-xs text-gray-500">
                          {event.all_day ? 'طوال اليوم' : formatTime(event.start_datetime)}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Upcoming Events */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              المواعيد القادمة
            </h3>
            
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <CalendarIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">لا توجد مواعيد قادمة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => {
                  const config = eventTypeConfig[event.event_type] || eventTypeConfig.other
                  const Icon = config.icon
                  const isOthersEvent = event.owner_id !== userId
                  
                  return (
                    <button
                      key={event.id}
                      onClick={() => {
                        setSelectedEvent(event)
                        setShowEventModal(true)
                      }}
                      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition text-right"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bgColor}`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{event.title}</p>
                        <p className="text-xs text-gray-500">
                          {formatDateShort(new Date(event.start_datetime))}
                          {!event.all_day && ` - ${formatTime(event.start_datetime)}`}
                        </p>
                        {event.ticket_number && (
                          <p className="text-xs text-amber-600">🎫 {event.ticket_number}</p>
                        )}
                        {isOthersEvent && event.owner_name && (
                          <p className="text-xs text-blue-600">👤 {event.owner_name}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-bold text-gray-800 mb-3">📊 الإحصائيات</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">إجمالي المواعيد:</span>
                <span className="font-bold">{stats.total}</span>
              </div>
              {(canAddCourtSession || canSeeOthersEvents) && (
                <div className="flex justify-between">
                  <span className="text-gray-600">جلسات المحكمة:</span>
                  <span className="font-bold text-red-600">{stats.courtSessions}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">القادمة:</span>
                <span className="font-bold text-green-600">{stats.upcoming}</span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-bold text-gray-800 mb-3">🎨 دليل الألوان</h3>
            <div className="space-y-2">
              {Object.entries(eventTypeConfig)
                .filter(([key]) => availableEventTypes.includes(key) || key === 'court_session')
                .slice(0, 6)
                .map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <div className={`w-3 h-3 rounded ${val.bgColor}`}></div>
                    <span className="text-gray-600">{val.label}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Info for Members */}
          {userType === 'member' && (
            <div className="bg-blue-50 rounded-xl p-4">
              <h4 className="font-bold text-blue-800 mb-2">💡 معلومة</h4>
              <p className="text-sm text-blue-700">
                المواعيد المرتبطة بطلباتك (جلسات المحكمة، الاستشارات) يضيفها المحامي وتظهر هنا تلقائياً.
              </p>
            </div>
          )}
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
              const isMyEvent = selectedEvent.owner_id === userId
              const canEdit = isMyEvent || canEditOthersEvents
              
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
                      <button 
                        onClick={() => setShowEventModal(false)} 
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                    
                    {/* Status & Tags */}
                    <div className="mt-3 flex flex-wrap gap-2">
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
                        <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded-full text-xs">
                          🔒 خاص
                        </span>
                      )}
                      {!isMyEvent && selectedEvent.owner_name && (
                        <span className="px-2 py-1 bg-blue-200 text-blue-700 rounded-full text-xs">
                          👤 {selectedEvent.owner_name}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-6 space-y-4">
                    {/* Date & Time */}
                    <div className="flex items-center gap-3 text-gray-600">
                      <Clock className="w-5 h-5 flex-shrink-0" />
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
                        <MapPin className="w-5 h-5 flex-shrink-0" />
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
                        <Video className="w-5 h-5 flex-shrink-0" />
                        <a 
                          href={selectedEvent.meeting_link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-blue-600 hover:underline truncate"
                        >
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
                    {selectedEvent.event_type === 'court_session' && 
                     selectedEvent.court_requirements && 
                     selectedEvent.court_requirements.length > 0 && (
                      <div className="border rounded-lg p-4">
                        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                          <CheckSquare className="w-5 h-5 text-amber-500" />
                          متطلبات الجلسة
                        </h4>
                        <div className="space-y-2">
                          {selectedEvent.court_requirements.map((req) => (
                            <button
                              key={req.key}
                              onClick={() => canEdit && toggleRequirement(selectedEvent.id, req.key)}
                              disabled={!canEdit}
                              className={`w-full flex items-center gap-3 p-2 rounded-lg transition ${
                                req.done ? 'bg-green-50' : 'bg-gray-50'
                              } ${canEdit ? 'hover:bg-gray-100 cursor-pointer' : 'cursor-default'}`}
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
                    
                    {/* Google Calendar Export */}
                    <div className="pt-2">
                      <a
                        href={generateGoogleCalendarUrl(selectedEvent)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 text-sm font-medium transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                        إضافة لـ Google Calendar
                      </a>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="p-4 border-t bg-gray-50 rounded-b-2xl space-y-2">
                    {canEdit && selectedEvent.status !== 'completed' && selectedEvent.status !== 'cancelled' && (
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
                      {canEdit && (
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
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-4 rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">➕ إضافة موعد جديد</h3>
                <button 
                  onClick={() => {
                    setShowAddModal(false)
                    setNewEvent(getInitialEventForm())
                  }} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  عنوان الموعد <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder={userType === 'member' ? 'مثال: تجديد الإقامة' : 'مثال: جلسة محكمة - قضية نفقة'}
                />
              </div>

              {/* Event Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  نوع الموعد <span className="text-red-500">*</span>
                </label>
                <select
                  value={newEvent.event_type}
                  onChange={(e) => setNewEvent({...newEvent, event_type: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  {availableEventTypes.map((type) => (
                    <option key={type} value={type}>
                      {eventTypeConfig[type]?.label || type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    التاريخ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newEvent.start_date}
                    onChange={(e) => setNewEvent({...newEvent, start_date: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                {!newEvent.all_day && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      الوقت <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={newEvent.start_time}
                      onChange={(e) => setNewEvent({...newEvent, start_time: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* End Time */}
              {!newEvent.all_day && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">وقت الانتهاء</label>
                  <input
                    type="time"
                    value={newEvent.end_time}
                    onChange={(e) => setNewEvent({...newEvent, end_time: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              {/* All Day */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newEvent.all_day}
                  onChange={(e) => setNewEvent({...newEvent, all_day: e.target.checked})}
                  className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                />
                <span className="text-sm text-gray-600">طوال اليوم</span>
              </label>

              {/* Court Session Fields */}
              {newEvent.event_type === 'court_session' && canAddCourtSession && (
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

                  {/* Court Requirements */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">متطلبات الجلسة</label>
                    <div className="grid grid-cols-2 gap-2">
                      {newEvent.court_requirements.map((req, idx) => (
                        <label key={req.key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={req.done}
                            onChange={(e) => {
                              const updated = [...newEvent.court_requirements]
                              updated[idx] = { ...req, done: e.target.checked }
                              setNewEvent({...newEvent, court_requirements: updated})
                            }}
                            className="w-4 h-4 rounded"
                          />
                          <span className={req.done ? 'line-through text-gray-400' : ''}>{req.label}</span>
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

              {/* Meeting Link */}
              {(newEvent.event_type === 'video_call' || newEvent.event_type === 'consultation') && (
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
              {canLinkToRequest && myRequests.length > 0 && (
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
              )}

              {/* Reminders */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">التذكيرات</label>
                <div className="flex flex-wrap gap-2">
                  {REMINDER_OPTIONS.map((opt) => (
                    <label 
                      key={opt.value} 
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full border cursor-pointer transition ${
                        newEvent.reminder_times.includes(opt.value) 
                          ? 'bg-amber-100 border-amber-400 text-amber-700' 
                          : 'bg-gray-50 border-gray-300 text-gray-600'
                      }`}
                    >
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
                        className="sr-only"
                      />
                      <Bell className="w-3 h-3" />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
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
              <div className="space-y-2 pt-2 border-t">
                {/* خيار موعد خاص - فقط للمحامين (ليس للمشترك) */}
                {userType !== 'member' && userType !== 'partner' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEvent.is_private}
                      onChange={(e) => setNewEvent({...newEvent, is_private: e.target.checked})}
                      className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-600">🔒 موعد خاص (لا يظهر للمدير)</span>
                  </label>
                )}
                
                {canNotifyClient && newEvent.request_id && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEvent.notify_client}
                      onChange={(e) => setNewEvent({...newEvent, notify_client: e.target.checked})}
                      className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-600">📢 إشعار العميل بالموعد</span>
                  </label>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t p-4 rounded-b-2xl flex gap-3">
              <button 
                onClick={() => {
                  setShowAddModal(false)
                  setNewEvent(getInitialEventForm())
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition"
              >
                إلغاء
              </button>
              <button 
                onClick={handleAddEvent}
                disabled={!newEvent.title || !newEvent.start_date || (!newEvent.all_day && !newEvent.start_time)}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                ✅ حفظ الموعد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
