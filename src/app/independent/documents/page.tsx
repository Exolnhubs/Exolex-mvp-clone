'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DocumentsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [documents, setDocuments] = useState<any[]>([])

  useEffect(() => {
    const lawyerId = localStorage.getItem('exolex_lawyer_id')
    if (!lawyerId) { router.push('/auth/lawyer-login'); return }
    
    supabase.from('lawyers').select('user_id').eq('id', lawyerId).single()
      .then(({ data: lawyer }) => {
        if (lawyer?.user_id) {
          supabase.from('user_personal_documents').select('*').eq('user_id', lawyer.user_id).order('created_at', { ascending: false })
            .then(({ data }) => setDocuments(data || []))
        }
      })
      .finally(() => setIsLoading(false))
  }, [router])

  if (isLoading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div className="min-h-screen bg-slate-100 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-slate-800">📁 المستندات</h1>
          <p className="text-slate-500 mt-1">إدارة المستندات الشخصية</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <span className="text-6xl block mb-4">📁</span>
          <h3 className="text-xl font-bold text-slate-700">{documents.length > 0 ? `${documents.length} مستند` : 'لا توجد مستندات'}</h3>
        </div>
      </div>
    </div>
  )
}
