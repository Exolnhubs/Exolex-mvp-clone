// ═══════════════════════════════════════════════════════════════
// API: Verify Moyasar Payment
// POST /api/payments/verify
// Called after 3DS redirect to confirm payment status
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchPayment, verifyPayment, toHalalas } from '@/lib/moyasar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { payment_id, expected_amount, payment_type, member_id, package_id, service_id } = await request.json()

    if (!payment_id || !expected_amount || !payment_type || !member_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // ── 1. Fetch payment from Moyasar ───────────────────────
    const payment = await fetchPayment(payment_id)

    // ── 2. Verify payment is valid ──────────────────────────
    const verification = verifyPayment(payment, toHalalas(expected_amount))

    if (!verification.valid) {
      console.error('[Payment] Verification failed:', verification.reason)

      // Record the failed payment
      await supabase.from('payments').insert({
        payment_reference: payment.id,
        member_id,
        amount: expected_amount,
        payment_method: 'moyasar',
        status: 'failed',
        metadata: {
          moyasar_id: payment.id,
          moyasar_status: payment.status,
          failure_reason: verification.reason,
          payment_type,
        },
      })

      return NextResponse.json(
        { success: false, error: 'فشل التحقق من الدفع', reason: verification.reason },
        { status: 400 }
      )
    }

    // ── 3. Check for duplicate processing ───────────────────
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('payment_reference', payment.id)
      .eq('status', 'completed')
      .maybeSingle()

    if (existingPayment) {
      return NextResponse.json({ success: true, message: 'تم معالجة الدفع مسبقاً', already_processed: true })
    }

    // ── 4. Process based on payment type ────────────────────
    if (payment_type === 'subscription') {
      return await processSubscription(payment, member_id, package_id, expected_amount)
    } else if (payment_type === 'extra_service') {
      return await processExtraService(payment, member_id, service_id, expected_amount)
    } else {
      return NextResponse.json(
        { success: false, error: 'Unknown payment_type' },
        { status: 400 }
      )
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Payment] Verification error:', message)
    return NextResponse.json(
      { success: false, error: 'حدث خطأ في التحقق من الدفع' },
      { status: 500 }
    )
  }
}

// ─── Subscription Payment ───────────────────────────────────

async function processSubscription(
  payment: Awaited<ReturnType<typeof fetchPayment>>,
  memberId: string,
  packageId: string,
  amount: number,
) {
  // Generate payment reference
  const { data: paymentRef } = await supabase
    .rpc('generate_sequence_number', { p_code: 'PAY' })

  // Record the payment
  await supabase.from('payments').insert({
    payment_reference: paymentRef || payment.id,
    member_id: memberId,
    amount,
    payment_method: 'moyasar',
    status: 'completed',
    metadata: {
      moyasar_id: payment.id,
      payment_type: 'subscription',
      package_id: packageId,
      card_company: payment.source?.company || null,
      card_last4: payment.source?.number || null,
    },
  })

  // Fetch the package details from the database
  const { data: pkg } = await supabase
    .from('packages')
    .select('*')
    .eq('code', packageId)
    .single()

  if (!pkg) {
    return NextResponse.json({ success: false, error: 'الباقة غير موجودة' }, { status: 404 })
  }

  const now = new Date()
  const endDate = new Date(now.getTime() + pkg.duration_days * 24 * 60 * 60 * 1000)

  // Create subscription record
  await supabase.from('subscriptions').insert({
    member_id: memberId,
    package_id: pkg.id,
    status: 'active',
    consultations_remaining: pkg.consultations_limit,
    cases_remaining: pkg.cases_limit,
    nolex_remaining: pkg.nolex_queries_limit,
    library_remaining: pkg.library_searches_limit,
  })

  // Update member record
  await supabase
    .from('members')
    .update({
      subscription_status: 'active',
      current_package_id: pkg.id,
      subscription_start_date: now.toISOString(),
      subscription_end_date: endDate.toISOString(),
    })
    .eq('id', memberId)

  return NextResponse.json({
    success: true,
    message: 'تم تفعيل الاشتراك بنجاح',
    subscription: { package_id: packageId, start_date: now.toISOString(), end_date: endDate.toISOString() },
  })
}

// ─── Extra Service Payment ──────────────────────────────────

async function processExtraService(
  payment: Awaited<ReturnType<typeof fetchPayment>>,
  memberId: string,
  serviceId: string,
  amount: number,
) {
  // Fetch service details
  const { data: service } = await supabase
    .from('extra_services')
    .select('*, category:categories(id, name_ar)')
    .eq('id', serviceId)
    .single()

  if (!service) {
    return NextResponse.json({ success: false, error: 'الخدمة غير موجودة' }, { status: 404 })
  }

  // Generate ticket number
  const { data: ticketNumber } = await supabase
    .rpc('generate_sequence_number', { p_code: 'SVC' })

  // Calculate VAT
  const basePrice = service.price
  const vatAmount = basePrice * 0.15
  const totalAmount = basePrice + vatAmount

  // Create service request
  const { data: requestData, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      ticket_number: ticketNumber,
      member_id: memberId,
      request_type: 'extra_service',
      source: 'extra_services_page',
      extra_service_id: service.id,
      category_id: service.category?.id,
      title: service.name_ar,
      description: service.description_ar || service.name_ar,
      status: 'pending_assignment',
      priority: 'normal',
      base_price: basePrice,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      sla_hours: 24,
      sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single()

  if (requestError) throw requestError

  // Generate payment reference and record
  const { data: paymentRef } = await supabase
    .rpc('generate_sequence_number', { p_code: 'PAY' })

  await supabase.from('payments').insert({
    payment_reference: paymentRef || payment.id,
    member_id: memberId,
    request_id: requestData.id,
    amount,
    payment_method: 'moyasar',
    status: 'completed',
    metadata: {
      moyasar_id: payment.id,
      payment_type: 'extra_service',
      service_id: serviceId,
      card_company: payment.source?.company || null,
      card_last4: payment.source?.number || null,
    },
  })

  // Send notifications to legal arm lawyers (priority)
  const { data: legalArmLawyers } = await supabase
    .from('lawyers')
    .select('user_id')
    .eq('lawyer_type', 'legal_arm')
    .eq('status', 'active')

  if (legalArmLawyers && legalArmLawyers.length > 0) {
    const notifications = legalArmLawyers.map(lawyer => ({
      user_id: lawyer.user_id,
      notification_type: 'new_request',
      title_ar: 'طلب خدمة جديد (أولوية)',
      title_en: 'New Service Request (Priority)',
      body_ar: `طلب جديد: ${service.name_ar} - لديك أولوية القبول لمدة ساعة`,
      body_en: `New request: ${service.name_en || service.name_ar}`,
      action_url: `/legal-arm-lawyer/requests/${requestData.id}`,
      action_type: 'view_request',
      reference_type: 'service_request',
      reference_id: requestData.id,
      priority: 'high',
      send_push: true,
    }))

    await supabase.from('notifications').insert(notifications)
  }

  return NextResponse.json({
    success: true,
    message: 'تم إنشاء الطلب بنجاح',
    ticket_number: ticketNumber,
    request_id: requestData.id,
  })
}
