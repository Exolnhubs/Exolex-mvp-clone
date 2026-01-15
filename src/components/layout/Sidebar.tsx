'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SidebarProps {
  isSubscribed: boolean
  userName: string
  onLogout: () => void
}

const menuItems = [
  { href: '/subscriber/dashboard', label: 'لوحة التحكم', icon: '🏠' },
  { href: '/subscriber/nolex', label: 'اسأل NOLEX', icon: '🤖' },
  { href: '/subscriber/requests', label: 'طلباتي', icon: '📋' },
  { href: '/subscriber/library', label: 'المكتبة القانونية', icon: '📚' },
  { href: '/subscriber/extra-services', label: 'خدمات إضافية', icon: '➕' },
  { href: '/subscriber/calendar', label: 'التقويم', icon: '📅' },
  { href: '/subscriber/inbox', label: 'مركز التواصل', icon: '💬' },
  { href: '/subscriber/ratings', label: 'تقييماتي', icon: '⭐' },
]

const accountItems = [
  { href: '/subscriber/profile', label: 'الملف الشخصي', icon: '👤' },
  { href: '/subscriber/subscription', label: 'الباقات', icon: '💎' },
  { href: '/subscriber/affiliate', label: 'مشاركة التطبيق', icon: '🎁' },
  { href: '/subscriber/settings', label: 'الإعدادات', icon: '⚙️' },
]

export default function Sidebar({ isSubscribed, userName, onLogout }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="fixed right-0 top-0 h-screen w-64 bg-white border-l border-gray-200 flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <Link href="/subscriber/dashboard" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-blue-600">ExoLex</span>
        </Link>
        <p className="text-xs text-gray-500 mt-1">الحماية القانونية في متناولك</p>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold">
            {userName?.charAt(0) || '؟'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{userName || 'مستخدم'}</p>
            <p className={`text-xs ${isSubscribed ? 'text-green-600' : 'text-amber-600'}`}>
              {isSubscribed ? '✓ مشترك' : '⚠️ غير مشترك'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        {/* القائمة الرئيسية */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 mb-2 px-3">القائمة الرئيسية</p>
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    pathname === item.href
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {item.href === '/subscriber/nolex' ? (
                    <img src="/nolex-avatar.jpg" alt="NOLEX" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <span className="text-xl">{item.icon}</span>
                  )}
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* الحساب */}
        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2 px-3">الحساب</p>
          <ul className="space-y-1">
            {accountItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    pathname === item.href
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.href === '/subscriber/affiliate' && (
                    <span className="mr-auto text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">جديد</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <span className="text-xl">🚪</span>
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  )
}
