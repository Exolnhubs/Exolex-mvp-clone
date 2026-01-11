'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

const SAUDI_CITIES = [
  'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام',
  'الخبر', 'الظهران', 'الأحساء', 'الطائف', 'تبوك',
  'بريدة', 'خميس مشيط', 'حائل', 'نجران', 'جازان',
  'الجبيل', 'ينبع', 'أبها', 'عرعر', 'سكاكا'
]

const SAUDI_BANKS = [
  'البنك الأهلي السعودي', 'بنك الراجحي', 'بنك الرياض',
  'البنك السعودي الفرنسي', 'البنك السعودي البريطاني (ساب)',
  'البنك العربي الوطني', 'بنك البلاد', 'بنك الجزيرة',
  'بنك الإنماء', 'بنك الاستثمار السعودي'
]

const LANGUAGES = [
  { code: 'ar', name: 'العربية' },
  { code: 'en', name: 'الإنجليزية' },
  { code: 'fr', name: 'الفرنسية' },
  { code: 'ur', name: 'الأردية' },
  { code: 'hi', name: 'الهندية' },
  { code: 'tl', name: 'الفلبينية' },
  { code: 'bn', name: 'البنغالية' }
]

// ═══════════════════════════════════════════════════════════════
// 🌐 ترجمة رسائل الأخطاء للعربية
// ═══════════════════════════════════════════════════════════════
const translateError = (error: any): string => {
  const message = error?.message || error?.toString() || ''
  const code = error?.code || ''
  
  // أخطاء التكرار (Duplicate)
  if (message.includes('duplicate') || message.includes('unique') || message.includes('already exists') || code === '23505') {
    if (message.includes('phone')) return '📱 رقم الجوال مسجل مسبقاً'
    if (message.includes('email')) return '📧 البريد الإلكتروني مسجل مسبقاً'
    if (message.includes('national_id')) return '🪪 رقم الهوية مسجل مسبقاً'
    if (message.includes('license_number')) return '📜 رقم الرخصة مسجل مسبقاً'
    if (message.includes('commercial_reg')) return '🏢 رقم السجل التجاري مسجل مسبقاً'
    if (message.includes('iban')) return '🏦 رقم الآيبان مسجل مسبقاً'
    return '⚠️ هذه البيانات مسجلة مسبقاً'
  }
  
  // أخطاء الصلاحيات
  if (message.includes('permission') || message.includes('denied') || message.includes('policy') || code === '42501') {
    return '🚫 ليس لديك صلاحية لهذا الإجراء'
  }
  
  // أخطاء الاتصال
  if (message.includes('network') || message.includes('fetch') || message.includes('connection') || message.includes('Failed to fetch')) {
    return '📡 خطأ في الاتصال، تحقق من الإنترنت'
  }
  
  // أخطاء البيانات
  if (message.includes('invalid') || message.includes('format')) {
    if (message.includes('email')) return '📧 صيغة البريد الإلكتروني غير صحيحة'
    if (message.includes('phone')) return '📱 صيغة رقم الجوال غير صحيحة'
    if (message.includes('date')) return '📅 صيغة التاريخ غير صحيحة'
    return '❌ البيانات المدخلة غير صحيحة'
  }
  
  // أخطاء القيود
  if (message.includes('constraint') || message.includes('violates') || code === '23514') {
    if (message.includes('check')) return '⚠️ البيانات لا تتوافق مع الشروط المطلوبة'
    if (message.includes('foreign') || code === '23503') return '🔗 خطأ في ربط البيانات'
    return '⚠️ البيانات غير متوافقة مع النظام'
  }
  
  // أخطاء الحقول المطلوبة
  if (message.includes('null') || message.includes('required') || message.includes('empty') || code === '23502') {
    return '📝 يرجى تعبئة جميع الحقول المطلوبة'
  }
  
  // أخطاء قاعدة البيانات
  if (code.startsWith('22') || code.startsWith('23')) {
    return '⚠️ خطأ في البيانات المدخلة'
  }
  
  // خطأ عام
  return '❌ حدث خطأ، يرجى المحاولة مرة أخرى'
}

export default function IndependentRegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  
  const [entityType, setEntityType] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [nationalIdExpiry, setNationalIdExpiry] = useState('')
  const [commercialRegNumber, setCommercialRegNumber] = useState('')
  const [commercialRegExpiry, setCommercialRegExpiry] = useState('')
  const [managerName, setManagerName] = useState('')
  const [managerNationalId, setManagerNationalId] = useState('')
  const [managerIdExpiry, setManagerIdExpiry] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [licenseExpiry, setLicenseExpiry] = useState('')
  const [yearsOfExperience, setYearsOfExperience] = useState(0)
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [street, setStreet] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [isTaxRegistered, setIsTaxRegistered] = useState(false)
  const [taxNumber, setTaxNumber] = useState('')
  const [specializations, setSpecializations] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>(['ar'])
  const [bankName, setBankName] = useState('')
  const [iban, setIban] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, code, name_ar, name_en')
        .order('name_ar')
      if (data) setCategories(data)
    }
    fetchCategories()
  }, [])

  const handleSpecializationChange = (catId: string, checked: boolean) => {
    if (checked) {
      setSpecializations(prev => [...prev, catId])
    } else {
      setSpecializations(prev => prev.filter(id => id !== catId))
    }
  }

  const handleLanguageChange = (code: string, checked: boolean) => {
    if (checked) {
      setLanguages(prev => [...prev, code])
    } else {
      setLanguages(prev => prev.filter(c => c !== code))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // التحقق من البيانات مع رسائل عربية
    if (!entityType) { toast.error('📋 اختر نوع الكيان القانوني'); return }
    if (!nameAr) { toast.error('✏️ أدخل الاسم بالعربي'); return }
    if (!licenseNumber) { toast.error('📜 أدخل رقم الرخصة'); return }
    if (!licenseExpiry) { toast.error('📅 أدخل تاريخ انتهاء الرخصة'); return }
    if (!city) { toast.error('📍 اختر المدينة'); return }
    if (!phone || phone.length !== 9) { toast.error('📱 أدخل رقم جوال صحيح (9 أرقام)'); return }
    if (!email || !email.includes('@')) { toast.error('📧 أدخل بريد إلكتروني صحيح'); return }
    if (specializations.length === 0) { toast.error('⚖️ اختر تخصص واحد على الأقل'); return }
    if (!iban || iban.length !== 24) { toast.error('🏦 أدخل رقم IBAN صحيح (24 حرف)'); return }
    if (!agreedToTerms) { toast.error('✅ يجب الموافقة على الشروط والأحكام'); return }
    
    if (entityType === 'personal') {
      if (!nationalId || nationalId.length !== 10) { toast.error('🪪 رقم الهوية يجب أن يكون 10 أرقام'); return }
      if (!nationalIdExpiry) { toast.error('📅 أدخل تاريخ انتهاء الهوية'); return }
    } else {
      if (!commercialRegNumber) { toast.error('🏢 أدخل رقم السجل التجاري'); return }
      if (!managerName || !managerNationalId) { toast.error('👤 أدخل بيانات المدير كاملة'); return }
    }
    
    setIsLoading(true)
    
    try {
      // 1. إنشاء الكيان القانوني
      const { data: entityData, error: entityError } = await supabase
        .from('legal_entities')
        .insert({
          entity_type: entityType,
          name_ar: nameAr,
          name_en: nameEn || null,
          national_id: entityType === 'personal' ? nationalId : null,
          national_id_expiry: entityType === 'personal' ? nationalIdExpiry : null,
          commercial_reg_number: entityType === 'office' ? commercialRegNumber : null,
          commercial_reg_expiry: entityType === 'office' ? commercialRegExpiry : null,
          manager_name: entityType === 'office' ? managerName : null,
          manager_national_id: entityType === 'office' ? managerNationalId : null,
          manager_national_id_expiry: entityType === 'office' ? managerIdExpiry : null,
          city: city,
          district: district || null,
          street: street || null,
          is_tax_registered: isTaxRegistered,
          tax_number: isTaxRegistered ? taxNumber : null,
          status: 'active'
        })
        .select()
        .single()

      if (entityError) throw entityError

      // 2. إنشاء مستخدم
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          national_id: entityType === 'personal' ? nationalId : managerNationalId,
          phone: '+966' + phone,
          email: email,
          user_type: 'lawyer',
          status: 'pending',
          is_profile_complete: true,
          phone_verified: false,
          preferred_language: 'ar'
        })
        .select()
        .single()

      if (userError) throw userError

      // 3. إنشاء المحامي
      const { data: lawyerData, error: lawyerError } = await supabase
        .from('lawyers')
        .insert({
          user_id: userData.id,
          lawyer_type: 'independent',
          legal_entity_id: entityData.id,
          full_name: nameAr,
          full_name_en: nameEn || null,
          national_id: entityType === 'personal' ? nationalId : managerNationalId,
          national_id_expiry: entityType === 'personal' ? nationalIdExpiry : managerIdExpiry,
          license_number: licenseNumber,
          license_expiry: licenseExpiry,
          phone: '+966' + phone,
          email: email,
          city: city,
          years_of_experience: yearsOfExperience,
          supported_languages: languages,
          bank_name: bankName || null,
          iban: iban,
          account_holder_name: accountHolderName || nameAr,
          status: 'pending',
          activation_status: 'pending_license'
        })
        .select()
        .single()

      if (lawyerError) throw lawyerError

      // 4. إضافة التخصصات
      if (specializations.length > 0) {
        const specData = specializations.map(catId => ({
          lawyer_id: lawyerData.id,
          category_id: catId,
          is_active: true
        }))
        await supabase.from('lawyer_categories').insert(specData)
      }

      toast.success('✅ تم تقديم طلبك بنجاح! سيتم مراجعته وإشعارك')
      router.push('/auth/lawyer-login')

    } catch (error: any) {
      console.error('Error:', error)
      toast.error(translateError(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        
        <div className="text-center mb-8">
          <Link href="/auth/lawyer-login">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl mb-3 shadow-lg">
              <span className="text-3xl">⚖️</span>
            </div>
            <h1 className="text-2xl font-bold text-white">ExoLex</h1>
          </Link>
          <p className="text-slate-400 mt-1">تسجيل محامي مستقل</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8">
          
          {/* القسم 1: نوع الكيان */}
          <div className="mb-8 pb-8 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">● نوع الكيان القانوني</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setEntityType('personal')}
                className={`p-5 rounded-xl border-2 text-center transition-all ${
                  entityType === 'personal' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">👤</div>
                <div className="font-bold text-slate-800">شخصي</div>
                <div className="text-xs text-gray-500">محامي فرد بهوية وطنية</div>
              </button>
              <button
                type="button"
                onClick={() => setEntityType('office')}
                className={`p-5 rounded-xl border-2 text-center transition-all ${
                  entityType === 'office' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">🏢</div>
                <div className="font-bold text-slate-800">مكتب</div>
                <div className="text-xs text-gray-500">بسجل تجاري (بدون موظفين)</div>
              </button>
            </div>
            <p className="text-xs text-center text-slate-400 mt-3">
              💡 لديك موظفين؟ <Link href="/partner/register" className="text-amber-600 hover:underline">سجّل كشريك قانوني</Link>
            </p>
          </div>

          {/* القسم 2: البيانات الأساسية */}
          <div className="mb-8 pb-8 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">● البيانات الأساسية</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">الاسم بالعربي *</label>
                  <input type="text" value={nameAr} onChange={(e) => setNameAr(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                    placeholder={entityType === 'office' ? 'اسم المكتب' : 'الاسم الكامل'} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">الاسم بالإنجليزي</label>
                  <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" dir="ltr" />
                </div>
              </div>

              {entityType === 'personal' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">رقم الهوية *</label>
                    <input type="text" value={nationalId} onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                      dir="ltr" placeholder="1xxxxxxxxx" maxLength={10} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">تاريخ انتهاء الهوية *</label>
                    <input type="date" value={nationalIdExpiry} onChange={(e) => setNationalIdExpiry(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
                  </div>
                </div>
              )}

              {entityType === 'office' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">رقم السجل التجاري *</label>
                      <input type="text" value={commercialRegNumber} onChange={(e) => setCommercialRegNumber(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" dir="ltr" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">تاريخ انتهاء السجل *</label>
                      <input type="date" value={commercialRegExpiry} onChange={(e) => setCommercialRegExpiry(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">اسم المدير *</label>
                      <input type="text" value={managerName} onChange={(e) => setManagerName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">هوية المدير *</label>
                      <input type="text" value={managerNationalId} onChange={(e) => setManagerNationalId(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" dir="ltr" maxLength={10} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* القسم 3: بيانات الترخيص */}
          <div className="mb-8 pb-8 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">● بيانات الترخيص</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">رقم الرخصة *</label>
                <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" dir="ltr" />
                <p className="text-xs text-slate-400 mt-1">معرّف الدخول</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">تاريخ الانتهاء *</label>
                <input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">سنوات الخبرة</label>
                <input type="number" value={yearsOfExperience} onChange={(e) => setYearsOfExperience(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" min="0" max="50" />
              </div>
            </div>
          </div>

          {/* القسم 4: العنوان والتواصل */}
          <div className="mb-8 pb-8 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">● العنوان والتواصل</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">المدينة *</label>
                  <select value={city} onChange={(e) => setCity(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white">
                    <option value="">اختر</option>
                    {SAUDI_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">الحي</label>
                  <input type="text" value={district} onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">الشارع</label>
                  <input type="text" value={street} onChange={(e) => setStreet(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">رقم الجوال *</label>
                  <div className="flex gap-2">
                    <span className="px-3 py-2.5 bg-slate-100 border border-slate-300 rounded-lg text-slate-500">966+</span>
                    <input type="text" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                      dir="ltr" placeholder="5xxxxxxxx" maxLength={9} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">البريد الإلكتروني *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" dir="ltr" />
                </div>
              </div>
            </div>
          </div>

          {/* القسم 5: التخصصات */}
          <div className="mb-8 pb-8 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">● التخصصات والمهارات</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">المجالات القانونية *</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {categories.map(cat => (
                    <label key={cat.id}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                        specializations.includes(cat.id) ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
                      }`}>
                      <input type="checkbox" checked={specializations.includes(cat.id)}
                        onChange={(e) => handleSpecializationChange(cat.id, e.target.checked)}
                        className="w-4 h-4 text-amber-500 rounded" />
                      <span className="text-slate-700">{cat.name_ar}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">اللغات</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(lang => (
                    <label key={lang.code}
                      className={`px-3 py-1.5 rounded-full border cursor-pointer transition-all text-sm ${
                        languages.includes(lang.code) ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600'
                      }`}>
                      <input type="checkbox" checked={languages.includes(lang.code)}
                        onChange={(e) => handleLanguageChange(lang.code, e.target.checked)}
                        className="hidden" />
                      {lang.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isTaxRegistered} onChange={(e) => setIsTaxRegistered(e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded" />
                  <span className="text-slate-700 text-sm">لدي رقم ضريبي</span>
                </label>
                {isTaxRegistered && (
                  <input type="text" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)}
                    className="mt-2 w-full md:w-1/2 px-4 py-2.5 border border-slate-300 rounded-lg" placeholder="الرقم الضريبي" dir="ltr" />
                )}
              </div>
            </div>
          </div>

          {/* القسم 6: البيانات البنكية */}
          <div className="mb-8 pb-8 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">● البيانات البنكية</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">البنك</label>
                <select value={bankName} onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white">
                  <option value="">اختر</option>
                  {SAUDI_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">IBAN *</label>
                <input type="text" value={iban} onChange={(e) => setIban(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg font-mono" dir="ltr" placeholder="SA..." maxLength={24} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">صاحب الحساب</label>
                <input type="text" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg" placeholder={nameAr} />
              </div>
            </div>
          </div>

          {/* الموافقة والإرسال */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer mb-6">
              <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="w-5 h-5 text-amber-500 rounded mt-0.5" />
              <span className="text-sm text-slate-600">
                أوافق على <a href="#" className="text-amber-600 hover:underline">الشروط والأحكام</a> و <a href="#" className="text-amber-600 hover:underline">سياسة الخصوصية</a>
              </span>
            </label>
            <button type="submit" disabled={isLoading}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white py-3.5 px-6 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50">
              {isLoading ? '⏳ جاري الإرسال...' : '✓ تقديم طلب التسجيل'}
            </button>
          </div>

        </form>

        <p className="text-center mt-6">
          <Link href="/auth/lawyer-login" className="text-slate-400 hover:text-white text-sm">← العودة لتسجيل الدخول</Link>
        </p>

      </div>
    </div>
  )
}
