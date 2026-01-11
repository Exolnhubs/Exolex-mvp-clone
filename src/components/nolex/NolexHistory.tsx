'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Conversation {
  id: string
  title: string
  is_archived: boolean
  created_at: string
  updated_at: string
}

interface NolexHistoryProps {
  userId: string
  currentConversationId: string | null
  onSelectConversation: (conv: Conversation) => void
  onNewConversation: () => void
}

export default function NolexHistory({ 
  userId, 
  currentConversationId,
  onSelectConversation, 
  onNewConversation 
}: NolexHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchConversations()
  }, [userId])

  const fetchConversations = async () => {
    const { data } = await supabase
      .from('nolex_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (data) setConversations(data)
    setIsLoading(false)
  }

  const toggleArchive = async (id: string, currentStatus: boolean) => {
    await supabase
      .from('nolex_conversations')
      .update({ is_archived: !currentStatus })
      .eq('id', id)
    fetchConversations()
  }

  const deleteConversation = async (id: string) => {
    if (!confirm('حذف المحادثة؟')) return
    await supabase.from('nolex_conversations').delete().eq('id', id)
    fetchConversations()
  }

  const renameConversation = async (id: string) => {
    const newTitle = prompt('عنوان جديد:')
    if (!newTitle) return
    await supabase
      .from('nolex_conversations')
      .update({ title: newTitle })
      .eq('id', id)
    fetchConversations()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'اليوم'
    if (days === 1) return 'أمس'
    if (days < 7) return `منذ ${days} أيام`
    return date.toLocaleDateString('ar-SA')
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('ar-SA', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const groupedConversations = conversations.reduce((groups: { [key: string]: Conversation[] }, conv) => {
    const date = formatDate(conv.updated_at)
    if (!groups[date]) groups[date] = []
    groups[date].push(conv)
    return groups
  }, {})

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <span>💬</span>
          <span>المحادثات</span>
        </h3>
      </div>

      {/* زر محادثة جديدة */}
      <div className="p-3 border-b border-slate-700">
        <button
          onClick={onNewConversation}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <span>➕</span>
          <span>محادثة جديدة</span>
        </button>
      </div>

      {/* قائمة المحادثات */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-slate-400">
            <span className="text-3xl block mb-2">💭</span>
            <p className="text-sm">لا توجد محادثات سابقة</p>
            <p className="text-xs mt-1">ابدأ محادثة جديدة مع NOLEX</p>
          </div>
        ) : (
          <div className="p-2">
            {Object.entries(groupedConversations).map(([date, convs]) => (
              <div key={date} className="mb-4">
                <p className="text-xs text-slate-500 px-2 mb-2 flex items-center gap-1">
                  <span>🕐</span>
                  <span>{date}</span>
                </p>
                {convs.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group relative p-3 rounded-lg cursor-pointer mb-1 transition-all border-r-2 ${
                      currentConversationId === conv.id
                        ? 'bg-primary-600/30 border-primary-500'
                        : 'hover:bg-slate-700/50 border-transparent hover:border-slate-500'
                    }`}
                    onClick={() => onSelectConversation(conv)}
                  >
                    <p className="text-sm text-slate-200 line-clamp-1 pl-16">
                      {conv.title || 'محادثة بدون عنوان'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span>{formatTime(conv.updated_at)}</span>
                      {conv.is_archived && <span>📌</span>}
                    </p>
                    
                    {/* أزرار التحكم */}
                    <div className="absolute left-2 top-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); renameConversation(conv.id) }}
                        className="p-1 rounded hover:bg-slate-600 text-xs"
                        title="إعادة تسمية"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleArchive(conv.id, conv.is_archived) }}
                        className="p-1 rounded hover:bg-slate-600 text-xs"
                        title={conv.is_archived ? 'إلغاء الحفظ' : 'حفظ'}
                      >
                        {conv.is_archived ? '📌' : '📍'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id) }}
                        className="p-1 rounded hover:bg-red-600 text-xs"
                        title="حذف"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-700 text-xs text-slate-500 text-center">
        ⏱️ تُحذف المحادثات غير المحفوظة بعد 30 يوم
      </div>
    </div>
  )
}
