'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getLawyerId, getLegalArmId, getPartnerId } from '@/lib/cookies'
import { 
  FileSignature, Search, Clock, CheckCircle, XCircle, Eye, Plus,
  Calendar, Loader2, FileText, User, Send, Edit, Copy, Download, AlertCircle
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 صفحة العقود الموحدة - الشريك / الذراع / المحامي المستقل
// ═══════════════════════════════════════════════════════════════════════════════

interface Contract {
  id: string
  contract_number: string
  title: string
  contract_type: string
  contract_value: number
  status: string
  start_date: string
  end_date: string
  created_at: string
  first_party_info: { name?: string } | null
  second_party_info: { name?: string } | null
  is_template: boolean
  template_name: string | null
  client_signed: boolean
  quote_id: string | null
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'مسودة', color: 'bg-slate-100 text-slate-700', icon: FileText },
  pending_review: { label: 'قيد المراجعة', color: 'bg-amber-100 text-amber-700', icon: Clock },
  pending_approval: { label: 'بانتظار التوقيع', color: 'bg-blue-100 text-blue-700', icon: Send },
  active: { label: 'نشط', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  completed: { label: 'مكتمل', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  expired: { label: 'منتهي', color: 'bg-slate-100 text-slate-500', icon: AlertCircle },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700', icon: XCircle },
  rejected: { label: 'مرفوض', color: 'bg-red-100 text-red-700', icon: XCircle },
}

type TabType = 'active' | 'pending_approval' | 'pending_review' | 'draft' | 'completed' | 'templates'
type UserType = 'partner' | 'legal_arm' | 'lawyer'

export default function ContractsPage() {
  const router = useRouter()
  
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const [userType, setUserType] = useState<UserType>('partner')
  const [userId, setUserId] = useState<string | null>(null)
  
  const [contracts, setContracts] = useState<Contract[]>([])
  const [templates, setTemplates] = useState<Contract[]>([])
  const [stats, setStats] = useState({ active: 0, pending_approval: 0, pending_review: 0, draft: 0, completed: 0, templates: 0 })
  
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const partnerId = getPartnerId()
      const legalArmId = getLegalArmId()
      const lawyerId = getLawyerId()
      
      let id: string | null = null
      let type: UserType = 'partner'
      
      if (partnerId) { id = partnerId; type = 'partner' }
      else if (legalArmId) { id = legalArmId; type = 'legal_arm' }
      else if (lawyerId) { id = lawyerId; type = 'lawyer' }
      
      if (!id) { toast.error('يرجى تسجيل الدخول'); router.push('/auth/login'); return }
      
      setUserId(id)
      setUserType(type)
      await loadContracts(id, type)
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally { setIsLoading(false) }
  }

  const getTableName = (type: UserType) => {
    if (type === 'partner') return 'partner_contracts'
    if (type === 'legal_arm') return 'legal_arm_contracts'
    return 'lawyer_contracts'
  }

  const getIdField = (type: UserType) => {
    if (type === 'partner') return 'partner_id'
    if (type === 'legal_arm') return 'legal_arm_id'
    return 'lawyer_id'
  }

  const loadContracts = async (id: string, type: UserType) => {
    const tableName = getTableName(type)
    const idField = getIdField(type)
    
    const { data: contractsData } = await supabase.from(tableName).select('*').eq(idField, id).eq('is_template', false).order('created_at', { ascending: false })
    const { data: templatesData } = await supabase.from(tableName).select('*').eq(idField, id).eq('is_template', true).order('created_at', { ascending: false })
    
    const contractsList = contractsData || []
    const templatesList = templatesData || []
    
    setContracts(contractsList)
    setTemplates(templatesList)
    
    setStats({
      active: contractsList.filter(c => c.status === 'active').length,
      pending_approval: contractsList.filter(c => c.status === 'pending_approval').length,
      pending_review: contractsList.filter(c => c.status === 'pending_review').length,
      draft: contractsList.filter(c => c.status === 'draft').length,
      completed: contractsList.filter(c => ['completed', 'expired', 'cancelled'].includes(c.status)).length,
      templates: templatesList.length
    })
  }

  const getFilteredData = (): Contract[] => {
    let data: Contract[] = []
    if (activeTab === 'templates') data = templates
    else if (activeTab === 'active') data = contracts.filter(c => c.status === 'active')
    else if (activeTab === 'pending_approval') data = contracts.filter(c => c.status === 'pending_approval')
    else if (activeTab === 'pending_review') data = contracts.filter(c => c.status === 'pending_review')
    else if (activeTab === 'draft') data = contracts.filter(c => c.status === 'draft')
    else if (activeTab === 'completed') data = contracts.filter(c => ['completed', 'expired', 'cancelled'].includes(c.status))
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      data = data.filter(c => c.title?.toLowerCase().includes(term) || c.contract_number?.toLowerCase().includes(term))
    }
    return data
  }

  const getPortalPath = () => {
    if (userType === 'partner') return '/partner'
    if (userType === 'legal_arm') return '/legal-arm'
    return '/independent'
  }

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null
    const diff = new Date(endDate).getTime() - new Date().getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days < 0) return { text: 'منتهي', color: 'text-red-600' }
    if (days <= 7) return { text: `${days} يوم`, color: 'text-red-600' }
    if (days <= 30) return { text: `${days} يوم`, color: 'text-amber-600' }
    return { text: `${days} يوم`, color: 'text-green-600' }
  }

  const showReviewTab = userType === 'partner' || userType === 'legal_arm'

  if (isLoading) {
    return (<div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-blue-600" /></div>)
  }

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <FileSignature className="w-8 h-8 text-blue-600" />
            العقود
          </h1>
          <p className="text-slate-500 mt-1">إدارة العقود والاتفاقيات</p>
        </div>
        <button onClick={() => router.push(`${getPortalPath()}/contracts/new`)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-5 h-5" />
          عقد جديد
        </button>
      </div>

      {/* البطاقات الإحصائية */}
      <div className={`grid gap-4 ${showReviewTab ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'}`}>
        <div onClick={() => setActiveTab('active')} className={`bg-white rounded-xl p-4 border shadow-sm cursor-pointer transition-all ${activeTab === 'active' ? 'border-green-500 ring-2 ring-green-100' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <div><div className="text-xl font-bold">{stats.active}</div><div className="text-xs text-slate-500">نشطة</div></div>
          </div>
        </div>
        <div onClick={() => setActiveTab('pending_approval')} className={`bg-white rounded-xl p-4 border shadow-sm cursor-pointer transition-all ${activeTab === 'pending_approval' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Send className="w-5 h-5 text-blue-600" /></div>
            <div><div className="text-xl font-bold">{stats.pending_approval}</div><div className="text-xs text-slate-500">بانتظار التوقيع</div></div>
          </div>
        </div>
        {showReviewTab && (
          <div onClick={() => setActiveTab('pending_review')} className={`bg-white rounded-xl p-4 border shadow-sm cursor-pointer transition-all ${activeTab === 'pending_review' ? 'border-amber-500 ring-2 ring-amber-100' : 'border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div>
              <div><div className="text-xl font-bold">{stats.pending_review}</div><div className="text-xs text-slate-500">قيد المراجعة</div></div>
            </div>
          </div>
        )}
        <div onClick={() => setActiveTab('draft')} className={`bg-white rounded-xl p-4 border shadow-sm cursor-pointer transition-all ${activeTab === 'draft' ? 'border-slate-500 ring-2 ring-slate-100' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center"><FileText className="w-5 h-5 text-slate-600" /></div>
            <div><div className="text-xl font-bold">{stats.draft}</div><div className="text-xs text-slate-500">مسودات</div></div>
          </div>
        </div>
        <div onClick={() => setActiveTab('completed')} className={`bg-white rounded-xl p-4 border shadow-sm cursor-pointer transition-all ${activeTab === 'completed' ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-emerald-600" /></div>
            <div><div className="text-xl font-bold">{stats.completed}</div><div className="text-xs text-slate-500">منتهية</div></div>
          </div>
        </div>
        <div onClick={() => setActiveTab('templates')} className={`bg-white rounded-xl p-4 border shadow-sm cursor-pointer transition-all ${activeTab === 'templates' ? 'border-purple-500 ring-2 ring-purple-100' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Copy className="w-5 h-5 text-purple-600" /></div>
            <div><div className="text-xl font-bold">{stats.templates}</div><div className="text-xs text-slate-500">نماذج</div></div>
          </div>
        </div>
      </div>

      {/* المحتوى */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" placeholder="بحث..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pr-10 pl-4 py-2 border border-slate-200 rounded-lg" />
          </div>
        </div>

        <div className="overflow-x-auto">
          {getFilteredData().length === 0 ? (
            <div className="text-center py-12">
              <FileSignature className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">لا توجد عقود</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">رقم العقد</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">العنوان</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الطرف الأول</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الطرف الثاني</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">المبلغ</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الحالة</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">المتبقي</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {getFilteredData().map((contract) => {
                  const status = statusConfig[contract.status] || statusConfig.draft
                  const days = getDaysRemaining(contract.end_date)
                  return (
                    <tr key={contract.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-sm">{contract.contract_number || '-'}</td>
                      <td className="px-4 py-3 font-medium">{contract.title}</td>
                      <td className="px-4 py-3 text-sm">{contract.first_party_info?.name || '-'}</td>
                      <td className="px-4 py-3 text-sm">{contract.second_party_info?.name || '-'}</td>
                      <td className="px-4 py-3 font-medium">{contract.contract_value?.toLocaleString('ar-SA') || 0} ر.س</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${status.color}`}>{status.label}</span></td>
                      <td className="px-4 py-3">{days ? <span className={days.color}>{days.text}</span> : '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => router.push(`${getPortalPath()}/contracts/${contract.id}`)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-4 h-4" /></button>
                          {contract.status === 'draft' && <button onClick={() => router.push(`${getPortalPath()}/contracts/${contract.id}/edit`)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg"><Edit className="w-4 h-4" /></button>}
                          {contract.is_template && <button onClick={() => router.push(`${getPortalPath()}/contracts/new?template=${contract.id}`)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"><Copy className="w-4 h-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
