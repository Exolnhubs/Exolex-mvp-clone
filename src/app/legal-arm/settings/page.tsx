'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// ⚙️ صفحة الإعدادات - الذراع القانوني
// 📅 تاريخ: 4 يناير 2026
// ═══════════════════════════════════════════════════════════════
// الفرق عن الشريك:
// - يستخدم exolex_legal_arm_id
// - لا يوجد إيقاف مؤقت (كرسي مضمون)
// - لون بنفسجي
// ═══════════════════════════════════════════════════════════════

export default function SettingsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'requests' | 'notifications' | 'reminders' | 'channels'>('general')
  const [legalArmId, setLegalArmId] = useState<string | null>(null)

  // الإعدادات العامة
  const [generalSettings, setGeneralSettings] = useState({
    language: 'ar',
    two_factor_enabled: false,
    two_factor_method: 'sms',
  })

  // إعدادات استقبال الطلبات (بدون إيقاف مؤقت للذراع)
  const [requestSettings, setRequestSettings] = useState({
    auto_accept: true, // الذراع عادة يقبل تلقائياً
    max_concurrent_cases: 20,
  })

  // إعدادات الإشعارات
  const [notifSettings, setNotifSettings] = useState({
    // القضايا والملفات
    notify_case_opened: true,
    notify_case_closed: true,
    notify_case_document_uploaded: true,
    notify_case_memo_uploaded: true,
    notify_case_updated: true,
    notify_case_collaboration_request: true,
    notify_poa_issued: true,
    
    // عروض الأسعار
    notify_quote_submitted: true,
    notify_quote_pending_review: true,
    notify_quote_approved: true,
    notify_quote_awarded: true,
    notify_quote_rejected: true,
    
    // الطلبات والاستشارات
    notify_new_request: true,
    notify_request_replied: true,
    notify_request_delayed: true,
    notify_consultation_new: true,
    notify_consultation_completed: true,
    
    // المواعيد والجلسات
    notify_session_added: true,
    notify_session_postponed: true,
    notify_session_reminder: true,
    notify_session_result: true,
    
    // المالية
    notify_payment_received: true,
    notify_commission_transferred: true,
    notify_invoice_due: true,
    
    // التنبيهات والتحذيرات
    notify_license_expiry: true,
    notify_contract_expiry: true,
    notify_max_cases_exceeded: true,
  })

  // إعدادات التذكيرات
  const [reminderSettings, setReminderSettings] = useState({
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
  })

  // قنوات الإرسال
  const [channelSettings, setChannelSettings] = useState({
    notify_via_push: true,
    notify_via_sms: true,
    notify_via_email: true,
    notify_via_whatsapp: false,
    remind_via_push: true,
    remind_via_sms: true,
    remind_via_email: true,
    remind_via_whatsapp: false,
  })

  useEffect(() => {
    const id = localStorage.getItem('exolex_legal_arm_id')
    if (!id) {
      router.push('/auth/legal-arm-login')
      return
    }
    setLegalArmId(id)
    loadSettings(id)
  }, [])

  const loadSettings = async (armId: string) => {
    try {
      setIsLoading(true)

      // تحميل إعدادات الذراع
      const { data: armData } = await supabase
        .from('legal_arms')
        .select('auto_accept, max_concurrent_cases')
        .eq('id', armId)
        .single()

      if (armData) {
        setRequestSettings({
          auto_accept: armData.auto_accept ?? true,
          max_concurrent_cases: armData.max_concurrent_cases || 20,
        })
      }

      // تحميل إعدادات الإشعارات
      const { data: notifData } = await supabase
        .from('legal_arm_notification_settings')
        .select('*')
        .eq('legal_arm_id', armId)
        .single()

      if (notifData) {
        setNotifSettings(prev => ({ ...prev, ...notifData }))
        setChannelSettings({
          notify_via_push: notifData.notify_via_push ?? true,
          notify_via_sms: notifData.notify_via_sms ?? true,
          notify_via_email: notifData.notify_via_email ?? true,
          notify_via_whatsapp: notifData.notify_via_whatsapp ?? false,
          remind_via_push: notifData.remind_via_push ?? true,
          remind_via_sms: notifData.remind_via_sms ?? true,
          remind_via_email: notifData.remind_via_email ?? true,
          remind_via_whatsapp: notifData.remind_via_whatsapp ?? false,
        })
      }

      // تحميل إعدادات التذكيرات
      const { data: reminderData } = await supabase
        .from('legal_arm_reminder_preferences')
        .select('*')
        .eq('legal_arm_id', armId)
        .single()

      if (reminderData) {
        setReminderSettings(prev => ({ ...prev, ...reminderData }))
      }

      // تحميل الإعدادات العامة
      const { data: arm } = await supabase
        .from('legal_arms')
        .select('manager_user_id')
        .eq('id', armId)
        .single()

      if (arm?.manager_user_id) {
        const { data: userSet } = await supabase
          .from('user_settings')
          .select('language, two_factor_enabled, two_factor_method')
          .eq('user_id', arm.manager_user_id)
          .single()

        if (userSet) {
          setGeneralSettings({
            language: userSet.language || 'ar',
            two_factor_enabled: userSet.two_factor_enabled || false,
            two_factor_method: userSet.two_factor_method || 'sms',
          })
        }
      }

    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!legalArmId) return
    setIsSaving(true)

    try {
      // حفظ إعدادات استقبال الطلبات
      const { error: err1 } = await supabase
        .from('legal_arms')
        .update({
          auto_accept: requestSettings.auto_accept,
          max_concurrent_cases: requestSettings.max_concurrent_cases,
        })
        .eq('id', legalArmId)

      // حفظ إعدادات الإشعارات
      const { error: err2 } = await supabase
        .from('legal_arm_notification_settings')
        .upsert({
          legal_arm_id: legalArmId,
          ...notifSettings,
          ...channelSettings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'legal_arm_id' })

      // حفظ إعدادات التذكيرات
      const { error: err3 } = await supabase
        .from('legal_arm_reminder_preferences')
        .upsert({
          legal_arm_id: legalArmId,
          ...reminderSettings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'legal_arm_id' })

      // حفظ الإعدادات العامة
      const { data: arm } = await supabase
        .from('legal_arms')
        .select('manager_user_id')
        .eq('id', legalArmId)
        .single()

      if (arm?.manager_user_id) {
        await supabase
          .from('user_settings')
          .upsert({
            user_id: arm.manager_user_id,
            language: generalSettings.language,
            two_factor_enabled: generalSettings.two_factor_enabled,
            two_factor_method: generalSettings.two_factor_method,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
      }

      // تسجيل في activity_logs
      await supabase.from('activity_logs').insert({
        user_id: legalArmId,
        user_type: 'legal_arm_manager',
        activity_type: 'settings_updated',
        description: 'تم تحديث إعدادات الذراع القانوني',
        entity_type: 'settings',
        legal_arm_id: legalArmId,
        metadata: { updated_sections: ['general', 'requests', 'notifications', 'reminders', 'channels'] }
      })

      if (err1 || err2 || err3) throw new Error('خطأ في الحفظ')

      toast.success('✅ تم حفظ الإعدادات بنجاح')
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('حدث خطأ في الحفظ')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('exolex_legal_arm_id')
    router.push('/auth/legal-arm-login')
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid #8b5cf6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#64748b' }}>جاري التحميل...</p>
        </div>
        <style jsx>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>

      {/* Header */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>⚙️ الإعدادات</h1>
          <p style={{ color: '#64748b', marginTop: 4 }}>تخصيص إعدادات حسابك وتفضيلاتك</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={isSaving}
          style={{ padding: '10px 24px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, opacity: isSaving ? 0.6 : 1 }}
        >
          {isSaving ? '⏳ جاري الحفظ...' : '✅ حفظ الإعدادات'}
        </button>
      </div>

      {/* التبويبات */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
          {[
            { key: 'general', label: 'عام', icon: '🔧' },
            { key: 'requests', label: 'استقبال الطلبات', icon: '📥' },
            { key: 'notifications', label: 'الإشعارات', icon: '🔔' },
            { key: 'reminders', label: 'التذكيرات', icon: '⏰' },
            { key: 'channels', label: 'قنوات الإرسال', icon: '📡' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                flex: 1,
                padding: '14px 16px',
                border: 'none',
                background: activeTab === tab.key ? '#f3e8ff' : 'transparent',
                borderBottom: activeTab === tab.key ? '3px solid #8b5cf6' : '3px solid transparent',
                color: activeTab === tab.key ? '#8b5cf6' : '#64748b',
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: 'pointer',
                fontSize: 14,
                whiteSpace: 'nowrap'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* المحتوى */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

        {/* ═══ عام ═══ */}
        {activeTab === 'general' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 }}>🔧 الإعدادات العامة</h2>

            {/* اللغة */}
            <div style={{ padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontWeight: 500, color: '#1e293b', margin: 0 }}>🌐 لغة الواجهة</p>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>اختر لغة عرض التطبيق</p>
              </div>
              <select
                value={generalSettings.language}
                onChange={(e) => setGeneralSettings({ ...generalSettings, language: e.target.value })}
                style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* المصادقة الثنائية */}
            <div style={{ padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 500, color: '#1e293b', margin: 0 }}>🔐 المصادقة الثنائية</p>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>حماية إضافية لحسابك</p>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: 50, height: 26 }}>
                  <input
                    type="checkbox"
                    checked={generalSettings.two_factor_enabled}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, two_factor_enabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: generalSettings.two_factor_enabled ? '#8b5cf6' : '#cbd5e1',
                    borderRadius: 26, transition: '0.3s'
                  }}>
                    <span style={{
                      position: 'absolute', height: 20, width: 20, left: generalSettings.two_factor_enabled ? 26 : 4, bottom: 3,
                      backgroundColor: 'white', borderRadius: '50%', transition: '0.3s'
                    }}></span>
                  </span>
                </label>
              </div>
              {generalSettings.two_factor_enabled && (
                <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
                  {['sms', 'whatsapp', 'email'].map(method => (
                    <label key={method} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="2fa"
                        value={method}
                        checked={generalSettings.two_factor_method === method}
                        onChange={() => setGeneralSettings({ ...generalSettings, two_factor_method: method })}
                      />
                      <span style={{ fontSize: 14 }}>{method === 'sms' ? '📱 SMS' : method === 'whatsapp' ? '💚 واتساب' : '📧 البريد'}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* تسجيل الخروج */}
            <div style={{ paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={handleLogout}
                style={{ padding: '10px 20px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
              >
                🚪 تسجيل الخروج
              </button>
            </div>
          </div>
        )}

        {/* ═══ استقبال الطلبات ═══ */}
        {activeTab === 'requests' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 }}>📥 إعدادات استقبال الطلبات</h2>

            {/* ملاحظة الكرسي المضمون */}
            <div style={{ padding: 16, backgroundColor: '#f3e8ff', borderRadius: 12, marginBottom: 20, border: '1px solid #c4b5fd' }}>
              <p style={{ fontSize: 14, color: '#6d28d9', margin: 0 }}>
                ⚖️ <strong>الكرسي المضمون:</strong> الذراع القانوني لا يمكنه إيقاف استقبال الطلبات مؤقتاً لضمان الخدمة المستمرة للمشتركين.
              </p>
            </div>

            {/* قبول تلقائي */}
            <div style={{ padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontWeight: 500, color: '#1e293b', margin: 0 }}>⚡ قبول تلقائي</p>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>قبول الطلبات الجديدة تلقائياً</p>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: 50, height: 26 }}>
                <input
                  type="checkbox"
                  checked={requestSettings.auto_accept}
                  onChange={(e) => setRequestSettings({ ...requestSettings, auto_accept: e.target.checked })}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: requestSettings.auto_accept ? '#10b981' : '#cbd5e1',
                  borderRadius: 26, transition: '0.3s'
                }}>
                  <span style={{
                    position: 'absolute', height: 20, width: 20, left: requestSettings.auto_accept ? 26 : 4, bottom: 3,
                    backgroundColor: 'white', borderRadius: '50%', transition: '0.3s'
                  }}></span>
                </span>
              </label>
            </div>

            {/* الحد الأقصى */}
            <div style={{ padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontWeight: 500, color: '#1e293b', margin: 0 }}>📊 الحد الأقصى للقضايا المتزامنة</p>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>أقصى عدد قضايا نشطة في نفس الوقت</p>
              </div>
              <input
                type="number"
                min="1"
                max="200"
                value={requestSettings.max_concurrent_cases}
                onChange={(e) => setRequestSettings({ ...requestSettings, max_concurrent_cases: parseInt(e.target.value) || 20 })}
                style={{ width: 80, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, textAlign: 'center' }}
              />
            </div>
          </div>
        )}

        {/* ═══ الإشعارات ═══ */}
        {activeTab === 'notifications' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 }}>🔔 إعدادات الإشعارات</h2>

            {/* القضايا والملفات */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#475569', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 28, height: 28, backgroundColor: '#f3e8ff', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📋</span>
                القضايا والملفات
              </h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { key: 'notify_case_opened', label: 'فتح قضية جديدة', icon: '📂' },
                  { key: 'notify_case_closed', label: 'إغلاق قضية', icon: '✅' },
                  { key: 'notify_case_document_uploaded', label: 'رفع مستند', icon: '📄' },
                  { key: 'notify_case_memo_uploaded', label: 'رفع مذكرة', icon: '📝' },
                  { key: 'notify_case_updated', label: 'تحديث على قضية', icon: '🔄' },
                  { key: 'notify_case_collaboration_request', label: 'طلب إشراك محامي', icon: '👥' },
                  { key: 'notify_poa_issued', label: 'إصدار وكالة', icon: '📜' },
                ].map(item => (
                  <NotificationToggle
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    checked={notifSettings[item.key as keyof typeof notifSettings] as boolean}
                    onChange={(val) => setNotifSettings({ ...notifSettings, [item.key]: val })}
                    color="#8b5cf6"
                  />
                ))}
              </div>
            </div>

            {/* عروض الأسعار */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#475569', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 28, height: 28, backgroundColor: '#dcfce7', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💰</span>
                عروض الأسعار
              </h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { key: 'notify_quote_submitted', label: 'إرسال عرض سعر جديد', icon: '📤' },
                  { key: 'notify_quote_pending_review', label: 'عرض بانتظار المراجعة', icon: '⏳' },
                  { key: 'notify_quote_approved', label: 'اعتماد عرض سعر', icon: '✅' },
                  { key: 'notify_quote_awarded', label: 'ترسية عرض سعر', icon: '🏆' },
                  { key: 'notify_quote_rejected', label: 'رفض عرض سعر', icon: '❌' },
                ].map(item => (
                  <NotificationToggle
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    checked={notifSettings[item.key as keyof typeof notifSettings] as boolean}
                    onChange={(val) => setNotifSettings({ ...notifSettings, [item.key]: val })}
                    color="#8b5cf6"
                  />
                ))}
              </div>
            </div>

            {/* الطلبات والاستشارات */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#475569', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 28, height: 28, backgroundColor: '#fef3c7', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📝</span>
                الطلبات والاستشارات
              </h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { key: 'notify_new_request', label: 'طلب جديد من المنصة', icon: '🆕' },
                  { key: 'notify_request_replied', label: 'تم الرد على طلب', icon: '💬' },
                  { key: 'notify_request_delayed', label: 'تأخر في تنفيذ طلب ⚠️', icon: '⏰' },
                  { key: 'notify_consultation_new', label: 'استشارة جديدة', icon: '🎯' },
                  { key: 'notify_consultation_completed', label: 'اكتمال استشارة', icon: '✅' },
                ].map(item => (
                  <NotificationToggle
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    checked={notifSettings[item.key as keyof typeof notifSettings] as boolean}
                    onChange={(val) => setNotifSettings({ ...notifSettings, [item.key]: val })}
                    color="#8b5cf6"
                  />
                ))}
              </div>
            </div>

            {/* المواعيد والجلسات */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#475569', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 28, height: 28, backgroundColor: '#f3e8ff', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📅</span>
                المواعيد والجلسات
              </h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { key: 'notify_session_added', label: 'إضافة جلسة جديدة', icon: '➕' },
                  { key: 'notify_session_postponed', label: 'تأجيل جلسة', icon: '📆' },
                  { key: 'notify_session_reminder', label: 'تذكير بجلسة قادمة', icon: '🔔' },
                  { key: 'notify_session_result', label: 'تسجيل نتيجة جلسة', icon: '📋' },
                ].map(item => (
                  <NotificationToggle
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    checked={notifSettings[item.key as keyof typeof notifSettings] as boolean}
                    onChange={(val) => setNotifSettings({ ...notifSettings, [item.key]: val })}
                    color="#8b5cf6"
                  />
                ))}
              </div>
            </div>

            {/* المالية */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#475569', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 28, height: 28, backgroundColor: '#dcfce7', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💵</span>
                المالية
              </h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { key: 'notify_payment_received', label: 'دفعة واردة', icon: '💰' },
                  { key: 'notify_commission_transferred', label: 'عمولة محولة للحساب', icon: '🏦' },
                  { key: 'notify_invoice_due', label: 'فاتورة مستحقة', icon: '📃' },
                ].map(item => (
                  <NotificationToggle
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    checked={notifSettings[item.key as keyof typeof notifSettings] as boolean}
                    onChange={(val) => setNotifSettings({ ...notifSettings, [item.key]: val })}
                    color="#8b5cf6"
                  />
                ))}
              </div>
            </div>

            {/* التنبيهات */}
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#475569', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 28, height: 28, backgroundColor: '#fee2e2', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚠️</span>
                التنبيهات والتحذيرات
              </h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { key: 'notify_license_expiry', label: 'انتهاء رخصة محامي', icon: '📜' },
                  { key: 'notify_contract_expiry', label: 'انتهاء عقد شراكة', icon: '📄' },
                  { key: 'notify_max_cases_exceeded', label: 'تجاوز الحد الأقصى للقضايا', icon: '📊' },
                ].map(item => (
                  <NotificationToggle
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    checked={notifSettings[item.key as keyof typeof notifSettings] as boolean}
                    onChange={(val) => setNotifSettings({ ...notifSettings, [item.key]: val })}
                    color="#8b5cf6"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ التذكيرات ═══ */}
        {activeTab === 'reminders' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 }}>⏰ إعدادات التذكيرات</h2>

            {/* أوقات التذكير */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#475569', marginBottom: 12 }}>🕐 متى تريد التذكير؟</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                {[
                  { key: 'remind_2_days_before', label: 'قبل يومين' },
                  { key: 'remind_1_day_before', label: 'قبل يوم' },
                  { key: 'remind_8_hours_before', label: 'قبل 8 ساعات' },
                  { key: 'remind_2_hours_before', label: 'قبل ساعتين' },
                  { key: 'remind_1_hour_before', label: 'قبل ساعة' },
                ].map(item => (
                  <label
                    key={item.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                      backgroundColor: reminderSettings[item.key as keyof typeof reminderSettings] ? '#f3e8ff' : '#f8fafc',
                      border: reminderSettings[item.key as keyof typeof reminderSettings] ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                      borderRadius: 8, cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={reminderSettings[item.key as keyof typeof reminderSettings] as boolean}
                      onChange={(e) => setReminderSettings({ ...reminderSettings, [item.key]: e.target.checked })}
                    />
                    <span style={{ fontSize: 13 }}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* قائمة التحقق */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#475569', marginBottom: 12 }}>✅ قائمة التحقق (تظهر في التذكير)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {[
                  { key: 'remind_poa_number', label: '📜 رقم الوكالة' },
                  { key: 'remind_formal_dress', label: '👔 اللباس الرسمي' },
                  { key: 'remind_read_memos', label: '📖 قراءة المذكرات' },
                  { key: 'remind_upload_memos', label: '📤 رفع المذكرات' },
                  { key: 'remind_bring_witnesses', label: '👥 إحضار الشهود' },
                  { key: 'remind_client_attendance', label: '👤 حضور العميل' },
                ].map(item => (
                  <label
                    key={item.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                      backgroundColor: reminderSettings[item.key as keyof typeof reminderSettings] ? '#dcfce7' : '#f8fafc',
                      border: reminderSettings[item.key as keyof typeof reminderSettings] ? '2px solid #10b981' : '1px solid #e2e8f0',
                      borderRadius: 8, cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={reminderSettings[item.key as keyof typeof reminderSettings] as boolean}
                      onChange={(e) => setReminderSettings({ ...reminderSettings, [item.key]: e.target.checked })}
                    />
                    <span style={{ fontSize: 13 }}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* تذكير الاستئناف */}
            <div style={{ padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p style={{ fontWeight: 500, color: '#1e293b', margin: 0 }}>⚖️ تذكير مواعيد الاستئناف</p>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>تذكير قبل انتهاء مدة الاستئناف</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ position: 'relative', display: 'inline-block', width: 50, height: 26 }}>
                  <input
                    type="checkbox"
                    checked={reminderSettings.remind_appeal_deadline}
                    onChange={(e) => setReminderSettings({ ...reminderSettings, remind_appeal_deadline: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: reminderSettings.remind_appeal_deadline ? '#8b5cf6' : '#cbd5e1',
                    borderRadius: 26, transition: '0.3s'
                  }}>
                    <span style={{
                      position: 'absolute', height: 20, width: 20, left: reminderSettings.remind_appeal_deadline ? 26 : 4, bottom: 3,
                      backgroundColor: 'white', borderRadius: '50%', transition: '0.3s'
                    }}></span>
                  </span>
                </label>
                {reminderSettings.remind_appeal_deadline && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, color: '#64748b' }}>قبل</span>
                    <input
                      type="number"
                      value={reminderSettings.appeal_reminder_days_before}
                      onChange={(e) => setReminderSettings({ ...reminderSettings, appeal_reminder_days_before: parseInt(e.target.value) || 7 })}
                      style={{ width: 60, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'center' }}
                      min="1"
                      max="30"
                    />
                    <span style={{ fontSize: 14, color: '#64748b' }}>يوم</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ قنوات الإرسال ═══ */}
        {activeTab === 'channels' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 }}>📡 قنوات الإرسال</h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>اختر كيف تريد استقبال الإشعارات والتذكيرات</p>

            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { key: 'push', label: 'إشعارات التطبيق', icon: '📱', desc: 'إشعارات فورية في التطبيق' },
                { key: 'sms', label: 'رسائل SMS', icon: '💬', desc: 'رسائل نصية على الجوال' },
                { key: 'email', label: 'البريد الإلكتروني', icon: '📧', desc: 'إشعارات على بريدك' },
                { key: 'whatsapp', label: 'واتساب', icon: '💚', desc: 'رسائل على واتساب' },
              ].map(channel => (
                <div
                  key={channel.key}
                  style={{
                    padding: 16, borderRadius: 12,
                    backgroundColor: channelSettings[`notify_via_${channel.key}` as keyof typeof channelSettings] ? '#f3e8ff' : '#f8fafc',
                    border: channelSettings[`notify_via_${channel.key}` as keyof typeof channelSettings] ? '2px solid #8b5cf6' : '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 28 }}>{channel.icon}</span>
                      <div>
                        <p style={{ fontWeight: 500, color: '#1e293b', margin: 0 }}>{channel.label}</p>
                        <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>{channel.desc}</p>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={channelSettings[`notify_via_${channel.key}` as keyof typeof channelSettings] as boolean}
                        onChange={(e) => setChannelSettings({ ...channelSettings, [`notify_via_${channel.key}`]: e.target.checked })}
                      />
                      <span style={{ fontSize: 13 }}>🔔 الإشعارات</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={channelSettings[`remind_via_${channel.key}` as keyof typeof channelSettings] as boolean}
                        onChange={(e) => setChannelSettings({ ...channelSettings, [`remind_via_${channel.key}`]: e.target.checked })}
                      />
                      <span style={{ fontSize: 13 }}>⏰ التذكيرات</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, padding: 16, backgroundColor: '#f3e8ff', borderRadius: 12, border: '1px solid #c4b5fd' }}>
              <p style={{ fontSize: 13, color: '#6d28d9', margin: 0 }}>
                💡 <strong>ملاحظة:</strong> خدمات SMS والواتساب قد تكون مدفوعة حسب استخدامك. يُنصح بتفعيل إشعارات التطبيق كخيار أساسي.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* زر الحفظ السفلي */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <button
          onClick={saveSettings}
          disabled={isSaving}
          style={{ padding: '14px 48px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer', fontSize: 16, fontWeight: 600, opacity: isSaving ? 0.6 : 1, boxShadow: '0 4px 6px rgba(139,92,246,0.3)' }}
        >
          {isSaving ? '⏳ جاري الحفظ...' : '✅ حفظ جميع الإعدادات'}
        </button>
      </div>

    </div>
  )
}

// ═══ مكون Toggle للإشعارات ═══
function NotificationToggle({ label, icon, checked, onChange, color = '#8b5cf6' }: { label: string; icon: string; checked: boolean; onChange: (val: boolean) => void; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>{icon}</span>
        <span style={{ fontSize: 14, color: '#334155' }}>{label}</span>
      </div>
      <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span style={{
          position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: checked ? color : '#cbd5e1',
          borderRadius: 24, transition: '0.3s'
        }}>
          <span style={{
            position: 'absolute', height: 18, width: 18, left: checked ? 22 : 4, bottom: 3,
            backgroundColor: 'white', borderRadius: '50%', transition: '0.3s'
          }}></span>
        </span>
      </label>
    </div>
  )
}
