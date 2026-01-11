'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// 🔔 صفحة الإشعارات الموحدة - الشريك / الذراع / المحامي المستقل
// 📅 تاريخ: 3 يناير 2026
// ═══════════════════════════════════════════════════════════════

type UserType = 'partner' | 'legal_arm' | 'lawyer'

export default function NotificationsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [notifications, setNotifications] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [userType, setUserType] = useState<UserType>('partner')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const partnerId = localStorage.getItem('exolex_partner_id')
      const legalArmId = localStorage.getItem('exolex_legal_arm_id')
      const lawyerId = localStorage.getItem('exolex_lawyer_id')

      let type: UserType = 'partner'
      let fetchedUserId: string | null = null

      if (partnerId) {
        type = 'partner'
        const { data: partnerData } = await supabase
          .from('partners')
          .select('manager_id')
          .eq('id', partnerId)
          .single()
        fetchedUserId = partnerData?.manager_id || null
      } else if (legalArmId) {
        type = 'legal_arm'
        const { data: armData } = await supabase
          .from('legal_arms')
          .select('manager_id')
          .eq('id', legalArmId)
          .single()
        fetchedUserId = armData?.manager_id || null
      } else if (lawyerId) {
        type = 'lawyer'
        const { data: lawyerData } = await supabase
          .from('lawyers')
          .select('user_id')
          .eq('id', lawyerId)
          .single()
        fetchedUserId = lawyerData?.user_id || null
      } else {
        toast.error('يرجى تسجيل الدخول')
        router.push('/auth/login')
        return
      }

      setUserType(type)
      setUserId(fetchedUserId)

      if (!fetchedUserId) {
        setNotifications([])
        setIsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', fetchedUserId)
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

  const getPortalPath = () => {
    if (userType === 'partner') return '/partner'
    if (userType === 'legal_arm') return '/legal-arm'
    return '/independent'
  }

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

  const markAllAsRead = async () => {
    if (!userId) return
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_read', false)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      toast.success('✅ تم تحديد الكل كمقروء')
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      toast.success('تم الحذف')
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  const deleteAll = async () => {
    if (!confirm('هل تريد حذف جميع الإشعارات؟')) return
    if (!userId) return
    try {
      await supabase.from('notifications').delete().eq('user_id', userId)
      setNotifications([])
      toast.success('✅ تم حذف جميع الإشعارات')
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  const handleClick = async (notification: any) => {
    if (!notification.is_read) await markAsRead(notification.id)
    if (notification.action_url) router.push(notification.action_url)
  }

  const getTypeStyle = (type: string) => {
    const map: Record<string, { icon: string; color: string; bg: string; label: string }> = {
      'reminder': { icon: '⏰', color: '#b45309', bg: '#fef3c7', label: 'تذكير' },
      'appointment_reminder': { icon: '📅', color: '#1d4ed8', bg: '#dbeafe', label: 'موعد' },
      'new_request': { icon: '📋', color: '#15803d', bg: '#dcfce7', label: 'طلب جديد' },
      'request_update': { icon: '🔄', color: '#7c3aed', bg: '#f3e8ff', label: 'تحديث طلب' },
      'case_update': { icon: '⚖️', color: '#4338ca', bg: '#e0e7ff', label: 'تحديث قضية' },
      'rating': { icon: '⭐', color: '#ca8a04', bg: '#fef9c3', label: 'تقييم' },
      'payment': { icon: '💰', color: '#059669', bg: '#d1fae5', label: 'دفع' },
      'message': { icon: '💬', color: '#0891b2', bg: '#cffafe', label: 'رسالة' },
      'system': { icon: '🔔', color: '#475569', bg: '#f1f5f9', label: 'نظام' },
      'calendar_event': { icon: '📅', color: '#1d4ed8', bg: '#dbeafe', label: 'تقويم' },
      'new_offer': { icon: '📨', color: '#15803d', bg: '#dcfce7', label: 'عرض جديد' },
      'contract_update': { icon: '📝', color: '#7c3aed', bg: '#f3e8ff', label: 'تحديث عقد' },
      'employee_update': { icon: '👤', color: '#1d4ed8', bg: '#dbeafe', label: 'تحديث موظف' },
    }
    return map[type] || { icon: '🔔', color: '#475569', bg: '#f1f5f9', label: 'إشعار' }
  }

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

  const unreadCount = notifications.filter(n => !n.is_read).length
  const types = [...new Set(notifications.map(n => n.notification_type))]

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread' && n.is_read) return false
    if (filter === 'read' && !n.is_read) return false
    if (typeFilter !== 'all' && n.notification_type !== typeFilter) return false
    return true
  })

  if (isLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#64748b' }}>جاري تحميل الإشعارات...</p>
        </div>
        <style jsx>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>🔔 الإشعارات</h1>
            <p style={{ color: '#64748b', marginTop: 4 }}>{unreadCount > 0 ? `لديك ${unreadCount} إشعار غير مقروء` : 'لا توجد إشعارات جديدة'}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} style={{ padding: '8px 16px', backgroundColor: '#fef3c7', color: '#b45309', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>✅ تحديد الكل كمقروء</button>
            )}
            {notifications.length > 0 && (
              <button onClick={deleteAll} style={{ padding: '8px 16px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>🗑️ حذف الكل</button>
            )}
          </div>
        </div>
      </div>

      {/* الفلاتر */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {[
              { key: 'all', label: 'الكل', count: notifications.length },
              { key: 'unread', label: 'غير مقروء', count: unreadCount },
              { key: 'read', label: 'مقروء', count: notifications.length - unreadCount },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key as any)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, backgroundColor: filter === f.key ? '#f59e0b' : '#f1f5f9', color: filter === f.key ? 'white' : '#475569' }}>
                {f.label}
                <span style={{ padding: '2px 6px', borderRadius: 9999, fontSize: 12, backgroundColor: filter === f.key ? 'rgba(255,255,255,0.2)' : '#e2e8f0' }}>{f.count}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: '#475569' }}>النوع:</span>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
              <option value="all">الكل</option>
              {types.map(t => (<option key={t} value={t}>{getTypeStyle(t).label}</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* قائمة الإشعارات */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {filteredNotifications.length > 0 ? (
          <div>
            {filteredNotifications.map((notification, index) => {
              const style = getTypeStyle(notification.notification_type)
              return (
                <div key={notification.id} style={{ padding: 16, borderBottom: index < filteredNotifications.length - 1 ? '1px solid #f1f5f9' : 'none', backgroundColor: !notification.is_read ? '#fffbeb' : 'white', borderRight: !notification.is_read ? '4px solid #f59e0b' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: style.bg, flexShrink: 0 }}>
                      <span style={{ fontSize: 24 }}>{style.icon}</span>
                    </div>
                    <div style={{ flex: 1, cursor: notification.action_url ? 'pointer' : 'default' }} onClick={() => handleClick(notification)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <h3 style={{ fontWeight: 500, color: !notification.is_read ? '#1e293b' : '#475569', margin: 0 }}>{notification.title_ar || notification.title_en || 'إشعار'}</h3>
                        {!notification.is_read && <span style={{ width: 8, height: 8, backgroundColor: '#f59e0b', borderRadius: '50%' }}></span>}
                        {notification.priority === 'high' && <span style={{ fontSize: 12, padding: '2px 6px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: 4 }}>مهم</span>}
                      </div>
                      <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0', lineHeight: 1.5 }}>{notification.body_ar || notification.body_en || ''}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                        <span>{getRelativeTime(notification.created_at)}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: style.bg, color: style.color }}>{style.label}</span>
                        {notification.action_url && <span style={{ color: '#f59e0b' }}>← عرض التفاصيل</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {notification.is_read ? (
                        <button onClick={() => markAsUnread(notification.id)} style={{ padding: 8, backgroundColor: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#94a3b8' }} title="تحديد كغير مقروء">○</button>
                      ) : (
                        <button onClick={() => markAsRead(notification.id)} style={{ padding: 8, backgroundColor: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#f59e0b' }} title="تحديد كمقروء">●</button>
                      )}
                      <button onClick={() => deleteNotification(notification.id)} style={{ padding: 8, backgroundColor: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#94a3b8' }} title="حذف">🗑️</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <span style={{ fontSize: 64, display: 'block', marginBottom: 16 }}>🔔</span>
            <h3 style={{ fontSize: 20, fontWeight: 'bold', color: '#374151', margin: 0 }}>لا توجد إشعارات</h3>
            <p style={{ color: '#94a3b8', marginTop: 8 }}>{filter !== 'all' ? 'لا توجد إشعارات تطابق الفلتر' : 'ستظهر الإشعارات هنا'}</p>
          </div>
        )}
      </div>

      {/* معلومات */}
      <div style={{ marginTop: 24, background: 'linear-gradient(to right, #eff6ff, #eef2ff)', borderRadius: 12, padding: 16, border: '1px solid #bfdbfe' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 24 }}>💡</span>
          <div>
            <h4 style={{ fontWeight: 500, color: '#1e40af', margin: 0 }}>إعدادات الإشعارات</h4>
            <p style={{ fontSize: 14, color: '#3b82f6', marginTop: 4 }}>
              يمكنك تخصيص إعدادات الإشعارات من صفحة{' '}
              <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => router.push(`${getPortalPath()}/settings`)}>الإعدادات</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
