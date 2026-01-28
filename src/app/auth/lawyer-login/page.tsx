'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { setLawyerAuthCookies, setPartnerEmployeeAuthCookies } from '@/lib/auth'

// ═══════════════════════════════════════════════════════════════
// 📌 صفحة دخول المحامين
// 📅 تاريخ التحديث: 18 يناير 2026
// 🎯 الغرض: دخول المحامين (مستقل/ذراع/شريك) برقم الهوية + OTP
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
// └─────────────────┴─────────────────────┴──────────────────────────────┘
//
// 📦 localStorage المستخدم:
// - محامي ذراع: exolex_lawyer_id, exolex_lawyer_code, exolex_legal_arm_id
// - محامي مستقل: exolex_lawyer_id, exolex_lawyer_code
// - محامي شريك: exolex_employee_id, exolex_employee_code, exolex_partner_id
// ═══════════════════════════════════════════════════════════════

interface AccountData {
  id: string
  full_name: string
  phone: string
  national_id: string
  status: string
  lawyer_code?: string
  employee_code?: string
  legal_arm_id?: string
  partner_id?: string
  type: 'lawyer' | 'partner_employee'
}

export default function LawyerLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect')
  const [step, setStep] = useState<'input' | 'otp'>('input')
  const [isLoading, setIsLoading] = useState(false)
  
  const [nationalId, setNationalId] = useState('')
  const [maskedPhone, setMaskedPhone] = useState('')
  const [accountData, setAccountData] = useState<AccountData | null>(null)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])

  // ─────────────────────────────────────────────────────────────
  // التحقق من صحة رقم الهوية
  // ─────────────────────────────────────────────────────────────
  
  const validateNationalId = (id: string): boolean => {
    const cleanId = id.replace(/\D/g, '')
    // رقم الهوية السعودية 10 أرقام يبدأ بـ 1
    // رقم الإقامة 10 أرقام يبدأ بـ 2
    return cleanId.length === 10 && (cleanId.startsWith('1') || cleanId.startsWith('2'))
  }

  // ─────────────────────────────────────────────────────────────
  // إخفاء رقم الجوال (0550***580)
  // ─────────────────────────────────────────────────────────────
  const maskPhone = (phone: string): string => {
    const clean = phone.replace(/\D/g, '').slice(-9)
    if (clean.length === 9) {
      return `05${clean.slice(1, 3)}***${clean.slice(-2)}`
    }
    return phone
  }

  // ─────────────────────────────────────────────────────────────
  // البحث عن الحساب وإرسال OTP
  // ─────────────────────────────────────────────────────────────
  
  const handleSendOTP = async () => {
    if (!validateNationalId(nationalId)) {
      toast.error('الرجاء إدخال رقم هوية صحيح (10 أرقام)')
      return
    }

    setIsLoading(true)
    
    try {
      const cleanNationalId = nationalId.replace(/\D/g, '')

      // ═══════════════════════════════════════════════════════════
      // البحث في جدول lawyers أولاً
      // يشمل: المحامي المستقل + محامي الذراع القانوني
      // ═══════════════════════════════════════════════════════════
      const { data: lawyerData } = await supabase
        .from('lawyers')
        .select('id, phone, national_id, legal_arm_id, lawyer_code, status, full_name')
        .eq('national_id', cleanNationalId)
        .single()

      // ═══════════════════════════════════════════════════════════
      // إذا لم يوجد في lawyers، نبحث في partner_employees
      // يشمل: محامي الشريك
      // ═══════════════════════════════════════════════════════════
      let partnerEmployeeData = null
      if (!lawyerData) {
        const { data: peData } = await supabase
          .from('partner_employees')
          .select('id, phone, national_id, status, partner_id, employee_code, full_name')
          .eq('national_id', cleanNationalId)
          .single()
        partnerEmployeeData = peData
      }

      // التحقق من وجود الحساب
      if (!lawyerData && !partnerEmployeeData) {
        toast.error('رقم الهوية غير مسجل في النظام')
        setIsLoading(false)
        return
      }

      // تحديد نوع الحساب والبيانات
const rawData = lawyerData || partnerEmployeeData
if (!rawData) {
  toast.error('رقم الهوية غير مسجل في النظام')
  setIsLoading(false)
  return
}
const accData: AccountData = {
        id: rawData.id,
        full_name: rawData.full_name,
        phone: rawData.phone,
        national_id: rawData.national_id,
        status: rawData.status,
        type: lawyerData ? 'lawyer' : 'partner_employee',
        lawyer_code: lawyerData?.lawyer_code,
        employee_code: partnerEmployeeData?.employee_code,
        legal_arm_id: lawyerData?.legal_arm_id,
        partner_id: partnerEmployeeData?.partner_id
      }

      // التحقق من حالة الحساب
      if (accData.status === 'suspended') {
        toast.error('حسابك موقوف، الرجاء التواصل مع الدعم')
        setIsLoading(false)
        return
      }

      if (accData.status === 'pending') {
        toast.error('حسابك قيد المراجعة، سيتم إشعارك عند التفعيل')
        setIsLoading(false)
        return
      }

      // التحقق من وجود رقم جوال
      if (!accData.phone) {
        toast.error('لا يوجد رقم جوال مسجل، الرجاء التواصل مع الإدارة')
        setIsLoading(false)
        return
      }

      // تنسيق رقم الجوال
      let formattedPhone = accData.phone.replace(/\s/g, '')
      if (formattedPhone.startsWith('05')) {
        formattedPhone = '+966' + formattedPhone.substring(1)
      } else if (formattedPhone.startsWith('5')) {
        formattedPhone = '+966' + formattedPhone
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+966' + formattedPhone
      }

      // ═══════════════════════════════════════════════════════════
      // إرسال OTP عبر API
      // ═══════════════════════════════════════════════════════════
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formattedPhone,
          purpose: 'lawyer_login',
          legal_arm_id: accData.legal_arm_id || null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'حدث خطأ في إرسال الرمز')
      }

      // حفظ البيانات والانتقال لخطوة OTP
      setAccountData(accData)
      setMaskedPhone(maskPhone(accData.phone))
      setStep('otp')
      toast.success('تم إرسال رمز التحقق')

    } catch (error: any) {
      console.error('Login error:', error)
      toast.error(error.message || 'حدث خطأ، الرجاء المحاولة لاحقاً')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // التحقق من OTP وتسجيل الدخول
  // ─────────────────────────────────────────────────────────────
  
  const handleVerifyOTP = async () => {
    const otpCode = otp.join('')
    if (otpCode.length !== 6) {
      toast.error('الرجاء إدخال رمز التحقق المكون من 6 أرقام')
      return
    }

    if (!accountData) {
      toast.error('حدث خطأ، الرجاء إعادة المحاولة')
      setStep('input')
      return
    }

    setIsLoading(true)

    try {
      // تنسيق رقم الجوال
      let formattedPhone = accountData.phone.replace(/\s/g, '')
      if (formattedPhone.startsWith('05')) {
        formattedPhone = '+966' + formattedPhone.substring(1)
      } else if (formattedPhone.startsWith('5')) {
        formattedPhone = '+966' + formattedPhone
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+966' + formattedPhone
      }

      // التحقق من OTP
      const response = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formattedPhone,
          code: otpCode,
          purpose: 'lawyer_login'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'رمز التحقق غير صحيح')
      }

      // ═══════════════════════════════════════════════════════════
      // تسجيل الدخول بنجاح - Set httpOnly cookies and redirect
      // ═══════════════════════════════════════════════════════════

      if (accountData.type === 'lawyer') {
        // محامي (ذراع أو مستقل)
        if (accountData.legal_arm_id) {
          // محامي ذراع قانوني
          await setLawyerAuthCookies(accountData.id, accountData.legal_arm_id)
          toast.success(`مرحباً ${accountData.full_name}`)
          window.location.href = redirectUrl || '/legal-arm-lawyer/dashboard'
        } else {
          // محامي مستقل
          await setLawyerAuthCookies(accountData.id)
          toast.success(`مرحباً ${accountData.full_name}`)
          window.location.href = redirectUrl || '/independent/dashboard'
        }
      } else {
        // محامي شريك
        await setPartnerEmployeeAuthCookies(accountData.id, accountData.partner_id)
        toast.success(`مرحباً ${accountData.full_name}`)
        window.location.href = redirectUrl || '/partner-employee/dashboard'
      }

    } catch (error: any) {
      console.error('OTP verification error:', error)
      toast.error(error.message || 'حدث خطأ في التحقق')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // إعادة إرسال OTP
  // ─────────────────────────────────────────────────────────────
  
  const handleResendOTP = async () => {
    if (!accountData) return
    
    setIsLoading(true)
    try {
      let formattedPhone = accountData.phone.replace(/\s/g, '')
      if (formattedPhone.startsWith('05')) {
        formattedPhone = '+966' + formattedPhone.substring(1)
      } else if (formattedPhone.startsWith('5')) {
        formattedPhone = '+966' + formattedPhone
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+966' + formattedPhone
      }

      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formattedPhone,
          purpose: 'lawyer_login',
          legal_arm_id: accountData.legal_arm_id || null
        })
      })

      const result = await response.json()
      if (response.ok) {
        toast.success('تم إعادة إرسال رمز التحقق')
        setOtp(['', '', '', '', '', ''])
      } else {
        throw new Error('فشل إعادة الإرسال')
      }
    } catch (error) {
      toast.error('حدث خطأ في إعادة الإرسال')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // التعامل مع إدخال OTP
  // ─────────────────────────────────────────────────────────────
  
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    
    // الانتقال للخانة التالية
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">⚖️</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">بوابة المحامين</h1>
          <p className="text-slate-500 mt-2">تسجيل الدخول برقم الهوية</p>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            خطوة 1: إدخال رقم الهوية
        ═══════════════════════════════════════════════════════════ */}
        {step === 'input' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                رقم الهوية / الإقامة
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
                placeholder="أدخل رقم الهوية (10 أرقام)"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg tracking-wider"
                dir="ltr"
              />
              <p className="text-xs text-slate-400 mt-2 text-center">
                سيتم إرسال رمز التحقق للجوال المسجل في النظام
              </p>
            </div>

            <button
              onClick={handleSendOTP}
              disabled={isLoading || nationalId.length !== 10}
              className="w-full py-4 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  جاري البحث...
                </>
              ) : (
                'متابعة'
              )}
            </button>

            <div className="text-center pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                مدير ذراع قانوني؟{' '}
                <Link href="/auth/legal-arm-login" className="text-purple-600 hover:underline font-medium">
                  دخول المدراء
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            خطوة 2: إدخال OTP
        ═══════════════════════════════════════════════════════════ */}
        {step === 'otp' && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-slate-600 mb-2">
                تم إرسال رمز التحقق إلى
              </p>
              <p className="font-bold text-slate-800 text-lg" dir="ltr">
                {maskedPhone}
              </p>
            </div>

            {/* خانات OTP */}
            <div className="flex justify-center gap-2" dir="ltr">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-12 h-14 text-center text-xl font-bold border-2 border-slate-200 rounded-xl focus:border-purple-500 focus:outline-none"
                />
              ))}
            </div>

            <button
              onClick={handleVerifyOTP}
              disabled={isLoading || otp.join('').length !== 6}
              className="w-full py-4 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  جاري التحقق...
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                onClick={handleResendOTP}
                disabled={isLoading}
                className="text-purple-600 hover:underline"
              >
                إعادة إرسال الرمز
              </button>
              <button
                onClick={() => {
                  setStep('input')
                  setOtp(['', '', '', '', '', ''])
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                تغيير رقم الهوية
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}