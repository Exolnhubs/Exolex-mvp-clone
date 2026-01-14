'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Inbox, Bell, MessageSquare, RefreshCw, Eye, Trash2, 
  CheckCircle, FileText, Calendar, CreditCard, AlertTriangle,
  ChevronLeft, Search, Filter
} from 'lucide-react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════
interface Message {
  id: string
  request_id: string
  sender_type: string
  sender_name: string
  content: string
  is_read: boolean
  created_at: string
  request?: {
    ticket_number: string
    title: string
  }
}

interface Notification {
  id: string
  title: string
  body: string
  icon: string
  notification_type: string
  request_id: string
  action_url: string
  is_read: boolean
  created_at: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════════════════
const notificationIcons: Record<string, { icon: any; color: string; bgColor: string }> = {
  new_message: { icon: MessageSquare, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  request_update: { icon: FileText, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  appointment: { icon: Calendar, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  reminder: { icon: Bell, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  document_required: { icon: FileText, color: 'text-red-600', bgColor: 'bg-red-100' },
  payment: { icon: CreditCard, color: 'text-green-600', bgColor: 'bg-green-100' },
  case_update: { icon: FileText, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  system: { icon: Bell, color: 'text-gray-600', bgColor: 'bg-gray-100' },
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════
export default function InboxPage() {
  const [lawyerId, setLawyerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const [activeTab, setActiveTab] = useState<'inbox' | 'notifications' | 'support'>('inbox')
  const [messages, setMessages] = useState<Message[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // ═══════════════════════════════════════════════════════════════════════════════
  // Load Data
  // ═══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const id = localStorage.getItem('exolex_lawyer_id')
    if (id) {
      setLawyerId(id)
      loadData(id)
    } else {
      setLoading(false)
    }
  }, [])

  const loadData = async (id: string) => {
    try {
      setLoading(true)
      await Promise.all([
        loadMessages(id),
        loadNotifications(id)
      ])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (id: string) => {
    // جلب الرسائل من العملاء
    const { data } = await supabase
      .from('request_client_messages')
      .select(`
        *,
        request:request_id (ticket_number, title)
      `)
      .eq('sender_type', 'member')
      .order('created_at', { ascending: false })
      .limit(50)
    
    // Filter messages for requests assigned to this lawyer
    const { data: requests } = await supabase
      .from('service_requests')
      .select('id')
      .eq('assigned_lawyer_id', id)
    
    const requestIds = new Set(requests?.map(r => r.id) || [])
    const filteredMessages = (data || []).filter(m => requestIds.has(m.request_id))
    
    setMessages(filteredMessages)
  }

  const loadNotifications = async (id: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_type', 'lawyer')
      .eq('recipient_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
    
    setNotifications(data || [])
  }

  const handleRefresh = async () => {
    if (!lawyerId) return
    setRefreshing(true)
    await loadData(lawyerId)
    setRefreshing(false)
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════════════════════════════
  const markMessageAsRead = async (messageId: string) => {
    await supabase
      .from('request_client_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', messageId)
    
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, is_read: true } : m
    ))
  }

  const markNotificationAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
    
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, is_read: true } : n
    ))
  }

  const markAllAsRead = async () => {
    if (activeTab === 'inbox') {
      const unreadIds = messages.filter(m => !m.is_read).map(m => m.id)
      if (unreadIds.length > 0) {
        await supabase
          .from('request_client_messages')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in('id', unreadIds)
        setMessages(prev => prev.map(m => ({ ...m, is_read: true })))
      }
    } else if (activeTab === 'notifications') {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
      if (unreadIds.length > 0) {
        await supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in('id', unreadIds)
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════════
  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `منذ ${days} يوم`
    if (hours > 0) return `منذ ${hours} ساعة`
    return `منذ ${minutes} دقيقة`
  }

  const unreadMessagesCount = messages.filter(m => !m.is_read).length
  const unreadNotificationsCount = notifications.filter(n => !n.is_read).length

  // Filter by search
  const filteredMessages = messages.filter(m => 
    m.content.includes(searchQuery) || 
    m.sender_name?.includes(searchQuery) ||
    m.request?.ticket_number?.includes(searchQuery)
  )

  const filteredNotifications = notifications.filter(n =>
    n.title.includes(searchQuery) ||
    n.body?.includes(searchQuery)
  )

  // ═══════════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-6" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-amber-500 to-amber-600 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Inbox className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">مركز التواصل</h1>
        </div>
        <p className="text-amber-100">
          كل تواصلك في مكان واحد. من هنا تتابع رسائلك مع العملاء وتستلم الإشعارات.
        </p>
        
        {(unreadMessagesCount > 0 || unreadNotificationsCount > 0) && (
          <div className="mt-4 flex items-center gap-2 bg-white/20 rounded-lg px-4 py-2 w-fit">
            <AlertTriangle className="w-5 h-5" />
            <span>
              لديك {unreadMessagesCount + unreadNotificationsCount} عناصر تتطلب إجراء
            </span>
            <Link href="#" onClick={markAllAsRead} className="underline mr-2">
              تعليم الكل كمقروء
            </Link>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex-1 py-4 text-center font-semibold transition flex items-center justify-center gap-2 ${
              activeTab === 'inbox' 
                ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Inbox className="w-5 h-5" />
            الوارد
            {unreadMessagesCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {unreadMessagesCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 py-4 text-center font-semibold transition flex items-center justify-center gap-2 ${
              activeTab === 'notifications' 
                ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Bell className="w-5 h-5" />
            التنبيهات
            {unreadNotificationsCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('support')}
            className={`flex-1 py-4 text-center font-semibold transition flex items-center justify-center gap-2 ${
              activeTab === 'support' 
                ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            الدعم
          </button>
        </div>

        {/* Search & Actions */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث..."
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={markAllAsRead}
              className="px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-lg transition"
            >
              تعليم الكل كمقروء
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="divide-y divide-gray-200">
          {/* Inbox Tab */}
          {activeTab === 'inbox' && (
            <>
              {filteredMessages.length === 0 ? (
                <div className="p-12 text-center">
                  <Inbox className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700">لا توجد رسائل</h3>
                  <p className="text-gray-500 text-sm">رسائل العملاء ستظهر هنا</p>
                </div>
              ) : (
                filteredMessages.map((message) => (
                  <Link
                    key={message.id}
                    href={`/independent/my-tasks/${message.request_id}`}
                    onClick={() => markMessageAsRead(message.id)}
                    className={`flex items-start gap-4 p-4 hover:bg-gray-50 transition ${
                      !message.is_read ? 'bg-amber-50' : ''
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      !message.is_read ? 'bg-amber-100' : 'bg-gray-100'
                    }`}>
                      <MessageSquare className={`w-6 h-6 ${!message.is_read ? 'text-amber-600' : 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-800">
                          رسالة من {message.sender_name || 'العميل'}
                        </span>
                        <span className="text-xs text-gray-500">{getTimeAgo(message.created_at)}</span>
                      </div>
                      <p className="text-gray-600 text-sm line-clamp-2">{message.content}</p>
                      {message.request && (
                        <p className="text-xs text-amber-600 mt-1">
                          🎫 {message.request.ticket_number} - {message.request.title}
                        </p>
                      )}
                    </div>
                    {!message.is_read && (
                      <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                    )}
                  </Link>
                ))
              )}
            </>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <>
              {filteredNotifications.length === 0 ? (
                <div className="p-12 text-center">
                  <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700">لا توجد تنبيهات</h3>
                  <p className="text-gray-500 text-sm">التنبيهات الجديدة ستظهر هنا</p>
                </div>
              ) : (
                filteredNotifications.map((notification) => {
                  const config = notificationIcons[notification.notification_type] || notificationIcons.system
                  const Icon = config.icon
                  return (
                    <div
                      key={notification.id}
                      onClick={() => markNotificationAsRead(notification.id)}
                      className={`flex items-start gap-4 p-4 hover:bg-gray-50 transition cursor-pointer ${
                        !notification.is_read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.bgColor}`}>
                        <Icon className={`w-6 h-6 ${config.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-gray-800">{notification.title}</span>
                          <span className="text-xs text-gray-500">{getTimeAgo(notification.created_at)}</span>
                        </div>
                        {notification.body && (
                          <p className="text-gray-600 text-sm">{notification.body}</p>
                        )}
                        {notification.action_url && (
                          <Link 
                            href={notification.action_url}
                            className="text-sm text-amber-600 hover:underline mt-1 inline-block"
                          >
                            عرض التفاصيل ←
                          </Link>
                        )}
                      </div>
                      {!notification.is_read && (
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  )
                })
              )}
            </>
          )}

          {/* Support Tab */}
          {activeTab === 'support' && (
            <div className="p-12 text-center">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700">تواصل مع الدعم</h3>
              <p className="text-gray-500 text-sm mb-4">
                يمكنك التواصل مع فريق الدعم لحل أي مشكلة تقنية أو مالية
              </p>
              <button className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition font-semibold">
                فتح تذكرة دعم
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
