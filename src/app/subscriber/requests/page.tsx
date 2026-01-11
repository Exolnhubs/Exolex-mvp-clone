'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'

// ═══════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════
interface UnifiedRequest {
  id: string
  request_number: string
  request_type: 'consultation' | 'case' | 'extra_service'
  title: string
  description: string
  status: string
  priority?: string
  sla_hours?: number | null
  sla_deadline?: string | null
  is_sla_breached?: boolean
  created_at: string
  updated_at: string
  assigned_at: string | null
  completed_at: string | null
  closed_at?: string | null
  delivered_at?: string | null
  base_amount?: number
  total_amount?: number
  quoted_amount?: number | null
  quote_details?: string | null
  category_name?: string
  category_color?: string
  source_table: 'service_requests' | 'extra_service_requests'
}

interface User {
  id: string
  full_name: string
}

// ═══════════════════════════════════════════════════════════════
// حالات الطلب
// ═══════════════════════════════════════════════════════════════
const STATUS_CONFIG: { [key: string]: { label: string; color: string; bg: string; icon: string } } = {
  'draft': { label: 'مسودة', color: '#6B7280', bg: '#F3F4F6', icon: '📝' },
  'submitted': { label: 'مقدم', color: '#F59E0B', bg: '#FEF3C7', icon: '📤' },
  'pending': { label: 'بانتظار الرد', color: '#F59E0B', bg: '#FEF3C7', icon: '⏳' },
  'in_review': { label: 'تحت المراجعة', color: '#3B82F6', bg: '#DBEAFE', icon: '🔍' },
  'pending_documents': { label: 'بانتظار مستندات', color: '#8B5CF6', bg: '#EDE9FE', icon: '📎' },
  'pending_info': { label: 'بانتظار معلومات', color: '#8B5CF6', bg: '#EDE9FE', icon: '❓' },
  'pending_quotes': { label: 'بانتظار عروض الأسعار', color: '#3D65AF', bg: '#DBEAFE', icon: '📋' },
  'pending_assignment': { label: 'بانتظار التعيين', color: '#F47A62', bg: '#FEF3C7', icon: '⏳' },
  'pending_payment': { label: 'بانتظار الدفع', color: '#F59E0B', bg: '#FEF3C7', icon: '💳' },  'assigned': { label: 'تم التعيين', color: '#06B6D4', bg: '#CFFAFE', icon: '👤' },
  'in_progress': { label: 'قيد التنفيذ', color: '#3B82F6', bg: '#DBEAFE', icon: '⚙️' },
  'pending_response': { label: 'بانتظار رد المشترك', color: '#EC4899', bg: '#FCE7F3', icon: '💬' },
  'responded': { label: 'تم الرد', color: '#10B981', bg: '#D1FAE5', icon: '✉️' },
  'completed': { label: 'مكتمل', color: '#10B981', bg: '#D1FAE5', icon: '✅' },
  'delivered': { label: 'تم التسليم', color: '#10B981', bg: '#D1FAE5', icon: '📦' },
  'closed': { label: 'مغلق', color: '#6B7280', bg: '#F3F4F6', icon: '🔒' },
  'cancelled': { label: 'ملغي', color: '#EF4444', bg: '#FEE2E2', icon: '❌' },
  // حالات الخدمات الإضافية
  'pending_quote': { label: 'بانتظار عرض السعر', color: '#F59E0B', bg: '#FEF3C7', icon: '💰' },
  'quoted': { label: 'تم تقديم عرض', color: '#8B5CF6', bg: '#EDE9FE', icon: '📋' },
  'pending_payment': { label: 'بانتظار الدفع', color: '#EC4899', bg: '#FCE7F3', icon: '💳' },
  'paid': { label: 'مدفوع', color: '#10B981', bg: '#D1FAE5', icon: '✓' },
}

const REQUEST_TYPE_CONFIG: { [key: string]: { label: string; icon: string; color: string } } = {
  'consultation': { label: 'استشارة', icon: '💬', color: '#3B82F6' },
  'case': { label: 'قضية', icon: '⚖️', color: '#8B5CF6' },
  'extra_service': { label: 'خدمة إضافية', icon: '➕', color: '#F59E0B' },
}

export default function RequestsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [requests, setRequests] = useState<UnifiedRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedRequest, setSelectedRequest] = useState<UnifiedRequest | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    const userId = localStorage.getItem('exolex_user_id')
    if (!userId) { router.push('/auth/login'); return }

    const fetchData = async () => {
      // جلب المستخدم
      const { data: userData } = await supabase
        .from('users').select('id, full_name').eq('id', userId).single()
      if (userData) setUser(userData)

      // جلب member أولاً
      const { data: memberData } = await supabase.from('members').select('id').eq('user_id', userId).single()

      // جلب الاشتراك
      const { data: subData } = await supabase
        .from('subscriptions').select('id, status')
        .eq('member_id', memberData?.id).eq('status', 'active').single()
      if (subData) setIsSubscribed(true)

      // ═══════════════════════════════════════════════════════════════
      // جلب الطلبات من كلا الجدولين
      // ═══════════════════════════════════════════════════════════════
      
      const allRequests: UnifiedRequest[] = []

      // 1. طلبات service_requests (استشارات وقضايا)
      console.log("Member ID:", memberData?.id)
      const { data: serviceRequests, error: reqError } = await supabase
        .from('service_requests')
        .select('*, category:categories(name_ar, color)')
        .eq('member_id', memberData?.id)
        .order('created_at', { ascending: false })

      console.log("Service Requests:", serviceRequests, "Error:", reqError)
      if (serviceRequests) {
        serviceRequests.forEach((req: any) => {
          allRequests.push({
            id: req.id,
            request_number: req.ticket_number,
            request_type: req.request_type || 'consultation',
            title: req.title || 'طلب جديد',
            description: req.description || '',
            status: req.status,
            priority: req.priority,
            sla_hours: req.sla_hours,
            sla_deadline: req.sla_deadline,
            is_sla_breached: req.is_sla_breached,
            created_at: req.created_at,
            updated_at: req.updated_at,
            assigned_at: req.assigned_at,
            completed_at: req.completed_at,
            closed_at: req.closed_at,
            base_amount: req.base_price,
            total_amount: req.total_amount,
            category_name: req.category?.name_ar,
            category_color: req.category?.color,
            source_table: 'service_requests'
          })
        })
      }

      // 2. طلبات extra_service_requests (خدمات إضافية)
      const { data: extraRequests } = await supabase
        .from('extra_service_requests')
        .select('*, service:extra_services(name_ar, category:categories(name_ar, color))')
        .eq('member_id', memberData?.id)
        .order('created_at', { ascending: false })

      if (extraRequests) {
        extraRequests.forEach((req: any) => {
          allRequests.push({
            id: req.id,
            request_number: req.request_number,
            request_type: 'extra_service',
            title: req.service?.name_ar || 'خدمة إضافية',
            description: JSON.stringify(req.form_data) || '',
            status: req.status,
            created_at: req.created_at,
            updated_at: req.updated_at,
            assigned_at: req.assigned_at,
            completed_at: req.completed_at,
            delivered_at: req.delivered_at,
            base_amount: req.base_amount,
            total_amount: req.total_amount,
            quoted_amount: req.quoted_amount,
            quote_details: req.quote_details,
            category_name: req.service?.category?.name_ar,
            category_color: req.service?.category?.color,
            source_table: 'extra_service_requests'
          })
        })
      }

      // ترتيب حسب التاريخ
      allRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      setRequests(allRequests)
      setIsLoading(false)
    }
    fetchData()
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('exolex_user_id')
    localStorage.removeItem('exolex_phone')
    router.push('/auth/login')
  }

  // تصفية الطلبات
  const filteredRequests = selectedType === 'all'
    ? requests
    : requests.filter(r => r.request_type === selectedType)

  // عدد كل نوع
  const counts = {
    all: requests.length,
    consultation: requests.filter(r => r.request_type === 'consultation').length,
    case: requests.filter(r => r.request_type === 'case').length,
    extra_service: requests.filter(r => r.request_type === 'extra_service').length,
  }

  // تنسيق التاريخ
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // تنسيق السعر
  const formatPrice = (amount: number | null | undefined): string => {
    if (!amount) return '-'
    return `${Number(amount).toLocaleString('ar-SA')} ريال`
  }

  // حساب الوقت المتبقي لـ SLA
  const getSlaStatus = (request: UnifiedRequest): { text: string; color: string } => {
    if (!request.sla_deadline) return { text: '-', color: '#6B7280' }
    
    const now = new Date()
    const deadline = new Date(request.sla_deadline)
    const diff = deadline.getTime() - now.getTime()
    
    if (request.is_sla_breached || diff < 0) {
      return { text: 'متأخر', color: '#EF4444' }
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 4) return { text: `${hours} ساعات متبقية`, color: '#F59E0B' }
    if (hours < 24) return { text: `${hours} ساعة متبقية`, color: '#3B82F6' }
    
    const days = Math.floor(hours / 24)
    return { text: `${days} يوم متبقي`, color: '#10B981' }
  }

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || { label: status, color: '#6B7280', bg: '#F3F4F6', icon: '📄' }
  }

  const getTypeConfig = (type: string) => {
    return REQUEST_TYPE_CONFIG[type] || { label: type, icon: '📄', color: '#6B7280' }
  }

  // تحويل form_data لعرض مقروء
  const formatFormData = (description: string): string => {
    try {
      const data = JSON.parse(description)
      return Object.entries(data)
        .filter(([key]) => key !== 'files' && key !== 'file')
        .map(([key, value]) => `${value}`)
        .join(' • ')
    } catch {
      return description
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isSubscribed={isSubscribed} userName={user?.full_name || ''} onLogout={handleLogout} />

      <main className="flex-1 mr-64 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-800">طلباتي</h1>
            <p className="text-gray-500">متابعة جميع طلباتك واستشاراتك وقضاياك</p>
          </div>

          {/* تبويبات الفلترة */}
          <div className="bg-white rounded-xl p-4 mb-6 flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                selectedType === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>📋</span>
              <span>الكل</span>
              <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{counts.all}</span>
            </button>
            
            {Object.entries(REQUEST_TYPE_CONFIG).map(([type, config]) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                  selectedType === type
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={{
                  backgroundColor: selectedType === type ? config.color : undefined
                }}
              >
                <span>{config.icon}</span>
                <span>{config.label}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  selectedType === type ? 'bg-white/20' : 'bg-gray-200'
                }`}>{counts[type as keyof typeof counts]}</span>
              </button>
            ))}
          </div>

          {/* قائمة الطلبات */}
          {filteredRequests.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <span className="text-6xl mb-4 block">📭</span>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">لا توجد طلبات</h3>
              <p className="text-gray-500 mb-4">لم تقم بتقديم أي طلبات بعد</p>
              <button
                onClick={() => router.push('/subscriber/extra-services')}
                className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
              >
                استكشف الخدمات
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => {
                const statusConfig = getStatusConfig(request.status)
                const typeConfig = getTypeConfig(request.request_type)
                const slaStatus = getSlaStatus(request)
                
                return (
                  <div
                    key={request.id}
                    onClick={() => router.push(`/subscriber/requests/${request.id}`)}
                    className="bg-white rounded-xl p-5 hover:shadow-lg transition-all cursor-pointer border-r-4"
                    style={{ borderRightColor: typeConfig.color }}
                  >
                    <div className="flex items-start justify-between">
                      {/* المعلومات الرئيسية */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span 
                            className="text-xs px-2 py-1 rounded-full text-white"
                            style={{ backgroundColor: typeConfig.color }}
                          >
                            {typeConfig.icon} {typeConfig.label}
                          </span>
                          <span className="text-sm font-mono text-gray-400">
                            {request.request_number}
                          </span>
                          {request.category_name && (
                            <span 
                              className="text-xs px-2 py-0.5 rounded"
                              style={{ backgroundColor: `${request.category_color}20`, color: request.category_color }}
                            >
                              {request.category_name}
                            </span>
                          )}
                        </div>
                        
                        <h3 className="font-semibold text-gray-800 mb-1">
                          {request.title}
                        </h3>
                        
                        <p className="text-sm text-gray-500 line-clamp-1">
                          {request.source_table === 'extra_service_requests' 
                            ? formatFormData(request.description)
                            : request.description || 'لا يوجد وصف'}
                        </p>
                      </div>

                      {/* الحالة والتاريخ */}
                      <div className="text-left mr-4">
                        <span 
                          className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full mb-2"
                          style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}
                        >
                          <span>{statusConfig.icon}</span>
                          <span>{statusConfig.label}</span>
                        </span>
                        
                        <p className="text-xs text-gray-400">
                          {formatDate(request.created_at)}
                        </p>
                        
                        {request.total_amount && request.total_amount > 0 && (
                          <p className="text-xs text-green-600 font-medium mt-1">
                            💰 {formatPrice(request.total_amount)}
                          </p>
                        )}
                        
                        {request.sla_deadline && (
                          <p className="text-xs mt-1" style={{ color: slaStatus.color }}>
                            ⏱️ {slaStatus.text}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Modal تفاصيل الطلب */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showDetails && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div 
              className="p-5 text-white"
              style={{ backgroundColor: getTypeConfig(selectedRequest.request_type).color }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">{selectedRequest.request_number}</p>
                  <h3 className="font-bold text-xl mt-1">
                    {selectedRequest.title}
                  </h3>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* حالة الطلب */}
              <div className="flex items-center justify-center mb-6">
                <span 
                  className="inline-flex items-center gap-2 text-lg px-6 py-2 rounded-full"
                  style={{ 
                    backgroundColor: getStatusConfig(selectedRequest.status).bg, 
                    color: getStatusConfig(selectedRequest.status).color 
                  }}
                >
                  <span className="text-xl">{getStatusConfig(selectedRequest.status).icon}</span>
                  <span className="font-medium">{getStatusConfig(selectedRequest.status).label}</span>
                </span>
              </div>

              {/* التفاصيل */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">نوع الطلب</p>
                  <p className="font-medium flex items-center gap-2">
                    <span>{getTypeConfig(selectedRequest.request_type).icon}</span>
                    {getTypeConfig(selectedRequest.request_type).label}
                  </p>
                </div>
                
                {selectedRequest.category_name && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-1">التصنيف</p>
                    <p className="font-medium" style={{ color: selectedRequest.category_color }}>
                      {selectedRequest.category_name}
                    </p>
                  </div>
                )}
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">تاريخ الطلب</p>
                  <p className="font-medium">{formatDate(selectedRequest.created_at)}</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">آخر تحديث</p>
                  <p className="font-medium">{formatDate(selectedRequest.updated_at)}</p>
                </div>

                {selectedRequest.total_amount && selectedRequest.total_amount > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-1">💰 المبلغ</p>
                    <p className="font-medium text-green-600">{formatPrice(selectedRequest.total_amount)}</p>
                  </div>
                )}

                {selectedRequest.quoted_amount && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-1">💰 عرض السعر</p>
                    <p className="font-medium text-purple-600">{formatPrice(selectedRequest.quoted_amount)}</p>
                  </div>
                )}

                {selectedRequest.assigned_at && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-1">تاريخ الاستلام</p>
                    <p className="font-medium">{formatDate(selectedRequest.assigned_at)}</p>
                  </div>
                )}

                {selectedRequest.completed_at && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-1">تاريخ الإكمال</p>
                    <p className="font-medium">{formatDate(selectedRequest.completed_at)}</p>
                  </div>
                )}

                {selectedRequest.delivered_at && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-1">📦 تاريخ التسليم</p>
                    <p className="font-medium">{formatDate(selectedRequest.delivered_at)}</p>
                  </div>
                )}

                {selectedRequest.sla_deadline && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-1">⏱️ SLA</p>
                    <p className="font-medium" style={{ color: getSlaStatus(selectedRequest).color }}>
                      {getSlaStatus(selectedRequest).text}
                    </p>
                  </div>
                )}
              </div>

              {/* بيانات النموذج للخدمات الإضافية */}
              {selectedRequest.source_table === 'extra_service_requests' && (
                <div className="mb-6">
                  <p className="text-xs text-gray-400 mb-2">تفاصيل الطلب</p>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {(() => {
                      try {
                        const data = JSON.parse(selectedRequest.description)
                        return (
                          <div className="space-y-2">
                            {Object.entries(data).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-gray-500">{key}:</span>
                                <span className="font-medium">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        )
                      } catch {
                        return <p>{selectedRequest.description}</p>
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* عرض السعر إذا موجود */}
              {selectedRequest.quote_details && (
                <div className="mb-6">
                  <p className="text-xs text-gray-400 mb-2">تفاصيل عرض السعر</p>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <p className="text-gray-700">{selectedRequest.quote_details}</p>
                  </div>
                </div>
              )}

              {/* Timeline - سجل الحالات */}
              <div className="mb-6">
                <p className="text-xs text-gray-400 mb-3">سجل الطلب</p>
                <div className="relative pr-4 border-r-2 border-gray-200">
                  <div className="mb-4">
                    <div className="absolute right-[-9px] w-4 h-4 bg-green-500 rounded-full"></div>
                    <p className="text-sm font-medium text-gray-800">تم إنشاء الطلب</p>
                    <p className="text-xs text-gray-400">{formatDate(selectedRequest.created_at)}</p>
                  </div>
                  
                  {selectedRequest.assigned_at && (
                    <div className="mb-4">
                      <div className="absolute right-[-9px] w-4 h-4 bg-blue-500 rounded-full"></div>
                      <p className="text-sm font-medium text-gray-800">تم تعيين محامي</p>
                      <p className="text-xs text-gray-400">{formatDate(selectedRequest.assigned_at)}</p>
                    </div>
                  )}
                  
                  {selectedRequest.completed_at && (
                    <div className="mb-4">
                      <div className="absolute right-[-9px] w-4 h-4 bg-green-500 rounded-full"></div>
                      <p className="text-sm font-medium text-gray-800">تم الإكمال</p>
                      <p className="text-xs text-gray-400">{formatDate(selectedRequest.completed_at)}</p>
                    </div>
                  )}
                  
                  {selectedRequest.delivered_at && (
                    <div className="mb-4">
                      <div className="absolute right-[-9px] w-4 h-4 bg-teal-500 rounded-full"></div>
                      <p className="text-sm font-medium text-gray-800">تم التسليم</p>
                      <p className="text-xs text-gray-400">{formatDate(selectedRequest.delivered_at)}</p>
                    </div>
                  )}
                  
                  {selectedRequest.closed_at && (
                    <div className="mb-4">
                      <div className="absolute right-[-9px] w-4 h-4 bg-gray-500 rounded-full"></div>
                      <p className="text-sm font-medium text-gray-800">تم الإغلاق</p>
                      <p className="text-xs text-gray-400">{formatDate(selectedRequest.closed_at)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setShowDetails(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-300"
              >
                إغلاق
              </button>
              {/* أزرار إضافية حسب حالة الطلب */}
              {selectedRequest.status === 'pending_response' && (
                <button className="flex-1 bg-primary-600 text-white py-3 rounded-xl hover:bg-primary-700">
                  💬 الرد على الطلب
                </button>
              )}
              {selectedRequest.status === 'pending_payment' && (
                <button className="flex-1 bg-green-600 text-white py-3 rounded-xl hover:bg-green-700">
                  💳 ادفع الآن
                </button>
              )}
              {selectedRequest.status === 'quoted' && (
                <button className="flex-1 bg-green-600 text-white py-3 rounded-xl hover:bg-green-700">
                  ✓ قبول العرض والدفع
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
