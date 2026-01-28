'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const NATIONALITIES = [
  { code: 'SA', name: 'السعودية' },
  { code: 'EG', name: 'مصر' },
  { code: 'PK', name: 'باكستان' },
  { code: 'IN', name: 'الهند' },
  { code: 'BD', name: 'بنغلاديش' },
  { code: 'PH', name: 'الفلبين' },
  { code: 'ID', name: 'إندونيسيا' },
  { code: 'JO', name: 'الأردن' },
  { code: 'SY', name: 'سوريا' },
  { code: 'YE', name: 'اليمن' },
  { code: 'SD', name: 'السودان' },
  { code: 'OTHER', name: 'أخرى' },
]

const CITIES = [
  'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام',
  'الخبر', 'الظهران', 'الأحساء', 'الطائف', 'تبوك', 'بريدة',
  'خميس مشيط', 'حائل', 'نجران', 'جازان', 'أبها', 'الجبيل', 'ينبع', 'القطيف'
]

export default function CompleteProfilePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [documentType, setDocumentType] = useState('')

  const [formData, setFormData] = useState({
    full_name: '',
    full_name_en: '',
    nationality: '',
    gender: '',
    age_range: '',
    document_expiry: '',
    city: '',
    profession: '',
    address: '',
    marital_status: '',
    email: '',
    native_language: '',
    preferred_language: 'ar',
  })

  const [agreements, setAgreements] = useState({
    age: false,
    terms: false,
    privacy: false,
  })

  useEffect(() => {
    // Get user ID from URL params (passed from login page)
    const urlUserId = searchParams.get('uid')

    if (!urlUserId) {
      router.push('/auth/login')
      return
    }

    setUserId(urlUserId)

    // Fetch user data from database
    const fetchUser = async () => {
      const { data } = await supabase
        .from('users')
        .select('national_id, document_type, subscriber_type, phone')
        .eq('id', urlUserId)
        .single()

      if (data) {
        setNationalId(data.national_id || '')
        setDocumentType(data.document_type || '')
        setPhone(data.phone || '')
      }
    }
    fetchUser()
  }, [router, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!agreements.age || !agreements.terms || !agreements.privacy) {
      toast.error('يرجى الموافقة على جميع الإقرارات')
      return
    }

    if (!formData.full_name || !formData.gender || !formData.city) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          full_name_en: formData.full_name_en,
          nationality: formData.nationality,
          gender: formData.gender,
          age_range: formData.age_range,
          document_expiry: formData.document_expiry || null,
          city: formData.city,
          profession: formData.profession,
          address: formData.address,
          marital_status: formData.marital_status,
          email: formData.email,
          native_language: formData.native_language,
          preferred_language: formData.preferred_language,
          is_profile_complete: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) throw error

      toast.success('تم حفظ البيانات بنجاح')
      router.push('/subscriber/dashboard')
    } catch (error) {
      toast.error('حدث خطأ في حفظ البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const getMaritalOptions = () => {
    if (formData.gender === 'female') {
      return [
        { value: 'single', label: 'عزباء' },
        { value: 'married', label: 'متزوجة' },
        { value: 'divorced', label: 'مطلقة' },
        { value: 'widowed', label: 'أرملة' },
      ]
    }
    return [
      { value: 'single', label: 'أعزب' },
      { value: 'married', label: 'متزوج' },
      { value: 'divorced', label: 'مطلق' },
      { value: 'widowed', label: 'أرمل' },
    ]
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">إكمال بيانات الحساب</h1>
          <p className="text-gray-500 mt-2">يرجى إكمال بياناتك للمتابعة</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
          
          {/* البيانات الثابتة */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-700 mb-3">🔒 بيانات ثابتة</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">رقم الهوية:</span>
                <span className="font-mono mr-2">{nationalId}</span>
              </div>
              <div>
                <span className="text-gray-400">رقم الجوال:</span>
                <span className="font-mono mr-2" dir="ltr">+966 {phone}</span>
              </div>
            </div>
          </div>

          {/* الاسم */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الاسم الكامل (عربي) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
                placeholder="الاسم كما في الهوية"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الاسم الكامل (إنجليزي)
              </label>
              <input
                type="text"
                value={formData.full_name_en}
                onChange={(e) => setFormData({...formData, full_name_en: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
                placeholder="Full name as in ID"
                dir="ltr"
              />
            </div>
          </div>

          {/* الجنسية والجنس */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الجنسية <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.nationality}
                onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">اختر الجنسية</option>
                {NATIONALITIES.map((n) => (
                  <option key={n.code} value={n.code}>{n.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الجنس <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value="male"
                    checked={formData.gender === 'male'}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span>ذكر</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value="female"
                    checked={formData.gender === 'female'}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span>أنثى</span>
                </label>
              </div>
            </div>
          </div>

          {/* العمر وانتهاء الهوية */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الفئة العمرية <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.age_range}
                onChange={(e) => setFormData({...formData, age_range: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">اختر</option>
                <option value="18-25">18 - 25 سنة</option>
                <option value="26-35">26 - 35 سنة</option>
                <option value="36-40">36 - 40 سنة</option>
                <option value="above_40">أكثر من 40 سنة</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                تاريخ انتهاء الهوية
              </label>
              <input
                type="date"
                value={formData.document_expiry}
                onChange={(e) => setFormData({...formData, document_expiry: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* المدينة والمهنة */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                المدينة <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">اختر المدينة</option>
                {CITIES.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                المهنة
              </label>
              <input
                type="text"
                value={formData.profession}
                onChange={(e) => setFormData({...formData, profession: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
                placeholder="مثال: مهندس، محاسب..."
              />
            </div>
          </div>

          {/* العنوان */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              العنوان (اختياري)
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
              placeholder="الحي، الشارع..."
            />
          </div>

          {/* الحالة الاجتماعية */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              الحالة الاجتماعية
            </label>
            <select
              value={formData.marital_status}
              onChange={(e) => setFormData({...formData, marital_status: e.target.value})}
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
            >
              <option value="">اختر</option>
              {getMaritalOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* البريد الإلكتروني */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
              placeholder="example@email.com"
              dir="ltr"
            />
            <p className="text-xs text-gray-400 mt-1">⚠️ سيُرسل رمز تحقق للبريد لاحقاً</p>
          </div>

          {/* اللغات */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                اللغة الأم
              </label>
              <select
                value={formData.native_language}
                onChange={(e) => setFormData({...formData, native_language: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
              >
                <option value="">اختر</option>
                <option value="ar">العربية</option>
                <option value="en">English</option>
                <option value="ur">اردو</option>
                <option value="tl">Tagalog</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                اللغة المفضلة للتواصل
              </label>
              <select
                value={formData.preferred_language}
                onChange={(e) => setFormData({...formData, preferred_language: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
                <option value="ur">اردو</option>
                <option value="tl">Tagalog</option>
              </select>
            </div>
          </div>

          {/* الإقرارات */}
          <div className="bg-amber-50 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-gray-700">📋 الإقرارات المطلوبة</h3>
            
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreements.age}
                onChange={(e) => setAgreements({...agreements, age: e.target.checked})}
                className="w-5 h-5 mt-0.5 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">
                أقر بأن عمري 18 سنة أو أكثر <span className="text-red-500">*</span>
              </span>
            </label>
            
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreements.terms}
                onChange={(e) => setAgreements({...agreements, terms: e.target.checked})}
                className="w-5 h-5 mt-0.5 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">
                أوافق على <a href="/terms" className="text-primary-600 hover:underline">الشروط والأحكام</a> <span className="text-red-500">*</span>
              </span>
            </label>
            
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreements.privacy}
                onChange={(e) => setAgreements({...agreements, privacy: e.target.checked})}
                className="w-5 h-5 mt-0.5 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">
                أوافق على <a href="/privacy" className="text-primary-600 hover:underline">سياسة الخصوصية</a> <span className="text-red-500">*</span>
              </span>
            </label>
          </div>

          {/* زر الحفظ */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-600 text-white py-3 rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors font-medium"
          >
            {isLoading ? '⏳ جاري الحفظ...' : '✓ حفظ ومتابعة'}
          </button>
        </form>
      </div>
    </div>
  )
}
