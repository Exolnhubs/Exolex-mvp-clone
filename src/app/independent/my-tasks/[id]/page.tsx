'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 صفحة معالجة الطلب الكاملة - ExoLex
// 📅 التاريخ: 12 يناير 2026
// 🎯 الغرض: Dashboard كامل لمعالجة الطلب من البداية للنهاية
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// Types & Interfaces
// ═══════════════════════════════════════════════════════════════════════════════
interface Request {
  id: string
  ticket_number: string
  title: string
  description: string
  request_type: string
  status: string
  priority: string
  sla_deadline: string
  created_at: string
  accepted_at: string
  work_started_at: string
  completed_at: string
  progress_percentage: number
  is_sla_breached: boolean
  unread_messages_count: number
  assigned_lawyer_id: string
  member_id: string
  category?: { name_ar: string; icon: string }
  subcategory?: { name_ar: string; service_path?: { code: string; name_ar: string } }
 nolex_guidance?: string
  attachments?: any[]
}

interface Message {
  id: string
  content: string
  sender_id: string
  sender_type: string
  sender_name: string
  created_at: string
  attachments?: any[]
  is_read: boolean
}

interface Collaborator {
  id: string
  lawyer_id: string
  lawyer_name: string
  lawyer_code: string
  role: string
  status: string
  created_at: string
}

interface Appointment {
  id: string
  title: string
  appointment_type: string
  start_datetime: string
  end_datetime: string
  location: string
  location_type: string
  status: string
}

interface TimeLog {
  id: string
  hours: number
  work_type: string
  description: string
  work_date: string
  created_at: string
}

interface ActivityLog {
  id: string
  activity_type: string
  description: string
  user_name: string
  created_at: string
  metadata: any
}

interface FileItem {
  id: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  uploaded_by_type: string
  uploaded_by_name: string
  category: string
  created_at: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// Config Objects
// ═══════════════════════════════════════════════════════════════════════════════
// المسارات التي تحتاج وكالة
const PATHS_REQUIRING_POA = ['litigation', 'execution', 'appeal', 'settlement', 'arbitration']

// المسارات التي تحتاج فتح قضية
const PATHS_REQUIRING_CASE = ['litigation', 'appeal']

// دوال مساعدة
const requiresPoa = (pathCode?: string) => pathCode ? PATHS_REQUIRING_POA.includes(pathCode) : false
const requiresCase = (pathCode?: string) => pathCode ? PATHS_REQUIRING_CASE.includes(pathCode) : false
const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending_assignment: { label: 'بانتظار الإسناد', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  assigned: { label: 'تم الإسناد', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  accepted: { label: 'مقبول', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  in_progress: { label: 'قيد العمل', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  awaiting_client: { label: 'بانتظار العميل', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  completed: { label: 'مكتمل', color: 'text-green-700', bgColor: 'bg-green-100' },
  closed: { label: 'مغلق', color: 'text-slate-700', bgColor: 'bg-slate-100' },
}

const typeConfig: Record<string, { label: string; color: string }> = {
  consultation: { label: 'استشارة', color: 'bg-purple-500' },
  case: { label: 'قضية', color: 'bg-blue-500' },
  extra_service: { label: 'خدمة إضافية', color: 'bg-teal-500' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  normal: { label: 'عادي', color: 'text-gray-600' },
  high: { label: 'عالي', color: 'text-orange-600' },
  urgent: { label: 'عاجل', color: 'text-red-600' },
}

const workTypeLabels: Record<string, string> = {
  research: 'بحث قانوني',
  drafting: 'صياغة',
  review: 'مراجعة',
  meeting: 'اجتماع',
  call: 'مكالمة',
  court: 'محكمة',
  travel: 'تنقل',
  other: 'أخرى',
}

const appointmentTypeLabels: Record<string, { label: string; icon: string; color: string }> = {
  court_session: { label: 'جلسة محكمة', icon: '⚖️', color: 'bg-red-100 text-red-700' },
  client_meeting: { label: 'اجتماع عميل', icon: '👤', color: 'bg-blue-100 text-blue-700' },
  phone_call: { label: 'مكالمة هاتفية', icon: '📞', color: 'bg-green-100 text-green-700' },
  video_call: { label: 'اجتماع مرئي', icon: '📹', color: 'bg-purple-100 text-purple-700' },
  internal_meeting: { label: 'اجتماع داخلي', icon: '👥', color: 'bg-amber-100 text-amber-700' },
  deadline: { label: 'موعد نهائي', icon: '⏰', color: 'bg-orange-100 text-orange-700' },
  other: { label: 'أخرى', icon: '📅', color: 'bg-gray-100 text-gray-700' },
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════
export default function RequestProcessingPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = params.id as string
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ═══════════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════════
  const [isLoading, setIsLoading] = useState(true)
  const [request, setRequest] = useState<Request | null>(null)
  const [currentLawyer, setCurrentLawyer] = useState<any>(null)

  // Data states
  const [clientMessages, setClientMessages] = useState<Message[]>([])
  const [internalMessages, setInternalMessages] = useState<Message[]>([])
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [objection, setObjection] = useState<any>(null)
  const [objectionResponse, setObjectionResponse] = useState('')
  const [submittingObjectionResponse, setSubmittingObjectionResponse] = useState(false)

  // UI states
  const [activeTab, setActiveTab] = useState<'request' | 'conversations' | 'files' | 'appointments' | 'timeline'>('request')
  const [activeChatTab, setActiveChatTab] = useState<'client' | 'team'>('client')

  // Input states
  const [newClientMessage, setNewClientMessage] = useState('')
  const [newInternalMessage, setNewInternalMessage] = useState('')

  // Modal states
  const [showNolexModal, setShowNolexModal] = useState(false)
  const [showAppointmentModal, setShowAppointmentModal] = useState(false)
  const [showTimeLogModal, setShowTimeLogModal] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false)
  const [showConvertCaseModal, setShowConvertCaseModal] = useState(false)
  const [showPoaModal, setShowPoaModal] = useState(false)

  // POA (Power of Attorney) state
  const [poaDocument, setPoaDocument] = useState<{
    id: string
    file_url: string
    file_name: string
    uploaded_at: string
    status: string
  } | null>(null)
  const [poaRejectionReason, setPoaRejectionReason] = useState('')
const [showPoaRejectForm, setShowPoaRejectForm] = useState(false)
const [processingPoa, setProcessingPoa] = useState(false)
  const [poaRequestForm, setPoaRequestForm] = useState({
    principal_name: '',
    principal_national_id: '',
    principal_date_of_birth: '',
    principal_phone: '',
    poa_template: ''
  })
  const [submittingPoa, setSubmittingPoa] = useState(false)
  const [poaRequest, setPoaRequest] = useState<any>(null)
  // NOLEX state
  const [nolexMessages, setNolexMessages] = useState<{role: string; content: string}[]>([])
  const [nolexInput, setNolexInput] = useState('')
  const [nolexLoading, setNolexLoading] = useState(false)

  // Form states
  const [appointmentForm, setAppointmentForm] = useState({
    title: '',
    appointment_type: 'client_meeting',
    start_date: '',
    start_time: '',
    location: '',
    location_type: 'physical',
    notify_client: false,
    notes: ''
  })

  const [timeLogForm, setTimeLogForm] = useState({
    hours: '',
    work_type: 'research',
    description: '',
    work_date: new Date().toISOString().split('T')[0]
  })

  const [completeForm, setCompleteForm] = useState({
    response_content: '',
    recommendations: '',
    attachments: [] as any[]
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // Data Loading
  // ═══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    loadAllData()
  }, [requestId])

  const loadAllData = async () => {
    try {
      setIsLoading(true)
      
      // Get lawyer info
      const lawyerId = localStorage.getItem('exolex_lawyer_id')
      if (!lawyerId) {
        router.push('/auth/lawyer-login')
        return
      }

      const { data: lawyerData } = await supabase
        .from('lawyers')
        .select('*')
        .eq('id', lawyerId)
        .single()

      if (!lawyerData) {
        router.push('/auth/lawyer-login')
        return
      }
      setCurrentLawyer(lawyerData)

      // Load request
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
      setRequest(requestData)

      // Load all related data in parallel
      await Promise.all([
        loadClientMessages(),
        loadInternalMessages(),
        loadCollaborators(),
        loadAppointments(),
        loadFiles(),
        loadTimeLogs(),
        loadActivityLogs(),
        loadPoa(),
        loadObjection()
      ])

      // Log view activity
      await logActivity('view_request', 'عرض صفحة معالجة الطلب')

    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const loadClientMessages = async () => {
    const { data } = await supabase
      .from('request_client_messages')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
    setClientMessages(data || [])
  }

  const loadInternalMessages = async () => {
    const { data } = await supabase
      .from('request_internal_chat')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
    setInternalMessages(data || [])
  }

  const loadCollaborators = async () => {
    const { data } = await supabase
      .from('request_collaborators')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })
    setCollaborators(data || [])
  }

  const loadAppointments = async () => {
    const { data } = await supabase
      .from('request_appointments')
      .select('*')
      .eq('request_id', requestId)
      .order('start_datetime', { ascending: true })
    setAppointments(data || [])
  }

  const loadFiles = async () => {
    const { data } = await supabase
      .from('request_files')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })
    setFiles(data || [])
  }

  const loadTimeLogs = async () => {
    const { data } = await supabase
      .from('lawyer_time_logs')
      .select('*')
      .eq('request_id', requestId)
      .order('work_date', { ascending: false })
    setTimeLogs(data || [])
  }

  const loadActivityLogs = async () => {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .contains('metadata', { request_id: requestId })
      .order('created_at', { ascending: false })
      .limit(50)
    setActivityLogs(data || [])
  }

  // Load POA (Power of Attorney)
  const loadPoa = async () => {
    try {
      const { data } = await supabase
        .from('power_of_attorneys')
        .select('*')
        .eq('request_id', requestId)
        .single()
      
      if (data) {
        setPoaDocument({
          id: data.id,
          file_name: data.poa_number ? `وكالة رقم ${data.poa_number}` : 'وكالة',
          file_url: data.poa_document,
          uploaded_at: data.submitted_at || data.created_at,
          status: data.status
        })
      } else {
        setPoaDocument(null)
      }
    } catch (error) {
      setPoaDocument(null)
    }
  }
// Load Objection (الاعتراض)
const loadObjection = async () => {
  try {
    const { data } = await supabase
      .from('request_objections')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setObjection(data || null)
  } catch (error) {
    setObjection(null)
  }
}
// الرد على الاعتراض
const handleRespondToObjection = async () => {
  if (!objectionResponse.trim()) {
    toast.error('يرجى كتابة الرد على الاعتراض')
    return
  }
  
  setSubmittingObjectionResponse(true)
  try {
    // تحديث الاعتراض بالرد
    await supabase
      .from('request_objections')
      .update({
        lawyer_response: objectionResponse,
        lawyer_responded_at: new Date().toISOString(),
        status: 'responded'
      })
      .eq('id', objection.id)

    // تحديث حالة الطلب
    await supabase
      .from('service_requests')
      .update({ status: 'objection_responded' })
      .eq('id', requestId)

    // إرسال إشعار للمشترك
    await supabase.from('notifications').insert({
      recipient_type: 'member',
      recipient_id: request?.member_id,
      title: '💬 رد المحامي على اعتراضك',
      body: `المحامي رد على اعتراضك في الطلب ${request?.ticket_number}`,
      notification_type: 'request_update',
      request_id: requestId,
      is_read: false
    })

    toast.success('✅ تم إرسال الرد بنجاح')
    setObjectionResponse('')
    loadObjection()
    loadAllData()
  } catch (error) {
    console.error('Error:', error)
    toast.error('حدث خطأ في إرسال الرد')
  } finally {
    setSubmittingObjectionResponse(false)
  }
}
  // ═══════════════════════════════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════════════════════════════
  // إرسال طلب وكالة
  const handleSubmitPoaRequest = async () => {
    if (!poaRequestForm.principal_name || !poaRequestForm.principal_national_id || !poaRequestForm.poa_template) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    try {
      setSubmittingPoa(true)
      
      // حفظ طلب الوكالة
      const { data, error } = await supabase
        .from('power_of_attorneys')
        .insert({
          request_id: requestId,
          principal_name: poaRequestForm.principal_name,
          principal_national_id: poaRequestForm.principal_national_id,
          principal_date_of_birth: poaRequestForm.principal_date_of_birth,
          principal_phone: poaRequestForm.principal_phone,
          poa_template: poaRequestForm.poa_template,
          status: 'pending'
        })
        .select()
        .single()

      if (error) throw error

      // تحديث حالة الطلب
      await supabase
        .from('service_requests')
        .update({ status: 'pending_poa' })
        .eq('id', requestId)

      // إرسال إشعار للمشترك
      await supabase.from('notifications').insert({
        recipient_type: 'member',
        recipient_id: request?.member_id,
        title: '📄 طلب إصدار وكالة',
        body: `المحامي يطلب منك إصدار وكالة للطلب ${request?.ticket_number}`,
        notification_type: 'poa_request',
        request_id: requestId,
        is_read: false
      })

      setPoaRequest(data)
      toast.success('✅ تم إرسال طلب الوكالة للمشترك')
      setShowPoaModal(false)
      
      // تحديث الطلب
      setRequest(prev => prev ? { ...prev, status: 'pending_poa' } : null)
      
    } catch (err: any) {
      console.error('Error:', err)
      toast.error('حدث خطأ: ' + err.message)
    } finally {
      setSubmittingPoa(false)
    }
  }
  const logActivity = async (activityType: string, description: string, metadata: any = {}) => {
    try {
      await supabase.from('activity_logs').insert({
        user_id: currentLawyer?.user_id,
        user_type: 'lawyer',
        user_name: currentLawyer?.full_name,
        activity_type: activityType,
        description,
        metadata: { request_id: requestId, ...metadata }
      })
    } catch (error) {
      console.error('Log error:', error)
    }
  }
// قبول الوكالة
const handleApprovePoa = async () => {
  if (!poaDocument || !request) return
  
  try {
    setProcessingPoa(true)
    
    await supabase
      .from('power_of_attorneys')
      .update({ 
        status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('request_id', requestId)
    
    await supabase
      .from('service_requests')
      .update({ status: 'poa_approved' })
      .eq('id', requestId)
    
    await supabase.from('notifications').insert({
      recipient_type: 'member',
      recipient_id: request.member_id,
      title: '✅ تم قبول الوكالة',
      body: `تم قبول الوكالة للطلب ${request.ticket_number}`,
      notification_type: 'poa_approved',
      request_id: requestId,
      is_read: false
    })
    
    toast.success('✅ تم قبول الوكالة')
    setPoaDocument({ ...poaDocument, status: 'approved' })
    setRequest((prev: any) => ({ ...prev, status: 'poa_approved' }))
    setShowPoaModal(false)
  } catch (err: any) {
    toast.error('حدث خطأ: ' + err.message)
  } finally {
    setProcessingPoa(false)
  }
}

// رفض الوكالة
const handleRejectPoa = async () => {
  if (!poaDocument || !request || !poaRejectionReason.trim()) {
    toast.error('يرجى كتابة سبب الرفض')
    return
  }
  
  try {
    setProcessingPoa(true)
    
    await supabase
      .from('power_of_attorneys')
      .update({ 
        status: 'rejected',
        rejection_reason: poaRejectionReason,
        reviewed_at: new Date().toISOString()
      })
      .eq('request_id', requestId)
    
    await supabase
      .from('service_requests')
      .update({ status: 'pending_poa' })
      .eq('id', requestId)
    
    await supabase.from('notifications').insert({
      recipient_type: 'member',
      recipient_id: request.member_id,
      title: '❌ تم رفض الوكالة',
      body: `تم رفض الوكالة للطلب ${request.ticket_number}. السبب: ${poaRejectionReason}`,
      notification_type: 'poa_rejected',
      request_id: requestId,
      is_read: false
    })
    
    toast.success('تم رفض الوكالة')
    setPoaDocument(null)
    setRequest((prev: any) => ({ ...prev, status: 'pending_poa' }))
    setPoaRejectionReason('')
    setShowPoaRejectForm(false)
    setShowPoaModal(false)
  } catch (err: any) {
    toast.error('حدث خطأ: ' + err.message)
  } finally {
    setProcessingPoa(false)
  }
}
  // Start work on request
  const handleStartWork = async () => {
    try {
      await supabase
        .from('service_requests')
        .update({ 
          status: 'objection_responded',
          work_started_at: new Date().toISOString()
        })
        .eq('id', requestId)

      await logActivity('start_work', 'بدء العمل على الطلب')
      toast.success('✅ تم بدء العمل على الطلب')
      loadAllData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // Send message to client
  const handleSendClientMessage = async () => {
    if (!newClientMessage.trim()) return

    try {
      await supabase.from('request_client_messages').insert({
        request_id: requestId,
        sender_id: currentLawyer?.user_id,
        sender_type: 'lawyer',
        sender_name: currentLawyer?.full_name,
        content: newClientMessage
      })

      await logActivity('send_client_message', 'إرسال رسالة للعميل')
      setNewClientMessage('')
      loadClientMessages()
      toast.success('✅ تم الإرسال')
    } catch (error) {
      toast.error('حدث خطأ في الإرسال')
    }
  }

  // Send internal message
  const handleSendInternalMessage = async () => {
    if (!newInternalMessage.trim()) return

    try {
      await supabase.from('request_internal_chat').insert({
        request_id: requestId,
        sender_id: currentLawyer?.id,
        sender_name: currentLawyer?.full_name,
        content: newInternalMessage
      })

      setNewInternalMessage('')
      loadInternalMessages()
    } catch (error) {
      toast.error('حدث خطأ في الإرسال')
    }
  }

  // Upload file
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    console.log('📁 Starting file upload:', file.name, file.size, file.type)

    try {
      const fileName = `${requestId}/${Date.now()}_${file.name}`
      console.log('📁 Upload path:', fileName)
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('request-files')
        .upload(fileName, file)

      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError)
        toast.error(`خطأ في الرفع: ${uploadError.message}`)
        return
      }
      
      console.log('✅ File uploaded to storage:', uploadData)

      const { data: urlData } = supabase.storage
        .from('request-files')
        .getPublicUrl(fileName)
        
      console.log('📎 Public URL:', urlData.publicUrl)

      const { data: insertData, error: insertError } = await supabase.from('request_files').insert({
        request_id: requestId,
        uploaded_by: currentLawyer?.id, // تغيير من user_id إلى id
        uploaded_by_type: 'lawyer',
        uploaded_by_name: currentLawyer?.full_name,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.name.split('.').pop(),
        file_size: file.size,
        mime_type: file.type
      }).select()

      if (insertError) {
        console.error('❌ Database insert error:', insertError)
        toast.error(`خطأ في حفظ المعلومات: ${insertError.message}`)
        return
      }
      
      console.log('✅ File record saved:', insertData)

      await logActivity('upload_file', `رفع ملف: ${file.name}`)
      toast.success('✅ تم رفع الملف')
      loadFiles()
      
      // Reset the input
      event.target.value = ''
    } catch (error: any) {
      console.error('❌ Full error:', error)
      toast.error(error.message || 'حدث خطأ في رفع الملف')
    }
  }

  // Add appointment
  const handleAddAppointment = async () => {
    if (!appointmentForm.title || !appointmentForm.start_date || !appointmentForm.start_time) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    try {
      const startDatetime = `${appointmentForm.start_date}T${appointmentForm.start_time}:00`
      
      // 1. حفظ في request_appointments (الأساسي)
      const { error: appointmentError } = await supabase.from('request_appointments').insert({
        request_id: requestId,
        created_by: currentLawyer?.id,
        title: appointmentForm.title,
        appointment_type: appointmentForm.appointment_type,
        start_datetime: startDatetime,
        location: appointmentForm.location || null,
        location_type: appointmentForm.location_type,
        notify_client: appointmentForm.notify_client
      })

      if (appointmentError) {
        console.error('Error saving appointment:', appointmentError)
        throw appointmentError
      }

      // 2. حفظ في calendar_events للربط مع التقويم
      const { error: calendarError } = await supabase.from('calendar_events').insert({
        owner_type: 'lawyer',
        owner_id: currentLawyer?.id,
        owner_name: currentLawyer?.full_name || '',
        title: appointmentForm.title,
        event_type: appointmentForm.appointment_type,
        start_datetime: startDatetime,
        location: appointmentForm.location || null,
        location_type: appointmentForm.location_type,
        request_id: requestId,
        ticket_number: request?.ticket_number || null,
        notify_client: appointmentForm.notify_client,
        is_private: false,
        status: 'scheduled',
        created_by: currentLawyer?.id,
        description: appointmentForm.notes || null
      })

      if (calendarError) {
        console.error('Error saving to calendar:', calendarError)
        // لا نرمي خطأ - الموعد محفوظ في request_appointments
      }

      // 3. إذا فعّل إشعار العميل، نرسل إشعار
      if (appointmentForm.notify_client && request?.member_id) {
        const { error: notifyError } = await supabase.from('notifications').insert({
          user_id: request.member_id,
          user_type: 'member',
          title: 'موعد جديد',
          message: `تم تحديد موعد "${appointmentForm.title}" بتاريخ ${appointmentForm.start_date}`,
          type: 'appointment',
          reference_id: requestId,
          reference_type: 'request'
        })
        if (notifyError) console.log('Notification error:', notifyError)
      }

      await logActivity('add_appointment', `إضافة موعد: ${appointmentForm.title}`)
      toast.success('✅ تم إضافة الموعد')
      setShowAppointmentModal(false)
      setAppointmentForm({
        title: '',
        appointment_type: 'client_meeting',
        start_date: '',
        start_time: '',
        location: '',
        location_type: 'physical',
        notify_client: false,
        notes: ''
      })
      loadAppointments()
    } catch (error: any) {
      console.error('Full error:', error)
      toast.error(error.message || 'حدث خطأ في إضافة الموعد')
    }
  }

  // Log time
  const handleLogTime = async () => {
    if (!timeLogForm.hours) {
      toast.error('يرجى إدخال عدد الساعات')
      return
    }

    try {
      await supabase.from('lawyer_time_logs').insert({
        request_id: requestId,
        lawyer_id: currentLawyer?.id,
        hours: parseFloat(timeLogForm.hours),
        work_type: timeLogForm.work_type,
        description: timeLogForm.description,
        work_date: timeLogForm.work_date
      })

      await logActivity('log_time', `تسجيل ${timeLogForm.hours} ساعة - ${workTypeLabels[timeLogForm.work_type]}`)
      toast.success('✅ تم تسجيل الوقت')
      setShowTimeLogModal(false)
      setTimeLogForm({
        hours: '',
        work_type: 'research',
        description: '',
        work_date: new Date().toISOString().split('T')[0]
      })
      loadTimeLogs()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // Complete request
  const handleCompleteRequest = async () => {
    if (!completeForm.response_content.trim()) {
      toast.error('يرجى كتابة الرد النهائي')
      return
    }

    try {
      // Save response
      await supabase.from('lawyer_responses').insert({
        request_id: requestId,
        lawyer_id: currentLawyer?.id,
        response_content: completeForm.response_content,
        recommendations: completeForm.recommendations,
        status: 'sent',
        sent_at: new Date().toISOString()
      })

      // Update request status
      await supabase
        .from('service_requests')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          progress_percentage: 100
        })
        .eq('id', requestId)

      await logActivity('complete_request', 'إنهاء الطلب وإرسال الرد النهائي')
      toast.success('✅ تم إنهاء الطلب بنجاح')
      setShowCompleteModal(false)
      loadAllData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // NOLEX AI Chat - Connected to OpenAI
  const handleNolexSend = async () => {
    if (!nolexInput.trim()) return

    const userMessage = nolexInput
    const newMessages = [...nolexMessages, { role: 'user', content: userMessage }]
    setNolexMessages(newMessages)
    setNolexInput('')
    setNolexLoading(true)

    try {
      // Call NOLEX API with request context
      const response = await fetch('/api/nolex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          requestContext: request ? {
            ticket_number: request.ticket_number,
            request_type: request.request_type,
            title: request.title,
            description: request.description,
            category: request.category?.name_ar
          } : null
        })
      })

      if (!response.ok) {
        throw new Error('فشل الاتصال بـ NOLEX')
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      setNolexMessages(prev => [...prev, { role: 'assistant', content: data.message }])
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ في الاتصال بـ NOLEX')
      // Fallback response
      setNolexMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '⚠️ عذراً، حدث خطأ في الاتصال. يرجى التأكد من إعداد مفتاح OpenAI في ملف .env.local' 
      }])
    } finally {
      setNolexLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Helper Functions
  // ═══════════════════════════════════════════════════════════════════════════════
  const formatDate = (date: string) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (date: string) => {
    if (!date) return ''
    return new Date(date).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateTime = (date: string) => {
    if (!date) return '-'
    return `${formatDate(date)} - ${formatTime(date)}`
  }

  const getSlaRemaining = () => {
    if (!request?.sla_deadline) return null
    const remaining = new Date(request.sla_deadline).getTime() - new Date().getTime()
    if (remaining < 0) return { text: 'متأخر', color: 'text-red-600 bg-red-50', urgent: true }
    
    const hours = Math.floor(remaining / (1000 * 60 * 60))
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours < 2) return { text: `${hours}:${minutes.toString().padStart(2, '0')}`, color: 'text-red-600 bg-red-50', urgent: true }
    if (hours < 6) return { text: `${hours}:${minutes.toString().padStart(2, '0')}`, color: 'text-orange-600 bg-orange-50', urgent: false }
    return { text: `${hours}:${minutes.toString().padStart(2, '0')}`, color: 'text-green-600 bg-green-50', urgent: false }
  }

  const getTotalHours = () => timeLogs.reduce((sum, log) => sum + (log.hours || 0), 0)

  const getProgressStep = () => {
    const statusOrder = ['assigned', 'in_progress', 'awaiting_client', 'completed', 'closed']
    const currentIndex = statusOrder.indexOf(request?.status || '')
    return currentIndex >= 0 ? currentIndex : 0
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════════
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">جاري تحميل الطلب...</p>
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">❌</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">الطلب غير موجود</h2>
          <button 
            onClick={() => router.back()}
            className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
          >
            رجوع
          </button>
        </div>
      </div>
    )
  }

  const slaStatus = getSlaRemaining()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ═══════════════════════════════════════════════════════════════════════════════
          Header
      ═══════════════════════════════════════════════════════════════════════════════ */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-6 py-4">
          {/* Top row */}
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-amber-600 transition"
            >
              <span className="text-xl">→</span>
              <span className="font-semibold">العودة للمهام</span>
            </button>
            <div className="flex items-center gap-3">
              <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <span>🔔</span>
              </button>
              <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <span>⋮</span>
              </button>
            </div>
          </div>

          {/* Request info row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-800">{request.ticket_number}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-bold text-white ${typeConfig[request.request_type]?.color || 'bg-gray-500'}`}>
                {typeConfig[request.request_type]?.label || request.request_type}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${statusConfig[request.status]?.bgColor} ${statusConfig[request.status]?.color}`}>
                {statusConfig[request.status]?.label}
              </span>
              {request.priority === 'urgent' && (
                <span className="px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-700">
                  🔴 عاجل
                </span>
              )}
            </div>

            {/* SLA Timer */}
            {slaStatus && (
              <div className={`px-4 py-2 rounded-lg border ${slaStatus.color} ${slaStatus.urgent ? 'border-red-300 animate-pulse' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <span>⏰</span>
                  <div>
                    <p className="text-xs font-semibold opacity-75">الوقت المتبقي</p>
                    <p className="text-lg font-bold">{slaStatus.text}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress Stepper */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {['إسناد', 'قيد العمل', 'انتظار العميل', 'مكتمل', 'مغلق'].map((step, index) => {
              const currentStep = getProgressStep()
              const isCompleted = index < currentStep
              const isCurrent = index === currentStep
              
              return (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                      isCompleted ? 'bg-green-500 text-white' :
                      isCurrent ? 'bg-amber-500 text-white animate-pulse' :
                      'bg-gray-300 text-gray-500'
                    }`}>
                      {isCompleted ? '✓' : isCurrent ? '●' : (index + 1)}
                    </div>
                    <p className={`text-sm font-semibold ${isCurrent ? 'text-amber-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                      {step}
                    </p>
                  </div>
                  {index < 4 && (
                    <div className={`flex-1 h-1 mx-2 ${index < currentStep ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowNolexModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                <span>🤖</span> NOLEX
              </button>
              <button 
                onClick={() => { setActiveTab('conversations'); setActiveChatTab('client') }}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold"
              >
                <span>💬</span> رسالة
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold"
              >
                <span>📁</span> ملف
              </button>
              <button 
                onClick={() => setShowAppointmentModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold"
              >
                <span>📅</span> موعد
              </button>
              <button 
                onClick={() => setShowTimeLogModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold"
              >
                <span>⏱️</span> وقت
              </button>
              {request.request_type === 'consultation' && (
                <button 
                  onClick={() => setShowConvertCaseModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold"
                >
                  <span>⚖️</span> قضية
                </button>
              )}
              <button 
                onClick={() => setShowPoaModal(true)}
                className={`flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition font-semibold ${poaDocument ? 'border-green-500 text-green-700' : 'border-gray-300'}`}
              >
                <span>📄</span> وكالة {poaDocument && '✓'}
              </button>
              <button 
                onClick={() => setShowCollaboratorModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold"
              >
                <span>👥</span> مشارك
              </button>
            </div>

            <div className="flex items-center gap-2">
              {request.status === 'assigned' && (
                <button 
                  onClick={handleStartWork}
                  className="flex items-center gap-2 px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition font-bold"
                >
                  <span>▶️</span> بدء العمل
                </button>
              )}
              {['in_progress', 'awaiting_client'].includes(request.status) && (
                <button 
                  onClick={() => setShowCompleteModal(true)}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold"
                >
                  <span>✅</span> إنهاء الطلب
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2 bg-white border-t border-gray-200">
          <div className="flex items-center gap-1">
            {[
              { key: 'request', label: 'الطلب', icon: '📋' },
              { key: 'conversations', label: 'المحادثات', icon: '💬', count: clientMessages.filter(m => !m.is_read && m.sender_type === 'client').length },
              { key: 'files', label: 'الملفات', icon: '📎', count: files.length },
              { key: 'appointments', label: 'المواعيد', icon: '📅', count: appointments.length },
              { key: 'timeline', label: 'السجل', icon: '📜' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-5 py-3 rounded-lg font-semibold transition ${
                  activeTab === tab.key 
                    ? 'bg-amber-500 text-white' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === tab.key ? 'bg-white text-amber-600' : 'bg-red-500 text-white'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileUpload}
        className="hidden"
      />

{/* ═══════════════════════════════════════════════════════════════════════════════
          Main Content Area
      ═══════════════════════════════════════════════════════════════════════════════ */}
      <main className="p-6">
        {/* Tab: Request Details */}
        {activeTab === 'request' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Main content - 2 columns */}
            <div className="col-span-2 space-y-6">
              {/* NOLEX Guidance */}
              {request.nolex_guidance && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">🤖</span>
                    <h3 className="text-lg font-bold text-blue-800">توجيه NOLEX</h3>
                  </div>
                  <p className="text-blue-700 leading-relaxed">{request.nolex_guidance}</p>
                </div>
              )}

              {/* ⚠️ قسم الاعتراض */}
              {objection && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">⚠️</span>
                    <h3 className="text-lg font-bold text-red-800">اعتراض من المشترك</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      objection.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      objection.status === 'responded' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {objection.status === 'pending' ? 'بانتظار الرد' :
                       objection.status === 'responded' ? 'تم الرد' : objection.status}
                    </span>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-500 mb-1">سبب الاعتراض:</p>
                    <p className="text-gray-800 font-medium">{objection.content}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(objection.created_at).toLocaleDateString('ar-SA')} - {new Date(objection.created_at).toLocaleTimeString('ar-SA')}
                    </p>
                  </div>

                  {objection.lawyer_response && (
                    <div className="bg-blue-50 rounded-lg p-4 mb-4 border-r-4 border-blue-500">
                      <p className="text-sm text-blue-600 mb-1">ردك السابق:</p>
                      <p className="text-gray-800">{objection.lawyer_response}</p>
                    </div>
                  )}

                  {objection.status === 'pending' && (
                    <div className="space-y-3">
                      <textarea
                        value={objectionResponse}
                        onChange={(e) => setObjectionResponse(e.target.value)}
                        placeholder="اكتب ردك على الاعتراض..."
                        className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <button
                        onClick={handleRespondToObjection}
                        disabled={submittingObjectionResponse || !objectionResponse.trim()}
                        className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg font-bold hover:from-red-600 hover:to-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {submittingObjectionResponse ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            جاري الإرسال...
                          </>
                        ) : (
                          <>
                            <span>💬</span>
                            إرسال الرد
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Request Details */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-6">تفاصيل الطلب</h3>
                
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-semibold text-gray-500 mb-1 block">عنوان الطلب</label>
                    <p className="text-gray-800 font-medium">{request.title || 'بدون عنوان'}</p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-500 mb-1 block">الوصف التفصيلي</label>
                    <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                      {request.description || 'لا يوجد وصف'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-sm font-semibold text-gray-500 mb-1 block">التصنيف</label>
                      <p className="text-gray-800 font-medium">{request.category?.name_ar || '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-sm font-semibold text-gray-500 mb-1 block">الفئة</label>
                      <p className="text-gray-800 font-medium">{request.subcategory?.name_ar || '-'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-sm font-semibold text-gray-500 mb-1 block">تاريخ الإنشاء</label>
                      <p className="text-gray-800">{formatDateTime(request.created_at)}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-sm font-semibold text-gray-500 mb-1 block">الموعد النهائي</label>
                      <p className={`font-semibold ${slaStatus?.urgent ? 'text-red-600' : 'text-gray-800'}`}>
                        {formatDateTime(request.sla_deadline)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Attachments */}
              {request.attachments && request.attachments.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">📎 مرفقات العميل</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {request.attachments.map((file: any, idx: number) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                      >
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <span>📄</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{file.name}</p>
                          <p className="text-sm text-gray-500">{formatFileSize(file.size || 0)}</p>
                        </div>
                        <span className="text-gray-400">⬇️</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar - 1 column */}
            <div className="space-y-6">
              {/* Client Info */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-lg font-bold text-gray-800 mb-4">👤 معلومات العميل</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">كود العميل</span>
                    <span className="font-mono text-gray-800">USR-{request.member_id?.slice(0, 6).toUpperCase()}</span>
                  </div>
                  <p className="text-sm text-gray-400 bg-gray-50 p-2 rounded">
                    💡 الاسم يظهر بعد قبول القضية
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-lg font-bold text-gray-800 mb-4">📊 إحصائيات</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">الوقت المسجل</span>
                    <span className="font-bold text-amber-600">{getTotalHours()} ساعة</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">الرسائل</span>
                    <span className="font-medium text-gray-800">{clientMessages.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">الملفات</span>
                    <span className="font-medium text-gray-800">{files.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">المواعيد</span>
                    <span className="font-medium text-gray-800">{appointments.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">المشاركين</span>
                    <span className="font-medium text-gray-800">{collaborators.length}</span>
                  </div>
                </div>
              </div>

              {/* Time Log Summary */}
              {timeLogs.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">⏱️ سجل الوقت</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {timeLogs.slice(0, 5).map(log => (
                      <div key={log.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div>
                          <span className="font-semibold">{log.hours} ساعة</span>
                          <span className="text-gray-500 text-sm mr-2">{workTypeLabels[log.work_type]}</span>
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(log.work_date)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t flex justify-between">
                    <span className="font-bold">الإجمالي</span>
                    <span className="font-bold text-amber-600">{getTotalHours()} ساعة</span>
                  </div>
                </div>
              )}

              {/* Collaborators */}
              {collaborators.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">👥 المشاركين</h3>
                  <div className="space-y-2">
                    {collaborators.map(collab => (
                      <div key={collab.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                          <span className="text-amber-600 font-bold">{collab.lawyer_name?.[0]}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{collab.lawyer_name}</p>
                          <p className="text-xs text-gray-500">{collab.lawyer_code}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Conversations */}
        {activeTab === 'conversations' && (
          <div className="grid grid-cols-2 gap-6 h-[calc(100vh-400px)]">
            {/* Client Chat */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
              <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-indigo-600">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💬</span>
                  <div>
                    <h3 className="font-bold text-white">محادثة العميل</h3>
                    <p className="text-sm text-indigo-100">{clientMessages.length} رسالة</p>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {clientMessages.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <span className="text-4xl mb-3 block">💬</span>
                    <p>لا توجد رسائل بعد</p>
                    <p className="text-sm">ابدأ المحادثة مع العميل</p>
                  </div>
                ) : (
                  clientMessages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender_type === 'lawyer' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] ${
                        msg.sender_type === 'lawyer' 
                          ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl rounded-tl-sm' 
                          : 'bg-white border border-gray-200 rounded-2xl rounded-tr-sm shadow-sm'
                      } p-4`}>
                        <p className={msg.sender_type === 'lawyer' ? 'text-white' : 'text-gray-800'}>{msg.content}</p>
                        <p className={`text-xs mt-2 ${msg.sender_type === 'lawyer' ? 'text-indigo-200' : 'text-gray-400'}`}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex gap-3">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    📎
                  </button>
                  <input
                    type="text"
                    value={newClientMessage}
                    onChange={(e) => setNewClientMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendClientMessage()}
                    placeholder="اكتب رسالتك للعميل..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button 
                    onClick={handleSendClientMessage}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
                  >
                    إرسال
                  </button>
                </div>
              </div>
            </div>

            {/* Internal Chat */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
              <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-amber-500 to-amber-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔒</span>
                    <div>
                      <h3 className="font-bold text-white">محادثة داخلية</h3>
                      <p className="text-sm text-amber-100">لا يراها العميل</p>
                    </div>
                  </div>
                  {internalMessages.filter(m => !m.is_read).length > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      جديد
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-amber-50">
                {collaborators.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <span className="text-4xl mb-3 block">👥</span>
                    <p>لا يوجد مشاركين</p>
                    <button 
                      onClick={() => setShowCollaboratorModal(true)}
                      className="mt-3 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                    >
                      + إضافة مشارك
                    </button>
                  </div>
                ) : (
                  <>
                    {internalMessages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender_id === currentLawyer?.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] ${
                          msg.sender_id === currentLawyer?.id 
                            ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-2xl rounded-tl-sm' 
                            : 'bg-white border border-amber-200 rounded-2xl rounded-tr-sm shadow-sm'
                        } p-4`}>
                          {msg.sender_id !== currentLawyer?.id && (
                            <p className="text-xs font-semibold text-amber-600 mb-1">{msg.sender_name}</p>
                          )}
                          <p className={msg.sender_id === currentLawyer?.id ? 'text-white' : 'text-gray-800'}>{msg.content}</p>
                          <p className={`text-xs mt-2 ${msg.sender_id === currentLawyer?.id ? 'text-amber-200' : 'text-gray-400'}`}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {collaborators.length > 0 && (
                <div className="p-4 border-t border-gray-200 bg-white">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newInternalMessage}
                      onChange={(e) => setNewInternalMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendInternalMessage()}
                      placeholder="اكتب رسالة للفريق..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <button 
                      onClick={handleSendInternalMessage}
                      className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition font-semibold"
                    >
                      إرسال
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Files */}
        {activeTab === 'files' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">📎 الملفات ({files.length})</h3>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition font-semibold"
              >
                + رفع ملف
              </button>
            </div>

            {files.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">📁</span>
                </div>
                <p className="text-gray-500 mb-4">لا توجد ملفات مرفقة</p>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                >
                  رفع أول ملف
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {files.map(file => (
                  <div key={file.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-2xl">
                          {file.file_type === 'pdf' ? '📄' : file.file_type?.includes('image') ? '🖼️' : '📁'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{file.file_name}</p>
                        <p className="text-sm text-gray-500">{formatFileSize(file.file_size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        file.uploaded_by_type === 'client' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {file.uploaded_by_type === 'client' ? '👤 العميل' : '👨‍⚖️ المحامي'}
                      </span>
                      <div className="flex gap-2">
                        <a 
                          href={file.file_url} 
                          target="_blank"
                          className="p-2 hover:bg-gray-100 rounded-lg transition"
                        >
                          👁️
                        </a>
                        <a 
                          href={file.file_url} 
                          download
                          className="p-2 hover:bg-gray-100 rounded-lg transition"
                        >
                          ⬇️
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Appointments */}
        {activeTab === 'appointments' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-800">📅 المواعيد ({appointments.length})</h3>
                  <button 
                    onClick={() => setShowAppointmentModal(true)}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition font-semibold"
                  >
                    + إضافة موعد
                  </button>
                </div>

                {appointments.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="text-4xl mb-4 block">📅</span>
                    <p className="text-gray-500">لا توجد مواعيد</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {appointments.map(apt => (
                      <div key={apt.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                              appointmentTypeLabels[apt.appointment_type]?.color || 'bg-gray-100'
                            }`}>
                              {appointmentTypeLabels[apt.appointment_type]?.icon || '📅'}
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-800">{apt.title}</h4>
                              <p className="text-sm text-gray-500">{appointmentTypeLabels[apt.appointment_type]?.label}</p>
                              <div className="flex items-center gap-4 mt-2 text-sm">
                                <span className="text-gray-600">📅 {formatDate(apt.start_datetime)}</span>
                                <span className="text-gray-600">🕐 {formatTime(apt.start_datetime)}</span>
                                {apt.location && <span className="text-gray-600">📍 {apt.location}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button className="p-2 hover:bg-gray-100 rounded-lg">✏️</button>
                            <button className="p-2 hover:bg-red-100 rounded-lg text-red-500">🗑️</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              {/* Mini Calendar Placeholder */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="font-bold text-gray-800 mb-4">📆 يناير 2026</h3>
                <div className="grid grid-cols-7 gap-1 text-center text-sm">
                  {['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'].map(day => (
                    <div key={day} className="py-2 font-semibold text-gray-500">{day}</div>
                  ))}
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <div 
                      key={day} 
                      className={`py-2 rounded-lg ${
                        day === new Date().getDate() ? 'bg-amber-500 text-white font-bold' :
                        appointments.some(a => new Date(a.start_datetime).getDate() === day) ? 'bg-blue-100 text-blue-700 font-semibold' :
                        'hover:bg-gray-100'
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Timeline */}
        {activeTab === 'timeline' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">📜 سجل النشاطات</h3>

            {activityLogs.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl mb-4 block">📜</span>
                <p className="text-gray-500">لا توجد نشاطات مسجلة</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute top-0 bottom-0 right-6 w-0.5 bg-gray-200"></div>
                <div className="space-y-6">
                  {activityLogs.map((log, index) => (
                    <div key={log.id} className="flex gap-4 relative">
                      <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center z-10 flex-shrink-0">
                        <span className="text-xl">
                          {log.activity_type.includes('message') ? '💬' :
                           log.activity_type.includes('file') ? '📁' :
                           log.activity_type.includes('status') ? '🔄' :
                           log.activity_type.includes('time') ? '⏱️' :
                           log.activity_type.includes('appointment') ? '📅' :
                           '📝'}
                        </span>
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-gray-800">{log.description}</p>
                            <span className="text-xs text-gray-400">{formatDateTime(log.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-500">بواسطة: {log.user_name || 'النظام'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          Modals
      ═══════════════════════════════════════════════════════════════════════════════ */}

      {/* NOLEX Modal */}
      {showNolexModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🤖</span>
                <div>
                  <h2 className="text-xl font-bold text-white">مساعد NOLEX</h2>
                  <p className="text-sm text-blue-100">المساعد القانوني الذكي</p>
                </div>
              </div>
              <button onClick={() => setShowNolexModal(false)} className="text-white hover:text-gray-200 text-2xl">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
              {nolexMessages.length === 0 && (
                <div className="text-center py-8">
                  <span className="text-5xl mb-4 block">🤖</span>
                  <p className="text-gray-600 mb-2">مرحباً! أنا NOLEX، مساعدك القانوني الذكي</p>
                  <p className="text-gray-500 text-sm">اسألني عن أي استفسار قانوني متعلق بهذا الطلب</p>
                </div>
              )}
              {nolexMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tl-sm' 
                      : 'bg-white border border-gray-200 rounded-tr-sm shadow-sm'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {nolexLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-tr-sm p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-white rounded-b-2xl">
              <div className="flex gap-3 mb-3">
                <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200">📚 بحث المكتبة</button>
                <button className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200">📝 صياغة رد</button>
                <button className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200">📋 ملخص</button>
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={nolexInput}
                  onChange={(e) => setNolexInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleNolexSend()}
                  placeholder="اكتب سؤالك..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  onClick={handleNolexSend}
                  disabled={nolexLoading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold disabled:opacity-50"
                >
                  إرسال
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Appointment Modal */}
      {showAppointmentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">📅 إضافة موعد جديد</h2>
              <button onClick={() => setShowAppointmentModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">عنوان الموعد *</label>
                <input
                  type="text"
                  value={appointmentForm.title}
                  onChange={(e) => setAppointmentForm({...appointmentForm, title: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="مثال: جلسة محكمة"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">نوع الموعد</label>
                <select
                  value={appointmentForm.appointment_type}
                  onChange={(e) => setAppointmentForm({...appointmentForm, appointment_type: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  {Object.entries(appointmentTypeLabels).map(([key, val]) => (
                    <option key={key} value={key}>{val.icon} {val.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">التاريخ *</label>
                  <input
                    type="date"
                    value={appointmentForm.start_date}
                    onChange={(e) => setAppointmentForm({...appointmentForm, start_date: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">الوقت *</label>
                  <input
                    type="time"
                    value={appointmentForm.start_time}
                    onChange={(e) => setAppointmentForm({...appointmentForm, start_time: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">المكان / الرابط</label>
                <input
                  type="text"
                  value={appointmentForm.location}
                  onChange={(e) => setAppointmentForm({...appointmentForm, location: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="العنوان أو رابط الاجتماع"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={appointmentForm.notify_client}
                  onChange={(e) => setAppointmentForm({...appointmentForm, notify_client: e.target.checked})}
                  className="w-4 h-4 text-amber-500 rounded"
                />
                <span className="text-gray-700">إشعار العميل بالموعد</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowAppointmentModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button 
                onClick={handleAddAppointment}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold"
              >
                حفظ الموعد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Time Modal */}
      {showTimeLogModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">⏱️ تسجيل الوقت</h2>
              <button onClick={() => setShowTimeLogModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">عدد الساعات *</label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={timeLogForm.hours}
                  onChange={(e) => setTimeLogForm({...timeLogForm, hours: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="مثال: 1.5"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">نوع العمل</label>
                <select
                  value={timeLogForm.work_type}
                  onChange={(e) => setTimeLogForm({...timeLogForm, work_type: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  {Object.entries(workTypeLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">التاريخ</label>
                <input
                  type="date"
                  value={timeLogForm.work_date}
                  onChange={(e) => setTimeLogForm({...timeLogForm, work_date: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">الوصف (اختياري)</label>
                <textarea
                  value={timeLogForm.description}
                  onChange={(e) => setTimeLogForm({...timeLogForm, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  rows={2}
                  placeholder="ماذا عملت..."
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-700">
                  <span className="font-semibold">الإجمالي الحالي:</span> {getTotalHours()} ساعة
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowTimeLogModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button 
                onClick={handleLogTime}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Request Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">✅ إنهاء الطلب وإرسال الرد النهائي</h2>
              <button onClick={() => setShowCompleteModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">الرد النهائي للعميل *</label>
                <textarea
                  value={completeForm.response_content}
                  onChange={(e) => setCompleteForm({...completeForm, response_content: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={6}
                  placeholder="اكتب ردك النهائي للعميل..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">التوصيات (اختياري)</label>
                <textarea
                  value={completeForm.recommendations}
                  onChange={(e) => setCompleteForm({...completeForm, recommendations: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="أي توصيات إضافية للعميل..."
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="block text-sm font-semibold text-gray-700 mb-2">إرفاق ملفات</label>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                >
                  + إضافة ملف
                </button>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4 text-green-500 rounded" />
                <span className="text-gray-700">إرسال إشعار للعميل</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowCompleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                معاينة
              </button>
              <button 
                onClick={handleCompleteRequest}
                className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold"
              >
                ✅ إرسال وإنهاء الطلب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Collaborator Modal */}
      {showCollaboratorModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">👥 إضافة مشارك</h2>
              <button onClick={() => setShowCollaboratorModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">البحث عن محامي</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="اسم المحامي أو الكود..."
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 text-center">
                  ابحث عن محامي للمشاركة في هذا الطلب
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">سبب الطلب</label>
                <textarea
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  rows={2}
                  placeholder="لماذا تحتاج مشاركة هذا المحامي..."
                />
              </div>

              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                ⚠️ طلب المشاركة يحتاج موافقة المدير
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowCollaboratorModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold">
                إرسال الطلب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POA Modal */}
      {showPoaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">📄 طلب إصدار وكالة</h3>
              <button onClick={() => setShowPoaModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            {poaDocument ? (
              /* الوكالة موجودة */
              <div className="space-y-4">
                <div className={`${poaDocument.status === 'approved' ? 'bg-green-50 border-green-200' : poaDocument.status === 'submitted' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'} border rounded-xl p-4`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 ${poaDocument.status === 'approved' ? 'bg-green-100' : 'bg-blue-100'} rounded-lg flex items-center justify-center`}>
                      <span className="text-2xl">{poaDocument.status === 'approved' ? '✅' : '📄'}</span>
                    </div>
                    <div>
                      <p className={`font-semibold ${poaDocument.status === 'approved' ? 'text-green-800' : 'text-blue-800'}`}>
                        {poaDocument.status === 'approved' ? 'الوكالة مقبولة' : 'الوكالة مرفوعة - بانتظار المراجعة'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(poaDocument.uploaded_at).toLocaleDateString('ar-SA')}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{poaDocument.file_name}</p>
                  <a 
                    href={poaDocument.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <span>📥</span> عرض/تحميل الوكالة
                  </a>
                </div>

                {/* أزرار القبول والرفض - تظهر فقط إذا الوكالة بانتظار المراجعة */}
                {poaDocument.status === 'submitted' && !showPoaRejectForm && (
                  <div className="flex gap-3">
                    <button 
                      onClick={handleApprovePoa}
                      disabled={processingPoa}
                      className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span>✅</span> قبول الوكالة
                    </button>
                    <button 
                      onClick={() => setShowPoaRejectForm(true)}
                      disabled={processingPoa}
                      className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span>❌</span> رفض الوكالة
                    </button>
                  </div>
                )}

                {/* نموذج سبب الرفض */}
                {showPoaRejectForm && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                    <label className="block text-sm font-semibold text-red-800">سبب رفض الوكالة *</label>
                    <textarea
                      value={poaRejectionReason}
                      onChange={(e) => setPoaRejectionReason(e.target.value)}
                      className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      rows={3}
                      placeholder="اكتب سبب الرفض..."
                    />
                    <div className="flex gap-3">
                      <button 
                        onClick={() => { setShowPoaRejectForm(false); setPoaRejectionReason('') }}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                      >
                        إلغاء
                      </button>
                      <button 
                        onClick={handleRejectPoa}
                        disabled={processingPoa || !poaRejectionReason.trim()}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50"
                      >
                        {processingPoa ? 'جاري الإرسال...' : 'تأكيد الرفض'}
                      </button>
                    </div>
                  </div>
                )}

                {/* زر فتح قضية - يظهر فقط بعد قبول الوكالة */}
                {poaDocument.status === 'approved' && (
                  <button 
                  onClick={() => { setShowPoaModal(false); router.push(`/independent/cases/new?request_id=${requestId}`) }}                    className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold flex items-center justify-center gap-2"
                  >
                    <span>⚖️</span> فتح قضية جديدة
                  </button>
                )}

                <button 
                  onClick={() => setShowPoaModal(false)}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                >
                  إغلاق
                </button>
              </div>
            ) : poaRequest ? (
              /* طلب الوكالة مرسل - بانتظار المشترك */
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">⏳</span>
                    </div>
                    <div>
                      <p className="font-semibold text-amber-800">بانتظار المشترك</p>
                      <p className="text-sm text-amber-600">تم إرسال طلب الوكالة</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                    <p><span className="text-gray-500">اسم الموكل:</span> {poaRequest.principal_name}</p>
                    <p><span className="text-gray-500">رقم الهوية:</span> {poaRequest.principal_national_id}</p>
                    <p><span className="text-gray-500">صيغة الوكالة:</span></p>
                    <p className="bg-gray-50 p-2 rounded text-gray-700">{poaRequest.poa_template}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPoaModal(false)}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              /* نموذج طلب الوكالة */
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-700">
                    📝 أدخل بيانات الموكل (المشترك) والصيغة المطلوبة للوكالة
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">اسم الموكل *</label>
                    <input
                      type="text"
                      value={poaRequestForm.principal_name}
                      onChange={(e) => setPoaRequestForm({...poaRequestForm, principal_name: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="الاسم الرباعي"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">رقم الهوية الوطنية *</label>
                    <input
                      type="text"
                      value={poaRequestForm.principal_national_id}
                      onChange={(e) => setPoaRequestForm({...poaRequestForm, principal_national_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="10 أرقام"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">تاريخ الميلاد</label>
                    <input
                      type="date"
                      value={poaRequestForm.principal_date_of_birth}
                      onChange={(e) => setPoaRequestForm({...poaRequestForm, principal_date_of_birth: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">رقم الجوال</label>
                    <input
                      type="tel"
                      value={poaRequestForm.principal_phone}
                      onChange={(e) => setPoaRequestForm({...poaRequestForm, principal_phone: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="05xxxxxxxx"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">صيغة الوكالة المطلوبة *</label>
                  <textarea
                    value={poaRequestForm.poa_template}
                    onChange={(e) => setPoaRequestForm({...poaRequestForm, poa_template: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    rows={4}
                    placeholder="حدد نوع التوكيل والصلاحيات المطلوبة..."
                  />
                </div>

                {/* رسالة تحذيرية */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800 font-semibold mb-1">⚠️ تنبيه مهم</p>
                  <p className="text-sm text-amber-700">
                    عند إصدار وكالة نأمل التأكد من الصيغة المطلوبة، كما أن هناك مفردات تمكن وتمنح المحامي الصلاحية المطلقة يجب التأكد عند إصدارها مثل (حق التوكيل للغير، الإقرار، الهبة، الإثبات، القبول، الخ)
                  </p>
                </div>

                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={() => setShowPoaModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={handleSubmitPoaRequest}
                    disabled={submittingPoa}
                    className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold disabled:opacity-50"
                  >
                    {submittingPoa ? 'جاري الإرسال...' : '📤 إرسال طلب الوكالة'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
