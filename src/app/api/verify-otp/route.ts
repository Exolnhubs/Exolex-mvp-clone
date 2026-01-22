// ═══════════════════════════════════════════════════════════════
// API: التحقق من OTP
// المسار: /api/verify-otp
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, code, purpose } = body

    // التحقق من البيانات المطلوبة
    if (!phone || !code) {
      return NextResponse.json(
        { error: 'رقم الجوال ورمز التحقق مطلوبان' },
        { status: 400 }
      )
    }

    // تنسيق رقم الجوال
    let formattedPhone = phone.replace(/\s/g, '')
    if (formattedPhone.startsWith('05')) {
      formattedPhone = '+966' + formattedPhone.substring(1)
    } else if (formattedPhone.startsWith('5')) {
      formattedPhone = '+966' + formattedPhone
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+966' + formattedPhone
    }

    // البحث عن OTP صالح
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('phone', formattedPhone)
      .eq('purpose', purpose || 'login')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      console.error('❌ Error fetching OTP:', fetchError)
      return NextResponse.json(
        { error: 'حدث خطأ في التحقق' },
        { status: 500 }
      )
    }

    if (!otpRecord) {
      return NextResponse.json(
        { error: 'لا يوجد رمز تحقق صالح. يرجى طلب رمز جديد' },
        { status: 400 }
      )
    }

    // التحقق من عدد المحاولات
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await supabase
        .from('otp_verifications')
        .update({ status: 'expired' })
        .eq('id', otpRecord.id)

      return NextResponse.json(
        { error: 'تم تجاوز عدد المحاولات المسموح. يرجى طلب رمز جديد' },
        { status: 400 }
      )
    }

    // التحقق من صحة الرمز
    if (otpRecord.code !== code) {
      // زيادة عدد المحاولات
      await supabase
        .from('otp_verifications')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id)

      const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1
      return NextResponse.json(
        { error: `رمز التحقق غير صحيح. المحاولات المتبقية: ${remainingAttempts}` },
        { status: 400 }
      )
    }

    // ✅ الرمز صحيح - تحديث الحالة
    await supabase
      .from('otp_verifications')
      .update({ 
        status: 'verified',
        verified_at: new Date().toISOString()
      })
      .eq('id', otpRecord.id)

    return NextResponse.json({
      success: true,
      message: 'تم التحقق بنجاح',
      data: {
        phone: formattedPhone,
        legal_arm_id: otpRecord.legal_arm_id,
        requesting_lawyer_id: otpRecord.requesting_lawyer_id,
        national_id: otpRecord.national_id
      }
    })

  } catch (error: any) {
    console.error('❌ Verify OTP Error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في التحقق' },
      { status: 500 }
    )
  }
}