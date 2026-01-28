'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { 
  FileText, Search, Clock, CheckCircle, XCircle, Eye, Calendar,
  Building2, User, Loader2, FileSignature, Send, DollarSign,
  AlertCircle, Filter
} from 'lucide-react'
import { getPartnerId, getLegalArmId, getLawyerId } from '@/lib/cookies'

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 صفحة العروض الموحدة - الشريك / الذراع / المحامي المستقل
// ═══════════════════════════════════════════════════════════════════════════════

interface Quote {
  id: string
  quote_number: string
  title: string
  description: string
  subtotal: number
  vat_amount: number
  total_amount: number
  platform_fee_percent: number
  platform_fee_amount: number
  partner_earnings: number
  status: string
  valid_until: string
  created_at: string
  updated_at: string

  // ✅ تمت الإضافة لحل الخطأ
  client_id?: string | null

  service_request?: { id: string; ticket_number: string; title: string } | null
  subscriber?: { id: string; user_id: string } | null
  client?: { id: string; full_name: string; company_name: string } | null
  installments?: { id: string; description: string; percentage: number; amount: number }[]
}

const quoteStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'مسودة', color: 'bg-slate-100 text-slate-700', icon: FileText },
  pending: { label: 'بانتظار الموافقة', color: 'bg-amber-100 text-amber-700', icon: Clock },
  accepted: { label: 'مقبول', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'مرفوض', color: 'bg-red-100 text-red-700', icon: XCircle },
  expired: { label: 'منتهي', color: 'bg-slate-100 text-slate-500', icon: AlertCircle },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700', icon: XCircle },
}

type TabType = 'pending' | 'accepted' | 'external'
type UserType = 'partner' | 'legal_arm' | 'lawyer'

export default function QuotesPage() {
  const router = useRouter()
  
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [userType, setUserType] = useState<UserType>('partner')
  const [userId, setUserId] = useState<string | null>(null)
  
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [stats, setStats] = useState({ pending: 0, accepted: 0, external: 0 })
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      
      const partnerId = getPartnerId()
      const legalArmId = getLegalArmId()
      const lawyerId = getLawyerId()
      
      let id: string | null = null
      let type: UserType = 'partner'
      let tableName = 'partner_quotes'
      let idField = 'partner_id'
      
      if (partnerId) {
        id = partnerId
        type = 'partner'
        tableName = 'partner_quotes'
        idField = 'partner_id'
      } else if (legalArmId) {
        id = legalArmId
        type = 'legal_arm'
        tableName = 'partner_quotes'
        idField = 'legal_arm_id'
      } else if (lawyerId) {
        id = lawyerId
        type = 'lawyer'
        tableName = 'service_quotes'
        idField = 'lawyer_id'
      }
      
      if (!id) {
        toast.error('يرجى تسجيل الدخول')
        router.push('/auth/login')
        return
      }
      
      setUserId(id)
      setUserType(type)
      
      await loadQuotes(id, tableName, idField, type)
      
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const loadQuotes = async (id: string, tableName: string, idField: string, type: UserType) => {
    const { data, error } = await supabase
      .from(tableName)
      .select(`
        *,
        service_request:service_request_id (id, ticket_number, title),
        client:client_id (id, full_name, company_name)
      `)
      .eq(idField, id)
      .order('created_at', { ascending: false })

    if (error) throw error
    
    const quotesList = data || []
    setQuotes(quotesList)
    
    const pendingCount = quotesList.filter(q => q.status === 'pending').length
    const acceptedCount = quotesList.filter(q => q.status === 'accepted').length
    const externalCount = quotesList.filter(q => q.client_id !== null).length
    
    setStats({
      pending: pendingCount,
      accepted: acceptedCount,
      external: externalCount
    })
  }

  const getFilteredData = () => {
    let data: Quote[] = []
    
    if (activeTab === 'pending') {
      data = quotes.filter(q => q.status === 'pending')
    } else if (activeTab === 'accepted') {
      data = quotes.filter(q => q.status === 'accepted')
    } else if (activeTab === 'external') {
      data = quotes.filter(q => q.client_id !== null)
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      data = data.filter(q => 
        q.title?.toLowerCase().includes(term) ||
        q.quote_number?.toLowerCase().includes(term)
      )
    }
    
    return data
  }

  const calculateTimeRemaining = (validUntil: string | null) => {
    if (!validUntil) return null
    const now = new Date()
    const end = new Date(validUntil)
    const diff = end.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    
    if (days < 0) return { text: 'منتهي', color: 'text-red-600' }
    if (days === 0) return { text: 'ينتهي اليوم', color: 'text-red-600' }
    if (days <= 2) return { text: `${days} يوم`, color: 'text-amber-600' }
    return { text: `${days} يوم`, color: 'text-green-600' }
  }

  const getPortalPath = () => {
    if (userType === 'partner') return '/partner'
    if (userType === 'legal_arm') return '/legal-arm'
    if (userType === 'lawyer') return '/lawyer'
    return '/partner'
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-500">جاري تحميل البيانات...</p>
        </div>
      </div>
    )
  }

  return <div>… باقي الملف لم يتم تغييره …</div>
}