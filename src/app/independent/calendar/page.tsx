'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import UnifiedCalendar from '@/components/calendar/UnifiedCalendar'
import { getLawyerId } from '@/lib/cookies'

export default function IndependentCalendarPage() {
  const [lawyerId, setLawyerId] = useState<string | null>(null)
  const [lawyerName, setLawyerName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = getLawyerId()
    if (id) {
      setLawyerId(id)
      loadLawyerInfo(id)
    } else {
      setLoading(false)
    }
  }, [])

  const loadLawyerInfo = async (id: string) => {
    const { data } = await supabase
      .from('lawyers')
      .select('full_name')
      .eq('id', id)
      .single()
    
    if (data) setLawyerName(data.full_name)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!lawyerId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">يرجى تسجيل الدخول</p>
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
