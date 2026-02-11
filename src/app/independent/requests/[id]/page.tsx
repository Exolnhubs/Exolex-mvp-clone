'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRealtimeInsert } from '@/hooks/useSupabaseRealtime'
import toast from 'react-hot-toast'
import { getLawyerId } from '@/lib/cookies'
import {
  ArrowRight, Clock, User, FileText, Calendar, MessageSquare,
  Send, Paperclip, Bot, Search, Timer, Check, X,
  AlertCircle, CheckCircle, XCircle, Scale, Gavel,
  Download, Eye, Upload, Lock
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 تفاصيل الطلب - المحامي المستقل
// تاريخ: 1 يناير 2026
// ملاحظة: المحامي المستقل يعمل بمفرده - لا يوجد مشاركة مع آخرين
// ═══════════════════════════════════════════════════════════════════════════════

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'قيد الانتظار', color: 'bg-gray-100 text-gray-700', icon: Clock },
  assigned: { label: 'معين', color: 'bg-indigo-100 text-indigo-700', icon: User },
  accepted: { label: 'مقبول', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  in_progress: { label: 'قيد العمل', color: 'bg-indigo-100 text-indigo-700', icon: Timer },
  completed: { label: 'مكتمل', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed: { label: 'مغلق', color: 'bg-slate-100 text-slate-700', icon: XCircle },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700', icon: XCircle },
}

const typeConfig: Record<string, { label: string; color: string }> = {
  consultation: { label: 'استشارة', color: 'bg-indigo-500' },
  case: { label: 'قضية', color: 'bg-blue-500' },
  extra_service: { label: 'خدمة إضافية', color: 'bg-purple-500' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  normal: { label: 'عادي', color: 'bg-slate-100 text-slate-600' },
  urgent: { label: 'عاجل', color: 'bg-orange-100 text-orange-600' },
  emergency: { label: 'طارئ', color: 'bg-red-100 text-red-600' },
}

const workTypeLabels: Record<string, string> = {
  research: 'بحث',
  drafting: 'كتابة',
  review: 'مراجعة',
  meeting: 'اجتماع',
  call: 'مكالمة',
  court: 'محكمة',
  other: 'أخرى',
}

export default function IndependentRequestDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = params.id as string
  const fileInputRef = useRef<HTMLInputElement>(null)

  // States
  const [isLoading, setIsLoading] = useState(true)
  const [request, setRequest] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [timeLogs, setTimeLogs] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])

  // معلومات المحامي الحالي
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    hasLicense: boolean;
    licenseValid: boolean;
  } | null>(null)

  // التبويب النشط
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'files' | 'timeline'>('overview')
  
  // الرسائل
  const [newMessage, setNewMessage] = useState('')
  
  // Modals
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showTimeLogModal, setShowTimeLogModal] = useState(false)
  const [showConvertCaseModal, setShowConvertCaseModal] = useState(false)

  // نماذج الإدخال
  const [rejectReason, setRejectReason] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  
  // Time log form
  const [timeLogForm, setTimeLogForm] = useState({
    hours: '',
    work_type: 'research',
    description: ''
  })

  // حساب الصلاحيات - المحامي المستقل هو دائماً صاحب الطلب
  const isOwner = request?.assigned_lawyer_id === currentUser?.id
  const canRespond = isOwner && ['accepted', 'in_progress'].includes(request?.status)
  const canCloseRequest = isOwner

  // Realtime: listen for new messages on this request
  useRealtimeInsert(
    `messages-${requestId}`,
    'messages',
    `request_id=eq.${requestId}`,
    (newMsg: any) => {
      if (!newMsg.private) {
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
      }
    },
    !!requestId
  )

  useEffect(() => { loadData() }, [requestId])

  const loadData = async () => {
    try {
      const lawyerId = getLawyerId()
      if (!lawyerId) {
        router.push('/auth/lawyer-login')
        return
      }

      // جلب معلومات المحامي الحالي
      const { data: lawyerData, error: lawyerError } = await supabase
        .from('lawyers')
        .select('id, full_name, license_number, license_expiry, lawyer_type')
        .eq('id', lawyerId)
        .single()

      if (lawyerError || !lawyerData) {
        router.push('/auth/lawyer-login')
        return
      }

      // التحقق من أنه محامي مستقل
      if (lawyerData.lawyer_type !== 'independent') {
        toast.error('هذه الصفحة للمحامين المستقلين فقط')
        router.push('/auth/lawyer-login')
        return
      }

      const licenseValid = lawyerData.license_expiry 
        ? new Date(lawyerData.license_expiry) > new Date() 
        : false

      setCurrentUser({
        id: lawyerData.id,
        name: lawyerData.full_name || 'محامي',
        hasLicense: !!lawyerData.license_number,
        licenseValid
      })

      // جلب الطلب
      const { data: requestData, error: requestError } = await supabase
        .from('service_requests')
        .select(`
          *,
          category:category_id(name_ar, icon),
          subcategory:subcategory_id(name_ar)
        `)
        .eq('id', requestId)
        .single()

      if (requestError) throw requestError

      // التحقق من أن الطلب معين لهذا المحامي
      if (requestData.assigned_lawyer_id !== lawyerId) {
        toast.error('ليس لديك صلاحية لعرض هذا الطلب')
        router.push('/independent/requests')
        return
      }

      setRequest(requestData)

      // تسجيل دخول للطلب
      await logActivity('view_request', 'عرض تفاصيل الطلب')

      // رسائل المشترك
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true })
      setMessages(messagesData?.filter(m => !m.private) || [])

      // سجل الوقت
      const { data: timeData } = await supabase
        .from('lawyer_time_logs')
        .select('*')
        .eq('request_id', requestId)
        .eq('lawyer_id', lawyerId)
        .order('work_date', { ascending: false })
      setTimeLogs(timeData || [])

      // الملفات المرفقة من المحامي
      const { data: filesData } = await supabase
        .from('request_internal_chat')
        .select('*')
        .eq('request_id', requestId)
        .eq('sender_id', lawyerId)
        .not('attachments', 'is', null)
        .order('created_at', { ascending: false })
      
      const allFiles = filesData?.flatMap(msg => 
        (msg.attachments || []).map((f: any) => ({
          ...f,
          uploaded_at: msg.created_at
        }))
      ) || []
      setFiles(allFiles)

      // التايملاين
      const { data: timelineData } = await supabase
        .from('activity_logs')
        .select('*')
        .or(`metadata->>request_id.eq.${requestId}`)
        .order('created_at', { ascending: false })
        .limit(50)
      setTimeline(timelineData || [])

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // تسجيل النشاط
  const logActivity = async (activityType: string, description: string, metadata: any = {}) => {
    try {
      await supabase.from('activity_logs').insert({
        user_id: currentUser?.id,
        user_type: 'lawyer',
        activity_type: activityType,
        description,
        metadata: {
          request_id: requestId,
          user_name: currentUser?.name,
          portal: 'independent',
          ...metadata
        }
      })
    } catch (error) {
      console.error('Log error:', error)
    }
  }

  // قبول الطلب
  const handleAccept = async () => {
    try {
      await supabase
        .from('service_requests')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', requestId)
      
      await logActivity('accept_request', 'تم قبول الطلب')
      toast.success('✅ تم قبول الطلب')
      setShowAcceptModal(false)
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // رفض الطلب
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('يرجى كتابة سبب الرفض')
      return
    }
    try {
      await supabase
        .from('service_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
      
      await logActivity('reject_request', 'تم رفض الطلب', { reason: rejectReason })
      toast.success('تم رفض الطلب')
      setShowRejectModal(false)
      router.push('/independent/requests')
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // إرسال رسالة للمشترك
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return
    if (!canRespond) {
      toast.error('لا يمكنك الرد الآن')
      return
    }
    const messageText = newMessage
    // Optimistic update
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      request_id: requestId,
      sender_id: currentUser?.id,
      sender_type: 'lawyer',
      content: messageText,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, optimisticMsg])
    setNewMessage('')
    try {
      await supabase.from('messages').insert({
        request_id: requestId,
        sender_id: currentUser?.id,
        sender_type: 'lawyer',
        content: messageText
      })

      await logActivity('send_message', 'إرسال رسالة للمشترك')
    } catch (error) {
      // Revert optimistic update on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      toast.error('حدث خطأ')
    }
  }

  // رفع ملف
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    setUploadingFile(true)
    try {
      const fileName = `${requestId}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage
        .from('request-files')
        .upload(fileName, file)
      
      if (error) throw error
      
      const { data: urlData } = supabase.storage
        .from('request-files')
        .getPublicUrl(fileName)
      
      await supabase.from('request_internal_chat').insert({
        request_id: requestId,
        sender_id: currentUser?.id,
        sender_type: 'lawyer',
        sender_name: currentUser?.name,
        content: `📎 تم إرفاق ملف: ${file.name}`,
        message_type: 'file',
        attachments: [{
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size
        }]
      })
      
      await logActivity('upload_file', `رفع ملف: ${file.name}`)
      toast.success('✅ تم رفع الملف')
      loadData()
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('حدث خطأ في رفع الملف')
    } finally {
      setUploadingFile(false)
    }
  }

  // تسجيل وقت
  const handleTimeLog = async () => {
    if (!timeLogForm.hours) {
      toast.error('يرجى إدخال الساعات')
      return
    }
    try {
      await supabase.from('lawyer_time_logs').insert({
        lawyer_id: currentUser?.id,
        request_id: requestId,
        hours: parseFloat(timeLogForm.hours),
        work_type: timeLogForm.work_type,
        description: timeLogForm.description,
        work_date: new Date().toISOString().split('T')[0]
      })
      
      await logActivity('log_time', `تسجيل ${timeLogForm.hours} ساعة - ${workTypeLabels[timeLogForm.work_type]}`)
      toast.success('✅ تم تسجيل الوقت')
      setShowTimeLogModal(false)
      setTimeLogForm({ hours: '', work_type: 'research', description: '' })
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // إغلاق الطلب
  const handleClose = async () => {
    if (!canCloseRequest) {
      toast.error('لا يمكنك إغلاق الطلب')
      return
    }
    try {
      await supabase
        .from('service_requests')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', requestId)
      
      await logActivity('close_request', 'إغلاق الطلب')
      toast.success('✅ تم إغلاق الطلب')
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // الدوال المساعدة
  const formatDate = (date: string) => date ? new Date(date).toLocaleDateString('ar-SA') : '-'
  const formatDateTime = (date: string) => date ? new Date(date).toLocaleString('ar-SA') : '-'

  const getSlaStatus = () => {
    if (!request) return null
    if (request.is_sla_breached) {
      return { text: '⚠️ تجاوز SLA', color: 'bg-red-500 text-white' }
    }
    if (request.sla_deadline) {
      const remaining = new Date(request.sla_deadline).getTime() - new Date().getTime()
      const hours = Math.floor(remaining / (1000 * 60 * 60))
      if (hours < 0) return { text: '⚠️ متأخر', color: 'bg-red-500 text-white' }
      if (hours <= 4) return { text: `⏰ ${hours} ساعة`, color: 'bg-orange-500 text-white' }
      return { text: `${hours} ساعة`, color: 'bg-indigo-100 text-indigo-700' }
    }
    return null
  }

  const totalHours = timeLogs.reduce((sum, log) => sum + (log.hours || 0), 0)

  // العرض
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 mx-auto text-red-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">الطلب غير موجود</h2>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg">
          رجوع
        </button>
      </div>
    )
  }

  const slaStatus = getSlaStatus()
  const StatusIcon = statusConfig[request.status]?.icon || Clock

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-slate-800">
                  {request.ticket_number || `#${requestId.slice(0, 8)}`}
                </h1>
                <span className={`px-2 py-0.5 rounded text-xs text-white ${typeConfig[request.request_type]?.color || 'bg-gray-500'}`}>
                  {typeConfig[request.request_type]?.label || request.request_type}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusConfig[request.status]?.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusConfig[request.status]?.label}
                </span>
                {slaStatus && (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${slaStatus.color}`}>
                    {slaStatus.text}
                  </span>
                )}
              </div>
              <p className="text-slate-500 mt-1">{request.title || 'بدون عنوان'}</p>
            </div>
          </div>
          
          <span className={`px-2 py-1 rounded text-xs font-medium ${priorityConfig[request.priority]?.color}`}>
            {priorityConfig[request.priority]?.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* المحتوى الرئيسي */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl shadow-sm">
            <div className="flex border-b overflow-x-auto">
              {[
                { key: 'overview', label: 'نظرة عامة', icon: Eye },
                { key: 'chat', label: '💬 المشترك', icon: MessageSquare, count: messages.length },
                { key: 'files', label: '📎 الملفات', icon: Paperclip, count: files.length },
                { key: 'timeline', label: '📜 السجل', icon: Clock },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 px-4 py-3 font-medium whitespace-nowrap border-b-2 transition-all ${
                    activeTab === tab.key
                      ? 'text-indigo-600 border-indigo-600'
                      : 'text-slate-600 border-transparent hover:text-slate-800'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="bg-slate-200 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* نظرة عامة */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {request.nolex_guidance && (
                    <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-200">
                      <h4 className="font-bold text-indigo-800 mb-2 flex items-center gap-2">
                        <Bot className="w-5 h-5" />
                        توجيه NOLEX
                      </h4>
                      <p className="text-indigo-700">{request.nolex_guidance}</p>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium text-slate-800 mb-2">وصف الطلب</h4>
                    <p className="text-slate-600 bg-slate-50 p-4 rounded-lg whitespace-pre-wrap">
                      {request.description || 'لا يوجد وصف'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">التصنيف</p>
                      <p className="font-medium text-slate-800">{request.category?.name_ar || '-'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">التصنيف الفرعي</p>
                      <p className="font-medium text-slate-800">{request.subcategory?.name_ar || '-'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">تاريخ الإنشاء</p>
                      <p className="font-medium text-slate-800">{formatDate(request.created_at)}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">الوقت المسجل</p>
                      <p className="font-medium text-slate-800">{totalHours} ساعة</p>
                    </div>
                  </div>

                  {request.attachments && request.attachments.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-800 mb-2">مرفقات المشترك</h4>
                      <div className="flex flex-wrap gap-2">
                        {request.attachments.map((file: any, idx: number) => (
                          <a
                            key={idx}
                            href={file.url}
                            target="_blank"
                            className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            <FileText className="w-4 h-4 text-indigo-600" />
                            <span className="text-sm">{file.name || `ملف ${idx + 1}`}</span>
                            <Download className="w-4 h-4 text-slate-400" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* محادثة المشترك */}
              {activeTab === 'chat' && (
                <div className="space-y-4">
                  <div className="h-[400px] overflow-y-auto space-y-3 p-4 bg-slate-50 rounded-lg">
                    {messages.length > 0 ? messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_type === 'lawyer' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[70%] p-3 rounded-lg ${
                          msg.sender_type === 'lawyer'
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white border shadow-sm'
                        }`}>
                          <p>{msg.content}</p>
                          <p className={`text-xs mt-1 ${msg.sender_type === 'lawyer' ? 'text-indigo-100' : 'text-slate-400'}`}>
                            {formatDateTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-slate-500">
                        <MessageSquare className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                        <p>لا توجد رسائل</p>
                      </div>
                    )}
                  </div>
                  
                  {canRespond ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="اكتب رسالتك للمشترك..."
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <button
                        onClick={handleSendMessage}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                      <Lock className="w-5 h-5" />
                      <span>
                        {request.status === 'assigned' 
                          ? 'يجب قبول الطلب أولاً للرد على المشترك'
                          : 'لا يمكن الرد - الطلب مغلق'
                        }
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* الملفات */}
              {activeTab === 'files' && (
                <div className="space-y-4">
                  {files.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {files.map((file: any, idx: number) => (
                        <div key={idx} className="p-4 bg-slate-50 rounded-lg flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800 truncate">{file.file_name}</p>
                            <p className="text-sm text-slate-500">{formatDate(file.uploaded_at)}</p>
                          </div>
                          <a 
                            href={file.file_url} 
                            target="_blank" 
                            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <Download className="w-5 h-5 text-slate-600" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500">
                      <Paperclip className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p>لا توجد ملفات مرفقة</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        رفع ملف
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              )}

              {/* السجل */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  {timeline.length > 0 ? (
                    <div className="relative">
                      <div className="absolute top-0 bottom-0 right-4 w-0.5 bg-slate-200"></div>
                      <div className="space-y-4">
                        {timeline.map(item => (
                          <div key={item.id} className="flex gap-4 relative">
                            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center z-10">
                              <Clock className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 pb-4">
                              <p className="font-medium text-slate-800">{item.activity_type}</p>
                              {item.description && (
                                <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                              )}
                              <p className="text-xs text-slate-400 mt-1">{formatDateTime(item.created_at)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500">
                      <Clock className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p>لا يوجد سجل</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* الشريط الجانبي */}
        <div className="space-y-4">
          {/* معلومات الطلب */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-slate-800 mb-4">📊 معلومات</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">تاريخ القبول</span>
                <span className="text-slate-800">{formatDate(request.accepted_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الوقت المسجل</span>
                <span className="text-slate-800">{totalHours} ساعة</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الرسائل</span>
                <span className="text-slate-800">{messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الملفات</span>
                <span className="text-slate-800">{files.length}</span>
              </div>
            </div>
          </div>

          {/* الأدوات */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-slate-800 mb-4">🛠️ الأدوات</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-indigo-50 rounded-lg text-indigo-600 transition-colors">
                <Bot className="w-5 h-5" />
                <span>مساعدة NOLEX</span>
              </button>
              <button 
                onClick={() => setShowTimeLogModal(true)} 
                className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-slate-100 rounded-lg text-slate-700 transition-colors"
              >
                <Timer className="w-5 h-5" />
                <span>تسجيل الوقت</span>
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-slate-100 rounded-lg text-slate-700 transition-colors disabled:opacity-50"
              >
                {uploadingFile ? (
                  <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
                <span>رفع ملف</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-slate-100 rounded-lg text-slate-700 transition-colors">
                <Search className="w-5 h-5" />
                <span>بحث المكتبة</span>
              </button>
              {request.request_type === 'consultation' && (
                <button 
                  onClick={() => setShowConvertCaseModal(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-slate-100 rounded-lg text-slate-700 transition-colors"
                >
                  <Scale className="w-5 h-5" />
                  <span>تحويل لقضية</span>
                </button>
              )}
              {request.request_type === 'case' && (
                <>
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-slate-100 rounded-lg text-slate-700 transition-colors">
                    <FileText className="w-5 h-5" />
                    <span>إصدار وكالة</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-slate-100 rounded-lg text-slate-700 transition-colors">
                    <Gavel className="w-5 h-5" />
                    <span>فتح قضية بالنظام</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* الإجراءات */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-slate-800 mb-4">⚡ الإجراءات</h3>
            <div className="space-y-2">
              {request.status === 'assigned' && (
                <>
                  <button 
                    onClick={() => setShowAcceptModal(true)} 
                    className="w-full flex items-center gap-3 px-3 py-2 bg-green-50 hover:bg-green-100 rounded-lg text-green-700 transition-colors"
                  >
                    <Check className="w-5 h-5" />
                    <span>قبول الطلب</span>
                  </button>
                  <button 
                    onClick={() => setShowRejectModal(true)} 
                    className="w-full flex items-center gap-3 px-3 py-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                    <span>رفض الطلب</span>
                  </button>
                </>
              )}

              {['accepted', 'in_progress'].includes(request.status) && canCloseRequest && (
                <button 
                  onClick={handleClose} 
                  className="w-full flex items-center gap-3 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-indigo-700 transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>إغلاق الطلب</span>
                </button>
              )}

              {['completed', 'closed'].includes(request.status) && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
                  <CheckCircle className="w-6 h-6 mx-auto mb-1" />
                  <p className="font-medium">تم إغلاق الطلب</p>
                </div>
              )}
            </div>
          </div>

          {/* سجل الوقت */}
          {timeLogs.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-slate-800 mb-4">⏱️ سجل الوقت</h3>
              <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
                {timeLogs.slice(0, 5).map(log => (
                  <div key={log.id} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                    <div>
                      <span className="font-medium">{log.hours} ساعة</span>
                      <span className="text-slate-500 text-xs mr-2">{workTypeLabels[log.work_type]}</span>
                    </div>
                    <span className="text-xs text-slate-400">{formatDate(log.work_date)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between">
                <span className="font-bold">الإجمالي</span>
                <span className="font-bold text-indigo-600">{totalHours} ساعة</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAcceptModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">✅ قبول الطلب</h2>
            <p className="text-slate-600 mb-6">هل أنت متأكد من قبول هذا الطلب والعمل عليه؟</p>
            <div className="flex gap-3">
              <button onClick={() => setShowAcceptModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">إلغاء</button>
              <button onClick={handleAccept} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">قبول</button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">❌ رفض الطلب</h2>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="سبب الرفض... (مطلوب)"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-red-500"
              rows={3}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">إلغاء</button>
              <button onClick={handleReject} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">رفض</button>
            </div>
          </div>
        </div>
      )}

      {showTimeLogModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">⏱️ تسجيل الوقت</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الساعات *</label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={timeLogForm.hours}
                  onChange={(e) => setTimeLogForm({...timeLogForm, hours: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="مثال: 1.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">نوع العمل</label>
                <select
                  value={timeLogForm.work_type}
                  onChange={(e) => setTimeLogForm({...timeLogForm, work_type: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(workTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الوصف (اختياري)</label>
                <textarea
                  value={timeLogForm.description}
                  onChange={(e) => setTimeLogForm({...timeLogForm, description: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="ماذا عملت..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowTimeLogModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">إلغاء</button>
              <button onClick={handleTimeLog} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
