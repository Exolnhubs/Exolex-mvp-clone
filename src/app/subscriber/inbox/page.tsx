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

interface Message {
  id: string
  subject: string
  content: string
  sender_type: 'admin' | 'support' | 'lawyer'
  sender_name?: string
  priority: 'normal' | 'important' | 'urgent'
  status: 'unread' | 'read'
  requires_action: boolean
  action_type?: string
  related_request_id?: string
  created_at: string
  replies?: Reply[]
}

interface Reply {
  id: string
  content: string
  sender: 'user' | 'admin' | 'support' | 'lawyer'
  sender_name?: string
  created_at: string
}

interface Notification {
  id: string
  type: 'request_update' | 'document_required' | 'appointment' | 'payment' | 'case_update' | 'system'
  title: string
  description: string
  created_at: string
  is_read: boolean
  requires_action: boolean
  action_url?: string
  action_label?: string
  related_id?: string
}

interface SupportTicket {
  id: string
  subject: string
  category: 'technical' | 'financial' | 'operational'
  priority: 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  created_at: string
  updated_at: string
  messages: TicketMessage[]
}

interface TicketMessage {
  id: string
  content: string
  sender: 'user' | 'support'
  created_at: string
  attachments?: string[]
}

const TICKET_CATEGORIES = [
  { id: 'technical', name: 'مشكلة تقنية', icon: '🔧' },
  { id: 'financial', name: 'مشكلة مالية', icon: '💰' },
  { id: 'operational', name: 'مشكلة تشغيلية', icon: '⚙️' },
]

export default function CommunicationCenterPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [activeTab, setActiveTab] = useState<'inbox' | 'notifications' | 'support'>('inbox')
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [showNewTicketModal, setShowNewTicketModal] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [replyText, setReplyText] = useState('')
  
  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: 'technical' as 'technical' | 'financial' | 'operational',
    priority: 'normal' as 'normal' | 'high' | 'urgent',
    content: '',
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

      // Sample inbox messages
      setMessages([
        {
          id: '1',
          subject: 'مستندات ناقصة في الطلب #1234',
          content: 'نحتاج صورة من الهوية الوطنية لإكمال الطلب',
          sender_type: 'lawyer',
          sender_name: 'أ. أحمد السالم',
          priority: 'urgent',
          status: 'unread',
          requires_action: true,
          action_type: 'document_upload',
          related_request_id: '1234',
          created_at: '2024-12-29T10:45:00',
          replies: []
        },
        {
          id: '2',
          subject: 'تأكيد استلام المستندات',
          content: 'تم استلام جميع المستندات المطلوبة وجاري مراجعتها',
          sender_type: 'admin',
          sender_name: 'فريق ExoLex',
          priority: 'normal',
          status: 'read',
          requires_action: false,
          created_at: '2024-12-28T14:30:00',
          replies: [
            { id: 'r1', content: 'شكراً لكم', sender: 'user', created_at: '2024-12-28T15:00:00' },
          ]
        },
        {
          id: '3',
          subject: 'موعد الاستشارة القادمة',
          content: 'تم تحديد موعد استشارتك المرئية يوم الأحد الساعة 10 صباحاً',
          sender_type: 'lawyer',
          sender_name: 'أ. فاطمة الحربي',
          priority: 'important',
          status: 'unread',
          requires_action: true,
          action_type: 'confirm_appointment',
          created_at: '2024-12-28T09:00:00',
        },
      ])

      // Sample notifications
      setNotifications([
        { id: 'n1', type: 'document_required', title: 'مستند مطلوب', description: 'يرجى رفع صورة الهوية للطلب #1234', created_at: '2024-12-29T12:00:00', is_read: false, requires_action: true, action_url: '/subscriber/requests/1234', action_label: 'رفع المستند' },
        { id: 'n2', type: 'request_update', title: 'تحديث حالة الطلب', description: 'تم تعيين محامي لطلبك #1234', created_at: '2024-12-29T10:00:00', is_read: false, requires_action: false, action_url: '/subscriber/requests/1234', action_label: 'عرض الطلب' },
        { id: 'n3', type: 'appointment', title: 'تذكير بموعد', description: 'لديك استشارة مرئية غداً الساعة 10 صباحاً', created_at: '2024-12-29T08:00:00', is_read: false, requires_action: true, action_url: '/subscriber/calendar', action_label: 'عرض الموعد' },
        { id: 'n4', type: 'payment', title: 'تأكيد الدفع', description: 'تم استلام دفعة الاشتراك بنجاح', created_at: '2024-12-28T16:00:00', is_read: true, requires_action: false },
        { id: 'n5', type: 'case_update', title: 'تحديث في القضية', description: 'تم تحديد موعد الجلسة القادمة', created_at: '2024-12-28T14:00:00', is_read: true, requires_action: false, action_url: '/subscriber/requests/5678', action_label: 'عرض التفاصيل' },
        { id: 'n6', type: 'system', title: 'تحديث المنصة', description: 'تم إضافة ميزات جديدة للمكتبة القانونية', created_at: '2024-12-27T10:00:00', is_read: true, requires_action: false },
      ])

      // Sample support tickets
      setTickets([
        {
          id: 't1',
          subject: 'مشكلة في تحميل المستندات',
          category: 'technical',
          priority: 'high',
          status: 'in_progress',
          created_at: '2024-12-28T10:00:00',
          updated_at: '2024-12-29T09:00:00',
          messages: [
            { id: 'm1', content: 'لا أستطيع تحميل ملفات PDF في صفحة الطلبات', sender: 'user', created_at: '2024-12-28T10:00:00' },
            { id: 'm2', content: 'شكراً لتواصلك. جاري التحقق من المشكلة', sender: 'support', created_at: '2024-12-28T11:00:00' },
            { id: 'm3', content: 'تم اكتشاف المشكلة وجاري إصلاحها', sender: 'support', created_at: '2024-12-29T09:00:00' },
          ]
        },
        {
          id: 't2',
          subject: 'استفسار عن الفاتورة',
          category: 'financial',
          priority: 'normal',
          status: 'resolved',
          created_at: '2024-12-25T14:00:00',
          updated_at: '2024-12-26T10:00:00',
          messages: [
            { id: 'm4', content: 'أحتاج توضيح عن الخصم في الفاتورة الأخيرة', sender: 'user', created_at: '2024-12-25T14:00:00' },
            { id: 'm5', content: 'الخصم هو عرض نهاية السنة 20%', sender: 'support', created_at: '2024-12-26T10:00:00' },
          ]
        },
      ])

      setIsLoading(false)
    }
    fetchData()
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('exolex_user_id')
    router.push('/auth/login')
  }

  const handleSendReply = (type: 'message' | 'ticket') => {
    if (!replyText.trim()) return
    
    if (type === 'message' && selectedMessage) {
      const reply: Reply = { id: Date.now().toString(), content: replyText, sender: 'user', created_at: new Date().toISOString() }
      const updated = messages.map(m => m.id === selectedMessage.id ? { ...m, replies: [...(m.replies || []), reply] } : m)
      setMessages(updated)
      setSelectedMessage({ ...selectedMessage, replies: [...(selectedMessage.replies || []), reply] })
    } else if (type === 'ticket' && selectedTicket) {
      const msg: TicketMessage = { id: Date.now().toString(), content: replyText, sender: 'user', created_at: new Date().toISOString() }
      const updated = tickets.map(t => t.id === selectedTicket.id ? { ...t, messages: [...t.messages, msg], updated_at: new Date().toISOString() } : t)
      setTickets(updated)
      setSelectedTicket({ ...selectedTicket, messages: [...selectedTicket.messages, msg] })
    }
    
    setReplyText('')
    toast.success('تم إرسال الرد')
  }

  const handleCreateTicket = () => {
    if (!newTicket.subject || !newTicket.content) {
      toast.error('يرجى ملء جميع الحقول')
      return
    }
    
    const ticket: SupportTicket = {
      id: Date.now().toString(),
      ...newTicket,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [{ id: '1', content: newTicket.content, sender: 'user', created_at: new Date().toISOString() }]
    }
    
    setTickets([ticket, ...tickets])
    setShowNewTicketModal(false)
    setNewTicket({ subject: '', category: 'technical', priority: 'normal', content: '' })
    toast.success('تم فتح التذكرة بنجاح')
  }

  const markNotificationAsRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const getSenderInfo = (type: string) => {
    switch (type) {
      case 'lawyer': return { icon: '⚖️', color: 'bg-purple-100 text-purple-600', name: 'المحامي' }
      case 'admin': return { icon: '🏢', color: 'bg-blue-100 text-blue-600', name: 'الإدارة' }
      default: return { icon: '🛠️', color: 'bg-teal-100 text-teal-600', name: 'الدعم' }
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'document_required': return '📄'
      case 'request_update': return '📋'
      case 'appointment': return '📅'
      case 'payment': return '💳'
      case 'case_update': return '⚖️'
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
    
    if (minutes < 60) return `منذ ${minutes} دقيقة`
    if (hours < 24) return `منذ ${hours} ساعة`
    if (days === 1) return 'أمس'
    return date.toLocaleDateString('ar-SA')
  }

  // Counts
  const unreadMessages = messages.filter(m => m.status === 'unread').length
  const unreadNotifications = notifications.filter(n => !n.is_read).length
  const openTickets = tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved').length
  const actionRequired = notifications.filter(n => n.requires_action && !n.is_read).length + messages.filter(m => m.requires_action && m.status === 'unread').length

  // Sort: action required first
  const sortedNotifications = [...notifications].sort((a, b) => {
    if (a.requires_action && !a.is_read && (!b.requires_action || b.is_read)) return -1
    if (b.requires_action && !b.is_read && (!a.requires_action || a.is_read)) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const sortedMessages = [...messages].sort((a, b) => {
    if (a.requires_action && a.status === 'unread' && (!b.requires_action || b.status !== 'unread')) return -1
    if (b.requires_action && b.status === 'unread' && (!a.requires_action || a.status !== 'unread')) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

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
            كل تواصلك في مكان واحد. من هنا تتابع رسائلك مع الإدارة والمحامين، وتستلم التنبيهات عن تحديثات الطلبات والقضايا، وتفتح تذكرة دعم لحل أي مشكلة تقنية أو مالية بسرعة.
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
                onClick={() => { setActiveTab('inbox'); setSelectedMessage(null); }}
                className={`py-4 px-1 border-b-2 font-medium text-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'inbox' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📥 الوارد
                {unreadMessages > 0 && <span className="bg-blue-100 text-blue-600 py-0.5 px-2.5 rounded-full text-sm font-bold">{unreadMessages}</span>}
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`py-4 px-1 border-b-2 font-medium text-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'notifications' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                🔔 التنبيهات
                {unreadNotifications > 0 && <span className="bg-red-100 text-red-600 py-0.5 px-2.5 rounded-full text-sm font-bold">{unreadNotifications}</span>}
              </button>
              <button
                onClick={() => { setActiveTab('support'); setSelectedTicket(null); }}
                className={`py-4 px-1 border-b-2 font-medium text-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'support' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                🎫 الدعم
                {openTickets > 0 && <span className="bg-yellow-100 text-yellow-600 py-0.5 px-2.5 rounded-full text-sm font-bold">{openTickets}</span>}
              </button>
            </nav>
          </div>
        </header>

        {/* Inbox Tab */}
        {activeTab === 'inbox' && (
          <div className="flex gap-6 h-[calc(100vh-320px)]">
            <div className="w-1/3 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-600">جميع المحادثات مع الإدارة والدعم والمحامين</p>
              </div>
              <div className="overflow-y-auto flex-1">
                {sortedMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                    <span className="text-5xl mb-3">📭</span>
                    <p className="font-medium">لا توجد رسائل</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {sortedMessages.map((message) => {
                      const sender = getSenderInfo(message.sender_type)
                      return (
                        <div
                          key={message.id}
                          onClick={() => { setSelectedMessage(message); if (message.status === 'unread') setMessages(messages.map(m => m.id === message.id ? {...m, status: 'read'} : m)) }}
                          className={`p-4 cursor-pointer transition-colors ${
                            selectedMessage?.id === message.id ? 'bg-blue-50 border-r-4 border-blue-500' : 
                            message.status === 'unread' ? 'bg-blue-50/50 hover:bg-gray-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex gap-3">
                            <span className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${sender.color}`}>{sender.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className={`truncate ${message.status === 'unread' ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{message.subject}</p>
                                {message.requires_action && message.status === 'unread' && (
                                  <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full flex-shrink-0">مطلوب إجراء</span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 truncate">{message.sender_name}</p>
                              <p className="text-xs text-gray-400 mt-1">{formatTime(message.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
              {selectedMessage ? (
                <>
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">{selectedMessage.subject}</h2>
                        <p className="text-sm text-gray-500">{selectedMessage.sender_name} • {formatTime(selectedMessage.created_at)}</p>
                      </div>
                      {selectedMessage.requires_action && (
                        <button 
                          onClick={() => selectedMessage.related_request_id && router.push(`/subscriber/requests/${selectedMessage.related_request_id}`)}
                          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600"
                        >
                          تنفيذ الآن ←
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="flex justify-end">
                      <div className="max-w-[80%] bg-gray-100 text-gray-800 p-4 rounded-2xl rounded-tl-sm">
                        <p>{selectedMessage.content}</p>
                        <p className="text-xs text-gray-500 mt-2">{formatTime(selectedMessage.created_at)}</p>
                      </div>
                    </div>
                    {selectedMessage.replies?.map((reply) => (
                      <div key={reply.id} className={`flex ${reply.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl ${reply.sender === 'user' ? 'bg-blue-500 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                          <p>{reply.content}</p>
                          <p className={`text-xs mt-2 ${reply.sender === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>{formatTime(reply.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t border-gray-200">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendReply('message')}
                        placeholder="اكتب ردك..."
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
                      />
                      <button onClick={() => handleSendReply('message')} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">إرسال</button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                  <span className="text-6xl mb-4">💬</span>
                  <p className="text-lg">اختر رسالة لعرضها</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-3">
            {sortedNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-gray-200">
                <span className="text-6xl mb-4">🔔</span>
                <h3 className="text-xl font-bold text-gray-800">لا توجد تنبيهات</h3>
              </div>
            ) : (
              sortedNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => markNotificationAsRead(notification.id)}
                  className={`p-4 bg-white rounded-lg border transition-all ${
                    notification.requires_action && !notification.is_read 
                      ? 'border-orange-300 bg-orange-50/50' 
                      : notification.is_read ? 'border-gray-200' : 'border-blue-200 bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-md ${notification.is_read ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>{notification.title}</h3>
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

        {/* Support Tab */}
        {activeTab === 'support' && (
          <div className="flex gap-6 h-[calc(100vh-320px)]">
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
                          className={`p-4 cursor-pointer transition-colors ${selectedTicket?.id === ticket.id ? 'bg-blue-50 border-r-4 border-blue-500' : 'hover:bg-gray-50'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-lg">{cat?.icon}</span>
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

            <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
              {selectedTicket ? (
                <>
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">{selectedTicket.subject}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(selectedTicket.status).color}`}>{getStatusBadge(selectedTicket.status).label}</span>
                          <span className="text-xs text-gray-500">• فتحت {formatTime(selectedTicket.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {selectedTicket.messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl ${msg.sender === 'user' ? 'bg-blue-500 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                          <p>{msg.content}</p>
                          <p className={`text-xs mt-2 ${msg.sender === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>{formatTime(msg.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && (
                    <div className="p-4 border-t border-gray-200">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendReply('ticket')}
                          placeholder="اكتب ردك..."
                          className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
                        />
                        <button onClick={() => handleSendReply('ticket')} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">إرسال</button>
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

      {/* New Ticket Modal */}
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
                      onClick={() => setNewTicket({ ...newTicket, category: cat.id as typeof newTicket.category })}
                      className={`p-3 rounded-lg border text-center transition-all ${newTicket.category === cat.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
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
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="وصف مختصر للمشكلة..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الأولوية</label>
                <div className="flex gap-2">
                  {[
                    { key: 'normal', label: 'عادية', color: 'bg-gray-200' },
                    { key: 'high', label: 'مهمة', color: 'bg-orange-100' },
                    { key: 'urgent', label: 'عاجلة', color: 'bg-red-100' },
                  ].map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setNewTicket({ ...newTicket, priority: p.key as typeof newTicket.priority })}
                      className={`px-4 py-1.5 text-sm font-medium rounded-full ${p.color} ${newTicket.priority === p.key ? 'ring-2 ring-blue-500' : ''}`}
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
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="اشرح المشكلة بالتفصيل..."
                ></textarea>
              </div>
            </div>
            <div className="p-6 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
              <button onClick={() => setShowNewTicketModal(false)} className="px-6 py-2.5 text-gray-600 hover:bg-gray-200 rounded-lg">إلغاء</button>
              <button onClick={handleCreateTicket} className="bg-blue-500 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-600">📤 إرسال التذكرة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
