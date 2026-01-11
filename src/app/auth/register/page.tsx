'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

function RegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [step, setStep] = useState<'info' | 'otp'>('info')
  const [isLoading, setIsLoading] = useState(false)
  
  // Referral
  const [referralCode, setReferralCode] = useState('')
  const [referralValid, setReferralValid] = useState<boolean | null>(null)
  
  // Form Data
  const [idType, setIdType] = useState<'national_id' | 'iqama'>('national_id')
  const [nationalId, setNationalId] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  
  // OTP
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpMethod, setOtpMethod] = useState<'email' | 'sms' | 'whatsapp'>('email')
  const [otpTimer, setOtpTimer] = useState(0)
  const [generatedOtp, setGeneratedOtp] = useState('')

  // Check referral code from URL
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      setReferralCode(ref)
      validateReferralCode(ref)
      recordReferralClick(ref)
    }
  }, [searchParams])

  // OTP Timer
  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [otpTimer])

  const validateReferralCode = async (code: string) => {
    try {
      // Check in members - استخدام maybeSingle بدلاً من single
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('id')
        .eq('referral_code', code)
        .maybeSingle()
      
      if (memberData) {
        setReferralValid(true)
        return
      }
      
      // Check in affiliates
      const { data: affiliateData, error: affiliateError } = await supabase
        .from('affiliates')
        .select('id')
        .eq('affiliate_code', code)
        .maybeSingle()
      
      setReferralValid(!!affiliateData)
    } catch (err) {
      console.error('Validation error:', err)
      setReferralValid(false)
    }
  }

  const recordReferralClick = async (code: string) => {
    try {
      // تسجيل مباشر في قاعدة البيانات بدلاً من API
      await supabase.from('referral_clicks').insert({
        referral_code: code,
        device_type: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        browser: /Chrome/i.test(navigator.userAgent) ? 'Chrome' : /Safari/i.test(navigator.userAgent) ? 'Safari' : 'Other',
        os: /Mac/i.test(navigator.userAgent) ? 'macOS' : /Windows/i.test(navigator.userAgent) ? 'Windows' : 'Other'
      })
    } catch (err) {
      console.error('Failed to record click:', err)
    }
  }

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

  const validateEmail = (e: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  }

  const handleSubmitInfo = async () => {
    // Validations
    if (!validateNationalId(nationalId)) {
      toast.error(idType === 'national_id' 
        ? 'رقم الهوية يجب أن يكون 10 أرقام ويبدأ بـ 1' 
        : 'رقم الإقامة يجب أن يكون 10 أرقام ويبدأ بـ 2 أو 3')
      return
    }
    
    if (!fullName || fullName.length < 3) {
      toast.error('يرجى إدخال الاسم الكامل')
      return
    }
    
    if (!validateEmail(email)) {
      toast.error('يرجى إدخال بريد إلكتروني صحيح')
      return
    }
    
    if (!validatePhone(phone)) {
      toast.error('رقم الجوال يجب أن يكون 9 أرقام ويبدأ بـ 5')
      return
    }
    
    if (password.length < 8) {
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      return
    }
    
    if (password !== confirmPassword) {
      toast.error('كلمة المرور غير متطابقة')
      return
    }
    
    if (!agreeTerms) {
      toast.error('يجب الموافقة على الشروط والأحكام')
      return
    }

    setIsLoading(true)

    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('national_id', nationalId)
        .maybeSingle()
      
      if (existingUser) {
        toast.error('هذا الحساب مسجل مسبقاً. يرجى تسجيل الدخول')
        setIsLoading(false)
        return
      }

      // Check email
      const { data: existingEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      
      if (existingEmail) {
        toast.error('هذا البريد الإلكتروني مستخدم مسبقاً')
        setIsLoading(false)
        return
      }

      // Generate and send OTP
      await sendOTP()
      
    } catch (err) {
      console.error('Error:', err)
      toast.error('حدث خطأ. يرجى المحاولة مرة أخرى')
    }

    setIsLoading(false)
  }

  const sendOTP = async () => {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    setGeneratedOtp(otpCode)
    
    // For development: show OTP
    console.log('🔐 OTP Code:', otpCode)
    
    if (otpMethod === 'email') {
      toast.success('تم إرسال رمز التحقق إلى بريدك الإلكتروني')
    } else {
      toast.success(`تم إرسال رمز التحقق عبر ${otpMethod === 'sms' ? 'رسالة نصية' : 'واتساب'}`)
    }
    
    setOtpTimer(60)
    setStep('otp')
  }

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value[0]
    if (!/^\d*$/.test(value)) return
    
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

  const handleVerifyOTP = async () => {
    const enteredOtp = otp.join('')
    
    if (enteredOtp.length !== 6) {
      toast.error('يرجى إدخال رمز التحقق كاملاً')
      return
    }

    setIsLoading(true)

    try {
      if (enteredOtp !== generatedOtp) {
        toast.error('رمز التحقق غير صحيح')
        setIsLoading(false)
        return
      }

      // Create user
      const userId = crypto.randomUUID()
      const fullPhone = '+966' + phone

      const { error: userError } = await supabase.from('users').insert({
        id: userId,
        national_id: nationalId,
        id_type: idType,
        full_name: fullName,
        email: email,
        phone: fullPhone,
        role: 'subscriber',
        status: 'active',
        is_verified: true,
        email_verified: true,
        phone_verified: false,
      })

      if (userError) throw userError

      // Create member
      const { data: memberData, error: memberError } = await supabase.from('members').insert({
        user_id: userId,
        membership_type: 'registered',
        free_searches_remaining: 10,
      }).select().single()

      if (memberError) throw memberError

      // Generate referral code for new user
      const newRefCode = fullName.substring(0, 4).toUpperCase().replace(/\s/g, '') + 
                         Math.random().toString(36).substring(2, 6).toUpperCase()
      
      await supabase.from('members').update({ referral_code: newRefCode }).eq('id', memberData.id)

      // Link referral if valid
      if (referralCode && referralValid) {
        // Find referrer
        const { data: referrer } = await supabase
          .from('members')
          .select('id, user_id')
          .eq('referral_code', referralCode)
          .maybeSingle()
        
        if (referrer) {
          // Update new member
          await supabase.from('members').update({ referred_by: referrer.id }).eq('id', memberData.id)
          
          // Add referral record
          await supabase.from('referrals').insert({
            affiliate_id: referrer.id,
            referred_user_id: userId,
            referred_member_id: memberData.id,
            affiliate_code_used: referralCode,
            status: 'registered',
            registered_at: new Date().toISOString()
          })
          
          // Add points to referrer
          await supabase.from('user_points').insert({
            user_id: referrer.user_id,
            member_id: referrer.id,
            points: 10,
            type: 'earned',
            reason: 'registration_referral',
            description: 'مكافأة تسجيل صديق جديد'
          })
          
          // Update referrer's total points
          await supabase.rpc('increment_points', { member_id: referrer.id, amount: 10 })
            .then(() => {})
            .catch(() => {
              // Fallback: direct update
              supabase.from('members')
                .select('total_points')
                .eq('id', referrer.id)
                .single()
                .then(({ data }) => {
                  supabase.from('members')
                    .update({ total_points: (data?.total_points || 0) + 10 })
                    .eq('id', referrer.id)
                })
            })
        }
      }

      // Store user ID
      localStorage.setItem('exolex_user_id', userId)

      toast.success('🎉 تم إنشاء حسابك بنجاح!')
      router.push('/subscriber/dashboard')
      
    } catch (err) {
      console.error('Registration error:', err)
      toast.error('حدث خطأ في إنشاء الحساب')
    }

    setIsLoading(false)
  }

  const handleResendOTP = async () => {
    if (otpTimer > 0) return
    setOtp(['', '', '', '', '', ''])
    await sendOTP()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-bold text-blue-600">ExoLex</h1>
            <p className="text-gray-500 text-sm mt-1">الحماية القانونية في متناولك</p>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          
          {/* Step 1: Info */}
          {step === 'info' && (
            <>
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">إنشاء حساب جديد</h2>
              <p className="text-gray-500 text-center mb-6">أدخل بياناتك للتسجيل في المنصة</p>

              {/* Referral Badge */}
              {referralCode && (
                <div className={`mb-6 p-3 rounded-lg text-center ${
                  referralValid === true ? 'bg-green-50 border border-green-200' : 
                  referralValid === false ? 'bg-red-50 border border-red-200' : 
                  'bg-gray-50 border border-gray-200'
                }`}>
                  <p className="text-sm">
                    {referralValid === null && '🔍 جاري التحقق من كود الإحالة...'}
                    {referralValid === true && <span className="text-green-700">✅ تم تطبيق كود الإحالة: <strong>{referralCode}</strong></span>}
                    {referralValid === false && <span className="text-red-700">❌ كود الإحالة غير صالح</span>}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {/* ID Type */}
                <div className="flex gap-4 p-1 bg-gray-100 rounded-lg">
                  <button
                    onClick={() => setIdType('national_id')}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${idType === 'national_id' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
                  >
                    🪪 هوية وطنية
                  </button>
                  <button
                    onClick={() => setIdType('iqama')}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${idType === 'iqama' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
                  >
                    📄 إقامة
                  </button>
                </div>

                {/* National ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {idType === 'national_id' ? 'رقم الهوية الوطنية' : 'رقم الإقامة'}
                  </label>
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder={idType === 'national_id' ? '1xxxxxxxxx' : '2xxxxxxxxx'}
                    className="w-full border rounded-lg px-4 py-3 text-left"
                    dir="ltr"
                    maxLength={10}
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="الاسم كما هو في الهوية"
                    className="w-full border rounded-lg px-4 py-3"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full border rounded-lg px-4 py-3 text-left"
                    dir="ltr"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم الجوال</label>
                  <div className="flex gap-2">
                    <div className="flex items-center bg-gray-100 px-3 rounded-lg text-gray-600">
                      <span className="text-sm">🇸🇦 +966</span>
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      placeholder="5xxxxxxxx"
                      className="flex-1 border rounded-lg px-4 py-3 text-left"
                      dir="ltr"
                      maxLength={9}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8 أحرف على الأقل"
                    className="w-full border rounded-lg px-4 py-3"
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تأكيد كلمة المرور</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد إدخال كلمة المرور"
                    className="w-full border rounded-lg px-4 py-3"
                  />
                </div>

                {/* OTP Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">طريقة استلام رمز التحقق</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setOtpMethod('email')}
                      className={`p-3 rounded-lg border-2 text-center transition-colors ${otpMethod === 'email' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                    >
                      <span className="text-xl">📧</span>
                      <p className="text-xs mt-1">بريد</p>
                    </button>
                    <button
                      onClick={() => setOtpMethod('sms')}
                      className={`p-3 rounded-lg border-2 text-center transition-colors ${otpMethod === 'sms' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}
                    >
                      <span className="text-xl">📱</span>
                      <p className="text-xs mt-1">SMS</p>
                    </button>
                    <button
                      onClick={() => setOtpMethod('whatsapp')}
                      className={`p-3 rounded-lg border-2 text-center transition-colors ${otpMethod === 'whatsapp' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                    >
                      <span className="text-xl">💬</span>
                      <p className="text-xs mt-1">واتساب</p>
                    </button>
                  </div>
                </div>

                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="w-5 h-5 mt-0.5 text-blue-500 rounded"
                  />
                  <span className="text-sm text-gray-600">
                    أوافق على{' '}
                    <Link href="/terms" className="text-blue-500 hover:underline">الشروط والأحكام</Link>
                    {' '}و{' '}
                    <Link href="/privacy" className="text-blue-500 hover:underline">سياسة الخصوصية</Link>
                  </span>
                </label>

                {/* Submit */}
                <button
                  onClick={handleSubmitInfo}
                  disabled={isLoading}
                  className="w-full py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? 'جاري التحقق...' : 'التالي ←'}
                </button>
              </div>

              <p className="text-center text-sm text-gray-500 mt-6">
                لديك حساب؟{' '}
                <Link href="/auth/login" className="text-blue-500 font-medium hover:underline">
                  تسجيل الدخول
                </Link>
              </p>
            </>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <>
              <button onClick={() => setStep('info')} className="text-gray-400 hover:text-gray-600 mb-4">
                → رجوع
              </button>
              
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">التحقق من الحساب</h2>
              <p className="text-gray-500 text-center mb-6">
                أدخل رمز التحقق المرسل إلى<br />
                <span className="font-medium text-gray-700">
                  {otpMethod === 'email' ? email : '+966' + phone}
                </span>
              </p>

              {/* OTP Inputs */}
              <div className="flex justify-center gap-2 mb-6" dir="ltr">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg focus:border-blue-500 focus:outline-none"
                    maxLength={1}
                  />
                ))}
              </div>

              {/* Timer & Resend */}
              <div className="text-center mb-6">
                {otpTimer > 0 ? (
                  <p className="text-gray-500">
                    إعادة الإرسال خلال <span className="font-bold text-blue-500">{otpTimer}</span> ثانية
                  </p>
                ) : (
                  <button onClick={handleResendOTP} className="text-blue-500 font-medium hover:underline">
                    إعادة إرسال الرمز
                  </button>
                )}
              </div>

              {/* Dev hint */}
              <div className="mb-4 p-3 bg-yellow-50 rounded-lg text-center">
                <p className="text-xs text-yellow-700">🔧 للتطوير: الرمز هو <strong>{generatedOtp}</strong></p>
              </div>

              {/* Verify */}
              <button
                onClick={handleVerifyOTP}
                disabled={isLoading || otp.join('').length !== 6}
                className="w-full py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'جاري التحقق...' : 'تأكيد ✓'}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          © 2024 ExoLex. جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <RegisterContent />
    </Suspense>
  )
}
