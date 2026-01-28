'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 تفاصيل الطلب - المشترك (مع الرد النهائي والملفات)
// 📅 تاريخ التحديث: 14 يناير 2026
// 🎯 التحديثات: عرض الرد النهائي + الملفات + الاعتراض + تأكيد الاطلاع
// 📁 المسار: src/app/subscriber/requests/[id]/page.tsx
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUserId } from '@/lib/cookies'
import toast from 'react-hot-toast'
import {
  ArrowRight, Clock, User, FileText, Calendar,
  Bot, AlertCircle, CheckCircle, XCircle,
  Timer, Star, ChevronDown, ChevronUp,
  History, DollarSign, CreditCard, Award, Eye, X, Download
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════════════════════

interface ServiceQuote {
  id: string
  quote_number: string
  lawyer_id: string
  service_description: string
  price: number
  platform_fee_amount: number
  vat_amount: number
  total_amount: number
  lawyer_earnings: number
  installments_count: number
  status: 'pending' | 'accepted' | 'rejected'
  valid_until: string
  created_at: string
  quote_type: 'single' | 'multiple'
  accepted_at?: string
  rejected_at?: string
  lawyer?: {
    id: string
    lawyer_code: string
    full_name: string
    rating_average: number
    rating_count: number
    years_of_experience: number
    city: string
  }
}

interface QuoteInstallment {
  id: string
  quote_id: string
  installment_number: number
  description: string
  percentage: number
  amount: number
  status: 'pending' | 'not_due' | 'paid' | 'released'
  paid_at: string | null
  created_at: string
}

interface LawyerResponse {
  id: string
  request_id: string
  lawyer_id: string
  response_content: string
  recommendations: string | null
  attachments: any
  status: string
  sent_at: string | null
  created_at: string
}

interface RequestFile {
  id: string
  request_id: string
  uploaded_by: string
  uploaded_by_type: string
  uploaded_by_name: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  mime_type: string
  category: string
  description: string | null
  is_shared_with_client: boolean
  created_at: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// التكوينات
// ═══════════════════════════════════════════════════════════════════════════════

// مكون صف التقييم بالنجوم
const RatingRow = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-slate-700">{label}</span>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="p-1 hover:scale-110 transition-transform"
        >
          <Star 
            className={`w-6 h-6 ${star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`} 
          />
        </button>
      ))}
    </div>
  </div>
)

const statusConfig: Record<string, { label: string; color: string; icon: any; description: string }> = {
  pending: { 
    label: 'بانتظار التعيين', 
    color: 'bg-gray-100 text-gray-700', 
    icon: Clock,
    description: 'طلبك قيد المراجعة وسيتم تعيين محامي قريباً'
  },
  pending_quotes: { 
    label: 'بانتظار عروض الأسعار', 
    color: 'bg-blue-100 text-blue-700', 
    icon: DollarSign,
    description: 'طلبك متاح للمحامين لتقديم عروضهم'
  },
  pending_assignment: { 
    label: 'بانتظار التعيين', 
    color: 'bg-orange-100 text-orange-700', 
    icon: Clock,
    description: 'طلبك قيد المراجعة'
  },
  assigned: { 
    label: 'تم التعيين', 
    color: 'bg-blue-100 text-blue-700', 
    icon: User,
    description: 'تم تعيين محامي لطلبك وبانتظار قبوله'
  },
  accepted: { 
    label: 'قيد العمل', 
    color: 'bg-green-100 text-green-700', 
    icon: CheckCircle,
    description: 'المحامي قبل طلبك ويعمل عليه'
  },
  in_progress: { 
    label: 'قيد التنفيذ', 
    color: 'bg-indigo-100 text-indigo-700', 
    icon: Timer,
    description: 'المحامي يعمل على طلبك حالياً'
  },
  completed: { 
    label: 'مكتمل', 
    color: 'bg-emerald-100 text-emerald-700', 
    icon: CheckCircle,
    description: 'تم إكمال طلبك بنجاح'
  },
  closed: { 
    label: 'مغلق', 
    color: 'bg-slate-100 text-slate-700', 
    icon: XCircle,
    description: 'تم إغلاق الطلب'
  },
  cancelled: { 
    label: 'ملغي', 
    color: 'bg-red-100 text-red-700', 
    icon: XCircle,
    description: 'تم إلغاء الطلب'
  },
  pending_poa: { 
    label: 'بانتظار الوكالة', 
    color: 'bg-amber-100 text-amber-700', 
    icon: FileText, 
    description: 'المحامي يطلب منك إصدار وكالة' 
  },
  poa_submitted: { 
    label: 'الوكالة مرفوعة', 
    color: 'bg-blue-100 text-blue-700', 
    icon: Clock, 
    description: 'بانتظار مراجعة المحامي' 
  },
  poa_approved: { 
    label: 'الوكالة مقبولة', 
    color: 'bg-green-100 text-green-700', 
    icon: CheckCircle, 
    description: 'تم قبول الوكالة' 
  },
}

const typeConfig: Record<string, { label: string; color: string; icon: string }> = {
  consultation: { label: 'استشارة قانونية', color: 'bg-blue-500', icon: '💬' },
  case: { label: 'قضية', color: 'bg-purple-500', icon: '⚖️' },
  extra_service: { label: 'خدمة إضافية', color: 'bg-orange-500', icon: '✨' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  normal: { label: 'عادي', color: 'bg-slate-100 text-slate-600' },
  urgent: { label: 'عاجل', color: 'bg-orange-100 text-orange-600' },
  emergency: { label: 'طارئ', color: 'bg-red-100 text-red-600' },
}

// ═══════════════════════════════════════════════════════════════════════════════
// المكون الرئيسي
// ═══════════════════════════════════════════════════════════════════════════════

export default function SubscriberRequestDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = params.id as string

  // States
  const [isLoading, setIsLoading] = useState(true)
  const [request, setRequest] = useState<any>(null)
  const [lawyer, setLawyer] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<{ id: string; memberId: string; name: string } | null>(null)

  // العروض والدفعات
  const [quotes, setQuotes] = useState<ServiceQuote[]>([])
  const [installments, setInstallments] = useState<{[quoteId: string]: QuoteInstallment[]}>({})
  const [acceptingQuote, setAcceptingQuote] = useState<string | null>(null)
  
  // Modal تفاصيل العرض
  const [selectedQuote, setSelectedQuote] = useState<ServiceQuote | null>(null)
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [poaFile, setPoaFile] = useState<File | null>(null)
  const [poaNumber, setPoaNumber] = useState('')
  const [poaDate, setPoaDate] = useState('')
  const [uploadingPoa, setUploadingPoa] = useState(false)
  // محادثة NOLEX
  const [nolexConversation, setNolexConversation] = useState<any[]>([])
  const [showNolexArchive, setShowNolexArchive] = useState(false)

  // سجل الطلب
  const [requestHistory, setRequestHistory] = useState<any[]>([])

  // 🆕 الرد النهائي والملفات
  const [lawyerResponse, setLawyerResponse] = useState<LawyerResponse | null>(null)
  const [requestFiles, setRequestFiles] = useState<RequestFile[]>([])
  const [showObjectionModal, setShowObjectionModal] = useState(false)
  const [objectionContent, setObjectionContent] = useState('')
  const [submittingObjection, setSubmittingObjection] = useState(false)
  const [hasAcknowledged, setHasAcknowledged] = useState(false)
  const [currentObjection, setCurrentObjection] = useState<any>(null)

  // 🆕 التقييم
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [submittingRating, setSubmittingRating] = useState(false)
  const [ratingForm, setRatingForm] = useState({
    // تقييم المحامي
    lawyer_acceptance_speed: 5,
    lawyer_responsiveness: 5,
    lawyer_understanding: 5,
    lawyer_price_value: 5,
    lawyer_updates: 5,
    lawyer_comment: '',
    // تقييم الخدمة
    service_quality: 5,
    service_satisfaction: 5,
    service_library_experience: 5,
    service_nolex_response: 5,
    service_comment: '',
    // تقييم التطبيق
    app_ease_of_use: 5,
    app_services_clarity: 5,
    app_overall_experience: 5,
    app_navigation_difficulty: false,
    app_comment: ''
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // تحميل البيانات
  // ═══════════════════════════════════════════════════════════════════════════════

  useEffect(() => { loadData() }, [requestId])

  const loadData = async () => {
    try {
      const userId = getUserId()
      if (!userId) { router.push('/auth/login'); return }

      // جلب معلومات المشترك
      const { data: memberData } = await supabase
        .from('members')
        .select('id, user_id')
        .eq('user_id', userId)
        .single()

      if (!memberData) { router.push('/auth/login'); return }

      const { data: userData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single()

      setCurrentUser({
        id: userId,
        memberId: memberData.id,
        name: userData?.full_name || 'مشترك'
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

      // التحقق من الصلاحية
      if (requestData.member_id !== memberData.id) {
        toast.error('ليس لديك صلاحية لعرض هذا الطلب')
        router.push('/subscriber/requests')
        return
      }

      setRequest(requestData)

      // جلب محادثة NOLEX
      if (requestData.nolex_conversation) {
        setNolexConversation(requestData.nolex_conversation)
      }

      // جلب معلومات المحامي المعين
      if (requestData.assigned_lawyer_id) {
        const { data: lawyerData } = await supabase
          .from('lawyers')
          .select('id, full_name, lawyer_code, rating_average, rating_count, years_of_experience, city')
          .eq('id', requestData.assigned_lawyer_id)
          .single()
        setLawyer(lawyerData)
      }

      // ═══════════════════════════════════════════════════════════════════════════════
      // جلب عروض الأسعار من المحامين
      // ═══════════════════════════════════════════════════════════════════════════════
      const { data: quotesData, error: quotesError } = await supabase
        .from('service_quotes')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })

      if (quotesData && quotesData.length > 0) {
        const lawyerIds = Array.from(new Set(quotesData.map(q => q.lawyer_id).filter(Boolean)))
        
        let quotesWithLawyers = quotesData
        
        if (lawyerIds.length > 0) {
          const { data: lawyersData } = await supabase
            .from('lawyers')
            .select('id, lawyer_code, full_name, rating_average, rating_count, years_of_experience, city')
            .in('id', lawyerIds)
          
          quotesWithLawyers = quotesData.map(quote => ({
            ...quote,
            lawyer: lawyersData?.find(l => l.id === quote.lawyer_id) || null
          }))
        }
        
        setQuotes(quotesWithLawyers)

        // جلب الدفعات لكل عرض
        const quoteIds = quotesData.map(q => q.id)
        
        const { data: installmentsData } = await supabase
          .from('quote_installments')
          .select('*')
          .in('quote_id', quoteIds)
          .order('installment_number', { ascending: true })
        
        if (installmentsData) {
          const groupedInstallments: {[quoteId: string]: QuoteInstallment[]} = {}
          installmentsData.forEach(inst => {
            if (!groupedInstallments[inst.quote_id]) {
              groupedInstallments[inst.quote_id] = []
            }
            groupedInstallments[inst.quote_id].push(inst)
          })
          setInstallments(groupedInstallments)
        }
      }

      // جلب سجل الطلب
      const { data: historyData } = await supabase
        .from('request_history')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })
      setRequestHistory(historyData || [])

      // ═══════════════════════════════════════════════════════════════════════════════
      // 🆕 جلب الرد النهائي من المحامي (للطلبات المكتملة)
      // ═══════════════════════════════════════════════════════════════════════════════
      if (requestData.status === 'completed' || requestData.status === 'closed' || requestData.status === 'objection_raised' || requestData.status === 'objection_responded') {
        const { data: responseData } = await supabase
          .from('lawyer_responses')
          .select('*')
          .eq('request_id', requestId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (responseData) {
          setLawyerResponse(responseData)
        }

        // جلب الملفات المرفقة
        const { data: filesData } = await supabase
          .from('request_files')
          .select('*')
          .eq('request_id', requestId)
          .eq('is_shared_with_client', true)
          .order('created_at', { ascending: false })
        
        if (filesData) {
          setRequestFiles(filesData)
        }

        // التحقق من حالة الاطلاع
        const { data: objectionData } = await supabase
          .from('request_objections')
          .select('*')
          .eq('request_id', requestId)
          .eq('member_id', memberData.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (objectionData) {
          setCurrentObjection(objectionData)
          if (objectionData.status === 'acknowledged') {
            setHasAcknowledged(true)
          }
        }
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // قبول عرض السعر - باستخدام Transaction
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleAcceptQuote = async (quote: ServiceQuote) => {
    const quoteInstallments = installments[quote.id] || []
    const firstPayment = quoteInstallments.length > 0 ? quoteInstallments[0].amount : quote.total_amount
    
    const confirmMsg = quoteInstallments.length > 1 
      ? `هل أنت متأكد من قبول العرض؟\n\nالإجمالي: ${quote.total_amount.toLocaleString()} ر.س\nالدفعة الأولى: ${firstPayment.toLocaleString()} ر.س`
      : `هل أنت متأكد من قبول العرض بقيمة ${quote.total_amount.toLocaleString()} ر.س؟`
    
    if (!confirm(confirmMsg)) return

    setAcceptingQuote(quote.id)

    try {
      const { data, error } = await supabase.rpc('accept_quote', {
        p_quote_id: quote.id,
        p_request_id: requestId,
        p_lawyer_id: quote.lawyer_id,
        p_price: quote.price,
        p_total_amount: quote.total_amount,
        p_vat_amount: quote.vat_amount
      })

      if (error) throw error

      try {
        await supabase.from('notifications').insert({
          recipient_type: 'lawyer',
          recipient_id: quote.lawyer_id,
          title: 'تم قبول عرضك! 🎉',
          body: `تم قبول عرضك رقم ${quote.quote_number} بقيمة ${quote.total_amount.toLocaleString()} ر.س`,
          icon: '✅',
          notification_type: 'quote_accepted',
          request_id: requestId,
          quote_id: quote.id,
          action_url: `/independent/my-tasks/${requestId}`,
          is_read: false
        })
      } catch {
        // Non-critical: notification creation failed
      }

      toast.success('✅ تم قبول العرض بنجاح!')
      setShowQuoteModal(false)
      loadData()

    } catch (error: any) {
      console.error('Error accepting quote:', error)
      toast.error(error.message || 'حدث خطأ في قبول العرض')
    } finally {
      setAcceptingQuote(null)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🆕 تأكيد الاطلاع على الرد - يفتح نموذج التقييم
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleAcknowledge = async () => {
    // فتح نموذج التقييم بدلاً من الإغلاق المباشر
    setShowRatingModal(true)
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🆕 إرسال التقييم وإغلاق الطلب
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleSubmitRating = async () => {
    setSubmittingRating(true)
    try {
      // حساب التقييم العام للمحامي
      const lawyerRatings = [
        ratingForm.lawyer_acceptance_speed,
        ratingForm.lawyer_responsiveness,
        ratingForm.lawyer_understanding,
        ratingForm.lawyer_price_value,
        ratingForm.lawyer_updates
      ].filter(r => r > 0)
      
      const lawyerOverall = lawyerRatings.length > 0 
        ? lawyerRatings.reduce((a, b) => a + b, 0) / lawyerRatings.length 
        : 0

      // حفظ التقييم
      await supabase.from('request_reviews').insert({
        request_id: requestId,
        member_id: currentUser?.memberId,
        lawyer_id: lawyer?.id,
        // تقييم المحامي
        lawyer_acceptance_speed: ratingForm.lawyer_acceptance_speed || null,
        lawyer_responsiveness: ratingForm.lawyer_responsiveness || null,
        lawyer_understanding: ratingForm.lawyer_understanding || null,
        lawyer_price_value: ratingForm.lawyer_price_value || null,
        lawyer_updates: ratingForm.lawyer_updates || null,
        lawyer_comment: ratingForm.lawyer_comment || null,
        // تقييم التطبيق
        app_navigation_difficulty: ratingForm.app_navigation_difficulty,
        app_services_clarity: ratingForm.app_services_clarity || null,
        app_ease_of_use: ratingForm.app_ease_of_use || null,
        app_overall_experience: ratingForm.app_overall_experience || null,
        app_comment: ratingForm.app_comment || null,
        // تقييم الخدمة
        service_quality: ratingForm.service_quality || null,
        service_satisfaction: ratingForm.service_satisfaction || null,
        service_library_experience: ratingForm.service_library_experience || null,
        service_nolex_response: ratingForm.service_nolex_response || null,
        service_comment: ratingForm.service_comment || null,
        is_completed: true
      })

      // تسجيل الاطلاع
      await supabase.from('request_objections').insert({
        request_id: requestId,
        member_id: currentUser?.memberId,
        response_id: lawyerResponse?.id,
        content: 'تم الاطلاع والموافقة على الرد',
        status: 'acknowledged'
      })

      // إغلاق الطلب
      await supabase
        .from('service_requests')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', requestId)

      // تحديث تقييم المحامي
      if (lawyer?.id && lawyerOverall > 0) {
        const { data: currentLawyer } = await supabase
          .from('lawyers')
          .select('rating_average, rating_count')
          .eq('id', lawyer.id)
          .single()

        if (currentLawyer) {
          const newCount = (currentLawyer.rating_count || 0) + 1
          const newAverage = ((currentLawyer.rating_average || 0) * (currentLawyer.rating_count || 0) + lawyerOverall) / newCount
          
          await supabase
            .from('lawyers')
            .update({ rating_average: newAverage, rating_count: newCount })
            .eq('id', lawyer.id)
        }
      }

      toast.success('✅ شكراً لتقييمك!')
      setShowRatingModal(false)
      setHasAcknowledged(true)
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في حفظ التقييم')
    } finally {
      setSubmittingRating(false)
    }
  }

  // تخطي التقييم
  const handleSkipRating = async () => {
    try {
      await supabase.from('request_objections').insert({
        request_id: requestId,
        member_id: currentUser?.memberId,
        response_id: lawyerResponse?.id,
        content: 'تم الاطلاع والموافقة على الرد',
        status: 'acknowledged'
      })

      await supabase
        .from('service_requests')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', requestId)

      toast.success('✅ تم تأكيد الاطلاع')
      setShowRatingModal(false)
      setHasAcknowledged(true)
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🆕 إرسال اعتراض
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleSubmitObjection = async () => {
    if (!objectionContent.trim()) {
      toast.error('يرجى كتابة سبب الاعتراض')
      return
    }

    setSubmittingObjection(true)
    try {
      await supabase.from('request_objections').insert({
        request_id: requestId,
        member_id: currentUser?.memberId,
        response_id: lawyerResponse?.id,
        content: objectionContent,
        status: 'pending'
      })

      await supabase.from('notifications').insert({
        recipient_type: 'lawyer',
        recipient_id: lawyer?.id,
        title: '⚠️ اعتراض من المشترك',
        body: `المشترك اعترض على الرد النهائي للطلب ${request?.ticket_number}`,
        icon: '⚠️',
        notification_type: 'objection',
        request_id: requestId,
        action_url: `/independent/my-tasks/${requestId}`,
        is_read: false
      })

      toast.success('✅ تم إرسال الاعتراض')
      setShowObjectionModal(false)
      setObjectionContent('')
      setHasAcknowledged(true)
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في إرسال الاعتراض')
    } finally {
      setSubmittingObjection(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // الدوال المساعدة
  // ═══════════════════════════════════════════════════════════════════════════════

  const formatDate = (date: string) => date ? new Date(date).toLocaleDateString('ar-SA') : '-'
  const formatDateTime = (date: string) => date ? new Date(date).toLocaleString('ar-SA') : '-'
  // رفع الوكالة
  const handleUploadPoa = async () => {
    if (!poaFile || !poaNumber || !poaDate) {
      toast.error('يرجى ملء جميع الحقول ورفع ملف الوكالة')
      return
    }

    try {
      setUploadingPoa(true)

      // رفع الملف
      const fileName = `${requestId}/${Date.now()}_${poaFile.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-documents')
        .upload(fileName, poaFile)

      if (uploadError) throw uploadError

      // الحصول على الرابط العام
      const { data: urlData } = supabase.storage
        .from('user-documents')
        .getPublicUrl(fileName)

      // تحديث طلب الوكالة
      const { error: updateError } = await supabase
        .from('power_of_attorneys')
        .update({
          poa_number: poaNumber,
          poa_date: poaDate,
          poa_document: urlData.publicUrl,
          status: 'submitted',
          submitted_at: new Date().toISOString()
        })
        .eq('request_id', requestId)

      if (updateError) throw updateError

      // تحديث حالة الطلب
      await supabase
        .from('service_requests')
        .update({ status: 'poa_submitted' })
        .eq('id', requestId)

      // إرسال إشعار للمحامي
      await supabase.from('notifications').insert({
        recipient_type: 'lawyer',
        recipient_id: request.assigned_lawyer_id,
        title: '📄 تم رفع الوكالة',
        body: `المشترك رفع الوكالة للطلب ${request.ticket_number}`,
        notification_type: 'poa_submitted',
        request_id: requestId,
        is_read: false
      })

      toast.success('✅ تم رفع الوكالة بنجاح')
      setRequest((prev: any) => ({ ...prev, status: 'poa_submitted' }))
      setPoaFile(null)
      setPoaNumber('')
      setPoaDate('')

    } catch (err: any) {
      console.error('Error:', err)
      toast.error('حدث خطأ: ' + err.message)
    } finally {
      setUploadingPoa(false)
    }
  }
  const formatPrice = (amount: number) => amount ? `${amount.toLocaleString()} ر.س` : '-'

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const isQuoteValid = (validUntil: string) => new Date(validUntil) > new Date()

  const getTimeRemaining = (validUntil: string) => {
    const diff = new Date(validUntil).getTime() - Date.now()
    if (diff <= 0) return { text: 'منتهي', color: 'text-red-600', bg: 'bg-red-100' }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (days > 0) return { text: `${days} يوم ${hours} ساعة`, color: 'text-green-600', bg: 'bg-green-100' }
    if (hours > 4) return { text: `${hours} ساعة`, color: 'text-yellow-600', bg: 'bg-yellow-100' }
    return { text: `${hours} ساعة`, color: 'text-red-600', bg: 'bg-red-100' }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // العرض
  // ═══════════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 mx-auto text-red-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">الطلب غير موجود</h2>
        <button onClick={() => router.push('/subscriber/requests')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          العودة للطلبات
        </button>
      </div>
    )
  }

  const StatusIcon = statusConfig[request.status]?.icon || Clock
  const pendingQuotes = quotes.filter(q => q.status === 'pending')
  const acceptedQuote = quotes.find(q => q.status === 'accepted')

  return (
    <div className="space-y-4 pb-8">
      
      {/* ════════════════════════════════════════════════════════════════════
          Header
      ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-start gap-4">
          <button onClick={() => router.push('/subscriber/requests')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors mt-1">
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <span className="text-2xl">{typeConfig[request.request_type]?.icon || '📋'}</span>
              <h1 className="text-xl font-bold text-slate-800">
                {request.ticket_number || `طلب #${requestId.slice(0, 8)}`}
              </h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5 ${statusConfig[request.status]?.color}`}>
                <StatusIcon className="w-4 h-4" />
                {statusConfig[request.status]?.label}
              </span>
              {pendingQuotes.length > 0 && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700 flex items-center gap-1.5">
                  💰 {pendingQuotes.length} عرض متاح
                </span>
              )}
            </div>
            
            <p className="text-slate-600 mb-3">{request.title || 'بدون عنوان'}</p>
            
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <span className={`px-2 py-1 rounded text-xs text-white ${typeConfig[request.request_type]?.color}`}>
                {typeConfig[request.request_type]?.label}
              </span>
              <span className={`px-2 py-1 rounded text-xs ${priorityConfig[request.priority]?.color}`}>
                {priorityConfig[request.priority]?.label}
              </span>
              <span className="text-slate-500 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(request.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* ════════════════════════════════════════════════════════════════════
            المحتوى الرئيسي
        ════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* ════════════════════════════════════════════════════════════════════
              🆕 الرد النهائي من المحامي (للطلبات المكتملة)
          ════════════════════════════════════════════════════════════════════ */}
{/* ════════════════════════════════════════════════════════════════════
              🆕 تنبيه طلب الوكالة
          ════════════════════════════════════════════════════════════════════ */}
          {/* ════════════════════════════════════════════════════════════════════
              🆕 نموذج رفع الوكالة
          ════════════════════════════════════════════════════════════════════ */}
          {request.status === 'pending_poa' && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-sm overflow-hidden border-2 border-amber-300">
              <div className="bg-gradient-to-l from-amber-500 to-orange-500 text-white p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                    📄
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">مطلوب إصدار وكالة</h3>
                    <p className="text-sm opacity-90">المحامي يطلب منك إصدار وكالة شرعية</p>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <p className="text-amber-800">
                  يرجى إصدار وكالة شرعية من ناجز ثم رفعها هنا مع رقمها وتاريخها.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">رقم الوكالة *</label>
                    <input
                      type="text"
                      value={poaNumber}
                      onChange={(e) => setPoaNumber(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="مثال: 123456789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">تاريخ الوكالة *</label>
                    <input
                      type="date"
                      value={poaDate}
                      onChange={(e) => setPoaDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ملف الوكالة *</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-amber-500 transition cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setPoaFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="poa-file-input"
                    />
                    <label htmlFor="poa-file-input" className="cursor-pointer">
                      {poaFile ? (
                        <div className="text-green-600">
                          <span className="text-2xl">✅</span>
                          <p className="font-medium mt-2">{poaFile.name}</p>
                        </div>
                      ) : (
                        <div className="text-gray-500">
                          <span className="text-3xl">📁</span>
                          <p className="mt-2">اضغط لاختيار ملف الوكالة</p>
                          <p className="text-xs">PDF, JPG, PNG</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleUploadPoa}
                  disabled={uploadingPoa || !poaFile || !poaNumber || !poaDate}
                  className="w-full py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploadingPoa ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      جاري الرفع...
                    </>
                  ) : (
                    <>
                      <span>📤</span> رفع الوكالة
                    </>
                  )}
                </button>
              </div>
            </div>
          )}         
          {(request.status === 'completed' || request.status === 'closed' || request.status === 'objection_raised' || request.status === 'objection_responded') && (lawyerResponse || currentObjection) && (
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl shadow-sm overflow-hidden border-2 border-emerald-200">
              <div className="bg-gradient-to-l from-emerald-600 to-green-600 text-white p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                    ✅
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">الرد النهائي من المحامي</h3>
                    <p className="text-sm opacity-90">تم إكمال طلبك بنجاح</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* الرد النهائي */}
                <div>
                  <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    الرد النهائي
                  </h4>
                  <div className="bg-white rounded-xl p-4 border border-emerald-100">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {lawyerResponse.response_content}
                    </p>
                  </div>
                </div>

                {/* التوصيات */}
                {lawyerResponse.recommendations && (
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-500" />
                      التوصيات
                    </h4>
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {lawyerResponse.recommendations}
                      </p>
                    </div>
                  </div>
                )}

                {/* الملفات المرفقة */}
                {requestFiles.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <Download className="w-5 h-5 text-blue-500" />
                      المستندات المرفقة ({requestFiles.length})
                    </h4>
                    <div className="space-y-2">
                      {requestFiles.map((file) => (
                        <a
                          key={file.id}
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                        >
                          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <span className="text-red-600 font-bold text-xs">PDF</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-700">{file.file_name}</p>
                            <p className="text-xs text-slate-500">
                              {formatFileSize(file.file_size)} • {formatDate(file.created_at)}
                            </p>
                          </div>
                          <Eye className="w-5 h-5 text-blue-500" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
{/* ⚠️ قسم الاعتراض ورد المحامي */}
{currentObjection && (
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-5 border-2 border-orange-200 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⚠️</span>
                      <h4 className="font-bold text-orange-800">اعتراضك على الطلب</h4>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        currentObjection.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        currentObjection.status === 'responded' ? 'bg-blue-100 text-blue-800' :
                        currentObjection.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {currentObjection.status === 'pending' ? 'بانتظار رد المحامي' :
                         currentObjection.status === 'responded' ? 'تم الرد' :
                         currentObjection.status === 'resolved' ? 'تم الحل' : currentObjection.status}
                      </span>
                    </div>

                    {/* سبب الاعتراض */}
                    <div className="bg-white rounded-lg p-4 border border-orange-100">
                      <p className="text-sm text-gray-500 mb-1">سبب اعتراضك:</p>
                      <p className="text-gray-800">{currentObjection.content}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(currentObjection.created_at).toLocaleDateString('ar-SA')}
                      </p>
                    </div>

                    {/* رد المحامي */}
                    {currentObjection.lawyer_response && (
                      <div className="bg-blue-50 rounded-lg p-4 border-r-4 border-blue-500">
                        <p className="text-sm text-blue-600 mb-1 font-bold">💬 رد المحامي:</p>
                        <p className="text-gray-800">{currentObjection.lawyer_response}</p>
                        {currentObjection.lawyer_responded_at && (
                          <p className="text-xs text-blue-400 mt-2">
                            {new Date(currentObjection.lawyer_responded_at).toLocaleDateString('ar-SA')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* أزرار للمشترك */}
                    {currentObjection.status === 'responded' && (
                      <div className="flex gap-3">
                        <button
                          onClick={async () => {
                            await supabase.from('request_objections').update({ status: 'resolved' }).eq('id', currentObjection.id)
                            await supabase.from('service_requests').update({ status: 'completed' }).eq('id', requestId)
                            toast.success('✅ تم قبول الرد وإغلاق الاعتراض')
                            loadData()
                          }}
                          className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600"
                        >
                          ✅ قبول الرد
                        </button>
                        <button
                          onClick={async () => {
                            await supabase.from('request_objections').update({ status: 'escalated', escalated_at: new Date().toISOString() }).eq('id', currentObjection.id)
                            toast.success('📤 تم تصعيد الاعتراض للإدارة')
                            loadData()
                          }}
                          className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600"
                        >
                          📤 تصعيد للإدارة
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {/* أزرار الإجراءات */}
                {!hasAcknowledged && request.status === 'completed' && (
                  <div className="flex gap-3 pt-4 border-t border-emerald-200">
                    <button
                      onClick={handleAcknowledge}
                      className="flex-1 py-3 bg-gradient-to-l from-emerald-600 to-green-600 text-white rounded-xl font-bold hover:from-emerald-700 hover:to-green-700 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" />
                      تم الاطلاع والموافقة
                    </button>
                    <button
                      onClick={() => setShowObjectionModal(true)}
                      className="flex-1 py-3 bg-gradient-to-l from-red-500 to-orange-500 text-white rounded-xl font-bold hover:from-red-600 hover:to-orange-600 transition-all flex items-center justify-center gap-2"
                    >
                      <AlertCircle className="w-5 h-5" />
                      اعتراض
                    </button>
                  </div>
                )}

                {(hasAcknowledged || request.status === 'closed') && (
                  <div className="bg-emerald-100 rounded-lg p-3 text-center">
                    <p className="text-emerald-700 font-medium">✅ تم تسجيل ردك على هذا الطلب</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* جدول العروض */}
          {pendingQuotes.length > 0 && !acceptedQuote && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-l from-amber-500 to-orange-500 text-white p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                    💰
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">عروض الأسعار المتاحة</h3>
                    <p className="text-sm opacity-90">{pendingQuotes.length} عرض من المحامين - اختر الأنسب لك</p>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="py-3 px-4 text-right text-xs font-bold text-slate-600">رقم العرض</th>
                      <th className="py-3 px-4 text-right text-xs font-bold text-slate-600">التاريخ</th>
                      <th className="py-3 px-4 text-right text-xs font-bold text-slate-600">المحامي</th>
                      <th className="py-3 px-4 text-center text-xs font-bold text-slate-600">التقييم</th>
                      <th className="py-3 px-4 text-center text-xs font-bold text-slate-600">الدفعات</th>
                      <th className="py-3 px-4 text-left text-xs font-bold text-slate-600">الإجمالي</th>
                      <th className="py-3 px-4 text-center text-xs font-bold text-slate-600">الصلاحية</th>
                      <th className="py-3 px-4 text-center text-xs font-bold text-slate-600">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingQuotes.map((quote, idx) => {
                      const timeRemaining = getTimeRemaining(quote.valid_until)
                      const isValid = isQuoteValid(quote.valid_until)
                      const quoteInstallments = installments[quote.id] || []
                      
                      return (
                        <tr key={quote.id} className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} ${!isValid ? 'opacity-50' : ''}`}>
                          <td className="py-3 px-4">
                            <span className="font-mono text-sm text-slate-700">{quote.quote_number}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-slate-600">{formatDate(quote.created_at)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                {quote.lawyer?.full_name?.[0] || '؟'}
                              </div>
                              <div>
                                <p className="font-bold text-blue-600 text-sm">{quote.lawyer?.lawyer_code || '-'}</p>
                                <p className="text-xs text-slate-400">{quote.lawyer?.city || '-'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {quote.lawyer?.rating_average ? (
                              <div className="flex items-center justify-center gap-1">
                                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                <span className="text-sm font-medium">{quote.lawyer.rating_average.toFixed(1)}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                              quoteInstallments.length > 1 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {quoteInstallments.length > 1 ? `${quoteInstallments.length} دفعات` : 'دفعة واحدة'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-left">
                            <span className="font-bold text-green-600">{formatPrice(quote.total_amount)}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${timeRemaining.bg} ${timeRemaining.color}`}>
                              {timeRemaining.text}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => { setSelectedQuote(quote); setShowQuoteModal(true); }}
                                className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                                title="عرض التفاصيل"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {isValid && (
                                <button
                                  onClick={() => handleAcceptQuote(quote)}
                                  disabled={acceptingQuote === quote.id}
                                  className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                                  title="قبول العرض"
                                >
                                  {acceptingQuote === quote.id ? (
                                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                  ) : (
                                    <CheckCircle className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* العرض المقبول */}
          {acceptedQuote && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-sm p-6 border-2 border-green-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white text-xl">
                  ✅
                </div>
                <div>
                  <h3 className="font-bold text-green-800 text-lg">تم قبول العرض</h3>
                  <p className="text-sm text-green-600">العرض رقم {acceptedQuote.quote_number}</p>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      {acceptedQuote.lawyer?.full_name?.[0] || '؟'}
                    </div>
                    <div>
                      <p className="font-bold text-blue-600">{acceptedQuote.lawyer?.lawyer_code}</p>
                      <p className="text-xs text-slate-500">{acceptedQuote.lawyer?.city}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold text-green-600">{formatPrice(acceptedQuote.total_amount)}</p>
                    <p className="text-xs text-slate-500">شامل الضريبة</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* معلومات الطلب */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              تفاصيل الطلب
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">نوع الطلب</p>
                <p className="font-medium text-slate-800">{typeConfig[request.request_type]?.label}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">التصنيف</p>
                <p className="font-medium text-slate-800">{request.category?.name_ar || '-'}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">تاريخ الطلب</p>
                <p className="font-medium text-slate-800">{formatDateTime(request.created_at)}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">آخر تحديث</p>
                <p className="font-medium text-slate-800">{formatDateTime(request.updated_at)}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-xs text-slate-500 mb-2">وصف الطلب</p>
              <p className="text-slate-700 whitespace-pre-wrap">{request.description || 'لا يوجد وصف'}</p>
            </div>
          </div>

          {/* أرشيف محادثة NOLEX */}
          {nolexConversation && nolexConversation.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => setShowNolexArchive(!showNolexArchive)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <h3 className="font-bold text-slate-800">أرشيف محادثة NOLEX</h3>
                    <p className="text-sm text-slate-500">{nolexConversation.length} رسالة</p>
                  </div>
                </div>
                {showNolexArchive ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
              
              {showNolexArchive && (
                <div className="border-t p-4 bg-gradient-to-b from-blue-50 to-white max-h-[400px] overflow-y-auto">
                  <div className="space-y-3">
                    {nolexConversation.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-white border shadow-sm rounded-tl-sm'
                        }`}>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* سجل الطلب */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-purple-500" />
              سجل الطلب
            </h3>
            
            <div className="relative">
              <div className="absolute right-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
              
              <div className="space-y-4">
                <div className="flex gap-4 relative">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white z-10">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium text-slate-800">تم إنشاء الطلب</p>
                    <p className="text-sm text-slate-500">{formatDateTime(request.created_at)}</p>
                  </div>
                </div>

                {quotes.length > 0 && (
                  <div className="flex gap-4 relative">
                    <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white z-10">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-slate-800">تم استلام {quotes.length} عرض سعر</p>
                      <p className="text-sm text-slate-500">{formatDateTime(quotes[quotes.length - 1]?.created_at)}</p>
                    </div>
                  </div>
                )}

                {acceptedQuote && (
                  <div className="flex gap-4 relative">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white z-10">
                      <Award className="w-4 h-4" />
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-slate-800">تم قبول العرض {acceptedQuote.quote_number}</p>
                      <p className="text-sm text-slate-500">{formatDateTime(acceptedQuote.accepted_at || '')}</p>
                    </div>
                  </div>
                )}

                {lawyer && (
                  <div className="flex gap-4 relative">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white z-10">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-slate-800">
                        تم إسناد طلبك للمحامي <span className="text-blue-600 font-bold">{lawyer.lawyer_code}</span>
                      </p>
                      <p className="text-sm text-slate-500">{formatDateTime(request.assigned_at)}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-4 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white z-10 ${
                    request.status === 'completed' ? 'bg-emerald-500' : 
                    request.status === 'cancelled' ? 'bg-red-500' : 'bg-orange-500'
                  }`}>
                    <StatusIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{statusConfig[request.status]?.label}</p>
                    <p className="text-sm text-slate-500">{statusConfig[request.status]?.description}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            الشريط الجانبي
        ════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          
          {/* معلومات المحامي */}
          {lawyer ? (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" />
                المحامي المعين
              </h3>
              <div className="text-center mb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
                  {lawyer.full_name?.[0] || '؟'}
                </div>
                <p className="text-lg font-bold text-blue-600">{lawyer.lawyer_code}</p>
                {lawyer.city && <p className="text-sm text-slate-500">{lawyer.city}</p>}
              </div>
              
              {lawyer.rating_average && (
                <div className="flex items-center justify-center gap-1 mb-4">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  <span className="font-bold text-slate-800">{lawyer.rating_average?.toFixed(1)}</span>
                  <span className="text-sm text-slate-500">({lawyer.rating_count || 0} تقييم)</span>
                </div>
              )}
              
              {lawyer.years_of_experience && (
                <div className="text-center text-sm text-slate-600">
                  <Timer className="w-4 h-4 inline ml-1" />
                  {lawyer.years_of_experience} سنة خبرة
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" />
                المحامي
              </h3>
              <div className="text-center py-6 text-slate-500">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User className="w-8 h-8 text-slate-300" />
                </div>
                {pendingQuotes.length > 0 ? (
                  <p className="text-sm">اختر من العروض المتاحة</p>
                ) : (
                  <p className="text-sm">لم يتم تعيين محامي بعد</p>
                )}
              </div>
            </div>
          )}

          {/* ملخص التكلفة */}
          {(acceptedQuote || request.total_amount) && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
              <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                ملخص التكلفة
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">السعر الأساسي</span>
                  <span className="font-medium">{formatPrice(acceptedQuote?.price || request.base_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">الضريبة (15%)</span>
                  <span className="font-medium">{formatPrice(acceptedQuote?.vat_amount || request.vat_amount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-green-200">
                  <span className="font-bold text-slate-800">الإجمالي</span>
                  <span className="font-bold text-green-600">{formatPrice(acceptedQuote?.total_amount || request.total_amount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* مساعدة */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
            <h3 className="font-bold text-blue-800 mb-2">💡 تحتاج مساعدة؟</h3>
            <p className="text-sm text-blue-600 mb-3">يمكنك التواصل مع فريق الدعم في أي وقت</p>
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              تواصل مع الدعم
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          Modal تفاصيل العرض
      ════════════════════════════════════════════════════════════════════ */}
      {showQuoteModal && selectedQuote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-l from-slate-800 to-slate-900 text-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg">
                    {selectedQuote.lawyer?.full_name?.[0] || '؟'}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{selectedQuote.lawyer?.lawyer_code || 'محامي'}</p>
                    {selectedQuote.lawyer?.rating_average && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span>{selectedQuote.lawyer.rating_average.toFixed(1)}</span>
                        <span className="text-slate-400">({selectedQuote.lawyer.rating_count || 0} تقييم)</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => setShowQuoteModal(false)}
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {selectedQuote.service_description && (
                <div className="mb-5">
                  <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    ما سيقوم به المحامي
                  </h4>
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedQuote.service_description}</p>
                  </div>
                </div>
              )}

              {installments[selectedQuote.id]?.length > 1 && (
                <div className="mb-5">
                  <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-purple-500" />
                    جدول الدفعات ({installments[selectedQuote.id].length} دفعات)
                  </h4>
                  <div className="bg-purple-50 rounded-xl overflow-hidden border border-purple-100">
                    <table className="w-full">
                      <thead className="bg-purple-100">
                        <tr>
                          <th className="py-2 px-4 text-right text-xs font-bold text-purple-800">الدفعة</th>
                          <th className="py-2 px-4 text-right text-xs font-bold text-purple-800">المرحلة</th>
                          <th className="py-2 px-4 text-center text-xs font-bold text-purple-800">النسبة</th>
                          <th className="py-2 px-4 text-left text-xs font-bold text-purple-800">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installments[selectedQuote.id].map((inst, idx) => (
                          <tr key={inst.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-purple-50/50'}>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-600 text-white text-sm font-bold">
                                {inst.installment_number}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-700">{inst.description}</td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-block px-2 py-1 bg-purple-200 text-purple-800 rounded-full text-xs font-bold">
                                {inst.percentage}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-left font-bold text-slate-800">
                              {inst.amount.toLocaleString()} ر.س
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-l from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">السعر الأساسي</p>
                    <p className="font-bold text-lg text-slate-800">{formatPrice(selectedQuote.price)}</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">الضريبة (15%)</p>
                    <p className="font-bold text-lg text-slate-700">{formatPrice(selectedQuote.vat_amount)}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-green-200">
                  <span className="text-slate-600 font-medium">الإجمالي شامل الضريبة</span>
                  <span className="text-3xl font-black text-green-600">{formatPrice(selectedQuote.total_amount)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex gap-3">
              <button
                onClick={() => setShowQuoteModal(false)}
                className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300 transition-colors"
              >
                إغلاق
              </button>
              {isQuoteValid(selectedQuote.valid_until) && (
                <button
                  onClick={() => handleAcceptQuote(selectedQuote)}
                  disabled={acceptingQuote === selectedQuote.id}
                  className="flex-1 py-3 bg-gradient-to-l from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {acceptingQuote === selectedQuote.id ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      قبول هذا العرض
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          🆕 Modal الاعتراض
      ════════════════════════════════════════════════════════════════════ */}
      {showObjectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-l from-red-500 to-orange-500 text-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-8 h-8" />
                  <h2 className="font-bold text-lg">تقديم اعتراض</h2>
                </div>
                <button
                  onClick={() => setShowObjectionModal(false)}
                  className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5">
              <p className="text-slate-600 mb-4">
                يرجى توضيح سبب اعتراضك على الرد النهائي. سيتم مراجعة اعتراضك من قبل الإدارة.
              </p>
              
              <textarea
                value={objectionContent}
                onChange={(e) => setObjectionContent(e.target.value)}
                placeholder="اكتب سبب الاعتراض بالتفصيل..."
                className="w-full h-32 p-3 border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="p-4 border-t bg-slate-50 flex gap-3">
              <button
                onClick={() => setShowObjectionModal(false)}
                className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmitObjection}
                disabled={submittingObjection || !objectionContent.trim()}
                className="flex-1 py-3 bg-gradient-to-l from-red-500 to-orange-500 text-white rounded-xl font-bold hover:from-red-600 hover:to-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submittingObjection ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5" />
                    إرسال الاعتراض
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          🆕 Modal التقييم
      ════════════════════════════════════════════════════════════════════ */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-8 overflow-hidden">
            <div className="bg-gradient-to-l from-amber-500 to-yellow-500 text-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Star className="w-8 h-8" />
                  <div>
                    <h2 className="font-bold text-lg">قيّم تجربتك</h2>
                    <p className="text-sm opacity-90">ساعدنا في تحسين خدماتنا</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRatingModal(false)}
                  className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-6">
              
              {/* تقييم المحامي */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  تقييم المحامي
                </h3>
                
                <div className="space-y-4">
                  <RatingRow 
                    label="سرعة القبول"
                    value={ratingForm.lawyer_acceptance_speed}
                    onChange={(v) => setRatingForm({...ratingForm, lawyer_acceptance_speed: v})}
                  />
                  <RatingRow 
                    label="سرعة الاستجابة"
                    value={ratingForm.lawyer_responsiveness}
                    onChange={(v) => setRatingForm({...ratingForm, lawyer_responsiveness: v})}
                  />
                  <RatingRow 
                    label="فهم المشكلة"
                    value={ratingForm.lawyer_understanding}
                    onChange={(v) => setRatingForm({...ratingForm, lawyer_understanding: v})}
                  />
                  <RatingRow 
                    label="جودة السعر"
                    value={ratingForm.lawyer_price_value}
                    onChange={(v) => setRatingForm({...ratingForm, lawyer_price_value: v})}
                  />
                  <RatingRow 
                    label="التحديثات المستمرة"
                    value={ratingForm.lawyer_updates}
                    onChange={(v) => setRatingForm({...ratingForm, lawyer_updates: v})}
                  />
                  
                  <textarea
                    value={ratingForm.lawyer_comment}
                    onChange={(e) => setRatingForm({...ratingForm, lawyer_comment: e.target.value})}
                    placeholder="تعليق على المحامي (اختياري)..."
                    className="w-full h-20 p-3 border border-blue-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* تقييم الخدمة */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <h3 className="font-bold text-green-800 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  تقييم الخدمة
                </h3>
                
                <div className="space-y-4">
                  <RatingRow 
                    label="جودة الخدمة"
                    value={ratingForm.service_quality}
                    onChange={(v) => setRatingForm({...ratingForm, service_quality: v})}
                  />
                  <RatingRow 
                    label="الرضا العام"
                    value={ratingForm.service_satisfaction}
                    onChange={(v) => setRatingForm({...ratingForm, service_satisfaction: v})}
                  />
                  <RatingRow 
                    label="تجربة المكتبة القانونية"
                    value={ratingForm.service_library_experience}
                    onChange={(v) => setRatingForm({...ratingForm, service_library_experience: v})}
                  />
                  <RatingRow 
                    label="استجابة NOLEX"
                    value={ratingForm.service_nolex_response}
                    onChange={(v) => setRatingForm({...ratingForm, service_nolex_response: v})}
                  />
                  
                  <textarea
                    value={ratingForm.service_comment}
                    onChange={(e) => setRatingForm({...ratingForm, service_comment: e.target.value})}
                    placeholder="تعليق على الخدمة (اختياري)..."
                    className="w-full h-20 p-3 border border-green-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                </div>
              </div>

              {/* تقييم التطبيق */}
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                <h3 className="font-bold text-purple-800 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  تقييم التطبيق
                </h3>
                
                <div className="space-y-4">
                  <RatingRow 
                    label="وضوح الخدمات"
                    value={ratingForm.app_services_clarity}
                    onChange={(v) => setRatingForm({...ratingForm, app_services_clarity: v})}
                  />
                  <RatingRow 
                    label="سهولة الاستخدام"
                    value={ratingForm.app_ease_of_use}
                    onChange={(v) => setRatingForm({...ratingForm, app_ease_of_use: v})}
                  />
                  <RatingRow 
                    label="التجربة العامة"
                    value={ratingForm.app_overall_experience}
                    onChange={(v) => setRatingForm({...ratingForm, app_overall_experience: v})}
                  />
                  
                  <div className="flex items-center gap-3 py-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ratingForm.app_navigation_difficulty}
                        onChange={(e) => setRatingForm({...ratingForm, app_navigation_difficulty: e.target.checked})}
                        className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-slate-700">واجهت صعوبة في التنقل</span>
                    </label>
                  </div>
                  
                  <textarea
                    value={ratingForm.app_comment}
                    onChange={(e) => setRatingForm({...ratingForm, app_comment: e.target.value})}
                    placeholder="تعليق على التطبيق (اختياري)..."
                    className="w-full h-20 p-3 border border-purple-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex gap-3">
              <button
                onClick={handleSkipRating}
                className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300"
              >
                تخطي
              </button>
              <button
                onClick={handleSubmitRating}
                disabled={submittingRating}
                className="flex-1 py-3 bg-gradient-to-l from-amber-500 to-yellow-500 text-white rounded-xl font-bold hover:from-amber-600 hover:to-yellow-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submittingRating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Star className="w-5 h-5" />
                    إرسال التقييم
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
