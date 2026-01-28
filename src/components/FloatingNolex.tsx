'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 FloatingNolex - المساعد القانوني العائم
// 📅 تاريخ التحديث: 6 يناير 2026
// 🎯 الغرض: مساعد ذكي يظهر في الوسط بفقاعة اقتباس + محادثة داخلها
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getUserId } from '@/lib/cookies'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  showActions?: boolean
  isEmergency?: boolean
}

interface UserQuota {
  id: string
  searches_used: number
  searches_remaining: number
}

interface UserProfile {
  full_name: string
  gender: string | null
  age_range: string | null
  nationality: string | null
  preferred_language: string | null
  marital_status: string | null
  city: string | null
}

interface ConsultationContext {
  type: 'consultation' | 'case'
  category_name: string
  category_id: string
  subcategory_name?: string
  subcategory_id?: string
  title: string
  description: string
}

export interface FloatingNolexRef {
  openWithGreeting: (context: ConsultationContext) => void
  analyzeRequest: (context: ConsultationContext) => void
  close: () => void
  getConversationLog: () => Message[]
}

interface FloatingNolexProps {
  onSendToLawyer?: (context: ConsultationContext, isEmergency?: boolean, conversationLog?: Message[]) => void
  onResolved?: () => void
}

const FloatingNolex = forwardRef<FloatingNolexRef, FloatingNolexProps>(
  ({ onSendToLawyer, onResolved }, ref) => {
    const router = useRouter()
    
    const [showCenterMode, setShowCenterMode] = useState(false)
    const [showChatInBubble, setShowChatInBubble] = useState(false)
    const [showChatMode, setShowChatMode] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false) // 🔴 جديد: للتكبير/تصغير
    const [bubbleText, setBubbleText] = useState('')
    const [messages, setMessages] = useState<Message[]>([])
    const [inputMessage, setInputMessage] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)
    const [userQuota, setUserQuota] = useState<UserQuota | null>(null)
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
    const [currentContext, setCurrentContext] = useState<ConsultationContext | null>(null)
    const [mode, setMode] = useState<'normal' | 'consultation' | 'emergency'>('normal')
    const [showActions, setShowActions] = useState(false)
    const [isEmergencyMode, setIsEmergencyMode] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const id = getUserId()
      setUserId(id)
      if (id) {
        fetchQuota(id)
        fetchUserProfile(id)
      }
    }, [])

    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const fetchUserProfile = async (uid: string) => {
      const { data } = await supabase
        .from('users')
        .select('full_name, gender, age_range, nationality, preferred_language, marital_status, city')
        .eq('id', uid)
        .single()
      if (data) setUserProfile(data)
    }

    const fetchQuota = async (uid: string) => {
      const { data } = await supabase
        .from('kb_user_quotas')
        .select('*')
        .eq('user_id', uid)
        .eq('status', 'active')
        .single()
      
      if (data) {
        setUserQuota(data)
      } else {
        const { data: freePackage } = await supabase
          .from('kb_quota_packages')
          .select('*')
          .eq('code', 'free')
          .single()
        
        if (freePackage) {
          const { data: newQuota } = await supabase
            .from('kb_user_quotas')
            .insert({
              user_id: uid,
              package_id: freePackage.id,
              searches_remaining: freePackage.searches_limit,
              searches_used: 0,
              period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            })
            .select()
            .single()
          if (newQuota) setUserQuota(newQuota)
        }
      }
    }

    const getPersonalAddress = () => {
      const firstName = userProfile?.full_name?.split(' ')[0] || 'صديقي'
      const genderRaw = (userProfile?.gender || '').toLowerCase()
      const isFemale = genderRaw === 'female' || genderRaw === 'أنثى' || genderRaw === 'انثى' || genderRaw === 'f'
      const ageRange = userProfile?.age_range
      
      let prefix = isFemale ? 'عزيزتي' : 'عزيزي'
      let suffix = isFemale ? 'ي' : ''
      
      if (isFemale && (ageRange === '46-55' || ageRange === '55+')) prefix = 'أختي الكريمة'
      if (!isFemale && (ageRange === '46-55' || ageRange === '55+')) prefix = 'أخي الكريم'
      
      return { firstName, prefix, suffix, gender: isFemale ? 'female' : 'male', ageRange }
    }

    const getTimeGreeting = () => {
      const hour = new Date().getHours()
      if (hour >= 5 && hour < 12) return 'صباح الخير'
      if (hour >= 12 && hour < 17) return 'مساء الخير'
      if (hour >= 17 && hour < 21) return 'مساء النور'
      return 'أهلاً'
    }

    useImperativeHandle(ref, () => ({
      openWithGreeting: (context: ConsultationContext) => {
        setCurrentContext(context)
        setMode('consultation')
        
        const { firstName, prefix, suffix } = getPersonalAddress()
        const typeText = context.type === 'consultation' ? 'استشارة' : 'قضية'
        
        setBubbleText(`${getTimeGreeting()} ${prefix} ${firstName}! 👋

لاحظت أنك${suffix} تريد${suffix === 'ي' ? 'ين' : ''} ${typeText} في "${context.category_name}".

هل أستطيع مساعدتك${suffix} قبل أن تستهلك${suffix === 'ي' ? 'ي' : ''} رصيدك${suffix}؟ 😊`)
        
        setShowCenterMode(true)
        setShowChatMode(false)
        setShowChatInBubble(false)
        setShowActions(false)
        setIsEmergencyMode(false)
      },

      analyzeRequest: async (context: ConsultationContext) => {
        setCurrentContext(context)
        setShowCenterMode(true)
        setShowChatMode(false)
        setShowChatInBubble(false)
        
        const { firstName, suffix } = getPersonalAddress()
        
        setBubbleText('جاري تحليل طلبك... ⏳')
        setShowActions(false)

        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: context.description,
              mode: 'consultation_analysis',
              context: {
                category: context.category_name,
                subcategory: context.subcategory_name,
                title: context.title,
                userProfile: userProfile
              }
            })
          })
          
          const data = await response.json()
          
          if (data.isEmergency) {
            setMode('emergency')
            setIsEmergencyMode(true)
            setBubbleText(data.answer)
            setShowActions(true)
          } else {
            setMode('consultation')
            setIsEmergencyMode(false)
            setBubbleText(data.answer + `

───────────────

${firstName}، هل كانت إجابتي مفيدة لك${suffix}؟ 🤔`)
            setShowActions(true)
          }

          setMessages([
            { id: Date.now().toString(), role: 'user', content: context.description },
            { id: (Date.now() + 1).toString(), role: 'assistant', content: data.answer, isEmergency: data.isEmergency }
          ])

          if (!data.isOutOfScope && !data.isEmergency && userQuota) {
            await supabase.from('kb_user_quotas').update({
              searches_used: userQuota.searches_used + 1,
              searches_remaining: userQuota.searches_remaining - 1
            }).eq('id', userQuota.id)
            setUserQuota({ ...userQuota, searches_used: userQuota.searches_used + 1, searches_remaining: userQuota.searches_remaining - 1 })
          }
        } catch (error) {
          toast.error('حدث خطأ، حاول مرة أخرى')
          setBubbleText('عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.')
        }
      },

      close: () => {
        setShowCenterMode(false)
        setShowChatMode(false)
        setShowChatInBubble(false)
        setMode('normal')
        setCurrentContext(null)
        setMessages([])
      },
      
      getConversationLog: () => messages
    }))

    const handleSatisfied = () => {
      const { firstName, suffix } = getPersonalAddress()
      setBubbleText(`رائع ${firstName}! 🎉\n\nسعيد${suffix === 'ي' ? 'ة' : ''} أنني استطعت مساعدتك${suffix}!\nرصيدك محفوظ ✅\n\nأنا هنا دائماً لمساعدتك${suffix}. 💚`)
      setShowActions(false)
      setMode('normal')
      setCurrentContext(null)
      setTimeout(() => { setShowCenterMode(false); if (onResolved) onResolved() }, 3000)
    }

    const handleSendToLawyer = () => {
      if (currentContext && onSendToLawyer) {
        const { firstName, suffix } = getPersonalAddress()
        setBubbleText(`حسناً ${firstName}، سأحول طلبك${suffix} لمحامي متخصص الآن 👨‍⚖️\n\nسيتواصل معك${suffix} قريباً.\nشكراً لثقتك${suffix} بنا! 💚`)
        setShowActions(false)
        onSendToLawyer(currentContext, false, messages)
        setTimeout(() => { setShowCenterMode(false); setMode('normal'); setCurrentContext(null) }, 2000)
      }
    }

    const handleEmergencyConfirm = () => {
      if (currentContext && onSendToLawyer) {
        const { firstName, suffix } = getPersonalAddress()
        setBubbleText(`💚 ${firstName}، تم تحويل طلبك${suffix} كحالة طارئة.\n\nسيتواصل معك${suffix} محامي في أقرب وقت.\n\n⭐ لم يتم خصم أي رصيد.\n\n📞 إذا كنت${suffix} في خطر، اتصل${suffix === 'ي' ? 'ي' : ''} بـ 911\n\nأنا معك${suffix}. 💚`)
        setShowActions(false)
        onSendToLawyer(currentContext, true, messages)
        setTimeout(() => { setShowCenterMode(false); setMode('normal') }, 4000)
      }
    }

    const handleEmergencyDecline = () => {
      const { firstName, suffix } = getPersonalAddress()
      setBubbleText(`حسناً ${firstName}، لن أحول الطلب الآن.\n\nإذا احتجت${suffix === 'ي' ? 'ي' : ''} مساعدة:\n📞 الشرطة: 911\n📞 خط الحماية: 1919\n\nأنا هنا إذا احتجتني. 💚`)
      setShowActions(false)
      setIsEmergencyMode(false)
      setMode('consultation')
    }

    const openChatInBubble = () => {
      setShowChatInBubble(true)
      if (messages.length === 0) {
        const { firstName, prefix, suffix } = getPersonalAddress()
        setMessages([{ id: Date.now().toString(), role: 'assistant', content: `${getTimeGreeting()} ${prefix} ${firstName}! 👋\n\nكيف أقدر أساعدك${suffix} اليوم؟` }])
      }
    }

    const goToNolexPage = () => {
      setShowCenterMode(false)
      router.push('/subscriber/nolex')
    }

    const openFullChat = () => {
      setShowCenterMode(false)
      setShowChatMode(true)
      if (messages.length === 0) {
        const { firstName, prefix, suffix } = getPersonalAddress()
        setMessages([{ id: Date.now().toString(), role: 'assistant', content: `${getTimeGreeting()} ${prefix} ${firstName}! 👋\n\nكيف أقدر أساعدك${suffix} اليوم؟` }])
      }
    }

    const sendMessage = async () => {
      if (!inputMessage.trim() || isSending) return
      if (!userQuota || userQuota.searches_remaining <= 0) { toast.error('انتهى رصيد البحث!'); return }

      const text = inputMessage.trim()
      setInputMessage('')
      setIsSending(true)
      
      const newUserMessage = { id: Date.now().toString(), role: 'user' as const, content: text }
      const updatedMessages = [...messages, newUserMessage]
      setMessages(updatedMessages)

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            question: text,
            mode,
            context: { userProfile },
            // 🔴 إرسال تاريخ المحادثة كاملاً
            conversationHistory: updatedMessages.map(m => ({ role: m.role, content: m.content }))
          })
        })
        const data = await response.json()
        
        const assistantMessage = { id: (Date.now() + 1).toString(), role: 'assistant' as const, content: data.answer }
        setMessages(prev => [...prev, assistantMessage])
        
        // 🔴 إذا طلب محامي، أظهر زر التحويل
        if (data.wantsLawyer) {
          setShowActions(true)
        }

        if (!data.isOutOfScope && userQuota) {
          await supabase.from('kb_user_quotas').update({
            searches_used: userQuota.searches_used + 1,
            searches_remaining: userQuota.searches_remaining - 1
          }).eq('id', userQuota.id)
          setUserQuota({ ...userQuota, searches_used: userQuota.searches_used + 1, searches_remaining: userQuota.searches_remaining - 1 })
        }
      } catch (error) {
        toast.error('حدث خطأ')
      } finally {
        setIsSending(false)
      }
    }

    if (!userId) return null

    return (
      <>
        {/* ════════════════════════════════════════════════════════════════════
            الوضع المركزي - فقاعة اقتباس في وسط الشاشة
        ════════════════════════════════════════════════════════════════════ */}
        {showCenterMode && (
          <>
            <div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" onClick={() => setShowCenterMode(false)} />
            
            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
              <div className="pointer-events-auto flex items-end gap-4 max-w-3xl mx-4">
                
                {/* صورة NOLEX */}
                <div className="flex-shrink-0">
                  <div className={`rounded-full overflow-hidden border-4 shadow-2xl ${isEmergencyMode ? 'border-red-400 animate-pulse' : 'border-primary-400'}`} style={{ width: '120px', height: '120px' }}>
                    <Image src="/nolex-avatar.jpg" alt="NOLEX" width={120} height={120} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-center text-white font-bold mt-2 text-lg drop-shadow-lg">NOLEX</p>
                </div>

                {/* فقاعة الاقتباس أو صندوق المحادثة */}
                <div className={`relative bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${isEmergencyMode ? 'border-4 border-red-400' : ''} ${showChatInBubble ? (isExpanded ? 'w-[700px] h-[600px]' : 'w-[450px] h-[500px]') + ' flex flex-col' : 'p-6 max-w-lg'}`}>
                  
                  {/* السهم */}
                  <div className="absolute -left-4 bottom-8 w-0 h-0 border-t-[15px] border-t-transparent border-r-[20px] border-r-white border-b-[15px] border-b-transparent"></div>
                  
                  {/* وضع الفقاعة العادي */}
                  {!showChatInBubble && (
                    <>
                      <p className="text-gray-800 text-lg leading-relaxed whitespace-pre-line">{bubbleText}</p>
                      
                      {showActions && (
                        <div className="mt-6 pt-4 border-t border-gray-100">
                          {isEmergencyMode ? (
                            <div className="space-y-3">
                              <p className="text-sm text-red-600 font-medium">هل تريد تحويل طلبك كحالة طارئة؟</p>
                              <p className="text-xs text-red-500">⭐ لن يتم خصم أي رصيد</p>
                              <div className="flex gap-3">
                                <button onClick={handleEmergencyConfirm} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium">✓ نعم، حوّل الطلب</button>
                                <button onClick={handleEmergencyDecline} className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300">ليس الآن</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-3">
                              <button onClick={handleSatisfied} className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 font-medium flex items-center justify-center gap-2"><span>✓</span> نعم، شكراً</button>
                              <button onClick={handleSendToLawyer} className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-medium flex items-center justify-center gap-2"><span>👨‍⚖️</span> أريد محامي</button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {!showActions && !isEmergencyMode && (
                        <div className="mt-4 flex gap-3">
                          <button onClick={openChatInBubble} className="text-primary-600 text-sm hover:underline flex items-center gap-1">💬 تحدث معي هنا</button>
                          <span className="text-gray-300">|</span>
                          <button onClick={goToNolexPage} className="text-primary-600 text-sm hover:underline flex items-center gap-1">🔗 افتح صفحة NOLEX</button>
                        </div>
                      )}
                    </>
                  )}

                  {/* وضع المحادثة داخل الفقاعة */}
                  {showChatInBubble && (
                    <>
                      <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-3 flex items-center justify-between">
                        <span className="font-bold">💬 محادثة مع NOLEX</span>
                        <div className="flex items-center gap-2">
                          {userQuota && <span className="bg-white/20 text-xs px-2 py-1 rounded-full">{userQuota.searches_remaining} 🔍</span>}
                          {/* زر التكبير/التصغير */}
                          <button 
                            onClick={() => setIsExpanded(!isExpanded)} 
                            className="text-white/70 hover:text-white p-1"
                            title={isExpanded ? 'تصغير' : 'تكبير'}
                          >
                            {isExpanded ? '⊖' : '⊕'}
                          </button>
                          <button onClick={() => setShowChatInBubble(false)} className="text-white/70 hover:text-white">←</button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                        {messages.map((msg) => (
                          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-white border shadow-sm rounded-tl-sm'}`}>
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            </div>
                          </div>
                        ))}
                        {isSending && (
                          <div className="flex justify-end">
                            <div className="bg-white border p-3 rounded-2xl shadow-sm">
                              <div className="flex gap-1">
                                <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                                <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      <div className="p-3 border-t bg-white">
                        {/* زر أريد محامي - يظهر عند طلب المستخدم */}
                        {showActions && currentContext && (
                          <button
                            onClick={handleSendToLawyer}
                            className="w-full mb-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-medium flex items-center justify-center gap-2"
                          >
                            <span>👨‍⚖️</span> تحويل لمحامي متخصص
                          </button>
                        )}
                        <div className="flex gap-2">
                          <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="اكتب سؤالك..." className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500" disabled={isSending} autoFocus />
                          <button onClick={sendMessage} disabled={isSending || !inputMessage.trim()} className="bg-primary-600 text-white px-5 py-2.5 rounded-xl hover:bg-primary-700 disabled:opacity-50">↑</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* الزر العائم في الزاوية */}
        {!showCenterMode && (
          <>
            <button onClick={() => showChatMode ? setShowChatMode(false) : openFullChat()} className={`fixed bottom-6 left-6 z-40 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 overflow-hidden w-16 h-16 ${showChatMode ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-white border-2 border-primary-500'}`}>
              {showChatMode ? <span className="text-2xl text-white">✕</span> : <Image src="/nolex-avatar.jpg" alt="NOLEX" width={64} height={64} className="w-full h-full object-cover" />}
            </button>
            {!showChatMode && <div className="fixed bottom-24 left-6 z-40 bg-primary-600 text-white text-sm px-3 py-1.5 rounded-full shadow-lg animate-bounce">اسألني! 💬</div>}
          </>
        )}

        {/* صندوق المحادثة الكامل (الزاوية) */}
        {showChatMode && !showCenterMode && (
          <div className={`fixed bottom-24 left-6 z-40 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border-2 border-primary-100 transition-all duration-300 ${isExpanded ? 'w-[600px] h-[700px]' : 'w-96 h-[500px]'}`}>
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30">
                  <Image src="/nolex-avatar.jpg" alt="NOLEX" width={40} height={40} className="w-full h-full object-cover" />
                </div>
                <div><h3 className="font-bold">NOLEX</h3><p className="text-xs opacity-80">المساعد القانوني الذكي</p></div>
                {userQuota && <span className="mr-auto bg-white/20 text-xs px-2 py-1 rounded-full">{userQuota.searches_remaining} 🔍</span>}
                {/* زر التكبير/التصغير */}
                <button 
                  onClick={() => setIsExpanded(!isExpanded)} 
                  className="text-white/70 hover:text-white p-1 text-lg"
                  title={isExpanded ? 'تصغير' : 'تكبير'}
                >
                  {isExpanded ? '⊖' : '⊕'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-white border shadow-sm rounded-tl-sm'}`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex justify-end">
                  <div className="bg-white border p-3 rounded-2xl shadow-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                      <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t bg-white">
              {/* زر أريد محامي */}
              {showActions && (
                <button
                  onClick={() => {
                    const { firstName, suffix } = getPersonalAddress()
                    toast.success(`سيتم تحويلك${suffix} لمحامي متخصص`)
                    router.push('/subscriber/requests/new')
                  }}
                  className="w-full mb-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-medium flex items-center justify-center gap-2"
                >
                  <span>👨‍⚖️</span> تحويل لمحامي متخصص
                </button>
              )}
              <div className="flex gap-2">
                <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="اكتب سؤالك..." className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500" disabled={isSending} />
                <button onClick={sendMessage} disabled={isSending || !inputMessage.trim()} className="bg-primary-600 text-white px-5 py-2.5 rounded-xl hover:bg-primary-700 disabled:opacity-50">↑</button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }
)

FloatingNolex.displayName = 'FloatingNolex'
export default FloatingNolex
