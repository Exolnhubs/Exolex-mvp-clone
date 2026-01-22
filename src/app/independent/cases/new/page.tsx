'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// ⚖️ فتح قضية جديدة - المحامي المستقل
// 📅 تاريخ: 21 يناير 2026
// 📝 يُستخدم بعد قبول الوكالة لفتح قضية جديدة
// ═══════════════════════════════════════════════════════════════

const COURTS = [
  'المحكمة العامة',
  'المحكمة الجزائية',
  'محكمة الأحوال الشخصية',
  'المحكمة التجارية',
  'المحكمة العمالية',
  'المحكمة الإدارية',
  'محكمة التنفيذ',
  'محكمة الاستئناف',
]

const CITIES = [
  'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام',
  'الخبر', 'الظهران', 'الأحساء', 'القطيف', 'الجبيل',
  'تبوك', 'بريدة', 'عنيزة', 'حائل', 'خميس مشيط',
  'أبها', 'نجران', 'جازان', 'الباحة', 'سكاكا',
]

const CASE_TYPES = [
  { id: 'civil', name: 'مدنية' },
  { id: 'criminal', name: 'جنائية' },
  { id: 'labor', name: 'عمالية' },
  { id: 'commercial', name: 'تجارية' },
  { id: 'personal_status', name: 'أحوال شخصية' },
  { id: 'administrative', name: 'إدارية' },
  { id: 'execution', name: 'تنفيذ' },
  { id: 'real_estate', name: 'عقارية' },
]

export default function NewCasePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestId = searchParams.get('request_id')

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentLawyer, setCurrentLawyer] = useState<any>(null)
  const [requestData, setRequestData] = useState<any>(null)
  const [poaData, setPoaData] = useState<any>(null)
  const [memberData, setMemberData] = useState<any>(null)

  const [formData, setFormData] = useState({
    court_name: '',
    court_city: '',
    court_case_number: '',
    court_circuit: '',
    judge_name: '',
    case_type: '',
    case_category: '',
    domain: '',
    plaintiff_name: '',
    plaintiff_type: 'individual',
    plaintiff_representative: '',
    defendant_name: '',
    defendant_type: 'individual',
    defendant_representative: '',
    claim_amount: '',
    claim_description: '',
    filing_date: '',
    first_hearing_date: '',
    next_session_date: '',
    notes: '',
  })

  useEffect(() => {
    if (!requestId) {
      toast.error('لم يتم تحديد الطلب')
      router.push('/independent/cases')
      return
    }
    loadData()
  }, [requestId])

  const loadData = async () => {
    try {
      const lawyerId = localStorage.getItem('exolex_lawyer_id')
      if (!lawyerId) {
        router.push('/auth/lawyer-login')
        return
      }

      // التحقق من نوع المحامي
      const { data: lawyerData } = await supabase
        .from('lawyers')
        .select('*')
        .eq('id', lawyerId)
        .single()

      if (!lawyerData || lawyerData.lawyer_type !== 'independent') {
        toast.error('غير مصرح لك بالوصول')
        router.push('/auth/lawyer-login')
        return
      }

      setCurrentLawyer(lawyerData)

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

if (reqError) {
  console.error('Request error:', reqError)
  toast.error('الطلب غير موجود')
  router.push('/independent/cases')
  return
}

      setRequestData(reqData)

      // جلب بيانات الوكالة المقبولة
      const { data: poa } = await supabase
      .from('power_of_attorneys')
        .select('*')
        .eq('request_id', requestId)
        .eq('status', 'approved')
        .single()

      if (!poa) {
        toast.error('لا توجد وكالة مقبولة لهذا الطلب')
        router.push('/independent/my-tasks')
        return
      }

      setPoaData(poa)

      // جلب بيانات المشترك
      const { data: member } = await supabase
        .from('members')
        .select('*, user:user_id(full_name, full_name_en)')
        .eq('id', reqData.member_id)
        .single()

      setMemberData(member)

      // تعبئة الحقول تلقائياً
      // المدعي = المشترك
      // الممثل/الوكيل = المحامي
      setFormData(prev => ({
        ...prev,
        plaintiff_name: member?.user?.full_name || '',
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

    if (!formData.court_name || !formData.court_city || !formData.plaintiff_name || !formData.defendant_name) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    setIsSubmitting(true)

    try {
      // إنشاء القضية
      const { data: newCase, error: caseError } = await supabase
        .from('case_management')
        .insert({
          request_id: requestId,
          member_id: requestData?.member_id,
          power_of_attorney_id: poaData?.id,
          assigned_lawyer_id: currentLawyer?.id,
          assigned_lawyer_type: 'independent',
          court_name: formData.court_name,
          court_city: formData.court_city,
          court_case_number: formData.court_case_number || null,
          court_circuit: formData.court_circuit || null,
          judge_name: formData.judge_name || null,
          case_type: formData.case_type || null,
          case_category: formData.case_category || null,
          domain: formData.domain || null,
          plaintiff_name: formData.plaintiff_name,
          plaintiff_type: formData.plaintiff_type,
          plaintiff_representative: formData.plaintiff_representative || null,
          defendant_name: formData.defendant_name,
          defendant_type: formData.defendant_type,
          defendant_representative: formData.defendant_representative || null,
          claim_amount: formData.claim_amount ? parseFloat(formData.claim_amount) : null,
          claim_description: formData.claim_description || null,
          filing_date: formData.filing_date || null,
          first_hearing_date: formData.first_hearing_date || null,
          next_session_date: formData.next_session_date ? `${formData.next_session_date}T09:00:00` : null,
          notes: formData.notes || null,
          court_status: 'active',
          poa_verified: true,
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
          start_datetime: `${formData.next_session_date}T09:00:00`,
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
        .update({ status: 'case_opened' })
        .eq('id', requestId)

      // إرسال إشعار للمشترك
      if (requestData?.member_id) {
        await supabase.from('notifications').insert({
          recipient_type: 'member',
          recipient_id: requestData.member_id,
          title: '⚖️ تم فتح قضيتك',
          body: `تم فتح القضية في ${formData.court_name} - ${formData.court_city}`,
          notification_type: 'case_update',
          request_id: requestId,
          is_read: false
        })
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
          portal: 'independent'
        }
      })

      toast.success('✅ تم فتح القضية بنجاح')
      router.push(`/independent/cases/${newCase.id}`)

    } catch (error: any) {
      console.error('Error:', error)
      toast.error('حدث خطأ: ' + (error.message || 'فشل في فتح القضية'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
          <Link href="/independent/my-tasks" className="text-blue-600 text-sm mb-4 inline-block hover:underline">
            ← العودة للمهام
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">⚖️ فتح قضية جديدة</h1>
          <p className="text-slate-500 mt-1">
            الطلب: {requestData?.ticket_number || '---'}
          </p>
        </div>

        {/* معلومات الوكالة */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-green-700">
            <span className="text-xl">✅</span>
            <span className="font-medium">الوكالة مقبولة ومفعّلة</span>
          </div>
          <p className="text-green-600 text-sm mt-1">
            الموكل: {poaData?.principal_name || memberData?.user?.full_name || '---'}
          </p>
        </div>

        {/* النموذج */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* بيانات المحكمة */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>🏛️</span> بيانات المحكمة
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  المحكمة <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.court_name}
                  onChange={(e) => setFormData({...formData, court_name: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">اختر المحكمة</option>
                  {COURTS.map(court => (
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">اختر المدينة</option>
                  {CITIES.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">رقم القضية</label>
                <input
                  type="text"
                  value={formData.court_case_number}
                  onChange={(e) => setFormData({...formData, court_case_number: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="رقم القضية في المحكمة"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">الدائرة</label>
                <input
                  type="text"
                  value={formData.court_circuit}
                  onChange={(e) => setFormData({...formData, court_circuit: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="رقم الدائرة"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">اسم القاضي</label>
                <input
                  type="text"
                  value={formData.judge_name}
                  onChange={(e) => setFormData({...formData, judge_name: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="اسم القاضي (اختياري)"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">نوع القضية</label>
                <select
                  value={formData.case_type}
                  onChange={(e) => setFormData({...formData, case_type: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">اختر النوع</option>
                  {CASE_TYPES.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* المدعي */}
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
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
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">النوع</label>
                    <select
                      value={formData.plaintiff_type}
                      onChange={(e) => setFormData({...formData, plaintiff_type: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
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
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      placeholder="اسم المحامي"
                    />
                  </div>
                </div>
              </div>

              {/* المدعى عليه */}
              <div className="p-4 bg-red-50 rounded-xl border border-red-200">
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
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">النوع</label>
                    <select
                      value={formData.defendant_type}
                      onChange={(e) => setFormData({...formData, defendant_type: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
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
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      placeholder="اسم محامي الخصم (إن وجد)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* المطالبة */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>📝</span> المطالبة
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">مبلغ المطالبة (ر.س)</label>
                <input
                  type="number"
                  value={formData.claim_amount}
                  onChange={(e) => setFormData({...formData, claim_amount: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">وصف المطالبة</label>
                <textarea
                  value={formData.claim_description}
                  onChange={(e) => setFormData({...formData, claim_description: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="وصف تفصيلي للمطالبة..."
                />
              </div>
            </div>
          </div>

          {/* التواريخ */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>📅</span> التواريخ
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">تاريخ التقديم</label>
                <input
                  type="date"
                  value={formData.filing_date}
                  onChange={(e) => setFormData({...formData, filing_date: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">أول جلسة</label>
                <input
                  type="date"
                  value={formData.first_hearing_date}
                  onChange={(e) => setFormData({...formData, first_hearing_date: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">الجلسة القادمة</label>
                <input
                  type="date"
                  value={formData.next_session_date}
                  onChange={(e) => setFormData({...formData, next_session_date: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ملاحظات */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>📌</span> ملاحظات
            </h2>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="أي ملاحظات إضافية..."
            />
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex gap-4">
            <Link
              href="/independent/my-tasks"
              className="flex-1 py-3 px-6 border border-slate-300 rounded-xl text-center text-slate-600 hover:bg-slate-50 font-semibold"
            >
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-6 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
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
