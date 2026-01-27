// ═══════════════════════════════════════════════════════════════════════════════
// 📌 API Chat - NOLEX المساعد القانوني الذكي
// 📅 تاريخ التحديث: 6 يناير 2026
// 🎯 الغرض: معالجة الأسئلة القانونية + حفظ سياق المحادثة + كشف طلب المحامي
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { validateBody, sanitizeString, containsXSS } from '@/lib/validate'
import { chatRateLimiter, rateLimitResponse, getClientIdentifier } from '@/lib/rate-limit'
import { logger, createRequestContext } from '@/lib/logger'
import { getUserFromHeaders } from '@/lib/api-guard'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ─────────────────────────────────────────────────────────────
// Validation Schema
// ─────────────────────────────────────────────────────────────
const CHAT_REQUEST_SCHEMA = {
  question: { required: true, type: 'string' as const, minLength: 1, maxLength: 5000 },
  mode: { type: 'string' as const, enum: ['normal', 'consultation', 'consultation_analysis'] as const },
  context: { type: 'object' as const },
  conversationHistory: { type: 'array' as const },
}

// ─────────────────────────────────────────────────────────────
// 🚨 كلمات الحالات الطارئة
// ─────────────────────────────────────────────────────────────
const EMERGENCY_KEYWORDS = [
  'عنف', 'ضرب', 'إيذاء', 'تعذيب', 'اعتداء', 'ضربني', 'يضربني', 'ضربوني',
  'تحرش', 'اغتصاب', 'تحرشوا', 'اغتصبني', 'تحرش بي', 'هتك عرض', 'اعتداء جنسي',
  'تهديد', 'ابتزاز', 'يهددني', 'هددني', 'يبتزني', 'ابتزوني',
  'حبس', 'حبسني', 'محبوس', 'حبسوني', 'منعني', 'يمنعني', 'حرمني', 'حرموني',
  'خطف', 'اختطاف', 'خطفوني', 'خطفوها', 'اختفاء', 'مختفي',
  'إتجار', 'استغلال', 'عبودية', 'سخرة',
  'انتحار', 'أقتل نفسي', 'اقتل نفسي', 'أنهي حياتي', 'انهي حياتي', 'إيذاء نفسي',
  'مستعجل', 'طارئ', 'خطير', 'أخاف', 'خائف', 'خائفة', 'أموت', 'يقتلني', 'سيقتلني'
]

// ─────────────────────────────────────────────────────────────
// 👨‍⚖️ كلمات طلب محامي
// ─────────────────────────────────────────────────────────────
const LAWYER_REQUEST_KEYWORDS = [
  'محامي', 'محامية', 'محاميه', 'ابي محامي', 'أبي محامي', 'أبغى محامي', 'ابغى محامي',
  'اريد محامي', 'أريد محامي', 'اريد محاميه', 'أريد محامية',
  'ودني لمحامي', 'وديني لمحامي', 'حولني لمحامي', 'حوليني لمحامي',
  'تشوف لي محامي', 'شوف لي محامي', 'تشوفين لي محامية', 'شوفي لي محامية',
  'أبغى أكلم محامي', 'ابغى اكلم محامي', 'كلمني محامي',
  'وصلني بمحامي', 'تواصلني بمحامي', 'أرسلني لمحامي'
]

function detectEmergency(text: string): { isEmergency: boolean; type: string; keywords: string[] } {
  const lowerText = text.toLowerCase()
  const foundKeywords: string[] = []

  for (const keyword of EMERGENCY_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      foundKeywords.push(keyword)
    }
  }

  if (foundKeywords.length === 0) {
    return { isEmergency: false, type: '', keywords: [] }
  }

  let type = 'general'
  if (foundKeywords.some(k => ['تحرش', 'اغتصاب', 'هتك', 'جنسي'].some(t => k.includes(t)))) {
    type = 'sexual_assault'
  } else if (foundKeywords.some(k => ['عنف', 'ضرب', 'إيذاء', 'تعذيب', 'اعتداء'].some(t => k.includes(t)))) {
    type = 'violence'
  } else if (foundKeywords.some(k => ['تهديد', 'ابتزاز'].some(t => k.includes(t)))) {
    type = 'threat_blackmail'
  } else if (foundKeywords.some(k => ['انتحار', 'أقتل نفسي', 'أنهي حياتي'].some(t => k.includes(t)))) {
    type = 'self_harm'
  } else if (foundKeywords.some(k => ['حبس', 'منع', 'حرم'].some(t => k.includes(t)))) {
    type = 'restriction'
  }

  return { isEmergency: true, type, keywords: foundKeywords }
}

function detectLawyerRequest(text: string): boolean {
  const lowerText = text.toLowerCase()
  return LAWYER_REQUEST_KEYWORDS.some(keyword => lowerText.includes(keyword))
}

// ─────────────────────────────────────────────────────────────
// System Prompt الأساسي
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `أنت NOLEX، المساعد القانوني الذكي لمنصة ExoLex في المملكة العربية السعودية.

## مهمتك:
تقديم معلومات قانونية دقيقة ومفيدة بأسلوب ودود وواضح.

## 🔴 قاعدة ذهبية - تذكر المحادثة:
- تذكر دائماً ما ناقشته مع المستخدم في نفس المحادثة
- لا تنسى الموضوع الذي تحدثتم عنه
- إذا طلب محامي، لا تسأله "عن ماذا؟" بل ارجع لموضوعه الأصلي

## 📞 إذا طلب المستخدم محامي:
عندما يطلب المستخدم "محامي" أو "محامية" أو "شوف لي محامي":
1. ارجع للموضوع الذي كنتم تناقشونه
2. قل له: "حسناً، أفهم أنك تريد محامي متخصص في [الموضوع السابق]. اضغط على زر 'أريد محامي' وسأحول طلبك فوراً"
3. لا تتجاهل طلبه أبداً

## قواعد:
1. قدم معلومات قانونية عامة فقط
2. استند إلى الأنظمة السعودية
3. استخدم لغة بسيطة ومفهومة`

// ─────────────────────────────────────────────────────────────
// System Prompt لتحليل الاستشارات
// ─────────────────────────────────────────────────────────────
const getConsultationAnalysisPrompt = (userProfile: Record<string, unknown> | undefined) => {
  const genderRaw = (String(userProfile?.gender || '')).toLowerCase()
  const isFemale = genderRaw === 'female' || genderRaw === 'أنثى' || genderRaw === 'انثى' || genderRaw === 'f'

  const fullName = String(userProfile?.full_name || '')
  const firstName = fullName.split(' ')[0] || 'صديقي'
  const nationality = String(userProfile?.nationality || 'سعودي')

  const dialectStyle = nationality === 'SA' || nationality === 'سعودي'
    ? 'استخدم لهجة سعودية بسيطة وودودة'
    : 'استخدم لغة عربية فصحى بسيطة وواضحة'

  const genderAddress = isFemale
    ? 'خاطبها بصيغة المؤنث (أختي، عزيزتي، حقوقكِ، لكِ)'
    : 'خاطبه بصيغة المذكر (أخي، عزيزي، حقوقك، لك)'

  return `أنت NOLEX، المستشار القانوني الذكي والصديق الشخصي للمشترك في منصة ExoLex.

## 👤 معلومات المشترك:
- الاسم: ${firstName}
- الجنس: ${isFemale ? 'أنثى' : 'ذكر'}
- الجنسية: ${nationality}

## 🗣️ أسلوب التواصل:
- ${genderAddress}
- ${dialectStyle}
- كن ودوداً ومتعاطفاً كأنك صديق مقرب
- استخدم اسم "${firstName}" في الحديث

## 🔴 قاعدة ذهبية - تذكر المحادثة:
- تذكر دائماً ما ناقشته مع المشترك في نفس المحادثة
- إذا طلب محامي/محامية، لا تنسى موضوعه الأصلي
- لا تسأله "عن ماذا تريد التحدث؟" إذا كان قد شرح مشكلته
- عندما يطلب محامي، قل: "حسناً ${firstName}، سأحولك${isFemale ? 'ِ' : ''} الآن لمحامي${isFemale ? 'ة' : ''} متخصص${isFemale ? 'ة' : ''} في [الموضوع السابق]. اضغط${isFemale ? 'ي' : ''} على زر 'أريد محامي' 👨‍⚖️"

## 🎯 مهمتك:
1. فهم موقفه بعمق وإظهار التعاطف
2. تقديم إجابة شاملة ومفيدة
3. إقناعه بأنك ساعدته (لحماية رصيده)
4. لكن إذا كانت الحالة معقدة، اعترف بذلك بصدق

## تنسيق الإجابة:
- استخدم 📌 للحالات
- استخدم 💡 للنصائح
- استخدم ⚠️ للتحذيرات`
}

// ─────────────────────────────────────────────────────────────
// System Prompt للطوارئ
// ─────────────────────────────────────────────────────────────
const getEmergencyPrompt = (userProfile: Record<string, unknown> | undefined, emergencyType: string) => {
  const genderRaw = (String(userProfile?.gender || '')).toLowerCase()
  const isFemale = genderRaw === 'female' || genderRaw === 'أنثى' || genderRaw === 'انثى' || genderRaw === 'f'

  const fullName = String(userProfile?.full_name || '')
  const firstName = fullName.split(' ')[0] || 'صديقي'
  const genderSuffix = isFemale ? 'ي' : ''

  let emergencyGuidance = ''

  switch (emergencyType) {
    case 'sexual_assault':
      emergencyGuidance = `📞 اتصل${genderSuffix} الآن: الشرطة 911 | خط الحماية 1919`
      break
    case 'violence':
      emergencyGuidance = `📞 اتصل${genderSuffix} فوراً: الشرطة 911 | خط الحماية 1919`
      break
    case 'threat_blackmail':
      emergencyGuidance = `📞 اتصل${genderSuffix}: الجرائم المعلوماتية 920020405 | الشرطة 911`
      break
    case 'self_harm':
      emergencyGuidance = `📞 تحدث${genderSuffix} مع متخصص: 920033360 | الطوارئ 911`
      break
    default:
      emergencyGuidance = `📞 أرقام الطوارئ: الشرطة 911 | الحماية 1919 | حقوق الإنسان 920000`
  }

  return `أنت NOLEX، المستشار القانوني. هذه حالة طارئة.

## المشترك: ${firstName} (${isFemale ? 'أنثى' : 'ذكر'})

## أسلوب الرد:
- كن متعاطفاً ومطمئناً
- ${isFemale ? 'خاطبها بصيغة المؤنث' : 'خاطبه بصيغة المذكر'}
- قدم الدعم والتوجيهات الفورية

## الإرشادات:
${emergencyGuidance}

## هيكل الرد:
1. 💚 رسالة دعم
2. 🚨 أرقام الطوارئ
3. ⚖️ موقفه القانوني باختصار
4. 🤝 أخبره أنك ستحول طلبه كحالة مستعجلة`
}

// ─────────────────────────────────────────────────────────────
// معالجة الطلب
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const ctx = createRequestContext(request)

  try {
    // Check authentication (user should be logged in)
    const user = getUserFromHeaders(request)
    if (!user.userId) {
      logger.security(ctx, 'Unauthenticated chat request')
      return NextResponse.json(
        { success: false, error: 'يجب تسجيل الدخول للمتابعة', requestId: ctx.requestId },
        { status: 401 }
      )
    }

    // Rate limiting - 30 requests per user per minute
    const rateLimit = chatRateLimiter.check(user.userId)
    if (!rateLimit.success) {
      logger.security(ctx, 'Chat rate limit exceeded', { userId: user.userId })
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
    const validation = validateBody(body, CHAT_REQUEST_SCHEMA)
    if (!validation.valid) {
      logger.security(ctx, 'Invalid chat request', { errors: validation.errors })
      return NextResponse.json(
        { success: false, error: 'بيانات غير صالحة', details: validation.errors, requestId: ctx.requestId },
        { status: 400 }
      )
    }

    // Sanitize question
    const question = sanitizeString(body.question)
    if (!question) {
      return NextResponse.json(
        { success: false, error: 'السؤال مطلوب', requestId: ctx.requestId },
        { status: 400 }
      )
    }

    // Check for XSS attempts
    if (containsXSS(question)) {
      logger.security(ctx, 'XSS attempt in chat', { userId: user.userId })
      return NextResponse.json(
        { success: false, error: 'محتوى غير مسموح', requestId: ctx.requestId },
        { status: 400 }
      )
    }

    const mode = validation.sanitized.mode as string | undefined
    const context = body.context as Record<string, unknown> | undefined
    const conversationHistory = body.conversationHistory as Array<{ role: string; content: string }> | undefined

    // كشف طلب محامي
    const wantsLawyer = detectLawyerRequest(question)

    // كشف الحالات الطارئة
    const emergency = detectEmergency(question)

    // تحديد System Prompt
    let systemPrompt = SYSTEM_PROMPT
    let isEmergencyMode = false

    if (emergency.isEmergency) {
      systemPrompt = getEmergencyPrompt(context?.userProfile as Record<string, unknown> | undefined, emergency.type)
      isEmergencyMode = true
    } else if (mode === 'consultation_analysis' || mode === 'consultation') {
      systemPrompt = getConsultationAnalysisPrompt(context?.userProfile as Record<string, unknown> | undefined)
    }

    // بناء الرسائل
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ]

    // 🔴 إضافة تاريخ المحادثة السابقة (مهم جداً!)
    if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10) // آخر 10 رسائل

      for (const msg of recentHistory) {
        // Sanitize historical messages
        const content = sanitizeString(msg.content)
        if (content && !containsXSS(content)) {
          if (msg.role === 'user') {
            messages.push({ role: 'user', content })
          } else if (msg.role === 'assistant') {
            messages.push({ role: 'assistant', content })
          }
        }
      }
    }

    // إضافة سياق الاستشارة
    if (context && (mode === 'consultation_analysis' || isEmergencyMode) && !conversationHistory?.length) {
      const contextMessage = `
## 📋 تفاصيل الطلب:
- المجال: ${sanitizeString(context.category) || 'غير محدد'}
- الفرع: ${sanitizeString(context.subcategory) || 'غير محدد'}
- العنوان: ${sanitizeString(context.title) || 'غير محدد'}

## 📝 التفاصيل:
${question}

---
${isEmergencyMode ? 'حالة طارئة. قدم الدعم الفوري.' : 'حلل الطلب وقدم إجابة شاملة.'}`
      messages.push({ role: 'user', content: contextMessage })
    } else {
      messages.push({ role: 'user', content: question })
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: isEmergencyMode ? 0.3 : 0.5,
      max_tokens: 2500,
    })

    let answer = completion.choices[0]?.message?.content || 'لم أتمكن من الإجابة'

    const isOutOfScope = answer.startsWith('OUT_OF_SCOPE:')
    if (isOutOfScope) {
      answer = answer.replace('OUT_OF_SCOPE:', '').trim()
    }

    logger.info('Chat completed', { userId: user.userId, tokens: completion.usage?.total_tokens })

    return NextResponse.json({
      success: true,
      answer,
      isOutOfScope,
      isEmergency: emergency.isEmergency,
      emergencyType: emergency.type,
      wantsLawyer,
      model: completion.model,
      tokens: completion.usage?.total_tokens || 0,
      mode: isEmergencyMode ? 'emergency' : (mode || 'normal'),
      requestId: ctx.requestId
    })

  } catch (error) {
    logger.error(ctx, error instanceof Error ? error : new Error(String(error)))

    if (error instanceof Error && 'code' in error && error.code === 'insufficient_quota') {
      return NextResponse.json(
        { success: false, error: 'انتهى رصيد OpenAI API', requestId: ctx.requestId },
        { status: 402 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'حدث خطأ في معالجة السؤال', requestId: ctx.requestId },
      { status: 500 }
    )
  }
}
