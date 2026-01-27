// ═══════════════════════════════════════════════════════════════
// API: إرسال OTP
// المسار: /api/send-otp
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateBody, sanitizePhone, isValidSaudiPhone } from '@/lib/validate'
import { otpRateLimiter, rateLimitResponse, isPhoneBlocked } from '@/lib/rate-limit'
import { logger, createRequestContext } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Validation schema for OTP request
const OTP_REQUEST_SCHEMA = {
  phone: { required: true, type: 'string' as const },
  purpose: { type: 'string' as const, enum: ['login', 'register', 'verify', 'legal_arm_invite', 'lawyer_login', 'legal_arm_login', 'partner_login'] as const },
  legal_arm_id: { type: 'string' as const },
  national_id: { type: 'string' as const },
  requesting_lawyer_id: { type: 'string' as const },
}

export async function POST(request: NextRequest) {
  const ctx = createRequestContext(request)

  try {
    // Parse and validate request body
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'طلب غير صالح', requestId: ctx.requestId },
        { status: 400 }
      )
    }

    // Validate input
    const validation = validateBody(body, OTP_REQUEST_SCHEMA)
    if (!validation.valid) {
      logger.security(ctx, 'Invalid OTP request', { errors: validation.errors })
      return NextResponse.json(
        { success: false, error: 'بيانات غير صالحة', details: validation.errors, requestId: ctx.requestId },
        { status: 400 }
      )
    }

    const { purpose, legal_arm_id, national_id, requesting_lawyer_id } = validation.sanitized

    // Sanitize and validate phone
    const formattedPhone = sanitizePhone(body.phone)
    if (!isValidSaudiPhone(formattedPhone)) {
      return NextResponse.json(
        { success: false, error: 'رقم الجوال غير صالح. يجب أن يكون رقم سعودي', requestId: ctx.requestId },
        { status: 400 }
      )
    }

    // Check if phone is blocked (too many failed attempts)
    if (isPhoneBlocked(formattedPhone)) {
      logger.security(ctx, 'Blocked phone attempted OTP', { phone: formattedPhone })
      return NextResponse.json(
        { success: false, error: 'تم حظر هذا الرقم مؤقتاً. حاول بعد ساعة', requestId: ctx.requestId },
        { status: 429 }
      )
    }

    // Rate limiting - 3 OTPs per phone per hour
    const rateLimit = otpRateLimiter.check(formattedPhone)
    if (!rateLimit.success) {
      logger.security(ctx, 'OTP rate limit exceeded', { phone: formattedPhone })
      return rateLimitResponse(rateLimit)
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
    const { error } = await supabase
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

    if (error) {
      logger.error(ctx, new Error(`OTP creation failed: ${error.message}`))
      return NextResponse.json(
        { success: false, error: 'حدث خطأ في إنشاء رمز التحقق', requestId: ctx.requestId },
        { status: 500 }
      )
    }

    // ═══════════════════════════════════════════════════════════
    // TODO: إرسال SMS فعلي عبر Twilio أو غيره
    // حالياً نطبع الرمز في console للتجربة
    // ═══════════════════════════════════════════════════════════
    if (process.env.NODE_ENV !== 'production') {
      console.log('═══════════════════════════════════════')
      console.log('🔐 رمز التحقق OTP:', otpCode)
      console.log('📱 الجوال:', formattedPhone)
      console.log('📋 الغرض:', purpose)
      console.log('═══════════════════════════════════════')
    }

    logger.info('OTP sent successfully', { phone: formattedPhone, purpose })

    return NextResponse.json({
      success: true,
      message: 'تم إرسال رمز التحقق',
      requestId: ctx.requestId,
      // للتجربة فقط - يُحذف في الإنتاج
      debug_code: process.env.NODE_ENV === 'development' ? otpCode : undefined
    })

  } catch (error) {
    logger.error(ctx, error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { success: false, error: 'حدث خطأ في إرسال رمز التحقق', requestId: ctx.requestId },
      { status: 500 }
    )
  }
}
