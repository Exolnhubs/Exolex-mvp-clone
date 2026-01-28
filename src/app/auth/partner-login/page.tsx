'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { setPartnerAuthCookies } from '@/lib/auth'

// ═══════════════════════════════════════════════════════════════
// 📌 صفحة دخول الشريك القانوني
// 📅 تاريخ: 4 يناير 2026
// 🎯 الغرض: دخول الشريك برقم رخصة الشركة + OTP
// ═══════════════════════════════════════════════════════════════

export default function PartnerLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect')
  const [step, setStep] = useState<'input' | 'otp'>('input')
  const [isLoading, setIsLoading] = useState(false)
  
  const [licenseNumber, setLicenseNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [partnerData, setPartnerData] = useState<any>(null)

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

      // التحقق من وجود الشريك برقم الرخصة
      const { data: partner, error: partnerError } = await supabase
        .from('partners')
        .select('id, license_number, manager_phone, company_name_ar, status')
        .eq('license_number', licenseNumber.trim())
        .maybeSingle()

      if (!partner) {
        toast.error('رقم الرخصة غير مسجل في النظام')
        setIsLoading(false)
        return
      }

      // التحقق من تطابق رقم الجوال
      if (partner.manager_phone !== fullPhone) {
        toast.error('رقم الجوال غير مطابق للمسجل في النظام')
        setIsLoading(false)
        return
      }

      // التحقق من حالة الحساب
      if (partner.status === 'suspended') {
        toast.error('حسابكم موقوف، الرجاء التواصل مع الدعم')
        setIsLoading(false)
        return
      }

      if (partner.status === 'rejected') {
        toast.error('تم رفض طلب التسجيل، الرجاء التواصل مع الدعم')
        setIsLoading(false)
        return
      }

      setPartnerData(partner)

      // إنشاء OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

      const { error: otpError } = await supabase
        .from('otp_verifications')
        .insert({
          phone: fullPhone,
          code: otpCode,
          purpose: 'partner_login',
          expires_at: expiresAt,
          national_id: licenseNumber,
          status: 'pending',
          channel: 'whatsapp',
          attempts: 0,
          max_attempts: 3
        })

      if (otpError) throw otpError

      toast.success('تم إرسال رمز التحقق')
      
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
        .eq('purpose', 'partner_login')
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
        user_id: partnerData.id,
        user_type: 'partner',
        activity_type: 'login',
        description: `تسجيل دخول الشريك: ${partnerData.company_name_ar}`,
        entity_type: 'partner',
        entity_id: partnerData.id,
        partner_id: partnerData.id,
        metadata: { license_number: licenseNumber }
      })

      // Set httpOnly cookies via server API
      await setPartnerAuthCookies(partnerData.id)

      toast.success(`مرحباً بك - ${partnerData.company_name_ar}`)

      // التحقق من حالة الحساب وعرض تنبيه إذا لم يُفعّل
      if (partnerData.status === 'pending') {
        toast('⚠️ حسابكم قيد المراجعة، بعض الميزات محدودة', { duration: 5000 })
      }

      window.location.href = redirectUrl || '/partner/dashboard'

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        
        {/* البطاقة الرئيسية */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          
          {/* الشعار */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl mb-4 shadow-lg">
              <span className="text-4xl">🏛️</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-800">ExoLex</h1>
            <p className="text-slate-500 mt-1">بوابة الشركاء القانونيين</p>
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
                  placeholder="أدخل رقم رخصة الشركة"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-right"
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
                    className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    style={{ direction: 'ltr' }}
                    maxLength={9}
                  />
                </div>
              </div>

              {/* زر الإرسال */}
              <button
                onClick={handleSendOTP}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="w-12 h-14 text-center text-xl font-bold border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
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
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
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
                className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium"
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
              سجّل شركتك أو مكتبك كشريك قانوني في منصة ExoLex
            </p>
            
            <Link 
              href="/partner/register"
              className="inline-block w-full bg-white/10 hover:bg-white/20 text-white py-3 px-6 rounded-xl font-medium transition-all duration-200"
            >
              سجّل كشريك قانوني
            </Link>

            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-slate-500 text-sm mb-2">هل أنت محامي مستقل؟</p>
              <Link 
                href="/auth/lawyer-login"
                className="text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                دخول المحامين ←
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
