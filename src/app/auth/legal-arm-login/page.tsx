'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { Building2, User, ArrowLeft } from 'lucide-react'
import { setAuthCookies } from '@/lib/auth'

// ═══════════════════════════════════════════════════════════════
// 📌 صفحة دخول الذراع القانوني (محدّثة)
// ═══════════════════════════════════════════════════════════════
// ✅ دعم دخول المدير (برقم الرخصة)
// ✅ دعم دخول المحامي (برقم الجوال)
// ═══════════════════════════════════════════════════════════════

export default function LegalArmLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect')

  // نوع الدخول: manager أو lawyer
  const [loginType, setLoginType] = useState<'manager' | 'lawyer'>('manager')
  
  const [step, setStep] = useState<'input' | 'otp'>('input')
  const [isLoading, setIsLoading] = useState(false)
  
  // بيانات المدير
  const [licenseNumber, setLicenseNumber] = useState('')
  const [managerPhone, setManagerPhone] = useState('')
  
  // بيانات المحامي
  const [lawyerPhone, setLawyerPhone] = useState('')
  
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [userData, setUserData] = useState<any>(null)

  // ─────────────────────────────────────────────────────────────
  // التحقق من صحة البيانات
  // ─────────────────────────────────────────────────────────────
  
  const validatePhone = (p: string): boolean => {
    const phoneClean = p.replace(/\D/g, '')
    return phoneClean.length === 9 && phoneClean.startsWith('5')
  }

  // ─────────────────────────────────────────────────────────────
  // إرسال OTP للمدير
  // ─────────────────────────────────────────────────────────────
  
  const handleManagerSendOTP = async () => {
    if (!licenseNumber.trim() || licenseNumber.length < 3) {
      toast.error('الرجاء إدخال رقم الرخصة بشكل صحيح')
      return
    }
    
    if (!validatePhone(managerPhone)) {
      toast.error('رقم الجوال يجب أن يكون 9 أرقام ويبدأ بـ 5')
      return
    }

    setIsLoading(true)
    
    try {
      const fullPhone = '+966' + managerPhone

      // التحقق من وجود الذراع برقم الرخصة
      const { data: legalArm, error: armError } = await supabase
        .from('legal_arms')
        .select('id, license_number, phone, name_ar, status, manager_national_id')
        .eq('license_number', licenseNumber.trim())
        .maybeSingle()

      if (!legalArm) {
        toast.error('رقم الرخصة غير مسجل في النظام')
        setIsLoading(false)
        return
      }

      // التحقق من تطابق رقم الجوال
      if (legalArm.phone !== fullPhone) {
        toast.error('رقم الجوال لا يتطابق مع رقم الرخصة')
        setIsLoading(false)
        return
      }

      // التحقق من حالة الحساب
      if (legalArm.status === 'suspended' || legalArm.status === 'rejected') {
        toast.error('الحساب موقوف أو مرفوض، تواصل مع الإدارة')
        setIsLoading(false)
        return
      }

      setUserData({ ...legalArm, type: 'manager' })
      await sendOTP(fullPhone, 'legal_arm_login')
      
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('حدث خطأ، حاول مرة أخرى')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // إرسال OTP للمحامي
  // ─────────────────────────────────────────────────────────────
  
  const handleLawyerSendOTP = async () => {
    if (!validatePhone(lawyerPhone)) {
      toast.error('رقم الجوال يجب أن يكون 9 أرقام ويبدأ بـ 5')
      return
    }

    setIsLoading(true)
    
    try {
      const fullPhone = '+966' + lawyerPhone

      // البحث عن المحامي
      const { data: lawyer, error: lawyerError } = await supabase
        .from('lawyers')
        .select('*, legal_arm:legal_arm_id(id, name_ar)')
        .eq('phone', fullPhone)
        .eq('lawyer_type', 'legal_arm')
        .maybeSingle()

      if (!lawyer) {
        toast.error('رقم الجوال غير مسجل كمحامي في الذراع القانوني')
        setIsLoading(false)
        return
      }

      // التحقق من الحالة
      if (lawyer.status === 'terminated' || lawyer.status === 'inactive') {
        toast.error('حسابك غير نشط، تواصل مع المسؤول')
        setIsLoading(false)
        return
      }

      if (lawyer.admin_approval_status === 'pending') {
        toast.error('حسابك قيد المراجعة، انتظر الموافقة')
        setIsLoading(false)
        return
      }

      setUserData({ ...lawyer, type: 'lawyer' })
      await sendOTP(fullPhone, 'lawyer_login')
      
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('حدث خطأ، حاول مرة أخرى')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // إرسال OTP (مشترك)
  // ─────────────────────────────────────────────────────────────
  
  const sendOTP = async (phone: string, purpose: string) => {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { error: otpError } = await supabase
      .from('otp_verifications')
      .insert({
        phone: phone,
        code: otpCode,
        purpose: purpose,
        expires_at: expiresAt,
        status: 'pending',
        channel: 'whatsapp',
        attempts: 0,
        max_attempts: 3
      })

    if (otpError) throw otpError

    toast.success('تم إرسال رمز التحقق')
    
    setStep('otp')
  }

  // ─────────────────────────────────────────────────────────────
  // التحقق من OTP
  // ─────────────────────────────────────────────────────────────
  
  const handleVerifyOTP = async () => {
    const otpCode = otp.join('')
    if (otpCode.length !== 6) {
      toast.error('الرجاء إدخال رمز التحقق كاملاً')
      return
    }

    setIsLoading(true)
    const phone = loginType === 'manager' ? '+966' + managerPhone : '+966' + lawyerPhone
    const purpose = loginType === 'manager' ? 'legal_arm_login' : 'lawyer_login'

    try {
      const { data: otpData, error: otpError } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('phone', phone)
        .eq('code', otpCode)
        .eq('purpose', purpose)
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

      // ═══════════════════════════════════════════════════════════
      // توجيه حسب نوع المستخدم
      // ═══════════════════════════════════════════════════════════

      if (loginType === 'manager') {
        // تسجيل النشاط
        await supabase.from('activity_logs').insert({
          user_id: userData.id,
          user_type: 'legal_arm',
          activity_type: 'login',
          description: `تسجيل دخول مدير الذراع: ${userData.name_ar || 'جديد'}`,
          entity_type: 'legal_arm',
          entity_id: userData.id,
          legal_arm_id: userData.id,
        })

        // Set httpOnly cookies via server API
        await setAuthCookies({
          legalArmId: userData.id,
          userType: 'legal_arm'
        })

        // التوجيه
        if (!userData.name_ar || !userData.manager_national_id) {
          toast.success('مرحباً! يرجى إكمال بيانات التسجيل')
          window.location.href = '/legal-arm/complete-profile'
        } else {
          toast.success(`مرحباً بك - ${userData.name_ar}`)
          window.location.href = redirectUrl || '/legal-arm/dashboard'
        }
      } else {
        // محامي
        await supabase.from('activity_logs').insert({
          user_id: userData.user_id || userData.id,
          user_type: 'lawyer',
          activity_type: 'login',
          description: `تسجيل دخول المحامي: ${userData.full_name}`,
          entity_type: 'lawyer',
          entity_id: userData.id,
          legal_arm_id: userData.legal_arm_id,
        })

        // Set httpOnly cookies via server API
        await setAuthCookies({
          lawyerId: userData.id,
          userId: userData.user_id,
          legalArmId: userData.legal_arm_id,
          userType: 'lawyer'
        })

        toast.success(`مرحباً بك - ${userData.full_name}`)
        window.location.href = redirectUrl || '/legal-arm-lawyer/dashboard'
      }

    } catch (error: any) {
      console.error('Error:', error)
      toast.error('حدث خطأ، حاول مرة أخرى')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // إدخال OTP
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

  const handleResendOTP = () => {
    setOtp(['', '', '', '', '', ''])
    if (loginType === 'manager') {
      handleManagerSendOTP()
    } else {
      handleLawyerSendOTP()
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
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl mb-4 shadow-lg">
              <span className="text-4xl">⚖️</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-800">ExoLex</h1>
            <p className="text-slate-500 mt-1">الذراع القانوني</p>
          </div>

          {step === 'input' ? (
            <>
              {/* تبويبات نوع الدخول */}
              <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setLoginType('manager')}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    loginType === 'manager'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  المدير
                </button>
                <button
                  onClick={() => setLoginType('lawyer')}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    loginType === 'lawyer'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <User className="w-4 h-4" />
                  محامي
                </button>
              </div>

              {loginType === 'manager' ? (
                <>
                  {/* دخول المدير */}
                  <h2 className="text-lg font-semibold text-center text-slate-700 mb-4">
                    دخول مدير الذراع
                  </h2>

                  {/* رقم الرخصة */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      رقم رخصة الشركة <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="أدخل رقم الرخصة"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-right"
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
                        value={managerPhone}
                        onChange={(e) => setManagerPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                        placeholder="5xxxxxxxx"
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                        style={{ direction: 'ltr' }}
                        maxLength={9}
                      />
                    </div>
                  </div>

                  {/* زر الإرسال */}
                  <button
                    onClick={handleManagerSendOTP}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
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
                  {/* دخول المحامي */}
                  <h2 className="text-lg font-semibold text-center text-slate-700 mb-4">
                    دخول المحامي
                  </h2>

                  {/* رقم الجوال */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      رقم الجوال المسجل <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="bg-slate-100 border border-slate-300 rounded-xl px-4 py-3 text-slate-500 font-medium">
                        966+
                      </div>
                      <input
                        type="text"
                        value={lawyerPhone}
                        onChange={(e) => setLawyerPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                        placeholder="5xxxxxxxx"
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                        style={{ direction: 'ltr' }}
                        maxLength={9}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      💡 أدخل رقم الجوال الذي سجلت به عند قبول الدعوة
                    </p>
                  </div>

                  {/* زر الإرسال */}
                  <button
                    onClick={handleLawyerSendOTP}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
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

                  {/* تنبيه للمحامي الجديد */}
                  <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                    <p className="text-purple-700 text-sm text-center">
                      📧 هل لديك دعوة؟<br />
                      <span className="text-purple-600">افتح رابط الدعوة من البريد/الواتساب</span>
                    </p>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {/* شاشة OTP */}
              <h2 className="text-xl font-semibold text-center text-slate-700 mb-2">
                التحقق من الرمز
              </h2>
              <p className="text-slate-500 text-center mb-6 text-sm">
                تم إرسال رمز التحقق عبر الواتساب إلى<br />
                <span className="font-semibold text-slate-700" dir="ltr">
                  +966 {loginType === 'manager' ? managerPhone : lawyerPhone}
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
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 mb-4"
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
                onClick={handleResendOTP}
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
                className="w-full mt-4 text-slate-500 hover:text-slate-700 text-sm flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                رجوع
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
                className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 py-3 px-4 rounded-xl font-medium transition-all text-sm"
              >
                🏛️ دخول الشركاء
              </Link>
              <Link 
                href="/auth/lawyer-login"
                className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 py-3 px-4 rounded-xl font-medium transition-all text-sm"
              >
                ⚖️ دخول المستقلين
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
