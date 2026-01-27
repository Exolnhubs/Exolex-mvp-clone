'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logoutMember } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// 📬 مركز التواصل - المشترك
// 📅 تاريخ: 21 يناير 2026
// 🔧 تحديث: بيانات حقيقية من قاعدة البيانات
// ═══════════════════════════════════════════════════════════════

interface User {
  id: string
  full_name: string
}

interface Message {
  id: string
  request_id: string
  ticket_number?: string
  content: string
  sender_type: 'lawyer' | 'member'
  sender_name: string
  created_at: string
  is_read: boolean
  request_title?: string
}

interface Notification {
  id: string
  type: string
  title: string
  description: string
  created_at: string
  is_read: boolean
  requires_action: boolean
  action_url?: string
  action_label?: string
  request_id?: string
}

interface SupportTicket {
  id: string
  subject: string
  category: string
  priority: string
  status: string
  created_at: string
  updated_at: string
  messages: TicketMessage[]
}

interface TicketMessage {
  id: string
  content: string
  sender_type: 'member' | 'support' | 'admin'
  sender_name?: string
  created_at: string
}

const TICKET_CATEGORIES = [
  { id: 'technical', name: 'مشكلة تقنية', icon: '🔧' },
  { id: 'financial', name: 'مشكلة مالية', icon: '💰' },
  { id: 'operational', name: 'مشكلة تشغيلية', icon: '⚙️' },
]

export default function CommunicationCenterPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [activeTab, setActiveTab] = useState<'inbox' | 'notifications' | 'support'>('notifications')
  
  // Data states
  const [messages, setMessages] = useState<Message[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  
  // UI states
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [showNewTicketModal, setShowNewTicketModal] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [conversationMessages, setConversationMessages] = useState<Message[]>([])
  
  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: 'technical',
    priority: 'normal',
    content: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const userId = localStorage.getItem('exolex_user_id')
      if (!userId) { router.push('/auth/login'); return }

      // جلب بيانات المستخدم
      const { data: userData } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('id', userId)
        .single()
      
      if (userData) setUser(userData)

      // جلب بيانات العضوية
      const { data: memberData } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (memberData) {
        setMemberId(memberData.id)

        // التحقق من الاشتراك
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('member_id', memberData.id)
          .eq('status', 'active')
          .single()
        
        if (subData) setIsSubscribed(true)

        // جلب البيانات بالتوازي
        await Promise.all([
          loadNotifications(memberData.id),
          loadMessages(memberData.id),
          loadTickets(memberData.id)
        ])
      }

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // جلب الإشعارات
  // ═══════════════════════════════════════════════════════════════
  const loadNotifications = async (memId: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', memId)
      .eq('recipient_type', 'member')
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      const formatted = data.map(n => ({
        id: n.id,
        type: n.notification_type,
        title: n.title,
        description: n.body || '',
        created_at: n.created_at,
        is_read: n.is_read,
        requires_action: ['document_required', 'poa_request'].includes(n.notification_type),
        action_url: n.action_url || (n.request_id ? `/subscriber/requests/${n.request_id}` : undefined),
        action_label: getActionLabel(n.notification_type),
        request_id: n.request_id
      }))
      setNotifications(formatted)
    }
  }

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'appointment': return 'عرض الموعد'
      case 'case_update': return 'عرض القضية'
      case 'poa_request': return 'رفع الوكالة'
      case 'poa_approved': return 'عرض التفاصيل'
      case 'request_update': return 'عرض الطلب'
      default: return 'عرض التفاصيل'
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // جلب الرسائل (المحادثات مع المحامين)
  // ═══════════════════════════════════════════════════════════════
  const loadMessages = async (memId: string) => {
    // جلب الطلبات الخاصة بالمشترك
    const { data: requests } = await supabase
      .from('service_requests')
      .select('id, ticket_number, title')
      .eq('member_id', memId)
      .not('assigned_lawyer_id', 'is', null)

    if (!requests || requests.length === 0) {
      setMessages([])
      return
    }

    const requestIds = requests.map(r => r.id)

    // جلب آخر رسالة من كل طلب
    const { data: messagesData } = await supabase
      .from('request_client_messages')
      .select('*')
      .in('request_id', requestIds)
      .order('created_at', { ascending: false })

    if (messagesData) {
      // تجميع الرسائل حسب الطلب وأخذ آخر رسالة
      const latestByRequest = new Map<string, any>()
      messagesData.forEach(msg => {
        if (!latestByRequest.has(msg.request_id)) {
          const req = requests.find(r => r.id === msg.request_id)
          latestByRequest.set(msg.request_id, {
            id: msg.id,
            request_id: msg.request_id,
            ticket_number: req?.ticket_number,
            request_title: req?.title,
            content: msg.content,
            sender_type: msg.sender_type,
            sender_name: msg.sender_name,
            created_at: msg.created_at,
            is_read: msg.is_read || msg.sender_type === 'member'
          })
        }
      })

      setMessages(Array.from(latestByRequest.values()))
    }
  }

  // جلب محادثة كاملة لطلب معين
  const loadConversation = async (requestId: string) => {
    const { data } = await supabase
      .from('request_client_messages')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })

    if (data) {
      setConversationMessages(data.map(msg => ({
        id: msg.id,
        request_id: msg.request_id,
        content: msg.content,
        sender_type: msg.sender_type,
        sender_name: msg.sender_name,
        created_at: msg.created_at,
        is_read: msg.is_read
      })))
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // جلب تذاكر الدعم
  // ═══════════════════════════════════════════════════════════════
  const loadTickets = async (memId: string) => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('member_id', memId)
      .order('updated_at', { ascending: false })

    if (data) {
      // جلب رسائل كل تذكرة
      const ticketsWithMessages = await Promise.all(data.map(async (ticket) => {
        const { data: ticketMessages } = await supabase
          .from('support_ticket_messages')
          .select('*')
          .eq('ticket_id', ticket.id)
          .order('created_at', { ascending: true })

        return {
          id: ticket.id,
          subject: ticket.subject,
          category: ticket.category,
          priority: ticket.priority,
          status: ticket.status,
          created_at: ticket.created_at,
          updated_at: ticket.updated_at,
          messages: (ticketMessages || []).map(m => ({
            id: m.id,
            content: m.content,
            sender_type: m.sender_type,
            sender_name: m.sender_name,
            created_at: m.created_at
          }))
        }
      }))

      setTickets(ticketsWithMessages)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // الإجراءات
  // ═══════════════════════════════════════════════════════════════
  
  const handleLogout = () => {
    logoutMember()
  }

  // إرسال رسالة للمحامي
  const handleSendMessage = async () => {
    if (!replyText.trim() || !selectedMessage) return

    try {
      const { error } = await supabase.from('request_client_messages').insert({
        request_id: selectedMessage.request_id,
        sender_id: memberId,
        sender_type: 'member',
        sender_name: user?.full_name || 'المشترك',
        content: replyText,
        is_read: false
      })

      if (error) throw error

      // تحديث المحادثة
      await loadConversation(selectedMessage.request_id)
      setReplyText('')
      toast.success('تم إرسال الرسالة')

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في إرسال الرسالة')
    }
  }

  // فتح تذكرة دعم جديدة
  const handleCreateTicket = async () => {
    if (!newTicket.subject || !newTicket.content) {
      toast.error('يرجى ملء جميع الحقول')
      return
    }

    try {
      // إنشاء التذكرة
      const { data: ticketData, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          member_id: memberId,
          subject: newTicket.subject,
          category: newTicket.category,
          priority: newTicket.priority,
          status: 'open'
        })
        .select()
        .single()

      if (ticketError) throw ticketError

      // إضافة الرسالة الأولى
      await supabase.from('support_ticket_messages').insert({
        ticket_id: ticketData.id,
        sender_type: 'member',
        sender_name: user?.full_name,
        content: newTicket.content
      })

      toast.success('تم فتح التذكرة بنجاح')
      setShowNewTicketModal(false)
      setNewTicket({ subject: '', category: 'technical', priority: 'normal', content: '' })
      
      // إعادة تحميل التذاكر
      if (memberId) loadTickets(memberId)

    } catch (error: any) {
      console.error('Error:', error)
      // إذا لم يكن الجدول موجوداً
      if (error.code === '42P01') {
        toast.error('نظام الدعم قيد التطوير')
      } else {
        toast.error('حدث خطأ في فتح التذكرة')
      }
    }
  }

  // إرسال رد على تذكرة
  const handleSendTicketReply = async () => {
    if (!replyText.trim() || !selectedTicket) return

    try {
      await supabase.from('support_ticket_messages').insert({
        ticket_id: selectedTicket.id,
        sender_type: 'member',
        sender_name: user?.full_name,
        content: replyText
      })

      // تحديث وقت التذكرة
      await supabase
        .from('support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedTicket.id)

      toast.success('تم إرسال الرد')
      setReplyText('')
      
      // إعادة تحميل التذاكر
      if (memberId) loadTickets(memberId)

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في إرسال الرد')
    }
  }

  // تعليم الإشعار كمقروء
  const markNotificationAsRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)

    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, is_read: true } : n
    ))
  }

  // ═══════════════════════════════════════════════════════════════
  // دوال مساعدة
  // ═══════════════════════════════════════════════════════════════
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'document_required': return '📄'
      case 'request_update': return '📋'
      case 'appointment': return '📅'
      case 'payment': return '💳'
      case 'case_update': return '⚖️'
      case 'poa_request': return '📜'
      case 'poa_approved': return '✅'
      case 'poa_rejected': return '❌'
      case 'new_quote': return '💰'
      case 'quote_accepted': return '✅'
      default: return '🔔'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return { label: 'مفتوحة', color: 'bg-yellow-100 text-yellow-700' }
      case 'in_progress': return { label: 'قيد المعالجة', color: 'bg-blue-100 text-blue-700' }
      case 'resolved': return { label: 'تم الحل', color: 'bg-green-100 text-green-700' }
      default: return { label: 'مغلقة', color: 'bg-gray-100 text-gray-700' }
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return 'الآن'
    if (minutes < 60) return `منذ ${minutes} دقيقة`
    if (hours < 24) return `منذ ${hours} ساعة`
    if (days === 1) return 'أمس'
    if (days < 7) return `منذ ${days} أيام`
    return date.toLocaleDateString('ar-SA')
  }

  // الإحصائيات
  const unreadMessages = messages.filter(m => !m.is_read && m.sender_type === 'lawyer').length
  const unreadNotifications = notifications.filter(n => !n.is_read).length
  const openTickets = tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved').length
  const actionRequired = notifications.filter(n => n.requires_action && !n.is_read).length

  // الترتيب
  const sortedNotifications = [...notifications].sort((a, b) => {
    if (a.requires_action && !a.is_read && (!b.requires_action || b.is_read)) return -1
    if (b.requires_action && !b.is_read && (!a.requires_action || a.is_read)) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const sortedMessages = [...messages].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

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

      <main className="flex-1 mr-64 p-8">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold mb-2">📬 مركز التواصل</h1>
          <p className="text-gray-600 mb-4">
            تابع إشعاراتك ورسائلك مع المحامين وتذاكر الدعم الفني
          </p>
          
          {/* Action Required Banner */}
          {actionRequired > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-semibold text-orange-800">لديك {actionRequired} عناصر تتطلب إجراء</p>
                  <p className="text-sm text-orange-600">يرجى مراجعتها في أقرب وقت</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('notifications')}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600"
              >
                عرض الآن
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex gap-6">
              <button
                onClick={() => { setActiveTab('notifications'); }}
                className={`py-4 px-1 border-b-2 font-medium text-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'notifications' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                🔔 التنبيهات
                {unreadNotifications > 0 && <span className="bg-red-100 text-red-600 py-0.5 px-2.5 rounded-full text-sm font-bold">{unreadNotifications}</span>}
              </button>
              <button
                onClick={() => { setActiveTab('inbox'); setSelectedMessage(null); setConversationMessages([]); }}
                className={`py-4 px-1 border-b-2 font-medium text-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'inbox' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📥 المحادثات
                {unreadMessages > 0 && <span className="bg-blue-100 text-blue-600 py-0.5 px-2.5 rounded-full text-sm font-bold">{unreadMessages}</span>}
              </button>
              <button
                onClick={() => { setActiveTab('support'); setSelectedTicket(null); }}
                className={`py-4 px-1 border-b-2 font-medium text-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'support' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                🎫 الدعم الفني
                {openTickets > 0 && <span className="bg-yellow-100 text-yellow-600 py-0.5 px-2.5 rounded-full text-sm font-bold">{openTickets}</span>}
              </button>
            </nav>
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════════════
            تبويب التنبيهات
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'notifications' && (
          <div className="space-y-3">
            {sortedNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-gray-200">
                <span className="text-6xl mb-4">🔔</span>
                <h3 className="text-xl font-bold text-gray-800">لا توجد تنبيهات</h3>
                <p className="text-gray-500 mt-2">ستظهر هنا جميع التنبيهات والتحديثات</p>
              </div>
            ) : (
              sortedNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => markNotificationAsRead(notification.id)}
                  className={`p-4 bg-white rounded-lg border transition-all cursor-pointer ${
                    notification.requires_action && !notification.is_read 
                      ? 'border-orange-300 bg-orange-50/50' 
                      : notification.is_read ? 'border-gray-200' : 'border-blue-200 bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-md ${notification.is_read ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>
                          {notification.title}
                        </h3>
                        {notification.requires_action && !notification.is_read && (
                          <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">مطلوب إجراء</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{notification.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">{formatTime(notification.created_at)}</span>
                        {notification.action_url && (
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(notification.action_url!) }}
                            className={`text-sm font-medium px-3 py-1 rounded-lg ${
                              notification.requires_action ? 'bg-orange-500 text-white hover:bg-orange-600' : 'text-blue-500 hover:bg-blue-50'
                            }`}
                          >
                            {notification.action_label || 'عرض'} {notification.requires_action ? '←' : ''}
                          </button>
                        )}
                      </div>
                    </div>
                    {!notification.is_read && <span className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            تبويب المحادثات
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'inbox' && (
          <div className="flex gap-6 h-[calc(100vh-320px)]">
            {/* قائمة المحادثات */}
            <div className="w-1/3 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-600">محادثاتك مع المحامين في الطلبات</p>
              </div>
              <div className="overflow-y-auto flex-1">
                {sortedMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                    <span className="text-5xl mb-3">💬</span>
                    <p className="font-medium">لا توجد محادثات</p>
                    <p className="text-sm text-center mt-2">ستظهر هنا المحادثات مع المحامين عند إسناد طلباتك</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {sortedMessages.map((message) => (
                      <div
                        key={message.id}
                        onClick={() => { 
                          setSelectedMessage(message)
                          loadConversation(message.request_id)
                        }}
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedMessage?.request_id === message.request_id 
                            ? 'bg-blue-50 border-r-4 border-blue-500' 
                            : !message.is_read && message.sender_type === 'lawyer'
                              ? 'bg-blue-50/50 hover:bg-gray-50' 
                              : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex gap-3">
                          <span className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-purple-100 text-purple-600">⚖️</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`truncate ${!message.is_read && message.sender_type === 'lawyer' ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                {message.ticket_number || 'طلب'}
                              </p>
                              {!message.is_read && message.sender_type === 'lawyer' && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 truncate">{message.sender_name}</p>
                            <p className="text-sm text-gray-600 truncate mt-1">{message.content}</p>
                            <p className="text-xs text-gray-400 mt-1">{formatTime(message.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* المحادثة */}
            <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
              {selectedMessage ? (
                <>
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">{selectedMessage.ticket_number}</h2>
                        <p className="text-sm text-gray-500">{selectedMessage.request_title || 'محادثة مع المحامي'}</p>
                      </div>
                      <button 
                        onClick={() => router.push(`/subscriber/requests/${selectedMessage.request_id}`)}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600"
                      >
                        عرض الطلب ←
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {conversationMessages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.sender_type === 'member' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl ${
                          msg.sender_type === 'member' 
                            ? 'bg-blue-500 text-white rounded-tr-sm' 
                            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                        }`}>
                          {msg.sender_type === 'lawyer' && (
                            <p className="text-xs font-semibold text-purple-600 mb-1">{msg.sender_name}</p>
                          )}
                          <p>{msg.content}</p>
                          <p className={`text-xs mt-2 ${msg.sender_type === 'member' ? 'text-blue-200' : 'text-gray-400'}`}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t border-gray-200 bg-white">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="اكتب رسالتك..."
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                      <button 
                        onClick={handleSendMessage}
                        className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 font-semibold"
                      >
                        إرسال
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                  <span className="text-6xl mb-4">💬</span>
                  <p className="text-lg">اختر محادثة لعرضها</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            تبويب الدعم الفني
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'support' && (
          <div className="flex gap-6 h-[calc(100vh-320px)]">
            {/* قائمة التذاكر */}
            <div className="w-1/3 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <button
                  onClick={() => setShowNewTicketModal(true)}
                  className="w-full bg-blue-500 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  🎫 فتح تذكرة جديدة
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                {tickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                    <span className="text-5xl mb-3">🎫</span>
                    <p className="font-medium">لا توجد تذاكر</p>
                    <p className="text-sm text-center mt-2">افتح تذكرة جديدة إذا واجهت أي مشكلة</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {tickets.map((ticket) => {
                      const status = getStatusBadge(ticket.status)
                      const cat = TICKET_CATEGORIES.find(c => c.id === ticket.category)
                      return (
                        <div
                          key={ticket.id}
                          onClick={() => setSelectedTicket(ticket)}
                          className={`p-4 cursor-pointer transition-colors ${
                            selectedTicket?.id === ticket.id 
                              ? 'bg-blue-50 border-r-4 border-blue-500' 
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-lg">{cat?.icon || '🎫'}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                          </div>
                          <p className="font-medium text-gray-900 truncate">{ticket.subject}</p>
                          <p className="text-xs text-gray-500 mt-1">{formatTime(ticket.updated_at)}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* تفاصيل التذكرة */}
            <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
              {selectedTicket ? (
                <>
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">{selectedTicket.subject}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(selectedTicket.status).color}`}>
                            {getStatusBadge(selectedTicket.status).label}
                          </span>
                          <span className="text-xs text-gray-500">• فُتحت {formatTime(selectedTicket.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {selectedTicket.messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.sender_type === 'member' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl ${
                          msg.sender_type === 'member' 
                            ? 'bg-blue-500 text-white rounded-tr-sm' 
                            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                        }`}>
                          {msg.sender_type !== 'member' && (
                            <p className="text-xs font-semibold text-teal-600 mb-1">
                              {msg.sender_name || 'فريق الدعم'}
                            </p>
                          )}
                          <p>{msg.content}</p>
                          <p className={`text-xs mt-2 ${msg.sender_type === 'member' ? 'text-blue-200' : 'text-gray-400'}`}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && (
                    <div className="p-4 border-t border-gray-200 bg-white">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendTicketReply()}
                          placeholder="اكتب ردك..."
                          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                        <button 
                          onClick={handleSendTicketReply}
                          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 font-semibold"
                        >
                          إرسال
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                  <span className="text-6xl mb-4">🎫</span>
                  <p className="text-lg">اختر تذكرة لعرضها</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════
          Modal: تذكرة جديدة
      ═══════════════════════════════════════════════════════════════ */}
      {showNewTicketModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">🎫 تذكرة دعم جديدة</h2>
              <button onClick={() => setShowNewTicketModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع المشكلة</label>
                <div className="grid grid-cols-3 gap-2">
                  {TICKET_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setNewTicket({ ...newTicket, category: cat.id })}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        newTicket.category === cat.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-2xl">{cat.icon}</span>
                      <p className="text-sm mt-1">{cat.name}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الموضوع</label>
                <input
                  type="text"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="وصف مختصر للمشكلة..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الأولوية</label>
                <div className="flex gap-2">
                  {[
                    { key: 'normal', label: 'عادية', color: 'bg-gray-100' },
                    { key: 'high', label: 'مهمة', color: 'bg-orange-100' },
                    { key: 'urgent', label: 'عاجلة', color: 'bg-red-100' },
                  ].map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setNewTicket({ ...newTicket, priority: p.key })}
                      className={`px-4 py-1.5 text-sm font-medium rounded-full ${p.color} ${
                        newTicket.priority === p.key ? 'ring-2 ring-blue-500' : ''
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تفاصيل المشكلة</label>
                <textarea
                  value={newTicket.content}
                  onChange={(e) => setNewTicket({ ...newTicket, content: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="اشرح المشكلة بالتفصيل..."
                ></textarea>
              </div>
            </div>
            <div className="p-6 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
              <button 
                onClick={() => setShowNewTicketModal(false)} 
                className="px-6 py-2.5 text-gray-600 hover:bg-gray-200 rounded-lg"
              >
                إلغاء
              </button>
              <button 
                onClick={handleCreateTicket} 
                className="bg-blue-500 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-600"
              >
                📤 إرسال التذكرة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
