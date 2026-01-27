// ═══════════════════════════════════════════════════════════════
// API: التحقق من OTP
// المسار: /api/verify-otp
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateBody, sanitizePhone, isValidSaudiPhone, sanitizeString } from '@/lib/validate'
import { otpVerifyRateLimiter, rateLimitResponse, blockPhone, isPhoneBlocked } from '@/lib/rate-limit'
import { logger, createRequestContext } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Validation schema for OTP verification
const OTP_VERIFY_SCHEMA = {
  phone: { required: true, type: 'string' as const },
  code: { required: true, type: 'string' as const, minLength: 6, maxLength: 6, pattern: /^[0-9]{6}$/ },
  purpose: { type: 'string' as const, enum: ['login', 'register', 'verify', 'legal_arm_invite'] as const },
}

export async function POST(request: NextRequest) {
  const ctx = createRequestContext(request)

  try {
    // Parse request body
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
    const validation = validateBody(body, OTP_VERIFY_SCHEMA)
    if (!validation.valid) {
      logger.security(ctx, 'Invalid OTP verify request', { errors: validation.errors })
      return NextResponse.json(
        { success: false, error: 'بيانات غير صالحة', details: validation.errors, requestId: ctx.requestId },
        { status: 400 }
      )
    }

    const { purpose } = validation.sanitized
    const code = sanitizeString(body.code)

    // Sanitize and validate phone
    const formattedPhone = sanitizePhone(body.phone)
    if (!isValidSaudiPhone(formattedPhone)) {
      return NextResponse.json(
        { success: false, error: 'رقم الجوال غير صالح', requestId: ctx.requestId },
        { status: 400 }
      )
    }

    // Check if phone is blocked
    if (isPhoneBlocked(formattedPhone)) {
      logger.security(ctx, 'Blocked phone attempted verification', { phone: formattedPhone })
      return NextResponse.json(
        { success: false, error: 'تم حظر هذا الرقم مؤقتاً بسبب محاولات فاشلة متكررة', requestId: ctx.requestId },
        { status: 429 }
      )
    }

    // Rate limiting - 5 verification attempts per phone per 10 minutes
    const rateLimit = otpVerifyRateLimiter.check(formattedPhone)
    if (!rateLimit.success) {
      logger.security(ctx, 'OTP verify rate limit exceeded', { phone: formattedPhone })
      // Block phone for 1 hour after too many attempts
      blockPhone(formattedPhone, 3600)
      return rateLimitResponse(rateLimit)
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
      logger.error(ctx, new Error(`OTP fetch failed: ${fetchError.message}`))
      return NextResponse.json(
        { success: false, error: 'حدث خطأ في التحقق', requestId: ctx.requestId },
        { status: 500 }
      )
    }

    if (!otpRecord) {
      logger.security(ctx, 'No valid OTP found', { phone: formattedPhone })
      return NextResponse.json(
        { success: false, error: 'لا يوجد رمز تحقق صالح. يرجى طلب رمز جديد', requestId: ctx.requestId },
        { status: 400 }
      )
    }

    // التحقق من عدد المحاولات
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await supabase
        .from('otp_verifications')
        .update({ status: 'expired' })
        .eq('id', otpRecord.id)

      logger.security(ctx, 'OTP max attempts exceeded', { phone: formattedPhone })
      return NextResponse.json(
        { success: false, error: 'تم تجاوز عدد المحاولات المسموح. يرجى طلب رمز جديد', requestId: ctx.requestId },
        { status: 400 }
      )
    }

    // التحقق من صحة الرمز (timing-safe comparison)
    const isCodeValid = timingSafeEqual(otpRecord.code, code)

    if (!isCodeValid) {
      // زيادة عدد المحاولات
      await supabase
        .from('otp_verifications')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id)

      const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1
      logger.security(ctx, 'Invalid OTP code', { phone: formattedPhone, remainingAttempts })

      // Block after 3 consecutive failures
      if (remainingAttempts <= 0) {
        blockPhone(formattedPhone, 1800) // 30 minutes
      }

      return NextResponse.json(
        { success: false, error: `رمز التحقق غير صحيح. المحاولات المتبقية: ${remainingAttempts}`, requestId: ctx.requestId },
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

    logger.info('OTP verified successfully', { phone: formattedPhone })

    return NextResponse.json({
      success: true,
      message: 'تم التحقق بنجاح',
      requestId: ctx.requestId,
      data: {
        phone: formattedPhone,
        legal_arm_id: otpRecord.legal_arm_id,
        requesting_lawyer_id: otpRecord.requesting_lawyer_id,
        national_id: otpRecord.national_id
      }
    })

  } catch (error) {
    logger.error(ctx, error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { success: false, error: 'حدث خطأ في التحقق', requestId: ctx.requestId },
      { status: 500 }
    )
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
