'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface RequestDetails {
  id: string
  ticket_number: string
  title: string
  description: string
  service_type: string
  domain: string
  status: string
  base_price: number | null
  sla_deadline: string | null
  created_at: string
  member_id: string | null
  is_urgent: boolean
  attachments: any[]
}

export default function RequestDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const requestId = params.id as string

  const [loading, setLoading] = useState(true)
  const [request, setRequest] = useState<RequestDetails | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [lawyerId, setLawyerId] = useState<string | null>(null)

  useEffect(() => {
    const id = localStorage.getItem('exolex_lawyer_id')
    if (!id) {
      router.push('/auth/lawyer-login')
      return
    }
    setLawyerId(id)
    loadRequest()
  }, [requestId])

  const loadRequest = async () => {
    if (!requestId) return
    setLoading(true)

    try {
      // جلب بدون join - لتجنب مشكلة العلاقات
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      if (error) {
        console.error('Error:', error)
        toast.error('لم يتم العثور على الطلب')
        return
      }

      if (data) {
        setRequest({
          id: data.id,
          ticket_number: data.ticket_number || 'N/A',
          title: data.title || 'طلب خدمة',
          description: data.description || '',
          service_type: data.service_type || '',
          domain: data.domain || '',
          status: data.status || '',
          base_price: data.base_price,
          sla_deadline: data.sla_deadline,
          created_at: data.created_at,
          member_id: data.member_id,
          is_urgent: data.is_urgent || false,
          attachments: data.attachments || []
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!request || !lawyerId) return
    setAccepting(true)

    try {
      const { error } = await supabase
        .from('service_requests')
        .update({
          status: 'assigned',
          assigned_lawyer_id: lawyerId,
          assigned_at: new Date().toISOString()
        })
        .eq('id', request.id)

      if (error) throw error
      toast.success('تم قبول الطلب بنجاح')
      router.push('/legal-arm-lawyer/my-tasks')
    } catch (err) {
      console.error(err)
      toast.error('خطأ في قبول الطلب')
    } finally {
      setAccepting(false)
    }
  }

  const getStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending_assignment: 'بانتظار التعيين',
      pending_quotes: 'بانتظار عروض',
      assigned: 'تم التعيين',
      in_progress: 'قيد التنفيذ',
      completed: 'مكتمل'
    }
    return map[s] || s
  }

  const getDomainLabel = (d: string) => {
    const map: Record<string, string> = {
      labor: 'عمالي', family: 'أسري', commercial: 'تجاري',
      criminal: 'جنائي', real_estate: 'عقاري', insurance: 'تأميني'
    }
    return map[d] || d || 'عام'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">📭</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">لم يتم العثور على الطلب</h3>
        <Link href="/legal-arm-lawyer/requests" className="text-amber-600 hover:underline">
          العودة للطلبات
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-800">{request.title}</h1>
              {request.is_urgent && (
                <span className="px-3 py-1 bg-red-500 text-white rounded-full text-sm font-bold">عاجل</span>
              )}
            </div>
            <p className="text-gray-500">{request.ticket_number}</p>
          </div>
          <span className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
            {getStatusLabel(request.status)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">وصف الطلب</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{request.description || 'لا يوجد وصف'}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">الإجراءات</h2>
            <div className="flex gap-3">
              {request.base_price && request.base_price > 0 ? (
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold disabled:opacity-50"
                >
                  {accepting ? 'جاري القبول...' : `قبول الطلب (${request.base_price.toLocaleString()} ر.س)`}
                </button>
              ) : (
                <Link
                  href={`/legal-arm-lawyer/requests/${request.id}/quote`}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-center"
                >
                  تقديم عرض سعر
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">تفاصيل الخدمة</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">المجال</span>
                <span className="font-medium">{getDomainLabel(request.domain)}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">السعر</span>
                <span className="font-bold text-amber-600">
                  {request.base_price ? `${request.base_price.toLocaleString()} ر.س` : 'يحتاج عرض'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">التاريخ</span>
                <span>{new Date(request.created_at).toLocaleDateString('ar-SA')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Link href="/legal-arm-lawyer/requests" className="inline-block text-gray-600 hover:text-gray-800">
        ← العودة للطلبات
      </Link>
    </div>
  )
}
