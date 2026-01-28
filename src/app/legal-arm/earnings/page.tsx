'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getLegalArmId } from '@/lib/cookies'

// ═══════════════════════════════════════════════════════════════
// 💰 صفحة الأرباح - الذراع القانوني
// 📅 تاريخ: 3 يناير 2026
// ═══════════════════════════════════════════════════════════════
// 📊 المصادر:
//    1. إيراد المنصة: Cost Plus (رواتب + نسبة) أو ثابت شهري
//    2. أرباح الطلبات: 50% من الطلبات المكتملة
// ═══════════════════════════════════════════════════════════════

export default function LegalArmEarningsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [armData, setArmData] = useState<any>(null)
  const [lawyers, setLawyers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  
  const [stats, setStats] = useState({
    totalRevenue: 0,
    platformRevenue: 0,
    requestsEarnings: 0,
    thisMonth: 0,
    lastMonth: 0,
    pendingEarnings: 0,
    completedCount: 0,
    totalSalaries: 0,
    costPlusAmount: 0
  })
  
  const [periodFilter, setPeriodFilter] = useState<'all' | 'month' | '3months' | 'year'>('month')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all')

  // نسبة عمولة الذراع من الطلبات
  const COMMISSION_RATE = 0.50

  useEffect(() => { loadData() }, [periodFilter])

  const loadData = async () => {
    try {
      const legalArmId = getLegalArmId()
      if (!legalArmId) { 
        router.push('/auth/legal-arm-login')
        return 
      }

      // 1. جلب بيانات الذراع
      const { data: armInfo, error: armError } = await supabase
        .from('legal_arms')
        .select('id, name_ar, payment_model, cost_plus_margin, fixed_monthly_amount, commission_rate')
        .eq('id', legalArmId)
        .single()

      if (armError) throw armError
      setArmData(armInfo)

      // 2. جلب المحامين التابعين للذراع
      const { data: lawyersData, error: lawyersError } = await supabase
        .from('lawyers')
        .select('id, full_name, salary, salary_start_date, is_available')
        .eq('legal_arm_id', legalArmId)
        .eq('lawyer_type', 'legal_arm')

      if (lawyersError) throw lawyersError
      setLawyers(lawyersData || [])

      // حساب إجمالي الرواتب
      const totalSalaries = (lawyersData || []).reduce((sum, l) => sum + (l.salary || 0), 0)
      
      // حساب Cost Plus
      const margin = armInfo?.cost_plus_margin || 0
      const costPlusAmount = totalSalaries * (margin / 100)
      
      // إيراد المنصة
      let platformRevenue = 0
      if (armInfo?.payment_model === 'cost_plus') {
        platformRevenue = totalSalaries + costPlusAmount
      } else if (armInfo?.payment_model === 'fixed') {
        platformRevenue = armInfo?.fixed_monthly_amount || 0
      }

      // 3. جلب الطلبات المكتملة للمحامين التابعين
      const lawyerIds = (lawyersData || []).map(l => l.id)
      
      if (lawyerIds.length > 0) {
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

        let query = supabase
          .from('service_requests')
          .select(`
            id, ticket_number, title, request_type, status,
            total_amount, base_price, created_at, completed_at,
            assigned_lawyer_id,
            category:category_id (name_ar),
            lawyer:assigned_lawyer_id (full_name)
          `)
          .in('assigned_lawyer_id', lawyerIds)
          .in('status', ['completed', 'in_progress', 'closed'])
          .order('created_at', { ascending: false })

        if (startDate) {
          query = query.gte('created_at', startDate.toISOString())
        }

        const { data: requestsData, error: requestsError } = await query

        if (requestsError) throw requestsError

        // حساب العمولة لكل طلب
        const transactionsWithCommission = (requestsData || []).map(req => {
          const commission = (req.total_amount || 0) * COMMISSION_RATE
          return { ...req, commission }
        })

        setTransactions(transactionsWithCommission)

        // حساب إحصائيات الطلبات
        const completed = transactionsWithCommission.filter(t => t.status === 'completed' || t.status === 'closed')
        const pending = transactionsWithCommission.filter(t => t.status === 'in_progress')
        
        const requestsEarnings = completed.reduce((sum, t) => sum + (t.commission || 0), 0)
        const pendingEarnings = pending.reduce((sum, t) => sum + (t.commission || 0), 0)

        // أرباح هذا الشهر
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const thisMonthEarnings = completed
          .filter(t => t.completed_at && new Date(t.completed_at) >= thisMonthStart)
          .reduce((sum, t) => sum + (t.commission || 0), 0)

        // أرباح الشهر الماضي
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
        const lastMonthEarnings = completed
          .filter(t => {
            if (!t.completed_at) return false
            const date = new Date(t.completed_at)
            return date >= lastMonthStart && date <= lastMonthEnd
          })
          .reduce((sum, t) => sum + (t.commission || 0), 0)

        setStats({
          totalRevenue: platformRevenue + requestsEarnings,
          platformRevenue,
          requestsEarnings,
          thisMonth: thisMonthEarnings + (periodFilter === 'month' ? platformRevenue : 0),
          lastMonth: lastMonthEarnings,
          pendingEarnings,
          completedCount: completed.length,
          totalSalaries,
          costPlusAmount
        })
      } else {
        setStats({
          totalRevenue: platformRevenue,
          platformRevenue,
          requestsEarnings: 0,
          thisMonth: platformRevenue,
          lastMonth: 0,
          pendingEarnings: 0,
          completedCount: 0,
          totalSalaries,
          costPlusAmount
        })
      }

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
    if (statusFilter === 'completed' && t.status !== 'completed' && t.status !== 'closed') return false
    if (statusFilter === 'pending' && t.status !== 'in_progress') return false
    return true
  })

  // حالة المعاملة
  const getStatusBadge = (status: string) => {
    const map: Record<string, { text: string; color: string; icon: string }> = {
      'completed': { text: 'مكتملة', color: 'green', icon: '✅' },
      'in_progress': { text: 'قيد التنفيذ', color: 'blue', icon: '🔵' },
      'closed': { text: 'مغلقة', color: 'gray', icon: '⚫' }
    }
    return map[status] || { text: status, color: 'gray', icon: '⚪' }
  }

  // نوع الطلب
  const getRequestTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      'consultation': '💬 استشارة',
      'case': '⚖️ قضية',
      'review': '📝 مراجعة',
      'service': '📋 خدمة'
    }
    return map[type] || '📋 خدمة'
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid #10b981', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#64748b' }}>جاري تحميل الأرباح...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 24 }}>

      {/* Header */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>💰 الأرباح والإيرادات</h1>
            <p style={{ color: '#64748b', marginTop: 4 }}>إدارة ومتابعة إيرادات الذراع القانوني</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ padding: '4px 12px', backgroundColor: armData?.payment_model === 'cost_plus' ? '#dbeafe' : '#fef3c7', color: armData?.payment_model === 'cost_plus' ? '#1d4ed8' : '#b45309', borderRadius: 8, fontSize: 14 }}>
              {armData?.payment_model === 'cost_plus' ? '📊 Cost Plus' : '💵 راتب ثابت'}
            </span>
            <button
              onClick={() => toast('🚧 قريباً - طلب تحويل الأرباح')}
              style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span>💳</span>
              طلب تحويل
            </button>
          </div>
        </div>
      </div>

      {/* الإحصائيات الرئيسية */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* إجمالي الإيرادات */}
        <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: 12, padding: 24, color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: '#d1fae5', fontSize: 14, margin: 0 }}>إجمالي الإيرادات</p>
              <p style={{ fontSize: 28, fontWeight: 'bold', margin: '4px 0' }}>{stats.totalRevenue.toLocaleString()}</p>
              <p style={{ color: '#d1fae5', fontSize: 14, margin: 0 }}>ريال سعودي</p>
            </div>
            <span style={{ fontSize: 48, opacity: 0.5 }}>💰</span>
          </div>
        </div>

        {/* إيراد المنصة */}
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>إيراد المنصة</p>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#2563eb', margin: '4px 0' }}>{stats.platformRevenue.toLocaleString()}</p>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
                {armData?.payment_model === 'cost_plus' ? `رواتب + ${armData?.cost_plus_margin || 0}%` : 'شهري ثابت'}
              </p>
            </div>
            <span style={{ fontSize: 40 }}>🏢</span>
          </div>
        </div>

        {/* أرباح الطلبات */}
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>أرباح الطلبات (50%)</p>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#059669', margin: '4px 0' }}>{stats.requestsEarnings.toLocaleString()}</p>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>{stats.completedCount} طلب مكتمل</p>
            </div>
            <span style={{ fontSize: 40 }}>📋</span>
          </div>
        </div>

        {/* بانتظار الإكمال */}
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>بانتظار الإكمال</p>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#d97706', margin: '4px 0' }}>{stats.pendingEarnings.toLocaleString()}</p>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>طلبات قيد التنفيذ</p>
            </div>
            <span style={{ fontSize: 40 }}>⏳</span>
          </div>
        </div>
      </div>

      {/* تفاصيل إيراد المنصة */}
      {armData?.payment_model === 'cost_plus' && lawyers.length > 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>📊 تفاصيل إيراد المنصة (Cost Plus)</h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0' }}>رواتب المحامين + نسبة {armData?.cost_plus_margin || 0}%</p>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#475569' }}>المحامي</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#475569' }}>الحالة</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#475569' }}>الراتب</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#475569' }}>+ نسبة {armData?.cost_plus_margin || 0}%</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#475569' }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {lawyers.map((lawyer) => {
                  const margin = (lawyer.salary || 0) * ((armData?.cost_plus_margin || 0) / 100)
                  const total = (lawyer.salary || 0) + margin
                  return (
                    <tr key={lawyer.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 500, color: '#1e293b' }}>{lawyer.full_name}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: 9999, 
                          fontSize: 12,
                          backgroundColor: lawyer.is_available ? '#dcfce7' : '#f1f5f9',
                          color: lawyer.is_available ? '#15803d' : '#64748b'
                        }}>
                          {lawyer.is_available ? '🟢 متاح' : '⚫ غير متاح'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: '#475569' }}>{(lawyer.salary || 0).toLocaleString()} ر.س</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: '#2563eb' }}>+{margin.toLocaleString()} ر.س</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 'bold', color: '#059669' }}>{total.toLocaleString()} ر.س</span>
                      </td>
                    </tr>
                  )
                })}
                {/* صف المجموع */}
                <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                  <td style={{ padding: '12px 16px' }} colSpan={2}>
                    <span style={{ color: '#1e293b' }}>المجموع ({lawyers.length} محامي)</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: '#475569' }}>{stats.totalSalaries.toLocaleString()} ر.س</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: '#2563eb' }}>+{stats.costPlusAmount.toLocaleString()} ر.س</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: '#059669' }}>{stats.platformRevenue.toLocaleString()} ر.س</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* الراتب الثابت */}
      {armData?.payment_model === 'fixed' && (
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontWeight: 'bold', color: '#1e293b', margin: 0 }}>💵 الإيراد الثابت الشهري</h3>
              <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>المبلغ المتفق عليه من المنصة</p>
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 32, fontWeight: 'bold', color: '#2563eb', margin: 0 }}>{(armData?.fixed_monthly_amount || 0).toLocaleString()}</p>
              <p style={{ color: '#64748b', fontSize: 14 }}>ريال / شهرياً</p>
            </div>
          </div>
        </div>
      )}

      {/* الفلاتر */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          {/* فلتر الفترة */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: '#475569' }}>الفترة:</span>
            {[
              { key: 'month', label: 'هذا الشهر' },
              { key: '3months', label: '3 أشهر' },
              { key: 'year', label: 'هذه السنة' },
              { key: 'all', label: 'الكل' },
            ].map(period => (
              <button
                key={period.key}
                onClick={() => setPeriodFilter(period.key as any)}
                style={{ 
                  padding: '6px 12px', 
                  borderRadius: 8, 
                  fontSize: 14, 
                  border: 'none', 
                  cursor: 'pointer',
                  backgroundColor: periodFilter === period.key ? '#2563eb' : '#f1f5f9',
                  color: periodFilter === period.key ? 'white' : '#475569'
                }}
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* فلتر الحالة */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: '#475569' }}>الحالة:</span>
            {[
              { key: 'all', label: 'الكل' },
              { key: 'completed', label: '✅ مكتملة' },
              { key: 'pending', label: '🔵 قيد التنفيذ' },
            ].map(status => (
              <button
                key={status.key}
                onClick={() => setStatusFilter(status.key as any)}
                style={{ 
                  padding: '6px 12px', 
                  borderRadius: 8, 
                  fontSize: 14, 
                  border: 'none', 
                  cursor: 'pointer',
                  backgroundColor: statusFilter === status.key ? '#2563eb' : '#f1f5f9',
                  color: statusFilter === status.key ? 'white' : '#475569'
                }}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* سجل أرباح الطلبات */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>📋 سجل أرباح الطلبات (50%)</h2>
        </div>

        {filteredTransactions.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#475569' }}>رقم الطلب</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#475569' }}>النوع</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#475569' }}>التصنيف</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#475569' }}>المحامي</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#475569' }}>الحالة</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#475569' }}>المبلغ الكلي</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#475569' }}>عمولتكم (50%)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#475569' }}>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => {
                  const status = getStatusBadge(transaction.status)
                  return (
                    <tr key={transaction.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 14, color: '#374151' }}>
                          {transaction.ticket_number || '---'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 14, color: '#475569' }}>
                          {getRequestTypeLabel(transaction.request_type)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 14, color: '#475569' }}>
                          {transaction.category?.name_ar || '---'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 14, color: '#475569' }}>
                          {transaction.lawyer?.full_name || '---'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: 4, 
                          fontSize: 12, 
                          padding: '4px 8px', 
                          borderRadius: 9999,
                          backgroundColor: status.color === 'green' ? '#dcfce7' : status.color === 'blue' ? '#dbeafe' : '#f1f5f9',
                          color: status.color === 'green' ? '#15803d' : status.color === 'blue' ? '#1d4ed8' : '#374151'
                        }}>
                          {status.icon} {status.text}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 14, color: '#64748b' }}>
                          {transaction.total_amount?.toLocaleString() || '---'} ر.س
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 14, fontWeight: 'bold', color: '#059669' }}>
                          {transaction.commission?.toLocaleString() || '---'} ر.س
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 14, color: '#64748b' }}>
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
          <div style={{ padding: 48, textAlign: 'center' }}>
            <span style={{ fontSize: 64, display: 'block', marginBottom: 16 }}>📋</span>
            <h3 style={{ fontSize: 20, fontWeight: 'bold', color: '#374151', margin: 0 }}>لا توجد طلبات</h3>
            <p style={{ color: '#94a3b8', marginTop: 8 }}>ستظهر أرباح الطلبات هنا عند إكمالها</p>
          </div>
        )}
      </div>

      {/* ملخص */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
        {/* نسبة العمولة */}
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: 16 }}>📊 توزيع أرباح الطلبات</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#475569' }}>نسبتكم من كل طلب</span>
              <span style={{ fontSize: 24, fontWeight: 'bold', color: '#059669' }}>50%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#475569' }}>نسبة المنصة</span>
              <span style={{ fontSize: 20, fontWeight: 'bold', color: '#94a3b8' }}>50%</span>
            </div>
            <div style={{ height: 12, backgroundColor: '#e2e8f0', borderRadius: 9999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '50%', backgroundColor: '#10b981', borderRadius: 9999 }}></div>
            </div>
          </div>
        </div>

        {/* معلومات التحويل */}
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: 16 }}>💳 معلومات التحويل</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#f8fafc', borderRadius: 8 }}>
              <span style={{ color: '#475569', fontSize: 14 }}>الحد الأدنى للتحويل</span>
              <span style={{ fontWeight: 'bold', color: '#1e293b', fontSize: 14 }}>500 ر.س</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#f8fafc', borderRadius: 8 }}>
              <span style={{ color: '#475569', fontSize: 14 }}>مدة التحويل</span>
              <span style={{ fontWeight: 'bold', color: '#1e293b', fontSize: 14 }}>3-5 أيام عمل</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#f8fafc', borderRadius: 8 }}>
              <span style={{ color: '#475569', fontSize: 14 }}>طريقة التحويل</span>
              <span style={{ fontWeight: 'bold', color: '#1e293b', fontSize: 14 }}>تحويل بنكي</span>
            </div>
          </div>
          <button
            onClick={() => toast('🚧 قريباً - إعدادات الحساب البنكي')}
            style={{ width: '100%', marginTop: 16, padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
          >
            ⚙️ إعدادات الحساب البنكي
          </button>
        </div>
      </div>

    </div>
  )
}
