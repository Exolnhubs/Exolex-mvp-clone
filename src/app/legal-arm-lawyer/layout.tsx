'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════
// 📌 Layout بوابة محامي الذراع القانوني
// 📅 تاريخ التحديث: 12 يناير 2026 - إصلاح avatar_url
// ═══════════════════════════════════════════════════════════════

const navItems = [
  { href: '/legal-arm-lawyer/dashboard', label: 'الرئيسية', icon: '🏠' },
  { href: '/legal-arm-lawyer/my-tasks', label: 'مهامي', icon: '📋' },
  { href: '/legal-arm-lawyer/requests', label: 'الطلبات', icon: '📨' },
  { href: '/legal-arm-lawyer/my-quotes', label: 'عروضي', icon: '💰' },
  { href: '/legal-arm-lawyer/cases', label: 'القضايا', icon: '⚖️' },
  { href: '/legal-arm-lawyer/calendar', label: 'التقويم', icon: '📅' },
  { href: '/legal-arm-lawyer/profile', label: 'ملفي', icon: '👤' },
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

  useEffect(() => {
    const init = async () => {
      const lawyerId = localStorage.getItem('exolex_lawyer_id')
      const legalArmId = localStorage.getItem('exolex_legal_arm_id')

      if (!lawyerId || !legalArmId) {
        router.push('/auth/lawyer-login')
        return
      }

      try {
        // ✅ إزالة avatar_url من الاستعلام
        const { data: lawyer, error: lawyerError } = await supabase
          .from('lawyers')
          .select('id, full_name, lawyer_code, status')
          .eq('id', lawyerId)
          .single()

        console.log('Lawyer data:', lawyer, lawyerError)

        if (lawyerError || !lawyer || lawyer.status !== 'active') {
          console.error('Lawyer error:', lawyerError)
          localStorage.clear()
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
      const { data, error } = await supabase
        .from('service_requests')
        .select('id, ticket_number, title, base_price, created_at')
        .in('status', ['pending_assignment', 'pending_quotes', 'assigned_to_arm'])
        .order('created_at', { ascending: false })
        .limit(10)
      
      console.log('Platform Requests:', data, error)
      
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
    localStorage.removeItem('exolex_lawyer_id')
    localStorage.removeItem('exolex_lawyer_code')
    localStorage.removeItem('exolex_legal_arm_id')
    router.push('/auth/lawyer-login')
  }

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) return `منذ ${hours} ساعة`
    if (minutes > 0) return `منذ ${minutes} دقيقة`
    return 'الآن'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100" dir="rtl">
      
      {/* Sidebar الرئيسي - يمين */}
      <aside className="w-[200px] bg-white shadow-lg flex-col fixed right-0 top-0 h-full z-50 hidden lg:flex">
        
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-amber-700 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">⚖️</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-800">ExoLex</h1>
              <p className="text-xs text-gray-600">بوابة المحامي</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <span className="text-amber-700 text-xl">👤</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">مرحباً، {lawyerInfo?.full_name}</p>
              <p className="text-xs text-gray-500">{lawyerInfo?.lawyer_code}</p>
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
                        ? 'bg-amber-600 text-white font-semibold'
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

      {/* شريط طلبات المنصة - يسار */}
      {!isDashboard && (
        <aside className="w-72 bg-white border-r border-gray-200 fixed left-0 top-0 h-full z-20 shadow-lg hidden lg:flex lg:flex-col">
          
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <h3 className="text-lg font-bold text-gray-900">طلبات المنصة</h3>
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                  {platformRequests.length}
                </span>
              </div>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <p className="text-xs text-gray-500">طلبات جديدة من العملاء</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {platformRequests.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-gray-500 text-sm">لا توجد طلبات جديدة</p>
                <button 
                  onClick={fetchPlatformRequests}
                  className="mt-3 text-amber-600 text-sm hover:underline"
                >
                  تحديث
                </button>
              </div>
            ) : (
              platformRequests.map((req) => (
                <Link
                  key={req.id}
                  href={`/legal-arm-lawyer/requests/${req.id}`}
                  className="block bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md hover:border-amber-300 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${req.base_price ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{req.title}</h4>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`font-bold text-sm ${req.base_price ? 'text-amber-600' : 'text-blue-600'}`}>
                          {req.base_price ? `${req.base_price.toLocaleString()} ر.س` : 'عرض سعر'}
                        </span>
                        <span className="text-xs text-gray-500">{getTimeAgo(req.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🔄</span>
                <span className="text-xs text-gray-600">يتحدث تلقائياً</span>
              </div>
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <Link 
              href="/legal-arm-lawyer/requests" 
              className="text-amber-600 hover:text-amber-700 text-sm font-semibold flex items-center gap-1 justify-center"
            >
              عرض الكل ←
            </Link>
          </div>
        </aside>
      )}

      {/* المحتوى الرئيسي */}
      <main className={`flex-1 overflow-y-auto transition-all ${isDashboard ? 'lg:mr-[200px]' : 'lg:mr-[200px] lg:ml-72'}`}>
        
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
              <Link href="/legal-arm-lawyer/notifications" className="relative p-2 rounded-lg hover:bg-gray-100">
                🔔
                {unreadNotifications > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
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
            <div className="p-4 border-b bg-gray-50">
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
                    pathname === item.href ? 'bg-amber-600 text-white' : 'text-gray-700 hover:bg-gray-100'
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
                pathname === item.href || pathname?.startsWith(item.href + '/') ? 'text-amber-600' : 'text-gray-500'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px]">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
