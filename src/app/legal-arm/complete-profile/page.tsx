'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════
// 📌 صفحة إكمال بيانات الذراع القانوني
// 📅 تاريخ: 4 يناير 2026
// 🎯 الغرض: إكمال بيانات الذراع بعد التسجيل من الأدمن
// ═══════════════════════════════════════════════════════════════
// تظهر هذه الصفحة عند أول دخول للذراع القانوني
// بعد أن يُسجِّله الأدمن برقم الرخصة والجوال فقط
// ═══════════════════════════════════════════════════════════════

export default function LegalArmCompleteProfilePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [legalArmId, setLegalArmId] = useState<string | null>(null)
  const [existingData, setExistingData] = useState<any>(null)

  // ─────────────────────────────────────────────────────────────
  // بيانات النموذج
  // ─────────────────────────────────────────────────────────────
  // بيانات الكيان
  const [entityType, setEntityType] = useState<'office' | 'company'>('company')
  const [nameAr, setNameAr] = useState('')
  const [commercialRegistration, setCommercialRegistration] = useState('')
  const [commercialRegistrationExpiry, setCommercialRegistrationExpiry] = useState('')
  const [licenseExpiry, setLicenseExpiry] = useState('')
  
  // بيانات المدير
  const [managerName, setManagerName] = useState('')
  const [managerNationalId, setManagerNationalId] = useState('')
  const [managerNationalIdExpiry, setManagerNationalIdExpiry] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [email, setEmail] = useState('')
  const [emailOtp, setEmailOtp] = useState(['', '', '', '', '', ''])
  const [emailVerified, setEmailVerified] = useState(false)
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  
  // المرفقات
  const [commercialRegImage, setCommercialRegImage] = useState<File | null>(null)
  const [licenseImage, setLicenseImage] = useState<File | null>(null)
  const [managerIdImage, setManagerIdImage] = useState<File | null>(null)

  // ─────────────────────────────────────────────────────────────
  // تحميل البيانات الموجودة
  // ─────────────────────────────────────────────────────────────
  
  useEffect(() => {
    const armId = localStorage.getItem('exolex_legal_arm_id')
    if (!armId) {
      toast.error('يرجى تسجيل الدخول أولاً')
      router.push('/auth/legal-arm-login')
      return
    }
    setLegalArmId(armId)
    loadExistingData(armId)
  }, [])

  const loadExistingData = async (armId: string) => {
    try {
      const { data, error } = await supabase
        .from('legal_arms')
        .select('*')
        .eq('id', armId)
        .single()

      if (error) throw error

      setExistingData(data)
      
      // تعبئة البيانات الموجودة
      if (data.name_ar) setNameAr(data.name_ar)
      if (data.commercial_registration) setCommercialRegistration(data.commercial_registration)
      if (data.commercial_registration_expiry) setCommercialRegistrationExpiry(data.commercial_registration_expiry)
      if (data.license_expiry) setLicenseExpiry(data.license_expiry)
      if (data.manager_national_id) setManagerNationalId(data.manager_national_id)
      if (data.manager_national_id_expiry) setManagerNationalIdExpiry(data.manager_national_id_expiry)
      if (data.address) setAddress(data.address)
      if (data.city) setCity(data.city)
      if (data.email) {
        setEmail(data.email)
        setEmailVerified(true) // إذا موجود نفترض أنه موثق
      }

    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // دوال التحقق
  // ─────────────────────────────────────────────────────────────

  const validateNationalId = (id: string): boolean => {
    if (id.length !== 10) return false
    if (!/^\d{10}$/.test(id)) return false
    if (!['1', '2', '3'].includes(id[0])) return false
    return true
  }

  const validateEmail = (e: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  }

  // ─────────────────────────────────────────────────────────────
  // إرسال OTP للبريد الإلكتروني
  // ─────────────────────────────────────────────────────────────
  
  const handleSendEmailOTP = async () => {
    if (!validateEmail(email)) {
      toast.error('يرجى إدخال بريد إلكتروني صحيح')
      return
    }

    setIsLoading(true)
    
    try {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

      const { error: otpError } = await supabase
        .from('otp_verifications')
        .insert({
          phone: email,
          code: otpCode,
          purpose: 'email_verify',
          expires_at: expiresAt,
          national_id: managerNationalId || legalArmId,
          status: 'pending',
          channel: 'email',
          attempts: 0,
          max_attempts: 3
        })

      if (otpError) throw otpError

      console.log('📧 رمز التحقق للبريد:', otpCode)
      toast.success(`تم إرسال رمز التحقق للبريد (للتجربة: ${otpCode})`)
      setEmailOtpSent(true)
      
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('حدث خطأ، حاول مرة أخرى')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // التحقق من OTP البريد
  // ─────────────────────────────────────────────────────────────
  
  const handleVerifyEmailOTP = async () => {
    const otpCode = emailOtp.join('')
    if (otpCode.length !== 6) {
      toast.error('الرجاء إدخال رمز التحقق كاملاً')
      return
    }

    setIsLoading(true)

    try {
      const { data: otpData, error: otpError } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('phone', email)
        .eq('code', otpCode)
        .eq('purpose', 'email_verify')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (otpError || !otpData) {
        toast.error('رمز التحقق غير صحيح أو منتهي الصلاحية')
        setIsLoading(false)
        return
      }

      await supabase
        .from('otp_verifications')
        .update({ status: 'verified', verified_at: new Date().toISOString() })
        .eq('id', otpData.id)

      toast.success('تم توثيق البريد الإلكتروني!')
      setEmailVerified(true)
      
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('حدث خطأ، حاول مرة أخرى')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // التعامل مع إدخال OTP البريد
  // ─────────────────────────────────────────────────────────────

  const handleEmailOtpChange = (index: number, value: string) => {
    if (value.length > 1) return
    if (value && !/^\d$/.test(value)) return

    const newOtp = [...emailOtp]
    newOtp[index] = value
    setEmailOtp(newOtp)

    if (value && index < 5) {
      const nextInput = document.getElementById(`email-otp-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleEmailOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !emailOtp[index] && index > 0) {
      const prevInput = document.getElementById(`email-otp-${index - 1}`)
      prevInput?.focus()
    }
  }

  // ─────────────────────────────────────────────────────────────
  // رفع الملفات
  // ─────────────────────────────────────────────────────────────
  
  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `legal-arms/${folder}/${legalArmId}_${Date.now()}.${fileExt}`
      
      const { data, error } = await supabase.storage
        .from('legal-arm-documents')
        .upload(fileName, file)

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('legal-arm-documents')
        .getPublicUrl(fileName)

      return urlData.publicUrl
    } catch (error) {
      console.error('Upload error:', error)
      return null
    }
  }

  // ─────────────────────────────────────────────────────────────
  // إرسال النموذج
  // ─────────────────────────────────────────────────────────────
  
  const handleSubmit = async () => {
    // التحقق من البيانات المطلوبة
    if (!nameAr.trim()) {
      toast.error('يرجى إدخال اسم الذراع القانوني')
      return
    }
    if (!commercialRegistration.trim()) {
      toast.error('يرجى إدخال رقم السجل التجاري')
      return
    }
    if (!commercialRegistrationExpiry) {
      toast.error('يرجى إدخال تاريخ انتهاء السجل التجاري')
      return
    }
    if (!licenseExpiry) {
      toast.error('يرجى إدخال تاريخ انتهاء الرخصة')
      return
    }
    if (!managerName.trim()) {
      toast.error('يرجى إدخال اسم المدير')
      return
    }
    if (!validateNationalId(managerNationalId)) {
      toast.error('رقم الهوية يجب أن يكون 10 أرقام')
      return
    }
    if (!managerNationalIdExpiry) {
      toast.error('يرجى إدخال تاريخ انتهاء هوية المدير')
      return
    }
    if (!address.trim()) {
      toast.error('يرجى إدخال العنوان')
      return
    }
    if (!city.trim()) {
      toast.error('يرجى إدخال المدينة')
      return
    }
    if (!emailVerified) {
      toast.error('يرجى توثيق البريد الإلكتروني')
      return
    }
    if (!commercialRegImage && !existingData?.commercial_registration_image) {
      toast.error('يرجى رفع صورة السجل التجاري')
      return
    }
    if (!licenseImage && !existingData?.license_image) {
      toast.error('يرجى رفع صورة الرخصة')
      return
    }

    setIsLoading(true)

    try {
      // رفع الملفات الجديدة فقط
      let commercialRegUrl = existingData?.commercial_registration_image
      let licenseUrl = existingData?.license_image
      let managerIdUrl = existingData?.manager_national_id_image

      if (commercialRegImage) {
        commercialRegUrl = await uploadFile(commercialRegImage, 'commercial-reg')
        if (!commercialRegUrl) {
          toast.error('فشل في رفع السجل التجاري')
          setIsLoading(false)
          return
        }
      }

      if (licenseImage) {
        licenseUrl = await uploadFile(licenseImage, 'licenses')
        if (!licenseUrl) {
          toast.error('فشل في رفع الرخصة')
          setIsLoading(false)
          return
        }
      }

      if (managerIdImage) {
        managerIdUrl = await uploadFile(managerIdImage, 'national-ids')
      }

      // تحديث بيانات الذراع
      const { error: updateError } = await supabase
        .from('legal_arms')
        .update({
          name_ar: nameAr.trim(),
          commercial_registration: commercialRegistration.trim(),
          commercial_registration_expiry: commercialRegistrationExpiry,
          commercial_registration_image: commercialRegUrl,
          license_expiry: licenseExpiry,
          license_image: licenseUrl,
          manager_national_id: managerNationalId,
          manager_national_id_expiry: managerNationalIdExpiry,
          manager_national_id_image: managerIdUrl,
          address: address.trim(),
          city: city.trim(),
          email: email,
          status: 'pending', // بانتظار موافقة الإدارة للتنشيط
          updated_at: new Date().toISOString()
        })
        .eq('id', legalArmId)

      if (updateError) throw updateError

      // تسجيل في activity_logs
      await supabase.from('activity_logs').insert({
        user_id: legalArmId,
        user_type: 'legal_arm',
        activity_type: 'profile_completed',
        description: `إكمال بيانات الذراع القانوني: ${nameAr}`,
        entity_type: 'legal_arm',
        entity_id: legalArmId,
        legal_arm_id: legalArmId,
        metadata: { 
          commercial_registration: commercialRegistration
        }
      })

      // إرسال إشعار للأدمن
      await supabase.from('notifications').insert({
        title: '✅ إكمال بيانات ذراع قانوني',
        message: `تم إكمال بيانات الذراع القانوني: ${nameAr}. يرجى مراجعة البيانات وتنشيط الحساب.`,
        type: 'admin_alert',
        priority: 'high',
        link: `/admin/legal-arms/${legalArmId}`,
        metadata: { legal_arm_id: legalArmId }
      })

      // تحديث localStorage
      localStorage.setItem('exolex_legal_arm_name', nameAr)

      toast.success('تم حفظ البيانات بنجاح!')
      
      // التوجيه للوحة التحكم مع رسالة
      toast('⚠️ حسابكم قيد المراجعة، سيتم إشعاركم عند التنشيط', { duration: 5000 })
      router.push('/legal-arm/dashboard')

    } catch (error: any) {
      console.error('Error:', error)
      toast.error('حدث خطأ في حفظ البيانات، حاول مرة أخرى')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // العرض
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        
        {/* الشعار والعنوان */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl mb-4 shadow-lg">
            <span className="text-4xl">⚖️</span>
          </div>
          <h1 className="text-3xl font-bold text-white">ExoLex</h1>
          <p className="text-purple-300 mt-1">إكمال بيانات الذراع القانوني</p>
        </div>

        {/* رسالة ترحيب */}
        <div className="bg-purple-500/20 border border-purple-400/30 rounded-xl p-4 mb-6 text-center">
          <p className="text-purple-200">
            🎉 مرحباً بكم في ExoLex!<br />
            <span className="text-purple-300 text-sm">يرجى إكمال بيانات الذراع القانوني للمتابعة</span>
          </p>
        </div>

        {/* البطاقة الرئيسية */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-8">

            {/* ═══ بيانات الكيان ═══ */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center text-sm">🏢</span>
                بيانات الكيان
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* نوع الكيان */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    نوع الكيان <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className={`flex-1 flex items-center justify-center gap-2 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      entityType === 'office' ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="entityType"
                        value="office"
                        checked={entityType === 'office'}
                        onChange={() => setEntityType('office')}
                        className="hidden"
                      />
                      <span className="text-2xl">🏛️</span>
                      <span className="font-medium">مكتب محاماة</span>
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      entityType === 'company' ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="entityType"
                        value="company"
                        checked={entityType === 'company'}
                        onChange={() => setEntityType('company')}
                        className="hidden"
                      />
                      <span className="text-2xl">🏢</span>
                      <span className="font-medium">شركة محاماة</span>
                    </label>
                  </div>
                </div>

                {/* اسم الذراع */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    اسم الذراع القانوني <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder="مثال: الذراع القانوني لـ ExoLex"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-right"
                  />
                </div>

                {/* رقم السجل التجاري */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    رقم السجل التجاري <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={commercialRegistration}
                    onChange={(e) => setCommercialRegistration(e.target.value)}
                    placeholder="رقم السجل"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>

                {/* تاريخ انتهاء السجل */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    تاريخ انتهاء السجل <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={commercialRegistrationExpiry}
                    onChange={(e) => setCommercialRegistrationExpiry(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>

                {/* رقم الرخصة (للقراءة فقط - من الأدمن) */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    رقم الرخصة
                  </label>
                  <input
                    type="text"
                    value={existingData?.license_number || ''}
                    disabled
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-100 text-slate-500"
                  />
                </div>

                {/* تاريخ انتهاء الرخصة */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    تاريخ انتهاء الرخصة <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={licenseExpiry}
                    onChange={(e) => setLicenseExpiry(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* ═══ بيانات المدير ═══ */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center text-sm">👤</span>
                بيانات المدير
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* اسم المدير */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    اسم المدير الكامل <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="الاسم رباعي"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-right"
                  />
                </div>

                {/* رقم الهوية */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    رقم هوية المدير <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={managerNationalId}
                    onChange={(e) => setManagerNationalId(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10 أرقام"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    maxLength={10}
                  />
                </div>

                {/* تاريخ انتهاء الهوية */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    تاريخ انتهاء الهوية <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={managerNationalIdExpiry}
                    onChange={(e) => setManagerNationalIdExpiry(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>

                {/* رقم الجوال (للقراءة فقط - من الأدمن) */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    رقم الجوال
                  </label>
                  <input
                    type="text"
                    value={existingData?.phone || ''}
                    disabled
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-100 text-slate-500"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                {/* المدينة */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    المدينة <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="مثال: الرياض"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-right"
                  />
                </div>

                {/* العنوان */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    العنوان <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="العنوان التفصيلي"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-right"
                  />
                </div>

                {/* البريد الإلكتروني مع التوثيق */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    البريد الإلكتروني <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailVerified(false); setEmailOtpSent(false) }}
                      placeholder="example@domain.com"
                      disabled={emailVerified}
                      className={`flex-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none ${
                        emailVerified ? 'border-green-300 bg-green-50' : 'border-slate-300'
                      }`}
                      style={{ direction: 'ltr' }}
                    />
                    {!emailVerified && (
                      <button
                        onClick={handleSendEmailOTP}
                        disabled={isLoading || !validateEmail(email)}
                        className="px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium disabled:opacity-50 transition-all"
                      >
                        توثيق
                      </button>
                    )}
                    {emailVerified && (
                      <span className="px-4 py-3 bg-green-500 text-white rounded-xl font-medium flex items-center gap-1">
                        ✓ موثق
                      </span>
                    )}
                  </div>

                  {/* إدخال OTP البريد */}
                  {emailOtpSent && !emailVerified && (
                    <div className="mt-4 p-4 bg-purple-50 rounded-xl">
                      <p className="text-sm text-purple-700 mb-3">أدخل رمز التحقق المرسل للبريد:</p>
                      <div className="flex justify-center gap-2 mb-3" dir="ltr">
                        {emailOtp.map((digit, index) => (
                          <input
                            key={index}
                            id={`email-otp-${index}`}
                            type="text"
                            inputMode="numeric"
                            value={digit}
                            onChange={(e) => handleEmailOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleEmailOtpKeyDown(index, e)}
                            className="w-10 h-12 text-center text-lg font-bold border-2 border-purple-300 rounded-lg focus:border-purple-500 outline-none"
                            maxLength={1}
                          />
                        ))}
                      </div>
                      <button
                        onClick={handleVerifyEmailOTP}
                        disabled={isLoading || emailOtp.join('').length !== 6}
                        className="w-full py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50"
                      >
                        تحقق
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ═══ المرفقات ═══ */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center text-sm">📎</span>
                المرفقات المطلوبة
              </h3>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <p className="text-amber-800 text-sm">
                  ⚠️ <strong>مهم:</strong> لن يتم تنشيط الحساب بدون رفع السجل التجاري والرخصة
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* السجل التجاري */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    السجل التجاري <span className="text-red-500">*</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    commercialRegImage || existingData?.commercial_registration_image ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                  }`}>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setCommercialRegImage(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    {commercialRegImage ? (
                      <>
                        <span className="text-3xl mb-2">✅</span>
                        <span className="text-sm text-green-600 text-center">{commercialRegImage.name}</span>
                      </>
                    ) : existingData?.commercial_registration_image ? (
                      <>
                        <span className="text-3xl mb-2">✅</span>
                        <span className="text-sm text-green-600">مرفوع مسبقاً</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl mb-2">📄</span>
                        <span className="text-sm text-slate-500">اضغط للرفع</span>
                      </>
                    )}
                  </label>
                </div>

                {/* الرخصة */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    رخصة الكيان <span className="text-red-500">*</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    licenseImage || existingData?.license_image ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                  }`}>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setLicenseImage(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    {licenseImage ? (
                      <>
                        <span className="text-3xl mb-2">✅</span>
                        <span className="text-sm text-green-600 text-center">{licenseImage.name}</span>
                      </>
                    ) : existingData?.license_image ? (
                      <>
                        <span className="text-3xl mb-2">✅</span>
                        <span className="text-sm text-green-600">مرفوع مسبقاً</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl mb-2">📜</span>
                        <span className="text-sm text-slate-500">اضغط للرفع</span>
                      </>
                    )}
                  </label>
                </div>

                {/* هوية المدير (اختياري) */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    هوية المدير <span className="text-slate-400 text-xs">(اختياري)</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    managerIdImage || existingData?.manager_national_id_image ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                  }`}>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setManagerIdImage(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    {managerIdImage ? (
                      <>
                        <span className="text-3xl mb-2">✅</span>
                        <span className="text-sm text-green-600 text-center">{managerIdImage.name}</span>
                      </>
                    ) : existingData?.manager_national_id_image ? (
                      <>
                        <span className="text-3xl mb-2">✅</span>
                        <span className="text-sm text-green-600">مرفوع مسبقاً</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl mb-2">🪪</span>
                        <span className="text-sm text-slate-500">اضغط للرفع</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>

            {/* زر الحفظ */}
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white py-4 px-6 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  جاري الحفظ...
                </span>
              ) : (
                '✅ حفظ البيانات والمتابعة'
              )}
            </button>

          </div>
        </div>

      </div>
    </div>
  )
}
