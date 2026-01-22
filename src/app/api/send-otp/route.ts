// ═══════════════════════════════════════════════════════════════
// API: إرسال OTP
// المسار: /api/send-otp
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
    const { phone, purpose, legal_arm_id, national_id, requesting_lawyer_id } = body

    // التحقق من البيانات المطلوبة
    if (!phone) {
      return NextResponse.json(
        { error: 'رقم الجوال مطلوب' },
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

    // إلغاء أي OTP سابق لنفس الرقم والغرض
    await supabase
      .from('otp_verifications')
      .update({ status: 'expired' })
      .eq('phone', formattedPhone)
      .eq('purpose', purpose || 'login')
      .eq('status', 'pending')

    // إنشاء رمز OTP جديد (6 أرقام)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    
    // تاريخ انتهاء الصلاحية (5 دقائق)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    // حفظ OTP في قاعدة البيانات
    const { data, error } = await supabase
      .from('otp_verifications')
      .insert({
        phone: formattedPhone,
        code: otpCode,
        purpose: purpose || 'login',
        legal_arm_id: legal_arm_id || null,
        national_id: national_id || null,
        requesting_lawyer_id: requesting_lawyer_id || null,
        channel: 'sms',
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
        expires_at: expiresAt
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating OTP:', error)
      return NextResponse.json(
        { error: 'حدث خطأ في إنشاء رمز التحقق' },
        { status: 500 }
      )
    }

    // ═══════════════════════════════════════════════════════════
    // TODO: إرسال SMS فعلي عبر Twilio أو غيره
    // حالياً نطبع الرمز في console للتجربة
    // ═══════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════')
    console.log('🔐 رمز التحقق OTP:', otpCode)
    console.log('📱 الجوال:', formattedPhone)
    console.log('📋 الغرض:', purpose)
    console.log('═══════════════════════════════════════')

    return NextResponse.json({
      success: true,
      message: 'تم إرسال رمز التحقق',
      // للتجربة فقط - احذف هذا السطر في الإنتاج
      debug_code: process.env.NODE_ENV === 'development' ? otpCode : undefined
    })

  } catch (error: any) {
    console.error('❌ Send OTP Error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في إرسال رمز التحقق' },
      { status: 500 }
    )
  }
}