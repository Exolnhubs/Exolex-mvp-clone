import { supabase } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════
// 🎯 نظام التوزيع التلقائي لطلبات الباقات
// 📅 تاريخ: 21 يناير 2026
// ═══════════════════════════════════════════════════════════════

interface DistributionParams {
  request_id: string
  category_code?: string
}

interface DistributionResult {
  success: boolean
  assigned_to?: string
  lawyer_name?: string
  message: string
}

export async function distributePackageRequest(params: DistributionParams): Promise<DistributionResult> {
  const { request_id, category_code } = params

  try {
    // 1. جلب المحامين المتاحين من الذراع القانوني
    const { data: lawyers, error: lawyersError } = await supabase
      .from('lawyers')
      .select('id, full_name, current_workload, max_workload, specializations, rating, experience_years')
      .eq('lawyer_type', 'legal_arm')
      .eq('is_available', true)
      .eq('status', 'active')
      .lt('current_workload', supabase.rpc('get_max_workload'))
      .order('current_workload', { ascending: true })

    if (lawyersError || !lawyers || lawyers.length === 0) {
      // لا يوجد محامين متاحين - إرسال للمدير
      return {
        success: false,
        message: 'لا يوجد محامين متاحين حالياً - تم إرسال الطلب للمدير'
      }
    }

    // 2. ترتيب المحامين حسب الأولوية
    const scoredLawyers = lawyers.map(lawyer => {
      let score = 0
      
      // أقل حمل عمل = أعلى أولوية
      const workloadRatio = lawyer.current_workload / (lawyer.max_workload || 10)
      score += (1 - workloadRatio) * 40

      // التخصص المطابق
      if (category_code && lawyer.specializations?.includes(category_code)) {
        score += 30
      }

      // التقييم
      score += (lawyer.rating || 4) * 5

      // الخبرة
      score += Math.min((lawyer.experience_years || 0) * 2, 10)

      return { ...lawyer, score }
    }).sort((a, b) => b.score - a.score)

    const selectedLawyer = scoredLawyers[0]

    // 3. تعيين الطلب للمحامي
    const { error: updateError } = await supabase
      .from('service_requests')
      .update({
        assigned_lawyer_id: selectedLawyer.id,
        handler_type: 'legal_arm',
        status: 'assigned',
        assigned_at: new Date().toISOString()
      })
      .eq('id', request_id)

    if (updateError) {
      throw updateError
    }

    // 4. تحديث عدد الطلبات للمحامي
    await supabase
      .from('lawyers')
      .update({ 
        current_workload: (selectedLawyer.current_workload || 0) + 1 
      })
      .eq('id', selectedLawyer.id)

    // 5. إرسال إشعار للمحامي
    await supabase.from('notifications').insert({
      user_id: selectedLawyer.id,
      user_type: 'lawyer',
      title: 'طلب جديد',
      message: 'تم إسناد طلب جديد إليك',
      type: 'request_assigned',
      data: { request_id }
    })

    return {
      success: true,
      assigned_to: selectedLawyer.id,
      lawyer_name: selectedLawyer.full_name,
      message: `تم إسناد الطلب إلى ${selectedLawyer.full_name}`
    }

  } catch (error) {
    console.error('Distribution error:', error)
    return {
      success: false,
      message: 'حدث خطأ أثناء توزيع الطلب'
    }
  }
}
