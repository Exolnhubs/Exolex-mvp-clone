'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getLawyerId } from '@/lib/cookies'

// ═══════════════════════════════════════════════════════════════
// ⚖️ صفحة فتح قضية جديدة - محامي الذراع القانوني
// 📅 تاريخ: 21 يناير 2026
// ═══════════════════════════════════════════════════════════════
// 🔗 تأتي من: /legal-arm-lawyer/my-tasks/[id] بعد قبول الوكالة
// 📦 URL Parameter: request_id
// ═══════════════════════════════════════════════════════════════

export default function NewCasePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestId = searchParams.get('request_id')

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentLawyer, setCurrentLawyer] = useState<any>(null)
  const [requestData, setRequestData] = useState<any>(null)
  const [memberData, setMemberData] = useState<any>(null)
  const [poaData, setPoaData] = useState<any>(null)

  // نموذج القضية
  const [formData, setFormData] = useState({
    // بيانات المحكمة
    court_case_number: '',
    court_name: '',
    court_city: '',
    court_circuit: '',
    department: '',
    judge_name: '',
    
    // نوع القضية
    case_type: '',
    case_category: '',
    domain: '',
    
    // أطراف الدعوى
    plaintiff_name: '',
    plaintiff_type: 'individual',
    plaintiff_representative: '',
    defendant_name: '',
    defendant_type: 'individual',
    defendant_representative: '',
    
    // المطالبة
    claim_amount: '',
    claim_description: '',
    
    // التواريخ
    filing_date: '',
    first_hearing_date: '',
    next_session_date: '',
    
    // ملاحظات
    notes: ''
  })

  // قائمة المحاكم
  const courts = [
    'المحكمة العامة',
    'المحكمة الجزائية',
    'محكمة الأحوال الشخصية',
    'المحكمة التجارية',
    'المحكمة العمالية',
    'محكمة التنفيذ',
    'محكمة الاستئناف',
    'المحكمة الإدارية',
    'ديوان المظالم'
  ]

  // قائمة المدن
  const cities = [
    'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام',
    'الخبر', 'الظهران', 'الطائف', 'تبوك', 'بريدة', 'حائل',
    'أبها', 'خميس مشيط', 'نجران', 'جازان', 'الأحساء', 'الجبيل'
  ]

  // أنواع القضايا
  const caseTypes = [
    { value: 'civil', label: 'مدنية' },
    { value: 'criminal', label: 'جنائية' },
    { value: 'labor', label: 'عمالية' },
    { value: 'commercial', label: 'تجارية' },
    { value: 'family', label: 'أحوال شخصية' },
    { value: 'administrative', label: 'إدارية' },
    { value: 'execution', label: 'تنفيذ' },
    { value: 'real_estate', label: 'عقارية' }
  ]

  useEffect(() => {
    loadData()
  }, [requestId])

  const loadData = async () => {
    try {
      const lawyerId = getLawyerId()
      if (!lawyerId) {
        router.push('/auth/lawyer-login')
        return
      }

      // التحقق من المحامي
      const { data: lawyerData, error: lawyerError } = await supabase
        .from('lawyers')
        .select('*, legal_arm_id')
        .eq('id', lawyerId)
        .single()

      if (lawyerError || !lawyerData) {
        router.push('/auth/lawyer-login')
        return
      }

      if (lawyerData.lawyer_type !== 'legal_arm') {
        toast.error('هذه الصفحة لمحامي الذراع القانوني فقط')
        router.push('/auth/lawyer-login')
        return
      }

      setCurrentLawyer(lawyerData)

      // إذا لا يوجد request_id
      if (!requestId) {
        setIsLoading(false)
        return
      }

      // جلب بيانات الطلب
      const { data: reqData, error: reqError } = await supabase
        .from('service_requests')
        .select(`
          *,
          category:category_id(name_ar, icon),
          subcategory:subcategory_id(name_ar)
        `)
        .eq('id', requestId)
        .single()

      if (reqError || !reqData) {
        toast.error('الطلب غير موجود')
        router.push('/legal-arm-lawyer/cases')
        return
      }

      // التحقق من أن الطلب معين لهذا المحامي
      if (reqData.assigned_lawyer_id !== lawyerId) {
        toast.error('ليس لديك صلاحية')
        router.push('/legal-arm-lawyer/my-tasks')
        return
      }

      setRequestData(reqData)

      // جلب بيانات المشترك مع اسمه من users
const { data: member } = await supabase
.from('members')
.select('*, user:user_id(full_name, full_name_en)')
.eq('id', reqData.member_id)
.single()

setMemberData(member)

      // جلب بيانات الوكالة
      const { data: poa } = await supabase
        .from('power_of_attorneys')
        .select('*')
        .eq('request_id', requestId)
        .eq('status', 'approved')
        .single()

      if (!poa) {
        toast.error('لا توجد وكالة مقبولة لهذا الطلب')
        router.push(`/legal-arm-lawyer/my-tasks/${requestId}`)
        return
      }

      setPoaData(poa)

      // تعبئة الحقول تلقائياً
// المدعي = المشترك (من جدول users)
// الممثل/الوكيل = المحامي
setFormData(prev => ({
  ...prev,
  // اسم المدعي = اسم المشترك من جدول users
  plaintiff_name: member?.user?.full_name || '',
  // الممثل/الوكيل = المحامي
  plaintiff_representative: lawyerData.full_name || '',
  claim_description: reqData.description || '',
  domain: reqData.category?.name_ar || '',
  case_category: reqData.subcategory?.name_ar || ''
}))

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // التحقق من الحقول المطلوبة
    if (!formData.court_name || !formData.court_city || !formData.case_type) {
      toast.error('يرجى ملء الحقول المطلوبة: المحكمة، المدينة، نوع القضية')
      return
    }

    if (!formData.plaintiff_name || !formData.defendant_name) {
      toast.error('يرجى إدخال أسماء أطراف الدعوى')
      return
    }

    setIsSubmitting(true)

    try {
      // إنشاء القضية
      const { data: newCase, error: caseError } = await supabase
        .from('case_management')
        .insert({
          // الربط
          request_id: requestId,
          member_id: requestData?.member_id,
          assigned_lawyer_id: currentLawyer?.id,
          assigned_lawyer_type: 'legal_arm_employee',
          legal_arm_id: currentLawyer?.legal_arm_id,
          power_of_attorney_id: poaData?.id,
          poa_verified: true,
          
          // بيانات المحكمة
          court_case_number: formData.court_case_number || null,
          court_name: formData.court_name,
          court_city: formData.court_city,
          court_circuit: formData.court_circuit || null,
          department: formData.department || null,
          judge_name: formData.judge_name || null,
          
          // نوع القضية
          case_type: formData.case_type,
          case_category: formData.case_category || null,
          domain: formData.domain || null,
          
          // أطراف الدعوى
          plaintiff_name: formData.plaintiff_name,
          plaintiff_type: formData.plaintiff_type,
          plaintiff_representative: formData.plaintiff_representative || null,
          defendant_name: formData.defendant_name,
          defendant_type: formData.defendant_type,
          defendant_representative: formData.defendant_representative || null,
          
          // المطالبة
          claim_amount: formData.claim_amount ? parseFloat(formData.claim_amount) : null,
          claim_description: formData.claim_description || null,
          
          // التواريخ
          filing_date: formData.filing_date || null,
          first_hearing_date: formData.first_hearing_date || null,
          next_session_date: formData.next_session_date || null,
          
          // الحالة
          court_status: 'active',
          notes: formData.notes || null,
          
          // SLA
          assigned_at: new Date().toISOString()
        })
        .select()
        .single()

        if (caseError) throw caseError

        // إضافة الجلسات للتقويم
        if (formData.first_hearing_date) {
          await supabase.from('calendar_events').insert({
            owner_type: 'lawyer',
            owner_id: currentLawyer?.id,
            owner_name: currentLawyer?.full_name || '',
            title: `أول جلسة - ${formData.court_name}`,
            event_type: 'court_session',
            start_datetime: `${formData.first_hearing_date}T09:00:00`,
            location: `${formData.court_name} - ${formData.court_city}`,
            location_type: 'physical',
            request_id: requestId,
            case_id: newCase.id,
            is_private: false,
            status: 'scheduled',
            created_by: currentLawyer?.id
          })
        }
        
        if (formData.next_session_date) {
          await supabase.from('calendar_events').insert({
            owner_type: 'lawyer',
            owner_id: currentLawyer?.id,
            owner_name: currentLawyer?.full_name || '',
            title: `جلسة - ${formData.court_name}`,
            event_type: 'court_session',
            start_datetime: formData.next_session_date,
            location: `${formData.court_name} - ${formData.court_city}`,
            location_type: 'physical',
            request_id: requestId,
            case_id: newCase.id,
            is_private: false,
            status: 'scheduled',
            created_by: currentLawyer?.id
          })
        }

      // تحديث حالة الطلب
      await supabase
        .from('service_requests')
        .update({ 
          status: 'case_opened',
          case_id: newCase.id
        })
        .eq('id', requestId)

      // إرسال إشعار للمشترك
const memberId = requestData?.member_id || newCase.member_id
if (memberId) {
  const { error: notifError } = await supabase.from('notifications').insert({
    recipient_type: 'member',
    recipient_id: memberId,
    title: '⚖️ تم فتح قضيتك',
    body: `تم فتح القضية في ${formData.court_name} - ${formData.court_city}`,
    notification_type: 'case_update',
    request_id: requestId,
    is_read: false
  })
  if (notifError) console.error('Notification error:', notifError)
}

      // تسجيل النشاط
      await supabase.from('activity_logs').insert({
        user_id: currentLawyer?.user_id,
        user_type: 'lawyer',
        user_name: currentLawyer?.full_name,
        activity_type: 'case_opened',
        description: `فتح قضية جديدة في ${formData.court_name}`,
        metadata: {
          request_id: requestId,
          case_id: newCase.id,
          portal: 'legal_arm_lawyer'
        }
      })

      toast.success('✅ تم فتح القضية بنجاح')
      router.push(`/legal-arm-lawyer/cases/${newCase.id}`)

    } catch (error: any) {
      console.error('Error:', error)
      toast.error('حدث خطأ: ' + (error.message || 'فشل في إنشاء القضية'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <Link 
            href={requestId ? `/legal-arm-lawyer/my-tasks/${requestId}` : '/legal-arm-lawyer/cases'}
            className="text-amber-600 text-sm mb-4 inline-block hover:underline"
          >
            ← العودة
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
              <span className="text-3xl">⚖️</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">فتح قضية جديدة</h1>
              <p className="text-slate-500 mt-1">
                {requestData ? `للطلب: ${requestData.ticket_number}` : 'أدخل بيانات القضية'}
              </p>
            </div>
          </div>
        </div>

        {/* معلومات الطلب والوكالة */}
        {requestData && poaData && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span>📋</span>
                <h3 className="font-bold text-blue-800">الطلب الأصلي</h3>
              </div>
              <p className="text-sm text-blue-700">{requestData.ticket_number}</p>
              <p className="text-sm text-blue-600 mt-1">{requestData.title || requestData.description?.slice(0, 50)}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span>📄</span>
                <h3 className="font-bold text-green-800">الوكالة</h3>
              </div>
              <p className="text-sm text-green-700">✅ مقبولة</p>
              <p className="text-sm text-green-600 mt-1">{poaData.principal_name}</p>
            </div>
          </div>
        )}

        {/* النموذج */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* بيانات المحكمة */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>🏛️</span> بيانات المحكمة
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  المحكمة <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.court_name}
                  onChange={(e) => setFormData({...formData, court_name: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  required
                >
                  <option value="">اختر المحكمة</option>
                  {courts.map(court => (
                    <option key={court} value={court}>{court}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  المدينة <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.court_city}
                  onChange={(e) => setFormData({...formData, court_city: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  required
                >
                  <option value="">اختر المدينة</option>
                  {cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">رقم القضية (إن وجد)</label>
                <input
                  type="text"
                  value={formData.court_case_number}
                  onChange={(e) => setFormData({...formData, court_case_number: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="رقم القضية في ناجز"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">الدائرة</label>
                <input
                  type="text"
                  value={formData.court_circuit}
                  onChange={(e) => setFormData({...formData, court_circuit: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="رقم الدائرة"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">القاضي</label>
                <input
                  type="text"
                  value={formData.judge_name}
                  onChange={(e) => setFormData({...formData, judge_name: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="اسم القاضي (إن عُرف)"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  نوع القضية <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.case_type}
                  onChange={(e) => setFormData({...formData, case_type: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  required
                >
                  <option value="">اختر النوع</option>
                  {caseTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* أطراف الدعوى */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>👥</span> أطراف الدعوى
            </h2>
            
            <div className="grid grid-cols-2 gap-6">
              {/* المدعي */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <h3 className="font-bold text-green-700 mb-3">👤 المدعي</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      الاسم <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.plaintiff_name}
                      onChange={(e) => setFormData({...formData, plaintiff_name: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">النوع</label>
                    <select
                      value={formData.plaintiff_type}
                      onChange={(e) => setFormData({...formData, plaintiff_type: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="individual">فرد</option>
                      <option value="company">شركة</option>
                      <option value="government">جهة حكومية</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">الممثل/الوكيل</label>
                    <input
                      type="text"
                      value={formData.plaintiff_representative}
                      onChange={(e) => setFormData({...formData, plaintiff_representative: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="اسم الممثل أو الوكيل"
                    />
                  </div>
                </div>
              </div>

              {/* المدعى عليه */}
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <h3 className="font-bold text-red-700 mb-3">👤 المدعى عليه</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      الاسم <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.defendant_name}
                      onChange={(e) => setFormData({...formData, defendant_name: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">النوع</label>
                    <select
                      value={formData.defendant_type}
                      onChange={(e) => setFormData({...formData, defendant_type: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    >
                      <option value="individual">فرد</option>
                      <option value="company">شركة</option>
                      <option value="government">جهة حكومية</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">الممثل/الوكيل</label>
                    <input
                      type="text"
                      value={formData.defendant_representative}
                      onChange={(e) => setFormData({...formData, defendant_representative: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      placeholder="اسم الممثل أو الوكيل"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* المطالبة */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>💰</span> المطالبة
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">مبلغ المطالبة (ر.س)</label>
                <input
                  type="number"
                  value={formData.claim_amount}
                  onChange={(e) => setFormData({...formData, claim_amount: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">وصف المطالبة</label>
              <textarea
                value={formData.claim_description}
                onChange={(e) => setFormData({...formData, claim_description: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                rows={4}
                placeholder="وصف تفصيلي للمطالبة..."
              />
            </div>
          </div>

          {/* التواريخ */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>📅</span> التواريخ
            </h2>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">تاريخ التقديم</label>
                <input
                  type="date"
                  value={formData.filing_date}
                  onChange={(e) => setFormData({...formData, filing_date: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">أول جلسة</label>
                <input
                  type="date"
                  value={formData.first_hearing_date}
                  onChange={(e) => setFormData({...formData, first_hearing_date: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">الجلسة القادمة</label>
                <input
                  type="datetime-local"
                  value={formData.next_session_date}
                  onChange={(e) => setFormData({...formData, next_session_date: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* ملاحظات */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>📝</span> ملاحظات
            </h2>
            
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              rows={3}
              placeholder="أي ملاحظات إضافية..."
            />
          </div>

          {/* أزرار الإجراء */}
          <div className="flex gap-4">
            <Link
              href={requestId ? `/legal-arm-lawyer/my-tasks/${requestId}` : '/legal-arm-lawyer/cases'}
              className="flex-1 py-3 px-6 bg-slate-200 text-slate-700 rounded-xl font-bold text-center hover:bg-slate-300 transition"
            >
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-6 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <span>⚖️</span>
                  فتح القضية
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  )
}
