'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { 
  FileText, Search, Clock, CheckCircle, XCircle, Eye, Calendar,
  Building2, User, Loader2, FileSignature, Send, DollarSign,
  AlertCircle, Filter
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 صفحة العروض الموحدة - الشريك / الذراع / المحامي المستقل
// ═══════════════════════════════════════════════════════════════════════════════
// 📌 التبويبات:
//    1. بانتظار الموافقة: عروض مرسلة بانتظار رد المشترك
//    2. عروض مقبولة: عروض تم قبولها + أزرار (إنشاء عقد، نموذج وكالة)
//    3. عملاء خارجيين: للشريك والمستقل فقط
// ═══════════════════════════════════════════════════════════════════════════════

interface Quote {
  id: string
  quote_number: string
  title: string
  description: string
  subtotal: number
  vat_amount: number
  total_amount: number
  platform_fee_percent: number
  platform_fee_amount: number
  partner_earnings: number
  status: string
  valid_until: string
  created_at: string
  updated_at: string
  service_request?: { id: string; ticket_number: string; title: string } | null
  subscriber?: { id: string; user_id: string } | null
  client?: { id: string; full_name: string; company_name: string } | null
  installments?: { id: string; description: string; percentage: number; amount: number }[]
}

const quoteStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'مسودة', color: 'bg-slate-100 text-slate-700', icon: FileText },
  pending: { label: 'بانتظار الموافقة', color: 'bg-amber-100 text-amber-700', icon: Clock },
  accepted: { label: 'مقبول', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'مرفوض', color: 'bg-red-100 text-red-700', icon: XCircle },
  expired: { label: 'منتهي', color: 'bg-slate-100 text-slate-500', icon: AlertCircle },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700', icon: XCircle },
}

type TabType = 'pending' | 'accepted' | 'external'
type UserType = 'partner' | 'legal_arm' | 'lawyer'

export default function QuotesPage() {
  const router = useRouter()
  
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [userType, setUserType] = useState<UserType>('partner')
  const [userId, setUserId] = useState<string | null>(null)
  
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [stats, setStats] = useState({ pending: 0, accepted: 0, external: 0 })
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      
      // تحديد نوع المستخدم
      const partnerId = localStorage.getItem('exolex_partner_id')
      const legalArmId = localStorage.getItem('exolex_legal_arm_id')
      const lawyerId = localStorage.getItem('exolex_lawyer_id')
      
      let id: string | null = null
      let type: UserType = 'partner'
      let tableName = 'partner_quotes'
      let idField = 'partner_id'
      
      if (partnerId) {
        id = partnerId
        type = 'partner'
        tableName = 'partner_quotes'
        idField = 'partner_id'
      } else if (legalArmId) {
        id = legalArmId
        type = 'legal_arm'
        tableName = 'partner_quotes'
        idField = 'legal_arm_id'
      } else if (lawyerId) {
        id = lawyerId
        type = 'lawyer'
        tableName = 'service_quotes'
        idField = 'lawyer_id'
      }
      
      if (!id) {
        toast.error('يرجى تسجيل الدخول')
        router.push('/auth/login')
        return
      }
      
      setUserId(id)
      setUserType(type)
      
      await loadQuotes(id, tableName, idField, type)
      
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const loadQuotes = async (id: string, tableName: string, idField: string, type: UserType) => {
    const { data, error } = await supabase
      .from(tableName)
      .select(`
        *,
        service_request:service_request_id (id, ticket_number, title),
        client:client_id (id, full_name, company_name)
      `)
      .eq(idField, id)
      .order('created_at', { ascending: false })

    if (error) throw error
    
    const quotesList = data || []
    setQuotes(quotesList)
    
    // حساب الإحصائيات
    const pendingCount = quotesList.filter(q => q.status === 'pending').length
    const acceptedCount = quotesList.filter(q => q.status === 'accepted').length
    const externalCount = quotesList.filter(q => q.client_id !== null).length
    
    setStats({
      pending: pendingCount,
      accepted: acceptedCount,
      external: externalCount
    })
  }

  const getFilteredData = () => {
    let data: Quote[] = []
    
    if (activeTab === 'pending') {
      data = quotes.filter(q => q.status === 'pending')
    } else if (activeTab === 'accepted') {
      data = quotes.filter(q => q.status === 'accepted')
    } else if (activeTab === 'external') {
      data = quotes.filter(q => q.client_id !== null)
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      data = data.filter(q => 
        q.title?.toLowerCase().includes(term) ||
        q.quote_number?.toLowerCase().includes(term)
      )
    }
    
    return data
  }

  const calculateTimeRemaining = (validUntil: string | null) => {
    if (!validUntil) return null
    const now = new Date()
    const end = new Date(validUntil)
    const diff = end.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    
    if (days < 0) return { text: 'منتهي', color: 'text-red-600' }
    if (days === 0) return { text: 'ينتهي اليوم', color: 'text-red-600' }
    if (days <= 2) return { text: `${days} يوم`, color: 'text-amber-600' }
    return { text: `${days} يوم`, color: 'text-green-600' }
  }

  const getPortalPath = () => {
    if (userType === 'partner') return '/partner'
    if (userType === 'legal_arm') return '/legal-arm'
    if (userType === 'lawyer') return '/lawyer'
    return '/partner'
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
            <DollarSign className="w-8 h-8 text-blue-600" />
            عروض الأسعار
          </h1>
          <p className="text-slate-500 mt-1">إدارة عروض الأسعار المرسلة</p>
        </div>
      </div>

      {/* البطاقات الإحصائية */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{stats.pending}</div>
              <div className="text-sm text-slate-500">بانتظار الموافقة</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{stats.accepted}</div>
              <div className="text-sm text-slate-500">عروض مقبولة</div>
            </div>
          </div>
        </div>
        {(userType === 'partner' || userType === 'lawyer') && (
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.external}</div>
                <div className="text-sm text-slate-500">عملاء خارجيين</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* المحتوى الرئيسي */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {/* التبويبات */}
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'pending' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              بانتظار الموافقة
              {stats.pending > 0 && (
                <span className={`mr-2 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === 'pending' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}>{stats.pending}</span>
              )}
              {activeTab === 'pending' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
            </button>
            
            <button
              onClick={() => setActiveTab('accepted')}
              className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'accepted' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              عروض مقبولة
              {stats.accepted > 0 && (
                <span className={`mr-2 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === 'accepted' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}>{stats.accepted}</span>
              )}
              {activeTab === 'accepted' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
            </button>
            
            {(userType === 'partner' || userType === 'lawyer') && (
              <button
                onClick={() => setActiveTab('external')}
                className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'external' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                عملاء خارجيين
                {stats.external > 0 && (
                  <span className={`mr-2 px-2 py-0.5 text-xs rounded-full ${
                    activeTab === 'external' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}>{stats.external}</span>
                )}
                {activeTab === 'external' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
              </button>
            )}
          </div>
        </div>

        {/* شريط البحث */}
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالعنوان أو رقم العرض..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* قائمة العروض */}
        <div className="p-4">
          {getFilteredData().length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">
                {activeTab === 'pending' && 'لا توجد عروض بانتظار الموافقة'}
                {activeTab === 'accepted' && 'لا توجد عروض مقبولة'}
                {activeTab === 'external' && 'لا توجد عروض لعملاء خارجيين'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {getFilteredData().map((quote) => {
                const status = quoteStatusConfig[quote.status] || quoteStatusConfig.draft
                const timeRemaining = calculateTimeRemaining(quote.valid_until)
                
                return (
                  <div 
                    key={quote.id}
                    className="p-4 border border-slate-200 bg-white rounded-xl hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-mono text-slate-500">{quote.quote_number}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${status.color}`}>
                            <status.icon className="w-3 h-3" />
                            {status.label}
                          </span>
                          {quote.client_id && (
                            <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              عميل خارجي
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-slate-900">{quote.title}</h3>
                        {quote.service_request && (
                          <p className="text-sm text-slate-500">طلب: #{quote.service_request.ticket_number}</p>
                        )}
                        {quote.client && (
                          <p className="text-sm text-slate-500">العميل: {quote.client.company_name || quote.client.full_name}</p>
                        )}
                      </div>
                      
                      <div className="text-left">
                        <div className="text-lg font-bold text-slate-900">
                          {quote.total_amount?.toLocaleString('ar-SA')} ر.س
                        </div>
                        <div className="text-xs text-slate-500">شامل الضريبة</div>
                      </div>
                    </div>
                    
                    {/* البيانات المالية */}
                    <div className="grid grid-cols-3 gap-4 p-3 bg-slate-50 rounded-lg mb-4">
                      <div>
                        <div className="text-xs text-slate-500">السعر</div>
                        <div className="font-medium">{quote.subtotal?.toLocaleString('ar-SA')} ر.س</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">عمولة المنصة</div>
                        <div className="font-medium text-red-600">-{quote.platform_fee_amount?.toLocaleString('ar-SA')} ر.س</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">صافي الربح</div>
                        <div className="font-medium text-green-600">{quote.partner_earnings?.toLocaleString('ar-SA')} ر.س</div>
                      </div>
                    </div>
                    
                    {/* التاريخ والصلاحية */}
                    <div className="flex items-center justify-between text-sm mb-4">
                      <div className="flex items-center gap-4 text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(quote.created_at).toLocaleDateString('ar-SA')}
                        </span>
                        {timeRemaining && quote.status === 'pending' && (
                          <span className={`flex items-center gap-1 ${timeRemaining.color}`}>
                            <Clock className="w-4 h-4" />
                            صالح لمدة: {timeRemaining.text}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* الإجراءات */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100 flex-wrap">
                      <button
                        onClick={() => {
                          setSelectedQuote(quote)
                          setShowDetailsModal(true)
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        التفاصيل
                      </button>
                      
                      {/* أزرار للعروض المقبولة */}
                      {quote.status === 'accepted' && (
                        <div className="flex items-center gap-2 mr-auto">
                          <button
                            onClick={() => router.push(`${getPortalPath()}/contracts/new?quote=${quote.id}`)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
                          >
                            <FileSignature className="w-4 h-4" />
                            إنشاء عقد
                          </button>
                          <button
                            onClick={() => router.push(`${getPortalPath()}/power-of-attorney/new?quote=${quote.id}`)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded-lg transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            نموذج وكالة
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: تفاصيل العرض */}
      {showDetailsModal && selectedQuote && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selectedQuote.title}</h2>
                <p className="text-sm text-slate-500">{selectedQuote.quote_number}</p>
              </div>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* الحالة */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500">الحالة:</span>
                <span className={`px-3 py-1 rounded-full text-sm ${quoteStatusConfig[selectedQuote.status]?.color}`}>
                  {quoteStatusConfig[selectedQuote.status]?.label}
                </span>
              </div>
              
              {/* الوصف */}
              {selectedQuote.description && (
                <div>
                  <h3 className="font-bold text-slate-900 mb-2">الوصف</h3>
                  <p className="text-slate-600 bg-slate-50 p-4 rounded-lg">{selectedQuote.description}</p>
                </div>
              )}
              
              {/* البيانات المالية */}
              <div>
                <h3 className="font-bold text-slate-900 mb-2">البيانات المالية</h3>
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">السعر الأساسي:</span>
                    <span className="font-medium">{selectedQuote.subtotal?.toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ضريبة القيمة المضافة (15%):</span>
                    <span className="font-medium">{selectedQuote.vat_amount?.toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="font-bold">الإجمالي:</span>
                    <span className="font-bold text-lg">{selectedQuote.total_amount?.toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
                    <span className="text-slate-500">عمولة المنصة ({selectedQuote.platform_fee_percent}%):</span>
                    <span className="text-red-600">-{selectedQuote.platform_fee_amount?.toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700 font-medium">صافي الربح:</span>
                    <span className="text-green-700 font-bold">{selectedQuote.partner_earnings?.toLocaleString('ar-SA')} ر.س</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                إغلاق
              </button>
              {selectedQuote.status === 'accepted' && (
                <>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false)
                      router.push(`${getPortalPath()}/contracts/new?quote=${selectedQuote.id}`)
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <FileSignature className="w-4 h-4" />
                    إنشاء عقد
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
