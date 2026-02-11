'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { useRealtimeInsert } from '@/hooks/useSupabaseRealtime'
// Commented out due to missing module/type declaration
import toast from 'react-hot-toast'
import { getEmployeeId, getPartnerId } from '@/lib/cookies'
import {
  ArrowRight, Clock, User, FileText, Calendar, MessageSquare,
  Users, Send, Paperclip, Bot, Search, Timer, Plus, Check, X,
  AlertCircle, CheckCircle, XCircle, RefreshCw, Scale, Gavel,
  BookOpen, StickyNote, ChevronDown, MoreVertical, Download,
  Eye, Phone, Mail, Building2, Tag, Bookmark, Upload, AtSign,
  Bell, Shield, UserCheck, Lock
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 تفاصيل الطلب - الشريك القانوني
// تاريخ: 1 يناير 2026
// يشمل: صلاحيات المدير الكاملة + تسجيل activity_logs + إشعارات
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 إعدادات العرض
// ═══════════════════════════════════════════════════════════════════════════════

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'قيد الانتظار', color: 'bg-gray-100 text-gray-700', icon: Clock },
  assigned: { label: 'معين', color: 'bg-blue-100 text-blue-700', icon: User },
  accepted: { label: 'مقبول', color: 'bg-indigo-100 text-indigo-700', icon: CheckCircle },
  in_progress: { label: 'قيد العمل', color: 'bg-purple-100 text-purple-700', icon: Timer },
  completed: { label: 'مكتمل', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed: { label: 'مغلق', color: 'bg-slate-100 text-slate-700', icon: XCircle },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700', icon: XCircle },
}

const typeConfig: Record<string, { label: string; color: string }> = {
  consultation: { label: 'استشارة', color: 'bg-blue-500' },
  case: { label: 'قضية', color: 'bg-purple-500' },
  extra_service: { label: 'خدمة إضافية', color: 'bg-emerald-500' },
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

// ═══════════════════════════════════════════════════════════════════════════════
// 📄 الصفحة الرئيسية
// ═══════════════════════════════════════════════════════════════════════════════

export default function PartnerRequestDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = params.id as string
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📊 الحالات (States)
  // ═══════════════════════════════════════════════════════════════════════════════

  const [isLoading, setIsLoading] = useState(true)
  const [request, setRequest] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [internalChat, setInternalChat] = useState<any[]>([])
  const [collaborators, setCollaborators] = useState<any[]>([])
  const [timeLogs, setTimeLogs] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])

  // معلومات المستخدم الحالي
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    role: string;
    isManager: boolean;
    hasLicense: boolean;
    licenseValid: boolean;
  } | null>(null)

  // التبويب النشط
  const [activeTab, setActiveTab] = useState<'overview' | 'member' | 'team' | 'files' | 'timeline'>('overview')
  
  // الرسائل
  const [newMessage, setNewMessage] = useState('')
  const [newInternalMessage, setNewInternalMessage] = useState('')
  const [mentionSearch, setMentionSearch] = useState('')
  const [showMentionList, setShowMentionList] = useState(false)
  
  // Modals
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showTransferToSelfModal, setShowTransferToSelfModal] = useState(false)
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false)
  const [showTimeLogModal, setShowTimeLogModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showConvertCaseModal, setShowConvertCaseModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

  // نماذج الإدخال
  const [rejectReason, setRejectReason] = useState('')
  const [transferReason, setTransferReason] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [collaboratorReason, setCollaboratorReason] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  
  // Time log form
  const [timeLogForm, setTimeLogForm] = useState({
    hours: '',
    work_type: 'research',
    description: ''
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔐 حساب الصلاحيات
  // ═══════════════════════════════════════════════════════════════════════════════

  const isOwner = request?.assigned_partner_employee_id === currentUser?.id
  const isCollaborator = collaborators.some(c => c.lawyer_id === currentUser?.id && c.status === 'approved')
  const isManager = currentUser?.isManager || false
  const canRespond = isOwner // فقط صاحب الطلب يرد
  const canViewAll = isManager // المدير يرى كل شيء
  const canAddComment = isOwner || isCollaborator || isManager // الجميع يعلق داخلياً
  const canTransferToSelf = isManager && currentUser?.hasLicense && currentUser?.licenseValid
  const canApproveTransfers = isManager
  const canCloseRequest = isOwner // فقط صاحب الطلب يغلق

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📥 تحميل البيانات
  // ═══════════════════════════════════════════════════════════════════════════════

  // Realtime: listen for new client messages
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

  // Realtime: listen for new internal chat messages
  useRealtimeInsert(
    `internal-chat-${requestId}`,
    'request_internal_chat',
    `request_id=eq.${requestId}`,
    (newMsg: any) => {
      if (!newMsg.is_hidden) {
        setInternalChat(prev => {
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
      const partnerId = getPartnerId()
      const empId = getEmployeeId()
      if (!partnerId || !empId) {
        router.push('/auth/partner-login')
        return
      }

      // جلب معلومات الموظف الحالي
      const { data: empData } = await supabase
        .from('partner_employees')
        .select('id, full_name, role, lawyer_license_number, lawyer_license_expiry')
        .eq('id', empId)
        .single()

      if (empData) {
        const licenseValid = empData.lawyer_license_expiry 
          ? new Date(empData.lawyer_license_expiry) > new Date() 
          : false
        setCurrentUser({
          id: empData.id,
          name: empData.full_name,
          role: empData.role,
          isManager: ['owner', 'manager', 'legal_manager'].includes(empData.role),
          hasLicense: !!empData.lawyer_license_number,
          licenseValid
        })
      }

      // جلب الطلب
      const { data: requestData, error } = await supabase
        .from('service_requests')
        .select(`
          *,
          category:category_id(name_ar, icon),
          subcategory:subcategory_id(name_ar),
          assigned_employee:assigned_partner_employee_id(id, full_name, email, phone)
        `)
        .eq('id', requestId)
        .single()

      if (error) throw error
      setRequest(requestData)

      // تسجيل دخول للطلب في activity_logs
      await logActivity('view_request', 'عرض تفاصيل الطلب')

      // رسائل المشترك
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .eq('request_id', requestId)
        .eq('private', false)
        .order('created_at', { ascending: true })
      setMessages(messagesData || [])

      // المحادثة الداخلية
      const { data: internalData } = await supabase
        .from('request_internal_chat')
        .select('*')
        .eq('request_id', requestId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: true })
      setInternalChat(internalData || [])

      // المشاركين
      const { data: collabData } = await supabase
        .from('request_collaborators')
        .select('*')
        .eq('request_id', requestId)
        .neq('status', 'removed')
      setCollaborators(collabData || [])

      // سجل الوقت
      const { data: timeData } = await supabase
        .from('lawyer_time_logs')
        .select('*')
        .eq('request_id', requestId)
        .order('work_date', { ascending: false })
      setTimeLogs(timeData || [])

      // التايملاين من activity_logs
      const { data: timelineData } = await supabase
        .from('activity_logs')
        .select('*')
        .or(`metadata->>request_id.eq.${requestId},user_id.eq.${requestId}`)
        .order('created_at', { ascending: false })
        .limit(50)
      setTimeline(timelineData || [])

      // الموظفين
      const { data: empsData } = await supabase
        .from('partner_employees')
        .select('id, full_name, role, department_id, lawyer_license_number')
        .eq('partner_id', partnerId)
        .eq('status', 'active')
      setEmployees(empsData || [])

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📝 تسجيل النشاط (Activity Logging)
  // ═══════════════════════════════════════════════════════════════════════════════

  const logActivity = async (activityType: string, description: string, metadata: any = {}) => {
    try {
      await supabase.from('activity_logs').insert({
        user_id: currentUser?.id,
        user_type: currentUser?.isManager ? 'manager' : 'lawyer',
        activity_type: activityType,
        description,
        metadata: {
          request_id: requestId,
          user_name: currentUser?.name,
          ...metadata
        }
      })
    } catch (error) {
      console.error('Log error:', error)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔔 إرسال الإشعارات
  // ═══════════════════════════════════════════════════════════════════════════════

  const sendNotification = async (recipientId: string, title: string, message: string, type: string = 'request') => {
    try {
      await supabase.from('notifications').insert({
        recipient_id: recipientId,
        recipient_type: 'partner_employee',
        title,
        message,
        type,
        metadata: { request_id: requestId }
      })
    } catch (error) {
      console.error('Notification error:', error)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ⚡ الإجراءات
  // ═══════════════════════════════════════════════════════════════════════════════

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
        .update({ 
          status: 'cancelled',
          cancellation_reason: rejectReason
        })
        .eq('id', requestId)
      
      await logActivity('reject_request', 'تم رفض الطلب', { reason: rejectReason })
      toast.success('تم رفض الطلب')
      setShowRejectModal(false)
      router.push('/partner/requests')
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // طلب تحويل (يحتاج موافقة المدير)
  const handleTransferRequest = async () => {
    if (!selectedEmployee || !transferReason.trim()) {
      toast.error('يرجى اختيار المحامي وكتابة السبب')
      return
    }
    try {
      await supabase.from('request_transfers').insert({
        request_id: requestId,
        from_lawyer_id: currentUser?.id,
        to_lawyer_id: selectedEmployee,
        transfer_reason: transferReason,
        transferred_by: currentUser?.id,
        status: 'pending'
      })
      
      await logActivity('transfer_request', 'طلب تحويل الطلب', { to: selectedEmployee })
      
      // إشعار المدير
      const managers = employees.filter(e => ['owner', 'manager', 'legal_manager'].includes(e.role))
      for (const mgr of managers) {
        await sendNotification(mgr.id, 'طلب تحويل جديد', `طلب تحويل من ${currentUser?.name}`, 'transfer_request')
      }
      
      toast.success('✅ تم إرسال طلب التحويل للمدير')
      setShowTransferModal(false)
      setTransferReason('')
      setSelectedEmployee('')
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // تحويل الطلب لنفسي (للمدير فقط)
  const handleTransferToSelf = async () => {
    if (!canTransferToSelf) {
      toast.error('لا يمكنك تحويل الطلب - تحقق من رخصتك')
      return
    }
    try {
      const previousOwner = request.assigned_partner_employee_id

      await supabase
        .from('service_requests')
        .update({ 
          assigned_partner_employee_id: currentUser?.id,
          assigned_at: new Date().toISOString()
        })
        .eq('id', requestId)
      
      // تسجيل التحويل
      await supabase.from('request_transfers').insert({
        request_id: requestId,
        from_lawyer_id: previousOwner,
        to_lawyer_id: currentUser?.id,
        transfer_reason: 'تحويل ذاتي من المدير',
        transferred_by: currentUser?.id,
        status: 'approved',
        approved_by: currentUser?.id,
        approved_at: new Date().toISOString()
      })
      
      await logActivity('transfer_to_self', 'قام المدير بتحويل الطلب لنفسه')
      
      // إشعار المحامي السابق
      if (previousOwner) {
        await sendNotification(previousOwner, 'تم تحويل طلبك', `قام ${currentUser?.name} بتحويل الطلب لنفسه`, 'transfer')
      }
      
      toast.success('✅ تم تحويل الطلب إليك')
      setShowTransferToSelfModal(false)
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // طلب مشارك
  const handleCollaboratorRequest = async () => {
    if (!selectedEmployee) {
      toast.error('يرجى اختيار المحامي')
      return
    }
    
    const selectedEmp = employees.find(e => e.id === selectedEmployee)
    
    try {
      await supabase.from('request_collaborators').insert({
        request_id: requestId,
        lawyer_id: selectedEmployee,
        lawyer_type: 'partner_employee',
        lawyer_name: selectedEmp?.full_name,
        requested_by: currentUser?.id,
        requested_by_name: currentUser?.name,
        request_reason: collaboratorReason,
        status: isManager ? 'approved' : 'pending', // المدير يوافق مباشرة
        approved_by: isManager ? currentUser?.id : null,
        approved_at: isManager ? new Date().toISOString() : null
      })
      
      await logActivity('add_collaborator', `إضافة مشارك: ${selectedEmp?.full_name}`)
      
      // إشعار المحامي المضاف
      await sendNotification(selectedEmployee, 'تمت إضافتك كمشارك', `أضافك ${currentUser?.name} في طلب`, 'collaborator')
      
      toast.success(isManager ? '✅ تم إضافة المشارك' : '✅ تم إرسال طلب المشاركة للمدير')
      setShowCollaboratorModal(false)
      setCollaboratorReason('')
      setSelectedEmployee('')
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // إرسال رسالة للمشترك
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return
    if (!canRespond) {
      toast.error('لا يمكنك الرد - قم بتحويل الطلب لنفسك أولاً')
      return
    }
    const messageText = newMessage
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
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      toast.error('حدث خطأ')
    }
  }

  // إرسال رسالة داخلية مع دعم @mention
  const handleSendInternalMessage = async () => {
    if (!newInternalMessage.trim()) return
    const messageText = newInternalMessage
    try {
      // استخراج mentions
      const mentionRegex = /@(\w+)/g
      const mentions: string[] = []
      let match
      while ((match = mentionRegex.exec(messageText)) !== null) {
        const mentionedEmp = employees.find(e => e.full_name.includes(match[1]))
        if (mentionedEmp) mentions.push(mentionedEmp.id)
      }

      // Optimistic update
      const optimisticMsg = {
        id: `temp-${Date.now()}`,
        request_id: requestId,
        sender_id: currentUser?.id,
        sender_type: currentUser?.isManager ? 'manager' : 'lawyer',
        sender_name: currentUser?.name,
        content: messageText,
        mentions,
        created_at: new Date().toISOString()
      }
      setInternalChat(prev => [...prev, optimisticMsg])
      setNewInternalMessage('')
      setShowMentionList(false)

      await supabase.from('request_internal_chat').insert({
        request_id: requestId,
        sender_id: currentUser?.id,
        sender_type: currentUser?.isManager ? 'manager' : 'lawyer',
        sender_name: currentUser?.name,
        content: messageText,
        mentions: mentions
      })

      await logActivity('internal_message', 'رسالة داخلية')

      // إشعار المذكورين
      for (const mentionId of mentions) {
        await sendNotification(mentionId, 'تم ذكرك في محادثة', `ذكرك ${currentUser?.name} في طلب`, 'mention')
      }
    } catch (error) {
      setInternalChat(prev => prev.filter(m => !m.id.startsWith('temp-')))
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
      const { data, error } = await supabase.storage
        .from('request-files')
        .upload(fileName, file)
      
      if (error) throw error
      
      const { data: urlData } = supabase.storage
        .from('request-files')
        .getPublicUrl(fileName)
      
      // إضافة في المحادثة الداخلية
      await supabase.from('request_internal_chat').insert({
        request_id: requestId,
        sender_id: currentUser?.id,
        sender_type: currentUser?.isManager ? 'manager' : 'lawyer',
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
      toast.error('فقط صاحب الطلب يمكنه إغلاقه')
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
      
      // إشعار المشاركين
      for (const collab of collaborators.filter(c => c.status === 'approved')) {
        await sendNotification(collab.lawyer_id, 'تم إغلاق الطلب', `قام ${currentUser?.name} بإغلاق الطلب`, 'request_closed')
      }
      
      toast.success('✅ تم إغلاق الطلب')
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🛠️ الدوال المساعدة
  // ═══════════════════════════════════════════════════════════════════════════════

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
      return { text: `${hours} ساعة`, color: 'bg-green-100 text-green-700' }
    }
    return null
  }

  const handleMentionInput = (text: string) => {
    setNewInternalMessage(text)
    const lastWord = text.split(' ').pop() || ''
    if (lastWord.startsWith('@') && lastWord.length > 1) {
      setMentionSearch(lastWord.slice(1))
      setShowMentionList(true)
    } else {
      setShowMentionList(false)
    }
  }

  const insertMention = (emp: any) => {
    const words = newInternalMessage.split(' ')
    words[words.length - 1] = `@${emp.full_name} `
    setNewInternalMessage(words.join(' '))
    setShowMentionList(false)
  }

  const totalHours = timeLogs.reduce((sum, log) => sum + (log.hours || 0), 0)

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎨 العرض
  // ═══════════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 mx-auto text-red-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">الطلب غير موجود</h2>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
          رجوع
        </button>
      </div>
    )
  }

  const slaStatus = getSlaStatus()
  const StatusIcon = statusConfig[request.status]?.icon || Clock

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════════════════════════════════════════════
          📌 Header
          ═══════════════════════════════════════════════════════════════════════════════ */}
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
          
          {/* شارة الصلاحية */}
          <div className="flex items-center gap-2">
            {isManager && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium flex items-center gap-1">
                <Shield className="w-3 h-3" />
                مدير
              </span>
            )}
            {isOwner && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                صاحب الطلب
              </span>
            )}
            {isCollaborator && !isOwner && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                <Users className="w-3 h-3" />
                مشارك
              </span>
            )}
            <span className={`px-2 py-1 rounded text-xs font-medium ${priorityConfig[request.priority]?.color}`}>
              {priorityConfig[request.priority]?.label}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* ═══════════════════════════════════════════════════════════════════════════════
            📄 المحتوى الرئيسي
            ═══════════════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-3 space-y-4">
          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="flex border-b overflow-x-auto">
              {[
                { key: 'overview', label: 'نظرة عامة', icon: Eye },
                { key: 'member', label: '💬 المشترك', icon: MessageSquare, count: messages.length },
                { key: 'team', label: '👥 الفريق', icon: Users, count: collaborators.filter(c => c.status === 'approved').length },
                { key: 'files', label: '📎 الملفات', icon: Paperclip },
                { key: 'timeline', label: '📜 السجل', icon: Clock },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 px-4 py-3 font-medium whitespace-nowrap border-b-2 transition-all ${
                    activeTab === tab.key
                      ? 'text-blue-600 border-blue-600'
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
              {/* ═══════════════════════════════════════════════════════════════════════════════
                  📋 نظرة عامة
                  ═══════════════════════════════════════════════════════════════════════════════ */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* توجيه NOLEX */}
                  {request.nolex_guidance && (
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                      <h4 className="font-bold text-purple-800 mb-2 flex items-center gap-2">
                        <Bot className="w-5 h-5" />
                        توجيه NOLEX
                      </h4>
                      <p className="text-purple-700">{request.nolex_guidance}</p>
                    </div>
                  )}

                  {/* الوصف */}
                  <div>
                    <h4 className="font-medium text-slate-800 mb-2">وصف الطلب</h4>
                    <p className="text-slate-600 bg-slate-50 p-4 rounded-lg whitespace-pre-wrap">
                      {request.description || 'لا يوجد وصف'}
                    </p>
                  </div>

                  {/* التصنيف والمعلومات */}
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

                  {/* المرفقات الأصلية */}
                  {request.attachments && request.attachments.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-800 mb-2">المرفقات من المشترك</h4>
                      <div className="flex flex-wrap gap-2">
                        {request.attachments.map((file: any, idx: number) => (<a key={idx} href={file.url} target="_blank" className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"><FileText className="w-4 h-4 text-blue-600" /><span className="text-sm">{file.name || `ملف ${idx + 1}`}</span><Download className="w-4 h-4 text-slate-400" /></a>))}</div></div>
              )}

                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════════════════════
                  💬 محادثة المشترك
                  ═══════════════════════════════════════════════════════════════════════════════ */}
              {activeTab === 'member' && (
                <div className="space-y-4">
                  <div className="h-[400px] overflow-y-auto space-y-3 p-4 bg-slate-50 rounded-lg">
                    {messages.length > 0 ? messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_type === 'lawyer' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[70%] p-3 rounded-lg ${
                          msg.sender_type === 'lawyer'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white border shadow-sm'
                        }`}>
                          <p>{msg.content}</p>
                          <p className={`text-xs mt-1 ${msg.sender_type === 'lawyer' ? 'text-blue-100' : 'text-slate-400'}`}>
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
                  
                  {/* صندوق الرد */}
                  {canRespond && ['accepted', 'in_progress'].includes(request.status) ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="اكتب رسالتك للمشترك..."
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={handleSendMessage}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                      <Lock className="w-5 h-5" />
                      <span>
                        {isManager && !isOwner 
                          ? 'لا يمكنك الرد - قم بتحويل الطلب لنفسك أولاً'
                          : 'فقط صاحب الطلب يمكنه الرد على المشترك'
                        }
                      </span>
                      {isManager && !isOwner && canTransferToSelf && (
                        <button
                          onClick={() => setShowTransferToSelfModal(true)}
                          className="mr-auto px-3 py-1 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700"
                        >
                          تحويل لي
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════════════════════
                  👥 محادثة الفريق
                  ═══════════════════════════════════════════════════════════════════════════════ */}
              {activeTab === 'team' && (
                <div className="space-y-4">
                  {/* المشاركين */}
                  <div className="flex flex-wrap gap-2 pb-4 border-b">
                    <span className="text-sm text-slate-500">المشاركين:</span>
                    {/* صاحب الطلب */}
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      {request.assigned_employee?.full_name || 'غير معين'}
                    </span>
                    {collaborators.filter(c => c.status === 'approved').map(c => (
                      <span key={c.id} className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                        {c.lawyer_name}
                      </span>
                    ))}
                    {collaborators.filter(c => c.status === 'pending').map(c => (
                      <span key={c.id} className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                        {c.lawyer_name} (بانتظار الموافقة)
                      </span>
                    ))}
                  </div>

                  {/* المحادثة الداخلية */}
                  <div className="h-[350px] overflow-y-auto space-y-3 p-4 bg-slate-50 rounded-lg">
                    {internalChat.length > 0 ? internalChat.map(msg => (
                      <div key={msg.id} className="flex gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                          msg.sender_type === 'manager' ? 'bg-purple-500' : 'bg-emerald-500'
                        }`}>
                          {msg.sender_name?.[0] || '؟'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{msg.sender_name}</span>
                            {msg.sender_type === 'manager' && (
                              <span className="text-xs bg-purple-100 text-purple-600 px-1 rounded">مدير</span>
                            )}
                            <span className="text-xs text-slate-400">{formatDateTime(msg.created_at)}</span>
                          </div>
                          <p className="text-slate-600 mt-1">{msg.content}</p>
                          {/* المرفقات */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {msg.attachments.map((file: any, idx: number) => (<a key={idx} href={file.file_url} target="_blank" className="flex items-center gap-1 px-2 py-1 bg-white border rounded text-sm text-blue-600 hover:bg-blue-50"><Paperclip className="w-3 h-3" />{file.file_name}</a>))}
                            </div>
                          )}
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                        <p>لا توجد محادثات داخلية</p>
                      </div>
                    )}
                  </div>

                  {/* صندوق الرسالة الداخلية مع @mention */}
                  {canAddComment && (
                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={newInternalMessage}
                            onChange={(e) => handleMentionInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendInternalMessage()}
                            placeholder="اكتب ملاحظة للفريق... (استخدم @ للإشارة)"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                          />
                          {/* قائمة @mention */}
                          {showMentionList && (
                            <div className="absolute bottom-full mb-1 right-0 w-64 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                              {employees
                                .filter(e => e.full_name.includes(mentionSearch))
                                .slice(0, 5)
                                .map(emp => (
                                  <button
                                    key={emp.id}
                                    onClick={() => insertMention(emp)}
                                    className="w-full px-3 py-2 text-right hover:bg-slate-100 flex items-center gap-2"
                                  >
                                    <AtSign className="w-4 h-4 text-blue-500" />
                                    <span>{emp.full_name}</span>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                          disabled={uploadingFile}
                        >
                          {uploadingFile ? (
                            <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Paperclip className="w-5 h-5 text-slate-600" />
                          )}
                        </button>
                        <button
                          onClick={handleSendInternalMessage}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════════════════════
                  📎 الملفات
                  ═══════════════════════════════════════════════════════════════════════════════ */}
              {activeTab === 'files' && (
                <div className="space-y-4">
                  {/* ملفات من المحادثة الداخلية */}
                  {(() => {
                    const allFiles = internalChat
                      .filter(msg => msg.attachments && msg.attachments.length > 0)
                      .flatMap(msg => msg.attachments.map((f: any) => ({
                        ...f,
                        uploaded_by: msg.sender_name,
                        uploaded_at: msg.created_at
                      })))
                    
                    return allFiles.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {allFiles.map((file: any, idx: number) => (
                          <div key={idx} className="p-4 bg-slate-50 rounded-lg flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-800 truncate">{file.file_name}</p>
                              <p className="text-sm text-slate-500">
                                بواسطة {file.uploaded_by} - {formatDate(file.uploaded_at)}
                              </p>
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
                        {canAddComment && (
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            رفع ملف
                          </button>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════════════════════
                  📜 السجل (Activity Log)
                  ═══════════════════════════════════════════════════════════════════════════════ */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  {timeline.length > 0 ? (
                    <div className="relative">
                      <div className="absolute top-0 bottom-0 right-4 w-0.5 bg-slate-200"></div>
                      <div className="space-y-4">
                        {timeline.map(item => (
                          <div key={item.id} className="flex gap-4 relative">
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center z-10">
                              <Clock className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 pb-4">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-slate-800">{item.activity_type}</p>
                                {item.metadata?.user_name && (
                                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                    {item.metadata.user_name}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                              )}
                              <p className="text-xs text-slate-400 mt-1">
                                {typeof formatDateTime === 'function'
                                  ? formatDateTime(item.created_at)
                                  : item.created_at}
                              </p>
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

        {/* ═══════════════════════════════════════════════════════════════════════════════
            📊 الشريط الجانبي
            ═══════════════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          {/* معلومات الطلب */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-slate-800 mb-4">📊 معلومات</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">المحامي</span>
                <span className="text-slate-800 font-medium">{request.assigned_employee?.full_name || 'غير معين'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">تاريخ القبول</span>
                <span className="text-slate-800">{formatDate(request.accepted_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">المشاركين</span>
                <span className="text-slate-800">{collaborators.filter(c => c.status === 'approved').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الوقت المسجل</span>
                <span className="text-slate-800">{totalHours} ساعة</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الرسائل</span>
                <span className="text-slate-800">{messages.length}</span>
              </div>
            </div>
          </div>

          {/* الأدوات */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-slate-800 mb-4">🛠️ الأدوات</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-purple-50 rounded-lg text-purple-600 transition-colors">
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
                className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-slate-100 rounded-lg text-slate-700 transition-colors"
              >
                <Upload className="w-5 h-5" />
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
              {/* إجراءات القبول/الرفض */}
              {isOwner && request.status === 'assigned' && (
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

              {/* تحويل للنفس (للمدير فقط) */}
              {isManager && !isOwner && canTransferToSelf && ['assigned', 'accepted', 'in_progress'].includes(request.status) && (
                <button 
                  onClick={() => setShowTransferToSelfModal(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-700 transition-colors"
                >
                  <UserCheck className="w-5 h-5" />
                  <span>تحويل لنفسي</span>
                </button>
              )}

              {/* إجراءات أثناء العمل */}
              {['accepted', 'in_progress'].includes(request.status) && (
                <>
                  <button 
                    onClick={() => setShowCollaboratorModal(true)} 
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors"
                  >
                    <Users className="w-5 h-5" />
                    <span>إضافة مشارك</span>
                  </button>
                  
                  {isOwner && (
                    <button 
                      onClick={() => setShowTransferModal(true)} 
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors"
                    >
                      <RefreshCw className="w-5 h-5" />
                      <span>طلب تحويل</span>
                    </button>
                  )}

                  {canCloseRequest && (
                    <button 
                      onClick={handleClose} 
                      className="w-full flex items-center gap-3 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-700 transition-colors"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>إغلاق الطلب</span>
                    </button>
                  )}
                </>
              )}

              {/* حالة مغلق/مكتمل */}
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
                <span className="font-bold text-blue-600">{totalHours} ساعة</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          🔲 Modals
          ═══════════════════════════════════════════════════════════════════════════════ */}
      
      {/* Modal قبول */}
      {showAcceptModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">✅ قبول الطلب</h2>
            <p className="text-slate-600 mb-6">هل أنت متأكد من قبول هذا الطلب والعمل عليه؟</p>
            <div className="flex gap-3">
              <button onClick={() => setShowAcceptModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">إلغاء</button>
              <button onClick={handleAccept} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">قبول</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal رفض */}
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

      {/* Modal تحويل لموظف */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">🔀 طلب تحويل</h2>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">اختر المحامي</option>
              {employees.filter(e => e.id !== currentUser?.id && e.lawyer_license_number).map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
            <textarea
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="سبب التحويل... (مطلوب)"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            <p className="text-sm text-amber-600 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              سيتم إرسال الطلب للمدير للموافقة
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowTransferModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">إلغاء</button>
              <button onClick={handleTransferRequest} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">إرسال الطلب</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal تحويل لنفسي (للمدير) */}
      {showTransferToSelfModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">👨‍💼 تحويل الطلب لنفسك</h2>
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg mb-4">
              <p className="text-purple-700">
                <strong>ملاحظة:</strong> بعد التحويل ستصبح أنت صاحب الطلب وستتمكن من:
              </p>
              <ul className="mt-2 text-purple-600 text-sm list-disc list-inside">
                <li>الرد على المشترك</li>
                <li>إغلاق الطلب</li>
                <li>جميع صلاحيات المحامي الأساسي</li>
              </ul>
            </div>
            <p className="text-slate-600 mb-4">
              المحامي الحالي: <strong>{request.assigned_employee?.full_name || 'غير معين'}</strong>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowTransferToSelfModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">إلغاء</button>
              <button onClick={handleTransferToSelf} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">تحويل لي</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal مشارك */}
      {showCollaboratorModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">👥 إضافة مشارك</h2>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">اختر المحامي</option>
              {employees
                .filter(e => e.id !== currentUser?.id && !collaborators.find(c => c.lawyer_id === e.id))
                .map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
            </select>
            <textarea
              value={collaboratorReason}
              onChange={(e) => setCollaboratorReason(e.target.value)}
              placeholder="سبب طلب المشاركة (اختياري)..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
            {!isManager && (
              <p className="text-sm text-amber-600 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                سيتم إرسال الطلب للمدير للموافقة
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowCollaboratorModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">إلغاء</button>
              <button onClick={handleCollaboratorRequest} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {isManager ? 'إضافة مباشرة' : 'إرسال الطلب'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal تسجيل الوقت */}
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="مثال: 1.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">نوع العمل</label>
                <select
                  value={timeLogForm.work_type}
                  onChange={(e) => setTimeLogForm({...timeLogForm, work_type: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="ماذا عملت..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowTimeLogModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">إلغاء</button>
              <button onClick={handleTimeLog} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
