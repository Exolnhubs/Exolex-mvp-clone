'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getLawyerId, getLegalArmId } from '@/lib/cookies'
import { logoutLawyer, clearAuthCookies } from '@/lib/auth'
import QuoteFormModal, { QuoteFormData } from '@/components/QuoteFormModal'
import { X, User, Clock, Flag, Send, CheckCircle, Eye, Download, FileText as FileIcon, Coins } from 'lucide-react'
import toast from 'react-hot-toast'
// ═══════════════════════════════════════════════════════════════
// 📌 Layout بوابة محامي الذراع القانوني
// 📅 تاريخ التحديث: 20 يناير 2026
// ═══════════════════════════════════════════════════════════════

const navItems = [
  { href: '/legal-arm-lawyer/dashboard', label: 'الرئيسية', icon: '🏠' },
  { href: '/legal-arm-lawyer/my-tasks', label: 'مهامي', icon: '📋' },
  { href: '/legal-arm-lawyer/package-requests', label: 'طلبات الباقات', icon: '📦' },
  { href: '/legal-arm-lawyer/cases', label: 'القضايا', icon: '⚖️' },
  { href: '/legal-arm-lawyer/ratings', label: 'التقييمات', icon: '⭐' },
  { href: '/legal-arm-lawyer/calendar', label: 'التقويم', icon: '📅' },
  { href: '/legal-arm-lawyer/profile', label: 'ملفي', icon: '👤' },
  { href: '/legal-arm-lawyer/reports', label: 'التقارير', icon: '📊' },
  { href: '/legal-arm-lawyer/communication', label: 'مركز التواصل', icon: '💬' },
  { href: '/legal-arm-lawyer/settings', label: 'الإعدادات', icon: '⚙️' },
]

interface LawyerInfo {
  id: string
  full_name: string
  lawyer_code: string
}

interface LegalArmInfo {
  id: string
  name_ar: string
  logo_url?: string
}

interface PlatformRequest {
  id: string
  ticket_number: string
  title: string
  base_price: number | null
  created_at: string
}

export default function LegalArmLawyerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  
  const [isLoading, setIsLoading] = useState(true)
  const [lawyerInfo, setLawyerInfo] = useState<LawyerInfo | null>(null)
  const [legalArmInfo, setLegalArmInfo] = useState<LegalArmInfo | null>(null)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const [platformRequests, setPlatformRequests] = useState<PlatformRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  
  const isDashboard = pathname === '/legal-arm-lawyer/dashboard' || pathname === '/legal-arm-lawyer'
// Modal states
const [showDetailModal, setShowDetailModal] = useState(false)
const [showQuoteModal, setShowQuoteModal] = useState(false)
const [selectedRequest, setSelectedRequest] = useState<any>(null)
const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    const init = async () => {
      const lawyerId = getLawyerId()
      const legalArmId = getLegalArmId()

      if (!lawyerId || !legalArmId) {
        router.push('/auth/lawyer-login')
        return
      }

      try {
        const { data: lawyer, error: lawyerError } = await supabase
          .from('lawyers')
          .select('id, full_name, lawyer_code, status')
          .eq('id', lawyerId)
          .single()

        if (lawyerError || !lawyer || lawyer.status !== 'active') {
          await clearAuthCookies()
          router.push('/auth/lawyer-login')
          return
        }

        setLawyerInfo({
          id: lawyer.id,
          full_name: lawyer.full_name,
          lawyer_code: lawyer.lawyer_code
        })

        const { data: legalArm } = await supabase
          .from('legal_arms')
          .select('id, name_ar, logo_url')
          .eq('id', legalArmId)
          .single()

        if (legalArm) {
          setLegalArmInfo(legalArm)
        }

        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', lawyerId)
          .eq('is_read', false)

        setUnreadNotifications(count || 0)

      } catch (error) {
        console.error('خطأ:', error)
      } finally {
        setIsLoading(false)
      }
    }

    init()
    fetchPlatformRequests()
    
    const channel = supabase
      .channel('arm-lawyer-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => {
        fetchPlatformRequests()
      })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [router])

  const fetchPlatformRequests = async () => {
    setLoadingRequests(true)
    try {
      // ✅ الخدمات الإضافية فقط (ليست طلبات الباقات)
      const { data, error } = await supabase
        .from('service_requests')
        .select('id, ticket_number, title, base_price, created_at')
        .neq('source', 'package')
        .is('assigned_lawyer_id', null)
        .in('status', ['pending_assignment', 'pending_quotes'])
        .order('created_at', { ascending: false })
        .limit(10)
      
      if (data) {
        setPlatformRequests(data.map(r => ({
          id: r.id,
          ticket_number: r.ticket_number || 'N/A',
          title: r.title || 'طلب خدمة',
          base_price: r.base_price,
          created_at: r.created_at
        })))
      }
    } catch (err) {
      console.error('Error fetching requests:', err)
    } finally {
      setLoadingRequests(false)
    }
  }

  const handleLogout = () => {
    logoutLawyer()
  }

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) return `منذ ${hours} ساعة`
    if (minutes > 0) return `منذ ${minutes} دقيقة`
    return 'الآن'
  }
// فتح Modal التفاصيل
const openDetailModal = (request: any) => {
  setSelectedRequest(request)
  setShowDetailModal(true)
}

// فتح Modal عرض السعر
const openQuoteModal = (request: any) => {
  setSelectedRequest(request)
  setShowDetailModal(false)
  setShowQuoteModal(true)
}

// قبول طلب مسعّر
const handleAcceptRequest = async (request: any) => {
  const lawyerId = getLawyerId()
  if (!lawyerId) return

  if (!confirm('هل أنت متأكد من قبول هذا الطلب؟')) return

  setSubmitting(true)
  try {
    const { error } = await supabase
      .from('service_requests')
      .update({
        assigned_lawyer_id: lawyerId,
        handler_type: 'legal_arm',
        status: 'assigned',
        assigned_at: new Date().toISOString(),
        is_accepted: true
      })
      .eq('id', request.id)

    if (error) throw error

    toast.success('تم قبول الطلب بنجاح!')
    setShowDetailModal(false)
    setSelectedRequest(null)
    fetchPlatformRequests()
  } catch (err) {
    console.error(err)
    toast.error('حدث خطأ أثناء قبول الطلب')
  } finally {
    setSubmitting(false)
  }
}

// تقديم عرض سعر
const handleSubmitQuote = async (data: QuoteFormData) => {
  const lawyerId = getLawyerId()
  if (!lawyerId || !selectedRequest) return

  setSubmitting(true)
  try {
    const { error } = await supabase.from('service_quotes').insert({
      request_id: selectedRequest.id,
      lawyer_id: lawyerId,
      service_description: data.service_description,
      price: data.total_price,
      vat_percent: 15,
      vat_amount: data.vat_amount,
      total_amount: data.total_with_vat,
      platform_fee_percent: 30,
      platform_fee_amount: data.platform_commission,
      lawyer_earnings: data.lawyer_amount,
      installments_count: data.installments?.length || 1,
      status: 'pending',
      valid_until: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    })

    if (error) throw error

    toast.success('تم إرسال عرض السعر بنجاح!')
    setShowQuoteModal(false)
    setSelectedRequest(null)
    fetchPlatformRequests()
  } catch (err: any) {
    console.error(err)
    toast.error('حدث خطأ: ' + err.message)
  } finally {
    setSubmitting(false)
  }
}

// Helper functions للـ Modal
const getPriorityBadge = (priority: string) => {
  const badges: Record<string, { label: string; color: string }> = {
    normal: { label: 'عادي', color: 'bg-gray-100 text-gray-700' },
    urgent: { label: 'عاجل', color: 'bg-orange-100 text-orange-700' },
    emergency: { label: 'طارئ', color: 'bg-red-100 text-red-700' }
  }
  return badges[priority] || badges.normal
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (['pdf'].includes(ext || '')) return { bg: 'bg-red-100', color: 'text-red-600' }
  if (['doc', 'docx'].includes(ext || '')) return { bg: 'bg-blue-100', color: 'text-blue-600' }
  if (['jpg', 'jpeg', 'png'].includes(ext || '')) return { bg: 'bg-green-100', color: 'text-green-600' }
  return { bg: 'bg-gray-100', color: 'text-gray-600' }
}
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100" dir="rtl">
      
      {/* Sidebar الرئيسي - يمين */}
      <aside className="w-[220px] bg-white shadow-lg flex-col fixed right-0 top-0 h-full z-50 hidden lg:flex">
        
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-700 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">⚖️</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-800">ExoLex</h1>
              <p className="text-xs text-gray-600">بوابة المحامي</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-gray-200 bg-emerald-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <span className="text-emerald-700 text-xl">👤</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{lawyerInfo?.full_name}</p>
              <p className="text-xs text-gray-500">{lawyerInfo?.lawyer_code}</p>
              {legalArmInfo && (
                <p className="text-xs text-emerald-600">{legalArmInfo.name_ar}</p>
              )}
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-all w-full"
          >
            <span className="text-lg">🚪</span>
            <span className="text-sm font-semibold">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* شريط الخدمات الإضافية - يسار */}
      {!isDashboard && (
        <aside className="w-72 bg-white border-r border-gray-200 fixed left-0 top-0 h-full z-20 shadow-lg hidden lg:flex lg:flex-col">
          
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">💼</span>
                <h3 className="text-lg font-bold text-gray-900">الخدمات الإضافية</h3>
                {platformRequests.length > 0 && (
                  <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                    {platformRequests.length}
                  </span>
                )}
              </div>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <p className="text-xs text-gray-500">طلبات متاحة للقبول أو تقديم عرض</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {platformRequests.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-gray-500 text-sm">لا توجد خدمات إضافية متاحة</p>
                <button 
                  onClick={fetchPlatformRequests}
                  className="mt-3 text-emerald-600 text-sm hover:underline"
                >
                  تحديث
                </button>
              </div>
            ) : (
              platformRequests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => openDetailModal(req)}
                  className="block bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${req.base_price ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{req.title}</h4>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`font-bold text-sm ${req.base_price ? 'text-emerald-600' : 'text-blue-600'}`}>
                          {req.base_price ? `${req.base_price.toLocaleString()} ر.س` : 'عرض سعر'}
                        </span>
                        <span className="text-xs text-gray-500">{getTimeAgo(req.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🔄</span>
                <span className="text-xs text-gray-600">تحديث تلقائي</span>
              </div>
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <Link 
              href="/legal-arm-lawyer/extra-services" 
              className="text-emerald-600 hover:text-emerald-700 text-sm font-semibold flex items-center gap-1 justify-center"
            >
              عرض الكل ←
            </Link>
          </div>
        </aside>
      )}

      {/* المحتوى الرئيسي */}
      <main className={`flex-1 overflow-y-auto transition-all ${isDashboard ? 'lg:mr-[220px]' : 'lg:mr-[220px] lg:ml-72'}`}>
        
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="px-8 py-4 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              ☰
            </button>
            
            <h2 className="text-2xl font-bold text-gray-800">
              {navItems.find(item => pathname === item.href || pathname?.startsWith(item.href + '/'))?.label || 'لوحة التحكم'}
            </h2>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={fetchPlatformRequests}
                className={`p-2 rounded-lg hover:bg-gray-100 ${loadingRequests ? 'animate-spin' : ''}`}
              >
                🔄
              </button>
              <Link href="/legal-arm-lawyer/communication?tab=notifications" className="relative p-2 rounded-lg hover:bg-gray-100 flex items-center gap-1">
                🔔
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1">{unreadNotifications}</span>
                )}
              </Link>
            </div>
          </div>
        </header>

        <div className="p-8 pb-24 lg:pb-8">
          {children}
        </div>
      </main>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)}></div>
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-xl">
            <div className="p-4 border-b flex justify-between items-center">
              <span className="font-bold">القائمة</span>
              <button onClick={() => setSidebarOpen(false)}>✕</button>
            </div>
            <div className="p-4 border-b bg-emerald-50">
              <p className="font-semibold">{lawyerInfo?.full_name}</p>
              <p className="text-xs text-gray-500">{lawyerInfo?.lawyer_code}</p>
            </div>
            <nav className="p-4 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                    pathname === item.href ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
              <button onClick={handleLogout} className="w-full text-red-600 py-3">تسجيل الخروج</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav للجوال */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40">
        <div className="flex justify-around py-2">
          {navItems.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-2 px-3 ${
                pathname === item.href || pathname?.startsWith(item.href + '/') ? 'text-emerald-600' : 'text-gray-500'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px]">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
      {/* Modal تفاصيل الطلب */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-[520px] max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-b from-emerald-50 to-white rounded-t-xl px-6 py-5 border-b border-gray-200">
              <div className="flex items-start justify-between mb-3">
                <span className="inline-block px-3 py-1 bg-emerald-600 text-white text-sm font-semibold rounded-lg">{selectedRequest.ticket_number}</span>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">تفاصيل الطلب</h2>
            </div>
            <div className="overflow-y-auto px-6 py-5 flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-5">{selectedRequest.title || 'طلب خدمة'}</h3>
              <div className="bg-gray-50 rounded-lg p-4 mb-5 space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-emerald-600" />
                  <span className="text-gray-600 text-sm">كود المرسل:</span>
                  <span className="text-gray-900 font-semibold font-mono">USR-{selectedRequest.member_id?.slice(0,8) || '****'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Coins className="w-5 h-5 text-emerald-600" />
                  <span className="text-gray-600 text-sm">السعر:</span>
                  {selectedRequest.base_price && selectedRequest.base_price > 0 ? (
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-lg">{selectedRequest.base_price.toLocaleString()} ر.س</span>
                  ) : (
                    <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-bold rounded-lg">يحتاج عرض سعر</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-emerald-600" />
                  <span className="text-gray-600 text-sm">تاريخ الطلب:</span>
                  <span className="text-gray-900 font-semibold">{getTimeAgo(selectedRequest.created_at)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Flag className="w-5 h-5 text-emerald-600" />
                  <span className="text-gray-600 text-sm">الأولوية:</span>
                  <span className={`inline-block px-3 py-1 text-sm font-bold rounded-lg ${getPriorityBadge(selectedRequest.priority).color}`}>{getPriorityBadge(selectedRequest.priority).label}</span>
                </div>
              </div>
              <div className="mb-5">
                <h4 className="text-base font-bold text-gray-800 mb-3">📝 وصف الطلب</h4>
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <p className="text-gray-700 leading-relaxed">{selectedRequest.description || selectedRequest.title || 'لا يوجد وصف'}</p>
                </div>
              </div>
              <div className="mb-5">
                <h4 className="text-base font-bold text-gray-800 mb-3">📎 المرفقات</h4>
                {selectedRequest.attachments && selectedRequest.attachments.length > 0 ? (
                  <div className="space-y-2">
                    {selectedRequest.attachments.map((file: any, index: number) => {
                      const fileStyle = getFileIcon(file.name || file)
                      return (
                        <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white hover:bg-emerald-50 cursor-pointer group">
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`w-10 h-10 ${fileStyle.bg} rounded-lg flex items-center justify-center`}>
                              <FileIcon className={`w-5 h-5 ${fileStyle.color}`} />
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{file.name || file}</p>
                          </div>
                          <Download className="w-5 h-5 text-emerald-600 opacity-0 group-hover:opacity-100" />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-lg text-gray-500">لا توجد مرفقات</div>
                )}
              </div>
            </div>
            <div className="bg-gray-50 rounded-b-xl px-6 py-4 border-t border-gray-200">
              <div className="flex gap-3">
                {selectedRequest.base_price && selectedRequest.base_price > 0 ? (
                  <button onClick={() => handleAcceptRequest(selectedRequest)} disabled={submitting} className="flex-1 bg-emerald-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50">
                    {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><CheckCircle className="w-5 h-5" />قبول الطلب</>}
                  </button>
                ) : (
                  <button onClick={() => openQuoteModal(selectedRequest)} className="flex-1 bg-amber-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-amber-600 flex items-center justify-center gap-2">
                    <Send className="w-5 h-5" />تقديم عرض
                  </button>
                )}
                <button onClick={() => setShowDetailModal(false)} className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-50">إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal عرض السعر */}
      <QuoteFormModal
        isOpen={showQuoteModal}
        onClose={() => { setShowQuoteModal(false); setSelectedRequest(null) }}
        onSubmit={handleSubmitQuote}
        request={selectedRequest}
        submitting={submitting}
      />
    </div>
  )
}