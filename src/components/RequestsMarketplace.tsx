'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Clock, FileText, DollarSign, CheckCircle, Send, AlertCircle, Search, RefreshCw, Eye } from 'lucide-react'

interface ServiceRequest {
  id: string
  ticket_number: string
  title: string
  description: string
  request_type: 'consultation' | 'case' | 'extra_service'
  source: 'package' | 'extra_services_page' | 'web'
  status: string
  priority: 'normal' | 'urgent' | 'emergency'
  base_price: number | null
  is_accepted: boolean
  assigned_lawyer_id: string | null
  created_at: string
  sla_deadline: string | null
  category?: { id: string; name_ar: string; name_en: string }
  subcategory?: { id: string; name_ar: string; name_en: string }
  service?: { id: string; title_ar: string; title_en: string }
  member?: { id: string; user?: { full_name: string; city: string } }
}

interface RequestsMarketplaceProps {
  userType: 'independent' | 'legal_arm_lawyer' | 'partner' | 'partner_employee'
  userId: string
  partnerId?: string
  legalArmId?: string
  detailsPath: string
  locale?: 'ar' | 'en'
}

export default function RequestsMarketplace({ userType, userId, partnerId, legalArmId, detailsPath, locale = 'ar' }: RequestsMarketplaceProps) {
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'priced' | 'quote'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null)
  const [quoteForm, setQuoteForm] = useState({ price: 0, description: '', estimated_days: 7 })
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState<{id: string, name_ar: string, name_en: string}[]>([])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('service_requests')
        .select(`*, category:service_categories(id, name_ar, name_en), subcategory:service_subcategories(id, name_ar, name_en), service:legal_services(id, title_ar, title_en), member:members(id, user:users(full_name, city))`)
        .eq('request_type', 'extra_service')
        .eq('status', 'pending_assignment')
        .eq('is_accepted', false)
        .is('assigned_lawyer_id', null)
        .order('created_at', { ascending: false })
      if (fetchError) throw fetchError
      setRequests(data || [])
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في جلب الطلبات')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    const { data } = await supabase.from('service_categories').select('id, name_ar, name_en').eq('is_active', true).order('sort_order')
    setCategories(data || [])
  }

  useEffect(() => { fetchRequests(); fetchCategories() }, [])

  const handleRefresh = async () => { setRefreshing(true); await fetchRequests(); setRefreshing(false) }

  const handleAcceptRequest = async (request: ServiceRequest) => {
    if (!confirm('هل أنت متأكد من قبول هذا الطلب؟')) return
    try {
      setSubmitting(true)
      const { error: updateError } = await supabase.from('service_requests').update({
        is_accepted: true, assigned_lawyer_id: userId, status: 'in_progress', accepted_at: new Date().toISOString(),
        handler_type: userType === 'independent' ? 'independent' : userType === 'legal_arm_lawyer' ? 'legal_arm' : 'partner',
        handler_id: userType === 'partner' || userType === 'partner_employee' ? partnerId : userType === 'legal_arm_lawyer' ? legalArmId : userId
      }).eq('id', request.id)
      if (updateError) throw updateError
      await supabase.from('request_logs').insert({ request_id: request.id, action: 'accepted', action_by: userId, action_by_type: userType, notes: 'تم قبول الطلب من منصة الطلبات' })
      setRequests(prev => prev.filter(r => r.id !== request.id))
      alert('تم قبول الطلب بنجاح!')
    } catch (err: any) { alert('حدث خطأ: ' + err.message) } finally { setSubmitting(false) }
  }

  const handleSubmitQuote = async () => {
    if (!selectedRequest || quoteForm.price <= 0) { alert('الرجاء إدخال سعر صحيح'); return }
    try {
      setSubmitting(true)
      const { error: quoteError } = await supabase.from('service_quotes').insert({
        request_id: selectedRequest.id, lawyer_id: userId, lawyer_type: userType, partner_id: partnerId || null, legal_arm_id: legalArmId || null,
        price: quoteForm.price, description: quoteForm.description, estimated_days: quoteForm.estimated_days,
        platform_commission: quoteForm.price * 0.30, lawyer_amount: quoteForm.price * 0.70, status: 'pending',
        expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      })
      if (quoteError) throw quoteError
      if (selectedRequest.status !== 'pending_quotes') await supabase.from('service_requests').update({ status: 'pending_quotes' }).eq('id', selectedRequest.id)
      await supabase.from('request_logs').insert({ request_id: selectedRequest.id, action: 'quote_submitted', action_by: userId, action_by_type: userType, notes: `تم إرسال عرض سعر: ${quoteForm.price} ريال` })
      setShowQuoteModal(false); setSelectedRequest(null); setQuoteForm({ price: 0, description: '', estimated_days: 7 })
      alert('تم إرسال عرض السعر بنجاح!')
    } catch (err: any) { alert('حدث خطأ: ' + err.message) } finally { setSubmitting(false) }
  }

  const filteredRequests = requests.filter(request => {
    if (filterType === 'priced' && (!request.base_price || request.base_price === 0)) return false
    if (filterType === 'quote' && request.base_price && request.base_price > 0) return false
    if (filterCategory !== 'all' && request.category?.id !== filterCategory) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!request.ticket_number?.toLowerCase().includes(q) && !request.title?.toLowerCase().includes(q) && !request.category?.name_ar?.toLowerCase().includes(q)) return false
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

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
  if (error) return <div className="flex flex-col items-center justify-center min-h-[400px] gap-4"><AlertCircle className="w-12 h-12 text-red-500" /><p className="text-red-600">{error}</p><button onClick={handleRefresh} className="px-4 py-2 bg-blue-600 text-white rounded-lg">إعادة المحاولة</button></div>

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-gradient-to-l from-blue-600 to-blue-800 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold mb-2">منصة الطلبات</h1><p className="text-blue-100">الطلبات المتاحة للقبول أو تقديم عروض الأسعار</p></div>
          <button onClick={handleRefresh} disabled={refreshing} className="p-3 bg-white/20 rounded-xl hover:bg-white/30"><RefreshCw className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} /></button>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 rounded-xl p-4 text-center"><div className="text-3xl font-bold">{requests.length}</div><div className="text-blue-100 text-sm">إجمالي</div></div>
          <div className="bg-white/10 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-emerald-300">{requests.filter(r => r.base_price && r.base_price > 0).length}</div><div className="text-blue-100 text-sm">🟢 مسعّرة</div></div>
          <div className="bg-white/10 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-amber-300">{requests.filter(r => !r.base_price || r.base_price === 0).length}</div><div className="text-blue-100 text-sm">🟡 تحتاج عرض</div></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="ابحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-lg" />
          </div>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setFilterType('all')} className={`px-4 py-2 rounded-md text-sm ${filterType === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}>الكل</button>
            <button onClick={() => setFilterType('priced')} className={`px-4 py-2 rounded-md text-sm ${filterType === 'priced' ? 'bg-emerald-500 text-white' : 'text-gray-600'}`}>🟢 مسعّرة</button>
            <button onClick={() => setFilterType('quote')} className={`px-4 py-2 rounded-md text-sm ${filterType === 'quote' ? 'bg-amber-500 text-white' : 'text-gray-600'}`}>🟡 عرض</button>
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-lg">
            <option value="all">جميع التصنيفات</option>
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name_ar}</option>)}
          </select>
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center"><FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="text-xl font-semibold text-gray-700">لا توجد طلبات متاحة</h3></div>
      ) : (
        <div className="space-y-4">
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
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{request.title || request.service?.title_ar || 'طلب خدمة'}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1"><FileText className="w-4 h-4" />{request.category?.name_ar || 'غير محدد'}</span>
                      {request.subcategory && <span>← {request.subcategory.name_ar}</span>}
                    </div>
                    {request.description && <p className="text-gray-600 text-sm line-clamp-2 mb-3">{request.description}</p>}
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{new Date(request.created_at).toLocaleDateString('ar-SA')}</span>
                      {request.member?.user?.city && <span>📍 {request.member.user.city}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-4">
                    {request.base_price && request.base_price > 0 && (
                      <div className="text-left">
                        <div className="text-2xl font-bold text-emerald-600">{request.base_price.toLocaleString()} <span className="text-sm">ر.س</span></div>
                        <div className="text-xs text-gray-500">عمولتك: {(request.base_price * 0.7).toLocaleString()} ر.س</div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <a href={`${detailsPath}/${request.id}`} className="p-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"><Eye className="w-5 h-5" /></a>
                      {reqType.type === 'priced' ? (
                        <button onClick={() => handleAcceptRequest(request)} disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                          <CheckCircle className="w-5 h-5" /><span>قبول</span>
                        </button>
                      ) : (
                        <button onClick={() => { setSelectedRequest(request); setShowQuoteModal(true) }} disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
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

      {showQuoteModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="bg-amber-500 text-white p-6 rounded-t-2xl">
              <h2 className="text-xl font-bold">إرسال عرض سعر</h2>
              <p className="text-amber-100 text-sm mt-1">{selectedRequest.ticket_number} - {selectedRequest.title || selectedRequest.service?.title_ar}</p>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">السعر (ر.س) *</label>
                <input type="number" min="0" value={quoteForm.price || ''} onChange={(e) => setQuoteForm(prev => ({ ...prev, price: Number(e.target.value) }))} className="w-full px-4 py-3 border border-gray-200 rounded-lg text-lg" placeholder="0" />
                {quoteForm.price > 0 && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex justify-between"><span>عمولة المنصة (30%)</span><span className="text-red-600">- {(quoteForm.price * 0.3).toLocaleString()} ر.س</span></div>
                    <div className="flex justify-between font-bold mt-2 pt-2 border-t"><span>صافي لك</span><span className="text-emerald-600">{(quoteForm.price * 0.7).toLocaleString()} ر.س</span></div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">المدة المتوقعة</label>
                <select value={quoteForm.estimated_days} onChange={(e) => setQuoteForm(prev => ({ ...prev, estimated_days: Number(e.target.value) }))} className="w-full px-4 py-3 border border-gray-200 rounded-lg">
                  <option value={1}>يوم</option><option value={3}>3 أيام</option><option value={7}>أسبوع</option><option value={14}>أسبوعين</option><option value={30}>شهر</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">وصف العرض</label>
                <textarea value={quoteForm.description} onChange={(e) => setQuoteForm(prev => ({ ...prev, description: e.target.value }))} rows={3} className="w-full px-4 py-3 border border-gray-200 rounded-lg resize-none" placeholder="اشرح نطاق العمل..." />
              </div>
              <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800">صلاحية العرض 3 أيام</div>
            </div>
            <div className="flex gap-3 p-6 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => { setShowQuoteModal(false); setSelectedRequest(null) }} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg">إلغاء</button>
              <button onClick={handleSubmitQuote} disabled={submitting || quoteForm.price <= 0} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-lg disabled:opacity-50">
                {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><Send className="w-5 h-5" /><span>إرسال</span></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
