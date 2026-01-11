'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// 🔔 صفحة الإشعارات - المحامي المستقل
// 📅 تاريخ: 1 يناير 2026
// ═══════════════════════════════════════════════════════════════

export default function NotificationsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [notifications, setNotifications] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const lawyerId = localStorage.getItem('exolex_legal_arm_id')
      if (!lawyerId) { router.push('/auth/legal-arm-login'); return }

      // جلب user_id من lawyers
      const { data: lawyerData } = await supabase
        .from('lawyers')
        .select('user_id')
        .eq('id', lawyerId)
        .single()

      if (!lawyerData?.user_id) {
        setNotifications([])
        setIsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', lawyerData.user_id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل الإشعارات')
    } finally {
      setIsLoading(false)
    }
  }

  // تحديد كمقروء
  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)

      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // تحديد كغير مقروء
  const markAsUnread = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: false, read_at: null })
        .eq('id', id)

      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: false } : n))
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // تحديد الكل كمقروء
  const markAllAsRead = async () => {
    try {
      const lawyerId = localStorage.getItem('exolex_legal_arm_id')
      const { data: lawyerData } = await supabase
        .from('lawyers')
        .select('user_id')
        .eq('id', lawyerId)
        .single()

      if (!lawyerData?.user_id) return

      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', lawyerData.user_id)
        .eq('is_read', false)

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      toast.success('✅ تم تحديد الكل كمقروء')
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // حذف إشعار
  const deleteNotification = async (id: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      toast.success('تم الحذف')
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // حذف الكل
  const deleteAll = async () => {
    if (!confirm('هل تريد حذف جميع الإشعارات؟')) return
    try {
      const lawyerId = localStorage.getItem('exolex_legal_arm_id')
      const { data: lawyerData } = await supabase
        .from('lawyers')
        .select('user_id')
        .eq('id', lawyerId)
        .single()

      if (!lawyerData?.user_id) return

      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', lawyerData.user_id)

      setNotifications([])
      toast.success('✅ تم حذف جميع الإشعارات')
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // التنقل للرابط
  const handleClick = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }
    if (notification.action_url) {
      router.push(notification.action_url)
    }
  }

  // أيقونة ولون حسب النوع
  const getTypeStyle = (type: string) => {
    const map: Record<string, { icon: string; color: string; bg: string; label: string }> = {
      'reminder': { icon: '⏰', color: 'text-amber-600', bg: 'bg-amber-50', label: 'تذكير' },
      'appointment_reminder': { icon: '📅', color: 'text-blue-600', bg: 'bg-blue-50', label: 'موعد' },
      'new_request': { icon: '📋', color: 'text-green-600', bg: 'bg-green-50', label: 'طلب جديد' },
      'request_update': { icon: '🔄', color: 'text-purple-600', bg: 'bg-purple-50', label: 'تحديث طلب' },
      'case_update': { icon: '⚖️', color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'تحديث قضية' },
      'rating': { icon: '⭐', color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'تقييم' },
      'payment': { icon: '💰', color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'دفع' },
      'message': { icon: '💬', color: 'text-cyan-600', bg: 'bg-cyan-50', label: 'رسالة' },
      'system': { icon: '🔔', color: 'text-slate-600', bg: 'bg-slate-50', label: 'نظام' },
      'calendar_event': { icon: '📅', color: 'text-blue-600', bg: 'bg-blue-50', label: 'تقويم' },
    }
    return map[type] || { icon: '🔔', color: 'text-slate-600', bg: 'bg-slate-50', label: 'إشعار' }
  }

  // الوقت النسبي
  const getRelativeTime = (date: string) => {
    const now = new Date()
    const d = new Date(date)
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'الآن'
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`
    if (diffHours < 24) return `منذ ${diffHours} ساعة`
    if (diffDays < 7) return `منذ ${diffDays} يوم`
    return d.toLocaleDateString('ar-SA')
  }

  // إحصائيات
  const unreadCount = notifications.filter(n => !n.is_read).length
  const types = [...new Set(notifications.map(n => n.notification_type))]

  // الفلترة
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread' && n.is_read) return false
    if (filter === 'read' && !n.is_read) return false
    if (typeFilter !== 'all' && n.notification_type !== typeFilter) return false
    return true
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">🔔 الإشعارات</h1>
              <p className="text-slate-500 mt-1">
                {unreadCount > 0 ? `لديك ${unreadCount} إشعار غير مقروء` : 'لا توجد إشعارات جديدة'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-sm"
                >
                  ✅ تحديد الكل كمقروء
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={deleteAll}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm"
                >
                  🗑️ حذف الكل
                </button>
              )}
            </div>
          </div>
        </div>

        {/* الفلاتر */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* فلتر الحالة */}
            <div className="flex items-center gap-2">
              {[
                { key: 'all', label: 'الكل', count: notifications.length },
                { key: 'unread', label: 'غير مقروء', count: unreadCount },
                { key: 'read', label: 'مقروء', count: notifications.length - unreadCount },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
                    filter === f.key
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                    filter === f.key ? 'bg-white/20' : 'bg-slate-200'
                  }`}>{f.count}</span>
                </button>
              ))}
            </div>

            {/* فلتر النوع */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">النوع:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              >
                <option value="all">الكل</option>
                {types.map(t => (
                  <option key={t} value={t}>{getTypeStyle(t).label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* قائمة الإشعارات */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {filteredNotifications.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {filteredNotifications.map((notification) => {
                const style = getTypeStyle(notification.notification_type)
                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-slate-50 transition-colors ${
                      !notification.is_read ? 'bg-amber-50/50 border-r-4 border-amber-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* الأيقونة */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${style.bg}`}>
                        <span className="text-2xl">{style.icon}</span>
                      </div>

                      {/* المحتوى */}
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => handleClick(notification)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-medium ${!notification.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                            {notification.title_ar || notification.title_en || 'إشعار'}
                          </h3>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                          )}
                          {notification.priority === 'high' && (
                            <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded">مهم</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {notification.body_ar || notification.body_en || ''}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          <span>{getRelativeTime(notification.created_at)}</span>
                          <span className={`px-1.5 py-0.5 rounded ${style.bg} ${style.color}`}>
                            {style.label}
                          </span>
                          {notification.action_url && (
                            <span className="text-amber-600">← عرض التفاصيل</span>
                          )}
                        </div>
                      </div>

                      {/* الإجراءات */}
                      <div className="flex items-center gap-1">
                        {notification.is_read ? (
                          <button
                            onClick={() => markAsUnread(notification.id)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                            title="تحديد كغير مقروء"
                          >
                            ○
                          </button>
                        ) : (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-amber-500 hover:text-amber-600"
                            title="تحديد كمقروء"
                          >
                            ●
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500"
                          title="حذف"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-12 text-center">
              <span className="text-6xl block mb-4">🔔</span>
              <h3 className="text-xl font-bold text-slate-700">لا توجد إشعارات</h3>
              <p className="text-slate-400 mt-2">
                {filter !== 'all' ? 'لا توجد إشعارات تطابق الفلتر' : 'ستظهر الإشعارات هنا'}
              </p>
            </div>
          )}
        </div>

        {/* معلومات */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h4 className="font-medium text-blue-800">إعدادات الإشعارات</h4>
              <p className="text-sm text-blue-600 mt-1">
                يمكنك تخصيص إعدادات الإشعارات من صفحة <span className="underline cursor-pointer" onClick={() => router.push('/legal-arm/settings')}>الإعدادات</span>
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
