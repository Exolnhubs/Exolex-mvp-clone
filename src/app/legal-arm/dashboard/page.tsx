'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { 
  Users, FileText, Scale, Wallet, TrendingUp, TrendingDown,
  Clock, AlertTriangle, CheckCircle, XCircle, Star, Calendar,
  ArrowLeft, Building2, Briefcase, Award, DollarSign
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// 🏛️ لوحة القيادة - الذراع القانوني
// 📅 تاريخ: 1 يناير 2026
// النموذج المالي: راتب ثابت أو Cost Plus (تكاليف + 20%) + 50% خدمات إضافية
// ═══════════════════════════════════════════════════════════════

export default function LegalArmDashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [armData, setArmData] = useState<any>(null)
  const [stats, setStats] = useState({
    employees: 0,
    activeEmployees: 0,
    totalRequests: 0,
    pendingRequests: 0,
    inProgressRequests: 0,
    completedRequests: 0,
    totalCases: 0,
    activeCases: 0,
    // المالية - مختلفة عن الشريك
    monthlyCost: 0,           // التكلفة الشهرية (رواتب)
    marginAmount: 0,          // هامش الربح (20%)
    extraServicesEarnings: 0, // أرباح الخدمات الإضافية (50%)
    totalRevenue: 0,          // إجمالي الإيرادات
    avgRating: 0,
    ratingCount: 0,
    slaCompliance: 0,
  })
  const [recentRequests, setRecentRequests] = useState<any[]>([])
  const [activeCases, setActiveCases] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [topEmployees, setTopEmployees] = useState<any[]>([])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const armId = localStorage.getItem('exolex_arm_id')
      if (!armId) {
        // router.push('/auth/arm-login')
        // return
      }

      // بيانات الذراع
      const { data: arm } = await supabase
        .from('legal_arms')
        .select('*')
        .eq('id', armId)
        .single()

      if (arm) setArmData(arm)

      // إحصائيات الموظفين (من lawyers مع legal_arm type أو جدول خاص)
      const { data: employees, count: empCount } = await supabase
        .from('lawyers')
        .select('id, status, avg_rating, total_requests_completed, salary', { count: 'exact' })
        .eq('lawyer_type', 'legal_arm')
        .eq('legal_arm_id', armId)

      const activeEmps = employees?.filter(e => e.status === 'active').length || 0
      const totalSalaries = employees?.reduce((sum, e) => sum + (e.salary || 0), 0) || 0

      // إحصائيات الطلبات
      const { data: requests, count: reqCount } = await supabase
        .from('service_requests')
        .select('id, status, created_at, handler_type', { count: 'exact' })
        .eq('handler_type', 'legal_arm')

      const pendingReqs = requests?.filter(r => r.status === 'pending').length || 0
      const inProgressReqs = requests?.filter(r => r.status === 'in_progress').length || 0
      const completedReqs = requests?.filter(r => r.status === 'completed').length || 0

      // الطلبات الأخيرة
      const { data: recent } = await supabase
        .from('service_requests')
        .select('*, member:member_id(full_name_ar)')
        .eq('handler_type', 'legal_arm')
        .order('created_at', { ascending: false })
        .limit(5)

      setRecentRequests(recent || [])

      // القضايا النشطة
      const { data: cases } = await supabase
        .from('case_management')
        .select('id, case_number, case_type, case_status, next_session_date')
        .eq('legal_arm_id', armId)
        .in('case_status', ['active', 'in_progress', 'pending'])
        .order('next_session_date', { ascending: true })
        .limit(5)

      setActiveCases(cases || [])
      const casesCount = cases?.length || 0

      // أرباح الخدمات الإضافية (50%)
      const { data: extraEarnings } = await supabase
        .from('service_offers')
        .select('lawyer_commission_amount, created_at')
        .eq('legal_arm_id', armId)
        .eq('status', 'accepted')
        .not('extra_service_id', 'is', null)

      const extraServicesTotal = extraEarnings?.reduce((sum, e) => sum + (e.lawyer_commission_amount || 0), 0) || 0

      // حساب الهامش (Cost Plus 20%)
      const marginRate = arm?.commission_rate || 20
      const marginAmount = totalSalaries * (marginRate / 100)

      // أفضل الموظفين
      const { data: topEmps } = await supabase
        .from('lawyers')
        .select('id, full_name_ar, profile_image, avg_rating, total_requests_completed')
        .eq('lawyer_type', 'legal_arm')
        .eq('legal_arm_id', armId)
        .eq('status', 'active')
        .order('avg_rating', { ascending: false })
        .limit(5)

      setTopEmployees(topEmps || [])

      // التنبيهات
      const alertsList: any[] = []
      
      // تنبيه انتهاء الرخصة
      if (arm?.license_expiry) {
        const daysToExpiry = Math.ceil((new Date(arm.license_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (daysToExpiry <= 30) {
          alertsList.push({
            type: 'warning',
            icon: AlertTriangle,
            title: 'انتهاء الترخيص',
            message: `ينتهي الترخيص خلال ${daysToExpiry} يوم`,
            action: '/legal-arm/profile'
          })
        }
      }

      // تنبيه السجل التجاري
      if (arm?.commercial_registration_expiry) {
        const daysToExpiry = Math.ceil((new Date(arm.commercial_registration_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (daysToExpiry <= 30) {
          alertsList.push({
            type: 'warning',
            icon: AlertTriangle,
            title: 'انتهاء السجل التجاري',
            message: `ينتهي السجل خلال ${daysToExpiry} يوم`,
            action: '/legal-arm/profile'
          })
        }
      }

      // تنبيه طلبات معلقة
      if (pendingReqs > 0) {
        alertsList.push({
          type: 'info',
          icon: Clock,
          title: 'طلبات بانتظار التوزيع',
          message: `${pendingReqs} طلب بحاجة للتوزيع على المحامين`,
          action: '/legal-arm/requests'
        })
      }

      setAlerts(alertsList)

      // تحديث الإحصائيات
      setStats({
        employees: empCount || 0,
        activeEmployees: activeEmps,
        totalRequests: reqCount || 0,
        pendingRequests: pendingReqs,
        inProgressRequests: inProgressReqs,
        completedRequests: completedReqs,
        totalCases: casesCount,
        activeCases: cases?.filter(c => c.case_status === 'active').length || 0,
        monthlyCost: totalSalaries,
        marginAmount: marginAmount,
        extraServicesEarnings: extraServicesTotal,
        totalRevenue: totalSalaries + marginAmount + extraServicesTotal,
        avgRating: arm?.avg_rating || 0,
        ratingCount: arm?.rating_count || 0,
        slaCompliance: arm?.sla_compliance_rate || 0,
      })

    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-700',
      'in_progress': 'bg-blue-100 text-blue-700',
      'completed': 'bg-green-100 text-green-700',
      'cancelled': 'bg-red-100 text-red-700',
      'active': 'bg-emerald-100 text-emerald-700',
    }
    return colors[status] || 'bg-slate-100 text-slate-700'
  }

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      'pending': 'معلق',
      'in_progress': 'قيد التنفيذ',
      'completed': 'مكتمل',
      'cancelled': 'ملغي',
      'active': 'نشط',
    }
    return texts[status] || status
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* الترحيب */}
      <div className="bg-gradient-to-l from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              مرحباً، {armData?.name_ar || 'الذراع القانوني'} 👋
            </h1>
            <p className="text-emerald-100">
              إليك ملخص أداء الذراع القانوني اليوم
            </p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.avgRating.toFixed(1)}</div>
              <div className="text-emerald-200 text-sm flex items-center gap-1">
                <Star className="w-4 h-4 fill-current" /> التقييم
              </div>
            </div>
            <div className="w-px h-12 bg-emerald-400"></div>
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.slaCompliance}%</div>
              <div className="text-emerald-200 text-sm">SLA</div>
            </div>
          </div>
        </div>
      </div>

      {/* التنبيهات */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, idx) => (
            <Link
              key={idx}
              href={alert.action}
              className={`flex items-center gap-3 p-4 rounded-xl border ${
                alert.type === 'warning' 
                  ? 'bg-amber-50 border-amber-200' 
                  : 'bg-emerald-50 border-emerald-200'
              }`}
            >
              <alert.icon className={`w-5 h-5 ${
                alert.type === 'warning' ? 'text-amber-600' : 'text-emerald-600'
              }`} />
              <div className="flex-1">
                <p className={`font-medium ${
                  alert.type === 'warning' ? 'text-amber-800' : 'text-emerald-800'
                }`}>{alert.title}</p>
                <p className={`text-sm ${
                  alert.type === 'warning' ? 'text-amber-600' : 'text-emerald-600'
                }`}>{alert.message}</p>
              </div>
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </Link>
          ))}
        </div>
      )}

      {/* الإحصائيات الرئيسية */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">المحامين</p>
              <p className="text-2xl font-bold text-slate-800">{stats.employees}</p>
              <p className="text-xs text-green-600">{stats.activeEmployees} نشط</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">الطلبات</p>
              <p className="text-2xl font-bold text-slate-800">{stats.totalRequests}</p>
              <p className="text-xs text-amber-600">{stats.pendingRequests} معلق</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Scale className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">القضايا</p>
              <p className="text-2xl font-bold text-slate-800">{stats.totalCases}</p>
              <p className="text-xs text-purple-600">{stats.activeCases} نشط</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">إيرادات الخدمات الإضافية</p>
              <p className="text-2xl font-bold text-slate-800">{stats.extraServicesEarnings.toLocaleString()}</p>
              <p className="text-xs text-blue-600">50% من الخدمات الإضافية</p>
            </div>
          </div>
        </div>
      </div>

      {/* النموذج المالي - Cost Plus */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          النموذج المالي (Cost Plus)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl text-center">
            <p className="text-sm text-slate-500 mb-1">تكلفة الرواتب الشهرية</p>
            <p className="text-2xl font-bold text-slate-800">{stats.monthlyCost.toLocaleString()}</p>
            <p className="text-xs text-slate-400">ريال</p>
          </div>
          <div className="p-4 bg-emerald-50 rounded-xl text-center">
            <p className="text-sm text-emerald-600 mb-1">هامش الربح (20%)</p>
            <p className="text-2xl font-bold text-emerald-700">{stats.marginAmount.toLocaleString()}</p>
            <p className="text-xs text-emerald-500">ريال</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl text-center">
            <p className="text-sm text-blue-600 mb-1">خدمات إضافية (50%)</p>
            <p className="text-2xl font-bold text-blue-700">{stats.extraServicesEarnings.toLocaleString()}</p>
            <p className="text-xs text-blue-500">ريال</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl text-center text-white">
            <p className="text-sm text-emerald-100 mb-1">إجمالي الإيرادات</p>
            <p className="text-2xl font-bold">{stats.totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-emerald-200">ريال</p>
          </div>
        </div>
      </div>

      {/* صف ثاني */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* الطلبات الأخيرة */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-bold text-slate-800">📋 الطلبات الأخيرة</h2>
            <Link href="/legal-arm/requests" className="text-sm text-emerald-600 hover:underline">
              عرض الكل
            </Link>
          </div>
          <div className="p-4">
            {recentRequests.length > 0 ? (
              <div className="space-y-3">
                {recentRequests.map((req, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">
                          {req.ticket_number || `طلب #${req.id?.slice(0, 8)}`}
                        </p>
                        <p className="text-sm text-slate-500">
                          {req.member?.full_name_ar || 'مشترك'}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(req.status)}`}>
                      {getStatusText(req.status)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>لا توجد طلبات حالياً</p>
              </div>
            )}
          </div>
        </div>

        {/* أفضل المحامين */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-bold text-slate-800">🏆 أفضل المحامين</h2>
            <Link href="/legal-arm/employees" className="text-sm text-emerald-600 hover:underline">
              عرض الكل
            </Link>
          </div>
          <div className="p-4">
            {topEmployees.length > 0 ? (
              <div className="space-y-3">
                {topEmployees.map((emp, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                      {idx + 1}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                      {emp.profile_image ? (
                        <img src={emp.profile_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-slate-600 font-medium">{emp.full_name_ar?.[0]}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 text-sm">{emp.full_name_ar}</p>
                      <p className="text-xs text-slate-500">{emp.total_requests_completed || 0} طلب</p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-sm font-medium">{emp.avg_rating?.toFixed(1) || '-'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>لا يوجد محامين</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* صف ثالث */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* القضايا النشطة */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-bold text-slate-800">⚖️ القضايا النشطة</h2>
            <Link href="/legal-arm/cases" className="text-sm text-emerald-600 hover:underline">
              عرض الكل
            </Link>
          </div>
          <div className="p-4">
            {activeCases.length > 0 ? (
              <div className="space-y-3">
                {activeCases.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-800">{c.case_number || `قضية #${idx + 1}`}</p>
                      <p className="text-sm text-slate-500">{c.case_type}</p>
                    </div>
                    {c.next_session_date && (
                      <div className="flex items-center gap-2 text-sm text-purple-600">
                        <Calendar className="w-4 h-4" />
                        {new Date(c.next_session_date).toLocaleDateString('ar-SA')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Scale className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>لا توجد قضايا نشطة</p>
              </div>
            )}
          </div>
        </div>

        {/* إحصائيات الأداء */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b">
            <h2 className="font-bold text-slate-800">📊 أداء الذراع القانوني</h2>
          </div>
          <div className="p-4 space-y-4">
            
            {/* معدل الإنجاز */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">معدل إنجاز الطلبات</span>
                <span className="text-sm font-bold text-emerald-600">
                  {stats.totalRequests > 0 
                    ? Math.round((stats.completedRequests / stats.totalRequests) * 100) 
                    : 0}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ 
                    width: `${stats.totalRequests > 0 
                      ? (stats.completedRequests / stats.totalRequests) * 100 
                      : 0}%` 
                  }}
                ></div>
              </div>
            </div>

            {/* SLA */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">الالتزام بـ SLA</span>
                <span className={`text-sm font-bold ${stats.slaCompliance >= 80 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {stats.slaCompliance}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${stats.slaCompliance >= 80 ? 'bg-emerald-500' : 'bg-red-500'}`}
                  style={{ width: `${stats.slaCompliance}%` }}
                ></div>
              </div>
            </div>

            {/* توزيع الطلبات */}
            <div className="pt-4 border-t">
              <p className="text-sm text-slate-600 mb-3">توزيع الطلبات</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <p className="text-xl font-bold text-yellow-600">{stats.pendingRequests}</p>
                  <p className="text-xs text-yellow-700">معلق</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xl font-bold text-blue-600">{stats.inProgressRequests}</p>
                  <p className="text-xs text-blue-700">قيد التنفيذ</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-xl font-bold text-green-600">{stats.completedRequests}</p>
                  <p className="text-xs text-green-700">مكتمل</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  )
}
