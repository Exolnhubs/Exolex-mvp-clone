// ═══════════════════════════════════════════════════════════════
// 🤖 NOLEX API - مساعد المحامي الذكي
// 📅 التاريخ: 24 يناير 2026
// 🎯 الغرض: مساعدة المحامي في معالجة الطلبات وكتابة المذكرات
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

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
  try {
    const body = await request.json()
    const { messages, requestContext, lawyerId } = body

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'الرسائل مطلوبة' },
        { status: 400 }
      )
    }

    // بناء السياق من الطلب
    let contextMessage = ''
    if (requestContext) {
      contextMessage = `
📋 سياق الطلب الحالي:
- رقم الطلب: ${requestContext.ticket_number || 'غير محدد'}
- نوع الطلب: ${requestContext.request_type || 'غير محدد'}
- العنوان: ${requestContext.title || 'غير محدد'}
- الوصف: ${requestContext.description || 'غير محدد'}
- التصنيف: ${requestContext.category || 'غير محدد'}

───────────────────────────────────
`
    }

    // بناء الرسائل لـ OpenAI
    const openaiMessages: any[] = [
      { role: 'system', content: NOLEX_SYSTEM_PROMPT + (contextMessage ? '\n\n' + contextMessage : '') }
    ]

    // إضافة رسائل المحادثة
    messages.forEach((msg: { role: string; content: string }) => {
      openaiMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
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
        lawyer_id: lawyerId || null,
        request_ticket: requestContext?.ticket_number || null,
        user_message: messages[messages.length - 1]?.content || '',
        assistant_response: assistantMessage,
        request_context: requestContext || null,
        model_used: 'gpt-4o-mini',
        tokens_used: completion.usage?.total_tokens || 0
      })
    } catch (dbError) {
      // نتجاهل خطأ الحفظ ونكمل الرد
      console.error('خطأ في حفظ المحادثة:', dbError)
    }

    return NextResponse.json({
      success: true,
      message: assistantMessage
    })

  } catch (error: any) {
    console.error('❌ NOLEX Error:', error)
    
    // التحقق من نوع الخطأ
    if (error.code === 'invalid_api_key') {
      return NextResponse.json(
        { error: 'مفتاح OpenAI غير صحيح. تحقق من إعدادات .env.local' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'حدث خطأ في معالجة الطلب' },
      { status: 500 }
      )
  }
}
