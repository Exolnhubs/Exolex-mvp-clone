'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { FileSignature, ArrowRight, ArrowLeft, Save, Send, X, Loader2, User, Users, FileText, Calendar, DollarSign, ListChecks, CheckCircle, Plus, Trash2, Bot, Upload, Copy } from 'lucide-react'

interface ContractForm {
  title: string
  contract_type: 'platform' | 'external'
  quote_id: string | null
  subscriber_id: string | null
  client_id: string | null
  first_party_info: { name: string; license_number: string; commercial_reg_number: string; national_id: string; phone: string; email: string; address: string; capacity: string }
  second_party_info: { name: string; national_id: string; phone: string; email: string; address: string; capacity: string }
  preamble: string
  scope_of_work: string
  articles: { number: number; title: string; content: string }[]
  start_date: string
  duration_months: number
  auto_renewal: boolean
  renewal_period: number
  contract_value: number
  payment_terms: string
  first_party_obligations: string[]
  second_party_obligations: string[]
  terms_and_conditions: string
  contract_copies: { copy_number: number; holder_type: string; holder_name: string }[]
}

const defaultFirstPartyObligations = [
  'العمل بمهنية عالية وفق أصول المهنة',
  'الحفاظ على سرية البيانات والمعلومات',
  'تنفيذ ما ذكره في عرض الأسعار بأمانة وإخلاص'
]

const defaultSecondPartyObligations = [
  'الالتزام بالرد على الاستفسارات والأسئلة بكل صدق وأمانة',
  'التعاون الكامل مع المحامي',
  'عدم تزويد المحامي بأي معلومات غير دقيقة أو مغلوطة أو إخفاء معلومات مهمة',
  'الالتزام بسداد الدفعات في مواعيدها المحددة',
  'عدم توكيل محامٍ آخر على نفس القضية وإلا يلتزم بدفع كامل المبلغ المتفق عليه'
]

const steps = [
  { id: 1, title: 'الأطراف', icon: Users },
  { id: 2, title: 'التمهيد والنطاق', icon: FileText },
  { id: 3, title: 'المواد والبنود', icon: ListChecks },
  { id: 4, title: 'المدة والتجديد', icon: Calendar },
  { id: 5, title: 'البيانات المالية', icon: DollarSign },
  { id: 6, title: 'الالتزامات', icon: CheckCircle },
  { id: 7, title: 'المراجعة', icon: FileSignature },
]

export default function NewContractPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const source = searchParams.get('source') || 'blank'
  const templateId = searchParams.get('template')
  const quoteId = searchParams.get('quote')

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [partnerId, setPartnerId] = useState<string | null>(null)

  const [form, setForm] = useState<ContractForm>({
    title: '',
    contract_type: 'platform',
    quote_id: null,
    subscriber_id: null,
    client_id: null,
    first_party_info: { name: '', license_number: '', commercial_reg_number: '', national_id: '', phone: '', email: '', address: '', capacity: 'محامي ومستشار قانوني' },
    second_party_info: { name: '', national_id: '', phone: '', email: '', address: '', capacity: 'عميل' },
    preamble: '',
    scope_of_work: '',
    articles: [{ number: 1, title: 'موضوع العقد', content: '' }],
    start_date: new Date().toISOString().split('T')[0],
    duration_months: 12,
    auto_renewal: false,
    renewal_period: 12,
    contract_value: 0,
    payment_terms: '',
    first_party_obligations: [...defaultFirstPartyObligations],
    second_party_obligations: [...defaultSecondPartyObligations],
    terms_and_conditions: '',
    contract_copies: [
      { copy_number: 1, holder_type: 'client', holder_name: '' },
      { copy_number: 2, holder_type: 'lawyer', holder_name: '' }
    ]
  })

  useEffect(() => { loadInitialData() }, [])

  const loadInitialData = async () => {
    try {
      setIsLoading(true)
      const id = localStorage.getItem('exolex_partner_id')
      if (!id) { toast.error('يرجى تسجيل الدخول'); router.push('/auth/partner-login'); return }
      setPartnerId(id)

      const { data: partner } = await supabase.from('partners').select('*').eq('id', id).single()

      if (partner) {
        setForm(prev => ({
          ...prev,
          first_party_info: {
            name: partner.company_name_ar || partner.manager_name || '',
            license_number: partner.license_number || '',
            commercial_reg_number: partner.commercial_reg_number || '',
            national_id: '',
            phone: partner.phone || '',
            email: partner.email || '',
            address: partner.address || '',
            capacity: 'محامي ومستشار قانوني'
          },
          contract_copies: [
            { copy_number: 1, holder_type: 'client', holder_name: '' },
            { copy_number: 2, holder_type: 'lawyer', holder_name: partner.company_name_ar || partner.manager_name || '' }
          ]
        }))
      }

      if (templateId) await loadTemplate(templateId)
      if (quoteId) await loadQuoteData(quoteId)

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally { setIsLoading(false) }
  }

  const loadTemplate = async (id: string) => {
    const { data } = await supabase.from('partner_contracts').select('*').eq('id', id).single()
    if (data) {
      setForm(prev => ({
        ...prev,
        title: data.title || '',
        preamble: data.preamble || '',
        scope_of_work: data.scope_of_work || '',
        articles: data.articles || prev.articles,
        terms_and_conditions: data.terms_and_conditions || '',
        first_party_obligations: data.first_party_obligations || prev.first_party_obligations,
        second_party_obligations: data.second_party_obligations || prev.second_party_obligations,
      }))
      toast.success('تم تحميل النموذج')
    }
  }

  const loadQuoteData = async (id: string) => {
    const { data } = await supabase.from('partner_quotes').select('*, subscriber:subscriber_id (id, user_id)').eq('id', id).single()
    if (data) {
      let userData = null
      if (data.subscriber?.user_id) {
        const { data: user } = await supabase.from('users').select('full_name, phone, email, national_id, address').eq('id', data.subscriber.user_id).single()
        userData = user
      }
      setForm(prev => ({
        ...prev,
        quote_id: data.id,
        subscriber_id: data.subscriber_id,
        title: data.title || '',
        scope_of_work: data.service_description || data.description || '',
        contract_value: data.subtotal || 0,
        payment_terms: data.terms_and_conditions || '',
        second_party_info: {
          ...prev.second_party_info,
          name: userData?.full_name || '',
          phone: userData?.phone || '',
          email: userData?.email || '',
          national_id: userData?.national_id || '',
          address: userData?.address || '',
        },
        contract_copies: [
          { copy_number: 1, holder_type: 'client', holder_name: userData?.full_name || '' },
          { copy_number: 2, holder_type: 'lawyer', holder_name: prev.first_party_info.name }
        ]
      }))
      toast.success('تم تحميل بيانات العرض')
    }
  }

  const updateForm = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }))
  const updateFirstParty = (field: string, value: string) => setForm(prev => ({ ...prev, first_party_info: { ...prev.first_party_info, [field]: value } }))
  const updateSecondParty = (field: string, value: string) => setForm(prev => ({ ...prev, second_party_info: { ...prev.second_party_info, [field]: value } }))

  const addArticle = () => setForm(prev => ({ ...prev, articles: [...prev.articles, { number: prev.articles.length + 1, title: '', content: '' }] }))
  const updateArticle = (index: number, field: string, value: string) => {
    setForm(prev => {
      const newArticles = [...prev.articles]
      newArticles[index] = { ...newArticles[index], [field]: value }
      return { ...prev, articles: newArticles }
    })
  }
  const removeArticle = (index: number) => {
    if (form.articles.length <= 1) return
    setForm(prev => ({ ...prev, articles: prev.articles.filter((_, i) => i !== index).map((a, i) => ({ ...a, number: i + 1 })) }))
  }

  const addObligation = (party: 'first' | 'second') => {
    const field = party === 'first' ? 'first_party_obligations' : 'second_party_obligations'
    setForm(prev => ({ ...prev, [field]: [...prev[field], ''] }))
  }
  const updateObligation = (party: 'first' | 'second', index: number, value: string) => {
    const field = party === 'first' ? 'first_party_obligations' : 'second_party_obligations'
    setForm(prev => { const n = [...prev[field]]; n[index] = value; return { ...prev, [field]: n } })
  }
  const removeObligation = (party: 'first' | 'second', index: number) => {
    const field = party === 'first' ? 'first_party_obligations' : 'second_party_obligations'
    setForm(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }))
  }

  const calculateEndDate = () => {
    if (!form.start_date || !form.duration_months) return ''
    const start = new Date(form.start_date)
    start.setMonth(start.getMonth() + form.duration_months)
    return start.toISOString().split('T')[0]
  }

  const handleSaveDraft = async () => {
    if (!partnerId) return
    try {
      setIsSaving(true)
      const { error } = await supabase.from('partner_contracts').insert({ partner_id: partnerId, ...form, end_date: calculateEndDate(), status: 'draft', is_template: false })
      if (error) throw error
      toast.success('تم حفظ المسودة')
      router.push('/partner/contracts')
    } catch (error) { console.error('Error:', error); toast.error('حدث خطأ في الحفظ') }
    finally { setIsSaving(false) }
  }

  const handleSendForReview = async () => {
    if (!partnerId) return
    if (!form.title || !form.scope_of_work) { toast.error('يرجى تعبئة الحقول المطلوبة'); return }
    try {
      setIsSaving(true)
      const { error } = await supabase.from('partner_contracts').insert({ partner_id: partnerId, ...form, end_date: calculateEndDate(), status: 'pending_review', is_template: false })
      if (error) throw error
      toast.success('تم إرسال العقد للمراجعة')
      router.push('/partner/contracts')
    } catch (error) { console.error('Error:', error); toast.error('حدث خطأ') }
    finally { setIsSaving(false) }
  }

  if (isLoading) {
    return (<div className="min-h-[60vh] flex items-center justify-center"><div className="text-center"><Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" /><p className="text-slate-500">جاري تحميل البيانات...</p></div></div>)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3"><FileSignature className="w-8 h-8 text-blue-600" />إنشاء عقد جديد</h1>
          <p className="text-slate-500 mt-1">{source === 'template' && 'من نموذج جاهز'}{source === 'nolex' && 'بمساعدة NOLEX'}{source === 'upload' && 'من مسودة مرفوعة'}{source === 'blank' && 'نموذج فارغ'}</p>
        </div>
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-6 h-6" /></button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between overflow-x-auto">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button onClick={() => setCurrentStep(step.id)} className={'flex flex-col items-center min-w-[80px] ' + (currentStep === step.id ? 'text-blue-600' : currentStep > step.id ? 'text-green-600' : 'text-slate-400')}>
                <div className={'w-10 h-10 rounded-full flex items-center justify-center mb-1 ' + (currentStep === step.id ? 'bg-blue-100' : currentStep > step.id ? 'bg-green-100' : 'bg-slate-100')}>
                  {currentStep > step.id ? <CheckCircle className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                </div>
                <span className="text-xs whitespace-nowrap">{step.title}</span>
              </button>
              {index < steps.length - 1 && <div className={'w-12 h-0.5 mx-2 ' + (currentStep > step.id ? 'bg-green-300' : 'bg-slate-200')} />}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Users className="w-5 h-5 text-blue-600" />بيانات الأطراف</h2>
            <div className="p-4 bg-blue-50 rounded-xl">
              <h3 className="font-bold text-blue-900 mb-4">الطرف الأول (المحامي/الشريك)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">الاسم</label><input type="text" value={form.first_party_info.name} onChange={(e) => updateFirstParty('name', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">رقم الترخيص</label><input type="text" value={form.first_party_info.license_number} onChange={(e) => updateFirstParty('license_number', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">رقم السجل التجاري</label><input type="text" value={form.first_party_info.commercial_reg_number} onChange={(e) => updateFirstParty('commercial_reg_number', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">الجوال</label><input type="text" value={form.first_party_info.phone} onChange={(e) => updateFirstParty('phone', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني</label><input type="email" value={form.first_party_info.email} onChange={(e) => updateFirstParty('email', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">الصفة</label><input type="text" value={form.first_party_info.capacity} onChange={(e) => updateFirstParty('capacity', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">العنوان</label><input type="text" value={form.first_party_info.address} onChange={(e) => updateFirstParty('address', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" /></div>
              </div>
            </div>
            <div className="p-4 bg-green-50 rounded-xl">
              <h3 className="font-bold text-green-900 mb-4">الطرف الثاني (العميل/المشترك)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">الاسم</label><input type="text" value={form.second_party_info.name} onChange={(e) => updateSecondParty('name', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">رقم الهوية</label><input type="text" value={form.second_party_info.national_id} onChange={(e) => updateSecondParty('national_id', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">الجوال</label><input type="text" value={form.second_party_info.phone} onChange={(e) => updateSecondParty('phone', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني</label><input type="email" value={form.second_party_info.email} onChange={(e) => updateSecondParty('email', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">الصفة</label><input type="text" value={form.second_party_info.capacity} onChange={(e) => updateSecondParty('capacity', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">العنوان</label><input type="text" value={form.second_party_info.address} onChange={(e) => updateSecondParty('address', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" /></div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" />التمهيد ونطاق العمل</h2>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">عنوان العقد <span className="text-red-500">*</span></label><input type="text" value={form.title} onChange={(e) => updateForm('title', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" placeholder="مثال: عقد تقديم خدمات قانونية" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">التمهيد</label><textarea value={form.preamble} onChange={(e) => updateForm('preamble', e.target.value)} rows={4} className="w-full px-4 py-2 border border-slate-200 rounded-lg" placeholder="حيث أن الطرف الأول محامي مرخص... وحيث أن الطرف الثاني يرغب في..." /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">نطاق العمل <span className="text-red-500">*</span></label><textarea value={form.scope_of_work} onChange={(e) => updateForm('scope_of_work', e.target.value)} rows={4} className="w-full px-4 py-2 border border-slate-200 rounded-lg" placeholder="يلتزم الطرف الأول بتقديم الخدمات القانونية التالية..." /></div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><ListChecks className="w-5 h-5 text-blue-600" />المواد والبنود</h2>
              <button onClick={addArticle} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" />إضافة مادة</button>
            </div>
            <div className="space-y-4">
              {form.articles.map((article, index) => (
                <div key={index} className="p-4 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-slate-900">المادة {article.number}</span>
                    {form.articles.length > 1 && <button onClick={() => removeArticle(index)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                  <div className="space-y-3">
                    <input type="text" value={article.title} onChange={(e) => updateArticle(index, 'title', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" placeholder="عنوان المادة" />
                    <textarea value={article.content} onChange={(e) => updateArticle(index, 'content', e.target.value)} rows={3} className="w-full px-4 py-2 border border-slate-200 rounded-lg" placeholder="نص المادة..." />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-600" />مدة العقد والتجديد</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">تاريخ بداية العقد</label><input type="date" value={form.start_date} onChange={(e) => updateForm('start_date', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">مدة العقد (بالأشهر)</label><input type="number" value={form.duration_months} onChange={(e) => updateForm('duration_months', parseInt(e.target.value) || 0)} className="w-full px-4 py-2 border border-slate-200 rounded-lg" min="1" /></div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl"><p className="text-sm text-slate-600"><span className="font-medium">تاريخ انتهاء العقد:</span> {calculateEndDate() ? new Date(calculateEndDate()).toLocaleDateString('ar-SA') : '-'}</p></div>
            <div className="flex items-center gap-3"><input type="checkbox" id="auto_renewal" checked={form.auto_renewal} onChange={(e) => updateForm('auto_renewal', e.target.checked)} className="w-4 h-4 text-blue-600 rounded" /><label htmlFor="auto_renewal" className="text-sm text-slate-700">تجديد تلقائي عند انتهاء المدة</label></div>
            {form.auto_renewal && <div><label className="block text-sm font-medium text-slate-700 mb-1">فترة التجديد (بالأشهر)</label><input type="number" value={form.renewal_period} onChange={(e) => updateForm('renewal_period', parseInt(e.target.value) || 0)} className="w-full max-w-xs px-4 py-2 border border-slate-200 rounded-lg" min="1" /></div>}
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><DollarSign className="w-5 h-5 text-blue-600" />البيانات المالية</h2>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">قيمة العقد (ر.س)</label><input type="number" value={form.contract_value} onChange={(e) => updateForm('contract_value', parseFloat(e.target.value) || 0)} className="w-full max-w-xs px-4 py-2 border border-slate-200 rounded-lg" min="0" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">شروط الدفع</label><textarea value={form.payment_terms} onChange={(e) => updateForm('payment_terms', e.target.value)} rows={4} className="w-full px-4 py-2 border border-slate-200 rounded-lg" placeholder="مثال: دفعة أولى 10% عند التوقيع، 30% عند رفع الدعوى..." /></div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-blue-600" />التزامات الطرفين</h2>
            <div className="p-4 bg-blue-50 rounded-xl">
              <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-blue-900">التزامات الطرف الأول (المحامي)</h3><button onClick={() => addObligation('first')} className="text-sm text-blue-600 hover:underline">+ إضافة</button></div>
              <div className="space-y-2">
                {form.first_party_obligations.map((obligation, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input type="text" value={obligation} onChange={(e) => updateObligation('first', index, e.target.value)} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm" />
                    <button onClick={() => removeObligation('first', index)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 bg-green-50 rounded-xl">
              <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-green-900">التزامات الطرف الثاني (العميل)</h3><button onClick={() => addObligation('second')} className="text-sm text-green-600 hover:underline">+ إضافة</button></div>
              <div className="space-y-2">
                {form.second_party_obligations.map((obligation, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input type="text" value={obligation} onChange={(e) => updateObligation('second', index, e.target.value)} className="flex-1 px-3 py-2 border border-green-200 rounded-lg text-sm" />
                    <button onClick={() => removeObligation('second', index)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">الشروط والأحكام العامة</label><textarea value={form.terms_and_conditions} onChange={(e) => updateForm('terms_and_conditions', e.target.value)} rows={4} className="w-full px-4 py-2 border border-slate-200 rounded-lg" placeholder="أي شروط إضافية..." /></div>
          </div>
        )}

        {currentStep === 7 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><FileSignature className="w-5 h-5 text-blue-600" />مراجعة العقد</h2>
            <div className="p-4 bg-slate-50 rounded-xl space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">عنوان العقد:</span> <span className="font-medium">{form.title || '-'}</span></div>
                <div><span className="text-slate-500">قيمة العقد:</span> <span className="font-medium">{form.contract_value.toLocaleString('ar-SA')} ر.س</span></div>
                <div><span className="text-slate-500">تاريخ البداية:</span> <span className="font-medium">{form.start_date ? new Date(form.start_date).toLocaleDateString('ar-SA') : '-'}</span></div>
                <div><span className="text-slate-500">المدة:</span> <span className="font-medium">{form.duration_months} شهر</span></div>
                <div><span className="text-slate-500">تجديد تلقائي:</span> <span className="font-medium">{form.auto_renewal ? 'نعم' : 'لا'}</span></div>
                <div><span className="text-slate-500">عدد المواد:</span> <span className="font-medium">{form.articles.length}</span></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl"><h3 className="font-bold text-blue-900 mb-2">الطرف الأول</h3><p className="text-sm">{form.first_party_info.name}</p><p className="text-xs text-slate-500">{form.first_party_info.capacity}</p></div>
              <div className="p-4 bg-green-50 rounded-xl"><h3 className="font-bold text-green-900 mb-2">الطرف الثاني</h3><p className="text-sm">{form.second_party_info.name}</p><p className="text-xs text-slate-500">{form.second_party_info.capacity}</p></div>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <h3 className="font-bold text-amber-900 mb-2">نسخ العقد</h3>
              <p className="text-sm text-amber-800">يتكون هذا العقد من نسختين:</p>
              <ul className="text-sm text-amber-800 mt-2 space-y-1">
                <li>• النسخة رقم 1: للعميل/المشترك ({form.second_party_info.name || '...'})</li>
                <li>• النسخة رقم 2: للمحامي/الشريك ({form.first_party_info.name || '...'})</li>
              </ul>
              <p className="text-xs text-amber-600 mt-2">تاريخ إنشاء العقد: {new Date().toLocaleDateString('ar-SA')}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
          <button onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))} disabled={currentStep === 1} className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"><ArrowRight className="w-4 h-4" />السابق</button>
          <div className="flex items-center gap-3">
            <button onClick={handleSaveDraft} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}حفظ كمسودة</button>
            {currentStep === 7 ? (
              <button onClick={handleSendForReview} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}إرسال للمراجعة</button>
            ) : (
              <button onClick={() => setCurrentStep(prev => Math.min(7, prev + 1))} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">التالي<ArrowLeft className="w-4 h-4" /></button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
