'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 تفاصيل الطلب - المشترك
// 📅 تاريخ التحديث: 6 يناير 2026
// 🎯 التحديثات: أرشيف NOLEX + تعليقات المحامي + رد المحامي الرسمي + سجل الطلب
// 📁 المسار: src/app/subscriber/requests/[id]/page.tsx
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import Image from 'next/image'
import {
  ArrowRight, Clock, User, FileText, Calendar, MessageSquare,
  Send, Paperclip, Bot, AlertCircle, CheckCircle, XCircle,
  Download, Eye, Timer, Star, ChevronDown, ChevronUp,
  MessageCircle, Reply, ThumbsUp, ThumbsDown, History
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// التكوينات
// ═══════════════════════════════════════════════════════════════════════════════

const statusConfig: Record<string, { label: string; color: string; icon: any; description: string }> = {
  pending: { 
    label: 'بانتظار التعيين', 
    color: 'bg-gray-100 text-gray-700', 
    icon: Clock,
    description: 'طلبك قيد المراجعة وسيتم تعيين محامي قريباً'
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
    label: 'قيد العمل', 
    color: 'bg-indigo-100 text-indigo-700', 
    icon: Timer,
    description: 'المحامي يعمل على طلبك حالياً'
  },
  awaiting_response: { 
    label: 'بانتظار ردك', 
    color: 'bg-orange-100 text-orange-700', 
    icon: MessageCircle,
    description: 'المحامي أرسل لك سؤالاً وينتظر ردك'
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  // States
  const [isLoading, setIsLoading] = useState(true)
  const [request, setRequest] = useState<any>(null)
  const [lawyer, setLawyer] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<{ id: string; memberId: string; name: string } | null>(null)

  // 🔴 جديد: محادثة NOLEX
  const [nolexConversation, setNolexConversation] = useState<any[]>([])
  const [showNolexArchive, setShowNolexArchive] = useState(false)

  // 🔴 جديد: تعليقات المحامي
  const [lawyerComments, setLawyerComments] = useState<any[]>([])
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  // 🔴 جديد: رد المحامي الرسمي
  const [lawyerResponse, setLawyerResponse] = useState<any>(null)
  const [showObjectionForm, setShowObjectionForm] = useState(false)
  const [objectionText, setObjectionText] = useState('')
  const [sendingObjection, setSendingObjection] = useState(false)

  // 🔴 جديد: التقييم
  const [showRatingForm, setShowRatingForm] = useState(false)
  const [rating, setRating] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)

  // 🔴 جديد: سجل الطلب
  const [requestHistory, setRequestHistory] = useState<any[]>([])

  // ═══════════════════════════════════════════════════════════════════════════════
  // تحميل البيانات
  // ═══════════════════════════════════════════════════════════════════════════════

  useEffect(() => { loadData() }, [requestId])

  const loadData = async () => {
    try {
      const userId = localStorage.getItem('exolex_user_id')
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

      // 🔴 جديد: جلب محادثة NOLEX
      if (requestData.nolex_conversation) {
        setNolexConversation(requestData.nolex_conversation)
      }

      // جلب معلومات المحامي
      if (requestData.assigned_lawyer_id) {
        const { data: lawyerData } = await supabase
          .from('lawyers')
          .select('id, full_name, lawyer_code, rating_average, rating_count, years_of_experience, city')
          .eq('id', requestData.assigned_lawyer_id)
          .single()
        setLawyer(lawyerData)
      }

      // 🔴 جديد: جلب تعليقات المحامي
      const { data: commentsData } = await supabase
        .from('request_comments')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true })
      setLawyerComments(commentsData || [])

      // 🔴 جديد: جلب رد المحامي الرسمي
      const { data: responseData } = await supabase
        .from('lawyer_responses')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (responseData) setLawyerResponse(responseData)

      // 🔴 جديد: جلب سجل الطلب
      const { data: historyData } = await supabase
        .from('request_history')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })
      setRequestHistory(historyData || [])

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔴 جديد: إرسال رد على تعليق المحامي
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleSendReply = async (commentId: string) => {
    if (!replyText.trim()) return

    setSendingReply(true)
    try {
      // إضافة الرد
      const { error } = await supabase.from('request_comments').insert({
        request_id: requestId,
        parent_id: commentId,
        sender_type: 'subscriber',
        sender_id: currentUser?.memberId,
        content: replyText
      })

      if (error) throw error

      // تحديث التعليق الأصلي ليكون مُرد عليه
      await supabase
        .from('request_comments')
        .update({ subscriber_replied: true })
        .eq('id', commentId)

      toast.success('✅ تم إرسال الرد')
      setReplyText('')
      setReplyingTo(null)
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في إرسال الرد')
    } finally {
      setSendingReply(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔴 جديد: إرسال اعتراض
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleSendObjection = async () => {
    if (!objectionText.trim()) return

    setSendingObjection(true)
    try {
      const { error } = await supabase.from('request_objections').insert({
        request_id: requestId,
        response_id: lawyerResponse?.id,
        subscriber_id: currentUser?.memberId,
        content: objectionText
      })

      if (error) throw error

      // تحديث حالة الطلب
      await supabase
        .from('service_requests')
        .update({ status: 'objection_raised' })
        .eq('id', requestId)

      toast.success('✅ تم إرسال الاعتراض')
      setObjectionText('')
      setShowObjectionForm(false)
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في إرسال الاعتراض')
    } finally {
      setSendingObjection(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔴 جديد: إرسال التقييم
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleSubmitRating = async () => {
    if (rating === 0) {
      toast.error('يرجى اختيار تقييم')
      return
    }

    setSubmittingRating(true)
    try {
      // حفظ التقييم
      const { error } = await supabase.from('ratings').insert({
        request_id: requestId,
        lawyer_id: lawyer?.id,
        subscriber_id: currentUser?.memberId,
        rating: rating,
        comment: ratingComment
      })

      if (error) throw error

      // تحديث حالة الطلب
      await supabase
        .from('service_requests')
        .update({ 
          status: 'closed',
          subscriber_rating: rating,
          subscriber_feedback: ratingComment
        })
        .eq('id', requestId)

      toast.success('✅ شكراً على تقييمك!')
      setShowRatingForm(false)
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في إرسال التقييم')
    } finally {
      setSubmittingRating(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // الدوال المساعدة
  // ═══════════════════════════════════════════════════════════════════════════════

  const formatDate = (date: string) => date ? new Date(date).toLocaleDateString('ar-SA') : '-'
  const formatDateTime = (date: string) => date ? new Date(date).toLocaleString('ar-SA') : '-'
  const formatTime = (date: string) => date ? new Date(date).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : ''

  // هل يمكن للمشترك الرد على تعليق معين؟
  const canReplyToComment = (comment: any) => {
    return comment.sender_type === 'lawyer' && !comment.subscriber_replied
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

            {/* وصف الطلب */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-xs text-slate-500 mb-2">وصف الطلب</p>
              <p className="text-slate-700 whitespace-pre-wrap">{request.description || 'لا يوجد وصف'}</p>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════════
              🔴 جديد: أرشيف محادثة NOLEX
          ════════════════════════════════════════════════════════════════════ */}
          {nolexConversation && nolexConversation.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => setShowNolexArchive(!showNolexArchive)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden">
                    <Image src="/nolex-avatar.jpg" alt="NOLEX" width={40} height={40} className="w-full h-full object-cover" />
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

          {/* ════════════════════════════════════════════════════════════════════
              🔴 جديد: رد المحامي الرسمي (فوق سجل الطلب)
          ════════════════════════════════════════════════════════════════════ */}
          {lawyerResponse && (
            <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-green-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-xl">
                  ⚖️
                </div>
                <div>
                  <h3 className="font-bold text-green-800">رد المحامي على طلبك</h3>
                  <p className="text-sm text-slate-500">{formatDateTime(lawyerResponse.created_at)}</p>
                </div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg mb-4">
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{lawyerResponse.content}</p>
              </div>

              {/* المرفقات إن وجدت */}
              {lawyerResponse.attachments && lawyerResponse.attachments.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-slate-500 mb-2">المرفقات:</p>
                  <div className="flex flex-wrap gap-2">
                    {lawyerResponse.attachments.map((file: any, idx: number) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-sm"
                      >
                        <Paperclip className="w-4 h-4" />
                        {file.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* أزرار الإجراء - فقط إذا لم يتم التقييم أو الاعتراض */}
              {!request.subscriber_rating && request.status !== 'objection_raised' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRatingForm(true)}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium flex items-center justify-center gap-2"
                  >
                    <Star className="w-5 h-5" />
                    تقييم الخدمة
                  </button>
                  <button
                    onClick={() => setShowObjectionForm(true)}
                    className="flex-1 px-4 py-3 bg-orange-100 text-orange-700 rounded-xl hover:bg-orange-200 font-medium flex items-center justify-center gap-2"
                  >
                    <ThumbsDown className="w-5 h-5" />
                    اعتراض
                  </button>
                </div>
              )}

              {/* نموذج التقييم */}
              {showRatingForm && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                  <h4 className="font-bold text-slate-800 mb-3">تقييم الخدمة</h4>
                  <div className="flex justify-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <Star className={`w-8 h-8 ${rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="أضف تعليقاً (اختياري)..."
                    className="w-full p-3 border rounded-lg mb-3 resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSubmitRating}
                      disabled={submittingRating || rating === 0}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {submittingRating ? 'جاري الإرسال...' : 'إرسال التقييم'}
                    </button>
                    <button
                      onClick={() => setShowRatingForm(false)}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

              {/* نموذج الاعتراض */}
              {showObjectionForm && (
                <div className="mt-4 p-4 bg-orange-50 rounded-xl">
                  <h4 className="font-bold text-orange-800 mb-3">تقديم اعتراض</h4>
                  <textarea
                    value={objectionText}
                    onChange={(e) => setObjectionText(e.target.value)}
                    placeholder="اشرح سبب اعتراضك..."
                    className="w-full p-3 border border-orange-200 rounded-lg mb-3 resize-none"
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSendObjection}
                      disabled={sendingObjection || !objectionText.trim()}
                      className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                    >
                      {sendingObjection ? 'جاري الإرسال...' : 'إرسال الاعتراض'}
                    </button>
                    <button
                      onClick={() => setShowObjectionForm(false)}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              🔴 جديد: تعليقات المحامي
          ════════════════════════════════════════════════════════════════════ */}
          {lawyerComments.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-500" />
                تعليقات المحامي
              </h3>
              
              <div className="space-y-4">
                {lawyerComments.filter(c => !c.parent_id).map((comment) => (
                  <div key={comment.id} className="border rounded-xl overflow-hidden">
                    {/* تعليق المحامي */}
                    <div className="p-4 bg-blue-50">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                          {lawyer?.full_name?.[0] || '؟'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-slate-800">المحامي</span>
                            <span className="text-xs text-slate-500">{formatDateTime(comment.created_at)}</span>
                          </div>
                          <p className="text-slate-700">{comment.content}</p>
                        </div>
                      </div>
                    </div>

                    {/* ردود المشترك */}
                    {lawyerComments
                      .filter(c => c.parent_id === comment.id)
                      .map((reply) => (
                        <div key={reply.id} className="p-4 bg-green-50 border-t">
                          <div className="flex items-start gap-3 mr-8">
                            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                              {currentUser?.name?.[0] || '؟'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-slate-800">أنت</span>
                                <span className="text-xs text-slate-500">{formatDateTime(reply.created_at)}</span>
                              </div>
                              <p className="text-slate-700">{reply.content}</p>
                            </div>
                          </div>
                        </div>
                      ))}

                    {/* زر الرد */}
                    {canReplyToComment(comment) && (
                      <div className="p-4 border-t bg-white">
                        {replyingTo === comment.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="اكتب ردك هنا..."
                              className="w-full p-3 border rounded-lg resize-none"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSendReply(comment.id)}
                                disabled={sendingReply || !replyText.trim()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                              >
                                {sendingReply ? 'جاري الإرسال...' : (
                                  <>
                                    <Send className="w-4 h-4" />
                                    إرسال الرد
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => { setReplyingTo(null); setReplyText('') }}
                                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                              >
                                إلغاء
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReplyingTo(comment.id)}
                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2"
                          >
                            <Reply className="w-4 h-4" />
                            الرد على هذا التعليق
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              🔴 جديد: سجل الطلب
          ════════════════════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-purple-500" />
              سجل الطلب
            </h3>
            
            <div className="relative">
              {/* الخط العمودي */}
              <div className="absolute right-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
              
              <div className="space-y-4">
                {/* إنشاء الطلب */}
                <div className="flex gap-4 relative">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white z-10">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium text-slate-800">تم إنشاء الطلب</p>
                    <p className="text-sm text-slate-500">{formatDateTime(request.created_at)}</p>
                  </div>
                </div>

                {/* تعيين المحامي */}
                {lawyer && (
                  <div className="flex gap-4 relative">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white z-10">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-slate-800">
                        تم إسناد طلبك للمحامي <span className="text-blue-600 font-bold">{lawyer.lawyer_code || 'LAW-0000'}</span>
                      </p>
                      <p className="text-sm text-slate-500">{formatDateTime(request.assigned_at)}</p>
                    </div>
                  </div>
                )}

                {/* سجل إضافي من قاعدة البيانات */}
                {requestHistory.map((item, idx) => (
                  <div key={idx} className="flex gap-4 relative">
                    <div className="w-8 h-8 bg-slate-400 rounded-full flex items-center justify-center text-white z-10">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-slate-800">{item.action}</p>
                      <p className="text-sm text-slate-500">{formatDateTime(item.created_at)}</p>
                      {item.notes && <p className="text-sm text-slate-600 mt-1">{item.notes}</p>}
                    </div>
                  </div>
                ))}

                {/* الحالة الحالية */}
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
                <p className="text-lg font-bold text-blue-600">{lawyer.lawyer_code || 'LAW-0000'}</p>
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
                <p className="text-sm">لم يتم تعيين محامي بعد</p>
              </div>
            </div>
          )}

          {/* التقييم إذا تم */}
          {request.subscriber_rating && (
            <div className="bg-green-50 rounded-xl p-5 border border-green-200">
              <h3 className="font-bold text-green-800 mb-3">✅ تم تقييم الخدمة</h3>
              <div className="flex justify-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-6 h-6 ${request.subscriber_rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`}
                  />
                ))}
              </div>
              {request.subscriber_feedback && (
                <p className="text-sm text-green-700 text-center">{request.subscriber_feedback}</p>
              )}
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
    </div>
  )
}
