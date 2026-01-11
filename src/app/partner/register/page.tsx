'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════
// 📌 صفحة تسجيل الشريك القانوني
// 📅 تاريخ: 4 يناير 2026
// 🎯 الغرض: تسجيل مكتب/شركة محاماة كشريك قانوني
// ═══════════════════════════════════════════════════════════════
// الخطوات:
// 1. التحقق الأولي (هوية المدير + الجوال + OTP)
// 2. نموذج بيانات الشركة والمدير والمرفقات
// 3. رسالة التأكيد والتوجيه
// ═══════════════════════════════════════════════════════════════

export default function PartnerRegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<'verify' | 'form' | 'success'>('verify')
  const [isLoading, setIsLoading] = useState(false)
  
  // ─────────────────────────────────────────────────────────────
  // الخطوة 1: بيانات التحقق
  // ─────────────────────────────────────────────────────────────
  const [managerNationalId, setManagerNationalId] = useState('')
  const [managerPhone, setManagerPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpSent, setOtpSent] = useState(false)
  const [generatedOtp, setGeneratedOtp] = useState('')

  // ─────────────────────────────────────────────────────────────
  // الخطوة 2: بيانات النموذج
  // ─────────────────────────────────────────────────────────────
  // بيانات الكيان
  const [entityType, setEntityType] = useState<'office' | 'company'>('office')
  const [companyNameAr, setCompanyNameAr] = useState('')
  const [commercialRegNumber, setCommercialRegNumber] = useState('')
  const [commercialRegExpiry, setCommercialRegExpiry] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [licenseExpiry, setLicenseExpiry] = useState('')
  
  // بيانات المدير
  const [managerName, setManagerName] = useState('')
  const [managerNationalIdExpiry, setManagerNationalIdExpiry] = useState('')
  const [managerLicenseNumber, setManagerLicenseNumber] = useState('')
  const [managerLicenseExpiry, setManagerLicenseExpiry] = useState('')
  const [address, setAddress] = useState('')
  const [managerEmail, setManagerEmail] = useState('')
  const [emailOtp, setEmailOtp] = useState(['', '', '', '', '', ''])
  const [emailVerified, setEmailVerified] = useState(false)
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  
  // المرفقات
  const [commercialRegImage, setCommercialRegImage] = useState<File | null>(null)
  const [licenseImage, setLicenseImage] = useState<File | null>(null)
  const [managerIdImage, setManagerIdImage] = useState<File | null>(null)

  // ─────────────────────────────────────────────────────────────
  // دوال التحقق
  // ─────────────────────────────────────────────────────────────
  
  const validateNationalId = (id: string): boolean => {
    if (id.length !== 10) return false
    if (!/^\d{10}$/.test(id)) return false
    if (!['1', '2', '3'].includes(id[0])) return false
    return true
  }

  const validatePhone = (p: string): boolean => {
    const phoneClean = p.replace(/\D/g, '')
    return phoneClean.length === 9 && phoneClean.startsWith('5')
  }

  const validateEmail = (e: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  }

  // ─────────────────────────────────────────────────────────────
  // الخطوة 1: إرسال OTP للجوال
  // ─────────────────────────────────────────────────────────────
  
  const handleSendOTP = async () => {
    if (!validateNationalId(managerNationalId)) {
      toast.error('رقم الهوية يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2 أو 3')
      return
    }
    
    if (!validatePhone(managerPhone)) {
      toast.error('رقم الجوال يجب أن يكون 9 أرقام ويبدأ بـ 5')
      return
    }

    setIsLoading(true)
    
    try {
      const fullPhone = '+966' + managerPhone

      // التحقق من عدم وجود تسجيل سابق بنفس الهوية
      const { data: existingPartner } = await supabase
        .from('partners')
        .select('id')
        .eq('manager_national_id', managerNationalId)
        .maybeSingle()

      if (existingPartner) {
        toast.error('رقم الهوية مسجل مسبقاً. يرجى تسجيل الدخول')
        setIsLoading(false)
        return
      }

      // إنشاء OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
      setGeneratedOtp(otpCode)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

      const { error: otpError } = await supabase
        .from('otp_verifications')
        .insert({
          phone: fullPhone,
          code: otpCode,
          purpose: 'partner_register',
          expires_at: expiresAt,
          national_id: managerNationalId,
          status: 'pending',
          channel: 'whatsapp',
          attempts: 0,
          max_attempts: 3
        })

      if (otpError) throw otpError

      console.log('🔐 رمز التحقق:', otpCode)
      toast.success(`تم إرسال رمز التحقق (للتجربة: ${otpCode})`)
      setOtpSent(true)
      
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('حدث خطأ، حاول مرة أخرى')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // التحقق من OTP الجوال
  // ─────────────────────────────────────────────────────────────
  
  const handleVerifyOTP = async () => {
    const otpCode = otp.join('')
    if (otpCode.length !== 6) {
      toast.error('الرجاء إدخال رمز التحقق كاملاً')
      return
    }

    setIsLoading(true)
    const fullPhone = '+966' + managerPhone

    try {
      const { data: otpData, error: otpError } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('phone', fullPhone)
        .eq('code', otpCode)
        .eq('purpose', 'partner_register')
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

      // تحديث حالة OTP
      await supabase
        .from('otp_verifications')
        .update({ status: 'verified', verified_at: new Date().toISOString() })
        .eq('id', otpData.id)

      toast.success('تم التحقق بنجاح!')
      setStep('form')
      
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('حدث خطأ، حاول مرة أخرى')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // إرسال OTP للبريد الإلكتروني
  // ─────────────────────────────────────────────────────────────
  
  const handleSendEmailOTP = async () => {
    if (!validateEmail(managerEmail)) {
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
          phone: managerEmail, // نستخدم حقل phone لتخزين البريد مؤقتاً
          code: otpCode,
          purpose: 'email_verify',
          expires_at: expiresAt,
          national_id: managerNationalId,
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
        .eq('phone', managerEmail)
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
  // رفع الملفات
  // ─────────────────────────────────────────────────────────────
  
  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${folder}/${managerNationalId}_${Date.now()}.${fileExt}`
      
      const { data, error } = await supabase.storage
        .from('partner-documents')
        .upload(fileName, file)

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('partner-documents')
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
    if (!companyNameAr.trim()) {
      toast.error('يرجى إدخال الاسم التجاري')
      return
    }
    if (!commercialRegNumber.trim()) {
      toast.error('يرجى إدخال رقم السجل التجاري')
      return
    }
    if (!commercialRegExpiry) {
      toast.error('يرجى إدخال تاريخ انتهاء السجل التجاري')
      return
    }
    if (!licenseNumber.trim()) {
      toast.error('يرجى إدخال رقم الرخصة')
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
    if (!managerNationalIdExpiry) {
      toast.error('يرجى إدخال تاريخ انتهاء هوية المدير')
      return
    }
    if (!address.trim()) {
      toast.error('يرجى إدخال العنوان')
      return
    }
    if (!emailVerified) {
      toast.error('يرجى توثيق البريد الإلكتروني')
      return
    }
    if (!commercialRegImage) {
      toast.error('يرجى رفع صورة السجل التجاري')
      return
    }
    if (!licenseImage) {
      toast.error('يرجى رفع صورة الرخصة')
      return
    }

    setIsLoading(true)

    try {
      // رفع الملفات
      const commercialRegUrl = await uploadFile(commercialRegImage, 'commercial-reg')
      const licenseUrl = await uploadFile(licenseImage, 'licenses')
      const managerIdUrl = managerIdImage ? await uploadFile(managerIdImage, 'national-ids') : null

      if (!commercialRegUrl || !licenseUrl) {
        toast.error('فشل في رفع الملفات، حاول مرة أخرى')
        setIsLoading(false)
        return
      }

      // إنشاء كود الشريك
      const partnerCode = 'PTR' + Date.now().toString().slice(-6)

      // إدخال بيانات الشريك
      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .insert({
          partner_code: partnerCode,
          entity_type: entityType,
          company_name_ar: companyNameAr.trim(),
          commercial_reg_number: commercialRegNumber.trim(),
          commercial_reg_expiry: commercialRegExpiry,
          commercial_reg_image: commercialRegUrl,
          license_number: licenseNumber.trim(),
          license_expiry: licenseExpiry,
          license_image: licenseUrl,
          manager_name: managerName.trim(),
          manager_national_id: managerNationalId,
          manager_national_id_expiry: managerNationalIdExpiry,
          manager_national_id_image: managerIdUrl,
          manager_license_number: managerLicenseNumber.trim() || null,
          manager_license_expiry: managerLicenseExpiry || null,
          manager_phone: '+966' + managerPhone,
          manager_email: managerEmail,
          address: address.trim(),
          phone: '+966' + managerPhone,
          email: managerEmail,
          status: 'pending', // بانتظار موافقة الإدارة
          is_available: false,
          receive_exolex_requests: false,
          commission_rate: 70, // النسبة الافتراضية
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (partnerError) throw partnerError

      // تسجيل في activity_logs
      await supabase.from('activity_logs').insert({
        user_type: 'partner',
        activity_type: 'partner_registered',
        description: `تسجيل شريك قانوني جديد: ${companyNameAr}`,
        entity_type: 'partner',
        entity_id: partnerData.id,
        partner_id: partnerData.id,
        metadata: { 
          partner_code: partnerCode,
          entity_type: entityType,
          commercial_reg: commercialRegNumber
        }
      })

      // إرسال إشعار للأدمن
      await supabase.from('notifications').insert({
        title: '🆕 تسجيل شريك قانوني جديد',
        message: `تم تسجيل شريك قانوني جديد: ${companyNameAr}. يرجى مراجعة الطلب وتنشيط الحساب.`,
        type: 'admin_alert',
        priority: 'high',
        link: `/admin/partners/${partnerData.id}`,
        metadata: { partner_id: partnerData.id, partner_code: partnerCode }
      })

      toast.success('تم التسجيل بنجاح!')
      setStep('success')

    } catch (error: any) {
      console.error('Error:', error)
      toast.error('حدث خطأ في التسجيل، حاول مرة أخرى')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // التعامل مع إدخال OTP
  // ─────────────────────────────────────────────────────────────
  
  const handleOtpChange = (index: number, value: string, type: 'phone' | 'email') => {
    if (value.length > 1) return
    if (value && !/^\d$/.test(value)) return

    if (type === 'phone') {
      const newOtp = [...otp]
      newOtp[index] = value
      setOtp(newOtp)
    } else {
      const newOtp = [...emailOtp]
      newOtp[index] = value
      setEmailOtp(newOtp)
    }

    if (value && index < 5) {
      const nextInput = document.getElementById(`${type}-otp-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent, type: 'phone' | 'email') => {
    if (e.key === 'Backspace' && index > 0) {
      const currentOtp = type === 'phone' ? otp : emailOtp
      if (!currentOtp[index]) {
        const prevInput = document.getElementById(`${type}-otp-${index - 1}`)
        prevInput?.focus()
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // العرض
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        
        {/* الشعار والعنوان */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl mb-4 shadow-lg">
            <span className="text-4xl">🏛️</span>
          </div>
          <h1 className="text-3xl font-bold text-white">ExoLex</h1>
          <p className="text-slate-400 mt-1">تسجيل شريك قانوني</p>
        </div>

        {/* مؤشر الخطوات */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[
            { num: 1, label: 'التحقق', active: step === 'verify' },
            { num: 2, label: 'البيانات', active: step === 'form' },
            { num: 3, label: 'التأكيد', active: step === 'success' },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                s.active ? 'bg-blue-500 text-white' : 
                (step === 'success' || (step === 'form' && s.num === 1)) ? 'bg-green-500 text-white' : 
                'bg-slate-700 text-slate-400'
              }`}>
                {(step === 'success' || (step === 'form' && s.num === 1)) && s.num < 3 ? '✓' : s.num}
              </div>
              <span className={`mr-2 text-sm ${s.active ? 'text-white' : 'text-slate-500'}`}>{s.label}</span>
              {i < 2 && <div className="w-12 h-0.5 bg-slate-700 mx-2"></div>}
            </div>
          ))}
        </div>

        {/* البطاقة الرئيسية */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          
          {/* ═══════════════════════════════════════════════════════════ */}
          {/* الخطوة 1: التحقق */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === 'verify' && (
            <div className="p-8">
              <h2 className="text-xl font-bold text-slate-800 text-center mb-6">
                التحقق من الهوية
              </h2>

              {!otpSent ? (
                <>
                  {/* رقم الهوية */}
                  <div className="mb-5">
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      رقم هوية المدير <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={managerNationalId}
                      onChange={(e) => setManagerNationalId(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="أدخل رقم الهوية (10 أرقام)"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-right"
                      maxLength={10}
                    />
                    <p className="text-xs text-slate-400 mt-1">الهوية الوطنية تبدأ بـ 1، الإقامة تبدأ بـ 2 أو 3</p>
                  </div>

                  {/* رقم الجوال */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      رقم الجوال <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="bg-slate-100 border border-slate-300 rounded-xl px-4 py-3 text-slate-500 font-medium">
                        966+
                      </div>
                      <input
                        type="text"
                        value={managerPhone}
                        onChange={(e) => setManagerPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                        placeholder="5xxxxxxxx"
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        style={{ direction: 'ltr' }}
                        maxLength={9}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSendOTP}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        جاري التحقق...
                      </span>
                    ) : (
                      'إرسال رمز التحقق'
                    )}
                  </button>
                </>
              ) : (
                <>
                  {/* إدخال OTP */}
                  <p className="text-slate-500 text-center mb-6 text-sm">
                    تم إرسال رمز التحقق عبر الواتساب إلى<br />
                    <span className="font-semibold text-slate-700" style={{ direction: 'ltr', display: 'inline-block' }}>
                      +966 {managerPhone}
                    </span>
                  </p>

                  <div className="flex justify-center gap-2 mb-4" dir="ltr">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`phone-otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value, 'phone')}
                        onKeyDown={(e) => handleOtpKeyDown(index, e, 'phone')}
                        className="w-12 h-14 text-center text-xl font-bold border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                        maxLength={1}
                      />
                    ))}
                  </div>

                  <p className="text-center text-sm text-slate-400 mb-6">⏱️ الرمز صالح لمدة 5 دقائق</p>

                  <button
                    onClick={handleVerifyOTP}
                    disabled={isLoading || otp.join('').length !== 6}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 mb-4"
                  >
                    {isLoading ? 'جاري التحقق...' : 'تحقق واستمر'}
                  </button>

                  <button
                    onClick={() => { setOtp(['', '', '', '', '', '']); handleSendOTP() }}
                    className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    لم يصلك الرمز؟ إعادة الإرسال
                  </button>
                </>
              )}

              {/* رابط تسجيل الدخول */}
              <div className="mt-6 pt-6 border-t border-slate-200 text-center">
                <p className="text-slate-500 text-sm">
                  لديك حساب بالفعل؟{' '}
                  <Link href="/auth/partner-login" className="text-blue-600 hover:text-blue-700 font-medium">
                    تسجيل الدخول
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* الخطوة 2: نموذج البيانات */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === 'form' && (
            <div className="p-8">
              <h2 className="text-xl font-bold text-slate-800 text-center mb-6">
                بيانات الشريك القانوني
              </h2>

              {/* ═══ بيانات الكيان ═══ */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm">🏢</span>
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
                        entityType === 'office' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
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
                        entityType === 'company' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
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

                  {/* الاسم التجاري */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      الاسم التجاري <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={companyNameAr}
                      onChange={(e) => setCompanyNameAr(e.target.value)}
                      placeholder="مثال: مكتب الحقوق للمحاماة"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-right"
                    />
                  </div>

                  {/* رقم السجل التجاري */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      رقم السجل التجاري <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={commercialRegNumber}
                      onChange={(e) => setCommercialRegNumber(e.target.value)}
                      placeholder="رقم السجل"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* تاريخ انتهاء السجل */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      تاريخ انتهاء السجل <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={commercialRegExpiry}
                      onChange={(e) => setCommercialRegExpiry(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* رقم الرخصة */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      رقم رخصة الكيان <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="رقم الرخصة"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-right"
                    />
                  </div>

                  {/* رقم الهوية (للقراءة فقط) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      رقم الهوية
                    </label>
                    <input
                      type="text"
                      value={managerNationalId}
                      disabled
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-100 text-slate-500"
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
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* رقم رخصة المدير (اختياري) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      رقم رخصة المدير <span className="text-slate-400 text-xs">(اختياري)</span>
                    </label>
                    <input
                      type="text"
                      value={managerLicenseNumber}
                      onChange={(e) => setManagerLicenseNumber(e.target.value)}
                      placeholder="إن وجد"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* تاريخ انتهاء رخصة المدير */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      تاريخ انتهاء الرخصة <span className="text-slate-400 text-xs">(اختياري)</span>
                    </label>
                    <input
                      type="date"
                      value={managerLicenseExpiry}
                      onChange={(e) => setManagerLicenseExpiry(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* رقم الجوال (للقراءة فقط) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      رقم الجوال
                    </label>
                    <div className="flex gap-2">
                      <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-500">
                        966+
                      </div>
                      <input
                        type="text"
                        value={managerPhone}
                        disabled
                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl bg-slate-100 text-slate-500"
                        style={{ direction: 'ltr' }}
                      />
                    </div>
                  </div>

                  {/* العنوان */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      العنوان <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="المدينة - الحي"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-right"
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
                        value={managerEmail}
                        onChange={(e) => { setManagerEmail(e.target.value); setEmailVerified(false); setEmailOtpSent(false) }}
                        placeholder="example@domain.com"
                        disabled={emailVerified}
                        className={`flex-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                          emailVerified ? 'border-green-300 bg-green-50' : 'border-slate-300'
                        }`}
                        style={{ direction: 'ltr' }}
                      />
                      {!emailVerified && (
                        <button
                          onClick={handleSendEmailOTP}
                          disabled={isLoading || !validateEmail(managerEmail)}
                          className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 transition-all"
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
                      <div className="mt-4 p-4 bg-blue-50 rounded-xl">
                        <p className="text-sm text-blue-700 mb-3">أدخل رمز التحقق المرسل للبريد:</p>
                        <div className="flex justify-center gap-2 mb-3" dir="ltr">
                          {emailOtp.map((digit, index) => (
                            <input
                              key={index}
                              id={`email-otp-${index}`}
                              type="text"
                              inputMode="numeric"
                              value={digit}
                              onChange={(e) => handleOtpChange(index, e.target.value, 'email')}
                              onKeyDown={(e) => handleOtpKeyDown(index, e, 'email')}
                              className="w-10 h-12 text-center text-lg font-bold border-2 border-blue-300 rounded-lg focus:border-blue-500 outline-none"
                              maxLength={1}
                            />
                          ))}
                        </div>
                        <button
                          onClick={handleVerifyEmailOTP}
                          disabled={isLoading || emailOtp.join('').length !== 6}
                          className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
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
                    ⚠️ <strong>مهم:</strong> لن يتم النظر في طلبكم بدون رفع السجل التجاري والرخصة
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* السجل التجاري */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      السجل التجاري <span className="text-red-500">*</span>
                    </label>
                    <label className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                      commercialRegImage ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
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
                      licenseImage ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
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
                      managerIdImage ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
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

              {/* زر التسجيل */}
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-4 px-6 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    جاري التسجيل...
                  </span>
                ) : (
                  '✅ إرسال طلب التسجيل'
                )}
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* الخطوة 3: رسالة النجاح */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === 'success' && (
            <div className="p-8 text-center">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-5xl">🎉</span>
              </div>
              
              <h2 className="text-2xl font-bold text-slate-800 mb-4">
                شكراً لتسجيلكم معنا!
              </h2>
              
              <p className="text-slate-600 mb-6 leading-relaxed">
                نفخر بانضمامكم كشريك قانوني في منصة ExoLex.<br />
                سيتم مراجعة طلبكم وإشعاركم عند تنشيط الحساب.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p className="text-blue-800 text-sm">
                  📱 <strong>للدخول:</strong> استخدم رقم السجل التجاري ({commercialRegNumber}) ورقم الجوال المسجل
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <p className="text-amber-800 text-sm">
                  ⚠️ <strong>ملاحظة:</strong> يمكنكم إضافة الهيكل التنظيمي والموظفين والخدمات، لكن لن يتم تحويل أي طلبات قانونية لكم حتى يتم تنشيط الحساب.
                </p>
              </div>

              <button
                onClick={() => router.push('/auth/partner-login')}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-4 px-6 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                🔑 الذهاب لتسجيل الدخول
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  )
}
