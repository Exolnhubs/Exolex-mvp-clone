'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════
// 📌 صفحة دخول الذراع القانوني
// 📅 تاريخ: 4 يناير 2026
// 🎯 الغرض: دخول الذراع القانوني برقم الرخصة + OTP
// ═══════════════════════════════════════════════════════════════
// ملاحظة: الذراع يُسجَّل مسبقاً من الأدمن (رقم الرخصة + الجوال)
// عند أول دخول يُحوَّل لإكمال بيانات الشركة
// ═══════════════════════════════════════════════════════════════

export default function LegalArmLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'input' | 'otp'>('input')
  const [isLoading, setIsLoading] = useState(false)
  
  const [licenseNumber, setLicenseNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [legalArmData, setLegalArmData] = useState<any>(null)

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

      // التحقق من وجود الذراع برقم الرخصة
      const { data: legalArm, error: armError } = await supabase
        .from('legal_arms')
        .select('id, license_number, phone, name_ar, status, manager_national_id')
        .eq('license_number', licenseNumber.trim())
        .maybeSingle()

      if (!legalArm) {
        toast.error('رقم الرخصة غير مسجل في النظام. يرجى التواصل مع الإدارة')
        setIsLoading(false)
        return
      }

      // التحقق من تطابق رقم الجوال
      if (legalArm.phone !== fullPhone) {
        toast.error('عذراً، رقم الجوال المسجل لا يتطابق مع رقم الرخصة. يرجى التأكد أو التواصل مع الإدارة')
        setIsLoading(false)
        return
      }

      // التحقق من حالة الحساب
      if (legalArm.status === 'suspended') {
        toast.error('حسابكم موقوف، الرجاء التواصل مع الإدارة')
        setIsLoading(false)
        return
      }

      if (legalArm.status === 'rejected') {
        toast.error('تم رفض الحساب، الرجاء التواصل مع الإدارة')
        setIsLoading(false)
        return
      }

      setLegalArmData(legalArm)

      // إنشاء OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

      const { error: otpError } = await supabase
        .from('otp_verifications')
        .insert({
          phone: fullPhone,
          code: otpCode,
          purpose: 'legal_arm_login',
          expires_at: expiresAt,
          national_id: licenseNumber,
          status: 'pending',
          channel: 'whatsapp',
          attempts: 0,
          max_attempts: 3
        })

      if (otpError) throw otpError

      console.log('🔐 رمز التحقق للذراع القانوني:', otpCode)
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
  // التحقق من OTP والتوجيه
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
      const { data: otpData, error: otpError } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('phone', fullPhone)
        .eq('code', otpCode)
        .eq('purpose', 'legal_arm_login')
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

      // تسجيل في activity_logs
      await supabase.from('activity_logs').insert({
        user_id: legalArmData.id,
        user_type: 'legal_arm',
        activity_type: 'login',
        description: `تسجيل دخول الذراع القانوني: ${legalArmData.name_ar || 'جديد'}`,
        entity_type: 'legal_arm',
        entity_id: legalArmData.id,
        legal_arm_id: legalArmData.id,
        metadata: { license_number: licenseNumber }
      })

      // حفظ بيانات الجلسة
      localStorage.setItem('exolex_legal_arm_id', legalArmData.id)
      localStorage.setItem('exolex_legal_arm_name', legalArmData.name_ar || '')
      localStorage.setItem('exolex_user_type', 'legal_arm')

      // التحقق: هل أكمل بيانات التسجيل؟
      if (!legalArmData.name_ar || !legalArmData.manager_national_id) {
        // أول دخول - يحتاج إكمال البيانات
        toast.success('مرحباً بك! يرجى إكمال بيانات التسجيل')
        router.push('/legal-arm/complete-profile')
      } else {
        // مسجل مسبقاً - لوحة التحكم
        toast.success(`مرحباً بك - ${legalArmData.name_ar}`)
        
        if (legalArmData.status === 'pending') {
          toast('⚠️ حسابكم قيد المراجعة، بعض الميزات محدودة', { duration: 5000 })
        }
        
        router.push('/legal-arm/dashboard')
      }

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
  // العرض
  // ─────────────────────────────────────────────────────────────
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        
        {/* البطاقة الرئيسية */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          
          {/* الشعار */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl mb-4 shadow-lg">
              <span className="text-4xl">⚖️</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-800">ExoLex</h1>
            <p className="text-slate-500 mt-1">الذراع القانوني</p>
          </div>

          {step === 'input' ? (
            <>
              <h2 className="text-xl font-semibold text-center text-slate-700 mb-6">
                تسجيل الدخول
              </h2>

              {/* رقم الرخصة */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  رقم رخصة الشركة <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="أدخل رقم الرخصة المسجل من الإدارة"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all text-right"
                />
              </div>

              {/* رقم الجوال */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  رقم جوال المدير <span className="text-red-500">*</span>
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
                    className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                    style={{ direction: 'ltr' }}
                    maxLength={9}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  💡 أدخل رقم الجوال المسجل لدى الإدارة
                </p>
              </div>

              {/* زر الإرسال */}
              <button
                onClick={handleSendOTP}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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

              {/* تنبيه */}
              <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                <p className="text-purple-800 text-sm text-center">
                  ℹ️ الذراع القانوني يُسجَّل من قبل إدارة ExoLex<br />
                  <span className="text-purple-600">للتسجيل، تواصل مع الإدارة</span>
                </p>
              </div>
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
                    className="w-12 h-14 text-center text-xl font-bold border-2 border-slate-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
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
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
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
                className="w-full text-purple-600 hover:text-purple-700 text-sm font-medium"
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

        {/* روابط أخرى */}
        {step === 'input' && (
          <div className="mt-6 bg-slate-800/50 backdrop-blur rounded-2xl p-6 text-center">
            <p className="text-slate-400 text-sm mb-4">
              هل أنت شريك قانوني أو محامي مستقل؟
            </p>
            
            <div className="flex gap-3">
              <Link 
                href="/auth/partner-login"
                className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 py-3 px-4 rounded-xl font-medium transition-all duration-200 text-sm"
              >
                🏛️ دخول الشركاء
              </Link>
              <Link 
                href="/auth/lawyer-login"
                className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 py-3 px-4 rounded-xl font-medium transition-all duration-200 text-sm"
              >
                ⚖️ دخول المحامين
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
