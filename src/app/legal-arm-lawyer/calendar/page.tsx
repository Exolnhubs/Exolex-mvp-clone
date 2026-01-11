'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// 📅 صفحة التقويم - محامي الذراع القانوني
// 📅 تاريخ: 12 يناير 2026 - نسخة من المحامي المستقل
// ═══════════════════════════════════════════════════════════════

export default function CalendarPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [events, setEvents] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [reminderPrefs, setReminderPrefs] = useState<any>(null)
  const [isSavingPrefs, setIsSavingPrefs] = useState(false)
  const [lawyerId, setLawyerId] = useState<string | null>(null)

  const [newEvent, setNewEvent] = useState({
    title: '',
    event_type: 'personal',
    start_datetime: '',
    end_datetime: '',
    location: '',
    description: '',
    reminder_before_minutes: 60,
    case_id: '',
    request_id: '',
    notify_client: true
  })

  const defaultPrefs = {
    remind_2_days_before: true,
    remind_1_day_before: true,
    remind_8_hours_before: false,
    remind_2_hours_before: true,
    remind_1_hour_before: false,
    remind_poa_number: true,
    remind_formal_dress: true,
    remind_read_memos: true,
    remind_upload_memos: false,
    remind_bring_witnesses: true,
    remind_client_attendance: true,
    remind_appeal_deadline: true,
    appeal_reminder_days_before: 5,
    remind_via_push: true,
    remind_via_sms: false,
    remind_via_email: true,
    remind_via_whatsapp: false
  }

  useEffect(() => { loadData() }, [currentDate])

  const loadData = async () => {
    try {
      const id = localStorage.getItem('exolex_lawyer_id')
      if (!id) { router.push('/auth/lawyer-login'); return }
      setLawyerId(id)

      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)

      const { data: eventsData } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('lawyer_id', id)
        .gte('start_datetime', startOfMonth.toISOString())
        .lte('start_datetime', endOfMonth.toISOString())
        .order('start_datetime', { ascending: true })

      setEvents(eventsData || [])

      const { data: prefsData } = await supabase
        .from('lawyer_reminder_preferences')
        .select('*')
        .eq('lawyer_id', id)
        .single()

      setReminderPrefs(prefsData || defaultPrefs)

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const eventTypes = [
    { key: 'all', label: 'الكل', icon: '📅', color: 'bg-slate-100' },
    { key: 'session', label: 'جلسات', icon: '⚖️', color: 'bg-blue-100 text-blue-700' },
    { key: 'request', label: 'مواعيد طلبات', icon: '📋', color: 'bg-green-100 text-green-700' },
    { key: 'personal', label: 'شخصي', icon: '👤', color: 'bg-purple-100 text-purple-700' },
    { key: 'deadline', label: 'مواعيد نهائية', icon: '⏰', color: 'bg-red-100 text-red-700' },
  ]

  const getEventColor = (type: string) => {
    const map: Record<string, string> = {
      'session': 'bg-blue-500', 'request': 'bg-green-500', 'personal': 'bg-purple-500',
      'deadline': 'bg-red-500', 'consultation': 'bg-amber-500',
    }
    return map[type] || 'bg-slate-500'
  }

  const getEventIcon = (type: string) => {
    const map: Record<string, string> = {
      'session': '⚖️', 'request': '📋', 'personal': '👤', 'deadline': '⏰', 'consultation': '💬',
    }
    return map[type] || '📅'
  }

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1))
  }

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    const days = []
    for (let i = 0; i < startingDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i))
    return days
  }

  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start_datetime)
      return eventDate.toDateString() === date.toDateString()
    }).filter(event => filterType === 'all' || event.event_type === filterType)
  }

  const filteredEvents = events.filter(event => filterType === 'all' || event.event_type === filterType)

  const handleDayDoubleClick = (day: Date) => {
    const dateStr = day.toISOString().slice(0, 16)
    setNewEvent({ ...newEvent, start_datetime: dateStr, end_datetime: '' })
    setShowAddModal(true)
  }

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.start_datetime) {
      toast.error('يرجى ملء الحقول المطلوبة')
      return
    }

    try {
      const { data: eventData, error } = await supabase.from('calendar_events').insert({
        lawyer_id: lawyerId,
        user_id: lawyerId,
        title: newEvent.title,
        event_type: newEvent.event_type,
        start_datetime: newEvent.start_datetime,
        end_datetime: newEvent.end_datetime || newEvent.start_datetime,
        location: newEvent.location,
        description: newEvent.description,
        reminder_before_minutes: newEvent.reminder_before_minutes,
        case_id: newEvent.case_id || null,
        request_id: newEvent.request_id || null,
        status: 'scheduled'
      }).select().single()

      if (error) throw error

      toast.success('✅ تم إضافة الموعد')
      setShowAddModal(false)
      resetNewEvent()
      loadData()
    } catch (error) {
      console.error(error)
      toast.error('حدث خطأ')
    }
  }

  const resetNewEvent = () => {
    setNewEvent({
      title: '', event_type: 'personal', start_datetime: '', end_datetime: '',
      location: '', description: '', reminder_before_minutes: 60,
      case_id: '', request_id: '', notify_client: true
    })
  }

  const saveReminderPrefs = async () => {
    setIsSavingPrefs(true)
    try {
      const { data: existing } = await supabase
        .from('lawyer_reminder_preferences')
        .select('id')
        .eq('lawyer_id', lawyerId)
        .single()

      if (existing) {
        await supabase
          .from('lawyer_reminder_preferences')
          .update({ ...reminderPrefs, updated_at: new Date().toISOString() })
          .eq('lawyer_id', lawyerId)
      } else {
        await supabase
          .from('lawyer_reminder_preferences')
          .insert({ ...reminderPrefs, lawyer_id: lawyerId })
      }

      toast.success('✅ تم حفظ الإعدادات')
      setShowSettingsModal(false)
    } catch (error) {
      toast.error('حدث خطأ')
    } finally {
      setIsSavingPrefs(false)
    }
  }

  const exportToGoogle = (event: any) => {
    const startDate = new Date(event.start_datetime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const endDate = new Date(event.end_datetime || event.start_datetime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`
    window.open(url, '_blank')
  }

  const downloadICS = (event: any) => {
    const startDate = new Date(event.start_datetime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const endDate = new Date(event.end_datetime || event.start_datetime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//ExoLex//Calendar//AR\nBEGIN:VEVENT\nDTSTART:${startDate}\nDTEND:${endDate}\nSUMMARY:${event.title}\nDESCRIPTION:${event.description || ''}\nLOCATION:${event.location || ''}\nEND:VEVENT\nEND:VCALENDAR`
    const blob = new Blob([icsContent], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title}.ics`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('✅ تم تنزيل الملف')
  }

  const weekDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">📅 التقويم</h1>
            <p className="text-slate-500 mt-1">إدارة المواعيد والجلسات</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSettingsModal(true)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-2">
              <span>⚙️</span> إعدادات التذكير
            </button>
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-2">
              <span>➕</span> إضافة موعد
            </button>
          </div>
        </div>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold text-slate-700">{events.length}</div>
          <p className="text-xs text-slate-500">إجمالي المواعيد</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold text-blue-600">{events.filter(e => e.event_type === 'session').length}</div>
          <p className="text-xs text-slate-500">جلسات</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold text-red-600">{events.filter(e => new Date(e.start_datetime) <= new Date(Date.now() + 7*24*60*60*1000) && new Date(e.start_datetime) >= new Date()).length}</div>
          <p className="text-xs text-slate-500">خلال أسبوع</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold text-green-600">{events.filter(e => new Date(e.start_datetime).toDateString() === new Date().toDateString()).length}</div>
          <p className="text-xs text-slate-500">اليوم</p>
        </div>
      </div>

      {/* شريط التحكم */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-slate-100 rounded-lg">→</button>
            <h2 className="text-lg font-bold text-slate-800 min-w-[150px] text-center">{months[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
            <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-slate-100 rounded-lg">←</button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">اليوم</button>
          </div>
          <div className="flex items-center gap-2">
            {['month', 'list'].map(mode => (
              <button key={mode} onClick={() => setViewMode(mode as any)} className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === mode ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {mode === 'month' ? 'شهري' : 'قائمة'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {eventTypes.map(type => (
              <button key={type.key} onClick={() => setFilterType(type.key)} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${filterType === type.key ? 'bg-amber-500 text-white' : `${type.color}`}`}>
                <span>{type.icon}</span>
                <span className="hidden md:inline">{type.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* عرض التقويم الشهري */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 border-b">
            {weekDays.map(day => (<div key={day} className="p-3 text-center text-sm font-medium text-slate-600">{day}</div>))}
          </div>
          <div className="grid grid-cols-7">
            {getDaysInMonth().map((day, index) => {
              const isToday = day && day.toDateString() === new Date().toDateString()
              const dayEvents = day ? getEventsForDay(day) : []
              return (
                <div
                  key={index}
                  onClick={() => day && setSelectedDate(day)}
                  onDoubleClick={() => day && handleDayDoubleClick(day)}
                  className={`min-h-[100px] p-2 border-b border-l cursor-pointer transition-colors ${!day ? 'bg-slate-50' : isToday ? 'bg-amber-50' : selectedDate?.toDateString() === day?.toDateString() ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                  {day && (
                    <>
                      <span className={`text-sm font-medium ${isToday ? 'text-amber-600' : 'text-slate-700'}`}>{day.getDate()}</span>
                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 3).map(event => (
                          <div key={event.id} className={`text-xs px-1.5 py-0.5 rounded truncate text-white ${getEventColor(event.event_type)}`}>
                            {getEventIcon(event.event_type)} {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && <div className="text-xs text-slate-500">+{dayEvents.length - 3}</div>}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <div className="p-3 bg-slate-50 border-t text-center text-sm text-slate-500">
            💡 انقر مرتين على أي يوم لإضافة موعد سريع
          </div>
        </div>
      )}

      {/* عرض القائمة */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl shadow-sm">
          {filteredEvents.length > 0 ? (
            <div className="divide-y">
              {filteredEvents.map(event => {
                const eventDate = new Date(event.start_datetime)
                const isToday = eventDate.toDateString() === new Date().toDateString()
                const isPast = eventDate < new Date()
                return (
                  <div key={event.id} className={`p-4 hover:bg-slate-50 ${isPast ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${getEventColor(event.event_type)}`}>
                          <span className="text-xl">{getEventIcon(event.event_type)}</span>
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-800">{event.title}</h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                            <span>📅 {eventDate.toLocaleDateString('ar-SA')}</span>
                            <span>🕐 {eventDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                            {event.location && <span>📍 {event.location}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isToday && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">اليوم</span>}
                        <button onClick={() => exportToGoogle(event)} className="p-2 hover:bg-slate-100 rounded-lg" title="Google">📤</button>
                        <button onClick={() => downloadICS(event)} className="p-2 hover:bg-slate-100 rounded-lg" title="تنزيل">📱</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-12 text-center">
              <span className="text-6xl block mb-4">📅</span>
              <h3 className="text-xl font-bold text-slate-700">لا توجد مواعيد</h3>
            </div>
          )}
        </div>
      )}

      {/* عرض اليوم المحدد */}
      {selectedDate && viewMode === 'month' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">📅 {selectedDate.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => handleDayDoubleClick(selectedDate)} className="text-sm px-3 py-1 bg-amber-500 text-white rounded-lg">➕ إضافة</button>
              <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
          </div>
          {getEventsForDay(selectedDate).length > 0 ? (
            <div className="space-y-3">
              {getEventsForDay(selectedDate).map(event => (
                <div key={event.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${getEventColor(event.event_type)}`}>{getEventIcon(event.event_type)}</span>
                    <div>
                      <p className="font-medium text-slate-800">{event.title}</p>
                      <p className="text-sm text-slate-500">{new Date(event.start_datetime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}{event.location && ` • ${event.location}`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => exportToGoogle(event)} className="p-2 hover:bg-white rounded-lg">📤</button>
                    <button onClick={() => downloadICS(event)} className="p-2 hover:bg-white rounded-lg">📱</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-400 py-4">لا توجد مواعيد - انقر "إضافة" لإنشاء موعد</p>
          )}
        </div>
      )}

      {/* Modal إضافة موعد */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">➕ إضافة موعد جديد</h2>
                <button onClick={() => { setShowAddModal(false); resetNewEvent() }} className="text-slate-400 hover:text-slate-600 text-2xl">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2 mb-4">
                {eventTypes.filter(t => t.key !== 'all').map(type => (
                  <button key={type.key} onClick={() => setNewEvent({ ...newEvent, event_type: type.key })} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${newEvent.event_type === type.key ? 'bg-amber-500 text-white' : type.color}`}>
                    <span>{type.icon}</span> {type.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">العنوان *</label>
                <input type="text" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="عنوان الموعد" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">تاريخ ووقت البداية *</label>
                  <input type="datetime-local" value={newEvent.start_datetime} onChange={(e) => setNewEvent({ ...newEvent, start_datetime: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">تاريخ ووقت النهاية</label>
                  <input type="datetime-local" value={newEvent.end_datetime} onChange={(e) => setNewEvent({ ...newEvent, end_datetime: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">الموقع</label>
                <input type="text" value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="مثال: محكمة الرياض" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">التذكير قبل</label>
                <select value={newEvent.reminder_before_minutes} onChange={(e) => setNewEvent({ ...newEvent, reminder_before_minutes: parseInt(e.target.value) })} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                  <option value="15">15 دقيقة</option>
                  <option value="30">30 دقيقة</option>
                  <option value="60">ساعة</option>
                  <option value="120">ساعتين</option>
                  <option value="480">8 ساعات</option>
                  <option value="1440">يوم</option>
                  <option value="2880">يومين</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">ملاحظات</label>
                <textarea value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} rows={2} className="w-full px-4 py-2 border border-slate-300 rounded-lg resize-none" />
              </div>
            </div>
            <div className="p-6 border-t bg-slate-50 flex gap-3">
              <button onClick={() => { setShowAddModal(false); resetNewEvent() }} className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg">إلغاء</button>
              <button onClick={handleAddEvent} className="flex-1 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">➕ إضافة</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal إعدادات التذكير */}
      {showSettingsModal && reminderPrefs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">⚙️ إعدادات التذكير</h2>
                <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-bold text-slate-700 mb-3">⏰ توقيت التذكير</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: 'remind_2_days_before', label: 'قبل يومين' },
                    { key: 'remind_1_day_before', label: 'قبل يوم' },
                    { key: 'remind_8_hours_before', label: 'قبل 8 ساعات' },
                    { key: 'remind_2_hours_before', label: 'قبل ساعتين' },
                    { key: 'remind_1_hour_before', label: 'قبل ساعة' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                      <input type="checkbox" checked={reminderPrefs[item.key]} onChange={(e) => setReminderPrefs({ ...reminderPrefs, [item.key]: e.target.checked })} className="w-4 h-4 text-amber-500" />
                      <span className="text-sm text-slate-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-700 mb-3">✅ قائمة التحقق للجلسات</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'remind_poa_number', label: '📜 رقم الوكالة' },
                    { key: 'remind_formal_dress', label: '👔 اللباس الرسمي' },
                    { key: 'remind_read_memos', label: '📖 قراءة المذكرات' },
                    { key: 'remind_upload_memos', label: '📤 رفع المذكرات' },
                    { key: 'remind_bring_witnesses', label: '👥 إحضار الشهود' },
                    { key: 'remind_client_attendance', label: '👤 حضور العميل' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                      <input type="checkbox" checked={reminderPrefs[item.key]} onChange={(e) => setReminderPrefs({ ...reminderPrefs, [item.key]: e.target.checked })} className="w-4 h-4 text-amber-500" />
                      <span className="text-sm text-slate-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-700 mb-3">📤 قنوات الإرسال</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'remind_via_push', label: '🔔 إشعارات' },
                    { key: 'remind_via_sms', label: '📱 رسائل SMS' },
                    { key: 'remind_via_email', label: '📧 البريد' },
                    { key: 'remind_via_whatsapp', label: '💬 واتساب' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                      <input type="checkbox" checked={reminderPrefs[item.key]} onChange={(e) => setReminderPrefs({ ...reminderPrefs, [item.key]: e.target.checked })} className="w-4 h-4 text-amber-500" />
                      <span className="text-sm text-slate-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t bg-slate-50 flex gap-3">
              <button onClick={() => setShowSettingsModal(false)} className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg">إلغاء</button>
              <button onClick={saveReminderPrefs} disabled={isSavingPrefs} className="flex-1 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
                {isSavingPrefs ? '⏳ جاري الحفظ...' : '✅ حفظ الإعدادات'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
