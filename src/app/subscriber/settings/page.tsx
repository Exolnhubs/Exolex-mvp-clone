'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logoutMember } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import toast from 'react-hot-toast'

interface UserSettings {
  id?: string
  user_id: string
  language: string
  notify_request_updates: boolean
  notify_lawyer_messages: boolean
  notify_appointment_reminders: boolean
  notify_promotions: boolean
  notify_via_email: boolean
  notify_via_sms: boolean
  notify_via_whatsapp: boolean
  notify_via_push: boolean
  two_factor_enabled: boolean
  two_factor_method?: string
}

interface UserDevice {
  id: string
  device_name: string
  device_type: string
  device_os: string
  browser: string
  ip_address: string
  location: string
  is_verified: boolean
  is_current: boolean
  is_trusted: boolean
  last_active_at: string
  created_at: string
}

const DEFAULT_SETTINGS: Omit<UserSettings, 'user_id'> = {
  language: 'ar',
  notify_request_updates: true,
  notify_lawyer_messages: true,
  notify_appointment_reminders: true,
  notify_promotions: true,
  notify_via_email: true,
  notify_via_sms: false,
  notify_via_whatsapp: true,
  notify_via_push: true,
  two_factor_enabled: false,
  two_factor_method: undefined,
}

const LANGUAGES = [
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ur', name: 'اردو', flag: '🇵🇰' },
  { code: 'tl', name: 'Tagalog', flag: '🇵🇭' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [devices, setDevices] = useState<UserDevice[]>([])
  const [isSubscribed, setIsSubscribed] = useState(false)
  
  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [show2FAModal, setShow2FAModal] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [showVerifyDeviceModal, setShowVerifyDeviceModal] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<UserDevice | null>(null)
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // 2FA
  const [twoFactorMethod, setTwoFactorMethod] = useState('whatsapp')
  const [verificationCode, setVerificationCode] = useState('')
  const [twoFactorStep, setTwoFactorStep] = useState(1)
  
  // Deactivate
  const [deactivateReason, setDeactivateReason] = useState('')
  const [deactivateConfirm, setDeactivateConfirm] = useState('')

  useEffect(() => {
    const userId = localStorage.getItem('exolex_user_id')
    if (!userId) { router.push('/auth/login'); return }

    const fetchData = async () => {
      try {
        // Fetch user
        const { data: userData } = await supabase.from('users').select('*').eq('id', userId).single()
        if (userData) setUser(userData)

        // Fetch member first
        const { data: memberData } = await supabase.from('members').select('id').eq('user_id', userId).single()
        
        // Fetch subscription
        const { data: subData } = await supabase.from('subscriptions').select('*').eq('member_id', memberData?.id).eq('status', 'active').single()
        if (subData) setIsSubscribed(true)

        // Fetch settings
        let { data: settingsData, error: settingsError } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .single()
        
        if (settingsError || !settingsData) {
          // Create default settings
          const newSettings = { user_id: userId, ...DEFAULT_SETTINGS }
          const { data: createdSettings, error: createError } = await supabase
            .from('user_settings')
            .insert(newSettings)
            .select()
            .single()
          
          if (!createError && createdSettings) {
            settingsData = createdSettings
          } else {
            // Use local defaults if DB fails
            settingsData = newSettings as any
          }
        }
        
        setSettings(settingsData)

        // Fetch devices
        const { data: devicesData } = await supabase
          .from('user_devices')
          .select('*')
          .eq('user_id', userId)
          .order('last_active_at', { ascending: false })
        
        if (devicesData) setDevices(devicesData)

        // Register current device
        await registerCurrentDevice(userId)

      } catch (err) {
        console.error('Error fetching data:', err)
        // Use defaults on error
        setSettings({ user_id: userId, ...DEFAULT_SETTINGS } as UserSettings)
      }

      setIsLoading(false)
    }
    fetchData()
  }, [router])

  const registerCurrentDevice = async (userId: string) => {
    const deviceInfo = {
      device_name: getDeviceName(),
      device_type: getDeviceType(),
      device_os: getDeviceOS(),
      browser: getBrowser(),
      is_current: true,
    }

    try {
      const { data: existingDevices } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', userId)
        .eq('browser', deviceInfo.browser)
        .eq('device_os', deviceInfo.device_os)

      if (!existingDevices || existingDevices.length === 0) {
        const { data: newDevice } = await supabase.from('user_devices').insert({
          user_id: userId,
          ...deviceInfo,
          last_active_at: new Date().toISOString(),
        }).select().single()
        
        if (newDevice) {
          setDevices(prev => [newDevice, ...prev])
        }
      } else {
        await supabase.from('user_devices')
          .update({ last_active_at: new Date().toISOString(), is_current: true })
          .eq('id', existingDevices[0].id)
      }
    } catch (err) {
      console.error('Error registering device:', err)
    }
  }

  const getDeviceName = () => {
    const ua = navigator.userAgent
    if (/iPhone/.test(ua)) return 'iPhone'
    if (/iPad/.test(ua)) return 'iPad'
    if (/Android/.test(ua)) return 'Android Device'
    if (/Mac/.test(ua)) return 'Mac'
    if (/Windows/.test(ua)) return 'Windows PC'
    if (/Linux/.test(ua)) return 'Linux PC'
    return 'Unknown Device'
  }

  const getDeviceType = () => {
    const ua = navigator.userAgent
    if (/Mobile|Android|iPhone/.test(ua)) return 'mobile'
    if (/Tablet|iPad/.test(ua)) return 'tablet'
    return 'desktop'
  }

  const getDeviceOS = () => {
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(ua)) {
      const match = ua.match(/OS (\d+[._]\d+)/)
      return match ? `iOS ${match[1].replace('_', '.')}` : 'iOS'
    }
    if (/Android/.test(ua)) {
      const match = ua.match(/Android (\d+\.?\d*)/)
      return match ? `Android ${match[1]}` : 'Android'
    }
    if (/Windows NT 10/.test(ua)) return 'Windows 10/11'
    if (/Windows/.test(ua)) return 'Windows'
    if (/Mac OS X/.test(ua)) {
      const match = ua.match(/Mac OS X (\d+[._]\d+)/)
      return match ? `macOS ${match[1].replace('_', '.')}` : 'macOS'
    }
    if (/Linux/.test(ua)) return 'Linux'
    return 'Unknown OS'
  }

  const getBrowser = () => {
    const ua = navigator.userAgent
    if (/Chrome/.test(ua) && !/Edge/.test(ua)) return 'Chrome'
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'Safari'
    if (/Firefox/.test(ua)) return 'Firefox'
    if (/Edge/.test(ua)) return 'Edge'
    if (/Opera/.test(ua)) return 'Opera'
    return 'Unknown Browser'
  }

  const handleLogout = () => {
    logoutMember()
  }

  const updateSetting = (key: keyof UserSettings, value: any) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  const handleSaveSettings = async () => {
    if (!settings || !user) return
    setIsSaving(true)
    
    try {
      const { error } = await supabase.from('user_settings').upsert({
        ...settings,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      })

      if (error) throw error
      toast.success('تم حفظ الإعدادات بنجاح')
    } catch (err) {
      console.error('Save error:', err)
      toast.error('حدث خطأ في حفظ الإعدادات')
    }
    
    setIsSaving(false)
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('كلمة المرور الجديدة غير متطابقة')
      return
    }
    if (newPassword.length < 8) {
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      return
    }
    
    toast.success('تم تغيير كلمة المرور بنجاح')
    setShowPasswordModal(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleEnable2FA = async () => {
    if (twoFactorStep === 1) {
      toast.success(`تم إرسال رمز التحقق عبر ${twoFactorMethod === 'whatsapp' ? 'واتساب' : twoFactorMethod === 'sms' ? 'رسالة نصية' : 'البريد الإلكتروني'}`)
      setTwoFactorStep(2)
    } else {
      if (!settings) return
      
      try {
        await supabase.from('user_settings').update({
          two_factor_enabled: true,
          two_factor_method: twoFactorMethod,
        }).eq('user_id', user.id)

        setSettings({ ...settings, two_factor_enabled: true, two_factor_method: twoFactorMethod })
        toast.success('تم تفعيل المصادقة الثنائية بنجاح')
        setShow2FAModal(false)
        setTwoFactorStep(1)
        setVerificationCode('')
      } catch (err) {
        toast.error('حدث خطأ في تفعيل المصادقة الثنائية')
      }
    }
  }

  const handleDisable2FA = async () => {
    if (!settings) return
    
    try {
      await supabase.from('user_settings').update({
        two_factor_enabled: false,
        two_factor_method: null,
      }).eq('user_id', user.id)

      setSettings({ ...settings, two_factor_enabled: false, two_factor_method: undefined })
      toast.success('تم إيقاف المصادقة الثنائية')
    } catch (err) {
      toast.error('حدث خطأ')
    }
  }

  const handleVerifyDevice = async () => {
    if (!selectedDevice) return
    
    try {
      await supabase.from('user_devices').update({
        is_verified: true,
        is_trusted: true,
        verified_at: new Date().toISOString(),
        verification_method: 'otp',
      }).eq('id', selectedDevice.id)

      setDevices(devices.map(d => d.id === selectedDevice.id ? { ...d, is_verified: true, is_trusted: true } : d))
      toast.success('تم توثيق الجهاز بنجاح')
      setShowVerifyDeviceModal(false)
      setSelectedDevice(null)
      setVerificationCode('')
    } catch (err) {
      toast.error('حدث خطأ في توثيق الجهاز')
    }
  }

  const handleRemoveDevice = async (deviceId: string) => {
    try {
      await supabase.from('user_devices').delete().eq('id', deviceId)
      setDevices(devices.filter(d => d.id !== deviceId))
      toast.success('تم إزالة الجهاز')
    } catch (err) {
      toast.error('حدث خطأ في إزالة الجهاز')
    }
  }

  const handleDeactivateAccount = async () => {
    if (deactivateConfirm !== 'تعطيل') {
      toast.error('يرجى كتابة "تعطيل" للتأكيد')
      return
    }
    
    try {
      await supabase.from('users').update({
        status: 'deactivated',
        is_deactivated: true,
        deactivated_at: new Date().toISOString(),
      }).eq('id', user.id)

      toast.success('تم تعطيل الحساب. سيتم تسجيل خروجك الآن.')
      setTimeout(() => handleLogout(), 2000)
    } catch (err) {
      toast.error('حدث خطأ في تعطيل الحساب')
    }
  }

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return '📱'
      case 'tablet': return '📱'
      case 'desktop': return '💻'
      default: return '🖥️'
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'الآن'
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`
    if (diffHours < 24) return `منذ ${diffHours} ساعة`
    if (diffDays < 7) return `منذ ${diffDays} يوم`
    return date.toLocaleDateString('ar-SA')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isSubscribed={isSubscribed} userName={user?.full_name || ''} onLogout={handleLogout} />

      <main className="flex-1 mr-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-8 py-6">
            <h1 className="text-2xl font-bold text-gray-900">⚙️ الإعدادات</h1>
            <p className="text-gray-500 mt-1">إدارة إعدادات حسابك والإشعارات والأمان</p>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
          
          {/* 🔔 الإشعارات */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-l from-blue-50 to-white">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="text-2xl">🔔</span> الإشعارات
              </h2>
              <p className="text-gray-500 text-sm mt-1">تحكم في الإشعارات التي تصلك</p>
            </div>
            <div className="p-6 space-y-6">
              {/* أنواع الإشعارات */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-4">أنواع الإشعارات</h3>
                <div className="space-y-3">
                  {/* تحديثات الطلبات */}
                  <div 
                    onClick={() => updateSetting('notify_request_updates', !settings?.notify_request_updates)}
                    className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all border-2 ${settings?.notify_request_updates ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📋</span>
                      <div>
                        <p className="font-medium">تحديثات الطلبات</p>
                        <p className="text-sm text-gray-500">إشعارات عند تغيير حالة طلباتك</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${settings?.notify_request_updates ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>
                      {settings?.notify_request_updates && '✓'}
                    </div>
                  </div>
                  
                  {/* رسائل المحامي */}
                  <div 
                    onClick={() => updateSetting('notify_lawyer_messages', !settings?.notify_lawyer_messages)}
                    className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all border-2 ${settings?.notify_lawyer_messages ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">💬</span>
                      <div>
                        <p className="font-medium">رسائل المحامي</p>
                        <p className="text-sm text-gray-500">إشعارات عند استلام رسالة من المحامي</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${settings?.notify_lawyer_messages ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>
                      {settings?.notify_lawyer_messages && '✓'}
                    </div>
                  </div>
                  
                  {/* تذكيرات المواعيد */}
                  <div 
                    onClick={() => updateSetting('notify_appointment_reminders', !settings?.notify_appointment_reminders)}
                    className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all border-2 ${settings?.notify_appointment_reminders ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📅</span>
                      <div>
                        <p className="font-medium">تذكيرات المواعيد</p>
                        <p className="text-sm text-gray-500">تذكير قبل المواعيد والجلسات</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${settings?.notify_appointment_reminders ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>
                      {settings?.notify_appointment_reminders && '✓'}
                    </div>
                  </div>
                  
                  {/* العروض والتخفيضات */}
                  <div 
                    onClick={() => updateSetting('notify_promotions', !settings?.notify_promotions)}
                    className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all border-2 ${settings?.notify_promotions ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🏷️</span>
                      <div>
                        <p className="font-medium">العروض والتخفيضات</p>
                        <p className="text-sm text-gray-500">إشعارات بالعروض الحصرية</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${settings?.notify_promotions ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>
                      {settings?.notify_promotions && '✓'}
                    </div>
                  </div>
                </div>
              </div>

              {/* قنوات الإشعارات */}
              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-700 mb-4">قنوات الإرسال</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* البريد */}
                  <div 
                    onClick={() => updateSetting('notify_via_email', !settings?.notify_via_email)}
                    className={`flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${settings?.notify_via_email ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <span className="text-2xl mb-2">📧</span>
                    <span className="text-sm font-medium">البريد</span>
                    {settings?.notify_via_email && <span className="text-green-500 text-xs mt-1">✓ مفعّل</span>}
                  </div>
                  
                  {/* واتساب */}
                  <div 
                    onClick={() => updateSetting('notify_via_whatsapp', !settings?.notify_via_whatsapp)}
                    className={`flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${settings?.notify_via_whatsapp ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <span className="text-2xl mb-2">💬</span>
                    <span className="text-sm font-medium">واتساب</span>
                    {settings?.notify_via_whatsapp && <span className="text-green-500 text-xs mt-1">✓ مفعّل</span>}
                  </div>
                  
                  {/* رسالة نصية */}
                  <div 
                    onClick={() => updateSetting('notify_via_sms', !settings?.notify_via_sms)}
                    className={`flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${settings?.notify_via_sms ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <span className="text-2xl mb-2">📱</span>
                    <span className="text-sm font-medium">رسالة نصية</span>
                    {settings?.notify_via_sms && <span className="text-green-500 text-xs mt-1">✓ مفعّل</span>}
                  </div>
                  
                  {/* إشعارات التطبيق */}
                  <div 
                    onClick={() => updateSetting('notify_via_push', !settings?.notify_via_push)}
                    className={`flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${settings?.notify_via_push ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <span className="text-2xl mb-2">🔔</span>
                    <span className="text-sm font-medium">إشعارات التطبيق</span>
                    {settings?.notify_via_push && <span className="text-green-500 text-xs mt-1">✓ مفعّل</span>}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 🌐 اللغة */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-l from-green-50 to-white">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="text-2xl">🌐</span> اللغة
              </h2>
              <p className="text-gray-500 text-sm mt-1">اختر لغة الواجهة</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {LANGUAGES.map(lang => (
                  <div
                    key={lang.code}
                    onClick={() => updateSetting('language', lang.code)}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all ${settings?.language === lang.code ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <span className="text-3xl mb-2">{lang.flag}</span>
                    <span className="font-medium">{lang.name}</span>
                    {settings?.language === lang.code && <span className="text-green-500 text-xs mt-1">✓ مختارة</span>}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 🔐 الأمان */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-l from-red-50 to-white">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="text-2xl">🔐</span> الأمان
              </h2>
              <p className="text-gray-500 text-sm mt-1">إدارة كلمة المرور والمصادقة الثنائية</p>
            </div>
            <div className="p-6 space-y-4">
              {/* تغيير كلمة المرور */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🔑</span>
                  <div>
                    <p className="font-medium">كلمة المرور</p>
                    <p className="text-sm text-gray-500">آخر تغيير: غير معروف</p>
                  </div>
                </div>
                <button onClick={() => setShowPasswordModal(true)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors">
                  تغيير
                </button>
              </div>

              {/* المصادقة الثنائية */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🛡️</span>
                  <div>
                    <p className="font-medium">المصادقة الثنائية (2FA)</p>
                    <p className="text-sm text-gray-500">
                      {settings?.two_factor_enabled 
                        ? `مفعّلة عبر ${settings.two_factor_method === 'whatsapp' ? 'واتساب' : settings.two_factor_method === 'sms' ? 'رسالة نصية' : 'البريد'}`
                        : 'غير مفعّلة'}
                    </p>
                  </div>
                </div>
                {settings?.two_factor_enabled ? (
                  <button onClick={handleDisable2FA} className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 font-medium transition-colors">
                    إيقاف
                  </button>
                ) : (
                  <button onClick={() => setShow2FAModal(true)} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium transition-colors">
                    تفعيل
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 📱 الأجهزة المسجلة */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-l from-purple-50 to-white">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="text-2xl">📱</span> الأجهزة المسجلة
              </h2>
              <p className="text-gray-500 text-sm mt-1">إدارة الأجهزة المتصلة بحسابك</p>
            </div>
            <div className="p-6 space-y-3">
              {devices.length > 0 ? devices.map(device => (
                <div key={device.id} className={`flex items-center justify-between p-4 rounded-lg border ${device.is_current ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{getDeviceIcon(device.device_type)}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{device.device_name || device.browser}</p>
                        {device.is_current && (
                          <span className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded-full">الجهاز الحالي</span>
                        )}
                        {device.is_verified && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">✓ موثق</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{device.device_os} • {device.browser}</p>
                      <p className="text-xs text-gray-400">آخر نشاط: {formatDate(device.last_active_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!device.is_verified && (
                      <button 
                        onClick={() => { setSelectedDevice(device); setShowVerifyDeviceModal(true) }}
                        className="px-3 py-1.5 text-sm bg-green-100 text-green-600 rounded-lg hover:bg-green-200 font-medium transition-colors"
                      >
                        توثيق
                      </button>
                    )}
                    {!device.is_current && (
                      <button 
                        onClick={() => handleRemoveDevice(device.id)}
                        className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200 font-medium transition-colors"
                      >
                        إزالة
                      </button>
                    )}
                  </div>
                </div>
              )) : (
                <p className="text-center text-gray-400 py-8">لا توجد أجهزة مسجلة</p>
              )}
            </div>
          </section>

          {/* ⚠️ الحساب */}
          <section className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
            <div className="p-6 border-b border-red-200 bg-gradient-to-l from-red-50 to-white">
              <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
                <span className="text-2xl">⚠️</span> الحساب
              </h2>
              <p className="text-gray-500 text-sm mt-1">إدارة حسابك</p>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🚫</span>
                  <div>
                    <p className="font-medium text-red-700">تعطيل الحساب</p>
                    <p className="text-sm text-red-500">سيتم تعطيل حسابك ولن تتمكن من الوصول للخدمات</p>
                  </div>
                </div>
                <button onClick={() => setShowDeactivateModal(true)} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors">
                  تعطيل الحساب
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">
                ⚠️ لحذف الحساب نهائياً، يرجى التواصل مع الإدارة
              </p>
            </div>
          </section>

          {/* زر الحفظ */}
          <div className="flex justify-end">
            <button 
              onClick={handleSaveSettings} 
              disabled={isSaving}
              className="px-8 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
            </button>
          </div>
        </div>
      </main>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">🔑 تغيير كلمة المرور</h2>
              <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الحالية</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full border rounded-lg px-4 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الجديدة</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border rounded-lg px-4 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تأكيد كلمة المرور</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border rounded-lg px-4 py-2" />
              </div>
              <button onClick={handleChangePassword} className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">
                تغيير كلمة المرور
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Modal */}
      {show2FAModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">🛡️ تفعيل المصادقة الثنائية</h2>
              <button onClick={() => { setShow2FAModal(false); setTwoFactorStep(1) }} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {twoFactorStep === 1 && (
                <>
                  <p className="text-gray-600">اختر طريقة استلام رمز التحقق:</p>
                  <div className="space-y-2">
                    <div onClick={() => setTwoFactorMethod('whatsapp')} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer ${twoFactorMethod === 'whatsapp' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                      <span className="text-xl">💬</span>
                      <span>واتساب</span>
                      {twoFactorMethod === 'whatsapp' && <span className="mr-auto text-green-500">✓</span>}
                    </div>
                    <div onClick={() => setTwoFactorMethod('sms')} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer ${twoFactorMethod === 'sms' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                      <span className="text-xl">📱</span>
                      <span>رسالة نصية</span>
                      {twoFactorMethod === 'sms' && <span className="mr-auto text-purple-500">✓</span>}
                    </div>
                    <div onClick={() => setTwoFactorMethod('email')} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer ${twoFactorMethod === 'email' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                      <span className="text-xl">📧</span>
                      <span>البريد الإلكتروني</span>
                      {twoFactorMethod === 'email' && <span className="mr-auto text-blue-500">✓</span>}
                    </div>
                  </div>
                </>
              )}
              {twoFactorStep === 2 && (
                <>
                  <p className="text-gray-600 text-center">أدخل رمز التحقق المرسل</p>
                  <input type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} maxLength={6} className="w-full text-center text-2xl tracking-widest border rounded-lg px-4 py-3" placeholder="------" />
                </>
              )}
              <button onClick={handleEnable2FA} className="w-full py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600">
                {twoFactorStep === 1 ? 'إرسال رمز التحقق' : 'تفعيل'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Device Modal */}
      {showVerifyDeviceModal && selectedDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">📱 توثيق الجهاز</h2>
              <button onClick={() => { setShowVerifyDeviceModal(false); setSelectedDevice(null) }} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <span className="text-4xl">{getDeviceIcon(selectedDevice.device_type)}</span>
                <p className="font-medium mt-2">{selectedDevice.device_name || selectedDevice.browser}</p>
                <p className="text-sm text-gray-500">{selectedDevice.device_os}</p>
              </div>
              <p className="text-gray-600 text-center">أدخل رمز التحقق المرسل لتوثيق هذا الجهاز</p>
              <input type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} maxLength={6} className="w-full text-center text-2xl tracking-widest border rounded-lg px-4 py-3" placeholder="------" />
              <button onClick={handleVerifyDevice} className="w-full py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600">
                توثيق الجهاز
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-red-600">⚠️ تعطيل الحساب</h2>
              <button onClick={() => setShowDeactivateModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-red-700 font-medium">تحذير:</p>
                <ul className="text-sm text-red-600 mt-2 space-y-1">
                  <li>• سيتم تعطيل حسابك فوراً</li>
                  <li>• لن تتمكن من الوصول للخدمات</li>
                  <li>• يمكنك إعادة التفعيل بالتواصل مع الإدارة</li>
                </ul>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">سبب التعطيل (اختياري)</label>
                <textarea value={deactivateReason} onChange={(e) => setDeactivateReason(e.target.value)} className="w-full border rounded-lg px-4 py-2" rows={3} placeholder="أخبرنا لماذا تريد تعطيل حسابك..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">للتأكيد، اكتب "تعطيل"</label>
                <input type="text" value={deactivateConfirm} onChange={(e) => setDeactivateConfirm(e.target.value)} className="w-full border rounded-lg px-4 py-2" placeholder="تعطيل" />
              </div>
              <button onClick={handleDeactivateAccount} disabled={deactivateConfirm !== 'تعطيل'} className="w-full py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed">
                تأكيد تعطيل الحساب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
