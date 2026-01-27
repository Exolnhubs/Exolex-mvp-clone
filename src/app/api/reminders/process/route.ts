import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

// ═══════════════════════════════════════════════════════════════
// 🔔 API معالجة التذكيرات - يعمل كل 15 دقيقة
// Optimized: Batch queries to avoid N+1 problem
// ═══════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const REMINDER_TIMES: Record<string, number> = {
  remind_2_days_before: 2880,
  remind_1_day_before: 1440,
  remind_8_hours_before: 480,
  remind_2_hours_before: 120,
  remind_1_hour_before: 60,
}

const DEFAULT_PREFERENCES = {
  remind_1_day_before: true,
  remind_2_hours_before: true,
  remind_via_push: true,
  remind_via_email: true,
  remind_poa_number: true,
  remind_formal_dress: true,
  remind_read_memos: true,
}

interface CalendarEvent {
  id: string
  title: string
  start_datetime: string
  location?: string
  lawyer_id: string
  case_id?: string
  request_id?: string
}

interface ReminderPreference {
  lawyer_id: string
  [key: string]: boolean | string
}

export async function GET() {
  const startTime = Date.now()

  try {
    const now = new Date()
    const results = { processed: 0, reminders_created: 0, errors: [] as string[] }

    const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)

    // ═══════════════════════════════════════════════════════════════
    // Step 1: Fetch all upcoming events (single query)
    // ═══════════════════════════════════════════════════════════════
    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('id, title, start_datetime, location, lawyer_id, case_id, request_id')
      .gte('start_datetime', now.toISOString())
      .lte('start_datetime', twoDaysLater.toISOString())
      .eq('status', 'scheduled')

    if (error) throw new Error(error.message)
    if (!events?.length) {
      return NextResponse.json({ success: true, message: 'لا توجد أحداث', results })
    }

    // ═══════════════════════════════════════════════════════════════
    // Step 2: Batch fetch all required data upfront
    // ═══════════════════════════════════════════════════════════════
    const lawyerIds = [...new Set(events.map(e => e.lawyer_id))]
    const eventIds = events.map(e => e.id)
    const caseIds = events.filter(e => e.case_id).map(e => e.case_id!)
    const requestIds = events.filter(e => e.request_id).map(e => e.request_id!)

    // Batch query 1: Get all lawyer preferences
    const { data: allPreferences } = await supabase
      .from('lawyer_reminder_preferences')
      .select('lawyer_id, remind_2_days_before, remind_1_day_before, remind_8_hours_before, remind_2_hours_before, remind_1_hour_before, remind_via_push, remind_via_sms, remind_via_email, remind_via_whatsapp, remind_poa_number, remind_formal_dress, remind_read_memos, remind_upload_memos, remind_bring_witnesses, remind_client_attendance')
      .in('lawyer_id', lawyerIds)

    // Create preferences lookup map
    const preferencesMap = new Map<string, ReminderPreference>()
    allPreferences?.forEach(p => preferencesMap.set(p.lawyer_id, p))

    // Batch query 2: Get all existing reminders for these events
    const { data: existingReminders } = await supabase
      .from('session_reminders')
      .select('session_id, reminder_type')
      .in('session_id', eventIds)

    // Create existing reminders lookup set
    const existingReminderSet = new Set<string>()
    existingReminders?.forEach(r => {
      existingReminderSet.add(`${r.session_id}:${r.reminder_type}`)
    })

    // Batch query 3: Get case member IDs
    const caseMemberMap = new Map<string, string>()
    if (caseIds.length > 0) {
      const { data: cases } = await supabase
        .from('case_management')
        .select('id, member_id')
        .in('id', caseIds)
      cases?.forEach(c => caseMemberMap.set(c.id, c.member_id))
    }

    // Batch query 4: Get request member IDs
    const requestMemberMap = new Map<string, string>()
    if (requestIds.length > 0) {
      const { data: requests } = await supabase
        .from('service_requests')
        .select('id, member_id')
        .in('id', requestIds)
      requests?.forEach(r => requestMemberMap.set(r.id, r.member_id))
    }

    // Collect all member IDs for user lookup
    const allMemberIds = [...new Set([
      ...Array.from(caseMemberMap.values()),
      ...Array.from(requestMemberMap.values())
    ])].filter(Boolean)

    // Batch query 5: Get member user IDs
    const memberUserMap = new Map<string, string>()
    if (allMemberIds.length > 0) {
      const { data: members } = await supabase
        .from('members')
        .select('id, user_id')
        .in('id', allMemberIds)
      members?.forEach(m => memberUserMap.set(m.id, m.user_id))
    }

    // ═══════════════════════════════════════════════════════════════
    // Step 3: Process events and collect inserts
    // ═══════════════════════════════════════════════════════════════
    const reminderInserts: Array<Record<string, unknown>> = []
    const notificationInserts: Array<Record<string, unknown>> = []

    for (const event of events) {
      results.processed++

      try {
        const prefs = preferencesMap.get(event.lawyer_id) || DEFAULT_PREFERENCES
        const eventTime = new Date(event.start_datetime).getTime()
        const diffMinutes = Math.floor((eventTime - now.getTime()) / 60000)

        for (const [prefKey, mins] of Object.entries(REMINDER_TIMES)) {
          // Check if preference is enabled
          if (!prefs[prefKey]) continue

          // Check if within reminder window (within 15 minutes of target time)
          if (diffMinutes <= mins && diffMinutes > (mins - 15)) {
            // Check if reminder already exists
            if (existingReminderSet.has(`${event.id}:${prefKey}`)) continue

            // Build reminder data
            const reminderData = buildReminderData(event, prefs, prefKey, mins)
            reminderInserts.push(reminderData.reminder)
            notificationInserts.push(reminderData.lawyerNotification)

            // Add client notification if applicable
            const clientNotification = buildClientNotification(
              event,
              reminderData,
              caseMemberMap,
              requestMemberMap,
              memberUserMap
            )
            if (clientNotification) {
              notificationInserts.push(clientNotification)
            }

            results.reminders_created++
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        results.errors.push(`${event.id}: ${message}`)
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // Step 4: Batch insert all reminders and notifications
    // ═══════════════════════════════════════════════════════════════
    if (reminderInserts.length > 0) {
      const { error: reminderError } = await supabase
        .from('session_reminders')
        .insert(reminderInserts)

      if (reminderError) {
        logger.warn('Failed to insert reminders', { error: reminderError.message })
      }
    }

    if (notificationInserts.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notificationInserts)

      if (notifError) {
        logger.warn('Failed to insert notifications', { error: notifError.message })
      }
    }

    const duration = Date.now() - startTime
    logger.info('Reminders processed', { ...results, duration: `${duration}ms` })

    return NextResponse.json({ success: true, results, duration: `${duration}ms` })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(null as never, error instanceof Error ? error : new Error(message))
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════
// Helper: Build reminder and notification data
// ═══════════════════════════════════════════════════════════════
function buildReminderData(
  event: CalendarEvent,
  prefs: ReminderPreference,
  reminderType: string,
  mins: number
) {
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

  const reminder = {
    session_id: event.id,
    user_id: event.lawyer_id,
    user_type: 'lawyer',
    reminder_type: reminderType,
    scheduled_at: new Date().toISOString(),
    title_ar: titleAr,
    body_ar: bodyAr,
    checklist,
    status: 'sent',
    sent_via_push: prefs.remind_via_push,
    sent_via_sms: prefs.remind_via_sms,
    sent_via_email: prefs.remind_via_email,
    sent_via_whatsapp: prefs.remind_via_whatsapp,
    sent_at: new Date().toISOString()
  }

  const lawyerNotification = {
    user_id: event.lawyer_id,
    notification_type: 'reminder',
    title_ar: titleAr,
    title_en: `⏰ Reminder: ${event.title}`,
    body_ar: bodyAr,
    body_en: `Appointment ${timeText}`,
    action_url: '/independent/calendar',
    action_type: 'navigate',
    reference_type: 'calendar_event',
    reference_id: event.id,
    priority: mins <= 120 ? 'high' : 'normal',
    is_read: false,
    send_push: prefs.remind_via_push,
    send_sms: prefs.remind_via_sms,
    send_email: prefs.remind_via_email,
    send_whatsapp: prefs.remind_via_whatsapp
  }

  return { reminder, lawyerNotification, dateStr, timeStr, titleAr }
}

// ═══════════════════════════════════════════════════════════════
// Helper: Build client notification if applicable
// ═══════════════════════════════════════════════════════════════
function buildClientNotification(
  event: CalendarEvent,
  reminderData: { dateStr: string; timeStr: string },
  caseMemberMap: Map<string, string>,
  requestMemberMap: Map<string, string>,
  memberUserMap: Map<string, string>
): Record<string, unknown> | null {
  let memberId: string | null = null

  if (event.case_id) {
    memberId = caseMemberMap.get(event.case_id) || null
  } else if (event.request_id) {
    memberId = requestMemberMap.get(event.request_id) || null
  }

  if (!memberId) return null

  const userId = memberUserMap.get(memberId)
  if (!userId) return null

  return {
    user_id: userId,
    notification_type: 'appointment_reminder',
    title_ar: '📅 تذكير بموعدك',
    body_ar: `لديك موعد: ${event.title}\n📅 ${reminderData.dateStr} - ${reminderData.timeStr}`,
    action_url: '/subscriber/calendar',
    reference_type: 'calendar_event',
    reference_id: event.id,
    priority: 'high',
    is_read: false,
    send_push: true
  }
}

export async function POST(request: Request) {
  return GET()
}
