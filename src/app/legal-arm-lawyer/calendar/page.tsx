'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import UnifiedCalendar from '@/components/calendar/UnifiedCalendar'

// ═══════════════════════════════════════════════════════════════
// 📅 صفحة التقويم - محامي الذراع القانوني
// 📅 تاريخ: 21 يناير 2026
// 📝 يستخدم UnifiedCalendar الموحد
// ═══════════════════════════════════════════════════════════════

export default function ArmLawyerCalendarPage() {
  const router = useRouter()
  const [lawyerId, setLawyerId] = useState<string | null>(null)
  const [lawyerName, setLawyerName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = localStorage.getItem('exolex_lawyer_id')
    if (id) {
      setLawyerId(id)
      loadLawyerInfo(id)
    } else {
      router.push('/auth/lawyer-login')
    }
  }, [router])

  const loadLawyerInfo = async (id: string) => {
    try {
      const { data } = await supabase
        .from('lawyers')
        .select('full_name, lawyer_type')
        .eq('id', id)
        .single()
      
      if (data) {
        setLawyerName(data.full_name)
      }
    } catch (error) {
      console.error('Error loading lawyer info:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري تحميل التقويم...</p>
        </div>
      </div>
    )
  }

  if (!lawyerId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 text-lg">يرجى تسجيل الدخول</p>
          <button 
            onClick={() => router.push('/auth/lawyer-login')}
            className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            تسجيل الدخول
          </button>
        </div>
      </div>
    )
  }

  return (
    <UnifiedCalendar
      userType="lawyer"
      userId={lawyerId}
      userName={lawyerName}
      canAddCourtSession={true}
      canAddConsultation={true}
      canLinkToRequest={true}
      canNotifyClient={true}
      canSeeOthersEvents={false}
      defaultEventType="client_meeting"
      showRequirements={true}
    />
  )
}
