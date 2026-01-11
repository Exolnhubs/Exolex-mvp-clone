'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// 📌 صفحة الإعدادات - محامي الذراع القانوني
// 📅 تاريخ الإنشاء: 12 يناير 2026
// ═══════════════════════════════════════════════════════════════

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lawyerId, setLawyerId] = useState<string | null>(null)

  const [settings, setSettings] = useState({
    notifications_email: true,
    notifications_sms: true,
    notifications_push: true,
    auto_accept_consultations: false,
    show_in_marketplace: true,
    max_concurrent_requests: 10,
    working_hours_start: '09:00',
    working_hours_end: '17:00',
    working_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday']
  })

  useEffect(() => {
    const id = localStorage.getItem('exolex_lawyer_id')
    if (!id) {
      router.push('/auth/lawyer-login')
      return
    }
    setLawyerId(id)
    loadSettings(id)
  }, [])

  const loadSettings = async (id: string) => {
    try {
      const { data } = await supabase
        .from('lawyers')
        .select('settings, max_concurrent_requests')
        .eq('id', id)
        .single()

      if (data?.settings) {
        setSettings(prev => ({ ...prev, ...data.settings }))
      }
      if (data?.max_concurrent_requests) {
        setSettings(prev => ({ ...prev, max_concurrent_requests: data.max_concurrent_requests }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!lawyerId) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('lawyers')
        .update({
          settings: {
            notifications_email: settings.notifications_email,
            notifications_sms: settings.notifications_sms,
            notifications_push: settings.notifications_push,
            auto_accept_consultations: settings.auto_accept_consultations,
            show_in_marketplace: settings.show_in_marketplace,
            working_hours_start: settings.working_hours_start,
            working_hours_end: settings.working_hours_end,
            working_days: settings.working_days
          },
          max_concurrent_requests: settings.max_concurrent_requests
        })
        .eq('id', lawyerId)

      if (error) throw error
      toast.success('✅ تم حفظ الإعدادات')
    } catch (err) {
      console.error(err)
      toast.error('خطأ في حفظ الإعدادات')
    } finally {
      setSaving(false)
    }
  }

  const toggleDay = (day: string) => {
    setSettings(prev => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter(d => d !== day)
        : [...prev.working_days, day]
    }))
  }

  const daysOfWeek = [
    { key: 'sunday', label: 'الأحد' },
    { key: 'monday', label: 'الإثنين' },
    { key: 'tuesday', label: 'الثلاثاء' },
    { key: 'wednesday', label: 'الأربعاء' },
    { key: 'thursday', label: 'الخميس' },
    { key: 'friday', label: 'الجمعة' },
    { key: 'saturday', label: 'السبت' }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      
      {/* الإشعارات */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">🔔 إعدادات الإشعارات</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-800">إشعارات البريد الإلكتروني</p>
              <p className="text-sm text-gray-500">استلام الإشعارات عبر البريد</p>
            </div>
            <button
              onClick={() => setSettings({...settings, notifications_email: !settings.notifications_email})}
              className={`w-12 h-6 rounded-full transition ${settings.notifications_email ? 'bg-amber-500' : 'bg-gray-300'}`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full shadow transition transform ${settings.notifications_email ? 'translate-x-1' : 'translate-x-6'}`}></span>
            </button>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-800">إشعارات الرسائل النصية</p>
              <p className="text-sm text-gray-500">استلام الإشعارات عبر SMS</p>
            </div>
            <button
              onClick={() => setSettings({...settings, notifications_sms: !settings.notifications_sms})}
              className={`w-12 h-6 rounded-full transition ${settings.notifications_sms ? 'bg-amber-500' : 'bg-gray-300'}`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full shadow transition transform ${settings.notifications_sms ? 'translate-x-1' : 'translate-x-6'}`}></span>
            </button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-800">الإشعارات الفورية</p>
              <p className="text-sm text-gray-500">إشعارات داخل التطبيق</p>
            </div>
            <button
              onClick={() => setSettings({...settings, notifications_push: !settings.notifications_push})}
              className={`w-12 h-6 rounded-full transition ${settings.notifications_push ? 'bg-amber-500' : 'bg-gray-300'}`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full shadow transition transform ${settings.notifications_push ? 'translate-x-1' : 'translate-x-6'}`}></span>
            </button>
          </div>
        </div>
      </div>

      {/* إعدادات العمل */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">⚙️ إعدادات العمل</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-800">قبول الاستشارات تلقائياً</p>
              <p className="text-sm text-gray-500">قبول الاستشارات المسعّرة تلقائياً</p>
            </div>
            <button
              onClick={() => setSettings({...settings, auto_accept_consultations: !settings.auto_accept_consultations})}
              className={`w-12 h-6 rounded-full transition ${settings.auto_accept_consultations ? 'bg-amber-500' : 'bg-gray-300'}`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full shadow transition transform ${settings.auto_accept_consultations ? 'translate-x-1' : 'translate-x-6'}`}></span>
            </button>
          </div>

          <div className="py-3 border-b border-gray-100">
            <p className="font-medium text-gray-800 mb-2">الحد الأقصى للطلبات المتزامنة</p>
            <input
              type="number"
              min="1"
              max="50"
              value={settings.max_concurrent_requests}
              onChange={(e) => setSettings({...settings, max_concurrent_requests: parseInt(e.target.value) || 10})}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div className="py-3">
            <p className="font-medium text-gray-800 mb-3">أوقات العمل</p>
            <div className="flex items-center gap-4">
              <div>
                <label className="text-sm text-gray-500 block mb-1">من</label>
                <input
                  type="time"
                  value={settings.working_hours_start}
                  onChange={(e) => setSettings({...settings, working_hours_start: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">إلى</label>
                <input
                  type="time"
                  value={settings.working_hours_end}
                  onChange={(e) => setSettings({...settings, working_hours_end: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="py-3">
            <p className="font-medium text-gray-800 mb-3">أيام العمل</p>
            <div className="flex flex-wrap gap-2">
              {daysOfWeek.map((day) => (
                <button
                  key={day.key}
                  onClick={() => toggleDay(day.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    settings.working_days.includes(day.key)
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* زر الحفظ */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold disabled:opacity-50 transition"
        >
          {saving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
        </button>
      </div>
    </div>
  )
}
