'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { 
  Package, Clock, CheckCheck, Eye, RefreshCw, 
  ArrowLeft, AlertCircle, FileText, Bell, Inbox
} from 'lucide-react'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// 📌 صفحة طلبات الباقات - محامي الذراع القانوني
// 📅 تاريخ التحديث: 20 يناير 2026
// 🎯 الغرض: عرض طلبات الباقات (المتاحة + المسندة)
// ═══════════════════════════════════════════════════════════════

interface PackageRequest {
    id: string
    ticket_number: string
    title: string
    description: string
    status: string
    priority: 'normal' | 'urgent' | 'emergency'
    created_at: string
    assigned_at: string | null
    accepted_at: string | null
    is_accepted: boolean
    sla_deadline: string | null
    category_id: string | null
    service_path_id: string | null
    categories?: { name_ar: string }[] | null
    service_paths?: { name_ar: string }[] | null
  }

type TabType = 'available' | 'assigned'

export default function PackageRequestsPage() {
  const router = useRouter()
  const [availableRequests, setAvailableRequests] = useState<PackageRequest[]>([])
  const [assignedRequests, setAssignedRequests] = useState<PackageRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lawyerId, setLawyerId] = useState<string | null>(null)
  const [legalArmId, setLegalArmId] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('available')

  useEffect(() => {
    const id = localStorage.getItem('exolex_lawyer_id')
    const armId = localStorage.getItem('exolex_legal_arm_id')
    if (!id) {
      router.push('/auth/lawyer-login')
      return
    }
    setLawyerId(id)
    setLegalArmId(armId)
    fetchAllRequests(id, armId)
  }, [])

  const fetchAllRequests = async (lawyerId: string, armId: string | null) => {
    try {
      setLoading(true)
      
      // 1. طلبات الباقات المتاحة (غير مسندة)
      const { data: available, error: err1 } = await supabase
        .from('service_requests')
        .select('*')
        .eq('source', 'package')
        .eq('handler_type', 'legal_arm')
        .is('assigned_lawyer_id', null)
        .in('status', ['pending_assignment', 'new', 'open'])
        .order('created_at', { ascending: false })

      if (err1) console.error('Error available:', err1)
      console.log("Available:", available)
      setAvailableRequests(available || [])

      // 2. طلبات الباقات المسندة لهذا المحامي
      const { data: assigned, error: err2 } = await supabase
        .from('service_requests')
        .select('*')
        .eq('source', 'package')
        .eq('assigned_lawyer_id', lawyerId)
        .order('created_at', { ascending: false })

      if (err2) console.error('Error:', err2)
      console.log("Assigned:", assigned)
      setAssignedRequests(assigned || [])
      console.log("Assigned requests:", assigned); setAssignedRequests(assigned || [])

    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ في جلب الطلبات')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (requestId: string) => {
    if (!lawyerId) return
    
    setAcceptingId(requestId)
    try {
      const { error } = await supabase
        .from('service_requests')
        .update({
          assigned_lawyer_id: lawyerId,
          assigned_at: new Date().toISOString(),
          is_accepted: true,
          accepted_at: new Date().toISOString(),
          status: 'in_progress'
        })
        .eq('id', requestId)

      if (error) throw error
      
      toast.success('✅ تم قبول الطلب')
      fetchAllRequests(lawyerId, legalArmId)
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ')
    } finally {
      setAcceptingId(null)
    }
  }

  const handleRefresh = async () => {
    if (!lawyerId) return
    setRefreshing(true)
    await fetchAllRequests(lawyerId, legalArmId)
    setRefreshing(false)
    toast.success('تم التحديث')
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

  const getSlaStatus = (deadline: string | null, isAccepted: boolean, acceptedAt: string | null) => {
    if (!deadline) return null
    if (!isAccepted) return { text: 'يبدأ عند القبول', color: 'bg-gray-400', percentage: 0 }
    
    const now = Date.now()
    const deadlineTime = new Date(deadline).getTime()
    const startTime = acceptedAt ? new Date(acceptedAt).getTime() : now
    const totalTime = deadlineTime - startTime
    const elapsed = now - startTime
    const percentage = Math.min(100, Math.max(0, (elapsed / totalTime) * 100))
    
    if (percentage >= 100) return { text: 'متأخر!', color: 'bg-red-600', percentage: 100 }
    if (percentage >= 90) return { text: `${Math.ceil((deadlineTime - now) / 60000)} د`, color: 'bg-red-500 animate-pulse', percentage }
    if (percentage >= 70) return { text: `${Math.ceil((deadlineTime - now) / 3600000)} س`, color: 'bg-red-500', percentage }
    if (percentage >= 30) return { text: `${Math.ceil((deadlineTime - now) / 3600000)} س`, color: 'bg-yellow-500', percentage }
    
    const hours = Math.ceil((deadlineTime - now) / 3600000)
    return { text: hours > 24 ? `${Math.floor(hours/24)} يوم` : `${hours} س`, color: 'bg-green-500', percentage }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'emergency': return { label: 'طارئ', color: 'bg-red-100 text-red-700' }
      case 'urgent': return { label: 'عاجل', color: 'bg-orange-100 text-orange-700' }
      default: return { label: 'عادي', color: 'bg-gray-100 text-gray-700' }
    }
  }

  const getStatusBadge = (status: string, isAccepted: boolean) => {
    if (!isAccepted) return { label: 'بانتظار القبول', color: 'bg-yellow-100 text-yellow-700' }
    switch (status) {
      case 'in_progress': return { label: 'قيد التنفيذ', color: 'bg-blue-100 text-blue-700' }
      case 'completed': return { label: 'مكتمل', color: 'bg-green-100 text-green-700' }
      default: return { label: status, color: 'bg-gray-100 text-gray-700' }
    }
  }

  // عدد الطلبات المسندة غير المقبولة (تحتاج انتباه)
  const pendingAcceptanceCount = assignedRequests.filter(r => !r.is_accepted).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Package className="w-6 h-6 text-emerald-600" />
              طلبات الباقات
            </h1>
            <p className="text-gray-500 text-sm">طلبات المشتركين من الباقات</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {/* Counter Alert for Assigned Requests */}
      {pendingAcceptanceCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 mb-6 flex items-center gap-3 animate-pulse">
          <Bell className="w-6 h-6 text-yellow-600" />
          <div>
            <p className="text-yellow-800 font-bold">لديك {pendingAcceptanceCount} طلب مسند بانتظار القبول!</p>
            <p className="text-yellow-600 text-sm">يرجى مراجعة الطلبات المسندة وقبولها لبدء العمل</p>
          </div>
          <button 
            onClick={() => setActiveTab('assigned')}
            className="mr-auto px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium"
          >
            عرض الطلبات
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('available')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'available' 
              ? 'bg-white text-emerald-700 shadow-sm' 
              : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Inbox className="w-5 h-5" />
          متاحة للقبول
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200'}`}>
            {availableRequests.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('assigned')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'assigned' 
              ? 'bg-white text-blue-700 shadow-sm' 
              : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          <FileText className="w-5 h-5" />
          مسندة إليّ
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'assigned' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200'}`}>
            {assignedRequests.length}
          </span>
          {pendingAcceptanceCount > 0 && (
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'available' ? (
        // Available Requests
        availableRequests.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">لا توجد طلبات متاحة</h3>
            <p className="text-gray-400">جميع طلبات الباقات تم إسنادها أو لا توجد طلبات جديدة</p>
          </div>
        ) : (
          <div className="space-y-4">
            {availableRequests.map((request) => {
              const priorityBadge = getPriorityBadge(request.priority)
              
              return (
                <div
                  key={request.id}
                  className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all border-r-4 border-emerald-500"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-mono text-gray-500">{request.ticket_number}</span>
                        <span className="px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700">طلب باقة</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${priorityBadge.color}`}>{priorityBadge.label}</span>
                      </div>
                      
                      <h3 className="font-semibold text-gray-800 mb-1">
                        {request.title || request.description?.slice(0, 60) || 'طلب خدمة قانونية'}
                      </h3>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                      {request.categories?.[0]?.name_ar && (
  <span className="bg-gray-100 px-2 py-0.5 rounded">{request.categories[0].name_ar}</span>

                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {getTimeAgo(request.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mr-4">
                      <Link
                        href={`/legal-arm-lawyer/package-requests/${request.id}`}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        <Eye className="w-4 h-4" />
                        التفاصيل
                      </Link>
                      <button
                        onClick={() => handleAccept(request.id)}
                        disabled={acceptingId === request.id}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {acceptingId === request.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCheck className="w-4 h-4" />
                        )}
                        قبول
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        // Assigned Requests
        assignedRequests.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">لا توجد طلبات مسندة</h3>
            <p className="text-gray-400">لم يتم إسناد أي طلبات إليك بعد</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignedRequests.map((request) => {
              const priorityBadge = getPriorityBadge(request.priority)
              const statusBadge = getStatusBadge(request.status, request.is_accepted)
              const sla = getSlaStatus(request.sla_deadline, request.is_accepted, request.accepted_at)
              
              return (
                <div
                  key={request.id}
                  className={`bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all border-r-4 ${
                    !request.is_accepted ? 'border-yellow-500' : 
                    request.status === 'completed' ? 'border-green-500' : 'border-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-mono text-gray-500">{request.ticket_number}</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${statusBadge.color}`}>{statusBadge.label}</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${priorityBadge.color}`}>{priorityBadge.label}</span>
                      </div>
                      
                      <h3 className="font-semibold text-gray-800 mb-1">
                        {request.title || request.description?.slice(0, 60) || 'طلب خدمة قانونية'}
                      </h3>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {getTimeAgo(request.created_at)}
                        </span>
                        {sla && (
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs text-white ${sla.color}`}>
                              SLA: {sla.text}
                            </span>
                            {sla.percentage > 0 && (
                              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${sla.color} transition-all`}
                                  style={{ width: `${sla.percentage}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mr-4">
                      {!request.is_accepted ? (
                        <>
                          <Link
                            href={`/legal-arm-lawyer/package-requests/${request.id}`}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                          >
                            <Eye className="w-4 h-4" />
                            التفاصيل
                          </Link>
                          <button
                            onClick={() => handleAccept(request.id)}
                            disabled={acceptingId === request.id}
                            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                          >
                            {acceptingId === request.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCheck className="w-4 h-4" />
                            )}
                            قبول الآن
                          </button>
                        </>
                      ) : (
                        <Link
                          href={`/legal-arm-lawyer/my-tasks/${request.id}`}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          إدارة الطلب
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}