'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getLegalArmId } from '@/lib/cookies'

// ═══════════════════════════════════════════════════════════════
// 🏛️ صفحة ملف الذراع القانوني
// 📅 تاريخ: 4 يناير 2026
// ═══════════════════════════════════════════════════════════════
// ⚠️ الحقول المحمية (تحتاج خطاب رسمي):
// - اسم الذراع (عربي/إنجليزي)
// - رقم الترخيص
// - اسم المدير / هوية المدير
// - المعلومات البنكية
// ═══════════════════════════════════════════════════════════════

export default function LegalArmProfilePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [lawyers, setLawyers] = useState<any[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [showChangeRequest, setShowChangeRequest] = useState(false)
  const [changeRequestField, setChangeRequestField] = useState('')
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

  // ─────────────────────────────────────────────────────────────
  // رفع الشعار
  // ─────────────────────────────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // التحقق من نوع الملف
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة')
      return
    }
    
    // التحقق من الحجم (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن يكون أقل من 2MB')
      return
    }
    
    setIsUploadingLogo(true)
    
    try {
      const legalArmId = getLegalArmId()
      const fileName = `legal_arm_${legalArmId}_${Date.now()}.${file.name.split('.').pop()}`
      
      // رفع الملف إلى Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, { upsert: true })
      
      if (uploadError) {
        console.error('Upload error:', uploadError)
        toast.error('فشل رفع الشعار')
        return
      }
      
      // الحصول على الرابط العام
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName)
      
      // تحديث الجدول
      const { error: updateError } = await supabase
        .from('legal_arms')
        .update({ logo_url: publicUrl })
        .eq('id', legalArmId)
      
      if (updateError) {
        console.error('Update error:', updateError)
        toast.error('فشل تحديث الشعار')
        return
      }
      
      // تحديث الـ state
      setProfile({ ...profile, logo_url: publicUrl })
      toast.success('تم تحديث الشعار بنجاح')
      
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ غير متوقع')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // الحقول القابلة للتعديل
  // ─────────────────────────────────────────────────────────────
  const [editableFields, setEditableFields] = useState({
    phone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    description_ar: '',
    description_en: '',
    working_hours: '',
    social_twitter: '',
    social_linkedin: ''
  })

  useEffect(() => { loadData() }, [])

  // ─────────────────────────────────────────────────────────────
  // تحميل البيانات
  // ─────────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      setIsLoading(true)
      const legalArmId = getLegalArmId()

      if (!legalArmId) {
        toast.error('يرجى تسجيل الدخول')
        router.push('/auth/legal-arm-login')
        return
      }

      // جلب بيانات الذراع
      const { data: armData, error } = await supabase
        .from('legal_arms')
        .select('*')
        .eq('id', legalArmId)
        .single()

      if (error) throw error
      setProfile(armData)

      // تعبئة الحقول القابلة للتعديل
      setEditableFields({
        phone: armData?.phone?.replace('+966', '') || '',
        email: armData?.email || '',
        website: armData?.website || '',
        address: armData?.address || '',
        city: armData?.city || '',
        description_ar: armData?.description_ar || '',
        description_en: armData?.description_en || '',
        working_hours: armData?.working_hours || '',
        social_twitter: armData?.social_twitter || '',
        social_linkedin: armData?.social_linkedin || ''
      })

      // جلب المحامين
      const { data: lawyersData } = await supabase
        .from('lawyers')
        .select('id, full_name, lawyer_code, status')
        .eq('legal_arm_id', legalArmId)
        .eq('status', 'active')

      setLawyers(lawyersData || [])

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // حفظ التغييرات
  // ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      setIsSaving(true)
      const legalArmId = getLegalArmId()

      const updateData = {
        phone: editableFields.phone ? '+966' + editableFields.phone : null,
        email: editableFields.email || null,
        website: editableFields.website || null,
        address: editableFields.address || null,
        city: editableFields.city || null,
        description_ar: editableFields.description_ar || null,
        description_en: editableFields.description_en || null,
        working_hours: editableFields.working_hours || null,
        social_twitter: editableFields.social_twitter || null,
        social_linkedin: editableFields.social_linkedin || null,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('legal_arms')
        .update(updateData)
        .eq('id', legalArmId)

      if (error) throw error

      toast.success('تم حفظ التغييرات بنجاح')
      setIsEditing(false)
      loadData()

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في حفظ البيانات')
    } finally {
      setIsSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // طلب تغيير حقل محمي
  // ─────────────────────────────────────────────────────────────
  const handleChangeRequest = (fieldName: string) => {
    setChangeRequestField(fieldName)
    setShowChangeRequest(true)
  }

  // ─────────────────────────────────────────────────────────────
  // العرض - التحميل
  // ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // العرض - لم يتم العثور
  // ─────────────────────────────────────────────────────────────
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-xl text-slate-600">لم يتم العثور على الملف</p>
          <button 
            onClick={() => router.push('/auth/legal-arm-login')}
            className="mt-4 px-6 py-2 bg-purple-500 text-white rounded-lg"
          >
            تسجيل الدخول
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6" dir="rtl">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* العنوان */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <span className="text-2xl">🏛️</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">ملف الذراع</h1>
            <p className="text-slate-500">إدارة بيانات الذراع القانوني</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
              >
                {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
            >
              تعديل البيانات
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* البطاقة الرئيسية */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            {/* الشعار مع زر التغيير */}
            <div className="text-center mb-6">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <div className="w-24 h-24 bg-purple-100 rounded-2xl flex items-center justify-center overflow-hidden">
                  {isUploadingLogo ? (
                    <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
                  ) : profile.logo_url ? (
                    <img src={profile.logo_url} alt="Logo" className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    <span className="text-4xl">🏛️</span>
                  )}
                </div>
                {/* زر تغيير الشعار */}
                <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#1e3a5f] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#2a4a6f] transition-colors shadow-lg">
                  <span className="text-white text-sm">📷</span>
                  <input 
                    type="file" 
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                    className="hidden" 
                  />
                </label>
              </div>
              <h2 className="text-xl font-bold text-slate-800">{profile.name_ar}</h2>
              {profile.name_en && <p className="text-slate-500">{profile.name_en}</p>}
              <span className="inline-block mt-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-mono">
                {profile.arm_code}
              </span>
            </div>

            {/* معلومات أساسية */}
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-3 text-slate-600">
                <span>📄</span>
                <span>رقم الترخيص: {profile.license_number}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <span>📱</span>
                <span>{profile.phone}</span>
              </div>
              {profile.email && (
                <div className="flex items-center gap-3 text-slate-600">
                  <span>📧</span>
                  <span>{profile.email}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span>📊</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  profile.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {profile.status === 'active' ? 'نشط' : 'غير نشط'}
                </span>
              </div>
            </div>

            {/* إحصائيات */}
            <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-slate-100">
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-600">{lawyers.length}</p>
                <p className="text-xs text-slate-500">المحامين</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">0</p>
                <p className="text-xs text-slate-500">القضايا</p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* البيانات التفصيلية */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-6">
          {/* الحقول المحمية */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span>🔒</span>
              <span>البيانات المحمية</span>
            </h3>
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg mb-4">
              ⚠️ هذه البيانات محمية وتحتاج خطاب رسمي لتغييرها
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">اسم الذراع (عربي)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={profile.name_ar || ''}
                    disabled
                    className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 text-slate-600"
                  />
                  <button
                    onClick={() => handleChangeRequest('اسم الذراع بالعربي')}
                    className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg"
                    title="طلب تغيير"
                  >
                    ✏️
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">اسم الذراع (إنجليزي)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={profile.name_en || ''}
                    disabled
                    className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 text-slate-600"
                    dir="ltr"
                  />
                  <button
                    onClick={() => handleChangeRequest('اسم الذراع بالإنجليزي')}
                    className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg"
                    title="طلب تغيير"
                  >
                    ✏️
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">رقم الترخيص</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={profile.license_number || ''}
                    disabled
                    className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 text-slate-600"
                    dir="ltr"
                  />
                  <button
                    onClick={() => handleChangeRequest('رقم الترخيص')}
                    className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg"
                    title="طلب تغيير"
                  >
                    ✏️
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">اسم المدير</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={profile.manager_name || ''}
                    disabled
                    className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 text-slate-600"
                  />
                  <button
                    onClick={() => handleChangeRequest('اسم المدير')}
                    className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg"
                    title="طلب تغيير"
                  >
                    ✏️
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* الحقول القابلة للتعديل */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span>📝</span>
              <span>بيانات التواصل</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">رقم الجوال</label>
                <div className="flex gap-2">
                  <span className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-500">+966</span>
                  <input
                    type="text"
                    value={editableFields.phone}
                    onChange={(e) => setEditableFields({...editableFields, phone: e.target.value.replace(/\D/g, '')})}
                    disabled={!isEditing}
                    className="flex-1 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 disabled:bg-slate-50"
                    dir="ltr"
                    maxLength={9}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={editableFields.email}
                  onChange={(e) => setEditableFields({...editableFields, email: e.target.value})}
                  disabled={!isEditing}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 disabled:bg-slate-50"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الموقع الإلكتروني</label>
                <input
                  type="url"
                  value={editableFields.website}
                  onChange={(e) => setEditableFields({...editableFields, website: e.target.value})}
                  disabled={!isEditing}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 disabled:bg-slate-50"
                  dir="ltr"
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">المدينة</label>
                <input
                  type="text"
                  value={editableFields.city}
                  onChange={(e) => setEditableFields({...editableFields, city: e.target.value})}
                  disabled={!isEditing}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 disabled:bg-slate-50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">العنوان</label>
                <input
                  type="text"
                  value={editableFields.address}
                  onChange={(e) => setEditableFields({...editableFields, address: e.target.value})}
                  disabled={!isEditing}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 disabled:bg-slate-50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">نبذة عن الذراع</label>
                <textarea
                  value={editableFields.description_ar}
                  onChange={(e) => setEditableFields({...editableFields, description_ar: e.target.value})}
                  disabled={!isEditing}
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>

          {/* المحامين */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span>👨‍⚖️</span>
              <span>المحامين ({lawyers.length})</span>
            </h3>
            {lawyers.length === 0 ? (
              <p className="text-slate-400 text-center py-4">لا يوجد محامين</p>
            ) : (
              <div className="space-y-2">
                {lawyers.map((lawyer) => (
                  <div key={lawyer.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <span>👨‍⚖️</span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{lawyer.full_name}</p>
                        <p className="text-sm text-slate-500 font-mono">{lawyer.lawyer_code}</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">نشط</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* نافذة طلب التغيير */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showChangeRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">طلب تغيير بيانات محمية</h3>
            <p className="text-slate-600 mb-4">
              لتغيير <strong>{changeRequestField}</strong>، يرجى إرسال خطاب رسمي عبر البريد الإلكتروني:
            </p>
            <div className="bg-slate-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-slate-600 mb-2">📧 البريد: support@exolex.sa</p>
              <p className="text-sm text-slate-600">📄 مع إرفاق المستندات الداعمة</p>
            </div>
            <button
              onClick={() => setShowChangeRequest(false)}
              className="w-full py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
            >
              فهمت
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
