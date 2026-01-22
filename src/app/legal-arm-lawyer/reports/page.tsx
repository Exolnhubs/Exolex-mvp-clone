'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { FileText, Download, TrendingUp, TrendingDown, Calendar, Filter, CheckCircle, Package } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// 📊 صفحة التقارير - محامي الذراع القانوني
// 📅 تاريخ: 21 يناير 2026
// 📍 المسار: /legal-arm-lawyer/reports/page.tsx
// ═══════════════════════════════════════════════════════════════
// ⚠️ ملاحظة: هذه النسخة بدون تقرير الأرباح
// التقارير المتاحة: الطلبات (باقة/إضافية)، القضايا، التقييمات، الأداء
// ═══════════════════════════════════════════════════════════════

export default function ReportsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [activeReport, setActiveReport] = useState<'requests' | 'cases' | 'ratings' | 'performance'>('requests')
  const [period, setPeriod] = useState<'month' | '3months' | 'year' | 'all'>('month')
  const [isExporting, setIsExporting] = useState(false)

  // البيانات
  const [requests, setRequests] = useState<any>({ 
    total: 0, 
    packageRequests: 0, 
    extraRequests: 0,
    byStatus: [], 
    byType: [], 
    byMonth: [],
    bySource: [] // باقة vs إضافية
  })
  const [cases, setCases] = useState<any>({ total: 0, byStatus: [], byCourt: [], byType: [] })
  const [ratings, setRatings] = useState<any>({ avg: 0, count: 0, distribution: [], byMonth: [] })
  const [performance, setPerformance] = useState<any>({ sla: 0, avgResponse: 0, completion: 0 })

  useEffect(() => { loadData() }, [period])

  const getPeriodDates = () => {
    const now = new Date()
    let start: Date
    
    switch (period) {
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case '3months':
        start = new Date(now.getFullYear(), now.getMonth() - 3, 1)
        break
      case 'year':
        start = new Date(now.getFullYear(), 0, 1)
        break
      default:
        start = new Date(2020, 0, 1)
    }
    return { start, end: now }
  }

  const loadData = async () => {
    try {
      const lawyerId = localStorage.getItem('exolex_lawyer_id')
      if (!lawyerId) { router.push('/auth/lawyer-login'); return }

      // ═══════════════════════════════════════════════════════════
      // التحقق من أن المحامي من نوع legal_arm
      // ═══════════════════════════════════════════════════════════
      const { data: lawyerCheck, error: checkError } = await supabase
        .from('lawyers')
        .select('lawyer_type, sla_compliance_rate, total_requests_completed, total_requests_handled')
        .eq('id', lawyerId)
        .single()

      if (checkError || !lawyerCheck) {
        toast.error('خطأ في جلب بيانات المحامي')
        router.push('/auth/lawyer-login')
        return
      }

      if (lawyerCheck.lawyer_type !== 'legal_arm') {
        toast.error('غير مصرح لك بالوصول لهذه الصفحة')
        router.push('/auth/lawyer-login')
        return
      }

      const { start, end } = getPeriodDates()

      // ═══════════════════════════════════════════════════════════
      // 1. تقرير الطلبات (مع تفريق باقة/إضافية)
      // ═══════════════════════════════════════════════════════════
      const { data: requestsData } = await supabase
        .from('service_requests')
        .select('id, status, request_type, created_at, completed_at, is_package_service')
        .eq('assigned_lawyer_id', lawyerId)
        .gte('created_at', start.toISOString())

      const requestsByStatus: Record<string, number> = {}
      const requestsByType: Record<string, number> = {}
      const requestsByMonth: Record<string, number> = {}
      const requestsBySource: Record<string, number> = { package: 0, extra: 0 }

      ;(requestsData || []).forEach(r => {
        requestsByStatus[r.status] = (requestsByStatus[r.status] || 0) + 1
        requestsByType[r.request_type] = (requestsByType[r.request_type] || 0) + 1
        const month = new Date(r.created_at).toLocaleString('ar-SA', { month: 'short' })
        requestsByMonth[month] = (requestsByMonth[month] || 0) + 1
        
        // تفريق الباقة والإضافية
        if (r.is_package_service) {
          requestsBySource.package++
        } else {
          requestsBySource.extra++
        }
      })

      const packageCount = requestsBySource.package
      const extraCount = requestsBySource.extra

      setRequests({
        total: requestsData?.length || 0,
        packageRequests: packageCount,
        extraRequests: extraCount,
        byStatus: Object.entries(requestsByStatus).map(([status, count]) => ({ status, count })),
        byType: Object.entries(requestsByType).map(([type, count]) => ({ type, count })),
        byMonth: Object.entries(requestsByMonth).map(([month, count]) => ({ month, count })),
        bySource: [
          { source: 'خدمات الباقة', count: packageCount },
          { source: 'خدمات إضافية', count: extraCount }
        ]
      })

      // ═══════════════════════════════════════════════════════════
      // 2. تقرير القضايا
      // ═══════════════════════════════════════════════════════════
      const { data: casesData } = await supabase
        .from('case_management')
        .select('id, case_status, case_type, court_name, created_at')
        .eq('assigned_lawyer_id', lawyerId)
        .gte('created_at', start.toISOString())

      const casesByStatus: Record<string, number> = {}
      const casesByCourt: Record<string, number> = {}
      const casesByType: Record<string, number> = {}

      ;(casesData || []).forEach(c => {
        casesByStatus[c.case_status] = (casesByStatus[c.case_status] || 0) + 1
        if (c.court_name) casesByCourt[c.court_name] = (casesByCourt[c.court_name] || 0) + 1
        if (c.case_type) casesByType[c.case_type] = (casesByType[c.case_type] || 0) + 1
      })

      setCases({
        total: casesData?.length || 0,
        byStatus: Object.entries(casesByStatus).map(([status, count]) => ({ status, count })),
        byCourt: Object.entries(casesByCourt).map(([court, count]) => ({ court, count })),
        byType: Object.entries(casesByType).map(([type, count]) => ({ type, count }))
      })

      // ═══════════════════════════════════════════════════════════
      // 3. تقرير التقييمات
      // ═══════════════════════════════════════════════════════════
      const { data: ratingsData } = await supabase
        .from('ratings')
        .select('id, lawyer_rating, created_at')
        .eq('lawyer_id', lawyerId)
        .gte('created_at', start.toISOString())

      const ratingsCount = ratingsData?.length || 0
      const ratingsAvg = ratingsCount > 0 
        ? ratingsData!.reduce((sum, r) => sum + (r.lawyer_rating || 0), 0) / ratingsCount 
        : 0

      const ratingsDist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      ;(ratingsData || []).forEach(r => {
        if (r.lawyer_rating >= 1 && r.lawyer_rating <= 5) {
          ratingsDist[r.lawyer_rating]++
        }
      })

      const ratingsByMonth: Record<string, { count: number; sum: number }> = {}
      ;(ratingsData || []).forEach(r => {
        const month = new Date(r.created_at).toLocaleString('ar-SA', { month: 'short' })
        if (!ratingsByMonth[month]) ratingsByMonth[month] = { count: 0, sum: 0 }
        ratingsByMonth[month].count++
        ratingsByMonth[month].sum += r.lawyer_rating || 0
      })

      setRatings({
        avg: Math.round(ratingsAvg * 10) / 10,
        count: ratingsCount,
        distribution: Object.entries(ratingsDist).map(([stars, count]) => ({ stars: Number(stars), count })),
        byMonth: Object.entries(ratingsByMonth).map(([month, data]) => ({ 
          month, 
          avg: Math.round((data.sum / data.count) * 10) / 10,
          count: data.count 
        }))
      })

      // ═══════════════════════════════════════════════════════════
      // 4. تقرير الأداء
      // ═══════════════════════════════════════════════════════════
      const completedRequests = requestsData?.filter(r => r.status === 'completed') || []
      const avgResponseTime = completedRequests.length > 0
        ? completedRequests.reduce((sum, r) => {
            if (r.completed_at && r.created_at) {
              return sum + (new Date(r.completed_at).getTime() - new Date(r.created_at).getTime())
            }
            return sum
          }, 0) / completedRequests.length / (1000 * 60 * 60 * 24)
        : 0

      setPerformance({
        sla: lawyerCheck?.sla_compliance_rate || 0,
        avgResponse: Math.round(avgResponseTime * 10) / 10,
        completion: lawyerCheck?.total_requests_handled 
          ? Math.round((lawyerCheck.total_requests_completed / lawyerCheck.total_requests_handled) * 100) 
          : 0
      })

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // تصدير PDF
  const exportPDF = async () => {
    setIsExporting(true)
    try {
      const reportContent = generateReportHTML()
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(reportContent)
        printWindow.document.close()
        printWindow.print()
      }
      toast.success('✅ تم فتح نافذة الطباعة')
    } catch (error) {
      toast.error('حدث خطأ في التصدير')
    } finally {
      setIsExporting(false)
    }
  }

  // تصدير Excel
  const exportExcel = async () => {
    setIsExporting(true)
    try {
      let csvContent = ''
      
      if (activeReport === 'requests') {
        csvContent = 'الحالة,العدد\n'
        requests.byStatus.forEach((row: any) => {
          csvContent += `${translateStatus(row.status)},${row.count}\n`
        })
        csvContent += '\nنوع الخدمة,العدد\n'
        csvContent += `خدمات الباقة,${requests.packageRequests}\n`
        csvContent += `خدمات إضافية,${requests.extraRequests}\n`
      } else if (activeReport === 'cases') {
        csvContent = 'الحالة,العدد\n'
        cases.byStatus.forEach((row: any) => {
          csvContent += `${translateStatus(row.status)},${row.count}\n`
        })
      } else if (activeReport === 'ratings') {
        csvContent = 'النجوم,العدد\n'
        ratings.distribution.forEach((row: any) => {
          csvContent += `${row.stars},${row.count}\n`
        })
      } else if (activeReport === 'performance') {
        csvContent = 'المؤشر,القيمة\n'
        csvContent += `نسبة الالتزام بـ SLA,${performance.sla}%\n`
        csvContent += `متوسط وقت الإنجاز,${performance.avgResponse} يوم\n`
        csvContent += `نسبة الإنجاز,${performance.completion}%\n`
      }

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report_${activeReport}_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      
      toast.success('✅ تم تحميل الملف')
    } catch (error) {
      toast.error('حدث خطأ في التصدير')
    } finally {
      setIsExporting(false)
    }
  }

  const generateReportHTML = () => {
    const periodText = period === 'month' ? 'هذا الشهر' : period === '3months' ? 'آخر 3 أشهر' : period === 'year' ? 'هذه السنة' : 'الكل'
    const reportTitle = activeReport === 'requests' ? 'الطلبات' : activeReport === 'cases' ? 'القضايا' : activeReport === 'ratings' ? 'التقييمات' : 'الأداء'
    
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير ${reportTitle} - محامي الذراع القانوني</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; direction: rtl; }
          h1 { color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
          h2 { color: #475569; margin-top: 30px; }
          .meta { color: #64748b; margin-bottom: 20px; }
          .badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: right; }
          th { background: #f8fafc; }
          .total { font-size: 24px; font-weight: bold; color: #059669; }
          .stat-box { display: inline-block; background: #f8fafc; padding: 15px 25px; margin: 10px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <span class="badge">🏛️ محامي الذراع القانوني</span>
        <h1>📊 تقرير ${reportTitle}</h1>
        <p class="meta">الفترة: ${periodText} | تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</p>
        
        ${activeReport === 'requests' ? `
          <div class="stat-box">
            <div>إجمالي الطلبات</div>
            <div class="total">${requests.total}</div>
          </div>
          <div class="stat-box">
            <div>خدمات الباقة</div>
            <div class="total" style="color: #3b82f6">${requests.packageRequests}</div>
          </div>
          <div class="stat-box">
            <div>خدمات إضافية</div>
            <div class="total" style="color: #8b5cf6">${requests.extraRequests}</div>
          </div>
          <h2>الطلبات حسب الحالة</h2>
          <table>
            <tr><th>الحالة</th><th>العدد</th></tr>
            ${requests.byStatus.map((r: any) => `<tr><td>${translateStatus(r.status)}</td><td>${r.count}</td></tr>`).join('')}
          </table>
        ` : ''}
        
        ${activeReport === 'cases' ? `
          <div class="stat-box">
            <div>إجمالي القضايا</div>
            <div class="total">${cases.total}</div>
          </div>
          <h2>القضايا حسب الحالة</h2>
          <table>
            <tr><th>الحالة</th><th>العدد</th></tr>
            ${cases.byStatus.map((r: any) => `<tr><td>${translateStatus(r.status)}</td><td>${r.count}</td></tr>`).join('')}
          </table>
        ` : ''}
        
        ${activeReport === 'ratings' ? `
          <div class="stat-box">
            <div>متوسط التقييم</div>
            <div class="total">${ratings.avg} ⭐</div>
          </div>
          <div class="stat-box">
            <div>عدد التقييمات</div>
            <div class="total">${ratings.count}</div>
          </div>
          <h2>توزيع التقييمات</h2>
          <table>
            <tr><th>النجوم</th><th>العدد</th></tr>
            ${ratings.distribution.map((r: any) => `<tr><td>${r.stars} ⭐</td><td>${r.count}</td></tr>`).join('')}
          </table>
        ` : ''}
        
        ${activeReport === 'performance' ? `
          <div class="stat-box">
            <div>نسبة الالتزام بـ SLA</div>
            <div class="total">${performance.sla}%</div>
          </div>
          <div class="stat-box">
            <div>متوسط وقت الإنجاز</div>
            <div class="total">${performance.avgResponse} يوم</div>
          </div>
          <div class="stat-box">
            <div>نسبة الإنجاز</div>
            <div class="total">${performance.completion}%</div>
          </div>
        ` : ''}
      </body>
      </html>
    `
  }

  // ترجمة الحالات
  const translateStatus = (status: string) => {
    const map: Record<string, string> = {
      'pending': 'قيد الانتظار',
      'open': 'مفتوح',
      'in_progress': 'قيد التنفيذ',
      'completed': 'مكتمل',
      'closed': 'مغلق',
      'cancelled': 'ملغي',
      'active': 'نشط',
      'won': 'مكسوب',
      'lost': 'خاسر',
      'settled': 'تسوية',
    }
    return map[status] || status
  }

  const translateType = (type: string) => {
    const map: Record<string, string> = {
      'consultation': 'استشارة',
      'case': 'قضية',
      'review': 'مراجعة',
      'contract': 'عقد',
      'drafting': 'صياغة',
      'other': 'أخرى',
    }
    return map[type] || type
  }

  // أكبر قيمة للرسم البياني
  const getMaxValue = (data: any[], key: string) => {
    return Math.max(...data.map(d => d[key] || 0), 1)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">📊 التقارير</h1>
              <p className="text-slate-500 mt-1">تحليل الأداء والإحصائيات</p>
              <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                🏛️ محامي الذراع القانوني
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportPDF}
                disabled={isExporting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={exportExcel}
                disabled={isExporting}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Excel
              </button>
            </div>
          </div>
        </div>

        {/* الفلاتر */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* اختيار التقرير - بدون الأرباح */}
            <div className="flex items-center gap-2 overflow-x-auto">
              {[
                { key: 'requests', label: '📋 الطلبات', color: 'blue' },
                { key: 'cases', label: '⚖️ القضايا', color: 'purple' },
                { key: 'ratings', label: '⭐ التقييمات', color: 'amber' },
                { key: 'performance', label: '📈 الأداء', color: 'indigo' },
              ].map(report => (
                <button
                  key={report.key}
                  onClick={() => setActiveReport(report.key as any)}
                  className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
                    activeReport === report.key
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {report.label}
                </button>
              ))}
            </div>

            {/* فلتر الفترة */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="month">هذا الشهر</option>
                <option value="3months">آخر 3 أشهر</option>
                <option value="year">هذه السنة</option>
                <option value="all">الكل</option>
              </select>
            </div>
          </div>
        </div>

        {/* محتوى التقرير */}
        <div className="space-y-6">

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* تقرير الطلبات (مع تفريق باقة/إضافية) */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeReport === 'requests' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                  <p className="text-blue-100 text-sm">إجمالي الطلبات المنفذة</p>
                  <p className="text-3xl font-bold mt-2">{requests.total}</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border-r-4 border-blue-500">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-5 h-5 text-blue-500" />
                    <p className="text-slate-500 text-sm">خدمات الباقة</p>
                  </div>
                  <p className="text-3xl font-bold text-blue-600">{requests.packageRequests}</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border-r-4 border-purple-500">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-purple-500" />
                    <p className="text-slate-500 text-sm">خدمات إضافية</p>
                  </div>
                  <p className="text-3xl font-bold text-purple-600">{requests.extraRequests}</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <p className="text-slate-500 text-sm">نسبة الإنجاز</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-2">
                    {requests.byStatus.find((s: any) => s.status === 'completed')?.count || 0}
                  </p>
                  <p className="text-xs text-slate-400">طلب مكتمل</p>
                </div>
              </div>

              {/* مصدر الطلبات (باقة vs إضافية) */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4">📦 توزيع الطلبات حسب المصدر</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center p-6 bg-blue-50 rounded-xl">
                    <Package className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                    <p className="text-3xl font-bold text-blue-600">{requests.packageRequests}</p>
                    <p className="text-slate-600 mt-1">خدمات الباقة</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {requests.total > 0 ? Math.round((requests.packageRequests / requests.total) * 100) : 0}% من الإجمالي
                    </p>
                  </div>
                  <div className="text-center p-6 bg-purple-50 rounded-xl">
                    <CheckCircle className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                    <p className="text-3xl font-bold text-purple-600">{requests.extraRequests}</p>
                    <p className="text-slate-600 mt-1">خدمات إضافية</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {requests.total > 0 ? Math.round((requests.extraRequests / requests.total) * 100) : 0}% من الإجمالي
                    </p>
                  </div>
                </div>
              </div>

              {/* حسب الحالة */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4">📋 الطلبات حسب الحالة</h3>
                {requests.byStatus.length > 0 ? (
                  <div className="space-y-3">
                    {requests.byStatus.map((row: any, i: number) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-32 text-sm text-slate-600">{translateStatus(row.status)}</span>
                        <div className="flex-1 h-8 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full flex items-center justify-end px-3"
                            style={{ width: `${(row.count / getMaxValue(requests.byStatus, 'count')) * 100}%` }}
                          >
                            <span className="text-xs text-white font-medium">{row.count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-8">لا توجد بيانات</p>
                )}
              </div>

              {/* حسب النوع */}
              {requests.byType.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="font-bold text-slate-800 mb-4">📊 الطلبات حسب النوع</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {requests.byType.map((row: any, i: number) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-slate-500">{translateType(row.type)}</p>
                        <p className="text-xl font-bold text-blue-600 mt-1">{row.count}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* تقرير القضايا */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeReport === 'cases' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                  <p className="text-purple-100 text-sm">إجمالي القضايا</p>
                  <p className="text-3xl font-bold mt-2">{cases.total}</p>
                </div>
                {cases.byStatus.slice(0, 3).map((row: any, i: number) => (
                  <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
                    <p className="text-slate-500 text-sm">{translateStatus(row.status)}</p>
                    <p className="text-3xl font-bold text-slate-800 mt-2">{row.count}</p>
                  </div>
                ))}
              </div>

              {/* حسب الحالة */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4">⚖️ القضايا حسب الحالة</h3>
                {cases.byStatus.length > 0 ? (
                  <div className="space-y-3">
                    {cases.byStatus.map((row: any, i: number) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-32 text-sm text-slate-600">{translateStatus(row.status)}</span>
                        <div className="flex-1 h-8 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-400 to-purple-500 rounded-full flex items-center justify-end px-3"
                            style={{ width: `${(row.count / getMaxValue(cases.byStatus, 'count')) * 100}%` }}
                          >
                            <span className="text-xs text-white font-medium">{row.count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-8">لا توجد قضايا</p>
                )}
              </div>

              {/* حسب المحكمة */}
              {cases.byCourt.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="font-bold text-slate-800 mb-4">🏛️ القضايا حسب المحكمة</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {cases.byCourt.map((row: any, i: number) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-slate-500">{row.court}</p>
                        <p className="text-xl font-bold text-purple-600 mt-1">{row.count}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* تقرير التقييمات */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeReport === 'ratings' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl p-6 text-white">
                  <p className="text-amber-100 text-sm">متوسط التقييم</p>
                  <p className="text-4xl font-bold mt-2">{ratings.avg} ⭐</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <p className="text-slate-500 text-sm">عدد التقييمات</p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">{ratings.count}</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <p className="text-slate-500 text-sm">تقييمات 5 نجوم</p>
                  <p className="text-3xl font-bold text-amber-500 mt-2">
                    {ratings.distribution.find((d: any) => d.stars === 5)?.count || 0}
                  </p>
                </div>
              </div>

              {/* توزيع التقييمات */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4">⭐ توزيع التقييمات</h3>
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map(stars => {
                    const data = ratings.distribution.find((d: any) => d.stars === stars)
                    const count = data?.count || 0
                    return (
                      <div key={stars} className="flex items-center gap-4">
                        <div className="w-20 flex items-center gap-1">
                          <span className="text-amber-400">★</span>
                          <span className="text-sm text-slate-600">{stars}</span>
                        </div>
                        <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              stars >= 4 ? 'bg-emerald-500' : stars === 3 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${ratings.count > 0 ? (count / ratings.count) * 100 : 0}%` }}
                          ></div>
                        </div>
                        <span className="w-12 text-sm text-slate-500 text-left">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* تقرير الأداء */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeReport === 'performance' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-slate-500 text-sm">نسبة الالتزام بـ SLA</p>
                    {performance.sla >= 80 ? (
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <p className={`text-4xl font-bold ${performance.sla >= 80 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {performance.sla}%
                  </p>
                  <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${performance.sla >= 80 ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${performance.sla}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-slate-500 text-sm mb-4">متوسط وقت الإنجاز</p>
                  <p className="text-4xl font-bold text-slate-800">{performance.avgResponse}</p>
                  <p className="text-slate-400 text-sm">يوم</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-slate-500 text-sm mb-4">نسبة إكمال الطلبات</p>
                  <p className={`text-4xl font-bold ${performance.completion >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {performance.completion}%
                  </p>
                  <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${performance.completion >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${performance.completion}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* نصائح */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <h3 className="font-bold text-blue-800 mb-3">💡 نصائح لتحسين الأداء</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <span>⏰</span>
                    <p className="text-blue-700">استجب للطلبات الجديدة بأسرع وقت ممكن</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>📋</span>
                    <p className="text-blue-700">أكمل الطلبات ضمن المدة المحددة من SLA</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>💬</span>
                    <p className="text-blue-700">حافظ على تواصل مستمر مع المشتركين ومدير الذراع</p>
                  </div>
                </div>
              </div>

              {/* ملاحظة خاصة بمحامي الذراع */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
                <h3 className="font-bold text-purple-800 mb-3">🏛️ ملاحظة لمحامي الذراع</h3>
                <p className="text-purple-700 text-sm">
                  كمحامي ذراع قانوني، أداؤك يؤثر على سمعة الذراع بالكامل. الحفاظ على نسبة SLA عالية ومعدل إنجاز مرتفع يساهم في نجاح الفريق ويعزز ثقة المشتركين.
                </p>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  )
}
