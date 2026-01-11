'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import RequestsMarketplace from '@/components/RequestsMarketplace'

export default function IndependentRequestsPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: lawyer } = await supabase
          .from('lawyers')
          .select('id')
          .eq('user_id', user.id)
          .single()
        if (lawyer) {
          setUserId(lawyer.id)
        } else {
          setUserId(user.id)
        }
      }
      setLoading(false)
    }
    getUser()
  }, [])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
  if (!userId) return <div className="p-8 text-center text-red-600">الرجاء تسجيل الدخول</div>

  return (
    <div className="p-6">
      <RequestsMarketplace
        userType="independent"
        userId={userId}
        detailsPath="/independent/requests"
        locale="ar"
      />
    </div>
  )
}
