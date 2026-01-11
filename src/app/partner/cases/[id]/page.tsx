'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { 
  Scale, ArrowRight, Calendar, Clock, User, Building2,
  FileText, Plus, Edit, Gavel, MessageSquare, Upload,
  AlertCircle, CheckCircle, Users, Phone, Briefcase
} from 'lucide-react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════
// ⚖️ تفاصيل القضية - الشريك القانوني
// ═══════════════════════════════════════════════════════════════

const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: 'جديدة', color: 'bg-gray-100 text-gray-700' },
  registered: { label: 'مسجلة', color: 'bg-indigo-100 text-indigo-700' },
  active: { label: 'نشطة', color: 'bg-blue-100 text-blue-700' },
  under_consideration: { label: 'منظورة', color: 'bg-blue-100 text-blue-700' },
  postponed: { label: 'مؤجلة', color: 'bg-orange-100 text-orange-700' },
  pleading: { label: 'مرافعة', color: 'bg-purple-100 text-purple-700' },
  pending_judgment: { label: 'بانتظار حكم', color: 'bg-yellow-100 text-yellow-700' },
  awaiting_verdict: { label: 'بانتظار الحكم', color: 'bg-yellow-100 text-yellow-700' },
  judged: { label: 'محكوم فيها', color: 'bg-teal-100 text-teal-700' },
  won: { label: 'كسبناها', color: 'bg-green-100 text-green-700' },
  lost: { label: 'خسرناها', color: 'bg-red-100 text-red-700' },
  appealed: { label: 'مستأنفة', color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'مكتملة', color: 'bg-green-100 text-green-700' },
  closed: { label: 'منتهية', color: 'bg-gray-100 text-gray-700' },
}

const sessionStatusConfig: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'مجدولة', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'مكتملة', color: 'bg-green-100 text-green-700' },
  postponed: { label: 'مؤجلة', color: 'bg-orange-100 text-orange-700' },
  cancelled: { label: 'ملغاة', color: 'bg-red-100 text-red-700' },
}

export default function CaseDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const caseId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [caseData, setCaseData] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [parties, setParties] = useState<any[]>([])

  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'documents' | 'timeline' | 'parties'>('overview')
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)

  const [sessionForm, setSessionForm] = useState({
    session_date: '',
    session_time: '',
    session_type: '',
    location: '',
    court_room: '',
    notes: '',
  })

  useEffect(() => { loadCaseData() }, [caseId])

  const loadCaseData = async () => {
    try {
      const { data: caseResult, error: caseError } = await supabase
        .from('case_management')
        .select(`*, assigned_lawyer:assigned_lawyer_id(id, full_name, email, phone)`)
        .eq('id', caseId)
        .single()

      if (caseError) throw caseError
      setCaseData(caseResult)

      const { data: sessionsData } = await supabase
        .from('case_sessions')
        .select('*')
        .eq('case_id', caseId)
        .order('session_date', { ascending: false })
      setSessions(sessionsData || [])

      const { data: docsData } = await supabase
        .from('case_documents')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
      setDocuments(docsData || [])

      const { data: timelineData } = await supabase
        .from('case_timeline')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(20)
      setTimeline(timelineData || [])

      const { data: partiesData } = await supabase
        .from('case_parties')
        .select('*')
        .eq('case_id', caseId)
        .order('sort_order')
      setParties(partiesData || [])

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const addSession = async () => {
    try {
      if (!sessionForm.session_date) {
        toast.error('يرجى تحديد تاريخ الجلسة')
        return
      }
      const sessionNumber = sessions.length + 1
      const { error } = await supabase.from('case_sessions').insert({
        case_id: caseId,
        session_number: sessionNumber,
        session_date: sessionForm.session_date,
        session_time: sessionForm.session_time || null,
        session_type: sessionForm.session_type || null,
        location: sessionForm.location || null,
        court_room: sessionForm.court_room || null,
        internal_notes: sessionForm.notes || null,
        status: 'scheduled',
      })
      if (error) throw error

      await supabase.from('case_management').update({ next_session_date: sessionForm.session_date }).eq('id', caseId)

      toast.success('✅ تم إضافة الجلسة')
      setShowSessionModal(false)
      setSessionForm({ session_date: '', session_time: '', session_type: '', location: '', court_room: '', notes: '' })
      loadCaseData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ')
    }
  }

  const updateCaseStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase.from('case_management').update({ court_status: newStatus }).eq('id', caseId)
      if (error) throw error

      await supabase.from('case_timeline').insert({
        case_id: caseId,
        activity_type: 'status_changed',
        title: 'تغيير حالة القضية',
        old_value: caseData.court_status,
        new_value: newStatus,
        visible_to_member: true,
      })

      toast.success('✅ تم تحديث الحالة')
      setShowStatusModal(false)
      loadCaseData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  const formatDate = (date: string) => date ? new Date(date).toLocaleDateString('ar-SA') : '-'
  const formatDateTime = (date: string) => date ? new Date(date).toLocaleString('ar-SA') : '-'
  const getStatusBadge = (status: string, config: any) => {
    const c = config[status] || { label: status, color: 'bg-gray-100 text-gray-700' }
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.color}`}>{c.label}</span>
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 mx-auto text-red-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">القضية غير موجودة</h2>
        <Link href="/partner/cases" className="text-blue-600 hover:underline mt-4 inline-block">العودة للقضايا</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg">
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">{caseData.court_case_number || 'قضية جديدة'}</h1>
            {getStatusBadge(caseData.court_status, statusConfig)}
          </div>
          <p className="text-slate-500 mt-1">{caseData.case_type || 'نوع القضية غير محدد'}</p>
        </div>
        <button onClick={() => setShowStatusModal(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2">
          <Edit className="w-4 h-4" />
          تغيير الحالة
        </button>
      </div>

      {/* البطاقات */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            معلومات المحكمة
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">المحكمة</span><span className="text-slate-800 font-medium">{caseData.court_name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">المدينة</span><span className="text-slate-800">{caseData.court_city || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">الدائرة</span><span className="text-slate-800">{caseData.court_circuit || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">القاضي</span><span className="text-slate-800">{caseData.judge_name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">تاريخ القيد</span><span className="text-slate-800">{formatDate(caseData.filing_date)}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            أطراف القضية
          </h3>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-600 mb-1">المدعي</p>
              <p className="font-medium text-slate-800">{caseData.plaintiff_name || '-'}</p>
              {caseData.plaintiff_representative && <p className="text-xs text-slate-500 mt-1">ممثل: {caseData.plaintiff_representative}</p>}
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-xs text-red-600 mb-1">المدعى عليه</p>
              <p className="font-medium text-slate-800">{caseData.defendant_name || '-'}</p>
              {caseData.defendant_representative && <p className="text-xs text-slate-500 mt-1">ممثل: {caseData.defendant_representative}</p>}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-emerald-600" />
            المحامي المكلف
          </h3>
          {caseData.assigned_lawyer ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-lg">{caseData.assigned_lawyer.full_name?.[0] || '؟'}</div>
                <div>
                  <p className="font-medium text-slate-800">{caseData.assigned_lawyer.full_name}</p>
                  <p className="text-sm text-slate-500">{caseData.assigned_lawyer.email}</p>
                </div>
              </div>
              {caseData.assigned_lawyer.phone && <div className="flex items-center gap-2 text-sm text-slate-600"><Phone className="w-4 h-4" />{caseData.assigned_lawyer.phone}</div>}
            </div>
          ) : (
            <div className="text-center py-4 text-slate-500">
              <User className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p>لم يتم تعيين محامي</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex border-b overflow-x-auto">
          {[
            { key: 'overview', label: 'نظرة عامة', icon: Scale },
            { key: 'sessions', label: `الجلسات (${sessions.length})`, icon: Calendar },
            { key: 'documents', label: `المستندات (${documents.length})`, icon: FileText },
            { key: 'timeline', label: 'سجل القضية', icon: Clock },
            { key: 'parties', label: 'الأطراف', icon: Users },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`flex items-center gap-2 px-4 py-3 font-medium whitespace-nowrap border-b-2 transition-all ${activeTab === tab.key ? 'text-blue-600 border-blue-600' : 'text-slate-600 border-transparent hover:text-slate-800'}`}>
              <tab.icon className="w-4 h-4" />{tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {caseData.judgment_date && (
                <div className="p-4 bg-teal-50 rounded-xl border border-teal-200">
                  <h4 className="font-bold text-teal-800 mb-3 flex items-center gap-2"><Gavel className="w-5 h-5" />الحكم</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-teal-600">تاريخ الحكم:</span><span className="text-teal-800 font-medium mr-2">{formatDate(caseData.judgment_date)}</span></div>
                    {caseData.judgment_summary && <div className="col-span-2"><span className="text-teal-600">ملخص الحكم:</span><p className="text-teal-800 mt-1">{caseData.judgment_summary}</p></div>}
                  </div>
                </div>
              )}
              {caseData.next_session_date && new Date(caseData.next_session_date) >= new Date() && (
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                  <h4 className="font-bold text-purple-800 mb-2 flex items-center gap-2"><Calendar className="w-5 h-5" />الجلسة القادمة</h4>
                  <p className="text-purple-700">{formatDate(caseData.next_session_date)}</p>
                </div>
              )}
              {caseData.notes && <div className="p-4 bg-slate-50 rounded-xl"><h4 className="font-medium text-slate-800 mb-2">ملاحظات</h4><p className="text-slate-600">{caseData.notes}</p></div>}
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => setShowSessionModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" />إضافة جلسة</button>
              </div>
              {sessions.length > 0 ? (
                <div className="space-y-3">
                  {sessions.map(session => (
                    <div key={session.id} className="p-4 bg-slate-50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center"><span className="font-bold text-purple-600">{session.session_number}</span></div>
                        <div><p className="font-medium text-slate-800">{formatDate(session.session_date)}</p><p className="text-sm text-slate-500">{session.session_time} {session.session_type && `• ${session.session_type}`}</p></div>
                      </div>
                      {getStatusBadge(session.status, sessionStatusConfig)}
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-8 text-slate-500"><Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>لا توجد جلسات مسجلة</p></div>}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              {documents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documents.map(doc => (
                    <div key={doc.id} className="p-4 bg-slate-50 rounded-xl flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><FileText className="w-5 h-5 text-blue-600" /></div>
                      <div className="flex-1"><p className="font-medium text-slate-800">{doc.title}</p><p className="text-sm text-slate-500">{formatDate(doc.created_at)}</p></div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-8 text-slate-500"><FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>لا توجد مستندات</p></div>}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {timeline.length > 0 ? (
                <div className="relative">
                  <div className="absolute top-0 bottom-0 right-4 w-0.5 bg-slate-200"></div>
                  <div className="space-y-4">
                    {timeline.map(item => (
                      <div key={item.id} className="flex gap-4 relative">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center z-10"><CheckCircle className="w-4 h-4 text-white" /></div>
                        <div className="flex-1 pb-4"><p className="font-medium text-slate-800">{item.title}</p>{item.description && <p className="text-sm text-slate-600 mt-1">{item.description}</p>}<p className="text-xs text-slate-400 mt-2">{formatDateTime(item.created_at)}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <div className="text-center py-8 text-slate-500"><Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>لا يوجد سجل</p></div>}
            </div>
          )}

          {activeTab === 'parties' && (
            <div className="space-y-4">
              {parties.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parties.map(party => (
                    <div key={party.id} className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3 mb-2"><User className="w-5 h-5 text-slate-500" /><span className="font-medium text-slate-800">{party.name}</span></div>
                      <p className="text-sm text-slate-500">{party.party_type}</p>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-8 text-slate-500"><Users className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>لا توجد أطراف إضافية</p></div>}
            </div>
          )}
        </div>
      </div>

      {/* Modal إضافة جلسة */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold text-slate-800">➕ إضافة جلسة</h2></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الجلسة *</label><input type="date" required value={sessionForm.session_date} onChange={(e) => setSessionForm({ ...sessionForm, session_date: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">الوقت</label><input type="time" value={sessionForm.session_time} onChange={(e) => setSessionForm({ ...sessionForm, session_time: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">نوع الجلسة</label><select value={sessionForm.session_type} onChange={(e) => setSessionForm({ ...sessionForm, session_type: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white"><option value="">اختر النوع</option><option value="first_hearing">جلسة أولى</option><option value="hearing">جلسة نظر</option><option value="pleading">مرافعة</option><option value="verdict">حكم</option></select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label><textarea value={sessionForm.notes} onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" rows={3} /></div>
              <div className="flex gap-3 pt-4"><button onClick={() => setShowSessionModal(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg">إلغاء</button><button onClick={addSession} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">إضافة</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Modal تغيير الحالة */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold text-slate-800">تغيير حالة القضية</h2></div>
            <div className="p-6 space-y-2 max-h-[60vh] overflow-y-auto">
              {Object.entries(statusConfig).map(([key, val]) => (
                <button key={key} onClick={() => updateCaseStatus(key)} className={`w-full p-3 text-right rounded-lg border transition-all flex items-center justify-between ${caseData.court_status === key ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${val.color}`}>{val.label}</span>
                  {caseData.court_status === key && <CheckCircle className="w-5 h-5 text-blue-600" />}
                </button>
              ))}
            </div>
            <div className="p-4 border-t"><button onClick={() => setShowStatusModal(false)} className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg">إغلاق</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
