'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// 📅 صفحة التقويم - الشريك / الذراع القانوني
// 📅 تاريخ: 3 يناير 2026
// ═══════════════════════════════════════════════════════════════
// 📊 يعرض: جلسات + استشارات + قضايا المحامين التابعين
// ❌ لا يعرض: الأحداث الشخصية والتذكيرات (خاصة بالمحامي)
// ═══════════════════════════════════════════════════════════════

type UserType = 'partner' | 'legal_arm'

export default function CalendarPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [events, setEvents] = useState<any[]>([])
  const [lawyers, setLawyers] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterLawyer, setFilterLawyer] = useState<string>('all')
  const [userType, setUserType] = useState<UserType>('partner')
  const [entityId, setEntityId] = useState<string | null>(null)

  const allowedEventTypes = ['session', 'consultation', 'case', 'hearing', 'meeting', 'appointment']

  const eventTypes = [
    { key: 'all', label: 'الكل', icon: '📅', color: '#64748b', bg: '#f1f5f9' },
    { key: 'session', label: 'جلسات', icon: '⚖️', color: '#1d4ed8', bg: '#dbeafe' },
    { key: 'hearing', label: 'جلسات استماع', icon: '🏛️', color: '#7c3aed', bg: '#f3e8ff' },
    { key: 'consultation', label: 'استشارات', icon: '💬', color: '#059669', bg: '#d1fae5' },
    { key: 'case', label: 'قضايا', icon: '📋', color: '#dc2626', bg: '#fee2e2' },
    { key: 'meeting', label: 'اجتماعات', icon: '👥', color: '#0891b2', bg: '#cffafe' },
    { key: 'appointment', label: 'مواعيد', icon: '🕐', color: '#ca8a04', bg: '#fef9c3' },
  ]

  useEffect(() => { loadData() }, [currentDate, filterLawyer])

  const loadData = async () => {
    try {
      setIsLoading(true)
      
      const partnerId = localStorage.getItem('exolex_partner_id')
      const legalArmId = localStorage.getItem('exolex_legal_arm_id')

      let type: UserType = 'partner'
      let id: string | null = null
      let lawyerIds: string[] = []

      if (partnerId) {
        type = 'partner'
        id = partnerId
        
        const { data: employeesData } = await supabase
          .from('partner_employees')
          .select('id, full_name, is_active')
          .eq('partner_id', partnerId)
          .eq('is_active', true)

        setLawyers(employeesData || [])
        lawyerIds = (employeesData || []).map(e => e.id)

      } else if (legalArmId) {
        type = 'legal_arm'
        id = legalArmId
        
        const { data: lawyersData } = await supabase
          .from('lawyers')
          .select('id, full_name, is_available')
          .eq('legal_arm_id', legalArmId)
          .eq('lawyer_type', 'legal_arm')

        setLawyers(lawyersData || [])
        lawyerIds = (lawyersData || []).map(l => l.id)

      } else {
        toast.error('يرجى تسجيل الدخول')
        router.push('/auth/login')
        return
      }

      setUserType(type)
      setEntityId(id)

      if (filterLawyer !== 'all') {
        lawyerIds = [filterLawyer]
      }

      if (lawyerIds.length === 0) {
        setEvents([])
        setIsLoading(false)
        return
      }

      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)

      const { data: eventsData, error } = await supabase
        .from('calendar_events')
        .select('*, lawyer:lawyer_id(full_name)')
        .in('lawyer_id', lawyerIds)
        .in('event_type', allowedEventTypes)
        .gte('start_datetime', startOfMonth.toISOString())
        .lte('start_datetime', endOfMonth.toISOString())
        .order('start_datetime', { ascending: true })

      if (error) throw error
      setEvents(eventsData || [])

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const goToPrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  const goToNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  const goToToday = () => setCurrentDate(new Date())

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    const days: (number | null)[] = []
    for (let i = 0; i < startingDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }

  const getEventsForDay = (day: number) => {
    return events.filter(event => {
      const eventDate = new Date(event.start_datetime)
      return eventDate.getDate() === day &&
             eventDate.getMonth() === currentDate.getMonth() &&
             eventDate.getFullYear() === currentDate.getFullYear() &&
             (filterType === 'all' || event.event_type === filterType)
    })
  }

  const getEventStyle = (type: string) => eventTypes.find(t => t.key === type) || eventTypes[0]
  const formatTime = (datetime: string) => new Date(datetime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (datetime: string) => new Date(datetime).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const filteredEvents = events.filter(e => filterType === 'all' || e.event_type === filterType)
  const todayEvents = filteredEvents.filter(e => {
    const d = new Date(e.start_datetime)
    const today = new Date()
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  })

  const weekDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

  if (isLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#64748b' }}>جاري تحميل التقويم...</p>
        </div>
        <style jsx>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>📅 التقويم</h1>
            <p style={{ color: '#64748b', marginTop: 4 }}>مواعيد وجلسات المحامين</p>
          </div>
          <select value={filterLawyer} onChange={(e) => setFilterLawyer(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
            <option value="all">جميع المحامين ({lawyers.length})</option>
            {lawyers.map(l => (<option key={l.id} value={l.id}>{l.full_name}</option>))}
          </select>
        </div>
      </div>

      {/* الإحصائيات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <p style={{ fontSize: 32, fontWeight: 'bold', color: '#dc2626', margin: 0 }}>{todayEvents.length}</p>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>اليوم</p>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <p style={{ fontSize: 32, fontWeight: 'bold', color: '#f59e0b', margin: 0 }}>{filteredEvents.filter(e => { const d = new Date(e.start_datetime); const today = new Date(); const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); return diff >= 0 && diff <= 7 }).length}</p>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>خلال أسبوع</p>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <p style={{ fontSize: 32, fontWeight: 'bold', color: '#3b82f6', margin: 0 }}>{filteredEvents.filter(e => e.event_type === 'session' || e.event_type === 'hearing').length}</p>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>جلسات</p>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <p style={{ fontSize: 32, fontWeight: 'bold', color: '#059669', margin: 0 }}>{filteredEvents.length}</p>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>إجمالي المواعيد</p>
        </div>
      </div>

      {/* فلاتر الأنواع */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {eventTypes.map(type => (
            <button key={type.key} onClick={() => setFilterType(type.key)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, backgroundColor: filterType === type.key ? type.bg : '#f8fafc', color: filterType === type.key ? type.color : '#64748b', fontWeight: filterType === type.key ? 600 : 400 }}>
              <span>{type.icon}</span>{type.label}
            </button>
          ))}
        </div>
      </div>

      {/* التنقل */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {[{ key: 'month', label: 'شهري', icon: '📅' }, { key: 'list', label: 'قائمة', icon: '📋' }].map(mode => (
              <button key={mode.key} onClick={() => setViewMode(mode.key as any)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, backgroundColor: viewMode === mode.key ? '#3b82f6' : '#f1f5f9', color: viewMode === mode.key ? 'white' : '#64748b' }}>
                <span>{mode.icon}</span>{mode.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={goToPrevMonth} style={{ padding: '8px 12px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 18 }}>→</button>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 'bold', color: '#1e293b', minWidth: 150, textAlign: 'center' }}>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
            <button onClick={goToNextMonth} style={{ padding: '8px 12px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 18 }}>←</button>
            <button onClick={goToToday} style={{ padding: '8px 16px', backgroundColor: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>اليوم</button>
          </div>
        </div>
      </div>

      {/* التقويم الشهري */}
      {viewMode === 'month' ? (
        <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {weekDays.map(day => (<div key={day} style={{ padding: 12, textAlign: 'center', fontWeight: 600, color: '#475569', fontSize: 14 }}>{day}</div>))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {getDaysInMonth().map((day, index) => {
              const dayEvents = day ? getEventsForDay(day) : []
              const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear()
              return (
                <div key={index} onClick={() => day && setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))} style={{ minHeight: 100, padding: 8, borderBottom: '1px solid #f1f5f9', borderLeft: '1px solid #f1f5f9', backgroundColor: isToday ? '#eff6ff' : day ? 'white' : '#fafafa', cursor: day ? 'pointer' : 'default' }}>
                  {day && (
                    <>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? '#3b82f6' : 'transparent', color: isToday ? 'white' : '#374151', fontWeight: isToday ? 'bold' : 'normal', fontSize: 14, marginBottom: 4 }}>{day}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dayEvents.slice(0, 3).map((event, i) => {
                          const style = getEventStyle(event.event_type)
                          return (<div key={i} style={{ fontSize: 10, padding: '2px 4px', borderRadius: 4, backgroundColor: style.bg, color: style.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{style.icon} {event.title}</div>)
                        })}
                        {dayEvents.length > 3 && <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center' }}>+{dayEvents.length - 3} المزيد</div>}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {filteredEvents.length > 0 ? (
            <div>
              {filteredEvents.map((event, index) => {
                const style = getEventStyle(event.event_type)
                return (
                  <div key={event.id} style={{ padding: 16, borderBottom: index < filteredEvents.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{style.icon}</div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>{event.title}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>{formatDate(event.start_datetime)} - {formatTime(event.start_datetime)}</p>
                      {event.lawyer?.full_name && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>👤 {event.lawyer.full_name}</p>}
                      {event.location && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>📍 {event.location}</p>}
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: 9999, fontSize: 12, backgroundColor: style.bg, color: style.color }}>{style.label}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <span style={{ fontSize: 64, display: 'block', marginBottom: 16 }}>📅</span>
              <h3 style={{ fontSize: 20, fontWeight: 'bold', color: '#374151', margin: 0 }}>لا توجد مواعيد</h3>
              <p style={{ color: '#94a3b8', marginTop: 8 }}>لا توجد مواعيد في هذه الفترة</p>
            </div>
          )}
        </div>
      )}

      {/* تفاصيل اليوم */}
      {selectedDate && (
        <div style={{ marginTop: 24, backgroundColor: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontWeight: 'bold', color: '#1e293b' }}>📅 {selectedDate.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
            <button onClick={() => setSelectedDate(null)} style={{ padding: '4px 12px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ padding: 16 }}>
            {getEventsForDay(selectedDate.getDate()).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {getEventsForDay(selectedDate.getDate()).map(event => {
                  const style = getEventStyle(event.event_type)
                  return (
                    <div key={event.id} style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, borderRight: `4px solid ${style.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 20 }}>{style.icon}</span>
                        <h4 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>{event.title}</h4>
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>🕐 {formatTime(event.start_datetime)}{event.end_datetime && ` - ${formatTime(event.end_datetime)}`}</p>
                      {event.lawyer?.full_name && <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>👤 {event.lawyer.full_name}</p>}
                      {event.location && <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>📍 {event.location}</p>}
                      {event.description && <p style={{ margin: '8px 0 0', fontSize: 14, color: '#475569' }}>{event.description}</p>}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>لا توجد مواعيد في هذا اليوم</p>
            )}
          </div>
        </div>
      )}

      {/* ملاحظة */}
      <div style={{ marginTop: 24, background: 'linear-gradient(to right, #fef3c7, #fde68a)', borderRadius: 12, padding: 16, border: '1px solid #f59e0b' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 24 }}>💡</span>
          <div>
            <h4 style={{ fontWeight: 500, color: '#92400e', margin: 0 }}>ملاحظة</h4>
            <p style={{ fontSize: 14, color: '#b45309', marginTop: 4 }}>يعرض هذا التقويم جلسات ومواعيد واستشارات المحامين التابعين لك. الأحداث الشخصية والتذكيرات تظهر فقط للمحامي صاحبها.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
