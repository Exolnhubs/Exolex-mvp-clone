'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 صفحة NOLEX - المساعد القانوني الذكي
// 📅 تاريخ التحديث: 6 يناير 2026
// 🎯 التحديث: إضافة صندوق محادثة أسفل البنر
// 📁 المسار: src/app/subscriber/nolex/page.tsx
// ═══════════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logoutMember } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import Image from 'next/image'
import toast from 'react-hot-toast'

interface User {
  id: string
  full_name: string
  gender?: string
  nationality?: string
}

interface QuotaPackage {
  id: string
  name: string
  code: string
  searches_limit: number
  price: number
  description: string
}

interface UserQuota {
  id: string
  searches_used: number
  searches_remaining: number
}

// 🔴 جديد: نوع الرسالة
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export default function NolexPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [packages, setPackages] = useState<QuotaPackage[]>([])
  const [userQuota, setUserQuota] = useState<UserQuota | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)

  // 🔴 جديد: states للمحادثة
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const userId = localStorage.getItem('exolex_user_id')
    if (!userId) { router.push('/auth/login'); return }

    const fetchData = async () => {
      const { data: userData } = await supabase
        .from('users').select('id, full_name, gender, nationality').eq('id', userId).single()
      if (userData) setUser(userData)

      const { data: memberData } = await supabase.from('members').select('id').eq('user_id', userId).single()

      const { data: subData } = await supabase
        .from('subscriptions').select('id')
        .eq('member_id', memberData?.id).eq('status', 'active').single()
      if (subData) setIsSubscribed(true)

      const { data: packagesData } = await supabase
        .from('kb_quota_packages')
        .select('*')
        .eq('is_active', true)
        .gt('price', 0)
        .order('price', { ascending: true })
      if (packagesData) setPackages(packagesData)

      // أولاً: جلب من kb_user_quotas (للمشتركين بباقات بحث)
      const { data: quotaData } = await supabase
        .from('kb_user_quotas')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
      
      if (quotaData) {
        setUserQuota(quotaData)
      } else {
        // Fallback: جلب من members (للمستخدمين المجانيين)
        const { data: memberData } = await supabase
          .from('members')
          .select('id, free_searches_remaining')
          .eq('user_id', userId)
          .single()
        
        if (memberData) {
          setUserQuota({
            id: memberData.id,
            searches_used: 10 - (memberData.free_searches_remaining || 0),
            searches_remaining: memberData.free_searches_remaining || 0
          })
        }
      }

      setIsLoading(false)
    }
    fetchData()
  }, [router])

  // 🔴 جديد: scroll للرسائل الجديدة
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleLogout = () => {
    logoutMember()
  }

  const purchasePackage = async (pkg: QuotaPackage) => {
    if (!user) return
    setPurchasing(pkg.id)
    toast('سيتم ربط الدفع قريباً', { icon: '🔜' })
    setPurchasing(null)
  }

  const openNolexChat = () => {
    const buttons = document.querySelectorAll('button')
    buttons.forEach(btn => {
      if (btn.querySelector('img[alt="NOLEX"]')) {
        btn.click()
      }
    })
  }

  // 🔴 جديد: دوال المساعدة للمحادثة
  const getTimeGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'صباح الخير'
    return 'مساء الخير'
  }

  const getPersonalAddress = () => {
    const genderRaw = (user?.gender || '').toLowerCase()
    const isFemale = genderRaw === 'female' || genderRaw === 'أنثى' || genderRaw === 'انثى' || genderRaw === 'f'
    const firstName = user?.full_name?.split(' ')[0] || 'صديقي'
    return { firstName, prefix: isFemale ? 'عزيزتي' : 'عزيزي', suffix: isFemale ? 'ي' : '' }
  }

  // 🔴 جديد: بدء المحادثة
  const startChat = () => {
    if (messages.length === 0) {
      const { firstName, prefix, suffix } = getPersonalAddress()
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: `${getTimeGreeting()} ${prefix} ${firstName}! 👋\n\nأنا NOLEX، مساعدك القانوني الذكي.\n\nكيف أقدر أساعدك${suffix} اليوم؟`
      }])
    }
  }

  // 🔴 جديد: إرسال رسالة
  const sendMessage = async () => {
    if (!inputMessage.trim() || isSending) return
    if (!userQuota || userQuota.searches_remaining <= 0) {
      toast.error('انتهى رصيد البحث!')
      return
    }

    const text = inputMessage.trim()
    setInputMessage('')
    setIsSending(true)

    const newUserMessage: Message = { id: Date.now().toString(), role: 'user', content: text }
    const updatedMessages = [...messages, newUserMessage]
    setMessages(updatedMessages)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          mode: 'consultation',
          context: { userProfile: user },
          conversationHistory: updatedMessages.map(m => ({ role: m.role, content: m.content }))
        })
      })
      const data = await response.json()

      const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.answer }
      setMessages(prev => [...prev, assistantMessage])

      // خصم من الرصيد
      if (!data.isOutOfScope && userQuota) {
        await supabase.from('kb_user_quotas').update({
          searches_used: userQuota.searches_used + 1,
          searches_remaining: userQuota.searches_remaining - 1
        }).eq('id', userQuota.id)
        setUserQuota({ ...userQuota, searches_used: userQuota.searches_used + 1, searches_remaining: userQuota.searches_remaining - 1 })
      }
    } catch (error) {
      toast.error('حدث خطأ في الإرسال')
    } finally {
      setIsSending(false)
    }
  }

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

      <main className="flex-1 mr-64 overflow-y-auto">
        
        {/* Hero Section */}
        <section className="relative bg-gradient-to-bl from-blue-500 to-blue-700 text-white pt-8 pb-20 overflow-hidden">
          {/* شعار ExoLex */}
          <div className="absolute top-4 right-4">
            <Image
              src="/exolex-logo.png"
              alt="ExoLex"
              width={120}
              height={40}
              className="opacity-90"
            />
          </div>

          <div className="container mx-auto text-center relative z-10 px-4 pt-8">
            {/* صورة نولكس */}
            <div className="flex justify-center mb-6">
              <div className="w-48 h-48 bg-white/20 rounded-full p-2 backdrop-blur-sm">
                <Image
                  src="/nolex-avatar.jpg"
                  alt="NOLEX"
                  width={192}
                  height={192}
                  className="w-full h-full object-cover rounded-full"
                  priority
                />
              </div>
            </div>
            
            <h1 className="text-7xl font-extrabold tracking-tight">NOLEX</h1>
            <p className="mt-2 text-2xl text-blue-200">New-Level Online Legal Experience</p>
            
            {/* شرح الاسم - من اليمين لليسار */}
            <div className="mt-12 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* LEX - أول من اليمين */}
              <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm border border-white/20 text-right">
                <h3 className="text-3xl font-bold mb-2" dir="ltr">
                  <span className="text-white">LEX</span>
                  <span className="text-blue-300 text-xl mr-2">| Legal Experience</span>
                </h3>
                <p className="text-blue-100 text-sm leading-relaxed">ليست معلومة فقط، بل رحلة قانونية متكاملة: إرشاد فوري، إجراءات صحيحة، ومتابعة شفافة.</p>
              </div>
              {/* O - الثاني في الوسط */}
              <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm border border-white/20 text-right">
                <h3 className="text-3xl font-bold mb-2" dir="ltr">
                  <span className="text-white">O</span>
                  <span className="text-blue-300 text-xl mr-2">| Online</span>
                </h3>
                <p className="text-blue-100 text-sm leading-relaxed">كل شيء رقميًا وبشكل آمن؛ من السؤال الأول حتى التصعيد لمحامٍ مرخّص.</p>
              </div>
              {/* N - الثالث على اليسار */}
              <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm border border-white/20 text-right">
                <h3 className="text-3xl font-bold mb-2" dir="ltr">
                  <span className="text-white">N</span>
                  <span className="text-blue-300 text-xl mr-2">| New-Level</span>
                </h3>
                <p className="text-blue-100 text-sm leading-relaxed">مستوى جديد بالكامل من خدمة القانون—أسرع، أوضح، وأقرب للمستخدم.</p>
              </div>
            </div>

            <p className="mt-12 max-w-4xl mx-auto text-lg text-blue-100 leading-relaxed">
              Nolex يقدّم تجربة قانونية رقمية بمستوى جديد: إجابة فورية متعددة اللغات، ثم تصعيد منظم إلى محامين مرخّصين—بأسعار واضحة ووقت محدد.
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            🔴 جديد: صندوق المحادثة مع NOLEX
        ════════════════════════════════════════════════════════════════════ */}
        <section className="py-12 bg-gradient-to-b from-blue-700 to-gray-50">
          <div className="container mx-auto px-4">
            <div className={`mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'max-w-5xl' : 'max-w-3xl'}`}>
              
              {/* هيدر صندوق المحادثة */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/30">
                    <Image src="/nolex-avatar.jpg" alt="NOLEX" width={48} height={48} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">تحدث مع NOLEX</h3>
                    <p className="text-xs text-blue-200">المساعد القانوني الذكي • متاح 24/7</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* رصيد البحث */}
                  <div className="bg-white/20 px-3 py-1.5 rounded-full text-sm">
                    <span className="font-bold">{userQuota?.searches_remaining || 0}</span> بحث متبقي
                  </div>
                  {/* زر التكبير/التصغير */}
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    title={isExpanded ? 'تصغير' : 'تكبير'}
                  >
                    {isExpanded ? '⊖' : '⊕'}
                  </button>
                </div>
              </div>

              {/* منطقة الرسائل */}
              <div className={`overflow-y-auto p-6 bg-gray-50 transition-all duration-300 ${isExpanded ? 'h-[500px]' : 'h-[350px]'}`}>
                {messages.length === 0 ? (
                  // شاشة الترحيب
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-24 h-24 rounded-full overflow-hidden mb-4 shadow-lg">
                      <Image src="/nolex-avatar.jpg" alt="NOLEX" width={96} height={96} className="w-full h-full object-cover" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">مرحباً بك في محادثة NOLEX!</h3>
                    <p className="text-gray-500 mb-6 max-w-md">
                      اسألني أي سؤال قانوني وسأساعدك بالإجابة الفورية المدعومة بالمواد النظامية
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {['ما هي حقوقي كعامل؟', 'كيف أرفع قضية؟', 'استشارة عائلية'].map((q, i) => (
                        <button
                          key={i}
                          onClick={() => { startChat(); setInputMessage(q) }}
                          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  // الرسائل
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-white border border-gray-200 shadow-sm rounded-tl-sm'
                        }`}>
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    {isSending && (
                      <div className="flex justify-end">
                        <div className="bg-white border p-4 rounded-2xl shadow-sm">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* حقل الإدخال */}
              <div className="p-4 border-t bg-white">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter') { if (messages.length === 0) startChat(); sendMessage() } }}
                    onFocus={() => { if (messages.length === 0) startChat() }}
                    placeholder="اكتب سؤالك القانوني هنا..."
                    className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    disabled={isSending}
                  />
                  <button
                    onClick={() => { if (messages.length === 0) startChat(); sendMessage() }}
                    disabled={isSending || !inputMessage.trim()}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                  >
                    <span>إرسال</span>
                    <span>↑</span>
                  </button>
                </div>
                {userQuota && userQuota.searches_remaining <= 5 && (
                  <p className="text-xs text-orange-600 mt-2 text-center">
                    ⚠️ رصيدك منخفض ({userQuota.searches_remaining} بحث متبقي) - <a href="#pricing" className="underline">اشترِ المزيد</a>
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Value Proposition Section */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-center mb-12">القيمة التي يَعِد بها NOLEX</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-8 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300 text-white">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-white/20 mb-6">
                  <span className="text-3xl">✓</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">وضوح</h3>
                <p className="text-blue-100">إجابات مدعومة بالمادة النظامية وروابط رسمية.</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-8 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300 text-white">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-white/20 mb-6">
                  <span className="text-3xl">⚡</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">سرعة</h3>
                <p className="text-green-100">من ثوانٍ للإرشاد، وساعات محددة للردود البشرية (SLA).</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-8 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300 text-white">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-white/20 mb-6">
                  <span className="text-3xl">🔒</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">أمان</h3>
                <p className="text-purple-100">إخفاء الهوية افتراضيًا وحماية بيانات وفق PDPL.</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-8 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300 text-white">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-white/20 mb-6">
                  <span className="text-3xl">🎯</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">كفاءة</h3>
                <p className="text-orange-100">نُقلّل الحاجة للتصعيد، ونُصعّد فقط عند الضرورة—بأقل تكلفة.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Why Experience Section */}
        <section className="py-16 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto bg-white rounded-2xl p-8 shadow-lg border-r-4 border-blue-500">
              <h3 className="text-2xl font-bold mb-4 text-blue-800">💡 لماذا "تجربة" لا "خدمة"؟</h3>
              <p className="text-gray-700 text-lg leading-relaxed">
                لأن Nolex لا يقدّم ردًا عابرًا؛ بل يمسك بيد المستخدم عبر خطوات واضحة من السؤال حتى الحل، 
                مع خيارات (نصي/صوت/فيديو) وتمثيل قانوني عند الحاجة.
              </p>
            </div>
          </div>
        </section>

        {/* Capabilities Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-center mb-12">✨ قدرات NOLEX</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {[
                { icon: '🌍', title: 'يفهم +9 لغات', color: 'from-blue-400 to-blue-500' },
                { icon: '📄', title: 'تحليل المستندات', color: 'from-green-400 to-green-500' },
                { icon: '⚖️', title: 'تقييم القضايا', color: 'from-purple-400 to-purple-500' },
                { icon: '💡', title: 'اقتراح الحلول', color: 'from-yellow-400 to-yellow-500' },
                { icon: '⚡', title: 'رد سريع (3-5 ثوانٍ)', color: 'from-red-400 to-red-500' },
                { icon: '📚', title: 'المصادر القانونية', color: 'from-indigo-400 to-indigo-500' },
                { icon: '🔒', title: 'خصوصية تامة', color: 'from-gray-500 to-gray-600' },
                { icon: '💾', title: 'حفظ تلقائي', color: 'from-teal-400 to-teal-500' },
              ].map((item, i) => (
                <div key={i} className={`bg-gradient-to-br ${item.color} p-6 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-center text-white`}>
                  <span className="text-4xl block mb-3">{item.icon}</span>
                  <p className="font-bold">{item.title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Escalation Section */}
        <section className="py-24 bg-gradient-to-br from-amber-50 to-orange-50">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-center mb-12 text-amber-800">⚠️ متى يحوّلك NOLEX للمحامي؟</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5 text-center">
              {[
                { text: 'طلب مباشر من المستخدم', color: 'from-amber-400 to-amber-500' },
                { text: 'حاجة لرأي قانوني ملزم', color: 'from-orange-400 to-orange-500' },
                { text: 'قضية معقدة تتطلب خبرة بشرية', color: 'from-red-400 to-red-500' },
                { text: 'الحاجة لتمثيل قانوني رسمي', color: 'from-rose-400 to-rose-500' },
                { text: 'تحليل مستندات حساسة', color: 'from-pink-400 to-pink-500' },
              ].map((item, i) => (
                <div key={i} className={`bg-gradient-to-br ${item.color} p-6 rounded-xl shadow-lg text-white`}>
                  <p className="font-semibold">{item.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center bg-gradient-to-r from-green-500 to-emerald-500 text-white p-6 rounded-xl max-w-2xl mx-auto shadow-lg">
              <p className="font-bold text-xl">🎉 خبر سار: 40-80% من الاستفسارات يتم حلها فورياً بواسطة NOLEX!</p>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-center mb-4">💎 أسعار مرنة وواضحة</h2>
            <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">اختر الباقة التي تناسب احتياجاتك. كلما زادت الباقة، قلّت تكلفة البحث الواحد.</p>
            
            {/* Free tier + Balance */}
            <div className="flex flex-col md:flex-row justify-center items-center gap-8 mb-12">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-6 rounded-2xl text-center md:text-right w-full md:w-auto shadow-lg">
                <h3 className="font-bold text-xl mb-2">🎁 عند تسجيلك تُمنح 10 بحث مجاناً!</h3>
                <p className="text-green-100">في حال انتهت، يمكنك شراء إحدى الباقات التالية حسب احتياجك.</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-lg text-center border-2 border-blue-200">
                <p className="text-gray-500">رصيدك الحالي</p>
                <p className="text-4xl font-bold text-blue-500">{userQuota?.searches_remaining || 0} <span className="text-lg">بحث</span></p>
              </div>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {packages.map((pkg, index) => (
                <div 
                  key={pkg.id} 
                  className={`bg-white border-2 p-8 rounded-2xl shadow-lg text-center transform hover:scale-105 transition-all duration-300 relative ${
                    index === 1 ? 'border-blue-500 ring-4 ring-blue-100' : 'border-gray-200 hover:border-blue-500'
                  }`}
                >
                  {index === 1 && (
                    <span className="absolute top-0 -mt-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-sm font-bold px-4 py-1 rounded-full shadow">
                      الأكثر شيوعًا ⭐
                    </span>
                  )}
                  <h3 className="text-2xl font-bold text-gray-800">{pkg.name}</h3>
                  <p className="text-gray-500 mb-4">{pkg.searches_limit} عملية بحث</p>
                  <p className="text-5xl font-extrabold text-blue-600 my-4">
                    {pkg.price}<span className="text-lg font-medium text-gray-500"> ر.س</span>
                  </p>
                  <p className="text-gray-600 mb-6 bg-gray-100 rounded-lg py-2">{(pkg.price / pkg.searches_limit).toFixed(1)} ر.س / بحث</p>
                  <button
                    onClick={() => purchasePackage(pkg)}
                    disabled={purchasing === pkg.id}
                    className={`w-full font-bold py-3 px-6 rounded-full transition-colors disabled:opacity-50 ${
                      index === 1 
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700' 
                        : 'bg-gray-100 text-gray-700 hover:bg-blue-500 hover:text-white'
                    }`}
                  >
                    {purchasing === pkg.id ? '...' : 'شراء الآن'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <footer className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
          <div className="container mx-auto px-4 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-32 h-32 bg-white/20 rounded-full p-2 backdrop-blur-sm">
                <Image
                  src="/nolex-avatar.jpg"
                  alt="NOLEX"
                  width={128}
                  height={128}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-4">جاهز للبدء؟</h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              اضغط على الزر أدناه أو على أيقونة NOLEX في أسفل الشاشة لبدء محادثتك
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="bg-white text-blue-600 font-bold py-4 px-10 rounded-full shadow-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 inline-flex items-center gap-3"
            >
              <Image
                src="/nolex-avatar.jpg"
                alt="NOLEX"
                width={32}
                height={32}
                className="rounded-full"
              />
              <span>ابدأ محادثة مع NOLEX الآن</span>
            </button>
            
            {/* شعار ExoLex في الفوتر */}
            <div className="mt-12 pt-8 border-t border-white/20">
              <Image
                src="/exolex-logo.png"
                alt="ExoLex"
                width={100}
                height={35}
                className="mx-auto opacity-80"
              />
              <p className="text-blue-200 text-sm mt-4">© 2025 ExoLex. جميع الحقوق محفوظة.</p>
            </div>
          </div>
        </footer>

      </main>
    </div>
  )
}
