'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { setMemberAuthCookies } from '@/lib/auth'
import OtpChannelSelector from '@/components/OtpChannelSelector'

type OtpChannel = 'sms' | 'whatsapp' | 'dev'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/subscriber/dashboard'
  const [step, setStep] = useState<'input' | 'otp'>('input')
  const [isLoading, setIsLoading] = useState(false)
  
  const [idType, setIdType] = useState<'national_id' | 'iqama'>('national_id')
  const [nationalId, setNationalId] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpChannel, setOtpChannel] = useState<OtpChannel>('sms')

  const validateNationalId = (id: string): boolean => {
    if (id.length !== 10) return false
    if (!/^\d{10}$/.test(id)) return false
    if (idType === 'national_id' && !id.startsWith('1')) return false
    if (idType === 'iqama' && !['2', '3'].includes(id[0])) return false
    return true
  }

  const validatePhone = (p: string): boolean => {
    const phoneClean = p.replace(/\D/g, '')
    return phoneClean.length === 9 && phoneClean.startsWith('5')
  }

  const handleSendOTP = async () => {
    if (!validateNationalId(nationalId)) {
      toast.error(idType === 'national_id'
        ? 'رقم الهوية يجب أن يكون 10 أرقام ويبدأ بـ 1'
        : 'رقم الإقامة يجب أن يكون 10 أرقام ويبدأ بـ 2 أو 3')
      return
    }

    if (!validatePhone(phone)) {
      toast.error('رقم الجوال يجب أن يكون 9 أرقام ويبدأ بـ 5')
      return
    }

    setIsLoading(true)

    try {
      const fullPhone = '+966' + phone

      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: fullPhone,
          purpose: 'login',
          national_id: nationalId,
          channel: otpChannel,
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'حدث خطأ في إرسال الرمز')
      }

      if (otpChannel === 'dev' && result.channel === 'dev') {
        toast.success(`وضع التجربة - رمز التحقق: ${result.debug_code}`, { duration: 10000 })
      } else {
        toast.success('تم إرسال رمز التحقق')
      }

      setStep('otp')
    } catch (error: any) {
      console.error('Error:', error)
      toast.error(error.message || 'حدث خطأ، حاول مرة أخرى')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    const otpCode = otp.join('')
    if (otpCode.length !== 6) {
      toast.error('الرجاء إدخال رمز التحقق كاملاً')
      return
    }

    setIsLoading(true)
    const fullPhone = '+966' + phone

    try {
      // Verify OTP via server API
      const verifyResponse = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: fullPhone,
          code: otpCode,
          purpose: 'login',
        })
      })

      const verifyResult = await verifyResponse.json()

      if (!verifyResponse.ok) {
        toast.error(verifyResult.error || 'رمز التحقق غير صحيح أو منتهي الصلاحية')
        setIsLoading(false)
        return
      }

      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('national_id', nationalId)
        .single()

      if (existingUser) {
        // Get member_id for the user
        const { data: memberData } = await supabase
          .from('members')
          .select('id')
          .eq('user_id', existingUser.id)
          .single()

        if (!existingUser.is_profile_complete) {
          await setMemberAuthCookies(existingUser.id, memberData?.id)
          // Pass user ID via URL for profile completion
          window.location.href = `/auth/complete-profile?uid=${existingUser.id}`
        } else {
          await setMemberAuthCookies(existingUser.id, memberData?.id)
          toast.success('تم تسجيل الدخول بنجاح')
          window.location.href = redirectUrl
        }
      } else {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            national_id: nationalId,
            phone: fullPhone,
            id_type: idType,
            user_type: 'member',
            status: 'pending',
            is_profile_complete: false,
            phone_verified: true,
            preferred_language: 'ar'
          })
          .select()
          .single()

        if (createError) throw createError

        await setMemberAuthCookies(newUser.id)
        // Pass user ID via URL for profile completion
        window.location.href = `/auth/complete-profile?uid=${newUser.id}`
      }

    } catch (error: any) {
      console.error('Error:', error)
      toast.error('حدث خطأ، حاول مرة أخرى')
    } finally {
      setIsLoading(false)
    }
  }

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="card w-full max-w-md animate-fadeIn">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">ExoLex</h1>
          <p className="text-gray-500 mt-2">الحماية القانونية في متناولك</p>
        </div>

        {step === 'input' ? (
          <>
            <h2 className="text-xl font-semibold text-center mb-6">
              تسجيل الدخول / التسجيل
            </h2>

            <div className="mb-4">
              <label className="label">نوع الهوية</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="idType"
                    checked={idType === 'national_id'}
                    onChange={() => setIdType('national_id')}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span>هوية وطنية</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="idType"
                    checked={idType === 'iqama'}
                    onChange={() => setIdType('iqama')}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span>إقامة</span>
                </label>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                <span className="opacity-50">○ جواز سفر (قريباً)</span>
                <span className="mx-2 opacity-50">○ هوية خليجية (قريباً)</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="label">
                {idType === 'national_id' ? 'رقم الهوية الوطنية' : 'رقم الإقامة'} *
              </label>
              <input
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder={idType === 'national_id' ? '1xxxxxxxxx' : '2xxxxxxxxx'}
                className="input-field-ltr"
                maxLength={10}
              />
              <p className="text-xs text-gray-400 mt-1">
                {idType === 'national_id' 
                  ? '10 أرقام تبدأ بـ 1' 
                  : '10 أرقام تبدأ بـ 2 أو 3'}
              </p>
            </div>

            <div className="mb-6">
              <label className="label">رقم الجوال *</label>
              <div className="flex gap-2">
                <div className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-3 text-gray-500">
                  966+
                </div>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="5xxxxxxxx"
                  className="input-field-ltr flex-1"
                  maxLength={9}
                />
              </div>
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ يجب أن يكون الرقم المسجل في أبشر
              </p>
            </div>

            <div className="mb-6">
              <OtpChannelSelector value={otpChannel} onChange={setOtpChannel} />
            </div>

            <button
              onClick={handleSendOTP}
              disabled={isLoading}
              className="btn-primary"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  جاري الإرسال...
                </span>
              ) : (
                'إرسال رمز التحقق'
              )}
            </button>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">أو</span>
                </div>
              </div>
              <button
                disabled
                className="mt-4 w-full bg-gray-100 text-gray-400 py-3 px-6 rounded-lg font-medium cursor-not-allowed"
              >
                🔐 الدخول عبر نفاذ (قريباً)
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-center mb-2">
              التحقق من الرمز
            </h2>
            <p className="text-gray-500 text-center mb-6">
              تم إرسال رمز التحقق إلى<br />
              <span className="font-medium text-gray-700" style={{ direction: 'ltr', display: 'inline-block' }}>
                +966{phone}
              </span>
            </p>

            <div className="otp-container mb-4">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="otp-input"
                  maxLength={1}
                />
              ))}
            </div>

            <p className="text-center text-sm text-gray-500 mb-6">
              ⏱️ صالح لمدة 5 دقائق
            </p>

            <button
              onClick={handleVerifyOTP}
              disabled={isLoading || otp.join('').length !== 6}
              className="btn-primary mb-4"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  جاري التحقق...
                </span>
              ) : (
                'تحقق'
              )}
            </button>

            <div className="text-center">
              <button
                onClick={() => {
                  setOtp(['', '', '', '', '', ''])
                  handleSendOTP()
                }}
                className="text-primary-600 hover:text-primary-700 text-sm"
              >
                لم يصلك الرمز؟ إعادة الإرسال
              </button>
            </div>

            <button
              onClick={() => {
                setStep('input')
                setOtp(['', '', '', '', '', ''])
              }}
              className="mt-4 w-full text-gray-500 hover:text-gray-700 text-sm"
            >
              ← رجوع
            </button>
          </>
        )}
      </div>
    </div>
  )
}
