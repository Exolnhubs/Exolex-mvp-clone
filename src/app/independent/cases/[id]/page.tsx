'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// ⚖️ تفاصيل القضية - المحامي المستقل
// 📅 تاريخ: 31 ديسمبر 2025
// ═══════════════════════════════════════════════════════════════

export default function CaseDetailsPage() {
  const { id } = useParams()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [caseData, setCaseData] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'details' | 'parties' | 'sessions' | 'judgment' | 'documents'>('details')

  useEffect(() => { loadData() }, [id])

  const loadData = async () => {
    try {
      const lawyerId = localStorage.getItem('exolex_lawyer_id')
      if (!lawyerId) { router.push('/auth/lawyer-login'); return }

      // جلب تفاصيل القضية
      const { data: caseResult } = await supabase
        .from('case_management')
        .select('*')
        .eq('id', id)
        .single()

      if (!caseResult) {
        toast.error('القضية غير موجودة')
        router.push('/independent/cases')
        return
      }

      setCaseData(caseResult)

      // جلب الجلسات المرتبطة
      const { data: sessionsData } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('case_id', id)
        .order('start_datetime', { ascending: true })

      setSessions(sessionsData || [])

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (caseItem: any) => {
    if (caseItem?.closed_at) return { text: 'مغلقة', color: 'bg-gray-100 text-gray-700', icon: '✅' }
    if (caseItem?.is_appealed) return { text: 'استئناف', color: 'bg-purple-100 text-purple-700', icon: '🔄' }
    if (caseItem?.judgment_date) return { text: 'صدر حكم', color: 'bg-amber-100 text-amber-700', icon: '⚖️' }
    if (caseItem?.next_session_date) return { text: 'بانتظار جلسة', color: 'bg-blue-100 text-blue-700', icon: '📅' }
    return { text: 'جارية', color: 'bg-green-100 text-green-700', icon: '🔵' }
  }

  const getNextSession = (date: string) => {
    if (!date) return null
    const sessionDate = new Date(date)
    const now = new Date()
    const diffDays = Math.ceil((sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return { text: 'منتهية', color: 'text-red-600' }
    if (diffDays === 0) return { text: 'اليوم!', color: 'text-red-600' }
    if (diffDays === 1) return { text: 'غداً', color: 'text-orange-600' }
    if (diffDays <= 7) return { text: `بعد ${diffDays} أيام`, color: 'text-yellow-600' }
    return { text: `${diffDays} يوم`, color: 'text-green-600' }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 text-center" dir="rtl">
        <span className="text-6xl">❌</span>
        <p className="mt-4 text-slate-600">القضية غير موجودة</p>
        <Link href="/independent/cases" className="text-amber-600 mt-2 inline-block">← العودة للقضايا</Link>
      </div>
    )
  }

  const status = getStatusBadge(caseData)
  const nextSession = getNextSession(caseData.next_session_date)

  return (
    <div className="min-h-screen bg-slate-100 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <Link href="/independent/cases" className="text-amber-600 text-sm mb-4 inline-block hover:underline">
            ← العودة للقضايا
          </Link>
          
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-slate-500 text-lg">{caseData.court_case_number || '---'}</span>
                <span className={`text-sm px-3 py-1 rounded-full ${status.color}`}>
                  {status.icon} {status.text}
                </span>
                {caseData.sla_breached && (
                  <span className="text-sm px-3 py-1 rounded-full bg-red-100 text-red-700">🔴 متأخر</span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-slate-800">
                {caseData.case_type || caseData.domain || 'قضية'}
              </h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                <span>🏛️ {caseData.court_name || '---'}</span>
                <span>📍 {caseData.court_city || '---'}</span>
                <span>🔢 الدائرة: {caseData.court_circuit || '---'}</span>
              </div>
            </div>

            {/* الجلسة القادمة */}
            {nextSession && (
              <div className={`text-center px-4 py-3 rounded-xl bg-blue-50`}>
                <span className={`text-lg font-bold ${nextSession.color}`}>📅 {nextSession.text}</span>
                <p className="text-xs text-slate-500">الجلسة القادمة</p>
                <p className="text-sm text-slate-600 mt-1">
                  {new Date(caseData.next_session_date).toLocaleDateString('ar-SA')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* التبويبات */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="flex border-b overflow-x-auto">
            {[
              { key: 'details', label: 'التفاصيل', icon: '📋' },
              { key: 'parties', label: 'أطراف الدعوى', icon: '👥' },
              { key: 'sessions', label: 'الجلسات', icon: '📅' },
              { key: 'judgment', label: 'الحكم', icon: '⚖️' },
              { key: 'documents', label: 'المستندات', icon: '📁' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 px-4 py-3 text-center font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* محتوى التبويبات */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* العمود الرئيسي */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* تبويب التفاصيل */}
            {activeTab === 'details' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4">📋 تفاصيل القضية</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <label className="text-xs text-slate-500">رقم القضية</label>
                    <p className="font-mono font-medium text-slate-700">{caseData.court_case_number || '---'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <label className="text-xs text-slate-500">نوع القضية</label>
                    <p className="font-medium text-slate-700">{caseData.case_type || caseData.case_category || '---'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <label className="text-xs text-slate-500">المحكمة</label>
                    <p className="font-medium text-slate-700">{caseData.court_name || '---'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <label className="text-xs text-slate-500">المدينة</label>
                    <p className="font-medium text-slate-700">{caseData.court_city || '---'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <label className="text-xs text-slate-500">الدائرة</label>
                    <p className="font-medium text-slate-700">{caseData.court_circuit || '---'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <label className="text-xs text-slate-500">القاضي</label>
                    <p className="font-medium text-slate-700">{caseData.judge_name || '---'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <label className="text-xs text-slate-500">تاريخ التقديم</label>
                    <p className="font-medium text-slate-700">
                      {caseData.filing_date ? new Date(caseData.filing_date).toLocaleDateString('ar-SA') : '---'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <label className="text-xs text-slate-500">أول جلسة</label>
                    <p className="font-medium text-slate-700">
                      {caseData.first_hearing_date ? new Date(caseData.first_hearing_date).toLocaleDateString('ar-SA') : '---'}
                    </p>
                  </div>
                </div>

                {/* وصف المطالبة */}
                {caseData.claim_description && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <label className="text-sm text-blue-600 font-medium">📝 وصف المطالبة</label>
                    <p className="text-slate-700 mt-2">{caseData.claim_description}</p>
                  </div>
                )}

                {/* ملاحظات */}
                {caseData.notes && (
                  <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <label className="text-sm text-amber-600 font-medium">📌 ملاحظات</label>
                    <p className="text-slate-700 mt-2">{caseData.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* تبويب أطراف الدعوى */}
            {activeTab === 'parties' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4">👥 أطراف الدعوى</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* المدعي */}
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">👤</span>
                      <h3 className="font-bold text-green-700">المدعي</h3>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-green-600">الاسم</label>
                        <p className="font-medium text-slate-800">{caseData.plaintiff_name || '---'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-green-600">النوع</label>
                        <p className="text-slate-700">{caseData.plaintiff_type === 'individual' ? 'فرد' : caseData.plaintiff_type === 'company' ? 'شركة' : caseData.plaintiff_type || '---'}</p>
                      </div>
                      {caseData.plaintiff_representative && (
                        <div>
                          <label className="text-xs text-green-600">الممثل/الوكيل</label>
                          <p className="text-slate-700">{caseData.plaintiff_representative}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* المدعى عليه */}
                  <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">👤</span>
                      <h3 className="font-bold text-red-700">المدعى عليه</h3>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-red-600">الاسم</label>
                        <p className="font-medium text-slate-800">{caseData.defendant_name || '---'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-red-600">النوع</label>
                        <p className="text-slate-700">{caseData.defendant_type === 'individual' ? 'فرد' : caseData.defendant_type === 'company' ? 'شركة' : caseData.defendant_type || '---'}</p>
                      </div>
                      {caseData.defendant_representative && (
                        <div>
                          <label className="text-xs text-red-600">الممثل/الوكيل</label>
                          <p className="text-slate-700">{caseData.defendant_representative}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* التوكيل */}
                <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                  <h4 className="font-medium text-slate-700 mb-2">📜 الوكالة الشرعية</h4>
                  <div className="flex items-center gap-2">
                    {caseData.poa_verified ? (
                      <span className="text-green-600 flex items-center gap-1">✅ موثقة</span>
                    ) : (
                      <span className="text-orange-600 flex items-center gap-1">⏳ بانتظار التوثيق</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* تبويب الجلسات */}
            {activeTab === 'sessions' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-800">📅 الجلسات</h2>
                  <button
                    onClick={() => toast('🚧 قريباً - إضافة جلسة')}
                    className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600"
                  >
                    ➕ إضافة جلسة
                  </button>
                </div>
                
                {sessions.length > 0 ? (
                  <div className="space-y-3">
                    {sessions.map((session, index) => {
                      const isPast = new Date(session.start_datetime) < new Date()
                      return (
                        <div
                          key={session.id}
                          className={`p-4 rounded-lg border ${isPast ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-200'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`text-2xl ${isPast ? 'opacity-50' : ''}`}>
                                {isPast ? '✅' : '📅'}
                              </span>
                              <div>
                                <p className="font-medium text-slate-800">{session.title || `جلسة ${index + 1}`}</p>
                                <p className="text-sm text-slate-500">
                                  {new Date(session.start_datetime).toLocaleDateString('ar-SA')} - {new Date(session.start_datetime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${isPast ? 'bg-slate-200 text-slate-600' : 'bg-blue-200 text-blue-700'}`}>
                              {isPast ? 'منتهية' : 'قادمة'}
                            </span>
                          </div>
                          {session.location && (
                            <p className="text-sm text-slate-500 mt-2">📍 {session.location}</p>
                          )}
                          {session.description && (
                            <p className="text-sm text-slate-600 mt-2">{session.description}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <span className="text-4xl">📅</span>
                    <p className="text-slate-400 mt-2">لا توجد جلسات مسجلة</p>
                  </div>
                )}
              </div>
            )}

            {/* تبويب الحكم */}
            {activeTab === 'judgment' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4">⚖️ الحكم</h2>
                
                {caseData.judgment_date ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-amber-600">تاريخ الحكم</label>
                          <p className="font-medium text-slate-800">
                            {new Date(caseData.judgment_date).toLocaleDateString('ar-SA')}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-amber-600">رقم الحكم</label>
                          <p className="font-medium text-slate-800">{caseData.judgment_number || '---'}</p>
                        </div>
                        <div>
                          <label className="text-xs text-amber-600">نوع الحكم</label>
                          <p className="font-medium text-slate-800">{caseData.judgment_type || '---'}</p>
                        </div>
                        <div>
                          <label className="text-xs text-amber-600">لصالح</label>
                          <p className="font-medium text-slate-800">
                            {caseData.judgment_in_favor === 'plaintiff' ? '👤 المدعي' : 
                             caseData.judgment_in_favor === 'defendant' ? '👤 المدعى عليه' : caseData.judgment_in_favor || '---'}
                          </p>
                        </div>
                      </div>
                      {caseData.judgment_amount > 0 && (
                        <div className="mt-4 p-3 bg-white rounded-lg">
                          <label className="text-xs text-amber-600">المبلغ المحكوم به</label>
                          <p className="text-xl font-bold text-emerald-600">{caseData.judgment_amount?.toLocaleString()} ر.س</p>
                        </div>
                      )}
                    </div>

                    {/* نص الحكم */}
                    {caseData.judgment_text && (
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <label className="text-sm text-slate-600 font-medium">📝 نص الحكم</label>
                        <p className="text-slate-700 mt-2">{caseData.judgment_text}</p>
                      </div>
                    )}

                    {/* الاستئناف */}
                    {caseData.is_appealed && (
                      <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                        <h4 className="font-medium text-purple-700 mb-2">🔄 الاستئناف</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-purple-600">حالة الاستئناف</label>
                            <p className="font-medium text-slate-800">{caseData.appeal_status || 'قيد النظر'}</p>
                          </div>
                          <div>
                            <label className="text-xs text-purple-600">تاريخ الاستئناف</label>
                            <p className="font-medium text-slate-800">
                              {caseData.appeal_date ? new Date(caseData.appeal_date).toLocaleDateString('ar-SA') : '---'}
                            </p>
                          </div>
                        </div>
                        {caseData.appeal_reason && (
                          <div className="mt-3">
                            <label className="text-xs text-purple-600">سبب الاستئناف</label>
                            <p className="text-slate-700">{caseData.appeal_reason}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <span className="text-4xl">⏳</span>
                    <p className="text-slate-400 mt-2">لم يصدر حكم بعد</p>
                  </div>
                )}
              </div>
            )}

            {/* تبويب المستندات */}
            {activeTab === 'documents' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-800">📁 المستندات</h2>
                  <button
                    onClick={() => toast('🚧 قريباً - رفع مستند')}
                    className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600"
                  >
                    ➕ رفع مستند
                  </button>
                </div>
                <div className="text-center py-8">
                  <span className="text-4xl">📁</span>
                  <p className="text-slate-400 mt-2">قريباً - نظام المستندات</p>
                </div>
              </div>
            )}
          </div>

          {/* العمود الجانبي */}
          <div className="space-y-6">
            
            {/* المعلومات المالية */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4">💰 المعلومات المالية</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">مبلغ المطالبة</span>
                  <span className="font-bold text-emerald-600">
                    {caseData.claim_amount?.toLocaleString() || '---'} ر.س
                  </span>
                </div>
                {caseData.judgment_amount > 0 && (
                  <div className="flex justify-between border-t pt-3">
                    <span className="text-slate-600">المحكوم به</span>
                    <span className="font-bold text-amber-600">
                      {caseData.judgment_amount?.toLocaleString()} ر.س
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* التواريخ المهمة */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4">📅 التواريخ المهمة</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">تاريخ التقديم</span>
                  <span className="text-slate-700">
                    {caseData.filing_date ? new Date(caseData.filing_date).toLocaleDateString('ar-SA') : '---'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">الجلسة القادمة</span>
                  <span className={nextSession?.color || 'text-slate-700'}>
                    {caseData.next_session_date ? new Date(caseData.next_session_date).toLocaleDateString('ar-SA') : '---'}
                  </span>
                </div>
                {caseData.appeal_deadline && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">موعد الاستئناف</span>
                    <span className="text-red-600">
                      {new Date(caseData.appeal_deadline).toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* إجراءات سريعة */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4">⚡ إجراءات سريعة</h3>
              <div className="space-y-2">
                <button
                  onClick={() => toast('🚧 قريباً')}
                  className="w-full py-2 px-4 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm text-right"
                >
                  📅 إضافة جلسة للتقويم
                </button>
                <button
                  onClick={() => toast('🚧 قريباً')}
                  className="w-full py-2 px-4 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 text-sm text-right"
                >
                  📝 تسجيل حكم
                </button>
                <button
                  onClick={() => toast('🚧 قريباً')}
                  className="w-full py-2 px-4 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-sm text-right"
                >
                  🔄 تقديم استئناف
                </button>
                <button
                  onClick={() => toast('🚧 قريباً')}
                  className="w-full py-2 px-4 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 text-sm text-right"
                >
                  ✅ إغلاق القضية
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
