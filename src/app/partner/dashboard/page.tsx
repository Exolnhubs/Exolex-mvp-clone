'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { 
  Users, FileText, Scale, Wallet, TrendingUp, TrendingDown,
  Clock, AlertTriangle, CheckCircle, XCircle, Star, Calendar,
  ArrowLeft, Building2, Briefcase, Award
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// 🏢 لوحة القيادة - الشريك القانوني
// 📅 تاريخ: 1 يناير 2026
// ═══════════════════════════════════════════════════════════════

export default function PartnerDashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [partnerData, setPartnerData] = useState<any>(null)
  const [stats, setStats] = useState({
    employees: 0,
    activeEmployees: 0,
    totalRequests: 0,
    pendingRequests: 0,
    inProgressRequests: 0,
    completedRequests: 0,
    totalCases: 0,
    activeCases: 0,
    totalEarnings: 0,
    monthlyEarnings: 0,
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
      const partnerId = localStorage.getItem('exolex_partner_id')
      if (!partnerId) {
        // router.push('/auth/partner-login')
        // return
      }

      // بيانات الشريك
      const { data: partner } = await supabase
        .from('partners')
        .select('*')
        .eq('id', partnerId)
        .single()

      if (partner) setPartnerData(partner)

      // إحصائيات الموظفين
      const { data: employees, count: empCount } = await supabase
        .from('partner_employees')
        .select('id, status, avg_rating, completed_requests', { count: 'exact' })
        .eq('partner_id', partnerId)

      const activeEmps = employees?.filter(e => e.status === 'active').length || 0

      // إحصائيات الطلبات
      const { data: requests, count: reqCount } = await supabase
        .from('partner_requests')
        .select('id, status, created_at', { count: 'exact' })
        .eq('partner_id', partnerId)

      const pendingReqs = requests?.filter(r => r.status === 'pending').length || 0
      const inProgressReqs = requests?.filter(r => r.status === 'in_progress').length || 0
      const completedReqs = requests?.filter(r => r.status === 'completed').length || 0

      // الطلبات الأخيرة
      const { data: recent } = await supabase
        .from('partner_requests')
        .select('*, client:partner_clients(full_name)')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false })
        .limit(5)

      setRecentRequests(recent || [])

      // القضايا النشطة
      const { data: cases } = await supabase
        .from('case_management')
        .select('id, case_number, case_type, case_status, next_session_date')
        .eq('partner_id', partnerId)
        .in('case_status', ['active', 'in_progress', 'pending'])
        .order('next_session_date', { ascending: true })
        .limit(5)

      setActiveCases(cases || [])
      const casesCount = cases?.length || 0

      // الأرباح
      const { data: earnings } = await supabase
        .from('service_offers')
        .select('lawyer_commission_amount, created_at')
        .eq('partner_id', partnerId)
        .eq('status', 'accepted')

      const totalEarn = earnings?.reduce((sum, e) => sum + (e.lawyer_commission_amount || 0), 0) || 0
      const thisMonth = new Date()
      thisMonth.setDate(1)
      const monthlyEarn = earnings?.filter(e => new Date(e.created_at) >= thisMonth)
        .reduce((sum, e) => sum + (e.lawyer_commission_amount || 0), 0) || 0

      // أفضل الموظفين
      const { data: topEmps } = await supabase
        .from('partner_employees')
        .select('id, full_name, avatar_url, avg_rating, completed_requests')
        .eq('partner_id', partnerId)
        .eq('status', 'active')
        .order('avg_rating', { ascending: false })
        .limit(5)

      setTopEmployees(topEmps || [])

      // التنبيهات
      const alertsList: any[] = []
      
      // تنبيه انتهاء الرخصة
      if (partner?.license_expiry) {
        const daysToExpiry = Math.ceil((new Date(partner.license_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (daysToExpiry <= 30) {
          alertsList.push({
            type: 'warning',
            icon: AlertTriangle,
            title: 'انتهاء الترخيص',
            message: `ينتهي الترخيص خلال ${daysToExpiry} يوم`,
            action: '/partner/profile'
          })
        }
      }

      // تنبيه السجل التجاري
      if (partner?.commercial_reg_expiry) {
        const daysToExpiry = Math.ceil((new Date(partner.commercial_reg_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (daysToExpiry <= 30) {
          alertsList.push({
            type: 'warning',
            icon: AlertTriangle,
            title: 'انتهاء السجل التجاري',
            message: `ينتهي السجل خلال ${daysToExpiry} يوم`,
            action: '/partner/profile'
          })
        }
      }

      // تنبيه طلبات معلقة
      if (pendingReqs > 0) {
        alertsList.push({
          type: 'info',
          icon: Clock,
          title: 'طلبات بانتظار التوزيع',
          message: `${pendingReqs} طلب بحاجة للتوزيع على الموظفين`,
          action: '/partner/requests'
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
        totalEarnings: totalEarn,
        monthlyEarnings: monthlyEarn,
        avgRating: partner?.avg_rating || 0,
        ratingCount: partner?.rating_count || 0,
        slaCompliance: partner?.sla_compliance_rate || 0,
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
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* الترحيب */}
      <div className="bg-gradient-to-l from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              مرحباً، {partnerData?.company_name_ar || 'الشريك القانوني'} 👋
            </h1>
            <p className="text-blue-100">
              إليك ملخص أداء شركتك اليوم
            </p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.avgRating.toFixed(1)}</div>
              <div className="text-blue-200 text-sm flex items-center gap-1">
                <Star className="w-4 h-4 fill-current" /> التقييم
              </div>
            </div>
            <div className="w-px h-12 bg-blue-400"></div>
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.slaCompliance}%</div>
              <div className="text-blue-200 text-sm">SLA</div>
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
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <alert.icon className={`w-5 h-5 ${
                alert.type === 'warning' ? 'text-amber-600' : 'text-blue-600'
              }`} />
              <div className="flex-1">
                <p className={`font-medium ${
                  alert.type === 'warning' ? 'text-amber-800' : 'text-blue-800'
                }`}>{alert.title}</p>
                <p className={`text-sm ${
                  alert.type === 'warning' ? 'text-amber-600' : 'text-blue-600'
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
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">الموظفين</p>
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
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">الأرباح</p>
              <p className="text-2xl font-bold text-slate-800">{stats.totalEarnings.toLocaleString()}</p>
              <p className="text-xs text-emerald-600">+{stats.monthlyEarnings.toLocaleString()} هذا الشهر</p>
            </div>
          </div>
        </div>
      </div>

      {/* صف ثاني */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* الطلبات الأخيرة */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-bold text-slate-800">📋 الطلبات الأخيرة</h2>
            <Link href="/partner/requests" className="text-sm text-blue-600 hover:underline">
              عرض الكل
            </Link>
          </div>
          <div className="p-4">
            {recentRequests.length > 0 ? (
              <div className="space-y-3">
                {recentRequests.map((req, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">
                          {req.title || `طلب #${req.id?.slice(0, 8)}`}
                        </p>
                        <p className="text-sm text-slate-500">
                          {req.client?.full_name || 'عميل'}
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

        {/* أفضل الموظفين */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-bold text-slate-800">🏆 أفضل الموظفين</h2>
            <Link href="/partner/employees" className="text-sm text-blue-600 hover:underline">
              عرض الكل
            </Link>
          </div>
          <div className="p-4">
            {topEmployees.length > 0 ? (
              <div className="space-y-3">
                {topEmployees.map((emp, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                      {idx + 1}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                      {emp.avatar_url ? (
                        <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-slate-600 font-medium">{emp.full_name?.[0]}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 text-sm">{emp.full_name}</p>
                      <p className="text-xs text-slate-500">{emp.completed_requests || 0} طلب</p>
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
                <p>لا يوجد موظفين</p>
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
            <Link href="/partner/cases" className="text-sm text-blue-600 hover:underline">
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

        {/* إحصائيات سريعة */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b">
            <h2 className="font-bold text-slate-800">📊 أداء الشركة</h2>
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
