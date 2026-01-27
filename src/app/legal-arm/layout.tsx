'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar,
  LayoutDashboard, Users, Building2, Shield, Briefcase,
  FileText, Scale, UserCircle, Receipt, FileSignature,
  Wrench, Wallet, BarChart3, Settings, Bell, FolderOpen,
  Menu, X, LogOut, ChevronDown, Gavel, Network
} from 'lucide-react'
import { logoutLegalArm } from '@/lib/auth'

// ═══════════════════════════════════════════════════════════════
// ⚖️ Layout الذراع القانوني
// 📅 تاريخ التحديث: 4 يناير 2026
// ═══════════════════════════════════════════════════════════════
// التغييرات:
// - دمج (المحامين + الأقسام + المسميات) في "الهيكل التنظيمي"
// ═══════════════════════════════════════════════════════════════

const menuItems = [
  { href: '/legal-arm/dashboard', label: 'لوحة القيادة', icon: LayoutDashboard },
  { 
    label: 'إدارة الفريق', 
    icon: Users,
    children: [
      { href: '/legal-arm/employees', label: 'الموظفين', icon: Users },
      { href: '/legal-arm/departments', label: 'الأقسام', icon: Building2 },
      { href: '/legal-arm/job-titles', label: 'المسميات الوظيفية', icon: Briefcase },
      { href: '/legal-arm/permissions', label: 'الصلاحيات', icon: Shield },
    ]
  },
  { 
    label: 'العمليات', 
    icon: FileText,
    children: [
      { href: '/legal-arm/requests', label: 'الطلبات', icon: FileText },
      { href: '/legal-arm/cases', label: 'القضايا', icon: Scale },
      { href: '/legal-arm/quotes', label: 'عروض الأسعار', icon: Receipt },
      { href: '/legal-arm/contracts', label: 'العقود', icon: FileSignature },
    ]
  },
  { href: '/legal-arm/clients', label: 'العملاء', icon: UserCircle },
  { href: '/legal-arm/services', label: 'الخدمات', icon: Wrench },
  { href: '/legal-arm/earnings', label: 'الأرباح', icon: Wallet },
  { href: '/legal-arm/calendar', label: 'التقويم', icon: Calendar },
  { href: '/legal-arm/documents', label: 'المستندات', icon: FolderOpen },
  { href: '/legal-arm/reports', label: 'التقارير', icon: BarChart3 },
  { href: '/legal-arm/notifications', label: 'الإشعارات', icon: Bell },
  { href: '/legal-arm/settings', label: 'الإعدادات', icon: Settings },
  { href: '/legal-arm/profile', label: 'ملف الذراع', icon: Gavel },
]

export default function LegalArmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['إدارة الفريق', 'العمليات'])
  const [armData, setArmData] = useState<any>(null)
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
      if (window.innerWidth < 1024) setIsSidebarOpen(false)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    setArmData({ name_ar: 'الذراع القانوني', logo_url: null })
  }, [])

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev => prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label])
  }

  return (
    <div className="min-h-screen bg-slate-100 flex" dir="rtl">
      {isMobile && isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed lg:static inset-y-0 right-0 z-50 w-72 bg-gradient-to-b from-purple-900 to-purple-800 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:w-20'} flex flex-col`}>
        <div className="p-4 border-b border-purple-700">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-3 ${!isSidebarOpen && !isMobile ? 'justify-center w-full' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <Gavel className="w-6 h-6 text-white" />
              </div>
              {(isSidebarOpen || isMobile) && <div><h1 className="font-bold text-white">الذراع القانوني</h1><p className="text-xs text-purple-300">{armData?.name_ar}</p></div>}
            </div>
            {isMobile && <button onClick={() => setIsSidebarOpen(false)} className="text-purple-300 hover:text-white"><X className="w-6 h-6" /></button>}
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item, idx) => (
            <div key={idx}>
              {item.children ? (
                <div>
                  <button onClick={() => toggleMenu(item.label)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-purple-200 hover:bg-purple-700/50 ${!isSidebarOpen && !isMobile ? 'justify-center' : ''}`}>
                    <div className="flex items-center gap-3"><item.icon className="w-5 h-5" />{(isSidebarOpen || isMobile) && <span className="text-sm">{item.label}</span>}</div>
                    {(isSidebarOpen || isMobile) && <ChevronDown className={`w-4 h-4 transition-transform ${expandedMenus.includes(item.label) ? 'rotate-180' : ''}`} />}
                  </button>
                  {expandedMenus.includes(item.label) && (isSidebarOpen || isMobile) && (
                    <div className="mr-4 mt-1 space-y-1 border-r border-purple-700 pr-3">
                      {item.children.map((child, childIdx) => (
                        <Link key={childIdx} href={child.href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${pathname === child.href ? 'bg-purple-600 text-white' : 'text-purple-300 hover:bg-purple-700/50 hover:text-white'}`}>
                          <child.icon className="w-4 h-4" /><span>{child.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${pathname === item.href ? 'bg-purple-600 text-white' : 'text-purple-200 hover:bg-purple-700/50'} ${!isSidebarOpen && !isMobile ? 'justify-center' : ''}`}>
                  <item.icon className="w-5 h-5" />{(isSidebarOpen || isMobile) && <span className="text-sm">{item.label}</span>}
                  {item.href === '/legal-arm/notifications' && unreadNotifications > 0 && <span className="mr-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadNotifications}</span>}
                </Link>
              )}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-purple-700">
          <button onClick={logoutLegalArm} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 ${!isSidebarOpen && !isMobile ? 'justify-center' : ''}`}>
            <LogOut className="w-5 h-5" />{(isSidebarOpen || isMobile) && <span className="text-sm">تسجيل الخروج</span>}
          </button>
        </div>
      </aside>
      <main className="flex-1 min-h-screen">
        <header className="bg-white shadow-sm sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg"><Menu className="w-5 h-5 text-slate-600" /></button>
              <h2 className="font-semibold text-slate-800">{menuItems.find(m => m.href === pathname)?.label || menuItems.flatMap(m => m.children || []).find(c => c.href === pathname)?.label || 'الذراع القانوني'}</h2>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/legal-arm/notifications" className="relative p-2 hover:bg-slate-100 rounded-lg"><Bell className="w-5 h-5 text-slate-600" />{unreadNotifications > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{unreadNotifications}</span>}</Link>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold">{armData?.name_ar?.[0] || 'ذ'}</div>
            </div>
          </div>
        </header>
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  )
}
