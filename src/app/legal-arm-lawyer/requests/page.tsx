'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// 📌 صفحة الطلبات - محامي الذراع القانوني
// 📅 تاريخ الإنشاء: 4 يناير 2026
// 🎯 الغرض: عرض وإدارة طلبات المحامي
// ═══════════════════════════════════════════════════════════════
//
// 📋 التبويبات:
// - المسندة إلي: طلبات الباقة الجديدة (مباشرة فقط)
// - قيد التنفيذ: الطلبات التي يعمل عليها
// - مكتملة: الطلبات المنتهية
// - طلبات مسعّرة: خدمات إضافية (قبول/غير مهتم)
// - عروض الأسعار: نشطة (قدم عرض/طلب تفاصيل) + منتهية (رمادي)
// - عاجلة: طلبات NOLEX العاجلة
//
// ⚠️ قاعدة: لا أيقونات أو جداول ميتة - كل عنصر فيه إجراء
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// أنواع البيانات
// ─────────────────────────────────────────────────────────────
interface Request {
  id: string
  request_number: string
  service_type: string
  domain: string
  category: string
  status: string
  priority: string
  is_urgent: boolean
  sla_deadline: string
  created_at: string
  member_code: string
  member_first_name?: string
  description: string
  is_package_service: boolean
  // للعروض
  quote_deadline?: string
  quote_status?: string
  quote_amount?: number
  lawyer_quote_sent?: boolean
}

interface QuoteFormData {
  service_description: string
  total_price: number
  payment_type: 'single' | 'multiple'
  payment_schedule: PaymentScheduleItem[]
}

interface PaymentScheduleItem {
  stage: string
  percentage: number
  description: string
}

interface DetailRequestData {
  question: string
}

// ─────────────────────────────────────────────────────────────
// التبويبات
// ─────────────────────────────────────────────────────────────
const tabs = [
  { id: 'assigned', label: 'المسندة إلي', status: 'new' },
  { id: 'in_progress', label: 'قيد التنفيذ', status: 'in_progress' },
  { id: 'completed', label: 'مكتملة', status: 'completed' },
  { id: 'priced', label: 'طلبات مسعّرة', status: 'priced' },
  { id: 'quotes', label: 'عروض الأسعار', status: 'quote' },
  { id: 'urgent', label: 'عاجلة', status: 'urgent' },
]

// ─────────────────────────────────────────────────────────────
// خيارات الفلترة
// ─────────────────────────────────────────────────────────────
const domains = [
  { value: '', label: 'كل المجالات' },
  { value: 'labor', label: 'عمالي' },
  { value: 'family', label: 'أسري' },
  { value: 'commercial', label: 'تجاري' },
  { value: 'criminal', label: 'جنائي' },
  { value: 'real_estate', label: 'عقاري' },
  { value: 'administrative', label: 'إداري' },
]

const serviceTypes = [
  { value: '', label: 'كل الأنواع' },
  { value: 'consultation', label: 'استشارة' },
  { value: 'case', label: 'قضية' },
  { value: 'drafting', label: 'صياغة' },
]

export default function LegalArmLawyerRequests() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // الحالة
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(searchParams.get('status') || 'assigned')
  const [requests, setRequests] = useState<Request[]>([])
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({})
  
  // الفلترة
  const [filterDomain, setFilterDomain] = useState('')
  const [filterType, setFilterType] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  
  // بيانات النماذج
  const [quoteForm, setQuoteForm] = useState<QuoteFormData>({
    service_description: '',
    total_price: 0,
    payment_type: 'single',
    payment_schedule: [
      { stage: 'الأولى', percentage: 100, description: 'عند قبول العرض' }
    ]
  })
  const [detailForm, setDetailForm] = useState<DetailRequestData>({ question: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ─────────────────────────────────────────────────────────────
  // جلب البيانات
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchRequests = async () => {
      const lawyerId = localStorage.getItem('exolex_lawyer_id')
      
      if (!lawyerId) {
        router.push('/auth/lawyer-login')
        return
      }

      setIsLoading(true)

      try {
        // جلب عدد الطلبات لكل تبويب
        const counts: Record<string, number> = {}
        
        // المسندة (جديدة من الباقة)
        const { count: assignedCount } = await supabase
          .from('requests')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_lawyer_id', lawyerId)
          .eq('status', 'new')
          .eq('is_package_service', true)
        counts.assigned = assignedCount || 0

        // قيد التنفيذ
        const { count: inProgressCount } = await supabase
          .from('requests')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_lawyer_id', lawyerId)
          .eq('status', 'in_progress')
        counts.in_progress = inProgressCount || 0

        // مكتملة
        const { count: completedCount } = await supabase
          .from('requests')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_lawyer_id', lawyerId)
          .eq('status', 'completed')
        counts.completed = completedCount || 0

        // طلبات مسعّرة
        const { count: pricedCount } = await supabase
          .from('requests')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_lawyer_id', lawyerId)
          .eq('is_package_service', false)
          .eq('status', 'pending_acceptance')
        counts.priced = pricedCount || 0

        // عروض الأسعار (المتاحة للتقديم)
        const { count: quotesCount } = await supabase
          .from('quote_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open')
        counts.quotes = quotesCount || 0

        // عاجلة
        const { count: urgentCount } = await supabase
          .from('requests')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_lawyer_id', lawyerId)
          .eq('is_urgent', true)
          .in('status', ['new', 'in_progress'])
        counts.urgent = urgentCount || 0

        setTabCounts(counts)

        // جلب الطلبات حسب التبويب النشط
        await fetchTabRequests(lawyerId, activeTab)

      } catch (error) {
        console.error('خطأ:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRequests()
  }, [router, activeTab])

  // جلب طلبات التبويب
  const fetchTabRequests = async (lawyerId: string, tab: string) => {
    let query;
    
    if (tab === 'quotes') {
      // عروض الأسعار - جلب من جدول منفصل
      const { data, error } = await supabase
        .from('quote_requests')
        .select(`
          *,
          requests (
            request_number,
            service_type,
            domain,
            category,
            description,
            created_at
          ),
          lawyer_quotes (
            id,
            lawyer_id,
            status
          )
        `)
        .order('deadline', { ascending: true })

      if (!error && data) {
        const formattedQuotes = data.map((q: any) => ({
          id: q.id,
          request_id: q.request_id,
          request_number: q.requests?.request_number || q.id.slice(0, 8),
          service_type: q.requests?.service_type || 'case',
          domain: q.requests?.domain || '',
          category: q.requests?.category || '',
          description: q.requests?.description || q.description,
          created_at: q.created_at,
          quote_deadline: q.deadline,
          quote_status: q.status,
          // هل المحامي أرسل عرض؟
          lawyer_quote_sent: q.lawyer_quotes?.some((lq: any) => lq.lawyer_id === lawyerId),
          // هل انتهت أو ترسيت لغيره؟
          is_expired: new Date(q.deadline) < new Date(),
          is_awarded_to_other: q.status === 'awarded' && q.awarded_lawyer_id !== lawyerId,
          is_active: q.status === 'open' && new Date(q.deadline) >= new Date(),
        }))

        // ترتيب: النشطة أولاً، ثم المنتهية
        formattedQuotes.sort((a: any, b: any) => {
          if (a.is_active && !b.is_active) return -1
          if (!a.is_active && b.is_active) return 1
          return 0
        })

        setRequests(formattedQuotes)
      }
      return
    }

    // باقي التبويبات
    query = supabase
      .from('requests')
      .select(`
        id,
        request_number,
        service_type,
        domain,
        category,
        status,
        priority,
        is_urgent,
        sla_deadline,
        created_at,
        description,
        is_package_service,
        members (
          member_code,
          users (full_name)
        )
      `)
      .eq('assigned_lawyer_id', lawyerId)

    // فلترة حسب التبويب
    switch (tab) {
      case 'assigned':
        query = query.eq('status', 'new').eq('is_package_service', true)
        break
      case 'in_progress':
        query = query.eq('status', 'in_progress')
        break
      case 'completed':
        query = query.eq('status', 'completed')
        break
      case 'priced':
        query = query.eq('is_package_service', false).eq('status', 'pending_acceptance')
        break
      case 'urgent':
        query = query.eq('is_urgent', true).in('status', ['new', 'in_progress'])
        break
    }

    // فلترة إضافية
    if (filterDomain) query = query.eq('domain', filterDomain)
    if (filterType) query = query.eq('service_type', filterType)

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (!error && data) {
      const formatted = data.map((req: any) => ({
        id: req.id,
        request_number: req.request_number,
        service_type: req.service_type,
        domain: req.domain,
        category: req.category,
        status: req.status,
        priority: req.priority,
        is_urgent: req.is_urgent,
        sla_deadline: req.sla_deadline,
        created_at: req.created_at,
        description: req.description,
        is_package_service: req.is_package_service,
        member_code: req.members?.member_code || 'USR-XXXXX',
        member_first_name: ['in_progress', 'completed'].includes(req.status)
          ? req.members?.users?.full_name?.split(' ')[0]
          : undefined,
      }))

      // فلترة البحث
      if (searchQuery) {
        setRequests(formatted.filter((r: Request) =>
          r.request_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.description?.toLowerCase().includes(searchQuery.toLowerCase())
        ))
      } else {
        setRequests(formatted)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // دوال مساعدة
  // ─────────────────────────────────────────────────────────────
  
  const getServiceTypeAr = (type: string) => {
    const types: Record<string, string> = {
      'consultation': 'استشارة',
      'case': 'قضية',
      'drafting': 'صياغة',
    }
    return types[type] || type
  }

  const getDomainAr = (domain: string) => {
    const domainsMap: Record<string, string> = {
      'labor': 'عمالي',
      'family': 'أسري',
      'commercial': 'تجاري',
      'criminal': 'جنائي',
      'real_estate': 'عقاري',
      'administrative': 'إداري',
    }
    return domainsMap[domain] || domain
  }

  const getSlaStatus = (deadline: string) => {
    if (!deadline) return { label: '-', color: 'text-slate-400', urgent: false }
    
    const now = new Date()
    const sla = new Date(deadline)
    const hoursLeft = (sla.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    if (hoursLeft < 0) return { label: 'تجاوز SLA', color: 'text-red-600', urgent: true }
    if (hoursLeft < 2) return { label: `${Math.floor(hoursLeft * 60)} دقيقة`, color: 'text-red-600', urgent: true }
    if (hoursLeft < 6) return { label: `${Math.floor(hoursLeft)} ساعات`, color: 'text-orange-600', urgent: true }
    if (hoursLeft < 24) return { label: `${Math.floor(hoursLeft)} ساعة`, color: 'text-amber-600', urgent: false }
    return { label: `${Math.floor(hoursLeft / 24)} يوم`, color: 'text-green-600', urgent: false }
  }

  const getTimeRemaining = (deadline: string) => {
    if (!deadline) return { text: '-', expired: false }
    
    const now = new Date()
    const end = new Date(deadline)
    const diff = end.getTime() - now.getTime()
    
    if (diff < 0) return { text: 'انتهت المهلة', expired: true }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (days > 0) return { text: `${days} يوم ${hours} ساعة`, expired: false }
    return { text: `${hours} ساعة`, expired: false }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      day: 'numeric',
      month: 'short',
    })
  }

  // حساب صافي المحامي
  const calculateNetAmount = (price: number) => {
    const platformFee = price * 0.30 // 30%
    return price - platformFee
  }

  // حساب إجمالي المشترك
  const calculateTotalWithVat = (price: number) => {
    const vat = price * 0.15 // 15%
    return price + vat
  }

  // ─────────────────────────────────────────────────────────────
  // إجراءات الطلبات
  // ─────────────────────────────────────────────────────────────
  
  const handleStartRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ 
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (error) throw error
      
      toast.success('تم مباشرة الطلب')
      router.push(`/legal-arm-lawyer/requests/${requestId}`)
    } catch (error) {
      console.error('خطأ:', error)
      toast.error('حدث خطأ في مباشرة الطلب')
    }
  }

  const handleAcceptPriced = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ 
          status: 'in_progress',
          accepted_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (error) throw error
      
      toast.success('تم قبول الطلب')
      setRequests(prev => prev.filter(r => r.id !== requestId))
    } catch (error) {
      console.error('خطأ:', error)
      toast.error('حدث خطأ')
    }
  }

  const handleNotInterested = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ 
          assigned_lawyer_id: null,
          status: 'pending_assignment'
        })
        .eq('id', requestId)

      if (error) throw error
      
      toast.success('تم تسجيل عدم الاهتمام')
      setRequests(prev => prev.filter(r => r.id !== requestId))
    } catch (error) {
      console.error('خطأ:', error)
      toast.error('حدث خطأ')
    }
  }

  // فتح نموذج تقديم العرض
  const openQuoteModal = (request: Request) => {
    setSelectedRequest(request)
    setQuoteForm({
      service_description: '',
      total_price: 0,
      payment_type: 'single',
      payment_schedule: [
        { stage: 'الأولى', percentage: 100, description: 'عند قبول العرض' }
      ]
    })
    setShowQuoteModal(true)
  }

  // فتح نموذج طلب التفاصيل
  const openDetailModal = (request: Request) => {
    setSelectedRequest(request)
    setDetailForm({ question: '' })
    setShowDetailModal(true)
  }

  // إرسال العرض
  const handleSubmitQuote = async () => {
    if (!selectedRequest || !quoteForm.service_description || quoteForm.total_price <= 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    // التحقق من أن مجموع النسب = 100%
    if (quoteForm.payment_type === 'multiple') {
      const totalPercentage = quoteForm.payment_schedule.reduce((sum, p) => sum + p.percentage, 0)
      if (totalPercentage !== 100) {
        toast.error('مجموع نسب الدفعات يجب أن يساوي 100%')
        return
      }
    }

    setIsSubmitting(true)
    try {
      const lawyerId = localStorage.getItem('exolex_lawyer_id')
      
      const { error } = await supabase
        .from('lawyer_quotes')
        .insert({
          quote_request_id: selectedRequest.id,
          lawyer_id: lawyerId,
          service_description: quoteForm.service_description,
          total_price: quoteForm.total_price,
          platform_fee: quoteForm.total_price * 0.30,
          lawyer_net: quoteForm.total_price * 0.70,
          vat_amount: quoteForm.total_price * 0.15,
          total_with_vat: quoteForm.total_price * 1.15,
          payment_type: quoteForm.payment_type,
          payment_schedule: quoteForm.payment_schedule,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 أيام
        })

      if (error) throw error
      
      toast.success('تم إرسال العرض بنجاح')
      setShowQuoteModal(false)
      
      // تحديث القائمة
      setRequests(prev => prev.map(r => 
        r.id === selectedRequest.id 
          ? { ...r, lawyer_quote_sent: true }
          : r
      ))
    } catch (error) {
      console.error('خطأ:', error)
      toast.error('حدث خطأ في إرسال العرض')
    } finally {
      setIsSubmitting(false)
    }
  }

  // إرسال طلب التفاصيل
  const handleSubmitDetailRequest = async () => {
    if (!selectedRequest || !detailForm.question.trim()) {
      toast.error('يرجى كتابة استفسارك')
      return
    }

    setIsSubmitting(true)
    try {
      const lawyerId = localStorage.getItem('exolex_lawyer_id')
      
      const { error } = await supabase
        .from('quote_detail_requests')
        .insert({
          quote_request_id: selectedRequest.id,
          lawyer_id: lawyerId,
          question: detailForm.question.trim(),
          status: 'pending',
        })

      if (error) throw error
      
      toast.success('تم إرسال الاستفسار للمشترك')
      setShowDetailModal(false)
    } catch (error) {
      console.error('خطأ:', error)
      toast.error('حدث خطأ في إرسال الاستفسار')
    } finally {
      setIsSubmitting(false)
    }
  }

  // تحديث جدول الدفعات
  const updatePaymentSchedule = (index: number, field: string, value: any) => {
    setQuoteForm(prev => ({
      ...prev,
      payment_schedule: prev.payment_schedule.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  // إضافة دفعة
  const addPaymentStage = () => {
    const stages = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة']
    const nextStage = stages[quoteForm.payment_schedule.length] || `الدفعة ${quoteForm.payment_schedule.length + 1}`
    
    setQuoteForm(prev => ({
      ...prev,
      payment_schedule: [
        ...prev.payment_schedule,
        { stage: nextStage, percentage: 0, description: '' }
      ]
    }))
  }

  // حذف دفعة
  const removePaymentStage = (index: number) => {
    if (quoteForm.payment_schedule.length <= 1) return
    setQuoteForm(prev => ({
      ...prev,
      payment_schedule: prev.payment_schedule.filter((_, i) => i !== index)
    }))
  }

  // ─────────────────────────────────────────────────────────────
  // شاشة التحميل
  // ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">جاري تحميل الطلبات...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* التبويبات */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? tab.id === 'urgent' 
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-amber-500 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              {tabCounts[tab.id] > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : tab.id === 'urgent' 
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-200 text-slate-700'
                }`}>
                  {tabCounts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* الفلترة والبحث (لا تظهر في عروض الأسعار) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab !== 'quotes' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم الطلب أو الوصف..."
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>
            <select
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white"
            >
              {domains.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white"
            >
              {serviceTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* قائمة الطلبات */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {requests.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <h3 className="text-xl font-semibold text-slate-700 mb-2">لا توجد طلبات</h3>
          <p className="text-slate-500">
            {activeTab === 'assigned' && 'لا توجد طلبات مسندة إليك حالياً'}
            {activeTab === 'in_progress' && 'لا توجد طلبات قيد التنفيذ'}
            {activeTab === 'completed' && 'لا توجد طلبات مكتملة'}
            {activeTab === 'priced' && 'لا توجد طلبات مسعّرة'}
            {activeTab === 'quotes' && 'لا توجد عروض أسعار متاحة'}
            {activeTab === 'urgent' && 'لا توجد طلبات عاجلة'}
          </p>
        </div>
      ) : activeTab === 'quotes' ? (
        // ═══════════════════════════════════════════════════════════
        // عرض عروض الأسعار (تصميم خاص)
        // ═══════════════════════════════════════════════════════════
        <div className="space-y-6">
          {/* العروض النشطة */}
          {requests.filter((r: any) => r.is_active).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-green-700 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                عروض نشطة
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {requests.filter((r: any) => r.is_active).map((request: any) => {
                  const timeRemaining = getTimeRemaining(request.quote_deadline)
                  
                  return (
                    <div
                      key={request.id}
                      className="bg-white rounded-2xl shadow-sm border-2 border-green-200 hover:border-green-400 transition-all"
                    >
                      <div className="p-4 border-b border-green-100 bg-green-50 rounded-t-2xl">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{request.request_number}</span>
                          <span className="text-sm text-green-600 font-medium">
                            متبقي: {timeRemaining.text}
                          </span>
                        </div>
                      </div>
                      
                      <div className="p-4 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium">
                            {getServiceTypeAr(request.service_type)}
                          </span>
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm">
                            {getDomainAr(request.domain)}
                          </span>
                        </div>
                        
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {request.description || 'لا يوجد وصف'}
                        </p>
                        
                        <div className="flex items-center justify-between text-sm text-slate-500">
                          <span>تاريخ الإرسال: {formatDate(request.created_at)}</span>
                          <span>ينتهي: {formatDate(request.quote_deadline)}</span>
                        </div>

                        {request.lawyer_quote_sent && (
                          <div className="p-2 bg-blue-50 rounded-lg text-center">
                            <span className="text-sm text-blue-700 font-medium">تم إرسال عرضك - بانتظار الرد</span>
                          </div>
                        )}
                      </div>
                      
                      {!request.lawyer_quote_sent && (
                        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openQuoteModal(request)}
                              className="flex-1 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-medium transition-all"
                            >
                              قدم عرضك
                            </button>
                            <button
                              onClick={() => openDetailModal(request)}
                              className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-all"
                            >
                              طلب تفاصيل
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* العروض المنتهية/المرساة لغيره */}
          {requests.filter((r: any) => !r.is_active).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-slate-500 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-slate-400 rounded-full"></span>
                عروض منتهية أو مرساة
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {requests.filter((r: any) => !r.is_active).map((request: any) => (
                  <div
                    key={request.id}
                    className="bg-slate-100 rounded-2xl shadow-sm border border-slate-200 opacity-60 cursor-not-allowed"
                  >
                    <div className="p-4 border-b border-slate-200 bg-slate-200 rounded-t-2xl">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-600">{request.request_number}</span>
                        <span className="text-sm text-slate-500">
                          {request.is_expired ? 'انتهت المهلة' : 'تم الترسية لمحامي آخر'}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="px-2 py-1 bg-slate-200 text-slate-600 rounded-lg text-sm">
                          {getServiceTypeAr(request.service_type)}
                        </span>
                        <span className="px-2 py-1 bg-slate-200 text-slate-600 rounded-lg text-sm">
                          {getDomainAr(request.domain)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-2">
                        {request.description || 'لا يوجد وصف'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // ═══════════════════════════════════════════════════════════
        // عرض باقي الطلبات (بطاقات)
        // ═══════════════════════════════════════════════════════════
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {requests.map((request) => {
            const sla = getSlaStatus(request.sla_deadline)
            
            return (
              <div
                key={request.id}
                className={`bg-white rounded-2xl shadow-sm border-2 transition-all hover:shadow-md ${
                  request.is_urgent 
                    ? 'border-red-300 hover:border-red-400' 
                    : 'border-slate-200 hover:border-amber-300'
                }`}
              >
                <div className={`px-4 py-3 border-b rounded-t-2xl ${
                  request.is_urgent ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{request.request_number}</span>
                    {request.is_urgent && (
                      <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-bold">
                        عاجل
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium">
                      {getServiceTypeAr(request.service_type)}
                    </span>
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm">
                      {getDomainAr(request.domain)}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 line-clamp-2">
                    {request.description || 'لا يوجد وصف'}
                  </p>

                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>
                      {request.member_first_name 
                        ? `${request.member_first_name} (${request.member_code})`
                        : request.member_code
                      }
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className={`font-medium ${sla.color}`}>
                      SLA: {sla.label}
                    </span>
                    <span className="text-slate-400">{formatDate(request.created_at)}</span>
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                  {/* المسندة - مباشرة فقط */}
                  {activeTab === 'assigned' && (
                    <button
                      onClick={() => handleStartRequest(request.id)}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-medium transition-all"
                    >
                      مباشرة الطلب
                    </button>
                  )}

                  {/* قيد التنفيذ */}
                  {activeTab === 'in_progress' && (
                    <Link
                      href={`/legal-arm-lawyer/requests/${request.id}`}
                      className="block w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium text-center transition-all"
                    >
                      فتح الطلب
                    </Link>
                  )}

                  {/* مكتملة */}
                  {activeTab === 'completed' && (
                    <Link
                      href={`/legal-arm-lawyer/requests/${request.id}`}
                      className="block w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium text-center transition-all"
                    >
                      عرض التفاصيل
                    </Link>
                  )}

                  {/* طلبات مسعّرة */}
                  {activeTab === 'priced' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptPriced(request.id)}
                        className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-all"
                      >
                        قبول
                      </button>
                      <button
                        onClick={() => handleNotInterested(request.id)}
                        className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-all"
                      >
                        غير مهتم
                      </button>
                    </div>
                  )}

                  {/* عاجلة */}
                  {activeTab === 'urgent' && request.status === 'new' && (
                    <button
                      onClick={() => handleStartRequest(request.id)}
                      className="w-full py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-medium transition-all"
                    >
                      مباشرة فوراً
                    </button>
                  )}
                  {activeTab === 'urgent' && request.status === 'in_progress' && (
                    <Link
                      href={`/legal-arm-lawyer/requests/${request.id}`}
                      className="block w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium text-center transition-all"
                    >
                      متابعة الطلب
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Modal: قدم عرضك */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showQuoteModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">تقديم عرض سعر</h2>
                <button
                  onClick={() => setShowQuoteModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* بيانات الطلب */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-700 mb-3">بيانات الطلب</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">رقم الطلب:</span>
                    <span className="font-medium mr-2">{selectedRequest.request_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">المجال:</span>
                    <span className="font-medium mr-2">{getDomainAr(selectedRequest.domain)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">الوصف:</span>
                    <p className="text-slate-700 mt-1">{selectedRequest.description}</p>
                  </div>
                  <div className="col-span-2">
                    <span className={`text-amber-600 font-medium`}>
                      ينتهي استقبال العروض خلال: {getTimeRemaining(selectedRequest.quote_deadline || '').text}
                    </span>
                  </div>
                </div>
              </div>

              {/* تفاصيل العرض */}
              <div>
                <h3 className="font-semibold text-slate-700 mb-3">تفاصيل العرض</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      وصف الخدمة المقدمة *
                    </label>
                    <textarea
                      value={quoteForm.service_description}
                      onChange={(e) => setQuoteForm(prev => ({ ...prev, service_description: e.target.value }))}
                      rows={4}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none"
                      placeholder="اشرح ما ستقدمه للعميل..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      السعر الإجمالي (بدون الضريبة) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={quoteForm.total_price || ''}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, total_price: Number(e.target.value) }))}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        placeholder="0"
                        min="0"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                        ريال سعودي
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* جدول الحسابات */}
              {quoteForm.total_price > 0 && (
                <div className="bg-amber-50 rounded-xl p-4">
                  <h3 className="font-semibold text-amber-800 mb-3">تفاصيل الحساب (لا تظهر للمشترك)</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>السعر الإجمالي (بدون ضريبة)</span>
                      <span className="font-medium">{quoteForm.total_price.toLocaleString()} ريال</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>نسبة المنصة (30%)</span>
                      <span>- {(quoteForm.total_price * 0.30).toLocaleString()} ريال</span>
                    </div>
                    <div className="flex justify-between font-bold text-green-700 pt-2 border-t border-amber-200">
                      <span>صافي المحامي</span>
                      <span>{calculateNetAmount(quoteForm.total_price).toLocaleString()} ريال</span>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-amber-200">
                      <p className="text-amber-700 font-medium mb-2">ما يدفعه المشترك:</p>
                      <div className="flex justify-between">
                        <span>السعر الإجمالي</span>
                        <span>{quoteForm.total_price.toLocaleString()} ريال</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ضريبة القيمة المضافة (15%)</span>
                        <span>+ {(quoteForm.total_price * 0.15).toLocaleString()} ريال</span>
                      </div>
                      <div className="flex justify-between font-bold pt-2 border-t border-amber-200">
                        <span>الإجمالي شامل الضريبة</span>
                        <span>{calculateTotalWithVat(quoteForm.total_price).toLocaleString()} ريال</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* جدول الدفعات (للقضايا) */}
              {selectedRequest.service_type === 'case' && (
                <div>
                  <h3 className="font-semibold text-slate-700 mb-3">جدول الدفعات</h3>
                  
                  <div className="flex gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="payment_type"
                        checked={quoteForm.payment_type === 'single'}
                        onChange={() => setQuoteForm(prev => ({
                          ...prev,
                          payment_type: 'single',
                          payment_schedule: [{ stage: 'الأولى', percentage: 100, description: 'عند قبول العرض' }]
                        }))}
                        className="w-4 h-4 text-amber-500"
                      />
                      <span>دفعة واحدة (100%)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="payment_type"
                        checked={quoteForm.payment_type === 'multiple'}
                        onChange={() => setQuoteForm(prev => ({
                          ...prev,
                          payment_type: 'multiple',
                          payment_schedule: [
                            { stage: 'الأولى', percentage: 25, description: 'عند قبول العرض' },
                            { stage: 'الثانية', percentage: 25, description: '' },
                            { stage: 'الثالثة', percentage: 25, description: '' },
                            { stage: 'الرابعة', percentage: 25, description: '' },
                          ]
                        }))}
                        className="w-4 h-4 text-amber-500"
                      />
                      <span>دفعات متعددة</span>
                    </label>
                  </div>

                  {quoteForm.payment_type === 'multiple' && (
                    <div className="space-y-3">
                      {quoteForm.payment_schedule.map((payment, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                          <span className="font-medium text-slate-700 w-16">{payment.stage}</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={payment.percentage}
                              onChange={(e) => updatePaymentSchedule(index, 'percentage', Number(e.target.value))}
                              className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-center"
                              min="0"
                              max="100"
                            />
                            <span className="text-slate-500">%</span>
                          </div>
                          <input
                            type="text"
                            value={payment.description}
                            onChange={(e) => updatePaymentSchedule(index, 'description', e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                            placeholder="الوصف (مثال: بعد إصدار الوكالة)"
                          />
                          {quoteForm.total_price > 0 && (
                            <span className="text-sm text-slate-500 w-24 text-left">
                              {((quoteForm.total_price * payment.percentage / 100) * 1.15).toLocaleString()} ر.س
                            </span>
                          )}
                          {quoteForm.payment_schedule.length > 1 && (
                            <button
                              onClick={() => removePaymentStage(index)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      
                      <button
                        onClick={addPaymentStage}
                        className="w-full py-2 border-2 border-dashed border-slate-300 hover:border-amber-400 text-slate-500 hover:text-amber-600 rounded-xl transition-colors"
                      >
                        + إضافة دفعة
                      </button>

                      {/* مجموع النسب */}
                      <div className={`text-center p-2 rounded-lg ${
                        quoteForm.payment_schedule.reduce((sum, p) => sum + p.percentage, 0) === 100
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        مجموع النسب: {quoteForm.payment_schedule.reduce((sum, p) => sum + p.percentage, 0)}%
                        {quoteForm.payment_schedule.reduce((sum, p) => sum + p.percentage, 0) !== 100 && ' (يجب أن يساوي 100%)'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* تنبيه */}
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-700">
                  ⚠️ العرض صالح لمدة أسبوع من تاريخ الإرسال
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 rounded-b-2xl">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowQuoteModal(false)}
                  className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSubmitQuote}
                  disabled={isSubmitting || !quoteForm.service_description || quoteForm.total_price <= 0}
                  className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'جاري الإرسال...' : 'إرسال العرض'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Modal: طلب تفاصيل */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="border-b border-slate-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">طلب مزيد من التفاصيل</h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* بيانات الطلب */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-sm">
                  <p><span className="text-slate-500">رقم الطلب:</span> <span className="font-medium">{selectedRequest.request_number}</span></p>
                  <p><span className="text-slate-500">المجال:</span> <span className="font-medium">{getDomainAr(selectedRequest.domain)}</span></p>
                </div>
              </div>

              {/* الاستفسار */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  اكتب استفسارك *
                </label>
                <textarea
                  value={detailForm.question}
                  onChange={(e) => setDetailForm({ question: e.target.value })}
                  rows={5}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none"
                  placeholder="مثال: هل تم توقيع عقد عمل؟ كم مدة العمل في الشركة؟ هل يوجد إنذار مسبق؟"
                />
              </div>

              {/* تنبيه */}
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-sm text-amber-700">
                  ⚠️ تنبيه: لا تكتب معلومات التواصل الخاصة بك (رقم جوال، بريد إلكتروني، حسابات تواصل)
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 rounded-b-2xl">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSubmitDetailRequest}
                  disabled={isSubmitting || !detailForm.question.trim()}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'جاري الإرسال...' : 'إرسال الاستفسار'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
