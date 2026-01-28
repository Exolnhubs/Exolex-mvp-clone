'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { clearAuthCookies } from '@/lib/auth'
import { getUserId } from '@/lib/cookies'
import Sidebar from '@/components/layout/Sidebar'
import toast from 'react-hot-toast'
import { Star, MessageCircle, Calendar, FileText, User, ArrowRight } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// ⭐ صفحة تقييماتي - المشترك
// 📅 تاريخ: 14 يناير 2026
// ═══════════════════════════════════════════════════════════════

interface Review {
  id: string
  request_id: string
  lawyer_id: string
  lawyer_overall_rating: number
  lawyer_comment: string | null
  service_quality: number
  service_comment: string | null
  app_overall_experience: number
  app_comment: string | null
  lawyer_reply: string | null
  replied_at: string | null
  created_at: string
  request?: {
    ticket_number: string
    title: string
  }
  lawyer?: {
    lawyer_code: string
    full_name: string
  }
}

export default function MyRatingsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [reviews, setReviews] = useState<Review[]>([])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const userId = getUserId()
      if (!userId) { router.push('/auth/login'); return }

      // جلب member_id
      const { data: memberData } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!memberData) { router.push('/auth/login'); return }

      // جلب التقييمات
      const { data: reviewsData, error } = await supabase
        .from('request_reviews')
        .select(`
          *,
          request:request_id (ticket_number, title),
          lawyer:lawyer_id (lawyer_code, full_name)
        `)
        .eq('member_id', memberData.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setReviews(reviewsData || [])
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل التقييمات')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (date: string) => new Date(date).toLocaleDateString('ar-SA')

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar isSubscribed={true} userName="مشترك" onLogout={() => {
          clearAuthCookies()
          router.push('/auth/login')
        }} />
        <main className="flex-1 mr-64 p-8">
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-500">جاري التحميل...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isSubscribed={true} userName="مشترك" onLogout={() => {
        clearAuthCookies()
        router.push('/auth/login')
      }} />
      
      <main className="flex-1 mr-64 p-8">
        <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-l from-amber-500 to-yellow-500 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
            <Star className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">تقييماتي</h1>
            <p className="opacity-90">التقييمات التي قدمتها للخدمات والمحامين</p>
          </div>
        </div>
        
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-white/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold">{reviews.length}</p>
            <p className="text-sm opacity-90">إجمالي التقييمات</p>
          </div>
          <div className="bg-white/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold">
              {reviews.filter(r => r.lawyer_reply).length}
            </p>
            <p className="text-sm opacity-90">ردود المحامين</p>
          </div>
          <div className="bg-white/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold">
              {reviews.length > 0 
                ? (reviews.reduce((sum, r) => sum + (r.lawyer_overall_rating || 0), 0) / reviews.length).toFixed(1)
                : '0'
              }
            </p>
            <p className="text-sm opacity-90">متوسط تقييماتك</p>
          </div>
        </div>
      </div>

      {/* قائمة التقييمات */}
      {reviews.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Star className="w-10 h-10 text-amber-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">لم تقدم أي تقييم بعد</h3>
          <p className="text-slate-500 mb-4">بعد إكمال طلباتك ستتمكن من تقييم الخدمة والمحامي</p>
          <button
            onClick={() => router.push('/subscriber/requests')}
            className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            عرض طلباتي
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="bg-slate-50 p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{review.request?.ticket_number}</p>
                    <p className="text-sm text-slate-500">{review.request?.title}</p>
                  </div>
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1 text-sm text-slate-500">
                    <Calendar className="w-4 h-4" />
                    {formatDate(review.created_at)}
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* تقييم المحامي */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      <span className="font-bold text-blue-800">تقييم المحامي</span>
                      <span className="text-sm text-blue-600">({review.lawyer?.lawyer_code})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderStars(Math.round(review.lawyer_overall_rating || 0))}
                      <span className="font-bold text-blue-800">{review.lawyer_overall_rating?.toFixed(1)}</span>
                    </div>
                  </div>
                  {review.lawyer_comment && (
                    <p className="text-slate-700 text-sm bg-white rounded-lg p-3">
                      "{review.lawyer_comment}"
                    </p>
                  )}
                  
                  {/* رد المحامي */}
                  {review.lawyer_reply && (
                    <div className="mt-3 bg-blue-100 rounded-lg p-3 border-r-4 border-blue-500">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageCircle className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-bold text-blue-800">رد المحامي:</span>
                        {review.replied_at && (
                          <span className="text-xs text-blue-500">{formatDate(review.replied_at)}</span>
                        )}
                      </div>
                      <p className="text-slate-700 text-sm">{review.lawyer_reply}</p>
                    </div>
                  )}
                </div>

                {/* تقييم الخدمة */}
                <div className="bg-green-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-green-800">تقييم الخدمة</span>
                    <div className="flex items-center gap-2">
                      {renderStars(review.service_quality || 0)}
                      <span className="font-bold text-green-800">{review.service_quality}</span>
                    </div>
                  </div>
                  {review.service_comment && (
                    <p className="text-slate-700 text-sm bg-white rounded-lg p-3">
                      "{review.service_comment}"
                    </p>
                  )}
                </div>

                {/* تقييم التطبيق */}
                <div className="bg-purple-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-purple-800">تقييم التطبيق</span>
                    <div className="flex items-center gap-2">
                      {renderStars(review.app_overall_experience || 0)}
                      <span className="font-bold text-purple-800">{review.app_overall_experience}</span>
                    </div>
                  </div>
                  {review.app_comment && (
                    <p className="text-slate-700 text-sm bg-white rounded-lg p-3">
                      "{review.app_comment}"
                    </p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 p-3 border-t">
                <button
                  onClick={() => router.push(`/subscriber/requests/${review.request_id}`)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <ArrowRight className="w-4 h-4" />
                  عرض تفاصيل الطلب
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
        </div>
      </main>
    </div>
  )
}
