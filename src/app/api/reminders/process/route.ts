import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════
// 🔔 API معالجة التذكيرات - يعمل كل 15 دقيقة
// ═══════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const REMINDER_TIMES: Record<string, number> = {
  remind_2_days_before: 2880,
  remind_1_day_before: 1440,
  remind_8_hours_before: 480,
  remind_2_hours_before: 120,
  remind_1_hour_before: 60,
}

export async function GET(request: Request) {
  try {
    const now = new Date()
    const results = { processed: 0, reminders_created: 0, errors: [] as string[] }

    const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
    
    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('start_datetime', now.toISOString())
      .lte('start_datetime', twoDaysLater.toISOString())
      .eq('status', 'scheduled')

    if (error) throw new Error(error.message)
    if (!events?.length) return NextResponse.json({ success: true, message: 'لا توجد أحداث', results })

    for (const event of events) {
      results.processed++
      try {
        const { data: prefs } = await supabase
          .from('lawyer_reminder_preferences')
          .select('*')
          .eq('lawyer_id', event.lawyer_id)
          .single()

        const preferences = prefs || {
          remind_1_day_before: true, remind_2_hours_before: true,
          remind_via_push: true, remind_via_email: true,
          remind_poa_number: true, remind_formal_dress: true, remind_read_memos: true
        }

        const eventTime = new Date(event.start_datetime).getTime()
        const diffMinutes = Math.floor((eventTime - now.getTime()) / 60000)

        for (const [prefKey, mins] of Object.entries(REMINDER_TIMES)) {
          if (!preferences[prefKey]) continue
          if (diffMinutes <= mins && diffMinutes > (mins - 15)) {
            const { data: existing } = await supabase
              .from('session_reminders')
              .select('id')
              .eq('session_id', event.id)
              .eq('reminder_type', prefKey)
              .single()

            if (!existing) {
              await createReminder(event, preferences, prefKey, mins)
              results.reminders_created++
            }
          }
        }
      } catch (e: any) {
        results.errors.push(`${event.id}: ${e.message}`)
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function createReminder(event: any, prefs: any, reminderType: string, mins: number) {
  const checklist: string[] = []
  if (prefs.remind_poa_number) checklist.push('📜 رقم الوكالة')
  if (prefs.remind_formal_dress) checklist.push('👔 اللباس الرسمي')
  if (prefs.remind_read_memos) checklist.push('📖 قراءة المذكرات')
  if (prefs.remind_upload_memos) checklist.push('📤 رفع المذكرات')
  if (prefs.remind_bring_witnesses) checklist.push('👥 إحضار الشهود')
  if (prefs.remind_client_attendance) checklist.push('👤 حضور العميل')

  const timeText = mins >= 2880 ? 'بعد يومين' : mins >= 1440 ? 'غداً' : mins >= 480 ? 'بعد 8 ساعات' : mins >= 120 ? 'بعد ساعتين' : 'بعد ساعة'
  const eventDate = new Date(event.start_datetime)
  const dateStr = eventDate.toLocaleDateString('ar-SA')
  const timeStr = eventDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })

  const titleAr = `⏰ تذكير: ${event.title}`
  const bodyAr = `موعدك ${timeText}\n📅 ${dateStr} - ${timeStr}\n📍 ${event.location || 'غير محدد'}${checklist.length ? '\n\n✅ قائمة التحقق:\n' + checklist.join('\n') : ''}`

  await supabase.from('session_reminders').insert({
    session_id: event.id, user_id: event.lawyer_id, user_type: 'lawyer',
    reminder_type: reminderType, scheduled_at: new Date().toISOString(),
    title_ar: titleAr, body_ar: bodyAr, checklist, status: 'sent',
    sent_via_push: prefs.remind_via_push, sent_via_sms: prefs.remind_via_sms,
    sent_via_email: prefs.remind_via_email, sent_via_whatsapp: prefs.remind_via_whatsapp,
    sent_at: new Date().toISOString()
  })

  await supabase.from('notifications').insert({
    user_id: event.lawyer_id, notification_type: 'reminder',
    title_ar: titleAr, title_en: `⏰ Reminder: ${event.title}`,
    body_ar: bodyAr, body_en: `Appointment ${timeText}`,
    action_url: '/independent/calendar', action_type: 'navigate',
    reference_type: 'calendar_event', reference_id: event.id,
    priority: mins <= 120 ? 'high' : 'normal', is_read: false,
    send_push: prefs.remind_via_push, send_sms: prefs.remind_via_sms,
    send_email: prefs.remind_via_email, send_whatsapp: prefs.remind_via_whatsapp
  })

  if (event.case_id || event.request_id) {
    let memberId = null
    if (event.case_id) {
      const { data } = await supabase.from('case_management').select('member_id').eq('id', event.case_id).single()
      memberId = data?.member_id
    } else if (event.request_id) {
      const { data } = await supabase.from('service_requests').select('member_id').eq('id', event.request_id).single()
      memberId = data?.member_id
    }
    if (memberId) {
      const { data: member } = await supabase.from('members').select('user_id').eq('id', memberId).single()
      if (member?.user_id) {
        await supabase.from('notifications').insert({
          user_id: member.user_id, notification_type: 'appointment_reminder',
          title_ar: '📅 تذكير بموعدك', body_ar: `لديك موعد: ${event.title}\n📅 ${dateStr} - ${timeStr}`,
          action_url: '/subscriber/calendar', reference_type: 'calendar_event',
          reference_id: event.id, priority: 'high', is_read: false, send_push: true
        })
      }
    }
  }
}

export async function POST(request: Request) { return GET(request) }
