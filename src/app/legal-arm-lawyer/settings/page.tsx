'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Briefcase, Users, Shield, Building, Home, Scale, FileText, Globe, Stamp, Zap, Folder, Gavel, Car, Heart, GraduationCap, Landmark, Plane, ShoppingBag, Wifi, LucideIcon } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// ⚙️ صفحة الإعدادات - محامي الذراع القانوني
// 📅 تاريخ: 21 يناير 2026
// 📍 المسار: /legal-arm-lawyer/settings/page.tsx
// ═══════════════════════════════════════════════════════════════

// خريطة الأيقونات
const iconMap: Record<string, LucideIcon> = {
  'briefcase': Briefcase,
  'users': Users,
  'shield': Shield,
  'building': Building,
  'home': Home,
  'scale': Scale,
  'filetext': FileText,
  'file-text': FileText,
  'FileText': FileText,
  'globe': Globe,
  'stamp': Stamp,
  'zap': Zap,
  'folder': Folder,
  'gavel': Gavel,
  'car': Car,
  'heart': Heart,
  'graduation-cap': GraduationCap,
  'landmark': Landmark,
  'plane': Plane,
  'shopping-bag': ShoppingBag,
  'wifi': Wifi,
}

const getIcon = (iconName: string | null) => {
  if (!iconName) return Folder
  const normalized = iconName.toLowerCase().replace(/\s/g, '')
  return iconMap[normalized] || iconMap[iconName] || Folder
}

export default function SettingsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'reminders' | 'channels'>('general')
  const [categories, setCategories] = useState<any[]>([])
  const [lawyerCategories, setLawyerCategories] = useState<string[]>([])

  const [userSettings, setUserSettings] = useState<any>({
    language: 'ar',
    two_factor_enabled: false,
    two_factor_method: 'sms',
    notify_via_push: true,
    notify_via_sms: true,
    notify_via_email: true,
    notify_via_whatsapp: false,
  })

  const [notifSettings, setNotifSettings] = useState<any>({
    notify_new_requests: true,
    notify_fixed_price: true,
    notify_quote_requests: true,
    notify_offer_accepted: true,
    notify_offer_rejected: true,
    notify_request_updates: true,
    notify_messages: true,
    notify_ratings: true,
    notify_system_updates: true,
    notify_all_categories: false,
    selected_categories: [],
  })

  const [reminderSettings, setReminderSettings] = useState<any>({
    remind_2_days_before: true,
    remind_1_day_before: true,
    remind_8_hours_before: false,
    remind_2_hours_before: true,
    remind_1_hour_before: false,
    remind_poa_number: true,
    remind_formal_dress: true,
    remind_read_memos: true,
    remind_upload_memos: false,
    remind_bring_witnesses: false,
    remind_client_attendance: true,
    remind_appeal_deadline: true,
    appeal_reminder_days_before: 7,
    remind_via_push: true,
    remind_via_sms: true,
    remind_via_email: true,
    remind_via_whatsapp: false,
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const lawyerId = localStorage.getItem('exolex_lawyer_id')
      if (!lawyerId) { router.push('/auth/lawyer-login'); return }

      // ═══════════════════════════════════════════════════════════
      // التحقق من أن المحامي من نوع legal_arm
      // ═══════════════════════════════════════════════════════════
      const { data: lawyerData, error: lawyerError } = await supabase
        .from('lawyers')
        .select('user_id, lawyer_type')
        .eq('id', lawyerId)
        .single()

      if (lawyerError || !lawyerData) {
        toast.error('خطأ في جلب بيانات المحامي')
        router.push('/auth/lawyer-login')
        return
      }

      // التحقق من نوع المحامي - يجب أن يكون legal_arm
      if (lawyerData.lawyer_type !== 'legal_arm') {
        toast.error('غير مصرح لك بالوصول لهذه الصفحة')
        router.push('/auth/lawyer-login')
        return
      }

      if (!lawyerData?.user_id) {
        setIsLoading(false)
        return
      }

      const { data: cats } = await supabase
        .from('categories')
        .select('id, name_ar, name_en, icon')
        .eq('is_active', true)
        .order('sort_order')

      setCategories(cats || [])

      const { data: lawyerCats } = await supabase
        .from('lawyer_categories')
        .select('category_id')
        .eq('lawyer_id', lawyerId)

      setLawyerCategories((lawyerCats || []).map(c => c.category_id))

      const { data: userSet } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', lawyerData.user_id)
        .single()

      if (userSet) setUserSettings(userSet)

      const { data: notifSet } = await supabase
        .from('lawyer_notification_settings')
        .select('*')
        .eq('lawyer_id', lawyerId)
        .single()

      if (notifSet) setNotifSettings({
        ...notifSet,
        selected_categories: notifSet.selected_categories || []
      })

      const { data: remindSet } = await supabase
        .from('lawyer_reminder_preferences')
        .select('*')
        .eq('lawyer_id', lawyerId)
        .single()

      if (remindSet) setReminderSettings(remindSet)

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      const lawyerId = localStorage.getItem('exolex_lawyer_id')
      const { data: lawyerData } = await supabase
        .from('lawyers')
        .select('user_id')
        .eq('id', lawyerId)
        .single()

      const { error: err1 } = await supabase
        .from('user_settings')
        .upsert({
          user_id: lawyerData?.user_id,
          language: userSettings.language,
          two_factor_enabled: userSettings.two_factor_enabled,
          two_factor_method: userSettings.two_factor_method,
          notify_via_push: userSettings.notify_via_push,
          notify_via_sms: userSettings.notify_via_sms,
          notify_via_email: userSettings.notify_via_email,
          notify_via_whatsapp: userSettings.notify_via_whatsapp,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

      const { error: err2 } = await supabase
        .from('lawyer_notification_settings')
        .upsert({
          lawyer_id: lawyerId,
          notify_new_requests: notifSettings.notify_new_requests,
          notify_fixed_price: notifSettings.notify_fixed_price,
          notify_quote_requests: notifSettings.notify_quote_requests,
          notify_offer_accepted: notifSettings.notify_offer_accepted,
          notify_offer_rejected: notifSettings.notify_offer_rejected,
          notify_request_updates: notifSettings.notify_request_updates,
          notify_messages: notifSettings.notify_messages,
          notify_ratings: notifSettings.notify_ratings,
          notify_system_updates: notifSettings.notify_system_updates,
          notify_all_categories: notifSettings.notify_all_categories,
          selected_categories: notifSettings.selected_categories,
          updated_at: new Date().toISOString()
        }, { onConflict: 'lawyer_id' })

      const { error: err3 } = await supabase
        .from('lawyer_reminder_preferences')
        .upsert({
          lawyer_id: lawyerId,
          remind_2_days_before: reminderSettings.remind_2_days_before,
          remind_1_day_before: reminderSettings.remind_1_day_before,
          remind_8_hours_before: reminderSettings.remind_8_hours_before,
          remind_2_hours_before: reminderSettings.remind_2_hours_before,
          remind_1_hour_before: reminderSettings.remind_1_hour_before,
          remind_poa_number: reminderSettings.remind_poa_number,
          remind_formal_dress: reminderSettings.remind_formal_dress,
          remind_read_memos: reminderSettings.remind_read_memos,
          remind_upload_memos: reminderSettings.remind_upload_memos,
          remind_bring_witnesses: reminderSettings.remind_bring_witnesses,
          remind_client_attendance: reminderSettings.remind_client_attendance,
          remind_appeal_deadline: reminderSettings.remind_appeal_deadline,
          appeal_reminder_days_before: reminderSettings.appeal_reminder_days_before,
          remind_via_push: reminderSettings.remind_via_push,
          remind_via_sms: reminderSettings.remind_via_sms,
          remind_via_email: reminderSettings.remind_via_email,
          remind_via_whatsapp: reminderSettings.remind_via_whatsapp,
          updated_at: new Date().toISOString()
        }, { onConflict: 'lawyer_id' })

      if (err1 || err2 || err3) throw new Error('خطأ في الحفظ')

      toast.success('✅ تم حفظ الإعدادات')
    } catch (error) {
      console.error(error)
      toast.error('حدث خطأ في الحفظ')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleCategory = (catId: string) => {
    const current = notifSettings.selected_categories || []
    if (current.includes(catId)) {
      setNotifSettings({ ...notifSettings, selected_categories: current.filter((c: string) => c !== catId) })
    } else {
      setNotifSettings({ ...notifSettings, selected_categories: [...current, catId] })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">⚙️ الإعدادات</h1>
              <p className="text-slate-500 mt-1">تخصيص إعدادات حسابك وتفضيلاتك</p>
              <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                🏛️ محامي الذراع القانوني
              </span>
            </div>
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? '⏳ جاري الحفظ...' : '✅ حفظ الإعدادات'}
            </button>
          </div>
        </div>

        {/* التبويبات */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="flex border-b overflow-x-auto">
            {[
              { key: 'general', label: 'عام', icon: '🔧' },
              { key: 'notifications', label: 'الإشعارات', icon: '🔔' },
              { key: 'reminders', label: 'التذكيرات', icon: '⏰' },
              { key: 'channels', label: 'قنوات الإرسال', icon: '📡' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 px-4 py-3 text-center font-medium whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* المحتوى */}
        <div className="bg-white rounded-xl shadow-sm p-6">

          {/* الإعدادات العامة */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">🔧 الإعدادات العامة</h2>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-medium text-slate-700">🌐 لغة الواجهة</p>
                  <p className="text-sm text-slate-500">اختر لغة عرض التطبيق</p>
                </div>
                <select
                  value={userSettings.language}
                  onChange={(e) => setUserSettings({ ...userSettings, language: e.target.value })}
                  className="px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-700">🔐 المصادقة الثنائية</p>
                    <p className="text-sm text-slate-500">حماية إضافية لحسابك</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.two_factor_enabled}
                      onChange={(e) => setUserSettings({ ...userSettings, two_factor_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-[-20px]"></div>
                  </label>
                </div>
                {userSettings.two_factor_enabled && (
                  <div className="mt-4 flex gap-4">
                    {['sms', 'whatsapp', 'email'].map(method => (
                      <label key={method} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="2fa"
                          value={method}
                          checked={userSettings.two_factor_method === method}
                          onChange={() => setUserSettings({ ...userSettings, two_factor_method: method })}
                          className="text-amber-500"
                        />
                        <span className="text-sm">{method === 'sms' ? 'رسالة SMS' : method === 'whatsapp' ? 'واتساب' : 'البريد'}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <button
                  onClick={() => {
                    localStorage.removeItem('exolex_lawyer_id')
                    router.push('/auth/lawyer-login')
                  }}
                  className="px-6 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                >
                  🚪 تسجيل الخروج
                </button>
              </div>
            </div>
          )}

          {/* إعدادات الإشعارات */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">🔔 إعدادات الإشعارات</h2>

              <div className="space-y-3">
                {[
                  { key: 'notify_new_requests', label: 'طلبات جديدة', icon: '📋', desc: 'إشعار عند إسناد طلب جديد لك' },
                  { key: 'notify_request_updates', label: 'تحديثات الطلبات', icon: '🔄', desc: 'تحديثات على طلباتك' },
                  { key: 'notify_messages', label: 'الرسائل', icon: '💬', desc: 'رسائل من المشتركين' },
                  { key: 'notify_ratings', label: 'التقييمات', icon: '⭐', desc: 'تقييمات جديدة' },
                  { key: 'notify_system_updates', label: 'تحديثات النظام', icon: '🔔', desc: 'إعلانات وتحديثات من الذراع' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{item.icon}</span>
                      <div>
                        <p className="font-medium text-slate-700">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifSettings[item.key]}
                        onChange={(e) => setNotifSettings({ ...notifSettings, [item.key]: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-[-20px]"></div>
                    </label>
                  </div>
                ))}
              </div>

              {/* المجالات - ملاحظة: محامي الذراع يعمل حسب مجالات الذراع */}
              <div className="pt-4 border-t">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-sm text-blue-700">
                    💡 <strong>ملاحظة:</strong> كمحامي ذراع قانوني، ستستلم الطلبات حسب المجالات المعتمدة من قبل الذراع القانوني الذي تعمل معه.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* إعدادات التذكيرات */}
          {activeTab === 'reminders' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">⏰ إعدادات التذكيرات</h2>

              <div>
                <h3 className="font-medium text-slate-700 mb-3">🕐 متى تريد التذكير؟</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { key: 'remind_2_days_before', label: 'قبل يومين' },
                    { key: 'remind_1_day_before', label: 'قبل يوم' },
                    { key: 'remind_8_hours_before', label: 'قبل 8 ساعات' },
                    { key: 'remind_2_hours_before', label: 'قبل ساعتين' },
                    { key: 'remind_1_hour_before', label: 'قبل ساعة' },
                  ].map(item => (
                    <label key={item.key} className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer ${reminderSettings[item.key] ? 'bg-amber-100 border-2 border-amber-400' : 'bg-slate-100'}`}>
                      <input
                        type="checkbox"
                        checked={reminderSettings[item.key]}
                        onChange={(e) => setReminderSettings({ ...reminderSettings, [item.key]: e.target.checked })}
                        className="rounded text-amber-500"
                      />
                      <span className="text-sm">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-medium text-slate-700 mb-3">✅ قائمة التحقق (تظهر في التذكير)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: 'remind_poa_number', label: '📜 رقم الوكالة' },
                    { key: 'remind_formal_dress', label: '👔 اللباس الرسمي' },
                    { key: 'remind_read_memos', label: '📖 قراءة المذكرات' },
                    { key: 'remind_upload_memos', label: '📤 رفع المذكرات' },
                    { key: 'remind_bring_witnesses', label: '👥 إحضار الشهود' },
                    { key: 'remind_client_attendance', label: '👤 حضور العميل' },
                  ].map(item => (
                    <label key={item.key} className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer ${reminderSettings[item.key] ? 'bg-green-100 border-2 border-green-400' : 'bg-slate-100'}`}>
                      <input
                        type="checkbox"
                        checked={reminderSettings[item.key]}
                        onChange={(e) => setReminderSettings({ ...reminderSettings, [item.key]: e.target.checked })}
                        className="rounded text-green-500"
                      />
                      <span className="text-sm">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-medium text-slate-700">⚖️ تذكير مواعيد الاستئناف</p>
                    <p className="text-sm text-slate-500">تذكير قبل انتهاء مدة الاستئناف</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reminderSettings.remind_appeal_deadline}
                        onChange={(e) => setReminderSettings({ ...reminderSettings, remind_appeal_deadline: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-[-20px]"></div>
                    </label>
                    {reminderSettings.remind_appeal_deadline && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">قبل</span>
                        <input
                          type="number"
                          value={reminderSettings.appeal_reminder_days_before}
                          onChange={(e) => setReminderSettings({ ...reminderSettings, appeal_reminder_days_before: parseInt(e.target.value) })}
                          className="w-16 px-2 py-1 border rounded text-center"
                          min="1"
                          max="30"
                        />
                        <span className="text-sm text-slate-600">يوم</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* قنوات الإرسال */}
          {activeTab === 'channels' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">📡 قنوات الإرسال</h2>
              <p className="text-slate-500 text-sm mb-4">اختر كيف تريد استقبال الإشعارات والتذكيرات</p>

              <div className="space-y-4">
                {[
                  { key: 'notify_via_push', label: 'إشعارات التطبيق', icon: '📱', desc: 'إشعارات فورية في التطبيق' },
                  { key: 'notify_via_sms', label: 'رسائل SMS', icon: '💬', desc: 'رسائل نصية على الجوال' },
                  { key: 'notify_via_email', label: 'البريد الإلكتروني', icon: '📧', desc: 'إشعارات على بريدك' },
                  { key: 'notify_via_whatsapp', label: 'واتساب', icon: '💚', desc: 'رسائل على واتساب' },
                ].map(channel => (
                  <div key={channel.key} className={`flex items-center justify-between p-4 rounded-xl ${userSettings[channel.key] ? 'bg-amber-50 border-2 border-amber-300' : 'bg-slate-50'}`}>
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{channel.icon}</span>
                      <div>
                        <p className="font-medium text-slate-700">{channel.label}</p>
                        <p className="text-sm text-slate-500">{channel.desc}</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={userSettings[channel.key]}
                        onChange={(e) => setUserSettings({ ...userSettings, [channel.key]: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-14 h-7 bg-slate-300 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[3px] after:right-[3px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-[-28px]"></div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-sm text-blue-700">
                  💡 <strong>ملاحظة:</strong> خدمات SMS والواتساب قد تكون مدفوعة حسب استخدامك. يُنصح بتفعيل إشعارات التطبيق كخيار أساسي.
                </p>
              </div>
            </div>
          )}

        </div>

        <div className="flex justify-center">
          <button
            onClick={saveSettings}
            disabled={isSaving}
            className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl flex items-center gap-2 disabled:opacity-50 shadow-lg"
          >
            {isSaving ? '⏳ جاري الحفظ...' : '✅ حفظ جميع الإعدادات'}
          </button>
        </div>

      </div>
    </div>
  )
}
