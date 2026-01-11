'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Send, Phone, Video, MoreVertical, Paperclip, Smile, Check, CheckCheck } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// 📌 مركز التواصل - المحامي المستقل
// 📅 تاريخ الإنشاء: 12 يناير 2026
// 🎯 الغرض: التواصل مع العملاء والدعم الفني
// ═══════════════════════════════════════════════════════════════

interface Conversation {
  id: string
  participant_name: string
  participant_code: string
  participant_type: 'client' | 'support' | 'nolex'
  last_message: string
  last_message_time: string
  unread_count: number
  is_online: boolean
  avatar?: string
}

interface Message {
  id: string
  sender_id: string
  sender_type: 'lawyer' | 'client' | 'support' | 'nolex'
  content: string
  created_at: string
  is_read: boolean
  attachments?: string[]
}

export default function CommunicationCenter() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [lawyerId, setLawyerId] = useState<string | null>(null)

  useEffect(() => {
    const id = localStorage.getItem('exolex_lawyer_id')
    if (id) {
      setLawyerId(id)
      fetchConversations(id)
    }
  }, [])

  const fetchConversations = async (id: string) => {
    setLoading(true)
    // بيانات تجريبية - سيتم ربطها بقاعدة البيانات
    setConversations([
      {
        id: '1',
        participant_name: 'محمد السالم',
        participant_code: 'USR-12345',
        participant_type: 'client',
        last_message: 'شكراً لك على المساعدة',
        last_message_time: new Date(Date.now() - 10 * 60000).toISOString(),
        unread_count: 2,
        is_online: true
      },
      {
        id: '2',
        participant_name: 'فاطمة الأحمد',
        participant_code: 'USR-67890',
        participant_type: 'client',
        last_message: 'متى موعد الجلسة القادمة؟',
        last_message_time: new Date(Date.now() - 60 * 60000).toISOString(),
        unread_count: 0,
        is_online: false
      },
      {
        id: '3',
        participant_name: 'الدعم الفني',
        participant_code: 'SUPPORT',
        participant_type: 'support',
        last_message: 'تم حل المشكلة، شكراً لتواصلك',
        last_message_time: new Date(Date.now() - 24 * 60 * 60000).toISOString(),
        unread_count: 0,
        is_online: true
      },
      {
        id: '4',
        participant_name: 'NOLEX AI',
        participant_code: 'NOLEX',
        participant_type: 'nolex',
        last_message: 'تم تحويل طلب جديد إليك',
        last_message_time: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
        unread_count: 1,
        is_online: true
      }
    ])
    setLoading(false)
  }

  const fetchMessages = async (conversationId: string) => {
    // بيانات تجريبية
    setMessages([
      {
        id: '1',
        sender_id: 'client',
        sender_type: 'client',
        content: 'السلام عليكم، أحتاج استشارة قانونية',
        created_at: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
        is_read: true
      },
      {
        id: '2',
        sender_id: lawyerId || '',
        sender_type: 'lawyer',
        content: 'وعليكم السلام، تفضل كيف يمكنني مساعدتك؟',
        created_at: new Date(Date.now() - 1.5 * 60 * 60000).toISOString(),
        is_read: true
      },
      {
        id: '3',
        sender_id: 'client',
        sender_type: 'client',
        content: 'لدي نزاع مع شركتي بخصوص مستحقات نهاية الخدمة',
        created_at: new Date(Date.now() - 60 * 60000).toISOString(),
        is_read: true
      },
      {
        id: '4',
        sender_id: lawyerId || '',
        sender_type: 'lawyer',
        content: 'حسناً، هل يمكنك إرسال نسخة من عقد العمل ومسيرات الرواتب؟',
        created_at: new Date(Date.now() - 30 * 60000).toISOString(),
        is_read: true
      },
      {
        id: '5',
        sender_id: 'client',
        sender_type: 'client',
        content: 'شكراً لك على المساعدة',
        created_at: new Date(Date.now() - 10 * 60000).toISOString(),
        is_read: false
      }
    ])
  }

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation)
    fetchMessages(conversation.id)
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return

    const message: Message = {
      id: Date.now().toString(),
      sender_id: lawyerId || '',
      sender_type: 'lawyer',
      content: newMessage.trim(),
      created_at: new Date().toISOString(),
      is_read: false
    }

    setMessages(prev => [...prev, message])
    setNewMessage('')
    
    // TODO: إرسال للسيرفر
  }

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `منذ ${days} يوم`
    if (hours > 0) return `منذ ${hours} س`
    return `منذ ${minutes} د`
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
  }

  const getParticipantIcon = (type: string) => {
    switch (type) {
      case 'client': return '👤'
      case 'support': return '🎧'
      case 'nolex': return '🤖'
      default: return '👤'
    }
  }

  const getParticipantColor = (type: string) => {
    switch (type) {
      case 'client': return 'bg-blue-100 text-blue-600'
      case 'support': return 'bg-green-100 text-green-600'
      case 'nolex': return 'bg-purple-100 text-purple-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const filteredConversations = conversations.filter(c =>
    c.participant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.participant_code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-100px)] flex bg-white rounded-xl shadow-sm overflow-hidden" dir="rtl">
      
      {/* قائمة المحادثات */}
      <div className="w-96 border-l border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4">💬 مركز التواصل</h2>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في المحادثات..."
              className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            />
          </div>
        </div>

        {/* قائمة المحادثات */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <span className="text-4xl mb-2 block">💬</span>
              <p>لا توجد محادثات</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation)}
                className={`p-4 border-b border-gray-100 cursor-pointer transition hover:bg-gray-50 ${
                  selectedConversation?.id === conversation.id ? 'bg-amber-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${getParticipantColor(conversation.participant_type)}`}>
                      {getParticipantIcon(conversation.participant_type)}
                    </div>
                    {conversation.is_online && (
                      <span className="absolute bottom-0 left-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-800 truncate">{conversation.participant_name}</h3>
                      <span className="text-xs text-gray-400">{getTimeAgo(conversation.last_message_time)}</span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{conversation.last_message}</p>
                  </div>
                  {conversation.unread_count > 0 && (
                    <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* منطقة المحادثة */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${getParticipantColor(selectedConversation.participant_type)}`}>
                {getParticipantIcon(selectedConversation.participant_type)}
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">{selectedConversation.participant_name}</h3>
                <p className="text-xs text-gray-500">
                  {selectedConversation.is_online ? (
                    <span className="text-green-600">● متصل الآن</span>
                  ) : (
                    <span>غير متصل</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedConversation.participant_type === 'client' && (
                <>
                  <button className="p-2 hover:bg-gray-200 rounded-lg transition">
                    <Phone className="w-5 h-5 text-gray-600" />
                  </button>
                  <button className="p-2 hover:bg-gray-200 rounded-lg transition">
                    <Video className="w-5 h-5 text-gray-600" />
                  </button>
                </>
              )}
              <button className="p-2 hover:bg-gray-200 rounded-lg transition">
                <MoreVertical className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* الرسائل */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message) => {
              const isMe = message.sender_type === 'lawyer'
              return (
                <div key={message.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    isMe 
                      ? 'bg-amber-500 text-white rounded-br-none' 
                      : 'bg-white text-gray-800 shadow-sm rounded-bl-none'
                  }`}>
                    <p className="text-sm">{message.content}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-amber-100' : 'text-gray-400'}`}>
                      <span className="text-xs">{formatTime(message.created_at)}</span>
                      {isMe && (
                        message.is_read 
                          ? <CheckCheck className="w-4 h-4" />
                          : <Check className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* إرسال رسالة */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                <Paperclip className="w-5 h-5 text-gray-500" />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="اكتب رسالتك..."
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
              <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                <Smile className="w-5 h-5 text-gray-500" />
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className="p-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <span className="text-6xl mb-4 block">💬</span>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">اختر محادثة</h3>
            <p className="text-gray-500">اختر محادثة من القائمة للبدء</p>
          </div>
        </div>
      )}
    </div>
  )
}
