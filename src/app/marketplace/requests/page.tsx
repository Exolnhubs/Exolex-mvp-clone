'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Clock, FileText, CheckCircle, Send, AlertCircle, Search, RefreshCw, Eye, X, Download, Coins, Flag, FileIcon, User } from 'lucide-react'
import QuoteFormModal, { QuoteFormData } from '@/components/QuoteFormModal'

interface ServiceRequest {
  id: string
  ticket_number: string
  title: string
  description: string
  request_type: string
  status: string
  priority: 'normal' | 'urgent' | 'emergency'
  base_price: number | null
  is_accepted: boolean | null
  created_at: string
  category_id: string | null
  attachments: any[]
  sla_deadline: string | null
  member_id: string | null
}

export default function MarketplaceRequestsPage() {
  const [availableRequests, setAvailableRequests] = useState<ServiceRequest[]>([])
  const [acceptedRequests, setAcceptedRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'priced' | 'quote'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lawyerId, setLawyerId] = useState<string | null>(null)
  
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null)

  useEffect(() => {
    const id = localStorage.getItem('exolex_lawyer_id')
    if (id) setLawyerId(id)
  }, [])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      
      const { data: available } = await supabase
        .from('service_requests')
        .select('*')
        .eq('request_type', 'extra_service')
        .in('status', ['pending_assignment', 'pending_quotes'])
        .is('assigned_lawyer_id', null)
        .order('created_at', { ascending: false })
      
      if (available) {
        setAvailableRequests(available.filter(r => r.is_accepted !== true))
      }

      const { data: accepted } = await supabase
        .from('service_requests')
        .select('*')
        .eq('request_type', 'extra_service')
        .eq('is_accepted', true)
        .order('accepted_at', { ascending: false })
        .limit(10)
      
      if (accepted) {
        setAcceptedRequests(accepted)
      }

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])

  const handleRefresh = async () => { setRefreshing(true); await fetchRequests(); setRefreshing(false) }

  const handleAcceptRequest = async (request: ServiceRequest) => {
    const currentLawyerId = lawyerId || localStorage.getItem('exolex_lawyer_id')
    if (!currentLawyerId) { alert('الرجاء تسجيل الدخول أولاً'); return }
    if (!confirm('هل أنت متأكد من قبول هذا الطلب؟')) return
    
    try {
      setSubmitting(true)
      const { error } = await supabase
        .from('service_requests')
        .update({
          is_accepted: true,
          assigned_lawyer_id: currentLawyerId,
          status: 'in_progress',
          accepted_at: new Date().toISOString()
        })
        .eq('id', request.id)
      
      if (error) { alert('حدث خطأ: ' + error.message); return }
      
      setAvailableRequests(prev => prev.filter(r => r.id !== request.id))
      setShowDetailModal(false)
      alert('تم قبول الطلب بنجاح!')
    } catch (err: any) {
      alert('حدث خطأ: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // إرسال عرض السعر - متوافق مع أعمدة قاعدة البيانات
  // ═══════════════════════════════════════════════════════════════
  const handleSubmitQuote = async (formData: QuoteFormData) => {
    const currentLawyerId = lawyerId || localStorage.getItem('exolex_lawyer_id')
    if (!currentLawyerId) { alert('الرجاء تسجيل الدخول أولاً'); return }
    if (!selectedRequest) return
    
    try {
      setSubmitting(true)
      
      // توليد رقم العرض
      const quoteNumber = `QT-${Date.now().toString().slice(-8)}`
      
      // إنشاء عرض السعر بالأعمدة الصحيحة
      const { data: quote, error: quoteError } = await supabase
        .from('service_quotes')
        .insert({
          request_id: selectedRequest.id,
          lawyer_id: currentLawyerId,
          quote_number: quoteNumber,
          quote_type: formData.payment_type, // 'single' أو 'multiple'
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
      
      if (quoteError) {
        console.error('Error submitting quote:', quoteError)
        alert('حدث خطأ: ' + quoteError.message)
        return
      }
      
      // إضافة الدفعات إذا كانت متعددة
      if (formData.payment_type === 'multiple' && formData.installments.length > 0 && quote) {
        const installmentsData = formData.installments.map((inst, index) => ({
          quote_id: quote.id,
          installment_number: index + 1,
          description: inst.description,
          percentage: inst.valueType === 'percentage' ? inst.value : null,
          amount: inst.calculatedAmount,
          status: index === 0 ? 'pending' : 'not_due'
        }))
        
        const { error: installmentsError } = await supabase
          .from('quote_installments')
          .insert(installmentsData)
        
        if (installmentsError) {
          console.error('Error saving installments:', installmentsError)
        }
      }
      
      // تحديث حالة الطلب
      await supabase
        .from('service_requests')
        .update({ status: 'pending_quotes' })
        .eq('id', selectedRequest.id)
      
      setShowQuoteModal(false)
      setSelectedRequest(null)
      alert('تم إرسال عرض السعر بنجاح!')
      
    } catch (err: any) {
      console.error(err)
      alert('حدث خطأ: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const openDetailModal = (request: ServiceRequest) => { setSelectedRequest(request); setShowDetailModal(true) }
  const openQuoteModal = (request: ServiceRequest) => { setSelectedRequest(request); setShowDetailModal(false); setShowQuoteModal(true) }

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `منذ ${days} يوم`
    if (hours > 0) return `منذ ${hours} ساعة`
    return `منذ ${minutes} دقيقة`
  }

  const filteredRequests = availableRequests.filter(request => {
    if (filterType === 'priced' && (!request.base_price || request.base_price === 0)) return false
    if (filterType === 'quote' && request.base_price && request.base_price > 0) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!request.ticket_number?.toLowerCase().includes(q) && !request.title?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const getRequestType = (request: ServiceRequest) => request.base_price && request.base_price > 0 
    ? { type: 'priced', label: 'مسعّرة', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    : { type: 'quote', label: 'تحتاج عرض سعر', color: 'bg-amber-100 text-amber-700 border-amber-200' }

  const getPriorityBadge = (priority: string) => {
    if (priority === 'urgent') return { label: 'عاجل', color: 'bg-orange-100 text-orange-700' }
    if (priority === 'emergency') return { label: 'طارئ', color: 'bg-red-100 text-red-700' }
    return { label: 'عادي', color: 'bg-gray-100 text-gray-600' }
  }

  const getFileIcon = (filename: string) => {
    if (filename?.endsWith('.pdf')) return { bg: 'bg-red-100', color: 'text-red-600' }
    if (filename?.endsWith('.doc') || filename?.endsWith('.docx')) return { bg: 'bg-blue-100', color: 'text-blue-600' }
    return { bg: 'bg-gray-100', color: 'text-gray-600' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      
      {!lawyerId && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-yellow-800">وضع المعاينة</p>
            <p className="text-sm text-yellow-700">سجل دخول كمحامي لتتمكن من قبول الطلبات.</p>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-l from-blue-600 to-blue-800 rounded-2xl p-6 text-white mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">🏪 منصة الطلبات الموحدة</h1>
            <p className="text-blue-100">جميع الطلبات المتاحة للمحامين - الخدمات الإضافية</p>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} className="p-3 bg-white/20 rounded-xl hover:bg-white/30">
            <RefreshCw className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold">{availableRequests.length}</div>
            <div className="text-blue-100 text-sm">طلبات متاحة</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-emerald-300">{availableRequests.filter(r => r.base_price && r.base_price > 0).length}</div>
            <div className="text-blue-100 text-sm">🟢 مسعّرة</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-amber-300">{availableRequests.filter(r => !r.base_price || r.base_price === 0).length}</div>
            <div className="text-blue-100 text-sm">🟡 تحتاج عرض</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-gray-300">{acceptedRequests.length}</div>
            <div className="text-blue-100 text-sm">⚫ تم قبولها</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="ابحث برقم الطلب أو العنوان..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setFilterType('all')} className={`px-4 py-2 rounded-md text-sm font-medium ${filterType === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}>الكل</button>
            <button onClick={() => setFilterType('priced')} className={`px-4 py-2 rounded-md text-sm font-medium ${filterType === 'priced' ? 'bg-emerald-500 text-white' : 'text-gray-600'}`}>🟢 مسعّرة</button>
            <button onClick={() => setFilterType('quote')} className={`px-4 py-2 rounded-md text-sm font-medium ${filterType === 'quote' ? 'bg-amber-500 text-white' : 'text-gray-600'}`}>🟡 تحتاج عرض</button>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold text-gray-800 mb-4">📋 الطلبات المتاحة</h2>
      
      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center mb-8">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">لا توجد طلبات متاحة</h3>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          {filteredRequests.map((request) => {
            const reqType = getRequestType(request)
            const priority = getPriorityBadge(request.priority)
            return (
              <div key={request.id} className={`bg-white rounded-xl border-2 ${reqType.type === 'priced' ? 'border-emerald-200 hover:border-emerald-400' : 'border-amber-200 hover:border-amber-400'} p-6 transition-all hover:shadow-lg`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-mono text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">{request.ticket_number}</span>
                      <span className={`text-xs px-3 py-1 rounded-full border ${reqType.color}`}>{reqType.label}</span>
                      {request.priority !== 'normal' && <span className={`text-xs px-3 py-1 rounded-full ${priority.color}`}>{priority.label}</span>}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{request.title || 'طلب خدمة'}</h3>
                    {request.description && <p className="text-gray-600 text-sm line-clamp-2 mb-3">{request.description}</p>}
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{getTimeAgo(request.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-4">
                    {request.base_price && request.base_price > 0 && (
                      <div className="text-left">
                        <div className="text-2xl font-bold text-emerald-600">{request.base_price.toLocaleString()} ر.س</div>
                        <div className="text-xs text-gray-500">عمولتك: {(request.base_price * 0.7).toLocaleString()} ر.س</div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button onClick={() => openDetailModal(request)} className="p-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"><Eye className="w-5 h-5" /></button>
                      {reqType.type === 'priced' ? (
                        <button onClick={() => handleAcceptRequest(request)} disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                          <CheckCircle className="w-5 h-5" /><span>قبول</span>
                        </button>
                      ) : (
                        <button onClick={() => openQuoteModal(request)} disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
                          <Send className="w-5 h-5" /><span>إرسال عرض</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {acceptedRequests.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-gray-500 mb-4">⚫ طلبات تم قبولها مؤخراً</h2>
          <div className="space-y-4">
            {acceptedRequests.map((request) => (
              <div key={request.id} className="bg-gray-100 rounded-xl border-2 border-gray-200 p-6 opacity-60">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-mono text-sm bg-gray-200 text-gray-500 px-2 py-1 rounded">{request.ticket_number}</span>
                      <span className="text-xs px-3 py-1 rounded-full bg-gray-300 text-gray-600">تم القبول ✓</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-500 mb-2">{request.title || 'طلب خدمة'}</h3>
                  </div>
                  {request.base_price && request.base_price > 0 && (
                    <div className="text-xl font-bold text-gray-400">{request.base_price.toLocaleString()} ر.س</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal تفاصيل الطلب */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-[520px] max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-b from-blue-50 to-white rounded-t-xl px-6 py-5 border-b border-gray-200">
              <div className="flex items-start justify-between mb-3">
                <span className="inline-block px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-lg">{selectedRequest.ticket_number}</span>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">تفاصيل الطلب</h2>
            </div>
            <div className="overflow-y-auto px-6 py-5 flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-5">{selectedRequest.title || 'طلب خدمة'}</h3>
              <div className="bg-gray-50 rounded-lg p-4 mb-5 space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-600 text-sm">كود المرسل:</span>
                  <span className="text-gray-900 font-semibold font-mono">USR-{selectedRequest.member_id?.slice(0,8) || '****'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Coins className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-600 text-sm">السعر:</span>
                  {selectedRequest.base_price && selectedRequest.base_price > 0 ? (
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-lg">{selectedRequest.base_price.toLocaleString()} ر.س</span>
                  ) : (
                    <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-bold rounded-lg">يحتاج عرض سعر</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-600 text-sm">تاريخ الطلب:</span>
                  <span className="text-gray-900 font-semibold">{getTimeAgo(selectedRequest.created_at)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Flag className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-600 text-sm">الأولوية:</span>
                  <span className={`inline-block px-3 py-1 text-sm font-bold rounded-lg ${getPriorityBadge(selectedRequest.priority).color}`}>{getPriorityBadge(selectedRequest.priority).label}</span>
                </div>
              </div>
              <div className="mb-5">
                <h4 className="text-base font-bold text-gray-800 mb-3">📝 وصف الطلب</h4>
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <p className="text-gray-700 leading-relaxed">{selectedRequest.description || 'لا يوجد وصف'}</p>
                </div>
              </div>
              <div className="mb-5">
                <h4 className="text-base font-bold text-gray-800 mb-3">📎 المرفقات</h4>
                {selectedRequest.attachments && selectedRequest.attachments.length > 0 ? (
                  <div className="space-y-2">
                    {selectedRequest.attachments.map((file: any, index: number) => {
                      const fileStyle = getFileIcon(file.name || file)
                      return (
                        <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white hover:bg-blue-50 cursor-pointer group">
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`w-10 h-10 ${fileStyle.bg} rounded-lg flex items-center justify-center`}>
                              <FileIcon className={`w-5 h-5 ${fileStyle.color}`} />
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{file.name || file}</p>
                          </div>
                          <Download className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100" />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-lg text-gray-500">لا توجد مرفقات</div>
                )}
              </div>
            </div>
            <div className="bg-gray-50 rounded-b-xl px-6 py-4 border-t border-gray-200">
              <div className="flex gap-3">
                {selectedRequest.base_price && selectedRequest.base_price > 0 ? (
                  <button onClick={() => handleAcceptRequest(selectedRequest)} disabled={submitting} className="flex-1 bg-emerald-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50">
                    {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><CheckCircle className="w-5 h-5" />قبول الطلب</>}
                  </button>
                ) : (
                  <button onClick={() => openQuoteModal(selectedRequest)} className="flex-1 bg-amber-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-amber-600 flex items-center justify-center gap-2">
                    <Send className="w-5 h-5" />تقديم عرض
                  </button>
                )}
                <button onClick={() => setShowDetailModal(false)} className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-50">إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal عرض السعر الجديد */}
      <QuoteFormModal
        isOpen={showQuoteModal}
        onClose={() => { setShowQuoteModal(false); setSelectedRequest(null) }}
        onSubmit={handleSubmitQuote}
        request={selectedRequest}
        submitting={submitting}
      />
    </div>
  )
}
