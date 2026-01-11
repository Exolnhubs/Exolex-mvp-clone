'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function SupportPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tickets' | 'new' | 'share'>('tickets')
  const [tickets, setTickets] = useState<any[]>([])
  const [affiliateCode, setAffiliateCode] = useState('')
  const [referralStats, setReferralStats] = useState({ total: 0, subscribed: 0 })
  const [newTicket, setNewTicket] = useState({ subject: '', category: 'technical', priority: 'medium', description: '' })
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const id = localStorage.getItem('exolex_lawyer_id')
      if (!id) { router.push('/auth/lawyer-login'); return }
      const uId = localStorage.getItem('exolex_user_id')
      setUserId(uId)

      const { data: lawyer } = await supabase.from('lawyers').select('affiliate_code, user_id').eq('id', id).single()
      if (lawyer) {
        setAffiliateCode(lawyer.affiliate_code || '')
        if (lawyer.user_id) setUserId(lawyer.user_id)
        
        const { data: ticketsData } = await supabase.from('support_tickets').select('*').eq('user_id', lawyer.user_id || uId).order('created_at', { ascending: false })
        setTickets(ticketsData || [])

        if (lawyer.affiliate_code) {
          const { data: refs } = await supabase.from('referrals').select('status').eq('affiliate_code_used', lawyer.affiliate_code)
          setReferralStats({ total: refs?.length || 0, subscribed: refs?.filter(r => r.status === 'subscribed').length || 0 })
        }
      }
    } catch (e) { console.error(e) } finally { setIsLoading(false) }
  }

  const createTicket = async () => {
    if (!newTicket.subject || !newTicket.description) { toast.error('يرجى تعبئة جميع الحقول'); return }
    await supabase.from('support_tickets').insert({ ticket_number: `TKT-${Date.now().toString().slice(-8)}`, user_id: userId, user_type: 'lawyer', ...newTicket, status: 'open' })
    toast.success('✅ تم إنشاء التذكرة')
    setNewTicket({ subject: '', category: 'technical', priority: 'medium', description: '' })
    setActiveTab('tickets')
    loadData()
  }

  const copyLink = () => { navigator.clipboard.writeText(`https://exolex.sa/register?ref=${affiliateCode}`); toast.success('✅ تم نسخ الرابط') }

  if (isLoading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div className="min-h-screen bg-slate-100 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-slate-800">📞 مركز التواصل والدعم</h1>
          <p className="text-slate-500 mt-1">تواصل مع فريق الدعم وشارك التطبيق</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm mb-6 flex border-b">
          {[{ k: 'tickets', i: '🎫', l: 'تذاكري', n: tickets.length }, { k: 'new', i: '➕', l: 'تذكرة جديدة' }, { k: 'share', i: '🔗', l: 'شارك التطبيق' }].map(t => (
            <button key={t.k} onClick={() => setActiveTab(t.k as any)} className={`flex-1 px-6 py-4 text-center font-medium ${activeTab === t.k ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50' : 'text-slate-500 hover:bg-slate-50'}`}>
              <span className="text-xl block mb-1">{t.i}</span>{t.l}{t.n !== undefined && <span className="mr-2 px-2 py-0.5 rounded-full text-xs bg-slate-200">{t.n}</span>}
            </button>
          ))}
        </div>

        {activeTab === 'tickets' && (
          <div className="space-y-4">
            {tickets.length > 0 ? tickets.map(t => (
              <Link key={t.id} href={`/independent/support/ticket/${t.id}`} className="block bg-white rounded-xl shadow-sm p-5 hover:shadow-md">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-slate-400">#{t.ticket_number}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${t.status === 'open' ? 'bg-blue-100 text-blue-700' : t.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status === 'open' ? 'مفتوحة' : t.status === 'resolved' ? 'محلولة' : 'قيد المعالجة'}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800">{t.subject}</h3>
                <p className="text-slate-500 text-sm mt-1 line-clamp-2">{t.description}</p>
              </Link>
            )) : <div className="bg-white rounded-xl p-12 text-center"><span className="text-6xl block mb-4">🎫</span><h3 className="text-xl font-bold text-slate-700">لا توجد تذاكر</h3><button onClick={() => setActiveTab('new')} className="mt-4 px-6 py-2 bg-amber-500 text-white rounded-lg">➕ تذكرة جديدة</button></div>}
          </div>
        )}

        {activeTab === 'new' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-6">➕ إنشاء تذكرة جديدة</h2>
            <div className="space-y-5">
              <div><label className="block text-sm font-medium text-slate-700 mb-2">الموضوع *</label><input type="text" value={newTicket.subject} onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })} className="w-full px-4 py-3 border border-slate-300 rounded-xl" placeholder="عنوان مختصر" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-2">التصنيف</label><select value={newTicket.category} onChange={e => setNewTicket({ ...newTicket, category: e.target.value })} className="w-full px-4 py-3 border border-slate-300 rounded-xl"><option value="technical">🔧 تقني</option><option value="financial">💰 مالي</option><option value="general">📋 عام</option></select></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-2">الأولوية</label><select value={newTicket.priority} onChange={e => setNewTicket({ ...newTicket, priority: e.target.value })} className="w-full px-4 py-3 border border-slate-300 rounded-xl"><option value="low">منخفضة</option><option value="medium">متوسطة</option><option value="high">عالية</option><option value="urgent">🔥 عاجلة</option></select></div>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-2">الوصف *</label><textarea value={newTicket.description} onChange={e => setNewTicket({ ...newTicket, description: e.target.value })} rows={5} className="w-full px-4 py-3 border border-slate-300 rounded-xl resize-none" placeholder="اشرح المشكلة..." /></div>
              <div className="flex gap-3"><button onClick={createTicket} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-medium">📤 إرسال</button><button onClick={() => setActiveTab('tickets')} className="px-6 py-3 border border-slate-300 rounded-xl">إلغاء</button></div>
            </div>
          </div>
        )}

        {activeTab === 'share' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-slate-800 mb-4">🔗 رابط الإحالة</h2>
              {affiliateCode ? (<div className="flex gap-3"><input type="text" value={`https://exolex.sa/register?ref=${affiliateCode}`} readOnly className="flex-1 px-4 py-3 bg-slate-50 border rounded-xl" dir="ltr" /><button onClick={copyLink} className="px-6 py-3 bg-amber-500 text-white rounded-xl">📋 نسخ</button></div>) : <p className="text-slate-500 text-center py-4">لم يتم تفعيل كود الإحالة بعد</p>}
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-slate-800 mb-4">📊 إحصائيات الإحالات</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-xl p-5 text-center"><span className="text-4xl font-bold text-blue-600">{referralStats.total}</span><p className="text-blue-700 mt-1">إجمالي المسجلين</p></div>
                <div className="bg-green-50 rounded-xl p-5 text-center"><span className="text-4xl font-bold text-green-600">{referralStats.subscribed}</span><p className="text-green-700 mt-1">المشتركين</p></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
