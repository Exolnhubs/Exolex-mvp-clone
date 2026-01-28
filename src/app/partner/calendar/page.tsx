'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import UnifiedCalendar, { LawyerOption } from '@/components/calendar/UnifiedCalendar'
import { getPartnerId } from '@/lib/cookies'

export default function PartnerCalendarPage() {
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [partnerName, setPartnerName] = useState<string>('')
  const [myLawyers, setMyLawyers] = useState<LawyerOption[]>([])
  const [lawyerIds, setLawyerIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = getPartnerId()
    if (id) {
      setPartnerId(id)
      loadPartnerInfo(id)
      loadMyLawyers(id)
    } else {
      setLoading(false)
    }
  }, [])

  const loadPartnerInfo = async (id: string) => {
    const { data } = await supabase
      .from('legal_partners')
      .select('company_name')
      .eq('id', id)
      .single()
    
    if (data) setPartnerName(data.company_name)
  }

  const loadMyLawyers = async (id: string) => {
    const { data } = await supabase
      .from('lawyers')
      .select('id, full_name, lawyer_code')
      .eq('partner_id', id)
      .eq('is_active', true)
    
    if (data) {
      setMyLawyers(data)
      setLawyerIds(data.map(l => l.id))
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!partnerId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">يرجى تسجيل الدخول</p>
      </div>
    )
  }

  return (
    <UnifiedCalendar
      userType="partner"
      userId={partnerId}
      userName={partnerName}
      canAddCourtSession={false}
      canAddConsultation={false}
      canLinkToRequest={false}
      canNotifyClient={false}
      canSeeOthersEvents={true}
      canEditOthersEvents={false}
      managedLawyerIds={lawyerIds}
      managedLawyers={myLawyers}
      defaultEventType="internal_meeting"
      showRequirements={true}
    />
  )
}
