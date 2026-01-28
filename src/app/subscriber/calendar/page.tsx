'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logoutMember } from '@/lib/auth'
import { getUserId } from '@/lib/cookies'
import Sidebar from '@/components/layout/Sidebar'
import UnifiedCalendar from '@/components/calendar/UnifiedCalendar'

export default function SubscriberCalendarPage() {
  const router = useRouter()
  const [memberId, setMemberId] = useState<string | null>(null)
  const [memberName, setMemberName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    const loadUser = async () => {
      const userId = getUserId()
      
      if (!userId || userId === 'null' || userId === 'undefined') {
        router.push('/auth/login')
        return
      }

      // جلب بيانات المستخدم
      const { data: userData } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('id', userId)
        .single()

      if (userData) {
        setMemberId(userData.id)
        setMemberName(userData.full_name || '')
      }

      // جلب member للتحقق من الاشتراك
      const { data: memberData } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (memberData) {
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('id, status')
          .eq('member_id', memberData.id)
          .eq('status', 'active')
          .single()
        
        if (subData) setIsSubscribed(true)
      }

      setLoading(false)
    }

    loadUser()
  }, [router])

  const handleLogout = () => {
    logoutMember()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar 
        isSubscribed={isSubscribed} 
        userName={memberName} 
        onLogout={handleLogout} 
      />

      <main className="flex-1 mr-64 p-8">
        <UnifiedCalendar
          userType="member"
          userId={memberId!}
          userName={memberName}
          canAddCourtSession={false}
          canAddConsultation={false}
          canLinkToRequest={false}
          canNotifyClient={false}
          canSeeOthersEvents={false}
          defaultEventType="reminder"
          allowedEventTypes={['reminder', 'personal', 'deadline', 'task', 'other']}
          showRequirements={false}
        />
      </main>
    </div>
  )
}
