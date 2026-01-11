'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Clock, CheckCircle, Send, RefreshCw } from 'lucide-react'

const menuItems = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: '🏠', href: '/independent' },
  { id: 'my-tasks', label: 'مهامي', icon: '📋', href: '/independent/my-tasks' },
  { id: 'cases', label: 'القضايا', icon: '⚖️', href: '/independent/cases' },
  { id: 'contracts', label: 'العقود', icon: '📝', href: '/independent/contracts' },
  { id: 'services', label: 'الخدمات', icon: '🔧', href: '/independent/services' },
  { id: 'calendar', label: 'التقويم', icon: '📅', href: '/independent/calendar' },
  { id: 'documents', label: 'المستندات', icon: '📁', href: '/independent/documents' },
  { id: 'earnings', label: 'الأرباح', icon: '💰', href: '/independent/earnings' },
  { id: 'ratings', label: 'التقييمات', icon: '⭐', href: '/independent/ratings' },
  { id: 'reports', label: 'التقارير', icon: '📈', href: '/independent/reports' },
  { id: 'divider1', label: '', icon: '', href: '' },
  { id: 'communication', label: 'مركز التواصل', icon: '📞', href: '/independent/communication' },
  { id: 'profile', label: 'الملف الشخصي', icon: '👤', href: '/independent/profile' },
  { id: 'settings', label: 'الإعدادات', icon: '⚙️', href: '/independent/settings' },
  { id: 'notifications', label: 'الإشعارات', icon: '🔔', href: '/independent/notifications' },
]

interface AvailableRequest {
  id: string
  ticket_number: string
  title: string
  base_price: number | null
  created_at: string
}

export default function IndependentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isDashboard = pathname === '/independent'
  
  const [lawyerName, setLawyerName] = useState('المحامي')
  const [availableRequests, setAvailableRequests] = useState<AvailableRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [notificationCount] = useState(5)

  useEffect(() => {
    const name = localStorage.getItem('exolex_lawyer_name')
    if (name) setLawyerName(name)
    fetchAvailableRequests()
    
    const channel = supabase
      .channel('independent-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => {
        fetchAvailableRequests()
      })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchAvailableRequests = async () => {
    setLoadingRequests(true)
    const { data } = await supabase
      .from('service_requests')
      .select('id, ticket_number, title, base_price, created_at')
      .eq('request_type', 'extra_service')
      .in('status', ['pending_assignment', 'pending_quotes'])
      .is('assigned_lawyer_id', null)
      .order('created_at', { ascending: false })
      .limit(10)
    setAvailableRequests(data || [])
    setLoadingRequests(false)
  }

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) return `منذ ${hours} س`
    return `منذ ${minutes} د`
  }

  return (
    <div className="flex h-screen" dir="rtl">
      
      {/* القائمة الرئيسية */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col h-full overflow-y-auto flex-shrink-0">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚖️</span>
            <div>
              <h1 className="text-2xl font-bold text-amber-500">ExoLex</h1>
              <p className="text-xs text-gray-400">بوابة المحامي المستقل</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full border-2 border-amber-500 bg-slate-700 flex items-center justify-center text-xl">👨‍⚖️</div>
            <div>
              <h3 className="font-semibold text-sm">{lawyerName}</h3>
              <p className="text-xs text-gray-400">محامي مستقل</p>
            </div>
          </div>
          <div className="flex items-center justify-between bg-slate-800 rounded-lg p-2">
            <span className="text-xs text-gray-300">الحالة:</span>
            <span className="flex items-center gap-2 bg-green-600 px-3 py-1 rounded-md text-xs">
              <span className="w-2 h-2 bg-white rounded-full"></span>متاح
            </span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              if (item.id.startsWith('divider')) return <li key={item.id} className="my-3 border-t border-slate-700"></li>
              const isActive = pathname === item.href || (item.href !== '/independent' && pathname?.startsWith(item.href))
              return (
                <li key={item.id}>
                  <Link href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition relative ${isActive ? 'bg-amber-500 text-slate-900 font-semibold' : 'hover:bg-slate-800 text-gray-300 hover:text-white'}`}>
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm">{item.label}</span>
                    {item.id === 'notifications' && notificationCount > 0 && (
                      <span className="absolute left-3 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">{notificationCount}</span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button className="w-full py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition">🚪 تسجيل الخروج</button>
        </div>
      </aside>

      {/* المحتوى الرئيسي */}
      <main className="flex-1 overflow-y-auto bg-gray-100">
        {children}
      </main>

      {/* شريط الطلبات - يظهر في كل الصفحات ما عدا لوحة التحكم */}
      {!isDashboard && (
        <aside className="w-80 bg-white border-r border-gray-200 h-full overflow-y-auto flex-shrink-0 shadow-lg">
          <div className="p-4 border-b border-gray-200 bg-gradient-to-l from-amber-50 to-white sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📨</span>
                <h3 className="font-bold text-slate-900">الطلبات المتاحة</h3>
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{availableRequests.length}</span>
              </div>
              <button onClick={fetchAvailableRequests} disabled={loadingRequests} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <RefreshCw className={`w-4 h-4 text-gray-500 ${loadingRequests ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              يتحدث تلقائياً
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {availableRequests.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-gray-500 text-sm">لا توجد طلبات متاحة</p>
              </div>
            ) : (
              availableRequests.map((req) => (
                <div key={req.id} className="p-4 hover:bg-gray-50 cursor-pointer transition">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${req.base_price ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {req.base_price ? 'مسعّرة' : 'تحتاج عرض سعر'}
                    </span>
                    <span className="text-xs text-gray-400">{getTimeAgo(req.created_at)}</span>
                  </div>
                  <h4 className="font-semibold text-slate-900 text-sm mb-1 line-clamp-1">{req.title || 'طلب خدمة'}</h4>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500 font-mono">{req.ticket_number}</span>
                    {req.base_price ? (
                      <span className="text-sm font-bold text-green-600">{req.base_price.toLocaleString()} ر.س</span>
                    ) : (
                      <span className="text-xs text-amber-600 font-semibold">عرض سعر</span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    {req.base_price ? (
                      <button className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold flex items-center justify-center gap-1">
                        <CheckCircle className="w-3 h-3" />قبول
                      </button>
                    ) : (
                      <button className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold flex items-center justify-center gap-1">
                        <Send className="w-3 h-3" />تقديم عرض
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <p className="text-center text-xs text-gray-400">اضغط على أي طلب لعرض التفاصيل</p>
          </div>
        </aside>
      )}
    </div>
  )
}
