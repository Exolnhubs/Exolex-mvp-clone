// ═══════════════════════════════════════════════════════════════
// 🤖 NOLEX API - مساعد المحامي الذكي
// 📅 التاريخ: 24 يناير 2026
// 🎯 الغرض: مساعدة المحامي في معالجة الطلبات وكتابة المذكرات
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { validateBody, sanitizeString, containsXSS } from '@/lib/validate'
import { chatRateLimiter, rateLimitResponse } from '@/lib/rate-limit'
import { logger, createRequestContext } from '@/lib/logger'
import { getUserFromHeaders } from '@/lib/api-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// ─────────────────────────────────────────────────────────────
// Validation Schema
// ─────────────────────────────────────────────────────────────
const NOLEX_REQUEST_SCHEMA = {
  messages: { required: true, type: 'array' as const },
  requestContext: { type: 'object' as const },
  lawyerId: { type: 'string' as const },
}

// System prompt لـ NOLEX
const NOLEX_SYSTEM_PROMPT = `أنت "نولكس" (NOLEX) - المساعد القانوني الذكي في منصة ExoLex.
أنت متخصص في القانون السعودي وتساعد المحامين في:

1. **تحليل القضايا**: فهم تفاصيل الطلب وتقديم رؤية قانونية
2. **اقتراح الإجراءات**: الخطوات القانونية المناسبة لكل نوع قضية
3. **كتابة المذكرات**: مساعدة في صياغة المذكرات القانونية
4. **الإرشاد القانوني**: توجيه المحامي للأنظمة والمواد ذات الصلة
5. **إدارة الوقت**: تقدير الوقت اللازم لكل إجراء

📋 إرشادات الرد:
- استخدم اللغة العربية الفصحى القانونية
- كن دقيقاً ومختصراً
- أشر للأنظمة السعودية ذات الصلة عند الإمكان
- قدم خطوات عملية واضحة
- إذا لم تكن متأكداً، اذكر ذلك بوضوح

⚠️ تنبيه: أنت مساعد للمحامي وليس بديلاً عنه. القرار النهائي دائماً للمحامي.`

export async function POST(request: NextRequest) {
  const ctx = createRequestContext(request)

  try {
    // Check authentication (lawyers only)
    const user = getUserFromHeaders(request)
    if (!user.userId) {
      logger.security(ctx, 'Unauthenticated NOLEX request')
      return NextResponse.json(
        { success: false, error: 'يجب تسجيل الدخول للمتابعة', requestId: ctx.requestId },
        { status: 401 }
      )
    }

    // Verify user is a lawyer or legal arm employee
    if (!user.lawyerId && !user.legalArmId) {
      logger.security(ctx, 'Non-lawyer attempted NOLEX access', { userId: user.userId, userType: user.userType })
      return NextResponse.json(
        { success: false, error: 'هذه الخدمة متاحة للمحامين فقط', requestId: ctx.requestId },
        { status: 403 }
      )
    }

    // Rate limiting - 30 requests per user per minute
    const rateLimit = chatRateLimiter.check(user.userId)
    if (!rateLimit.success) {
      logger.security(ctx, 'NOLEX rate limit exceeded', { userId: user.userId })
      return rateLimitResponse(rateLimit)
    }

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
    const validation = validateBody(body, NOLEX_REQUEST_SCHEMA)
    if (!validation.valid) {
      logger.security(ctx, 'Invalid NOLEX request', { errors: validation.errors })
      return NextResponse.json(
        { success: false, error: 'بيانات غير صالحة', details: validation.errors, requestId: ctx.requestId },
        { status: 400 }
      )
    }

    const messages = body.messages as Array<{ role: string; content: string }>
    const requestContext = body.requestContext as Record<string, unknown> | undefined

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'الرسائل مطلوبة', requestId: ctx.requestId },
        { status: 400 }
      )
    }

    // Validate and sanitize messages
    const sanitizedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []
    for (const msg of messages.slice(-20)) { // Limit to last 20 messages
      if (!msg.role || !msg.content) continue

      const content = sanitizeString(msg.content)
      if (!content) continue

      // Check for XSS
      if (containsXSS(content)) {
        logger.security(ctx, 'XSS attempt in NOLEX message', { userId: user.userId })
        return NextResponse.json(
          { success: false, error: 'محتوى غير مسموح', requestId: ctx.requestId },
          { status: 400 }
        )
      }

      // Only allow user and assistant roles
      const role = msg.role === 'user' ? 'user' : 'assistant'
      sanitizedMessages.push({ role, content })
    }

    if (sanitizedMessages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'لا توجد رسائل صالحة', requestId: ctx.requestId },
        { status: 400 }
      )
    }

    // بناء السياق من الطلب
    let contextMessage = ''
    if (requestContext) {
      contextMessage = `
📋 سياق الطلب الحالي:
- رقم الطلب: ${sanitizeString(requestContext.ticket_number) || 'غير محدد'}
- نوع الطلب: ${sanitizeString(requestContext.request_type) || 'غير محدد'}
- العنوان: ${sanitizeString(requestContext.title) || 'غير محدد'}
- الوصف: ${sanitizeString(requestContext.description) || 'غير محدد'}
- التصنيف: ${sanitizeString(requestContext.category) || 'غير محدد'}

───────────────────────────────────
`
    }

    // بناء الرسائل لـ OpenAI
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: NOLEX_SYSTEM_PROMPT + (contextMessage ? '\n\n' + contextMessage : '') }
    ]

    // إضافة رسائل المحادثة
    sanitizedMessages.forEach((msg) => {
      openaiMessages.push({
        role: msg.role,
        content: msg.content
      })
    })

    // استدعاء OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 2000
    })

    const assistantMessage = completion.choices[0]?.message?.content || 'عذراً، لم أتمكن من معالجة طلبك.'

    // حفظ المحادثة في قاعدة البيانات للتحليل
    try {
      await supabase.from('nolex_conversations').insert({
        lawyer_id: user.lawyerId || null,
        request_ticket: requestContext?.ticket_number ? sanitizeString(requestContext.ticket_number) : null,
        user_message: sanitizedMessages[sanitizedMessages.length - 1]?.content || '',
        assistant_response: assistantMessage,
        request_context: requestContext || null,
        model_used: 'gpt-4o-mini',
        tokens_used: completion.usage?.total_tokens || 0
      })
    } catch (dbError) {
      // نتجاهل خطأ الحفظ ونكمل الرد
      logger.warn('Failed to save NOLEX conversation', { error: String(dbError) })
    }

    logger.info('NOLEX completed', { userId: user.userId, tokens: completion.usage?.total_tokens })

    return NextResponse.json({
      success: true,
      message: assistantMessage,
      requestId: ctx.requestId
    })

  } catch (error) {
    logger.error(ctx, error instanceof Error ? error : new Error(String(error)))

    // التحقق من نوع الخطأ
    if (error instanceof Error && 'code' in error && error.code === 'invalid_api_key') {
      return NextResponse.json(
        { success: false, error: 'خطأ في إعداد الخادم', requestId: ctx.requestId },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'حدث خطأ في معالجة الطلب', requestId: ctx.requestId },
      { status: 500 }
    )
  }
}
