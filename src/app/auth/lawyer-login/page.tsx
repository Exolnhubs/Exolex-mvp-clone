'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════
// 📌 صفحة دخول المحامين
// 📅 تاريخ التحديث: 4 يناير 2026
// 🎯 الغرض: دخول المحامين (مستقل/ذراع/شريك) برقم الرخصة + OTP
// ═══════════════════════════════════════════════════════════════
// 
// 📋 أنواع المحامين والتوجيه:
// ┌─────────────────┬─────────────────────┬──────────────────────────────┐
// │ النوع           │ الجدول              │ التوجيه                      │
// ├─────────────────┼─────────────────────┼──────────────────────────────┤
// │ محامي ذراع      │ lawyers             │ /legal-arm-lawyer/dashboard  │
// │                 │ (legal_arm_id ≠ NULL)│                              │
// ├─────────────────┼─────────────────────┼──────────────────────────────┤
// │ محامي مستقل     │ lawyers             │ /independent/dashboard       │
// │                 │ (legal_arm_id = NULL)│                              │
// ├─────────────────┼─────────────────────┼──────────────────────────────┤
// │ محامي شريك      │ partner_employees   │ /partner-employee/dashboard  │
// │                 │ (license_number ≠ NULL)│                            │
// └─────────────────┴─────────────────────┴──────────────────────────────┘
//
// 📦 localStorage المستخدم:
// - محامي ذراع: exolex_lawyer_id, exolex_lawyer_code, exolex_legal_arm_id
// - محامي مستقل: exolex_lawyer_id, exolex_lawyer_code
// - محامي شريك: exolex_employee_id, exolex_employee_code, exolex_partner_id
// ═══════════════════════════════════════════════════════════════

export default function LawyerLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'input' | 'otp'>('input')
  const [isLoading, setIsLoading] = useState(false)
  
  const [licenseNumber, setLicenseNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])

  // ─────────────────────────────────────────────────────────────
  // التحقق من صحة البيانات
  // ─────────────────────────────────────────────────────────────
  
  const validateLicenseNumber = (license: string): boolean => {
    return license.trim().length >= 3
  }

  const validatePhone = (p: string): boolean => {
    const phoneClean = p.replace(/\D/g, '')
    return phoneClean.length === 9 && phoneClean.startsWith('5')
  }

  // ─────────────────────────────────────────────────────────────
  // إرسال رمز التحقق OTP
  // ─────────────────────────────────────────────────────────────
  
  const handleSendOTP = async () => {
    if (!validateLicenseNumber(licenseNumber)) {
      toast.error('الرجاء إدخال رقم الرخصة بشكل صحيح')
      return
    }
    
    if (!validatePhone(phone)) {
      toast.error('رقم الجوال يجب أن يكون 9 أرقام ويبدأ بـ 5')
      return
    }

    setIsLoading(true)
    
    try {
      const fullPhone = '+966' + phone

      // ═══════════════════════════════════════════════════════════
      // البحث في جدول lawyers أولاً
      // يشمل: المحامي المستقل + محامي الذراع القانوني
      // ═══════════════════════════════════════════════════════════
      const { data: lawyerData } = await supabase
        .from('lawyers')
        .select('id, phone, license_number, legal_arm_id, lawyer_code, status, full_name')
        .eq('license_number', licenseNumber.trim())
        .single()

      // ═══════════════════════════════════════════════════════════
      // إذا لم يوجد في lawyers، نبحث في partner_employees
      // يشمل: محامي الشريك (موظف لديه رخصة)
      // ═══════════════════════════════════════════════════════════
      let partnerEmployeeData = null
      if (!lawyerData) {
        const { data: peData } = await supabase
          .from('partner_employees')
          .select('id, phone, license_number, status, partner_id, employee_code, full_name')
          .eq('license_number', licenseNumber.trim())
          .single()
        partnerEmployeeData = peData
      }

      // التحقق من وجود الحساب
      if (!lawyerData && !partnerEmployeeData) {
        toast.error('رقم الرخصة غير مسجل في النظام')
        setIsLoading(false)
        return
      }

      // التحقق من حالة الحساب
      const accountData = lawyerData || partnerEmployeeData
      if (accountData.status === 'suspended') {
        toast.error('حسابك موقوف، الرجاء التواصل مع الدعم')
        setIsLoading(false)
        return
      }

      if (accountData.status === 'pending') {
        toast.error('حسابك قيد المراجعة، سيتم إشعارك عند التفعيل')
        setIsLoading(false)
        return
      }

      // التحقق من تطابق رقم الجوال
      const registeredPhone = accountData.phone?.replace(/\D/g, '').slice(-9)
      if (registeredPhone !== phone) {
        toast.error('رقم الجوال غير مطابق للمسجل في النظام')
        setIsLoading(false)
        return
      }

      // ═══════════════════════════════════════════════════════════
      // إنشاء OTP وإرساله
      // ═══════════════════════════════════════════════════════════
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

      const { error: otpError } = await supabase
        .from('otp_verifications')
        .insert({
          phone: fullPhone,
          code: otpCode,
          purpose: 'login',
          expires_at: expiresAt,
          national_id: licenseNumber,
          status: 'pending',
          channel: 'whatsapp',
          attempts: 0,
          max_attempts: 3
        })

      if (otpError) throw otpError

      console.log('🔐 رمز التحقق للمحامي:', otpCode)
      toast.success(`تم إرسال رمز التحقق (للتجربة: ${otpCode})`)
      
      setStep('otp')
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('حدث خطأ، حاول مرة أخرى')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // التحقق من OTP والتوجيه للوحة التحكم المناسبة
  // ─────────────────────────────────────────────────────────────
  
  const handleVerifyOTP = async () => {
    const otpCode = otp.join('')
    if (otpCode.length !== 6) {
      toast.error('الرجاء إدخال رمز التحقق كاملاً')
      return
    }

    setIsLoading(true)
    const fullPhone = '+966' + phone

    try {
      // التحقق من صحة OTP
      const { data: otpData, error: otpError } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('phone', fullPhone)
        .eq('code', otpCode)
        .eq('purpose', 'login')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (otpError || !otpData) {
        toast.error('رمز التحقق غير صحيح أو منتهي الصلاحية')
        setIsLoading(false)
        return
      }

      // تحديث حالة OTP إلى verified
      await supabase
        .from('otp_verifications')
        .update({ status: 'verified', verified_at: new Date().toISOString() })
        .eq('id', otpData.id)

      // ═══════════════════════════════════════════════════════════
      // البحث عن المحامي في جدول lawyers
      // ═══════════════════════════════════════════════════════════
      const { data: lawyerData } = await supabase
        .from('lawyers')
        .select('id, legal_arm_id, lawyer_code, status, full_name')
        .eq('license_number', licenseNumber.trim())
        .single()

      if (lawyerData) {
        // ─────────────────────────────────────────────────────────
        // حفظ معرف المحامي (مشترك لكل الأنواع)
        // ─────────────────────────────────────────────────────────
        localStorage.setItem('exolex_lawyer_id', lawyerData.id)
        localStorage.setItem('exolex_lawyer_code', lawyerData.lawyer_code || '')
        
        // التحقق من نوع المحامي والتوجيه
        if (lawyerData.legal_arm_id) {
          // ═══════════════════════════════════════════════════════
          // 🏢 محامي ذراع قانوني
          // legal_arm_id موجود = يعمل ضمن الذراع القانوني
          // ═══════════════════════════════════════════════════════
          localStorage.setItem('exolex_legal_arm_id', lawyerData.legal_arm_id)
          
          toast.success('تم تسجيل الدخول بنجاح')
          router.push('/legal-arm-lawyer/dashboard')
        } else {
          // ═══════════════════════════════════════════════════════
          // 👤 محامي مستقل
          // legal_arm_id = NULL = يعمل بشكل مستقل
          // ═══════════════════════════════════════════════════════
          toast.success('تم تسجيل الدخول بنجاح')
          router.push('/independent/dashboard')
        }
        return
      }

      // ═══════════════════════════════════════════════════════════
      // البحث في جدول partner_employees
      // (محامي يعمل لدى شريك قانوني)
      // ═══════════════════════════════════════════════════════════
      const { data: partnerEmployeeData } = await supabase
        .from('partner_employees')
        .select('id, partner_id, employee_code, status, full_name')
        .eq('license_number', licenseNumber.trim())
        .single()

      if (partnerEmployeeData) {
        // ═══════════════════════════════════════════════════════
        // 🏛️ محامي شريك (موظف لديه رخصة)
        // ═══════════════════════════════════════════════════════
        localStorage.setItem('exolex_employee_id', partnerEmployeeData.id)
        localStorage.setItem('exolex_employee_code', partnerEmployeeData.employee_code || '')
        localStorage.setItem('exolex_partner_id', partnerEmployeeData.partner_id)
        
        toast.success('تم تسجيل الدخول بنجاح')
        router.push('/partner-employee/dashboard')
        return
      }

      // لم يُعثر على الحساب في أي جدول
      toast.error('حدث خطأ في تحديد نوع الحساب')

    } catch (error: any) {
      console.error('Error:', error)
      toast.error('حدث خطأ، حاول مرة أخرى')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // التعامل مع إدخال OTP
  // ─────────────────────────────────────────────────────────────
  
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return
    if (value && !/^\d$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      prevInput?.focus()
    }
  }

  // ─────────────────────────────────────────────────────────────
  // واجهة المستخدم
  // ─────────────────────────────────────────────────────────────
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        
        {/* البطاقة الرئيسية */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          
          {/* الشعار */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl mb-4 shadow-lg">
              <span className="text-4xl">⚖️</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-800">ExoLex</h1>
            <p className="text-slate-500 mt-1">بوابة المحامين</p>
          </div>

          {step === 'input' ? (
            <>
              <h2 className="text-xl font-semibold text-center text-slate-700 mb-6">
                تسجيل الدخول
              </h2>

              {/* رقم الرخصة */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  رقم الرخصة القانونية <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="أدخل رقم رخصتك"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-right"
                />
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
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="5xxxxxxxx"
                    className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                    style={{ direction: 'ltr' }}
                    maxLength={9}
                  />
                </div>
              </div>

              {/* زر الإرسال */}
              <button
                onClick={handleSendOTP}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
              {/* شاشة OTP */}
              <h2 className="text-xl font-semibold text-center text-slate-700 mb-2">
                التحقق من الرمز
              </h2>
              <p className="text-slate-500 text-center mb-6 text-sm">
                تم إرسال رمز التحقق عبر الواتساب إلى<br />
                <span className="font-semibold text-slate-700" style={{ direction: 'ltr', display: 'inline-block' }}>
                  +966 {phone}
                </span>
              </p>

              {/* حقول OTP */}
              <div className="flex justify-center gap-2 mb-4" dir="ltr">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-12 h-14 text-center text-xl font-bold border-2 border-slate-300 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all"
                    maxLength={1}
                  />
                ))}
              </div>

              <p className="text-center text-sm text-slate-400 mb-6">
                ⏱️ الرمز صالح لمدة 5 دقائق
              </p>

              {/* زر التحقق */}
              <button
                onClick={handleVerifyOTP}
                disabled={isLoading || otp.join('').length !== 6}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    جاري التحقق...
                  </span>
                ) : (
                  'تحقق ودخول'
                )}
              </button>

              {/* إعادة الإرسال */}
              <button
                onClick={() => {
                  setOtp(['', '', '', '', '', ''])
                  handleSendOTP()
                }}
                className="w-full text-amber-600 hover:text-amber-700 text-sm font-medium"
              >
                لم يصلك الرمز؟ إعادة الإرسال
              </button>

              {/* رجوع */}
              <button
                onClick={() => {
                  setStep('input')
                  setOtp(['', '', '', '', '', ''])
                }}
                className="w-full mt-4 text-slate-500 hover:text-slate-700 text-sm"
              >
                ← رجوع
              </button>
            </>
          )}
        </div>

        {/* قسم التسجيل */}
        {step === 'input' && (
          <div className="mt-6 bg-slate-800/50 backdrop-blur rounded-2xl p-6 text-center">
            <p className="text-slate-300 font-medium mb-4">📝 ليس لديك حساب؟</p>
            
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              إذا كنت محامي مستقل أو لديك مكتب وتعمل لوحدك ولا ترغب بإضافة موظفين
            </p>
            
            <Link 
              href="/independent/register"
              className="inline-block w-full bg-white/10 hover:bg-white/20 text-white py-3 px-6 rounded-xl font-medium transition-all duration-200 mb-4"
            >
              سجّل كمحامي مستقل
            </Link>
            
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              في حال كان لديك موظفين ترغب بإضافتهم
            </p>
            
            <Link 
              href="/partner/register"
              className="inline-block w-full border border-slate-500 hover:border-slate-400 text-slate-300 hover:text-white py-3 px-6 rounded-xl font-medium transition-all duration-200"
            >
              سجّل كشريك قانوني
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
