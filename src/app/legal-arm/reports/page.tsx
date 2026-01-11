'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// 📊 صفحة التقارير الشاملة - الشريك / الذراع القانوني
// 📅 تاريخ: 3 يناير 2026
// ═══════════════════════════════════════════════════════════════
// التقارير:
// 1. الطلبات: المستلمة، المنفذة، المتأخرة، قيد التنفيذ
// 2. القضايا: الموكلة، المعلقة، المغلقة، المكسوبة، الخاسرة
// 3. المالية: المستحقة، المتأخرة، المستلمة، المدفوعات
// 4. أداء الفريق: كل محامي بالتفصيل
// 5. خدمات الباقة (للذراع): استشارات، قضايا، خدمات إضافية
// ═══════════════════════════════════════════════════════════════

type UserType = 'partner' | 'legal_arm'
type ReportType = 'requests' | 'cases' | 'financial' | 'team' | 'package' | 'ratings'

export default function ReportsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [userType, setUserType] = useState<UserType>('partner')
  const [entityId, setEntityId] = useState<string | null>(null)
  const [activeReport, setActiveReport] = useState<ReportType>('requests')
  const [period, setPeriod] = useState<'month' | '3months' | 'year' | 'all'>('month')
  const [lawyers, setLawyers] = useState<any[]>([])

  // ═══════════════════════════════════════════════════════════════
  // إحصائيات الطلبات
  // ═══════════════════════════════════════════════════════════════
  const [requestsStats, setRequestsStats] = useState({
    received: 0,        // المستلمة
    completed: 0,       // المنفذة
    inProgress: 0,      // قيد التنفيذ
    delayed: 0,         // المتأخرة
    pending: 0,         // معلقة
    cancelled: 0,       // ملغاة
    consultations: 0,   // استشارات
    services: 0,        // خدمات
    reviews: 0          // مراجعات
  })
  const [requestsList, setRequestsList] = useState<any[]>([])

  // ═══════════════════════════════════════════════════════════════
  // إحصائيات القضايا
  // ═══════════════════════════════════════════════════════════════
  const [casesStats, setCasesStats] = useState({
    total: 0,           // إجمالي
    assigned: 0,        // الموكلة
    active: 0,          // النشطة
    pending: 0,         // المعلقة
    closed: 0,          // المغلقة
    won: 0,             // المكسوبة
    lost: 0,            // الخاسرة
    settled: 0          // تسوية
  })
  const [casesList, setCasesList] = useState<any[]>([])

  // ═══════════════════════════════════════════════════════════════
  // إحصائيات المالية
  // ═══════════════════════════════════════════════════════════════
  const [financialStats, setFinancialStats] = useState({
    totalDue: 0,        // المستحقة
    received: 0,        // المستلمة
    overdue: 0,         // المتأخرة
    pending: 0,         // معلقة
    thisMonth: 0,       // هذا الشهر
    lastMonth: 0        // الشهر الماضي
  })
  const [paymentsList, setPaymentsList] = useState<any[]>([])

  // ═══════════════════════════════════════════════════════════════
  // إحصائيات الفريق
  // ═══════════════════════════════════════════════════════════════
  const [teamStats, setTeamStats] = useState<any[]>([])

  // ═══════════════════════════════════════════════════════════════
  // إحصائيات خدمات الباقة (للذراع فقط)
  // ═══════════════════════════════════════════════════════════════
  const [packageStats, setPackageStats] = useState({
    totalPackageServices: 0,      // إجمالي خدمات الباقة
    packageConsultations: 0,      // استشارات مشمولة
    packageCases: 0,              // قضايا مشمولة
    additionalServices: 0,        // خدمات إضافية
    additionalRevenue: 0          // إيرادات الخدمات الإضافية
  })

  // ═══════════════════════════════════════════════════════════════
  // إحصائيات التقييمات
  // ═══════════════════════════════════════════════════════════════
  const [ratingsStats, setRatingsStats] = useState({
    avgRating: 0,
    totalRatings: 0,
    five: 0,
    four: 0,
    three: 0,
    two: 0,
    one: 0
  })
  const [ratingsList, setRatingsList] = useState<any[]>([])

  const reportTypes = [
    { key: 'requests', label: 'الطلبات', icon: '📋' },
    { key: 'cases', label: 'القضايا', icon: '⚖️' },
    { key: 'financial', label: 'المالية', icon: '💰' },
    { key: 'team', label: 'أداء الفريق', icon: '👥' },
    ...(userType === 'legal_arm' ? [{ key: 'package', label: 'خدمات الباقة', icon: '📦' }] : []),
    { key: 'ratings', label: 'التقييمات', icon: '⭐' },
  ]

  const periods = [
    { key: 'month', label: 'هذا الشهر' },
    { key: '3months', label: '3 أشهر' },
    { key: 'year', label: 'هذه السنة' },
    { key: 'all', label: 'الكل' },
  ]

  useEffect(() => { loadData() }, [period])

  const getPeriodDates = () => {
    const now = new Date()
    let start: Date
    switch (period) {
      case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); break
      case '3months': start = new Date(now.getFullYear(), now.getMonth() - 3, 1); break
      case 'year': start = new Date(now.getFullYear(), 0, 1); break
      default: start = new Date(2020, 0, 1)
    }
    return { start, end: now }
  }

  const loadData = async () => {
    try {
      setIsLoading(true)
      const partnerId = localStorage.getItem('exolex_partner_id')
      const legalArmId = localStorage.getItem('exolex_legal_arm_id')

      let type: UserType = 'partner'
      let id: string | null = null
      let lawyerIds: string[] = []

      if (partnerId) {
        type = 'partner'
        id = partnerId
        const { data: employeesData } = await supabase
          .from('partner_employees')
          .select('id, full_name, is_active, created_at')
          .eq('partner_id', partnerId)
        setLawyers(employeesData || [])
        lawyerIds = (employeesData || []).map(e => e.id)
      } else if (legalArmId) {
        type = 'legal_arm'
        id = legalArmId
        const { data: lawyersData } = await supabase
          .from('lawyers')
          .select('id, full_name, is_available, avg_rating, rating_count, sla_compliance_rate, created_at')
          .eq('legal_arm_id', legalArmId)
          .eq('lawyer_type', 'legal_arm')
        setLawyers(lawyersData || [])
        lawyerIds = (lawyersData || []).map(l => l.id)
      } else {
        router.push('/auth/login')
        return
      }

      setUserType(type)
      setEntityId(id)

      const { start } = getPeriodDates()
      const now = new Date()

      // ═══════════════════════════════════════════════════════════
      // 1. جلب الطلبات
      // ═══════════════════════════════════════════════════════════
      let requestsQuery = supabase
        .from('service_requests')
        .select(`
          id, ticket_number, title, status, request_type, service_path,
          total_amount, base_price, created_at, completed_at, updated_at,
          assigned_lawyer_id, assigned_partner_employee_id,
          category:category_id(name_ar),
          subscriber:subscriber_id(full_name)
        `)
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: false })

      if (type === 'partner') {
        requestsQuery = requestsQuery.eq('assigned_partner_id', id)
      } else if (lawyerIds.length > 0) {
        requestsQuery = requestsQuery.in('assigned_lawyer_id', lawyerIds)
      }

      const { data: requestsData } = await requestsQuery
      const requests = requestsData || []
      setRequestsList(requests)

      // حساب التأخير (أكثر من 48 ساعة)
      const delayedRequests = requests.filter(r => {
        if (r.status === 'completed' || r.status === 'closed' || r.status === 'cancelled') return false
        const created = new Date(r.created_at)
        const hours = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
        return hours > 48
      })

      setRequestsStats({
        received: requests.length,
        completed: requests.filter(r => r.status === 'completed' || r.status === 'closed').length,
        inProgress: requests.filter(r => r.status === 'in_progress').length,
        delayed: delayedRequests.length,
        pending: requests.filter(r => r.status === 'pending' || r.status === 'new').length,
        cancelled: requests.filter(r => r.status === 'cancelled').length,
        consultations: requests.filter(r => r.request_type === 'consultation').length,
        services: requests.filter(r => r.request_type === 'service').length,
        reviews: requests.filter(r => r.request_type === 'review').length
      })

      // ═══════════════════════════════════════════════════════════
      // 2. جلب القضايا
      // ═══════════════════════════════════════════════════════════
      let casesQuery = supabase
        .from('cases')
        .select(`
          id, case_number, title, status, case_type, court_name,
          created_at, updated_at, lawyer_id,
          category:category_id(name_ar)
        `)
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: false })

      if (type === 'legal_arm' && lawyerIds.length > 0) {
        casesQuery = casesQuery.in('lawyer_id', lawyerIds)
      }

      const { data: casesData } = await casesQuery
      const cases = casesData || []
      setCasesList(cases)

      setCasesStats({
        total: cases.length,
        assigned: cases.length,
        active: cases.filter(c => c.status === 'active' || c.status === 'in_progress').length,
        pending: cases.filter(c => c.status === 'pending' || c.status === 'on_hold').length,
        closed: cases.filter(c => c.status === 'closed' || c.status === 'completed').length,
        won: cases.filter(c => c.status === 'won').length,
        lost: cases.filter(c => c.status === 'lost').length,
        settled: cases.filter(c => c.status === 'settled').length
      })

      // ═══════════════════════════════════════════════════════════
      // 3. حساب المالية
      // ═══════════════════════════════════════════════════════════
      const commissionRate = type === 'legal_arm' ? 0.5 : 0.7
      const completedRequests = requests.filter(r => r.status === 'completed' || r.status === 'closed')
      const pendingRequests = requests.filter(r => r.status === 'in_progress')

      const totalDue = completedRequests.reduce((sum, r) => sum + (r.total_amount || 0) * commissionRate, 0)
      const pendingAmount = pendingRequests.reduce((sum, r) => sum + (r.total_amount || 0) * commissionRate, 0)

      // هذا الشهر
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const thisMonthCompleted = completedRequests.filter(r => new Date(r.completed_at || r.updated_at) >= thisMonthStart)
      const thisMonthAmount = thisMonthCompleted.reduce((sum, r) => sum + (r.total_amount || 0) * commissionRate, 0)

      // الشهر الماضي
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      const lastMonthCompleted = completedRequests.filter(r => {
        const d = new Date(r.completed_at || r.updated_at)
        return d >= lastMonthStart && d <= lastMonthEnd
      })
      const lastMonthAmount = lastMonthCompleted.reduce((sum, r) => sum + (r.total_amount || 0) * commissionRate, 0)

      // المتأخرة (أكثر من 30 يوم بدون دفع - تقدير)
      const overdueRequests = completedRequests.filter(r => {
        const completed = new Date(r.completed_at || r.updated_at)
        const days = (now.getTime() - completed.getTime()) / (1000 * 60 * 60 * 24)
        return days > 30
      })
      const overdueAmount = overdueRequests.reduce((sum, r) => sum + (r.total_amount || 0) * commissionRate, 0)

      setFinancialStats({
        totalDue,
        received: totalDue - overdueAmount, // تقدير
        overdue: overdueAmount,
        pending: pendingAmount,
        thisMonth: thisMonthAmount,
        lastMonth: lastMonthAmount
      })

      setPaymentsList(completedRequests.map(r => ({
        id: r.id,
        ticket: r.ticket_number,
        title: r.title,
        amount: (r.total_amount || 0) * commissionRate,
        date: r.completed_at || r.updated_at,
        status: 'paid'
      })))

      // ═══════════════════════════════════════════════════════════
      // 4. إحصائيات الفريق
      // ═══════════════════════════════════════════════════════════
      const teamData = lawyers.map(lawyer => {
        const lawyerRequests = requests.filter(r => 
          type === 'partner' ? r.assigned_partner_employee_id === lawyer.id : r.assigned_lawyer_id === lawyer.id
        )
        const lawyerCompleted = lawyerRequests.filter(r => r.status === 'completed' || r.status === 'closed')
        const lawyerInProgress = lawyerRequests.filter(r => r.status === 'in_progress')
        const lawyerDelayed = lawyerRequests.filter(r => {
          if (r.status === 'completed' || r.status === 'closed' || r.status === 'cancelled') return false
          const created = new Date(r.created_at)
          const hours = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
          return hours > 48
        })
        const lawyerEarnings = lawyerCompleted.reduce((sum, r) => sum + (r.total_amount || 0) * commissionRate, 0)

        const lawyerCases = cases.filter(c => c.lawyer_id === lawyer.id)

        return {
          id: lawyer.id,
          name: lawyer.full_name,
          isActive: lawyer.is_active ?? lawyer.is_available ?? true,
          requests: {
            total: lawyerRequests.length,
            completed: lawyerCompleted.length,
            inProgress: lawyerInProgress.length,
            delayed: lawyerDelayed.length
          },
          cases: {
            total: lawyerCases.length,
            active: lawyerCases.filter(c => c.status === 'active' || c.status === 'in_progress').length
          },
          earnings: lawyerEarnings,
          rating: lawyer.avg_rating || 0,
          ratingCount: lawyer.rating_count || 0,
          sla: lawyerRequests.length > 0 ? ((lawyerRequests.length - lawyerDelayed.length) / lawyerRequests.length * 100) : 100
        }
      })
      setTeamStats(teamData)

      // ═══════════════════════════════════════════════════════════
      // 5. خدمات الباقة (للذراع فقط)
      // ═══════════════════════════════════════════════════════════
      if (type === 'legal_arm') {
        // خدمات الباقة = service_path في (consultation في personal_status أو labor)
        const packageConsultations = requests.filter(r => 
          r.request_type === 'consultation' && 
          r.service_path === 'consultation'
        ).length

        const packageCases = requests.filter(r => 
          r.request_type === 'case' && 
          ['personal_status', 'labor'].includes(r.category?.name_ar || '')
        ).length

        const additionalServices = requests.filter(r => 
          r.service_path !== 'consultation' || 
          !['personal_status', 'labor'].includes(r.category?.name_ar || '')
        )

        const additionalRevenue = additionalServices.reduce((sum, r) => sum + (r.total_amount || 0) * commissionRate, 0)

        setPackageStats({
          totalPackageServices: packageConsultations + packageCases,
          packageConsultations,
          packageCases,
          additionalServices: additionalServices.length,
          additionalRevenue
        })
      }

      // ═══════════════════════════════════════════════════════════
      // 6. التقييمات
      // ═══════════════════════════════════════════════════════════
      if (type === 'legal_arm') {
        const totalRatings = lawyers.reduce((sum, l) => sum + (l.rating_count || 0), 0)
        const avgRating = lawyers.length > 0 
          ? lawyers.reduce((sum, l) => sum + (l.avg_rating || 0), 0) / lawyers.filter(l => l.avg_rating).length || 0
          : 0

        setRatingsStats({
          avgRating,
          totalRatings,
          five: 0, four: 0, three: 0, two: 0, one: 0 // يحتاج جدول التقييمات
        })

        setRatingsList(lawyers.filter(l => l.rating_count > 0).map(l => ({
          name: l.full_name,
          rating: l.avg_rating || 0,
          count: l.rating_count || 0
        })))
      }

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const exportReport = () => {
    toast.success('🚧 قريباً - تصدير PDF')
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'completed': '#10b981', 'closed': '#10b981', 'won': '#10b981',
      'in_progress': '#3b82f6', 'active': '#3b82f6',
      'pending': '#f59e0b', 'new': '#f59e0b', 'on_hold': '#f59e0b',
      'cancelled': '#ef4444', 'lost': '#ef4444',
      'settled': '#8b5cf6'
    }
    return colors[status] || '#64748b'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'completed': 'مكتمل', 'closed': 'مغلق', 'won': 'مكسوب',
      'in_progress': 'قيد التنفيذ', 'active': 'نشط',
      'pending': 'معلق', 'new': 'جديد', 'on_hold': 'متوقف',
      'cancelled': 'ملغي', 'lost': 'خاسر',
      'settled': 'تسوية'
    }
    return labels[status] || status
  }

  const getRequestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'consultation': '💬 استشارة',
      'case': '⚖️ قضية',
      'service': '📋 خدمة',
      'review': '📝 مراجعة'
    }
    return labels[type] || type
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid #8b5cf6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#64748b' }}>جاري تحميل التقارير...</p>
        </div>
        <style jsx>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>

      {/* Header */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>📊 التقارير الشاملة</h1>
            <p style={{ color: '#64748b', marginTop: 4 }}>تحليل مفصل للأداء والمالية</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select value={period} onChange={(e) => setPeriod(e.target.value as any)} style={{ padding: '10px 16px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
              {periods.map(p => (<option key={p.key} value={p.key}>{p.label}</option>))}
            </select>
            <button onClick={exportReport} style={{ padding: '10px 20px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500 }}>
              📥 تصدير PDF
            </button>
          </div>
        </div>
      </div>

      {/* تبويبات التقارير */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {reportTypes.map(type => (
            <button
              key={type.key}
              onClick={() => setActiveReport(type.key as ReportType)}
              style={{
                padding: '12px 24px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: activeReport === type.key ? 600 : 400,
                backgroundColor: activeReport === type.key ? '#8b5cf6' : '#f1f5f9',
                color: activeReport === type.key ? 'white' : '#64748b',
                transition: 'all 0.2s'
              }}
            >
              <span style={{ fontSize: 18 }}>{type.icon}</span>
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* تقرير الطلبات */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeReport === 'requests' && (
        <div>
          {/* إحصائيات الطلبات */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRight: '4px solid #3b82f6' }}>
              <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>المستلمة</p>
              <p style={{ fontSize: 28, fontWeight: 'bold', color: '#3b82f6', margin: '8px 0 0' }}>{requestsStats.received}</p>
            </div>
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRight: '4px solid #10b981' }}>
              <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>المنفذة</p>
              <p style={{ fontSize: 28, fontWeight: 'bold', color: '#10b981', margin: '8px 0 0' }}>{requestsStats.completed}</p>
            </div>
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRight: '4px solid #f59e0b' }}>
              <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>قيد التنفيذ</p>
              <p style={{ fontSize: 28, fontWeight: 'bold', color: '#f59e0b', margin: '8px 0 0' }}>{requestsStats.inProgress}</p>
            </div>
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRight: '4px solid #ef4444' }}>
              <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>المتأخرة ⚠️</p>
              <p style={{ fontSize: 28, fontWeight: 'bold', color: '#ef4444', margin: '8px 0 0' }}>{requestsStats.delayed}</p>
            </div>
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRight: '4px solid #94a3b8' }}>
              <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>معلقة</p>
              <p style={{ fontSize: 28, fontWeight: 'bold', color: '#94a3b8', margin: '8px 0 0' }}>{requestsStats.pending}</p>
            </div>
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRight: '4px solid #64748b' }}>
              <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>ملغاة</p>
              <p style={{ fontSize: 28, fontWeight: 'bold', color: '#64748b', margin: '8px 0 0' }}>{requestsStats.cancelled}</p>
            </div>
          </div>

          {/* توزيع حسب النوع */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, marginBottom: 24 }}>
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 16 }}>📊 حسب النوع</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#dbeafe', borderRadius: 8 }}>
                  <span>💬 استشارات</span>
                  <span style={{ fontWeight: 'bold', color: '#1d4ed8' }}>{requestsStats.consultations}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#dcfce7', borderRadius: 8 }}>
                  <span>📋 خدمات</span>
                  <span style={{ fontWeight: 'bold', color: '#15803d' }}>{requestsStats.services}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#fef3c7', borderRadius: 8 }}>
                  <span>📝 مراجعات</span>
                  <span style={{ fontWeight: 'bold', color: '#b45309' }}>{requestsStats.reviews}</span>
                </div>
              </div>
            </div>

            {/* جدول الطلبات */}
            <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <h3 style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>📋 آخر الطلبات</h3>
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: '#64748b' }}>الرقم</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: '#64748b' }}>النوع</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: '#64748b' }}>الحالة</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: '#64748b' }}>المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestsList.slice(0, 10).map((r, i) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace' }}>{r.ticket_number || '-'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12 }}>{getRequestTypeLabel(r.request_type)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, backgroundColor: `${getStatusColor(r.status)}20`, color: getStatusColor(r.status) }}>
                            {getStatusLabel(r.status)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600 }}>{(r.total_amount || 0).toLocaleString()} ر.س</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* تقرير القضايا */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeReport === 'cases' && (
        <div>
          {/* إحصائيات القضايا */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
              <p style={{ fontSize: 48, fontWeight: 'bold', color: '#8b5cf6', margin: 0 }}>{casesStats.total}</p>
              <p style={{ color: '#64748b', fontSize: 14, marginTop: 8 }}>إجمالي القضايا</p>
            </div>
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
              <p style={{ fontSize: 48, fontWeight: 'bold', color: '#3b82f6', margin: 0 }}>{casesStats.active}</p>
              <p style={{ color: '#64748b', fontSize: 14, marginTop: 8 }}>نشطة</p>
            </div>
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
              <p style={{ fontSize: 48, fontWeight: 'bold', color: '#f59e0b', margin: 0 }}>{casesStats.pending}</p>
              <p style={{ color: '#64748b', fontSize: 14, marginTop: 8 }}>معلقة</p>
            </div>
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
              <p style={{ fontSize: 48, fontWeight: 'bold', color: '#10b981', margin: 0 }}>{casesStats.closed}</p>
              <p style={{ color: '#64748b', fontSize: 14, marginTop: 8 }}>مغلقة</p>
            </div>
          </div>

          {/* نتائج القضايا */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ backgroundColor: '#dcfce7', borderRadius: 12, padding: 24, textAlign: 'center' }}>
              <p style={{ fontSize: 40, margin: 0 }}>🏆</p>
              <p style={{ fontSize: 32, fontWeight: 'bold', color: '#15803d', margin: '8px 0' }}>{casesStats.won}</p>
              <p style={{ color: '#166534', fontSize: 14 }}>قضايا مكسوبة</p>
            </div>
            <div style={{ backgroundColor: '#fee2e2', borderRadius: 12, padding: 24, textAlign: 'center' }}>
              <p style={{ fontSize: 40, margin: 0 }}>❌</p>
              <p style={{ fontSize: 32, fontWeight: 'bold', color: '#dc2626', margin: '8px 0' }}>{casesStats.lost}</p>
              <p style={{ color: '#991b1b', fontSize: 14 }}>قضايا خاسرة</p>
            </div>
            <div style={{ backgroundColor: '#f3e8ff', borderRadius: 12, padding: 24, textAlign: 'center' }}>
              <p style={{ fontSize: 40, margin: 0 }}>🤝</p>
              <p style={{ fontSize: 32, fontWeight: 'bold', color: '#7c3aed', margin: '8px 0' }}>{casesStats.settled}</p>
              <p style={{ color: '#5b21b6', fontSize: 14 }}>تسوية</p>
            </div>
          </div>

          {/* جدول القضايا */}
          <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>⚖️ قائمة القضايا</h3>
            </div>
            {casesList.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#64748b' }}>رقم القضية</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#64748b' }}>العنوان</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#64748b' }}>المحكمة</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#64748b' }}>الحالة</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#64748b' }}>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {casesList.slice(0, 10).map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace' }}>{c.case_number || '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13 }}>{c.title || '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13 }}>{c.court_name || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 9999, backgroundColor: `${getStatusColor(c.status)}20`, color: getStatusColor(c.status) }}>
                            {getStatusLabel(c.status)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>{new Date(c.created_at).toLocaleDateString('ar-SA')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <span style={{ fontSize: 48 }}>⚖️</span>
                <p style={{ color: '#64748b', marginTop: 16 }}>لا توجد قضايا في هذه الفترة</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* تقرير المالية */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeReport === 'financial' && (
        <div>
          {/* إحصائيات المالية */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 24 }}>
            <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: 16, padding: 28, color: 'white' }}>
              <p style={{ fontSize: 14, opacity: 0.9, margin: 0 }}>💰 المبالغ المستلمة</p>
              <p style={{ fontSize: 36, fontWeight: 'bold', margin: '12px 0' }}>{financialStats.received.toLocaleString()}</p>
              <p style={{ fontSize: 14, opacity: 0.8, margin: 0 }}>ريال سعودي</p>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderRadius: 16, padding: 28, color: 'white' }}>
              <p style={{ fontSize: 14, opacity: 0.9, margin: 0 }}>⏳ قيد التحصيل</p>
              <p style={{ fontSize: 36, fontWeight: 'bold', margin: '12px 0' }}>{financialStats.pending.toLocaleString()}</p>
              <p style={{ fontSize: 14, opacity: 0.8, margin: 0 }}>ريال سعودي</p>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', borderRadius: 16, padding: 28, color: 'white' }}>
              <p style={{ fontSize: 14, opacity: 0.9, margin: 0 }}>⚠️ متأخرة السداد</p>
              <p style={{ fontSize: 36, fontWeight: 'bold', margin: '12px 0' }}>{financialStats.overdue.toLocaleString()}</p>
              <p style={{ fontSize: 14, opacity: 0.8, margin: 0 }}>ريال سعودي</p>
            </div>
          </div>

          {/* مقارنة الشهور */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 16 }}>📅 هذا الشهر</h3>
              <p style={{ fontSize: 40, fontWeight: 'bold', color: '#10b981', margin: 0 }}>{financialStats.thisMonth.toLocaleString()}</p>
              <p style={{ color: '#64748b', fontSize: 14, marginTop: 8 }}>ريال سعودي</p>
              {financialStats.lastMonth > 0 && (
                <p style={{ 
                  marginTop: 12, 
                  fontSize: 14,
                  color: financialStats.thisMonth >= financialStats.lastMonth ? '#10b981' : '#ef4444'
                }}>
                  {financialStats.thisMonth >= financialStats.lastMonth ? '📈' : '📉'} 
                  {' '}{Math.abs(((financialStats.thisMonth - financialStats.lastMonth) / financialStats.lastMonth) * 100).toFixed(0)}%
                  {financialStats.thisMonth >= financialStats.lastMonth ? ' زيادة' : ' انخفاض'}
                </p>
              )}
            </div>
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 16 }}>📅 الشهر الماضي</h3>
              <p style={{ fontSize: 40, fontWeight: 'bold', color: '#64748b', margin: 0 }}>{financialStats.lastMonth.toLocaleString()}</p>
              <p style={{ color: '#64748b', fontSize: 14, marginTop: 8 }}>ريال سعودي</p>
            </div>
          </div>

          {/* جدول المدفوعات */}
          <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>💳 سجل المدفوعات</h3>
            </div>
            {paymentsList.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#64748b' }}>رقم الطلب</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#64748b' }}>الوصف</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#64748b' }}>المبلغ</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#64748b' }}>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsList.slice(0, 10).map((p, i) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace' }}>{p.ticket || '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13 }}>{p.title || '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#10b981' }}>{p.amount.toLocaleString()} ر.س</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>{p.date ? new Date(p.date).toLocaleDateString('ar-SA') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <span style={{ fontSize: 48 }}>💰</span>
                <p style={{ color: '#64748b', marginTop: 16 }}>لا توجد مدفوعات في هذه الفترة</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* تقرير أداء الفريق */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeReport === 'team' && (
        <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <h3 style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>👥 أداء الفريق التفصيلي</h3>
          </div>
          {teamStats.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, color: '#64748b' }}>{userType === 'partner' ? 'الموظف' : 'المحامي'}</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>الطلبات</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>المنفذة</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>قيد التنفيذ</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>المتأخرة</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>القضايا</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>الأرباح</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>التقييم</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {teamStats.map((member, index) => (
                    <tr key={member.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: member.isActive ? '#10b981' : '#94a3b8' }}></span>
                          <span style={{ fontWeight: 500 }}>{member.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: '#3b82f6' }}>{member.requests.total}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: '#10b981' }}>{member.requests.completed}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: '#f59e0b' }}>{member.requests.inProgress}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {member.requests.delayed > 0 ? (
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>⚠️ {member.requests.delayed}</span>
                        ) : (
                          <span style={{ color: '#10b981' }}>✓</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: '#8b5cf6' }}>{member.cases.total}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: '#059669' }}>{member.earnings.toLocaleString()}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {member.rating > 0 ? (
                          <span style={{ color: '#f59e0b' }}>⭐ {member.rating.toFixed(1)}</span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: 9999, 
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor: member.sla >= 90 ? '#dcfce7' : member.sla >= 70 ? '#fef3c7' : '#fee2e2',
                          color: member.sla >= 90 ? '#15803d' : member.sla >= 70 ? '#b45309' : '#dc2626'
                        }}>
                          {member.sla.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <span style={{ fontSize: 48 }}>👥</span>
              <p style={{ color: '#64748b', marginTop: 16 }}>لا يوجد أعضاء في الفريق</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* تقرير خدمات الباقة (للذراع فقط) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeReport === 'package' && userType === 'legal_arm' && (
        <div>
          {/* إحصائيات خدمات الباقة */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ backgroundColor: '#dbeafe', borderRadius: 12, padding: 24, textAlign: 'center' }}>
              <p style={{ fontSize: 40, margin: 0 }}>📦</p>
              <p style={{ fontSize: 32, fontWeight: 'bold', color: '#1d4ed8', margin: '8px 0' }}>{packageStats.totalPackageServices}</p>
              <p style={{ color: '#1e40af', fontSize: 14 }}>إجمالي خدمات الباقة</p>
            </div>
            <div style={{ backgroundColor: '#dcfce7', borderRadius: 12, padding: 24, textAlign: 'center' }}>
              <p style={{ fontSize: 40, margin: 0 }}>💬</p>
              <p style={{ fontSize: 32, fontWeight: 'bold', color: '#15803d', margin: '8px 0' }}>{packageStats.packageConsultations}</p>
              <p style={{ color: '#166534', fontSize: 14 }}>استشارات مشمولة</p>
            </div>
            <div style={{ backgroundColor: '#f3e8ff', borderRadius: 12, padding: 24, textAlign: 'center' }}>
              <p style={{ fontSize: 40, margin: 0 }}>⚖️</p>
              <p style={{ fontSize: 32, fontWeight: 'bold', color: '#7c3aed', margin: '8px 0' }}>{packageStats.packageCases}</p>
              <p style={{ color: '#5b21b6', fontSize: 14 }}>قضايا مشمولة</p>
            </div>
            <div style={{ backgroundColor: '#fef3c7', borderRadius: 12, padding: 24, textAlign: 'center' }}>
              <p style={{ fontSize: 40, margin: 0 }}>➕</p>
              <p style={{ fontSize: 32, fontWeight: 'bold', color: '#b45309', margin: '8px 0' }}>{packageStats.additionalServices}</p>
              <p style={{ color: '#92400e', fontSize: 14 }}>خدمات إضافية</p>
            </div>
          </div>

          {/* إيرادات الخدمات الإضافية */}
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 16 }}>💰 إيرادات الخدمات الإضافية</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <p style={{ fontSize: 48, fontWeight: 'bold', color: '#10b981', margin: 0 }}>{packageStats.additionalRevenue.toLocaleString()}</p>
              <p style={{ fontSize: 18, color: '#64748b' }}>ريال سعودي</p>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>من {packageStats.additionalServices} خدمة إضافية</p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* تقرير التقييمات */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeReport === 'ratings' && (
        <div>
          {/* متوسط التقييم */}
          <div style={{ backgroundColor: '#fef9c3', borderRadius: 16, padding: 32, marginBottom: 24, textAlign: 'center' }}>
            <p style={{ fontSize: 64, fontWeight: 'bold', color: '#ca8a04', margin: 0 }}>{ratingsStats.avgRating.toFixed(1)} ⭐</p>
            <p style={{ fontSize: 18, color: '#a16207', marginTop: 8 }}>متوسط التقييم من {ratingsStats.totalRatings} تقييم</p>
          </div>

          {/* تقييمات المحامين */}
          <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>⭐ تقييمات المحامين</h3>
            </div>
            {ratingsList.length > 0 ? (
              <div style={{ padding: 16 }}>
                {ratingsList.sort((a, b) => b.rating - a.rating).map((item, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: index % 2 === 0 ? '#f8fafc' : 'white', borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 24 }}>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤'}</span>
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: 18 }}>⭐ {item.rating.toFixed(1)}</span>
                      <span style={{ color: '#94a3b8', fontSize: 14 }}>({item.count} تقييم)</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <span style={{ fontSize: 48 }}>⭐</span>
                <p style={{ color: '#64748b', marginTop: 16 }}>لا توجد تقييمات متاحة</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
