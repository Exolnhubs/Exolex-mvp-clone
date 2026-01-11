'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// 💰 صفحة الأرباح - المحامي المستقل
// 📅 تاريخ: 1 يناير 2026
// ═══════════════════════════════════════════════════════════════
// 📊 المصادر: service_requests (completed) + service_offers
// ═══════════════════════════════════════════════════════════════

export default function EarningsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalEarnings: 0,
    thisMonth: 0,
    lastMonth: 0,
    pending: 0,
    completedCount: 0,
    avgPerRequest: 0
  })
  const [periodFilter, setPeriodFilter] = useState<'all' | 'month' | '3months' | 'year'>('month')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all')

  useEffect(() => { loadData() }, [periodFilter])

  const loadData = async () => {
    try {
      const lawyerId = localStorage.getItem('exolex_lawyer_id')
      if (!lawyerId) { router.push('/auth/lawyer-login'); return }

      // حساب تواريخ الفلترة
      const now = new Date()
      let startDate: Date | null = null
      
      if (periodFilter === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      } else if (periodFilter === '3months') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      } else if (periodFilter === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1)
      }

      // جلب الطلبات المكتملة للمحامي
      let query = supabase
        .from('service_requests')
        .select(`
          id, ticket_number, title, request_type, status,
          total_amount, base_price, created_at, completed_at,
          category:category_id (name_ar)
        `)
        .eq('assigned_lawyer_id', lawyerId)
        .in('status', ['completed', 'in_progress', 'closed'])
        .order('completed_at', { ascending: false })

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString())
      }

      const { data: requestsData, error } = await query

      if (error) throw error

      // جلب العروض المقبولة للحصول على العمولة
      const { data: offersData } = await supabase
        .from('service_offers')
        .select('id, request_id, lawyer_commission_amount, lawyer_commission_percentage, price')
        .eq('accepted_by', lawyerId)

      // دمج البيانات
      const transactionsWithCommission = (requestsData || []).map(req => {
        const offer = offersData?.find(o => o.request_id === req.id)
        const commission = offer?.lawyer_commission_amount || (req.total_amount * 0.7) // افتراضي 70%
        return {
          ...req,
          commission,
          offer
        }
      })

      setTransactions(transactionsWithCommission)

      // حساب الإحصائيات
      const completed = transactionsWithCommission.filter(t => t.status === 'completed')
      const pending = transactionsWithCommission.filter(t => t.status === 'in_progress')
      
      const totalEarnings = completed.reduce((sum, t) => sum + (t.commission || 0), 0)
      const pendingAmount = pending.reduce((sum, t) => sum + (t.commission || 0), 0)

      // أرباح هذا الشهر
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const thisMonthEarnings = completed
        .filter(t => new Date(t.completed_at) >= thisMonthStart)
        .reduce((sum, t) => sum + (t.commission || 0), 0)

      // أرباح الشهر الماضي
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      const lastMonthEarnings = completed
        .filter(t => {
          const date = new Date(t.completed_at)
          return date >= lastMonthStart && date <= lastMonthEnd
        })
        .reduce((sum, t) => sum + (t.commission || 0), 0)

      setStats({
        totalEarnings,
        thisMonth: thisMonthEarnings,
        lastMonth: lastMonthEarnings,
        pending: pendingAmount,
        completedCount: completed.length,
        avgPerRequest: completed.length > 0 ? totalEarnings / completed.length : 0
      })

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // نسبة التغيير
  const getChangePercent = () => {
    if (stats.lastMonth === 0) return stats.thisMonth > 0 ? 100 : 0
    return ((stats.thisMonth - stats.lastMonth) / stats.lastMonth * 100).toFixed(1)
  }

  // فلترة المعاملات
  const filteredTransactions = transactions.filter(t => {
    if (statusFilter === 'completed' && t.status !== 'completed') return false
    if (statusFilter === 'pending' && t.status !== 'in_progress') return false
    return true
  })

  // حالة المعاملة
  const getStatusBadge = (status: string) => {
    const map: Record<string, { text: string; color: string; icon: string }> = {
      'completed': { text: 'مكتملة', color: 'bg-green-100 text-green-700', icon: '✅' },
      'in_progress': { text: 'قيد التنفيذ', color: 'bg-blue-100 text-blue-700', icon: '🔵' },
      'closed': { text: 'مغلقة', color: 'bg-gray-100 text-gray-700', icon: '⚫' }
    }
    return map[status] || { text: status, color: 'bg-gray-100', icon: '⚪' }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">💰 الأرباح</h1>
              <p className="text-slate-500 mt-1">إدارة ومتابعة الإيرادات والأرباح</p>
            </div>
            <button
              onClick={() => toast('🚧 قريباً - طلب تحويل الأرباح')}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-2"
            >
              <span>💳</span>
              طلب تحويل
            </button>
          </div>
        </div>

        {/* الإحصائيات الرئيسية */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* إجمالي الأرباح */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm">إجمالي الأرباح</p>
                <p className="text-3xl font-bold mt-1">{stats.totalEarnings.toLocaleString()}</p>
                <p className="text-emerald-100 text-sm">ريال سعودي</p>
              </div>
              <span className="text-5xl opacity-50">💰</span>
            </div>
          </div>

          {/* أرباح هذا الشهر */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">هذا الشهر</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stats.thisMonth.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-1">
                  {Number(getChangePercent()) >= 0 ? (
                    <span className="text-green-600 text-sm">↑ {getChangePercent()}%</span>
                  ) : (
                    <span className="text-red-600 text-sm">↓ {Math.abs(Number(getChangePercent()))}%</span>
                  )}
                  <span className="text-slate-400 text-xs">عن الشهر الماضي</span>
                </div>
              </div>
              <span className="text-4xl">📈</span>
            </div>
          </div>

          {/* بانتظار التحويل */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">بانتظار الإكمال</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pending.toLocaleString()}</p>
                <p className="text-slate-400 text-xs">طلبات قيد التنفيذ</p>
              </div>
              <span className="text-4xl">⏳</span>
            </div>
          </div>

          {/* متوسط الربح */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">متوسط الربح/طلب</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stats.avgPerRequest.toLocaleString()}</p>
                <p className="text-slate-400 text-xs">{stats.completedCount} طلب مكتمل</p>
              </div>
              <span className="text-4xl">📊</span>
            </div>
          </div>
        </div>

        {/* الفلاتر */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* فلتر الفترة */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">الفترة:</span>
              {[
                { key: 'month', label: 'هذا الشهر' },
                { key: '3months', label: '3 أشهر' },
                { key: 'year', label: 'هذه السنة' },
                { key: 'all', label: 'الكل' },
              ].map(period => (
                <button
                  key={period.key}
                  onClick={() => setPeriodFilter(period.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${
                    periodFilter === period.key
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>

            {/* فلتر الحالة */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">الحالة:</span>
              {[
                { key: 'all', label: 'الكل' },
                { key: 'completed', label: '✅ مكتملة' },
                { key: 'pending', label: '🔵 قيد التنفيذ' },
              ].map(status => (
                <button
                  key={status.key}
                  onClick={() => setStatusFilter(status.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${
                    statusFilter === status.key
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* قائمة المعاملات */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold text-slate-800">📋 سجل الأرباح</h2>
          </div>

          {filteredTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">رقم الطلب</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">النوع</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">التصنيف</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">الحالة</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">المبلغ الكلي</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">عمولتك</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((transaction) => {
                    const status = getStatusBadge(transaction.status)
                    return (
                      <tr key={transaction.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-slate-700">
                            {transaction.ticket_number || '---'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600">
                            {transaction.request_type === 'consultation' ? '💬 استشارة' :
                             transaction.request_type === 'case' ? '⚖️ قضية' :
                             transaction.request_type === 'review' ? '📝 مراجعة' : '📋 خدمة'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600">
                            {transaction.category?.name_ar || '---'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${status.color}`}>
                            {status.icon} {status.text}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-500">
                            {transaction.total_amount?.toLocaleString() || '---'} ر.س
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold text-emerald-600">
                            {transaction.commission?.toLocaleString() || '---'} ر.س
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-500">
                            {transaction.completed_at 
                              ? new Date(transaction.completed_at).toLocaleDateString('ar-SA')
                              : new Date(transaction.created_at).toLocaleDateString('ar-SA')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <span className="text-6xl block mb-4">💰</span>
              <h3 className="text-xl font-bold text-slate-700">لا توجد أرباح</h3>
              <p className="text-slate-400 mt-2">ستظهر أرباحك هنا عند إكمال الطلبات</p>
            </div>
          )}
        </div>

        {/* ملخص */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* نسبة العمولة */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-4">📊 توزيع الأرباح</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">نسبتك من كل طلب</span>
                <span className="text-2xl font-bold text-emerald-600">70%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">نسبة المنصة</span>
                <span className="text-xl font-bold text-slate-400">30%</span>
              </div>
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '70%' }}></div>
              </div>
            </div>
          </div>

          {/* معلومات التحويل */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-4">💳 معلومات التحويل</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600">الحد الأدنى للتحويل</span>
                <span className="font-bold text-slate-800">500 ر.س</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600">مدة التحويل</span>
                <span className="font-bold text-slate-800">3-5 أيام عمل</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600">طريقة التحويل</span>
                <span className="font-bold text-slate-800">تحويل بنكي</span>
              </div>
            </div>
            <button
              onClick={() => toast('🚧 قريباً - إعدادات الحساب البنكي')}
              className="w-full mt-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
            >
              ⚙️ إعدادات الحساب البنكي
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
