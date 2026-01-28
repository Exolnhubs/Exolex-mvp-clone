'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getLawyerId, getLegalArmId, getPartnerId } from '@/lib/cookies'
import { 
  FileText, Search, Clock, CheckCircle, Eye, Calendar, Loader2, 
  Send, DollarSign, AlertCircle, User, Tag, MapPin, Timer,
  Check, X, Building2
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 صفحة الطلبات الموحدة - الشريك / الذراع / المحامي المستقل
// ═══════════════════════════════════════════════════════════════════════════════
// 📌 هذه الصفحة تعرض فقط طلبات الخدمات الإضافية (extra_service)
// 📌 طلبات الباقات (consultation, case) تذهب فقط للذراع القانوني
// ═══════════════════════════════════════════════════════════════════════════════
// 📌 التبويبات:
//    1. طلبات جاهزة للقبول: خدمات مسعرة جاهزة للقبول المباشر
//    2. طلبات تحتاج عرض سعر: طلبات تنتظر إرسال عرض سعر
// ═══════════════════════════════════════════════════════════════════════════════

interface ServiceRequest {
  id: string
  ticket_number: string
  title: string
  description: string
  request_type: string
  service_type: 'priced' | 'quote_needed'
  fixed_price: number | null
  status: string
  priority: string
  sla_due_at: string | null
  created_at: string
  is_accepted: boolean
  accepted_by: string | null
  category?: { id: string; name_ar: string } | null
  subcategory?: { id: string; name_ar: string } | null
  member?: { id: string; user_id: string } | null
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  normal: { label: 'عادي', color: 'bg-slate-100 text-slate-600' },
  urgent: { label: 'عاجل', color: 'bg-orange-100 text-orange-600' },
  emergency: { label: 'طارئ', color: 'bg-red-100 text-red-600' },
}

type TabType = 'ready_to_accept' | 'needs_quote'
type UserType = 'partner' | 'legal_arm' | 'lawyer'

export default function RequestsPage() {
  const router = useRouter()
  
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('ready_to_accept')
  const [userType, setUserType] = useState<UserType>('partner')
  const [userId, setUserId] = useState<string | null>(null)
  
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [stats, setStats] = useState({ ready: 0, needsQuote: 0 })
  
  const [searchTerm, setSearchTerm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Modal لإرسال عرض سعر
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null)
  const [quoteForm, setQuoteForm] = useState({
    title: '',
    description: '',
    subtotal: 0,
    valid_days: 7
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      
      // تحديد نوع المستخدم
      const partnerId = getPartnerId()
      const legalArmId = getLegalArmId()
      const lawyerId = getLawyerId()
      
      let id: string | null = null
      let type: UserType = 'partner'
      
      if (partnerId) {
        id = partnerId
        type = 'partner'
      } else if (legalArmId) {
        id = legalArmId
        type = 'legal_arm'
      } else if (lawyerId) {
        id = lawyerId
        type = 'lawyer'
      }
      
      if (!id) {
        toast.error('يرجى تسجيل الدخول')
        router.push('/auth/login')
        return
      }
      
      setUserId(id)
      setUserType(type)
      
      await loadRequests()
      
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const loadRequests = async () => {
    // جلب طلبات الخدمات الإضافية فقط (المتاحة وغير مقبولة)
    const { data, error } = await supabase
      .from('service_requests')
      .select(`
        *,
        category:category_id (id, name_ar),
        subcategory:subcategory_id (id, name_ar)
      `)
      .eq('request_type', 'extra_service')  // فقط الخدمات الإضافية
      .in('status', ['pending', 'open', 'available'])
      .or('is_accepted.is.null,is_accepted.eq.false')
      .order('created_at', { ascending: false })

    if (error) throw error
    
    const requestsList = data || []
    setRequests(requestsList)
    
    // حساب الإحصائيات
    const readyCount = requestsList.filter(r => r.service_type === 'priced').length
    const needsQuoteCount = requestsList.filter(r => r.service_type === 'quote_needed').length
    
    setStats({
      ready: readyCount,
      needsQuote: needsQuoteCount
    })
  }

  const getFilteredData = () => {
    let data: ServiceRequest[] = []
    
    if (activeTab === 'ready_to_accept') {
      data = requests.filter(r => r.service_type === 'priced')
    } else if (activeTab === 'needs_quote') {
      data = requests.filter(r => r.service_type === 'quote_needed')
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      data = data.filter(r => 
        r.title?.toLowerCase().includes(term) ||
        r.ticket_number?.toLowerCase().includes(term)
      )
    }
    
    return data
  }

  const getSlaRemaining = (slaDate: string | null) => {
    if (!slaDate) return null
    const now = new Date()
    const sla = new Date(slaDate)
    const diff = sla.getTime() - now.getTime()
    const hours = Math.ceil(diff / (1000 * 60 * 60))
    
    if (hours < 0) return { text: 'منتهي', color: 'text-red-600 bg-red-50' }
    if (hours <= 4) return { text: `${hours} ساعة`, color: 'text-red-600 bg-red-50' }
    if (hours <= 12) return { text: `${hours} ساعة`, color: 'text-orange-600 bg-orange-50' }
    if (hours <= 24) return { text: `${hours} ساعة`, color: 'text-amber-600 bg-amber-50' }
    const days = Math.ceil(hours / 24)
    return { text: `${days} يوم`, color: 'text-green-600 bg-green-50' }
  }

  const handleAcceptRequest = async (request: ServiceRequest) => {
    try {
      setIsSubmitting(true)
      
      const updateField = userType === 'partner' ? 'assigned_partner_id' 
                        : userType === 'legal_arm' ? 'assigned_legal_arm_id' 
                        : 'assigned_lawyer_id'
      
      const { error } = await supabase
        .from('service_requests')
        .update({ 
          [updateField]: userId,
          is_accepted: true,
          accepted_by: userId,
          accepted_at: new Date().toISOString(),
          status: 'in_progress'
        })
        .eq('id', request.id)

      if (error) throw error
      
      toast.success('تم قبول الطلب بنجاح')
      loadRequests()
      
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في قبول الطلب')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSendQuote = async () => {
    if (!selectedRequest || !userId) return
    if (!quoteForm.title || quoteForm.subtotal <= 0) {
      toast.error('يرجى تعبئة جميع الحقول المطلوبة')
      return
    }
    
    try {
      setIsSubmitting(true)
      
      const vatAmount = quoteForm.subtotal * 0.15
      const totalAmount = quoteForm.subtotal + vatAmount
      const platformFeePercent = 30
      const platformFeeAmount = quoteForm.subtotal * (platformFeePercent / 100)
      const partnerEarnings = quoteForm.subtotal - platformFeeAmount
      
      const validUntil = new Date()
      validUntil.setDate(validUntil.getDate() + quoteForm.valid_days)
      
      const tableName = userType === 'lawyer' ? 'service_quotes' : 'partner_quotes'
      const idField = userType === 'partner' ? 'partner_id' 
                    : userType === 'legal_arm' ? 'legal_arm_id' 
                    : 'lawyer_id'
      
      const { error } = await supabase
        .from(tableName)
        .insert({
          [idField]: userId,
          service_request_id: selectedRequest.id,
          title: quoteForm.title,
          description: quoteForm.description,
          subtotal: quoteForm.subtotal,
          vat_amount: vatAmount,
          total_amount: totalAmount,
          platform_fee_percent: platformFeePercent,
          platform_fee_amount: platformFeeAmount,
          partner_earnings: partnerEarnings,
          valid_until: validUntil.toISOString(),
          status: 'pending'
        })

      if (error) throw error
      
      toast.success('تم إرسال عرض السعر بنجاح')
      setShowQuoteModal(false)
      setSelectedRequest(null)
      setQuoteForm({ title: '', description: '', subtotal: 0, valid_days: 7 })
      
      // الانتقال لصفحة العروض
      const portalPath = userType === 'partner' ? '/partner' 
                       : userType === 'legal_arm' ? '/legal-arm' 
                       : '/independent'
      router.push(`${portalPath}/quotes`)
      
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في إرسال العرض')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPortalPath = () => {
    if (userType === 'partner') return '/partner'
    if (userType === 'legal_arm') return '/legal-arm'
    return '/independent'
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-500">جاري تحميل البيانات...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            طلبات الخدمات الإضافية
          </h1>
          <p className="text-slate-500 mt-1">استعرض الطلبات وقم بالقبول أو إرسال عرض سعر</p>
        </div>
      </div>

      {/* البطاقات الإحصائية */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          onClick={() => setActiveTab('ready_to_accept')}
          className={`bg-white rounded-xl p-4 border shadow-sm cursor-pointer transition-all ${
            activeTab === 'ready_to_accept' ? 'border-green-500 ring-2 ring-green-100' : 'border-slate-200 hover:border-green-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{stats.ready}</div>
              <div className="text-sm text-slate-500">جاهزة للقبول (مسعرة)</div>
            </div>
          </div>
        </div>
        <div 
          onClick={() => setActiveTab('needs_quote')}
          className={`bg-white rounded-xl p-4 border shadow-sm cursor-pointer transition-all ${
            activeTab === 'needs_quote' ? 'border-amber-500 ring-2 ring-amber-100' : 'border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{stats.needsQuote}</div>
              <div className="text-sm text-slate-500">تحتاج عرض سعر</div>
            </div>
          </div>
        </div>
      </div>

      {/* المحتوى الرئيسي */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {/* التبويبات */}
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('ready_to_accept')}
              className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'ready_to_accept' ? 'text-green-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              🟢 جاهزة للقبول
              {stats.ready > 0 && (
                <span className={`mr-2 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === 'ready_to_accept' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                }`}>{stats.ready}</span>
              )}
              {activeTab === 'ready_to_accept' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600" />}
            </button>
            
            <button
              onClick={() => setActiveTab('needs_quote')}
              className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'needs_quote' ? 'text-amber-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              💰 تحتاج عرض سعر
              {stats.needsQuote > 0 && (
                <span className={`mr-2 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === 'needs_quote' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}>{stats.needsQuote}</span>
              )}
              {activeTab === 'needs_quote' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600" />}
            </button>
          </div>
        </div>

        {/* شريط البحث */}
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالعنوان أو رقم الطلب..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* قائمة الطلبات */}
        <div className="p-4">
          {getFilteredData().length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">
                {activeTab === 'ready_to_accept' && 'لا توجد طلبات جاهزة للقبول حالياً'}
                {activeTab === 'needs_quote' && 'لا توجد طلبات تحتاج عرض سعر حالياً'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {getFilteredData().map((request) => {
                const priority = priorityConfig[request.priority] || priorityConfig.normal
                const slaStatus = getSlaRemaining(request.sla_due_at)
                const isExpired = slaStatus?.text === 'منتهي'
                
                return (
                  <div 
                    key={request.id}
                    className={`p-4 border rounded-xl transition-all ${
                      isExpired 
                        ? 'border-slate-200 bg-slate-50 opacity-60' 
                        : 'border-slate-200 bg-white hover:shadow-md hover:border-green-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-mono text-slate-500">{request.ticket_number}</span>
                          <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">
                            خدمة إضافية
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${priority.color}`}>
                            {priority.label}
                          </span>
                          {activeTab === 'ready_to_accept' && request.fixed_price && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-bold">
                              {request.fixed_price.toLocaleString('ar-SA')} ر.س
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-slate-900">{request.title}</h3>
                        {request.category && (
                          <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                            <Tag className="w-3 h-3" />
                            {request.category.name_ar}
                            {request.subcategory && ` / ${request.subcategory.name_ar}`}
                          </p>
                        )}
                      </div>
                      
                      {slaStatus && (
                        <div className={`px-3 py-1 rounded-lg text-sm ${slaStatus.color}`}>
                          <div className="flex items-center gap-1">
                            <Timer className="w-4 h-4" />
                            {slaStatus.text}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {request.description && (
                      <p className="text-sm text-slate-600 mb-4 line-clamp-2">{request.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(request.created_at).toLocaleDateString('ar-SA')}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`${getPortalPath()}/requests/${request.id}`)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          التفاصيل
                        </button>
                        
                        {activeTab === 'ready_to_accept' && !isExpired && (
                          <button
                            onClick={() => handleAcceptRequest(request)}
                            disabled={isSubmitting}
                            className="flex items-center gap-1 px-4 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            قبول الطلب
                          </button>
                        )}
                        
                        {activeTab === 'needs_quote' && !isExpired && (
                          <button
                            onClick={() => {
                              setSelectedRequest(request)
                              setQuoteForm(prev => ({ ...prev, title: request.title }))
                              setShowQuoteModal(true)
                            }}
                            className="flex items-center gap-1 px-4 py-1.5 text-sm bg-amber-500 text-white hover:bg-amber-600 rounded-lg transition-colors"
                          >
                            <Send className="w-4 h-4" />
                            إرسال عرض سعر
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: إرسال عرض سعر */}
      {showQuoteModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">إرسال عرض سعر</h2>
                <p className="text-sm text-slate-500">طلب: #{selectedRequest.ticket_number}</p>
              </div>
              <button 
                onClick={() => {
                  setShowQuoteModal(false)
                  setSelectedRequest(null)
                }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  عنوان العرض <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={quoteForm.title}
                  onChange={(e) => setQuoteForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="مثال: عرض سعر لخدمة..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  وصف الخدمة
                </label>
                <textarea
                  value={quoteForm.description}
                  onChange={(e) => setQuoteForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="وصف تفصيلي للخدمة المقدمة..."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    السعر (ر.س) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={quoteForm.subtotal || ''}
                    onChange={(e) => setQuoteForm(prev => ({ ...prev, subtotal: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    صلاحية العرض (أيام)
                  </label>
                  <input
                    type="number"
                    value={quoteForm.valid_days}
                    onChange={(e) => setQuoteForm(prev => ({ ...prev, valid_days: parseInt(e.target.value) || 7 }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="30"
                  />
                </div>
              </div>
              
              {quoteForm.subtotal > 0 && (
                <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">السعر الأساسي:</span>
                    <span>{quoteForm.subtotal.toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ضريبة القيمة المضافة (15%):</span>
                    <span>{(quoteForm.subtotal * 0.15).toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-slate-200 pt-2">
                    <span>الإجمالي للعميل:</span>
                    <span>{(quoteForm.subtotal * 1.15).toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  <div className="flex justify-between text-red-600 border-t border-slate-200 pt-2">
                    <span>عمولة المنصة (30%):</span>
                    <span>-{(quoteForm.subtotal * 0.3).toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  <div className="flex justify-between text-green-600 font-bold">
                    <span>صافي ربحك:</span>
                    <span>{(quoteForm.subtotal * 0.7).toLocaleString('ar-SA')} ر.س</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowQuoteModal(false)
                  setSelectedRequest(null)
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={handleSendQuote}
                disabled={isSubmitting || !quoteForm.title || quoteForm.subtotal <= 0}
                className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                إرسال العرض
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
