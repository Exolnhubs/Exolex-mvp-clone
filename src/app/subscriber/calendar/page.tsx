'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import toast from 'react-hot-toast'

interface User {
  id: string
  full_name: string
}

interface CalendarEvent {
  id: string
  title: string
  date: string
  time_start: string
  time_end?: string
  event_type: string
  description?: string
  meeting_link?: string
  lawyer_name?: string
  location?: string
}

const EVENT_TYPES = [
  { id: 'legal_session', name: 'جلسة قانونية', color: 'bg-blue-500', bgLight: 'bg-blue-100', textColor: 'text-blue-800' },
  { id: 'voice_consultation', name: 'استشارة صوتية', color: 'bg-green-500', bgLight: 'bg-green-100', textColor: 'text-green-800' },
  { id: 'video_consultation', name: 'استشارة مرئية', color: 'bg-purple-500', bgLight: 'bg-purple-100', textColor: 'text-purple-800' },
  { id: 'in_person', name: 'استشارة حضورية', color: 'bg-orange-500', bgLight: 'bg-orange-100', textColor: 'text-orange-800' },
  { id: 'urgent', name: 'موعد مهم/عاجل', color: 'bg-red-500', bgLight: 'bg-red-100', textColor: 'text-red-800' },
  { id: 'personal', name: 'موعد خاص', color: 'bg-gray-500', bgLight: 'bg-gray-100', textColor: 'text-gray-800' },
  { id: 'reminder', name: 'تذكير', color: 'bg-yellow-400', bgLight: 'bg-yellow-100', textColor: 'text-yellow-800' },
]

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // 7 AM to 9 PM

export default function CalendarPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly' | 'daily'>('monthly')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time_start: '',
    time_end: '',
    event_type: 'personal',
    description: '',
    meeting_link: '',
    reminder: '30'
  })

  useEffect(() => {
    const userId = localStorage.getItem('exolex_user_id')
    if (!userId) { router.push('/auth/login'); return }

    const fetchData = async () => {
      const { data: userData } = await supabase
        .from('users').select('id, full_name').eq('id', userId).single()
      if (userData) setUser(userData)

      const { data: memberData } = await supabase.from('members').select('id').eq('user_id', userId).single()

      const { data: subData } = await supabase
        .from('subscriptions').select('id')
        .eq('member_id', memberData?.id).eq('status', 'active').single()
      if (subData) setIsSubscribed(true)

      setEvents([
        { id: '1', title: 'جلسة محكمة - قضية #1234', date: '2025-01-05', time_start: '10:00', event_type: 'legal_session', lawyer_name: 'أحمد السالم' },
        { id: '2', title: 'استشارة عبر الفيديو', date: '2025-01-08', time_start: '14:30', event_type: 'video_consultation', lawyer_name: 'فاطمة الحربي', meeting_link: 'https://meet.google.com/abc' },
        { id: '3', title: 'مكالمة هاتفية', date: '2025-01-12', time_start: '11:00', event_type: 'voice_consultation', lawyer_name: 'خالد المطيري' },
        { id: '4', title: 'موعد مهم - تسليم مستندات', date: '2025-01-15', time_start: '09:00', event_type: 'urgent' },
        { id: '5', title: 'اجتماع مع العميل', date: '2024-12-29', time_start: '15:00', event_type: 'in_person' },
        { id: '6', title: 'تذكير: تجديد الاشتراك', date: '2024-12-30', time_start: '09:00', event_type: 'reminder' },
      ])

      setIsLoading(false)
    }
    fetchData()
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('exolex_user_id')
    router.push('/auth/login')
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    return { daysInMonth: lastDay.getDate(), startingDay: firstDay.getDay() }
  }

  const getWeekDays = (date: Date) => {
    const day = date.getDay()
    const diff = date.getDate() - day
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(date)
      d.setDate(diff + i)
      return d
    })
  }

  const getEventsForDate = (dateStr: string) => {
    return events.filter(e => e.date === dateStr)
  }

  const formatDateStr = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const getEventType = (typeId: string) => EVENT_TYPES.find(t => t.id === typeId) || EVENT_TYPES[5]

  const prevPeriod = () => {
    if (viewMode === 'monthly') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    } else if (viewMode === 'weekly') {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() - 7)
      setCurrentDate(newDate)
    } else {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() - 1)
      setCurrentDate(newDate)
    }
  }

  const nextPeriod = () => {
    if (viewMode === 'monthly') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    } else if (viewMode === 'weekly') {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() + 7)
      setCurrentDate(newDate)
    } else {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() + 1)
      setCurrentDate(newDate)
    }
  }

  const goToToday = () => setCurrentDate(new Date())

  const handleDayDoubleClick = (date: Date) => {
    setNewEvent({
      ...newEvent,
      date: formatDateStr(date)
    })
    setShowAddModal(true)
  }

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.time_start) {
      toast.error('يرجى ملء الحقول المطلوبة')
      return
    }
    const event: CalendarEvent = {
      id: Date.now().toString(),
      title: newEvent.title,
      date: newEvent.date,
      time_start: newEvent.time_start,
      event_type: newEvent.event_type,
      description: newEvent.description,
      meeting_link: newEvent.meeting_link
    }
    setEvents([...events, event])
    setShowAddModal(false)
    setNewEvent({ title: '', date: '', time_start: '', time_end: '', event_type: 'personal', description: '', meeting_link: '', reminder: '30' })
    toast.success('تم إضافة الموعد بنجاح')
  }

  const { daysInMonth, startingDay } = getDaysInMonth(currentDate)
  const weekDays = getWeekDays(currentDate)
  const today = new Date()
  const isToday = (date: Date) => date.toDateString() === today.toDateString()

  const upcomingEvents = events
    .filter(e => new Date(e.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5)

  const getHeaderTitle = () => {
    if (viewMode === 'monthly') {
      return `${MONTHS_AR[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    } else if (viewMode === 'weekly') {
      const start = weekDays[0]
      const end = weekDays[6]
      return `${start.getDate()} - ${end.getDate()} ${MONTHS_AR[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    } else {
      return `${currentDate.getDate()} ${MONTHS_AR[currentDate.getMonth()]} ${currentDate.getFullYear()} - ${DAYS_AR[currentDate.getDay()]}`
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isSubscribed={isSubscribed} userName={user?.full_name || ''} onLogout={handleLogout} />

      <main className="flex-1 mr-64 flex">
        <div className="flex-1 p-8">
          <header className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-gray-900">📅 التقويم</h1>
              <div className="flex items-center gap-2">
                <button onClick={nextPeriod} className="p-2 rounded-full hover:bg-gray-100 transition-colors">❯</button>
                <span className="text-xl font-medium text-gray-700 min-w-[200px] text-center">{getHeaderTitle()}</span>
                <button onClick={prevPeriod} className="p-2 rounded-full hover:bg-gray-100 transition-colors">❮</button>
              </div>
              <button onClick={goToToday} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">اليوم</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 p-1 rounded-lg flex">
                {[
                  { key: 'daily', label: 'يومي' },
                  { key: 'weekly', label: 'أسبوعي' },
                  { key: 'monthly', label: 'شهري' }
                ].map((view) => (
                  <button
                    key={view.key}
                    onClick={() => setViewMode(view.key as 'daily' | 'weekly' | 'monthly')}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${viewMode === view.key ? 'bg-white text-blue-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
              <button className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">🔗 ربط تقويم خارجي</button>
              <button onClick={() => setShowAddModal(true)} className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors">➕ إضافة موعد</button>
            </div>
          </header>

          {/* Monthly View */}
          {viewMode === 'monthly' && (
            <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
              {DAYS_AR.map(day => (
                <div key={day} className="text-center py-3 bg-gray-50 text-sm font-medium text-gray-500">{day}</div>
              ))}
              {Array.from({ length: startingDay }, (_, i) => (
                <div key={`empty-${i}`} className="bg-white p-2 h-28"></div>
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
                const dayEvents = getEventsForDate(formatDateStr(date))
                return (
                  <div
                    key={day}
                    onDoubleClick={() => handleDayDoubleClick(date)}
                    className={`bg-white p-2 h-28 hover:bg-gray-50 cursor-pointer transition-colors ${isToday(date) ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
                  >
                    <span className={`font-medium text-sm ${isToday(date) ? 'bg-blue-500 text-white w-7 h-7 rounded-full flex items-center justify-center' : ''}`}>{day}</span>
                    <div className="space-y-1 mt-1">
                      {dayEvents.slice(0, 2).map(event => (
                        <div key={event.id} className={`text-xs px-1.5 py-0.5 rounded truncate ${getEventType(event.event_type).color} text-white`}>{event.title}</div>
                      ))}
                      {dayEvents.length > 2 && <div className="text-xs text-gray-500">+{dayEvents.length - 2}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Weekly View */}
          {viewMode === 'weekly' && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Week Header */}
              <div className="grid grid-cols-8 border-b border-gray-200">
                <div className="p-3 bg-gray-50 text-center text-sm text-gray-500">الوقت</div>
                {weekDays.map((date, i) => (
                  <div key={i} className={`p-3 text-center ${isToday(date) ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    <div className="text-sm text-gray-500">{DAYS_AR[date.getDay()]}</div>
                    <div className={`text-lg font-bold ${isToday(date) ? 'text-blue-500' : 'text-gray-800'}`}>{date.getDate()}</div>
                  </div>
                ))}
              </div>
              {/* Time Slots */}
              <div className="max-h-[500px] overflow-y-auto">
                {HOURS.map(hour => (
                  <div key={hour} className="grid grid-cols-8 border-b border-gray-100">
                    <div className="p-2 text-xs text-gray-400 text-center border-l border-gray-100">
                      {hour > 12 ? `${hour - 12} م` : `${hour} ص`}
                    </div>
                    {weekDays.map((date, i) => {
                      const dateStr = formatDateStr(date)
                      const hourEvents = events.filter(e => e.date === dateStr && parseInt(e.time_start.split(':')[0]) === hour)
                      return (
                        <div 
                          key={i} 
                          className={`p-1 min-h-[60px] border-l border-gray-100 hover:bg-gray-50 cursor-pointer ${isToday(date) ? 'bg-blue-50/30' : ''}`}
                          onDoubleClick={() => {
                            setNewEvent({ ...newEvent, date: dateStr, time_start: `${String(hour).padStart(2, '0')}:00` })
                            setShowAddModal(true)
                          }}
                        >
                          {hourEvents.map(event => (
                            <div key={event.id} className={`text-xs p-1 rounded ${getEventType(event.event_type).color} text-white truncate`}>
                              {event.time_start} - {event.title}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily View */}
          {viewMode === 'daily' && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className={`p-4 text-center border-b ${isToday(currentDate) ? 'bg-blue-50' : 'bg-gray-50'}`}>
                <div className="text-lg text-gray-500">{DAYS_AR[currentDate.getDay()]}</div>
                <div className={`text-4xl font-bold ${isToday(currentDate) ? 'text-blue-500' : 'text-gray-800'}`}>{currentDate.getDate()}</div>
                <div className="text-sm text-gray-500">{MONTHS_AR[currentDate.getMonth()]} {currentDate.getFullYear()}</div>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {HOURS.map(hour => {
                  const dateStr = formatDateStr(currentDate)
                  const hourEvents = events.filter(e => e.date === dateStr && parseInt(e.time_start.split(':')[0]) === hour)
                  return (
                    <div key={hour} className="flex border-b border-gray-100 hover:bg-gray-50">
                      <div className="w-20 p-3 text-sm text-gray-400 text-center border-l border-gray-100 flex-shrink-0">
                        {hour > 12 ? `${hour - 12}:00 م` : `${hour}:00 ص`}
                      </div>
                      <div 
                        className="flex-1 p-2 min-h-[70px] cursor-pointer"
                        onDoubleClick={() => {
                          setNewEvent({ ...newEvent, date: dateStr, time_start: `${String(hour).padStart(2, '0')}:00` })
                          setShowAddModal(true)
                        }}
                      >
                        {hourEvents.map(event => {
                          const type = getEventType(event.event_type)
                          return (
                            <div key={event.id} className={`p-3 rounded-lg ${type.bgLight} border-r-4 ${type.color.replace('bg-', 'border-')} mb-2`}>
                              <div className="flex items-center justify-between">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${type.color} text-white`}>{type.name}</span>
                                <span className="text-sm text-gray-500">{event.time_start}</span>
                              </div>
                              <p className="font-semibold text-gray-800 mt-1">{event.title}</p>
                              {event.lawyer_name && <p className="text-sm text-gray-500">المحامي: {event.lawyer_name}</p>}
                              {event.meeting_link && (
                                <button className="mt-2 px-3 py-1 text-xs text-white bg-blue-500 rounded hover:bg-blue-600">📹 انضم للجلسة</button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto">
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">تصنيف المواعيد</h2>
            <div className="space-y-3">
              {EVENT_TYPES.map(type => (
                <div key={type.id} className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${type.color}`}></div>
                  <span className="text-sm text-gray-700">{type.name}</span>
                </div>
              ))}
            </div>
            <button className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-500 border border-blue-500 rounded-lg hover:bg-blue-50 transition-colors">➕ إضافة تصنيف</button>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">المواعيد القادمة</h2>
            <div className="space-y-4">
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-400">📅<br/>لا توجد مواعيد قادمة</div>
              ) : upcomingEvents.map(event => {
                const type = getEventType(event.event_type)
                return (
                  <div key={event.id} className={`p-4 bg-gray-50 rounded-lg border ${event.event_type === 'urgent' ? 'border-red-200' : 'border-gray-200'} hover:shadow-md transition-shadow`}>
                    <p className="text-sm font-semibold text-gray-900">{new Date(event.date).toLocaleDateString('ar-SA')}، {event.time_start}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 ${type.bgLight} ${type.textColor} text-xs rounded-full`}>{type.name}</span>
                    <p className="text-sm text-gray-700 mt-1">{event.title}</p>
                    {event.lawyer_name && <p className="text-xs text-gray-500">المحامي: {event.lawyer_name}</p>}
                    {event.meeting_link && <button className="mt-2 w-full px-3 py-1.5 text-xs text-white bg-blue-500 rounded hover:bg-blue-600">📹 انضم للجلسة</button>}
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </main>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">➕ إضافة موعد جديد</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">عنوان الموعد *</label>
                <input type="text" value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500" placeholder="مثال: جلسة محكمة" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ *</label>
                  <input type="date" value={newEvent.date} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الوقت *</label>
                  <input type="time" value={newEvent.time_start} onChange={(e) => setNewEvent({...newEvent, time_start: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع الموعد</label>
                <select value={newEvent.event_type} onChange={(e) => setNewEvent({...newEvent, event_type: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500">
                  {EVENT_TYPES.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                <textarea value={newEvent.description} onChange={(e) => setNewEvent({...newEvent, description: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500" rows={3} placeholder="تفاصيل إضافية..."></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط الجلسة (اختياري)</label>
                <input type="url" value={newEvent.meeting_link} onChange={(e) => setNewEvent({...newEvent, meeting_link: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500" placeholder="https://meet.google.com/..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تذكير قبل</label>
                <select value={newEvent.reminder} onChange={(e) => setNewEvent({...newEvent, reminder: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500">
                  <option value="15">15 دقيقة</option>
                  <option value="30">30 دقيقة</option>
                  <option value="60">ساعة</option>
                  <option value="1440">يوم</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleAddEvent} className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors">حفظ الموعد</button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
