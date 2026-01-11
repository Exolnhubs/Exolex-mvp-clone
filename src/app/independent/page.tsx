'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  ClipboardList, AlertTriangle, CheckCircle, Scale, Calendar, Star, 
  DollarSign, RefreshCw, Clock, Eye, Send, ChevronLeft, X,
  FileText, Bell, Gavel, FileCheck
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import QuoteFormModal, { QuoteFormData } from '@/components/QuoteFormModal'

interface Stats {
  myTasks: number
  overdue: number
  completed: number
  cases: number
  upcomingSessions: number
  rating: number
  earnings: number
}

interface ServiceRequest {
  id: string
  ticket_number: string
  title: string
  description: string
  base_price: number | null
  created_at: string
  priority: string
  status: string
}

interface PendingQuote {
  id: string
  quote_number: string
  price: number
  total_amount: number
  vat_amount: number
  lawyer_earnings: number
  service_description: string
  quote_type: string
  installments_count: number
  status: string
  created_at: string
  valid_until: string
  service_requests?: { ticket_number: string; title: string; description: string }
}

interface Case {
  id: string
  case_number: string
  title: string
  status: string
  next_session_date: string | null
  client_name: string
}

interface Activity {
  id: string
  type: 'accepted' | 'document' | 'rating' | 'case' | 'session'
  title: string
  description: string
  created_at: string
}

export default function IndependentDashboard() {
  const router = useRouter()
  const [lawyerId, setLawyerId] = useState<string | null>(null)
  const [lawyerName, setLawyerName] = useState('المحامي')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'available' | 'pending_quotes'>('available')
  
  const [stats, setStats] = useState<Stats>({
    myTasks: 0, overdue: 0, completed: 0, cases: 0,
    upcomingSessions: 0, rating: 4.8, earnings: 0
  })
  
  const [availableRequests, setAvailableRequests] = useState<ServiceRequest[]>([])
  const [pendingQuotes, setPendingQuotes] = useState<PendingQuote[]>([])
  const [activeCases, setActiveCases] = useState<Case[]>([])
  const [urgentTasks, setUrgentTasks] = useState<ServiceRequest[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [showQuoteDetailModal, setShowQuoteDetailModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null)
  const [selectedQuote, setSelectedQuote] = useState<PendingQuote | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem('exolex_lawyer_id')
    const name = localStorage.getItem('exolex_lawyer_name')
    if (id) setLawyerId(id)
    if (name) setLawyerName(name)
    fetchData(id)
  }, [])

  const fetchData = async (id: string | null) => {
    try {
      setLoading(true)
      
      if (id) {
        // إحصائيات المهام
        const { data: tasks } = await supabase
          .from('service_requests')
          .select('id, status, title, description, priority, created_at, sla_deadline')
          .eq('assigned_lawyer_id', id)
        
        const myTasks = tasks?.filter(t => t.status === 'in_progress').length || 0
        const completed = tasks?.filter(t => t.status === 'completed').length || 0
        const overdue = tasks?.filter(t => t.status === 'overdue').length || 0
        
        // المهام العاجلة
        const urgent = tasks?.filter(t => 
          t.status === 'in_progress' && 
          (t.priority === 'urgent' || t.priority === 'emergency' || t.status === 'overdue')
        ).slice(0, 5) || []
        setUrgentTasks(urgent as ServiceRequest[])
        
        // العروض المعلقة
        const { data: quotes } = await supabase
          .from('service_quotes')
          .select(`*, service_requests (ticket_number, title, description)`)
          .eq('lawyer_id', id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
        
        setPendingQuotes(quotes || [])
        
        // الأرباح
        const { data: earnings } = await supabase
          .from('service_quotes')
          .select('lawyer_earnings')
          .eq('lawyer_id', id)
          .eq('status', 'accepted')
        
        const totalEarnings = earnings?.reduce((sum, e) => sum + (e.lawyer_earnings || 0), 0) || 0
        
        setStats({
          myTasks, completed, overdue,
          cases: 3, // مؤقت
          upcomingSessions: 2, // مؤقت
          rating: 4.8,
          earnings: totalEarnings
        })
      }
      
      // الطلبات المتاحة
      const { data: available } = await supabase
        .from('service_requests')
        .select('*')
        .eq('request_type', 'extra_service')
        .in('status', ['pending_assignment', 'pending_quotes'])
        .is('assigned_lawyer_id', null)
        .order('created_at', { ascending: false })
        .limit(5)
      
      setAvailableRequests((available || []).filter(r => r.is_accepted !== true))
      
      // القضايا النشطة (مؤقت - بيانات وهمية)
      setActiveCases([
        { id: '1', case_number: 'CASE-001', title: 'قضية نزاع تجاري', status: 'in_review', next_session_date: '2026-02-15', client_name: 'شركة النور التجارية' },
        { id: '2', case_number: 'CASE-002', title: 'قضية عمالية', status: 'active', next_session_date: '2026-02-20', client_name: 'أحمد محمد العتيبي' },
        { id: '3', case_number: 'CASE-003', title: 'نزاع إيجار', status: 'new', next_session_date: '2026-02-25', client_name: 'فاطمة السالم' }
      ])
      
      // النشاطات الأخيرة (مؤقت)
      setActivities([
        { id: '1', type: 'accepted', title: 'تم قبول الطلب', description: 'قبلت طلب صياغة عقد بيع عقار تجاري', created_at: new Date(Date.now() - 10 * 60000).toISOString() },
        { id: '2', type: 'document', title: 'تم رفع مستند', description: 'رفعت مذكرة الدفاع في قضية النزاع التجاري', created_at: new Date(Date.now() - 60 * 60000).toISOString() },
        { id: '3', type: 'rating', title: 'تقييم جديد', description: 'حصلت على تقييم 5 نجوم من العميلة فاطمة', created_at: new Date(Date.now() - 3 * 60 * 60000).toISOString() },
        { id: '4', type: 'case', title: 'تحديث قضية', description: 'تم تحديث حالة قضية النزاع العمالي', created_at: new Date(Date.now() - 5 * 60 * 60000).toISOString() },
        { id: '5', type: 'session', title: 'جلسة قادمة', description: 'تم تحديد موعد جلسة قضية نزاع الإيجار', created_at: new Date(Date.now() - 24 * 60 * 60000).toISOString() }
      ])
      
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData(lawyerId)
    setRefreshing(false)
  }

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `منذ ${days} يوم`
    if (hours > 0) return `منذ ${hours} ساعة`
    return `منذ ${minutes} دقيقة`
  }

  const getTimeRemaining = (date: string) => {
    const diff = new Date(date).getTime() - Date.now()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (diff < 0) return 'منتهي'
    if (days > 0) return `${days} يوم`
    return `${hours} ساعة`
  }

  const handleAcceptRequest = async (request: ServiceRequest) => {
    if (!lawyerId) { alert('الرجاء تسجيل الدخول أولاً'); return }
    if (!confirm('هل أنت متأكد من قبول هذا الطلب؟')) return
    
    try {
      setSubmitting(true)
      const { error } = await supabase
        .from('service_requests')
        .update({
          is_accepted: true,
          assigned_lawyer_id: lawyerId,
          status: 'in_progress',
          accepted_at: new Date().toISOString()
        })
        .eq('id', request.id)
      
      if (error) { alert('حدث خطأ: ' + error.message); return }
      setAvailableRequests(prev => prev.filter(r => r.id !== request.id))
      alert('تم قبول الطلب بنجاح!')
      handleRefresh()
    } catch (err: any) {
      alert('حدث خطأ: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitQuote = async (formData: QuoteFormData) => {
    if (!lawyerId || !selectedRequest) return
    
    try {
      setSubmitting(true)
      const quoteNumber = `QT-${Date.now().toString().slice(-8)}`
      
      const { data: quote, error } = await supabase
        .from('service_quotes')
        .insert({
          request_id: selectedRequest.id,
          lawyer_id: lawyerId,
          quote_number: quoteNumber,
          quote_type: formData.payment_type,
          service_description: formData.service_description,
          price: formData.total_price,
          platform_fee_percent: 30,
          platform_fee_amount: formData.platform_commission,
          vat_percent: 15,
          vat_amount: formData.vat_amount,
          total_amount: formData.total_with_vat,
          lawyer_earnings: formData.lawyer_amount,
          installments_count: formData.payment_type === 'multiple' ? formData.installments.length : 1,
          status: 'pending',
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single()
      
      if (error) { alert('حدث خطأ: ' + error.message); return }
      
      if (formData.payment_type === 'multiple' && formData.installments.length > 0 && quote) {
        const installmentsData = formData.installments.map((inst, index) => ({
          quote_id: quote.id,
          installment_number: index + 1,
          description: inst.description,
          percentage: inst.valueType === 'percentage' ? inst.value : null,
          amount: inst.calculatedAmount,
          status: index === 0 ? 'pending' : 'not_due'
        }))
        await supabase.from('quote_installments').insert(installmentsData)
      }
      
      await supabase.from('service_requests').update({ status: 'pending_quotes' }).eq('id', selectedRequest.id)
      
      setShowQuoteModal(false)
      setSelectedRequest(null)
      alert('تم إرسال عرض السعر بنجاح!')
      handleRefresh()
    } catch (err: any) {
      alert('حدث خطأ: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const navigateToTasks = (filter?: string) => {
    router.push(filter ? `/independent/my-tasks?filter=${filter}` : '/independent/my-tasks')
  }

  const getCaseStatusBadge = (status: string) => {
    switch (status) {
      case 'in_review': return { label: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-800' }
      case 'active': return { label: 'نشطة', color: 'bg-green-100 text-green-800' }
      case 'new': return { label: 'جديدة', color: 'bg-blue-100 text-blue-800' }
      default: return { label: status, color: 'bg-gray-100 text-gray-800' }
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'accepted': return { icon: <CheckCircle className="w-5 h-5" />, color: 'bg-green-100 text-green-600' }
      case 'document': return { icon: <FileText className="w-5 h-5" />, color: 'bg-blue-100 text-blue-600' }
      case 'rating': return { icon: <Star className="w-5 h-5" />, color: 'bg-yellow-100 text-yellow-600' }
      case 'case': return { icon: <Gavel className="w-5 h-5" />, color: 'bg-purple-100 text-purple-600' }
      case 'session': return { icon: <Calendar className="w-5 h-5" />, color: 'bg-orange-100 text-orange-600' }
      default: return { icon: <Bell className="w-5 h-5" />, color: 'bg-gray-100 text-gray-600' }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">لوحة التحكم</h1>
          <p className="text-sm text-gray-500 mt-1">مرحباً بك، {lawyerName}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRefresh} disabled={refreshing} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button className="relative p-2 hover:bg-gray-100 rounded-lg">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-7 gap-4">
        <button onClick={() => navigateToTasks('in_progress')} className="bg-white rounded-xl shadow-sm p-5 border-r-4 border-blue-500 hover:shadow-lg hover:scale-105 transition-all text-right">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
            <ClipboardList className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{stats.myTasks}</h3>
          <p className="text-sm text-gray-600 mt-1">مهامي</p>
        </button>

        <button onClick={() => navigateToTasks('overdue')} className="bg-white rounded-xl shadow-sm p-5 border-r-4 border-red-500 hover:shadow-lg hover:scale-105 transition-all text-right">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-2">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{stats.overdue}</h3>
          <p className="text-sm text-gray-600 mt-1">متأخرة</p>
        </button>

        <button onClick={() => navigateToTasks('completed')} className="bg-white rounded-xl shadow-sm p-5 border-r-4 border-green-500 hover:shadow-lg hover:scale-105 transition-all text-right">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-2">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{stats.completed}</h3>
          <p className="text-sm text-gray-600 mt-1">مكتملة</p>
        </button>

        <Link href="/independent/cases" className="bg-white rounded-xl shadow-sm p-5 border-r-4 border-purple-500 hover:shadow-lg hover:scale-105 transition-all text-right">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
            <Scale className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{stats.cases}</h3>
          <p className="text-sm text-gray-600 mt-1">قضايا</p>
        </Link>

        <Link href="/independent/calendar" className="bg-white rounded-xl shadow-sm p-5 border-r-4 border-orange-500 hover:shadow-lg hover:scale-105 transition-all text-right">
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-2">
            <Calendar className="w-6 h-6 text-orange-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{stats.upcomingSessions}</h3>
          <p className="text-sm text-gray-600 mt-1">جلسات قادمة</p>
        </Link>

        <Link href="/independent/ratings" className="bg-white rounded-xl shadow-sm p-5 border-r-4 border-yellow-500 hover:shadow-lg hover:scale-105 transition-all text-right">
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-2">
            <Star className="w-6 h-6 text-yellow-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{stats.rating}⭐</h3>
          <p className="text-sm text-gray-600 mt-1">تقييماتي</p>
        </Link>

        <Link href="/independent/earnings" className="bg-white rounded-xl shadow-sm p-5 border-r-4 border-emerald-500 hover:shadow-lg hover:scale-105 transition-all text-right">
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-2">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">{stats.earnings.toLocaleString()}</h3>
          <p className="text-sm text-gray-600 mt-1">أرباحي (ر.س)</p>
        </Link>
      </div>

      {/* Tabs: طلبات جديدة / عروض بانتظار الترسية */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center border-b border-gray-200">
          <button onClick={() => setActiveTab('available')} className={`flex-1 px-6 py-4 text-center font-semibold transition ${activeTab === 'available' ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50' : 'text-gray-500 hover:text-gray-700'}`}>
            <span className="flex items-center justify-center gap-2">
              📨 طلبات جديدة
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{availableRequests.length}</span>
            </span>
          </button>
          <button onClick={() => setActiveTab('pending_quotes')} className={`flex-1 px-6 py-4 text-center font-semibold transition ${activeTab === 'pending_quotes' ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50' : 'text-gray-500 hover:text-gray-700'}`}>
            <span className="flex items-center justify-center gap-2">
              ⏳ عروض بانتظار الترسية
              <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingQuotes.length}</span>
            </span>
          </button>
        </div>

        {/* طلبات جديدة */}
        {activeTab === 'available' && (
          <div className="divide-y divide-gray-200">
            {availableRequests.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700">لا توجد طلبات جديدة</h3>
              </div>
            ) : (
              availableRequests.map((request) => (
                <div key={request.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-3 h-3 rounded-full ${request.base_price ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                        <h4 className="font-semibold text-slate-900">{request.title || 'طلب خدمة'}</h4>
                      </div>
                      {request.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{request.description}</p>}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{getTimeAgo(request.created_at)}</span>
                        <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{request.ticket_number}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      {request.base_price ? (
                        <>
                          <p className="text-2xl font-bold text-green-600">{request.base_price.toLocaleString()} ر.س</p>
                          <button onClick={() => handleAcceptRequest(request)} disabled={submitting} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">قبول</button>
                        </>
                      ) : (
                        <>
                          <p className="text-2xl font-bold text-amber-600">عرض سعر</p>
                          <button onClick={() => { setSelectedRequest(request); setShowQuoteModal(true) }} disabled={submitting} className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">تقديم عرض</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div className="p-4 text-center border-t">
              <Link href="/marketplace/requests" className="text-sm text-amber-600 hover:text-amber-700 font-semibold">عرض جميع الطلبات ←</Link>
            </div>
          </div>
        )}

        {/* عروض بانتظار الترسية */}
        {activeTab === 'pending_quotes' && (
          <div className="divide-y divide-gray-200">
            {pendingQuotes.length === 0 ? (
              <div className="p-12 text-center">
                <Send className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700">لا توجد عروض معلقة</h3>
              </div>
            ) : (
              pendingQuotes.map((quote) => (
                <div key={quote.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></span>
                        <h4 className="font-semibold text-slate-900">{(quote.service_requests as any)?.title || 'عرض سعر'}</h4>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                        <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{quote.quote_number}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>أُرسل {getTimeAgo(quote.created_at)}</span>
                        <span className={new Date(quote.valid_until).getTime() - Date.now() < 24 * 60 * 60 * 1000 ? 'text-red-600' : ''}>⏰ ينتهي خلال {getTimeRemaining(quote.valid_until)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-2xl font-bold text-slate-900">{quote.total_amount?.toLocaleString()} ر.س</p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setSelectedQuote(quote); setShowQuoteDetailModal(true) }} className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"><Eye className="w-5 h-5" /></button>
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">⏳ بانتظار</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* القضايا النشطة */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-slate-900">⚖️ القضايا النشطة</h3>
          <Link href="/independent/cases" className="text-sm text-amber-600 hover:text-amber-700 font-semibold">عرض الكل ←</Link>
        </div>
        <div className="grid grid-cols-3 gap-4 p-6">
          {activeCases.map((c) => {
            const status = getCaseStatusBadge(c.status)
            return (
              <Link key={c.id} href={`/independent/cases/${c.id}`} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Gavel className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${status.color}`}>{status.label}</span>
                </div>
                <h4 className="font-semibold text-slate-900 mb-2">{c.title}</h4>
                <p className="text-sm text-gray-600 mb-3">العميل: {c.client_name}</p>
                <p className="text-xs text-gray-500">الجلسة القادمة: {c.next_session_date || 'غير محدد'}</p>
              </Link>
            )
          })}
        </div>
      </div>

      {/* الجلسات القادمة + المهام العاجلة */}
      <div className="grid grid-cols-2 gap-6">
        {/* الجلسات القادمة */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-slate-900">📅 الجلسات القادمة</h3>
              <span className="bg-orange-100 text-orange-800 text-xs font-semibold px-2 py-1 rounded">2 جلسة</span>
            </div>
            <Link href="/independent/calendar" className="text-sm text-amber-600 hover:text-amber-700 font-semibold">عرض الكل ←</Link>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-4 p-4 bg-orange-50 rounded-lg border-r-4 border-orange-500">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex flex-col items-center justify-center">
                <span className="text-xs text-orange-600 font-semibold">فبراير</span>
                <span className="text-lg font-bold text-orange-700">15</span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 mb-1">جلسة نزاع تجاري</h4>
                <p className="text-sm text-gray-600 mb-2">محكمة الرياض التجارية</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span><Clock className="w-3 h-3 inline ml-1" />10:00 صباحاً</span>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg border-r-4 border-blue-500">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex flex-col items-center justify-center">
                <span className="text-xs text-blue-600 font-semibold">فبراير</span>
                <span className="text-lg font-bold text-blue-700">20</span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 mb-1">جلسة قضية عمالية</h4>
                <p className="text-sm text-gray-600 mb-2">المحكمة العمالية - جدة</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span><Clock className="w-3 h-3 inline ml-1" />02:00 مساءً</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* المهام العاجلة */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-slate-900">🚨 المهام العاجلة</h3>
              <span className="bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded">3 مهام</span>
            </div>
            <Link href="/independent/my-tasks?filter=overdue" className="text-sm text-amber-600 hover:text-amber-700 font-semibold">عرض الكل ←</Link>
          </div>
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border-r-4 border-red-500">
              <input type="checkbox" className="w-5 h-5 text-red-600 rounded" />
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 text-sm">تقديم مذكرة دفاع</h4>
                <p className="text-xs text-gray-600">قضية نزاع تجاري - متأخر يومين</p>
              </div>
              <span className="text-xs text-red-600 font-semibold">متأخر</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border-r-4 border-yellow-500">
              <input type="checkbox" className="w-5 h-5 text-yellow-600 rounded" />
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 text-sm">مراجعة عقد الشراكة</h4>
                <p className="text-xs text-gray-600">شركة النور التجارية - اليوم</p>
              </div>
              <span className="text-xs text-yellow-600 font-semibold">اليوم</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border-r-4 border-orange-500">
              <input type="checkbox" className="w-5 h-5 text-orange-600 rounded" />
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 text-sm">إعداد لائحة اعتراض</h4>
                <p className="text-xs text-gray-600">قضية عمالية - غداً</p>
              </div>
              <span className="text-xs text-orange-600 font-semibold">غداً</span>
            </div>
          </div>
        </div>
      </div>

      {/* النشاط الأخير */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-slate-900">📊 النشاط الأخير</h3>
          <button className="text-sm text-amber-600 hover:text-amber-700 font-semibold">عرض الكل ←</button>
        </div>
        <div className="p-6 space-y-4">
          {activities.map((activity) => {
            const { icon, color } = getActivityIcon(activity.type)
            return (
              <div key={activity.id} className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
                  {icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900 text-sm mb-1">{activity.title}</h4>
                  <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
                  <span className="text-xs text-gray-500">{getTimeAgo(activity.created_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modals */}
      <QuoteFormModal isOpen={showQuoteModal} onClose={() => { setShowQuoteModal(false); setSelectedRequest(null) }} onSubmit={handleSubmitQuote} request={selectedRequest} submitting={submitting} />

      {showQuoteDetailModal && selectedQuote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-l from-amber-500 to-amber-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">📋 تفاصيل العرض</h2>
                  <p className="text-amber-100 text-sm mt-1">{selectedQuote.quote_number}</p>
                </div>
                <button onClick={() => setShowQuoteDetailModal(false)} className="p-2 hover:bg-white/20 rounded-lg"><X className="w-6 h-6" /></button>
              </div>
            </div>
            <div className="overflow-y-auto p-6 flex-1 space-y-5">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">📨 الطلب الأصلي</h4>
                <p className="font-semibold text-gray-900">{(selectedQuote.service_requests as any)?.title}</p>
                <p className="text-sm text-gray-600 mt-1">{(selectedQuote.service_requests as any)?.description}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">📝 وصف الخدمة</h4>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-gray-700">{selectedQuote.service_description || 'لا يوجد'}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">💰 التفاصيل المالية</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">السعر الأساسي</span><span className="font-medium">{selectedQuote.price?.toLocaleString()} ر.س</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">الضريبة (15%)</span><span className="font-medium">{selectedQuote.vat_amount?.toLocaleString()} ر.س</span></div>
                  <div className="flex justify-between pt-2 border-t"><span className="font-semibold">الإجمالي</span><span className="font-bold text-lg text-amber-600">{selectedQuote.total_amount?.toLocaleString()} ر.س</span></div>
                  <div className="flex justify-between pt-2 border-t"><span className="text-gray-500">صافي لك</span><span className="font-semibold text-emerald-600">{selectedQuote.lawyer_earnings?.toLocaleString()} ر.س</span></div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">نوع الدفع:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${selectedQuote.quote_type === 'multiple' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {selectedQuote.quote_type === 'multiple' ? `دفعات متعددة (${selectedQuote.installments_count})` : 'دفعة واحدة'}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
                <div>
                  <p className="text-sm text-amber-800 font-semibold">⏳ بانتظار قبول العميل</p>
                  <p className="text-xs text-amber-600 mt-1">ينتهي خلال: {getTimeRemaining(selectedQuote.valid_until)}</p>
                </div>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowQuoteDetailModal(false)} className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300">إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
