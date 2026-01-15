'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// ⭐ صفحة التقييمات - المحامي المستقل
// 📅 تاريخ: 1 يناير 2026 - محدث مع الرد
// ═══════════════════════════════════════════════════════════════

export default function RatingsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [ratings, setRatings] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalRatings: 0, avgLawyer: 0, avgService: 0, avgPlatform: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  })
  const [filterRating, setFilterRating] = useState<number | 'all'>('all')
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'month' | '3months' | 'year'>('all')
  const [replyModal, setReplyModal] = useState<{ show: boolean; rating: any }>({ show: false, rating: null })
  const [replyText, setReplyText] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => { loadData() }, [filterPeriod])

  const loadData = async () => {
    try {
      const lawyerId = localStorage.getItem('exolex_lawyer_id')
      if (!lawyerId) { router.push('/auth/lawyer-login'); return }

      const now = new Date()
      let startDate: Date | null = null
      if (filterPeriod === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      else if (filterPeriod === '3months') startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      else if (filterPeriod === 'year') startDate = new Date(now.getFullYear(), 0, 1)

      let query = supabase
        .from('request_reviews')
        .select(`*, request:request_id (ticket_number, title, request_type)`)
        .eq('lawyer_id', lawyerId)
        .order('created_at', { ascending: false })

      if (startDate) query = query.gte('created_at', startDate.toISOString())

      const { data: ratingsData, error } = await query
      if (error) throw error

      setRatings(ratingsData || [])

      const total = ratingsData?.length || 0
      if (total > 0) {
        const avgLawyer = ratingsData!.reduce((sum, r) => sum + (r.lawyer_overall_rating || 0), 0) / total
        const avgService = ratingsData!.reduce((sum, r) => sum + (r.service_quality || 0), 0) / total
        const avgPlatform = ratingsData!.reduce((sum, r) => sum + (r.app_overall_experience || 0), 0) / total
        const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        ratingsData!.forEach(r => {
          const rating = r.lawyer_overall_rating
          if (rating >= 1 && rating <= 5) distribution[rating as keyof typeof distribution]++
        })
        setStats({ totalRatings: total, avgLawyer: Math.round(avgLawyer * 10) / 10, avgService: Math.round(avgService * 10) / 10, avgPlatform: Math.round(avgPlatform * 10) / 10, distribution })
      } else {
        setStats({ totalRatings: 0, avgLawyer: 0, avgService: 0, avgPlatform: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } })
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل التقييمات')
    } finally {
      setIsLoading(false)
    }
  }

  // فتح modal الرد
  const openReplyModal = (rating: any) => {
    setReplyText(rating.lawyer_reply || '')
    setReplyModal({ show: true, rating })
  }

  // حفظ الرد
  const saveReply = async () => {
    if (!replyText.trim()) {
      toast.error('يرجى كتابة الرد')
      return
    }
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('request_reviews')
        .update({ lawyer_reply: replyText.trim(), replied_at: new Date().toISOString() })
        .eq('id', replyModal.rating.id)

      if (error) throw error

      toast.success('✅ تم حفظ الرد')
      setReplyModal({ show: false, rating: null })
      setReplyText('')
      loadData()
    } catch (error) {
      console.error(error)
      toast.error('حدث خطأ')
    } finally {
      setIsSaving(false)
    }
  }

  // حذف الرد
  const deleteReply = async (ratingId: string) => {
    if (!confirm('هل تريد حذف الرد؟')) return
    try {
      await supabase
        .from('request_reviews')
        .update({ lawyer_reply: null, replied_at: null })
        .eq('id', ratingId)

      toast.success('تم حذف الرد')
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  const renderStars = (rating: number, size: string = 'text-lg') => (
    <div className={`flex items-center gap-0.5 ${size}`}>
      {[1, 2, 3, 4, 5].map(star => (
        <span key={star} className={star <= rating ? 'text-amber-400' : 'text-slate-300'}>★</span>
      ))}
    </div>
  )

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-emerald-600'
    if (rating >= 4) return 'text-green-600'
    if (rating >= 3) return 'text-amber-600'
    if (rating >= 2) return 'text-orange-600'
    return 'text-red-600'
  }

  const filteredRatings = ratings.filter(r => filterRating === 'all' || r.lawyer_overall_rating === filterRating)
  const getDistributionPercent = (count: number) => stats.totalRatings === 0 ? 0 : (count / stats.totalRatings) * 100

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
          <h1 className="text-2xl font-bold text-slate-800">⭐ التقييمات</h1>
          <p className="text-slate-500 mt-1">تقييمات العملاء وآراءهم في خدماتك</p>
        </div>

        {/* الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl p-6 text-white">
            <div className="text-center">
              <p className="text-amber-100 text-sm">تقييمك العام</p>
              <p className="text-5xl font-bold mt-2">{stats.avgLawyer || '---'}</p>
              <div className="flex justify-center mt-2">{renderStars(Math.round(stats.avgLawyer), 'text-2xl')}</div>
              <p className="text-amber-100 text-sm mt-2">{stats.totalRatings} تقييم</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">تقييم المحامي</p>
                <p className={`text-3xl font-bold mt-1 ${getRatingColor(stats.avgLawyer)}`}>{stats.avgLawyer || '---'}</p>
                {renderStars(Math.round(stats.avgLawyer))}
              </div>
              <span className="text-4xl">👨‍⚖️</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">تقييم الخدمة</p>
                <p className={`text-3xl font-bold mt-1 ${getRatingColor(stats.avgService)}`}>{stats.avgService || '---'}</p>
                {renderStars(Math.round(stats.avgService))}
              </div>
              <span className="text-4xl">⚖️</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">إجمالي التقييمات</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{stats.totalRatings}</p>
                <p className="text-slate-400 text-sm">تقييم من العملاء</p>
              </div>
              <span className="text-4xl">📊</span>
            </div>
          </div>
        </div>

        {/* توزيع التقييمات */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">📊 توزيع التقييمات</h2>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map(star => (
              <div key={star} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-20">
                  <span className="text-amber-400">★</span>
                  <span className="text-sm text-slate-600">{star}</span>
                </div>
                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${getDistributionPercent(stats.distribution[star as keyof typeof stats.distribution])}%` }}></div>
                </div>
                <span className="text-sm text-slate-500 w-12 text-left">{stats.distribution[star as keyof typeof stats.distribution]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* الفلاتر */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">التقييم:</span>
              <button onClick={() => setFilterRating('all')} className={`px-3 py-1.5 rounded-lg text-sm ${filterRating === 'all' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>الكل</button>
              {[5, 4, 3, 2, 1].map(star => (
                <button key={star} onClick={() => setFilterRating(star)} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${filterRating === star ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <span className={filterRating === star ? 'text-white' : 'text-amber-400'}>★</span>{star}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">الفترة:</span>
              {[{ key: 'month', label: 'هذا الشهر' }, { key: '3months', label: '3 أشهر' }, { key: 'year', label: 'هذه السنة' }, { key: 'all', label: 'الكل' }].map(period => (
                <button key={period.key} onClick={() => setFilterPeriod(period.key as any)} className={`px-3 py-1.5 rounded-lg text-sm ${filterPeriod === period.key ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{period.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* قائمة التقييمات */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold text-slate-800">💬 آراء العملاء</h2>
          </div>

          {filteredRatings.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {filteredRatings.map((rating) => (
                <div key={rating.id} className="p-6 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                        <span className="text-xl">👤</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-sm text-slate-500">{rating.request?.ticket_number || '---'}</span>
                          <span className="text-sm text-slate-400">•</span>
                          <span className="text-sm text-slate-500">
                            {rating.request?.request_type === 'consultation' ? '💬 استشارة' : rating.request?.request_type === 'case' ? '⚖️ قضية' : '📋 خدمة'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">المحامي:</span>
                            {renderStars(rating.lawyer_rating, 'text-sm')}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">الخدمة:</span>
                            {renderStars(rating.service_rating, 'text-sm')}
                          </div>
                        </div>

                        {/* تعليق العميل */}
                        {rating.comment && (
                          <div className="bg-slate-50 p-3 rounded-lg mb-3">
                            <p className="text-slate-700">"{rating.comment}"</p>
                          </div>
                        )}

                        {/* رد المحامي */}
                        {rating.lawyer_reply ? (
                          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-amber-600 font-medium">↩️ ردك:</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">
                                  {rating.replied_at && new Date(rating.replied_at).toLocaleDateString('ar-SA')}
                                </span>
                                <button onClick={() => openReplyModal(rating)} className="text-xs text-amber-600 hover:underline">تعديل</button>
                                <button onClick={() => deleteReply(rating.id)} className="text-xs text-red-500 hover:underline">حذف</button>
                              </div>
                            </div>
                            <p className="text-slate-700">{rating.lawyer_reply}</p>
                          </div>
                        ) : (
                          <button
                            onClick={() => openReplyModal(rating)}
                            className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
                          >
                            ↩️ الرد على التقييم
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-slate-400">{new Date(rating.created_at).toLocaleDateString('ar-SA')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <span className="text-6xl block mb-4">⭐</span>
              <h3 className="text-xl font-bold text-slate-700">لا توجد تقييمات</h3>
              <p className="text-slate-400 mt-2">ستظهر تقييمات العملاء هنا بعد إكمال الطلبات</p>
            </div>
          )}
        </div>

        {/* نصائح */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <h3 className="font-bold text-blue-800 mb-3">💡 نصائح لتحسين تقييمك</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-2">
              <span className="text-xl">⏰</span>
              <div><p className="font-medium text-slate-700">الرد السريع</p><p className="text-sm text-slate-500">استجب للطلبات خلال الـ SLA</p></div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xl">💬</span>
              <div><p className="font-medium text-slate-700">التواصل الواضح</p><p className="text-sm text-slate-500">اشرح الإجراءات بوضوح</p></div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xl">↩️</span>
              <div><p className="font-medium text-slate-700">الرد على التقييمات</p><p className="text-sm text-slate-500">تفاعل مع آراء العملاء</p></div>
            </div>
          </div>
        </div>

      </div>

      {/* Modal الرد */}
      {replyModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">↩️ الرد على التقييم</h2>
                <button onClick={() => setReplyModal({ show: false, rating: null })} className="text-slate-400 hover:text-slate-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6">
              {/* عرض التقييم */}
              <div className="bg-slate-50 p-4 rounded-lg mb-4">
                <div className="flex items-center gap-2 mb-2">
                  {renderStars(replyModal.rating?.lawyer_rating, 'text-lg')}
                  <span className="text-sm text-slate-500">• {replyModal.rating?.request?.ticket_number}</span>
                </div>
                {replyModal.rating?.comment && (
                  <p className="text-slate-600">"{replyModal.rating.comment}"</p>
                )}
              </div>

              {/* حقل الرد */}
              <div>
                <label className="block text-sm text-slate-600 mb-2">ردك على العميل:</label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg resize-none focus:ring-2 focus:ring-amber-500"
                  placeholder="اكتب ردك هنا... (سيظهر للعميل)"
                />
                <p className="text-xs text-slate-400 mt-1">الرد سيكون مرئياً للعميل وجميع المستخدمين</p>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 flex gap-3">
              <button onClick={() => setReplyModal({ show: false, rating: null })} className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100">إلغاء</button>
              <button onClick={saveReply} disabled={isSaving} className="flex-1 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
                {isSaving ? '⏳ جاري الحفظ...' : '✅ حفظ الرد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
