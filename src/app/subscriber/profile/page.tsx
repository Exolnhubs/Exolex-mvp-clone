'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logoutMember } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import toast from 'react-hot-toast'

interface User {
  id: string
  full_name: string
  full_name_en?: string
  phone: string
  email: string
  national_id: string
  id_type: string
  nationality: string
  gender: string
  date_of_birth?: string
  marital_status?: string
  profession?: string
  city?: string
  address?: string
  national_address?: string
  preferred_language?: string
  native_language?: string
  profile_image?: string
  avatar_url?: string
  national_id_expiry?: string
  phone_verified?: boolean
  email_verified?: boolean
  created_at?: string
}

interface Subscription {
  id: string
  plan_type: string
  status: string
  start_date: string
  end_date: string
  consultations_used: number
  consultations_total: number
  cases_used: number
  cases_total: number
  library_searches_used: number
  library_searches_total: number
}

interface PersonalDocument {
  id: string
  document_type: string
  document_name?: string
  file_url: string
  file_name: string
  file_size?: number
  file_type?: string
  status: 'pending' | 'verified' | 'rejected'
  rejection_reason?: string
  expiry_date?: string
  is_system_generated: boolean
  created_at: string
}

const PLAN_DETAILS: Record<string, { name: string; nameAr: string; color: string; bgColor: string; gradient: string; icon: string; consultations: number; cases: number; library: number; sla: string; discount: number }> = {
  'exo': { name: 'Exo', nameAr: 'إكسو', color: 'text-blue-600', bgColor: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600', icon: '🔵', consultations: 3, cases: 1, library: 30, sla: '36 ساعة', discount: 10 },
  'plus': { name: 'Plus', nameAr: 'بلس', color: 'text-purple-600', bgColor: 'bg-purple-500', gradient: 'from-purple-500 to-indigo-600', icon: '🟣', consultations: 6, cases: 2, library: 60, sla: '24 ساعة', discount: 15 },
  'pro': { name: 'Pro', nameAr: 'برو', color: 'text-amber-600', bgColor: 'bg-amber-500', gradient: 'from-amber-500 to-orange-600', icon: '🟡', consultations: 10, cases: 3, library: 100, sla: '12 ساعة', discount: 20 },
}

const DOCUMENT_TYPES = [
  { value: 'national_id', label: 'هوية وطنية', icon: '🪪' },
  { value: 'iqama', label: 'إقامة', icon: '🪪' },
  { value: 'national_address', label: 'العنوان الوطني', icon: '📍' },
  { value: 'subscription_certificate', label: 'وثيقة الاشتراك', icon: '📜' },
  { value: 'passport', label: 'جواز سفر', icon: '🛂' },
  { value: 'power_of_attorney', label: 'وكالة', icon: '📋' },
  { value: 'birth_certificate', label: 'شهادة ميلاد', icon: '👶' },
  { value: 'other', label: 'أخرى', icon: '📄' },
]

const SAUDI_CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الطائف', 'تبوك', 'بريدة', 'خميس مشيط', 'حائل', 'نجران', 'جازان', 'أبها', 'الجبيل', 'ينبع']

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'subscription' | 'documents'>('info')
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [subscriptionHistory, setSubscriptionHistory] = useState<any[]>([])
  const [documents, setDocuments] = useState<PersonalDocument[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editedUser, setEditedUser] = useState<Partial<User>>({})
  const [isSaving, setIsSaving] = useState(false)
  
  // NOLEX Balance
  const [nolexBalance, setNolexBalance] = useState(10) // المسجل يحصل على 10 بحث مجاني
  const [nolexTotal, setNolexTotal] = useState(10)
  const [memberCode, setMemberCode] = useState<string | null>(null)
  
  // Modals
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  
  // Phone verification
  const [phoneStep, setPhoneStep] = useState(1)
  const [newPhone, setNewPhone] = useState('')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [otpMethod, setOtpMethod] = useState<'whatsapp' | 'sms'>('whatsapp')
  const [otpTimer, setOtpTimer] = useState(0)
  
  // Email verification
  const [emailStep, setEmailStep] = useState(1)
  const [newEmail, setNewEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  
  // Upload
  const [uploadType, setUploadType] = useState('national_id')
  const [customDocName, setCustomDocName] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    const userId = localStorage.getItem('exolex_user_id')
    if (!userId) { router.push('/auth/login'); return }

    const fetchData = async () => {
      // Fetch user
      const { data: userData } = await supabase.from('users').select('*').eq('id', userId).single()
      if (userData) { setUser(userData); setEditedUser(userData) }

      // Fetch member for NOLEX balance
      const { data: memberData } = await supabase.from('members').select('*').eq('user_id', userId).single()
      if (memberData) {
        // Fetch subscription
        const { data: subData } = await supabase.from('subscriptions').select('*').eq('member_id', memberData.id).eq('status', 'active').single()
        if (subData) { setIsSubscribed(true); setSubscription(subData) }
        
        // Fetch subscription history
        const { data: historyData } = await supabase.from('subscriptions').select('*').eq('member_id', memberData.id).order('created_at', { ascending: false })
        if (historyData) setSubscriptionHistory(historyData)

        // TODO: Get actual NOLEX balance from member or search_packages
        setNolexBalance(memberData.library_balance || 10)
        setMemberCode(memberData.member_code)
        setNolexTotal(10)
      }


      // Fetch personal documents
      const { data: docsData } = await supabase.from('user_personal_documents').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      if (docsData) setDocuments(docsData)

      setIsLoading(false)
    }
    fetchData()
  }, [router])

  // OTP Timer
  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [otpTimer])

  const handleLogout = () => {
    logoutMember()
  }

  const handleSaveProfile = async () => {
    if (!user) return
    setIsSaving(true)
    
    const { error } = await supabase.from('users').update({
      date_of_birth: editedUser.date_of_birth,
      marital_status: editedUser.marital_status,
      profession: editedUser.profession,
      city: editedUser.city,
      address: editedUser.address,
      national_address: editedUser.national_address,
      preferred_language: editedUser.preferred_language,
      native_language: editedUser.native_language,
      national_id_expiry: editedUser.national_id_expiry,
    }).eq('id', user.id)

    setIsSaving(false)
    if (error) {
      toast.error('حدث خطأ في حفظ البيانات')
    } else {
      setUser({ ...user, ...editedUser })
      setIsEditing(false)
      toast.success('تم حفظ التغييرات بنجاح')
    }
  }

  const maskValue = (value: string, showLast: number = 4) => {
    if (!value || value.length <= showLast) return value
    return '*'.repeat(value.length - showLast) + value.slice(-showLast)
  }

  const sendPhoneOtp = async () => {
    toast.success(`تم إرسال رمز التحقق عبر ${otpMethod === 'whatsapp' ? 'واتساب' : 'رسالة نصية'}`)
    setPhoneStep(2)
    setOtpTimer(60)
  }

  const verifyPhoneOtp = async () => {
    if (phoneStep === 2) {
      setPhoneStep(3)
    } else if (phoneStep === 4) {
      toast.success('تم تغيير رقم الجوال بنجاح')
      setShowPhoneModal(false)
      setPhoneStep(1)
      if (user) setUser({ ...user, phone: newPhone, phone_verified: true })
    }
  }

  const sendEmailCode = async () => {
    toast.success('تم إرسال رمز التحقق للبريد الجديد')
    setEmailStep(2)
  }

  const verifyEmailCode = async () => {
    toast.success('تم تغيير البريد الإلكتروني بنجاح')
    setShowEmailModal(false)
    setEmailStep(1)
    if (user) setUser({ ...user, email: newEmail, email_verified: true })
  }

  const handleUploadDocument = async () => {
    if (!uploadFile || !user) return
    
    setIsUploading(true)
    
    // Upload to Supabase Storage
    const fileExt = uploadFile.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}.${fileExt}`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-documents')
      .upload(fileName, uploadFile)
    
    if (uploadError) {
      toast.error('حدث خطأ في رفع الملف')
      setIsUploading(false)
      return
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage.from('user-documents').getPublicUrl(fileName)
    
    // Save to database
    const { data: docData, error: docError } = await supabase.from('user_personal_documents').insert({
      user_id: user.id,
      document_type: uploadType,
      document_name: uploadType === 'other' ? customDocName : null,
      file_url: urlData.publicUrl,
      file_name: uploadFile.name,
      file_size: uploadFile.size,
      file_type: fileExt,
      status: 'pending',
      is_system_generated: false,
    }).select().single()
    
    if (docError) {
      toast.error('حدث خطأ في حفظ المستند')
    } else {
      toast.success('تم رفع المستند بنجاح')
      setDocuments([docData, ...documents])
      setShowUploadModal(false)
      setUploadFile(null)
      setCustomDocName('')
    }
    
    setIsUploading(false)
  }

  const handleDeleteDocument = async (docId: string) => {
    const { error } = await supabase.from('user_personal_documents').delete().eq('id', docId)
    if (error) {
      toast.error('حدث خطأ في حذف المستند')
    } else {
      setDocuments(documents.filter(d => d.id !== docId))
      toast.success('تم حذف المستند')
    }
  }

  const getDocumentTypeLabel = (type: string) => {
    const doc = DOCUMENT_TYPES.find(d => d.value === type)
    return doc ? doc.label : type
  }

  const getDocumentTypeIcon = (type: string) => {
    const doc = DOCUMENT_TYPES.find(d => d.value === type)
    return doc ? doc.icon : '📄'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified': return { label: 'موثق ✅', color: 'bg-green-100 text-green-800' }
      case 'pending': return { label: 'قيد المراجعة ⏳', color: 'bg-amber-100 text-amber-800' }
      default: return { label: 'مرفوض ❌', color: 'bg-red-100 text-red-800' }
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('ar-SA')

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate)
    const now = new Date()
    return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  }

  const getIdTypeLabel = (type: string) => {
    switch (type) {
      case 'citizen': return 'مواطن'
      case 'resident': return 'مقيم'
      default: return type
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const plan = subscription ? PLAN_DETAILS[subscription.plan_type] || PLAN_DETAILS['exo'] : null

  // Group documents by type
  const idDocuments = documents.filter(d => ['national_id', 'iqama'].includes(d.document_type))
  const addressDocuments = documents.filter(d => d.document_type === 'national_address')
  const certificateDocuments = documents.filter(d => d.document_type === 'subscription_certificate')
  const otherDocuments = documents.filter(d => !['national_id', 'iqama', 'national_address', 'subscription_certificate'].includes(d.document_type))

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isSubscribed={isSubscribed} userName={user?.full_name || ''} onLogout={handleLogout} />

      <main className="flex-1 mr-64">
        {/* Header with Avatar - تحسين التباين */}
        <header className="bg-white shadow-sm">
          <div className="relative h-[200px] bg-gradient-to-br from-blue-600 to-indigo-700">
            <div className="absolute inset-0 bg-black/10"></div>
          </div>
          <div className="max-w-7xl mx-auto px-8">
            <div className="-mt-16 flex items-end gap-5 pb-8">
              <div className="relative">
                <div className="w-32 h-32 rounded-full ring-4 ring-white bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-4xl font-bold overflow-hidden shadow-lg">
                  {user?.avatar_url || user?.profile_image ? (
                    <img src={user.avatar_url || user.profile_image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user?.full_name?.charAt(0) || '؟'
                  )}
                </div>
                <button className="absolute bottom-1 left-1 bg-white rounded-full p-2 shadow-md hover:bg-gray-100 transition-colors">
                  📷
                </button>
              </div>
              <div className="pb-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm">
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl font-bold text-gray-900">{user?.full_name}</h1>
                  {isSubscribed && plan ? (
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${plan.bgColor} text-white shadow-sm`}>
                      {plan.icon} باقة {plan.nameAr}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-200 text-gray-700">
                      ⚠️ غير مشترك
                    </span>
                  )}
                </div>
                {memberCode && (
                  <p className="text-sm font-mono text-blue-600 mt-1">رقم المشترك: {memberCode}</p>
                )}
                <p className="text-gray-600 mt-1">{user?.email}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Tabs - ألوان مميزة لكل تبويب */}
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex items-center gap-8">
              <button
                onClick={() => setActiveTab('info')}
                className={`py-4 px-1 border-b-2 font-medium text-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'info' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className={`text-xl ${activeTab === 'info' ? '' : 'grayscale opacity-60'}`}>👤</span>
                <span className={activeTab === 'info' ? 'text-blue-600 font-bold' : ''}>معلوماتي</span>
              </button>
              <button
                onClick={() => setActiveTab('subscription')}
                className={`py-4 px-1 border-b-2 font-medium text-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'subscription' 
                    ? 'border-purple-500 text-purple-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className={`text-xl ${activeTab === 'subscription' ? '' : 'grayscale opacity-60'}`}>💎</span>
                <span className={activeTab === 'subscription' ? 'text-purple-600 font-bold' : ''}>اشتراكي</span>
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`py-4 px-1 border-b-2 font-medium text-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'documents' 
                    ? 'border-green-500 text-green-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className={`text-xl ${activeTab === 'documents' ? '' : 'grayscale opacity-60'}`}>📄</span>
                <span className={activeTab === 'documents' ? 'text-green-600 font-bold' : ''}>مستنداتي</span>
              </button>
            </div>
          </div>
        </nav>

        {/* Tab Content */}
        <div className="max-w-7xl mx-auto px-8 py-8">
          {/* معلوماتي Tab */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* المعلومات الأساسية */}
              <section className="bg-gray-100 p-6 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">المعلومات الأساسية</h2>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>🔒</span>
                    <span>هذه المعلومات غير قابلة للتعديل</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل</label>
                    <input type="text" value={user?.full_name || ''} className="w-full bg-gray-200 border-gray-300 rounded-lg px-4 py-2 text-gray-600 cursor-not-allowed" readOnly />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهوية</label>
                    <input type="text" value={maskValue(user?.national_id || '')} className="w-full bg-gray-200 border-gray-300 rounded-lg px-4 py-2 text-gray-600 cursor-not-allowed" readOnly />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">نوع الهوية</label>
                    <input type="text" value={user?.id_type === 'national_id' ? 'مواطن' : user?.id_type === 'iqama' ? 'مقيم' : user?.id_type === 'passport' ? 'جواز سفر' : user?.id_type || ''} className="w-full bg-gray-200 border-gray-300 rounded-lg px-4 py-2 text-gray-600 cursor-not-allowed" readOnly />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الجنسية</label>
                    <input type="text" value={user?.nationality === 'SA' ? 'سعودي' : user?.nationality || ''} className="w-full bg-gray-200 border-gray-300 rounded-lg px-4 py-2 text-gray-600 cursor-not-allowed" readOnly />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الجنس</label>
                    <input type="text" value={user?.gender === 'male' ? 'ذكر' : user?.gender === 'female' ? 'أنثى' : user?.gender || ''} className="w-full bg-gray-200 border-gray-300 rounded-lg px-4 py-2 text-gray-600 cursor-not-allowed" readOnly />
                  </div>
                </div>
              </section>

              {/* معلومات الاتصال */}
              <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold text-gray-800 mb-6">معلومات الاتصال</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="text-sm text-gray-500">رقم الجوال</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-lg font-medium text-gray-900" dir="ltr">{maskValue(user?.phone || '', 3)}</p>
                        {user?.phone_verified && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">✅ موثق</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setShowPhoneModal(true)} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition-colors">
                      تغيير الرقم
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="text-sm text-gray-500">البريد الإلكتروني</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-lg font-medium text-gray-900">{maskValue(user?.email || '', 10)}</p>
                        {user?.email_verified && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">✅ موثق</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setShowEmailModal(true)} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition-colors">
                      تغيير البريد
                    </button>
                  </div>
                </div>
              </section>

              {/* المعلومات الشخصية */}
              <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-800">المعلومات الشخصية</h2>
                  {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="text-gray-500 hover:text-blue-600">✏️ تعديل</button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الميلاد</label>
                    <input type="date" value={editedUser.date_of_birth || ''} onChange={(e) => setEditedUser({ ...editedUser, date_of_birth: e.target.value })} disabled={!isEditing} className={`w-full border rounded-lg px-4 py-2 ${isEditing ? 'border-gray-300' : 'bg-gray-50 border-gray-200'}`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الحالة الاجتماعية</label>
                    <select value={editedUser.marital_status || ''} onChange={(e) => setEditedUser({ ...editedUser, marital_status: e.target.value })} disabled={!isEditing} className={`w-full border rounded-lg px-4 py-2 ${isEditing ? 'border-gray-300' : 'bg-gray-50 border-gray-200'}`}>
                      <option value="">اختر</option>
                      <option value="single">أعزب</option>
                      <option value="married">متزوج</option>
                      <option value="divorced">مطلق</option>
                      <option value="widowed">أرمل</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">المهنة</label>
                    <input type="text" value={editedUser.profession || ''} onChange={(e) => setEditedUser({ ...editedUser, profession: e.target.value })} disabled={!isEditing} className={`w-full border rounded-lg px-4 py-2 ${isEditing ? 'border-gray-300' : 'bg-gray-50 border-gray-200'}`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">اللغة المفضلة</label>
                    <select value={editedUser.preferred_language || 'ar'} onChange={(e) => setEditedUser({ ...editedUser, preferred_language: e.target.value })} disabled={!isEditing} className={`w-full border rounded-lg px-4 py-2 ${isEditing ? 'border-gray-300' : 'bg-gray-50 border-gray-200'}`}>
                      <option value="ar">العربية</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">اللغة الأم</label>
                    <input type="text" value={editedUser.native_language || ''} onChange={(e) => setEditedUser({ ...editedUser, native_language: e.target.value })} disabled={!isEditing} className={`w-full border rounded-lg px-4 py-2 ${isEditing ? 'border-gray-300' : 'bg-gray-50 border-gray-200'}`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ انتهاء الهوية</label>
                    <input type="date" value={editedUser.national_id_expiry || ''} onChange={(e) => setEditedUser({ ...editedUser, national_id_expiry: e.target.value })} disabled={!isEditing} className={`w-full border rounded-lg px-4 py-2 ${isEditing ? 'border-gray-300' : 'bg-gray-50 border-gray-200'}`} />
                  </div>
                </div>
              </section>

              {/* العنوان */}
              <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold text-gray-800 mb-6">العنوان</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">المدينة</label>
                    <select value={editedUser.city || ''} onChange={(e) => setEditedUser({ ...editedUser, city: e.target.value })} disabled={!isEditing} className={`w-full border rounded-lg px-4 py-2 ${isEditing ? 'border-gray-300' : 'bg-gray-50 border-gray-200'}`}>
                      <option value="">اختر المدينة</option>
                      {SAUDI_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                    <textarea value={editedUser.address || ''} onChange={(e) => setEditedUser({ ...editedUser, address: e.target.value })} disabled={!isEditing} rows={3} className={`w-full border rounded-lg px-4 py-2 ${isEditing ? 'border-gray-300' : 'bg-gray-50 border-gray-200'}`} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">العنوان الوطني</label>
                    <input type="text" value={editedUser.national_address || ''} onChange={(e) => setEditedUser({ ...editedUser, national_address: e.target.value })} disabled={!isEditing} placeholder="مثال: RRRD1234 حي الملك فهد، الرياض 12345" className={`w-full border rounded-lg px-4 py-2 ${isEditing ? 'border-gray-300' : 'bg-gray-50 border-gray-200'}`} />
                  </div>
                </div>
              </section>

              {isEditing && (
                <div className="flex justify-end gap-3">
                  <button onClick={() => { setIsEditing(false); setEditedUser(user || {}) }} className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
                  <button onClick={handleSaveProfile} disabled={isSaving} className="px-6 py-2.5 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50">
                    {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* اشتراكي Tab */}
          {activeTab === 'subscription' && (
            <div className="space-y-6">
              {/* رصيد بحث المكتبة (NOLEX) - يظهر للجميع */}
              <section className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center text-2xl">📚</div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">رصيد بحث المكتبة (NOLEX)</h3>
                      <p className="text-sm text-gray-600">رصيدك من عمليات البحث في المكتبة القانونية</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className={`text-3xl font-bold ${nolexBalance === 0 ? 'text-red-500' : 'text-blue-600'}`}>{nolexBalance}</span>
                      <span className="text-gray-500">/ {isSubscribed && plan ? plan.library : nolexTotal}</span>
                    </div>
                    <p className="text-sm text-gray-500">{isSubscribed ? 'بحث شهرياً' : 'بحث متبقي'}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all ${nolexBalance === 0 ? 'bg-red-500' : 'bg-blue-500'}`} 
                      style={{ width: `${(nolexBalance / (isSubscribed && plan ? plan.library : nolexTotal)) * 100}%` }}
                    ></div>
                  </div>
                </div>
                {nolexBalance === 0 && (
                  <div className="mt-4 flex items-center justify-between bg-red-50 p-3 rounded-lg border border-red-200">
                    <p className="text-red-600 font-medium">⚠️ رصيدك 0 - لا يمكنك البحث في المكتبة</p>
                    <button onClick={() => router.push('/subscriber/nolex')} className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">
                      شحن الرصيد
                    </button>
                  </div>
                )}
                {nolexBalance > 0 && nolexBalance <= 3 && (
                  <div className="mt-4 flex items-center justify-between bg-amber-50 p-3 rounded-lg border border-amber-200">
                    <p className="text-amber-600 font-medium">⚠️ رصيدك منخفض</p>
                    <button onClick={() => router.push('/subscriber/nolex')} className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">
                      شحن الرصيد
                    </button>
                  </div>
                )}
              </section>

              {/* جدول الخدمات */}
              <div className="relative">
                {/* الجدول */}
                <section className={`bg-white p-6 rounded-xl shadow-sm border border-gray-200 ${!isSubscribed ? 'opacity-40 blur-[2px]' : ''}`}>
                  <h3 className="text-xl font-bold mb-6">خدمات الباقة</h3>
                  <div className="grid grid-cols-5 gap-4 text-center">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl mb-2">💬</div>
                      <p className="text-sm text-gray-500 mb-1">الاستشارات</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {isSubscribed && subscription ? `${subscription.consultations_total - subscription.consultations_used}/${subscription.consultations_total}` : '-'}
                      </p>
                      <p className="text-xs text-gray-400">سنوياً</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl mb-2">⚖️</div>
                      <p className="text-sm text-gray-500 mb-1">القضايا</p>
                      <p className="text-2xl font-bold text-green-600">
                        {isSubscribed && subscription ? `${subscription.cases_total - subscription.cases_used}/${subscription.cases_total}` : '-'}
                      </p>
                      <p className="text-xs text-gray-400">سنوياً</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl mb-2">📚</div>
                      <p className="text-sm text-gray-500 mb-1">بحث المكتبة</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {isSubscribed && plan ? plan.library : '-'}
                      </p>
                      <p className="text-xs text-gray-400">شهرياً</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl mb-2">🏷️</div>
                      <p className="text-sm text-gray-500 mb-1">خصم الخدمات</p>
                      <p className="text-2xl font-bold text-amber-600">
                        {isSubscribed && plan ? `${plan.discount}%` : '-'}
                      </p>
                      <p className="text-xs text-gray-400">على الخدمات الإضافية</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl mb-2">⏱️</div>
                      <p className="text-sm text-gray-500 mb-1">وقت الاستجابة</p>
                      <p className="text-2xl font-bold text-red-600">
                        {isSubscribed && plan ? plan.sla : '-'}
                      </p>
                      <p className="text-xs text-gray-400">SLA</p>
                    </div>
                  </div>
                </section>

                {/* Overlay للغير مشترك */}
                {!isSubscribed && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 rounded-xl">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">أنت غير مشترك في أي باقة</h3>
                    <p className="text-gray-600 mb-4">اشترك الآن للحصول على جميع المميزات</p>
                    <button onClick={() => router.push('/subscriber/subscription')} className="px-8 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors shadow-lg">
                      اشترك الآن
                    </button>
                  </div>
                )}
              </div>

              {/* باقي محتوى الاشتراك للمشتركين */}
              {isSubscribed && subscription && plan && (
                <>
                  {/* Hero Card */}
                  <section className={`p-8 rounded-xl bg-gradient-to-tr ${plan.gradient} text-white shadow-lg`}>
                    <p className="text-sm opacity-80 mb-1">باقتك الحالية</p>
                    <h2 className="text-4xl font-bold flex items-center gap-3">{plan.icon} باقة {plan.nameAr}</h2>
                    <div className="mt-6 flex justify-between items-end">
                      <div>
                        <p className="text-lg">تنتهي في: {formatDate(subscription.end_date)}</p>
                        <p className="text-sm opacity-80">({getDaysRemaining(subscription.end_date)} يوم متبقي)</p>
                      </div>
                      <div className="flex gap-4">
                        <button onClick={() => router.push('/subscriber/subscription')} className="px-6 py-2 bg-white/20 rounded-lg font-medium hover:bg-white/30 transition-colors">🔄 تجديد</button>
                        <button onClick={() => router.push('/subscriber/subscription')} className="px-6 py-2 bg-white text-gray-800 rounded-lg font-bold hover:bg-gray-100 transition-colors">⬆️ ترقية الباقة</button>
                      </div>
                    </div>
                  </section>

                  {/* سجل الاشتراكات */}
                  <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-xl font-bold mb-4">سجل الاشتراكات</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الباقة</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ البدء</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ الانتهاء</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {subscriptionHistory.map((sub, i) => (
                            <tr key={i}>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">باقة {PLAN_DETAILS[sub.plan_type]?.nameAr || sub.plan_type}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">{formatDate(sub.start_date)}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">{formatDate(sub.end_date)}</td>
                              <td className="px-6 py-4 text-sm">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${sub.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                  {sub.status === 'active' ? 'نشط' : 'منتهي'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
            </div>
          )}

          {/* مستنداتي Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <header className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">مستنداتي الشخصية</h2>
                <button onClick={() => setShowUploadModal(true)} className="px-5 py-2.5 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors">
                  📤 رفع مستند جديد
                </button>
              </header>

              {/* الهوية / الإقامة */}
              <details className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" open>
                <summary className="p-4 font-bold text-lg cursor-pointer flex items-center gap-3 hover:bg-gray-50">
                  🪪 الهوية / الإقامة
                  <span className="text-sm font-normal text-gray-500">({idDocuments.length})</span>
                </summary>
                <div className="p-4 border-t border-gray-200 space-y-3">
                  {idDocuments.length > 0 ? idDocuments.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">{getDocumentTypeIcon(doc.document_type)}</span>
                        <div>
                          <p className="font-medium">{doc.file_name}</p>
                          <p className="text-sm text-gray-500">{formatFileSize(doc.file_size)} - {formatDate(doc.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full ${getStatusBadge(doc.status).color}`}>{getStatusBadge(doc.status).label}</span>
                        <div className="flex gap-2 text-gray-500">
                          <a href={doc.file_url} target="_blank" className="hover:text-blue-600">📥</a>
                          <a href={doc.file_url} target="_blank" className="hover:text-blue-600">👁️</a>
                          {!doc.is_system_generated && <button onClick={() => handleDeleteDocument(doc.id)} className="hover:text-red-600">🗑️</button>}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-center py-4 text-gray-400">لم ترفع أي وثائق هوية بعد</p>
                  )}
                </div>
              </details>

              {/* العنوان الوطني */}
              <details className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <summary className="p-4 font-bold text-lg cursor-pointer flex items-center gap-3 hover:bg-gray-50">
                  📍 العنوان الوطني
                  <span className="text-sm font-normal text-gray-500">({addressDocuments.length})</span>
                </summary>
                <div className="p-4 border-t border-gray-200 space-y-3">
                  {addressDocuments.length > 0 ? addressDocuments.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">📍</span>
                        <div>
                          <p className="font-medium">{doc.file_name}</p>
                          <p className="text-sm text-gray-500">{formatFileSize(doc.file_size)} - {formatDate(doc.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full ${getStatusBadge(doc.status).color}`}>{getStatusBadge(doc.status).label}</span>
                        <div className="flex gap-2 text-gray-500">
                          <a href={doc.file_url} target="_blank" className="hover:text-blue-600">📥</a>
                          <a href={doc.file_url} target="_blank" className="hover:text-blue-600">👁️</a>
                          {!doc.is_system_generated && <button onClick={() => handleDeleteDocument(doc.id)} className="hover:text-red-600">🗑️</button>}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-center py-4 text-gray-400">لم ترفع العنوان الوطني بعد</p>
                  )}
                </div>
              </details>

              {/* وثيقة الاشتراك */}
              <details className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <summary className="p-4 font-bold text-lg cursor-pointer flex items-center gap-3 hover:bg-gray-50">
                  📜 وثيقة الاشتراك
                  <span className="text-sm font-normal text-gray-500">({certificateDocuments.length})</span>
                </summary>
                <div className="p-4 border-t border-gray-200 space-y-3">
                  {certificateDocuments.length > 0 ? certificateDocuments.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">📜</span>
                        <div>
                          <p className="font-medium">{doc.file_name}</p>
                          <p className="text-sm text-gray-500">{formatDate(doc.created_at)}</p>
                          <p className="text-xs text-blue-600">صادر من النظام</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-100 text-green-800">موثق ✅</span>
                        <div className="flex gap-2 text-gray-500">
                          <a href={doc.file_url} target="_blank" className="hover:text-blue-600">📥</a>
                          <a href={doc.file_url} target="_blank" className="hover:text-blue-600">👁️</a>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-6 text-gray-400">
                      <p>لا توجد وثيقة اشتراك</p>
                      {!isSubscribed && <p className="text-sm mt-1">سيتم إصدارها تلقائياً عند الاشتراك</p>}
                    </div>
                  )}
                </div>
              </details>

              {/* مستندات أخرى */}
              <details className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <summary className="p-4 font-bold text-lg cursor-pointer flex items-center gap-3 hover:bg-gray-50">
                  📁 مستندات أخرى
                  <span className="text-sm font-normal text-gray-500">({otherDocuments.length})</span>
                </summary>
                <div className="p-4 border-t border-gray-200 space-y-3">
                  {otherDocuments.length > 0 ? otherDocuments.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">{getDocumentTypeIcon(doc.document_type)}</span>
                        <div>
                          <p className="font-medium">{doc.document_name || getDocumentTypeLabel(doc.document_type)}</p>
                          <p className="text-sm text-gray-500">{doc.file_name} - {formatFileSize(doc.file_size)}</p>
                          <p className="text-xs text-gray-400">{formatDate(doc.created_at)}</p>
                          {doc.status === 'rejected' && doc.rejection_reason && (
                            <p className="text-xs text-red-500 mt-1">سبب الرفض: {doc.rejection_reason}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full ${getStatusBadge(doc.status).color}`}>{getStatusBadge(doc.status).label}</span>
                        <div className="flex gap-2 text-gray-500">
                          <a href={doc.file_url} target="_blank" className="hover:text-blue-600">📥</a>
                          <a href={doc.file_url} target="_blank" className="hover:text-blue-600">👁️</a>
                          {!doc.is_system_generated && <button onClick={() => handleDeleteDocument(doc.id)} className="hover:text-red-600">🗑️</button>}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-6 text-gray-400">
                      <p className="text-4xl mb-2">📄</p>
                      <p>لا توجد مستندات أخرى</p>
                      <p className="text-sm mt-1">يمكنك رفع جواز السفر، الوكالات، شهادات الميلاد وغيرها</p>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}
        </div>
      </main>

      {/* Phone Change Modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">📱 تغيير رقم الجوال</h2>
              <button onClick={() => { setShowPhoneModal(false); setPhoneStep(1) }} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="p-6">
              {phoneStep === 1 && (
                <div className="space-y-4">
                  <p className="text-gray-600">سنرسل رمز التحقق لرقمك الحالي:</p>
                  <p className="text-xl font-bold text-center" dir="ltr">{maskValue(user?.phone || '', 3)}</p>
                  <p className="text-sm text-gray-500">اختر طريقة الإرسال:</p>
                  <div className="flex gap-3">
                    <button onClick={() => { setOtpMethod('whatsapp'); sendPhoneOtp() }} className="flex-1 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600">واتساب</button>
                    <button onClick={() => { setOtpMethod('sms'); sendPhoneOtp() }} className="flex-1 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">رسالة نصية</button>
                  </div>
                  <button className="w-full text-sm text-blue-500 hover:underline mt-4">لا أستطيع الوصول للرقم القديم؟ مراسلة الإدارة</button>
                </div>
              )}
              {phoneStep === 2 && (
                <div className="space-y-4">
                  <p className="text-gray-600 text-center">أدخل رمز التحقق المرسل عبر {otpMethod === 'whatsapp' ? 'واتساب' : 'رسالة نصية'}</p>
                  <input type="text" value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value)} maxLength={6} className="w-full text-center text-2xl tracking-widest border rounded-lg px-4 py-3" placeholder="------" />
                  <button onClick={verifyPhoneOtp} className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">تحقق</button>
                  <p className="text-center text-sm text-gray-500">
                    {otpTimer > 0 ? `إعادة الإرسال بعد ${otpTimer} ثانية` : (<button onClick={sendPhoneOtp} className="text-blue-500 hover:underline">إعادة الإرسال</button>)}
                  </p>
                </div>
              )}
              {phoneStep === 3 && (
                <div className="space-y-4">
                  <p className="text-gray-600">أدخل رقم الجوال الجديد:</p>
                  <div className="flex gap-2">
                    <span className="px-4 py-2 bg-gray-100 rounded-lg text-gray-600">+966</span>
                    <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="flex-1 border rounded-lg px-4 py-2" placeholder="5XXXXXXXX" dir="ltr" />
                  </div>
                  <button onClick={() => { setPhoneStep(4); sendPhoneOtp() }} className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">إرسال رمز التحقق</button>
                </div>
              )}
              {phoneStep === 4 && (
                <div className="space-y-4">
                  <p className="text-gray-600 text-center">أدخل رمز التحقق المرسل للرقم الجديد</p>
                  <input type="text" value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value)} maxLength={6} className="w-full text-center text-2xl tracking-widest border rounded-lg px-4 py-3" placeholder="------" />
                  <button onClick={verifyPhoneOtp} className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">تأكيد</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Change Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">📧 تغيير البريد الإلكتروني</h2>
              <button onClick={() => { setShowEmailModal(false); setEmailStep(1) }} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="p-6">
              {emailStep === 1 && (
                <div className="space-y-4">
                  <p className="text-gray-600">أدخل البريد الإلكتروني الجديد:</p>
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full border rounded-lg px-4 py-2" placeholder="example@email.com" />
                  <button onClick={sendEmailCode} className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">إرسال رمز التحقق</button>
                </div>
              )}
              {emailStep === 2 && (
                <div className="space-y-4">
                  <p className="text-gray-600 text-center">أدخل رمز التحقق المرسل إلى:</p>
                  <p className="text-center font-medium">{newEmail}</p>
                  <input type="text" value={emailCode} onChange={(e) => setEmailCode(e.target.value)} maxLength={6} className="w-full text-center text-2xl tracking-widest border rounded-lg px-4 py-3" placeholder="------" />
                  <button onClick={verifyEmailCode} className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">تأكيد</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">📤 رفع مستند جديد</h2>
              <button onClick={() => { setShowUploadModal(false); setUploadFile(null); setCustomDocName('') }} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع المستند</label>
                <select value={uploadType} onChange={(e) => setUploadType(e.target.value)} className="w-full border rounded-lg px-4 py-2">
                  {DOCUMENT_TYPES.filter(d => d.value !== 'subscription_certificate').map(type => (
                    <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
                  ))}
                </select>
              </div>
              
              {uploadType === 'other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستند</label>
                  <input type="text" value={customDocName} onChange={(e) => setCustomDocName(e.target.value)} className="w-full border rounded-lg px-4 py-2" placeholder="مثال: شهادة تخرج، عقد عمل..." />
                </div>
              )}
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-400 cursor-pointer transition-colors" onClick={() => document.getElementById('file-input')?.click()}>
                {uploadFile ? (
                  <div>
                    <span className="text-4xl">✅</span>
                    <p className="text-sm text-gray-600 mt-2">{uploadFile.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(uploadFile.size)}</p>
                  </div>
                ) : (
                  <>
                    <span className="text-4xl">📎</span>
                    <p className="text-sm text-gray-600 mt-2">اسحب الملف هنا أو <span className="text-green-500">اضغط للاختيار</span></p>
                    <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (حتى 10 MB)</p>
                  </>
                )}
                <input id="file-input" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              </div>
              
              <button onClick={handleUploadDocument} disabled={!uploadFile || isUploading || (uploadType === 'other' && !customDocName)} className="w-full py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed">
                {isUploading ? 'جاري الرفع...' : 'رفع المستند'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
