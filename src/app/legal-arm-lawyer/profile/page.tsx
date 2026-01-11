'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// 📌 صفحة ملفي - محامي الذراع القانوني
// 📅 تاريخ الإنشاء: 12 يناير 2026
// ═══════════════════════════════════════════════════════════════

interface LawyerProfile {
  id: string
  full_name: string
  lawyer_code: string
  phone: string
  email: string
  license_number: string
  license_expiry: string
  specializations: string[]
  experience_years: number
  bio: string
  languages: string[]
  avg_rating: number
  rating_count: number
  status: string
  legal_arm_name: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<LawyerProfile | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    bio: '',
    languages: [] as string[]
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const lawyerId = localStorage.getItem('exolex_lawyer_id')
    const legalArmId = localStorage.getItem('exolex_legal_arm_id')
    
    if (!lawyerId) {
      router.push('/auth/lawyer-login')
      return
    }

    try {
      const { data: lawyer, error } = await supabase
        .from('lawyers')
        .select('*')
        .eq('id', lawyerId)
        .single()

      if (error) throw error

      // جلب اسم الذراع القانوني
      let armName = ''
      if (legalArmId) {
        const { data: arm } = await supabase
          .from('legal_arms')
          .select('name_ar')
          .eq('id', legalArmId)
          .single()
        armName = arm?.name_ar || ''
      }

      setProfile({
        id: lawyer.id,
        full_name: lawyer.full_name || '',
        lawyer_code: lawyer.lawyer_code || '',
        phone: lawyer.phone || '',
        email: lawyer.email || '',
        license_number: lawyer.license_number || '',
        license_expiry: lawyer.license_expiry || '',
        specializations: lawyer.specializations || [],
        experience_years: lawyer.experience_years || 0,
        bio: lawyer.bio || '',
        languages: lawyer.languages || ['ar'],
        avg_rating: lawyer.avg_rating || 0,
        rating_count: lawyer.rating_count || 0,
        status: lawyer.status || 'active',
        legal_arm_name: armName
      })

      setFormData({
        phone: lawyer.phone || '',
        email: lawyer.email || '',
        bio: lawyer.bio || '',
        languages: lawyer.languages || ['ar']
      })

    } catch (err) {
      console.error(err)
      toast.error('خطأ في تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('lawyers')
        .update({
          phone: formData.phone,
          email: formData.email,
          bio: formData.bio,
          languages: formData.languages
        })
        .eq('id', profile.id)

      if (error) throw error

      toast.success('✅ تم حفظ التغييرات')
      setEditMode(false)
      loadProfile()
    } catch (err) {
      console.error(err)
      toast.error('خطأ في حفظ البيانات')
    } finally {
      setSaving(false)
    }
  }

  const getSpecializationAr = (spec: string) => {
    const specs: Record<string, string> = {
      labor: 'عمالي', family: 'أسري', commercial: 'تجاري', criminal: 'جنائي',
      real_estate: 'عقاري', administrative: 'إداري', insurance: 'تأميني'
    }
    return specs[spec] || spec
  }

  const getLanguageAr = (lang: string) => {
    const langs: Record<string, string> = {
      ar: 'العربية', en: 'الإنجليزية', ur: 'الأردية', tl: 'التاغالوغ'
    }
    return langs[lang] || lang
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">لم يتم العثور على بيانات الملف الشخصي</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
              <span className="text-4xl">👤</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{profile.full_name}</h1>
              <p className="text-gray-500">{profile.lawyer_code}</p>
              <p className="text-sm text-amber-600 mt-1">{profile.legal_arm_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold text-amber-600">{profile.avg_rating.toFixed(1)}</span>
                <span className="text-amber-500">⭐</span>
              </div>
              <p className="text-xs text-gray-500">{profile.rating_count} تقييم</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              profile.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {profile.status === 'active' ? 'نشط' : 'غير نشط'}
            </span>
          </div>
        </div>
      </div>

      {/* المعلومات الأساسية */}
      <div className="grid grid-cols-2 gap-6">
        
        {/* معلومات الاتصال */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">📞 معلومات الاتصال</h2>
            {!editMode && (
              <button 
                onClick={() => setEditMode(true)}
                className="text-amber-600 hover:text-amber-700 text-sm font-medium"
              >
                تعديل
              </button>
            )}
          </div>
          
          {editMode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الجوال</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نبذة عني</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg font-medium disabled:opacity-50"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ'}
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">الجوال</span>
                <span className="font-medium" dir="ltr">{profile.phone || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">البريد</span>
                <span className="font-medium" dir="ltr">{profile.email || '-'}</span>
              </div>
              {profile.bio && (
                <div className="pt-2">
                  <span className="text-gray-500 block mb-1">نبذة</span>
                  <p className="text-gray-700">{profile.bio}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* معلومات الترخيص */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📜 معلومات الترخيص</h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">رقم الرخصة</span>
              <span className="font-medium">{profile.license_number || '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">تاريخ الانتهاء</span>
              <span className="font-medium">
                {profile.license_expiry ? new Date(profile.license_expiry).toLocaleDateString('ar-SA') : '-'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">سنوات الخبرة</span>
              <span className="font-medium">{profile.experience_years} سنة</span>
            </div>
          </div>
        </div>
      </div>

      {/* التخصصات واللغات */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">⚖️ التخصصات</h2>
          <div className="flex flex-wrap gap-2">
            {profile.specializations.length > 0 ? (
              profile.specializations.map((spec, i) => (
                <span key={i} className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium">
                  {getSpecializationAr(spec)}
                </span>
              ))
            ) : (
              <p className="text-gray-500">لم يتم تحديد تخصصات</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">🌐 اللغات</h2>
          <div className="flex flex-wrap gap-2">
            {profile.languages.map((lang, i) => (
              <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                {getLanguageAr(lang)}
              </span>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
