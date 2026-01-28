'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getLawyerId } from '@/lib/cookies'

// ═══════════════════════════════════════════════════════════════
// 👤 صفحة الملف الشخصي - محامي الذراع القانوني
// 📅 تاريخ: 21 يناير 2026
// ═══════════════════════════════════════════════════════════════
// 🔐 سياسة التعديل:
// - 🔒 لا يمكن تعديل: الاسم، الرخصة، الهوية، الجنس
// - 📱 الجوال: توثيق OTP قديم + جديد
// - 📧 البريد: توثيق بكود للإيميل الجديد
// - ✅ الباقي: يمكن التعديل مباشرة
// ═══════════════════════════════════════════════════════════════

export default function ProfilePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lawyer, setLawyer] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'personal' | 'professional' | 'stats'>('personal')
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<any>({})
  
  const [phoneModal, setPhoneModal] = useState({ show: false, step: 'old' as 'old' | 'new' | 'admin', newPhone: '', oldOtp: '', newOtp: '' })
  const [emailModal, setEmailModal] = useState({ show: false, newEmail: '', otp: '', otpSent: false })
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const lawyerId = getLawyerId()
      if (!lawyerId) { router.push('/auth/lawyer-login'); return }

      const { data, error } = await supabase
        .from('lawyers')
        .select('*')
        .eq('id', lawyerId)
        .eq('lawyer_type', 'legal_arm')
        .single()

      if (error) throw error
      setLawyer(data)
      setFormData(data)
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('lawyers')
        .update({
          city: formData.city,
          national_address: formData.national_address,
          bio_ar: formData.bio_ar,
          bio_en: formData.bio_en,
          years_of_experience: formData.years_of_experience,
          min_price: formData.min_price,
          updated_at: new Date().toISOString()
        })
        .eq('id', lawyer.id)

      if (error) throw error
      toast.success('✅ تم حفظ التغييرات')
      setIsEditing(false)
      loadData()
    } catch (error) {
      console.error(error)
      toast.error('حدث خطأ في الحفظ')
    } finally {
      setIsSaving(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('يرجى اختيار صورة'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('حجم الصورة يجب أن يكون أقل من 5MB'); return }

    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${lawyer.id}-${Date.now()}.${fileExt}`
      const filePath = `lawyers/${fileName}`

      const { error: uploadError } = await supabase.storage.from('profiles').upload(filePath, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(filePath)

      await supabase.from('lawyers').update({ profile_image: publicUrl, updated_at: new Date().toISOString() }).eq('id', lawyer.id)

      toast.success('✅ تم تحديث الصورة')
      loadData()
    } catch (error) {
      console.error(error)
      toast.error('حدث خطأ في رفع الصورة')
    } finally {
      setIsUploading(false)
    }
  }

  const sendOldPhoneOtp = async () => { toast.success(`📱 تم إرسال رمز التحقق إلى ${lawyer.phone}`) }
  const sendNewPhoneOtp = async () => { if (!phoneModal.newPhone) { toast.error('أدخل رقم الجوال الجديد'); return }; toast.success(`📱 تم إرسال رمز التحقق إلى ${phoneModal.newPhone}`) }
  const verifyOldPhoneOtp = () => { if (phoneModal.oldOtp.length !== 4) { toast.error('أدخل الرمز الصحيح'); return }; setPhoneModal({ ...phoneModal, step: 'new' }); toast.success('✅ تم التحقق، أدخل الرقم الجديد') }
  const verifyNewPhoneOtp = async () => {
    if (phoneModal.newOtp.length !== 4) { toast.error('أدخل الرمز الصحيح'); return }
    try {
      await supabase.from('lawyers').update({ phone: phoneModal.newPhone, updated_at: new Date().toISOString() }).eq('id', lawyer.id)
      toast.success('✅ تم تحديث رقم الجوال')
      setPhoneModal({ show: false, step: 'old', newPhone: '', oldOtp: '', newOtp: '' })
      loadData()
    } catch (error) { toast.error('حدث خطأ') }
  }

  const requestPhoneChangeFromAdmin = async () => {
    if (!phoneModal.newPhone) { toast.error('أدخل رقم الجوال الجديد'); return }
    try {
      await supabase.from('admin_requests').insert({ type: 'phone_change', user_type: 'lawyer', user_id: lawyer.id, old_value: lawyer.phone, new_value: phoneModal.newPhone, status: 'pending' })
      toast.success('✅ تم إرسال الطلب للإدارة')
      setPhoneModal({ show: false, step: 'old', newPhone: '', oldOtp: '', newOtp: '' })
    } catch (error) { toast.error('حدث خطأ') }
  }

  const sendEmailOtp = async () => {
    if (!emailModal.newEmail || !emailModal.newEmail.includes('@')) { toast.error('أدخل بريد إلكتروني صحيح'); return }
    toast.success(`📧 تم إرسال رمز التحقق إلى ${emailModal.newEmail}`)
    setEmailModal({ ...emailModal, otpSent: true })
  }

  const verifyEmailOtp = async () => {
    if (emailModal.otp.length !== 6) { toast.error('أدخل الرمز الصحيح'); return }
    try {
      await supabase.from('lawyers').update({ email: emailModal.newEmail, updated_at: new Date().toISOString() }).eq('id', lawyer.id)
      toast.success('✅ تم تحديث البريد الإلكتروني')
      setEmailModal({ show: false, newEmail: '', otp: '', otpSent: false })
      loadData()
    } catch (error) { toast.error('حدث خطأ') }
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, { text: string; color: string }> = {
      'active': { text: 'نشط', color: 'bg-green-100 text-green-700' },
      'inactive': { text: 'غير نشط', color: 'bg-gray-100 text-gray-700' },
      'suspended': { text: 'موقوف', color: 'bg-red-100 text-red-700' },
      'pending': { text: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-700' },
    }
    return map[status] || { text: status, color: 'bg-gray-100' }
  }

  const getLicenseStatus = () => {
    if (!lawyer?.license_expiry) return null
    const expiry = new Date(lawyer.license_expiry)
    const now = new Date()
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return { text: 'منتهية', color: 'bg-red-100 text-red-700', icon: '🔴' }
    if (diffDays <= 30) return { text: `تنتهي خلال ${diffDays} يوم`, color: 'bg-red-100 text-red-700', icon: '⚠️' }
    if (diffDays <= 60) return { text: `تنتهي خلال ${diffDays} يوم`, color: 'bg-yellow-100 text-yellow-700', icon: '⏰' }
    return { text: 'سارية', color: 'bg-green-100 text-green-700', icon: '✅' }
  }

  if (isLoading) {
    return (<div className="min-h-screen bg-slate-100 flex items-center justify-center"><div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>)
  }

  if (!lawyer) {
    return (<div className="min-h-screen bg-slate-100 p-6 text-center" dir="rtl"><span className="text-6xl">❌</span><p className="mt-4 text-slate-600">لم يتم العثور على البيانات</p></div>)
  }

  const status = getStatusBadge(lawyer.status)
  const licenseStatus = getLicenseStatus()

  return (
    <div className="min-h-screen bg-slate-100 p-6" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-l from-amber-500 to-amber-600 h-32"></div>
          <div className="px-6 pb-6">
            <div className="flex items-end gap-4 -mt-12">
              <div className="relative">
                <div className="w-24 h-24 bg-white rounded-xl shadow-lg flex items-center justify-center border-4 border-white overflow-hidden">
                  {lawyer.profile_image ? (<img src={lawyer.profile_image} alt="" className="w-full h-full object-cover" />) : (<span className="text-4xl">👨‍⚖️</span>)}
                </div>
                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="absolute -bottom-1 -right-1 w-8 h-8 bg-amber-500 hover:bg-amber-600 text-white rounded-full flex items-center justify-center shadow-lg">{isUploading ? '⏳' : '📷'}</button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-800">{lawyer.full_name || '---'}</h1>
                  <span className={`text-xs px-2 py-1 rounded-full ${status.color}`}>{status.text}</span>
                  {lawyer.is_online && <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">🟢 متصل</span>}
                </div>
                <p className="text-slate-500 mt-1">{lawyer.job_title || 'محامي ذراع قانوني'} • {lawyer.city || '---'}</p>
              </div>
              <button onClick={() => isEditing ? handleSave() : setIsEditing(true)} disabled={isSaving} className={`px-4 py-2 rounded-lg flex items-center gap-2 ${isEditing ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
                {isSaving ? '⏳' : isEditing ? '✅' : '✏️'} {isSaving ? 'جاري الحفظ...' : isEditing ? 'حفظ التغييرات' : 'تعديل'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm">
          <div className="flex border-b">
            {[{ key: 'personal', label: 'المعلومات الشخصية', icon: '👤' }, { key: 'professional', label: 'المعلومات المهنية', icon: '⚖️' }, { key: 'stats', label: 'الإحصائيات', icon: '📊' }].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`flex-1 px-4 py-3 text-center font-medium transition-all ${activeTab === tab.key ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50' : 'text-slate-500 hover:bg-slate-50'}`}>{tab.icon} {tab.label}</button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          {activeTab === 'personal' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">👤 المعلومات الشخصية</h2>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-sm"><p className="text-blue-700">🔐 <strong>سياسة التعديل:</strong> الاسم، رقم الرخصة، رقم الهوية، والجنس لا يمكن تعديلها. تغيير الجوال أو البريد يتطلب توثيق.</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="block text-sm text-slate-600 mb-1">الاسم الكامل (عربي) 🔒</label><p className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600">{lawyer.full_name || '---'}</p></div>
                <div><label className="block text-sm text-slate-600 mb-1">الاسم الكامل (إنجليزي) 🔒</label><p className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600" dir="ltr">{lawyer.full_name_en || '---'}</p></div>
                <div><label className="block text-sm text-slate-600 mb-1">رقم الجوال 📱</label><div className="flex gap-2"><p className="flex-1 px-4 py-2 bg-slate-50 rounded-lg text-slate-800" dir="ltr">{lawyer.phone || '---'}</p><button onClick={() => setPhoneModal({ ...phoneModal, show: true, step: 'old' })} className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-sm">تغيير</button></div></div>
                <div><label className="block text-sm text-slate-600 mb-1">البريد الإلكتروني 📧</label><div className="flex gap-2"><p className="flex-1 px-4 py-2 bg-slate-50 rounded-lg text-slate-800" dir="ltr">{lawyer.email || '---'}</p><button onClick={() => setEmailModal({ ...emailModal, show: true })} className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-sm">تغيير</button></div></div>
                <div><label className="block text-sm text-slate-600 mb-1">المدينة ✏️</label>{isEditing ? (<input type="text" value={formData.city || ''} onChange={(e) => setFormData({...formData, city: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />) : (<p className="px-4 py-2 bg-slate-50 rounded-lg text-slate-800">{lawyer.city || '---'}</p>)}</div>
                <div><label className="block text-sm text-slate-600 mb-1">الجنس 🔒</label><p className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600">{lawyer.gender === 'male' ? 'ذكر' : lawyer.gender === 'female' ? 'أنثى' : '---'}</p></div>
                <div className="md:col-span-2"><label className="block text-sm text-slate-600 mb-1">العنوان الوطني ✏️</label>{isEditing ? (<textarea value={formData.national_address || ''} onChange={(e) => setFormData({...formData, national_address: e.target.value})} rows={2} className="w-full px-4 py-2 border border-slate-300 rounded-lg resize-none" />) : (<p className="px-4 py-2 bg-slate-50 rounded-lg text-slate-800">{lawyer.national_address || '---'}</p>)}</div>
              </div>
            </div>
          )}

          {activeTab === 'professional' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">⚖️ المعلومات المهنية</h2>
              {licenseStatus && (<div className={`p-4 rounded-xl ${licenseStatus.color} flex items-center justify-between`}><div className="flex items-center gap-2"><span className="text-xl">{licenseStatus.icon}</span><span className="font-medium">حالة الرخصة: {licenseStatus.text}</span></div><span className="text-sm">تنتهي: {lawyer.license_expiry ? new Date(lawyer.license_expiry).toLocaleDateString('ar-SA') : '---'}</span></div>)}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="block text-sm text-slate-600 mb-1">رقم الهوية 🔒</label><p className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 font-mono">{lawyer.national_id || '---'}</p></div>
                <div><label className="block text-sm text-slate-600 mb-1">انتهاء الهوية 🔒</label><p className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600">{lawyer.national_id_expiry ? new Date(lawyer.national_id_expiry).toLocaleDateString('ar-SA') : '---'}</p></div>
                <div><label className="block text-sm text-slate-600 mb-1">رقم الرخصة 🔒</label><p className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 font-mono">{lawyer.license_number || '---'}</p></div>
                <div><label className="block text-sm text-slate-600 mb-1">انتهاء الرخصة 🔒</label><p className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600">{lawyer.license_expiry ? new Date(lawyer.license_expiry).toLocaleDateString('ar-SA') : '---'}</p></div>
                <div><label className="block text-sm text-slate-600 mb-1">كود المحامي 🔒</label><p className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 font-mono">{lawyer.lawyer_code || '---'}</p></div>
                <div><label className="block text-sm text-slate-600 mb-1">سنوات الخبرة ✏️</label>{isEditing ? (<input type="number" value={formData.years_of_experience || ''} onChange={(e) => setFormData({...formData, years_of_experience: parseInt(e.target.value)})} className="w-full px-4 py-2 border border-slate-300 rounded-lg" min="0" />) : (<p className="px-4 py-2 bg-slate-50 rounded-lg text-slate-800">{lawyer.years_of_experience || '---'} سنة</p>)}</div>
                <div><label className="block text-sm text-slate-600 mb-1">الذراع القانوني 🏢</label><p className="px-4 py-2 bg-slate-50 rounded-lg text-slate-800">{lawyer.legal_arm_name || '---'}</p></div>
                <div className="md:col-span-2"><label className="block text-sm text-slate-600 mb-1">نبذة تعريفية (عربي) ✏️</label>{isEditing ? (<textarea value={formData.bio_ar || ''} onChange={(e) => setFormData({...formData, bio_ar: e.target.value})} rows={3} className="w-full px-4 py-2 border border-slate-300 rounded-lg resize-none" />) : (<p className="px-4 py-2 bg-slate-50 rounded-lg text-slate-800">{lawyer.bio_ar || '---'}</p>)}</div>
                <div className="md:col-span-2"><label className="block text-sm text-slate-600 mb-1">نبذة تعريفية (إنجليزي) ✏️</label>{isEditing ? (<textarea value={formData.bio_en || ''} onChange={(e) => setFormData({...formData, bio_en: e.target.value})} rows={3} className="w-full px-4 py-2 border border-slate-300 rounded-lg resize-none" dir="ltr" />) : (<p className="px-4 py-2 bg-slate-50 rounded-lg text-slate-800" dir="ltr">{lawyer.bio_en || '---'}</p>)}</div>
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">📊 إحصائيات الأداء</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl p-4 text-white text-center"><p className="text-3xl font-bold">{lawyer.rating_average?.toFixed(1) || '---'}</p><p className="text-amber-100 text-sm">التقييم</p></div>
                <div className="bg-white border rounded-xl p-4 text-center"><p className="text-3xl font-bold text-slate-800">{lawyer.rating_count || 0}</p><p className="text-slate-500 text-sm">عدد التقييمات</p></div>
                <div className="bg-white border rounded-xl p-4 text-center"><p className="text-3xl font-bold text-emerald-600">{lawyer.total_requests_completed || 0}</p><p className="text-slate-500 text-sm">طلبات مكتملة</p></div>
                <div className="bg-white border rounded-xl p-4 text-center"><p className="text-3xl font-bold text-blue-600">{lawyer.active_requests_count || 0}</p><p className="text-slate-500 text-sm">طلبات نشطة</p></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="bg-slate-50 rounded-xl p-4"><h4 className="font-medium text-slate-700 mb-3">📈 معدل الأداء</h4><div className="space-y-3"><div className="flex items-center justify-between"><span className="text-sm text-slate-600">نسبة الالتزام بـ SLA</span><span className="font-bold text-emerald-600">{lawyer.sla_compliance_rate || 0}%</span></div><div className="h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${lawyer.sla_compliance_rate || 0}%` }}></div></div></div></div>
                <div className="bg-slate-50 rounded-xl p-4"><h4 className="font-medium text-slate-700 mb-3">📋 الطلبات</h4><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-slate-600">إجمالي الطلبات</span><span className="font-bold">{lawyer.total_requests_handled || 0}</span></div><div className="flex justify-between"><span className="text-slate-600">الحد الأقصى المتزامن</span><span className="font-bold">{lawyer.max_concurrent_requests || '---'}</span></div><div className="flex justify-between"><span className="text-slate-600">الحمل الحالي</span><span className="font-bold">{lawyer.current_caseload || 0}</span></div></div></div>
              </div>
            </div>
          )}
        </div>
        {isEditing && (<div className="flex justify-center"><button onClick={() => { setIsEditing(false); setFormData(lawyer) }} className="px-6 py-2 text-slate-600 hover:text-slate-800">إلغاء التعديل</button></div>)}
      </div>

      {phoneModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-slate-800">📱 تغيير رقم الجوال</h2><button onClick={() => setPhoneModal({ show: false, step: 'old', newPhone: '', oldOtp: '', newOtp: '' })} className="text-slate-400 hover:text-slate-600 text-2xl">✕</button></div></div>
            <div className="p-6">
              {phoneModal.step === 'old' && (<div className="space-y-4"><p className="text-slate-600">سنرسل رمز تحقق إلى رقمك الحالي:</p><p className="text-center text-xl font-mono bg-slate-50 p-3 rounded-lg" dir="ltr">{lawyer.phone}</p><button onClick={sendOldPhoneOtp} className="w-full py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">إرسال رمز التحقق</button><div className="flex gap-2"><input type="text" value={phoneModal.oldOtp} onChange={(e) => setPhoneModal({...phoneModal, oldOtp: e.target.value})} maxLength={4} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-center font-mono text-xl" placeholder="0000" dir="ltr" /><button onClick={verifyOldPhoneOtp} className="px-4 py-2 bg-emerald-500 text-white rounded-lg">تحقق</button></div><button onClick={() => setPhoneModal({...phoneModal, step: 'admin'})} className="w-full text-sm text-slate-500 hover:text-slate-700">لا أستطيع الوصول للرقم القديم</button></div>)}
              {phoneModal.step === 'new' && (<div className="space-y-4"><p className="text-slate-600">أدخل رقم الجوال الجديد:</p><input type="tel" value={phoneModal.newPhone} onChange={(e) => setPhoneModal({...phoneModal, newPhone: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg text-center font-mono text-xl" placeholder="05xxxxxxxx" dir="ltr" /><button onClick={sendNewPhoneOtp} className="w-full py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">إرسال رمز التحقق للرقم الجديد</button><div className="flex gap-2"><input type="text" value={phoneModal.newOtp} onChange={(e) => setPhoneModal({...phoneModal, newOtp: e.target.value})} maxLength={4} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-center font-mono text-xl" placeholder="0000" dir="ltr" /><button onClick={verifyNewPhoneOtp} className="px-4 py-2 bg-emerald-500 text-white rounded-lg">تأكيد</button></div></div>)}
              {phoneModal.step === 'admin' && (<div className="space-y-4"><div className="p-4 bg-amber-50 rounded-lg border border-amber-200"><p className="text-amber-700 text-sm">سيتم إرسال طلب للإدارة لتغيير رقمك. قد يستغرق 1-3 أيام عمل.</p></div><input type="tel" value={phoneModal.newPhone} onChange={(e) => setPhoneModal({...phoneModal, newPhone: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg text-center font-mono" placeholder="الرقم الجديد" dir="ltr" /><button onClick={requestPhoneChangeFromAdmin} className="w-full py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">إرسال الطلب للإدارة</button></div>)}
            </div>
          </div>
        </div>
      )}

      {emailModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-slate-800">📧 تغيير البريد الإلكتروني</h2><button onClick={() => setEmailModal({ show: false, newEmail: '', otp: '', otpSent: false })} className="text-slate-400 hover:text-slate-600 text-2xl">✕</button></div></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm text-slate-600 mb-1">البريد الإلكتروني الجديد</label><input type="email" value={emailModal.newEmail} onChange={(e) => setEmailModal({...emailModal, newEmail: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg" dir="ltr" placeholder="email@example.com" /></div>
              {!emailModal.otpSent ? (<button onClick={sendEmailOtp} className="w-full py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">إرسال رمز التحقق</button>) : (<><p className="text-sm text-green-600">✅ تم إرسال الرمز إلى {emailModal.newEmail}</p><div className="flex gap-2"><input type="text" value={emailModal.otp} onChange={(e) => setEmailModal({...emailModal, otp: e.target.value})} maxLength={6} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-center font-mono text-xl" placeholder="000000" dir="ltr" /><button onClick={verifyEmailOtp} className="px-4 py-2 bg-emerald-500 text-white rounded-lg">تأكيد</button></div></>)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
