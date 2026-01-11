'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// Interfaces متوافقة مع قاعدة البيانات
// ═══════════════════════════════════════════════════════════════
interface Category {
  id: string
  code: string
  name_ar: string
  name_en: string
  color: string
  icon: string
  form_fields: FormField[] | null
}

interface FormField {
  name: string
  name_ar: string
  type: 'text' | 'number' | 'select' | 'textarea' | 'file' | 'checkbox' | 'date'
  options?: string[]
  required: boolean
}

interface ExtraService {
  id: string
  category_id: string
  name_ar: string
  name_en: string
  description_ar: string | null
  pricing_type: 'fixed' | 'quote'
  price: number | null
  icon: string | null
  category?: Category
}

interface User {
  id: string
  full_name: string
}

// تحويل أسماء Lucide إلى Emoji
const ICON_MAP: { [key: string]: string } = {
  'globe': '🌐', 'file-text': '📄', 'stamp': '✍️', 'zap': '⚡',
  'scale': '⚖️', 'briefcase': '💼', 'building': '🏢', 'users': '👥',
  'shield': '🛡️', 'home': '🏠', 'file-signature': '📝', 'gavel': '⚖️',
}

const getIcon = (iconName: string | null): string => {
  if (!iconName) return '📦'
  if (/[\u{1F300}-\u{1F9FF}]/u.test(iconName)) return iconName
  return ICON_MAP[iconName.toLowerCase()] || '📦'
}

export default function ExtraServicesPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [member, setMember] = useState<{ id: string } | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [services, setServices] = useState<ExtraService[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubscribed, setIsSubscribed] = useState(false)
  
  // الفلترة
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  
  // النموذج
  const [selectedService, setSelectedService] = useState<ExtraService | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState<{ [key: string]: any }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const userId = localStorage.getItem('exolex_user_id')
    if (!userId) { router.push('/auth/login'); return }

    const fetchData = async () => {
      // جلب المستخدم
      const { data: userData } = await supabase
        .from('users').select('id, full_name').eq('id', userId).single()
      if (userData) setUser(userData)

      // جلب member أولاً
      const { data: memberData } = await supabase.from('members').select('id').eq('user_id', userId).single()
      if (memberData) setMember(memberData)

      // جلب الاشتراك
      const { data: subData } = await supabase
        .from('subscriptions').select('id, status')
        .eq('member_id', memberData?.id).eq('status', 'active').single()
      if (subData) setIsSubscribed(true)

      // جلب التصنيفات التي لها خدمات إضافية
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, code, name_ar, name_en, color, icon, form_fields')
        .eq('is_active', true)
        .order('sort_order')

      // جلب الخدمات مع التصنيفات
      const { data: servicesData } = await supabase
        .from('extra_services')
        .select('*, category:categories(id, code, name_ar, color, icon, form_fields)')
        .eq('is_active', true)
        .order('sort_order')

      if (servicesData) {
        setServices(servicesData)
        // استخراج التصنيفات الفعلية من الخدمات
        const usedCategoryIds = [...new Set(servicesData.map(s => s.category_id).filter(Boolean))]
        const usedCategories = categoriesData?.filter(c => usedCategoryIds.includes(c.id)) || []
        setCategories(usedCategories)
      }

      setIsLoading(false)
    }
    fetchData()
  }, [router])

  // فتح النموذج
  const handleLogout = () => {
    localStorage.removeItem('exolex_user_id')
    localStorage.removeItem('exolex_phone')
    router.push('/auth/login')
  }



  // فتح النموذج
  const openServiceModal = (service: ExtraService) => {
    console.log('Service clicked:', service)
    console.log('pricing_type:', service.pricing_type)
    console.log('price:', service.price)
    
    // الخدمات المسعّرة تذهب لصفحة الدفع مباشرة
    if (service.pricing_type === 'fixed' && service.price && service.price > 0) {
      router.push("/subscriber/extra-services/checkout/" + service.id)
      return
    }
    // الخدمات التي تحتاج عرض سعر تفتح Modal
    setSelectedService(service)
    setFormData({})
    setShowModal(true)
  }
  
  // إرسال الطلب
  const handleSubmit = async () => {
    if (!selectedService || !user) return

    // التحقق من الحقول المطلوبة
    const category = selectedService.category
    const fields = category?.form_fields || []
    
    for (const field of fields) {
      if (field.required && !formData[field.name]) {
        toast.error(`الرجاء تعبئة: ${field.name_ar}`)
        return
      }
    }

    setIsSubmitting(true)

    try {
const isQuote = selectedService.pricing_type === 'quote'
      
      // توليد رقم الطلب
      const { data: ticketData } = await supabase.rpc('generate_sequence_number', { p_code: isQuote ? 'QOT' : 'SVC' })
      const ticketNumber = ticketData || `SVC-${Date.now().toString().slice(-8)}`
      
      // إنشاء الطلب في service_requests
      const { data: requestData, error } = await supabase
        .from('service_requests')
        .insert({
          ticket_number: ticketNumber,
          member_id: member?.id,
          extra_service_id: selectedService.id,
          category_id: selectedService.category_id,
          request_type: 'extra_service',
          source: 'web',
          title: selectedService.name_ar,
          description: formData.description || selectedService.description_ar || selectedService.name_ar || 'طلب خدمة إضافية',
          status: isQuote ? 'pending_quotes' : 'pending_payment',
          priority: 'normal',
          base_price: selectedService.price || 0,
          total_amount: selectedService.price || 0,
          sla_hours: 24,
        })
        .select()
        .single()

      if (error) throw error

      toast.success(`تم إرسال طلبكم رقم ${ticketNumber} بنجاح! ${isQuote ? 'بانتظار عروض الأسعار' : 'يمكنكم الدفع الآن'}`, { duration: 5000 })
      
      setShowModal(false)
      setSelectedService(null)
      setFormData({})
      
      router.push('/subscriber/requests')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredServices = services.filter(s => {
    const matchesCategory = selectedCategory === 'all' || s.category?.code === selectedCategory
    const matchesSearch = searchQuery === '' || s.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) || s.description_ar?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // تنسيق السعر
  const formatPrice = (price: number | null): string => {
    if (price === null || price === undefined) return 'عرض سعر'
    return `${Number(price).toLocaleString('ar-SA')} ريال`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isSubscribed={isSubscribed} userName={user?.full_name || ''} onLogout={handleLogout} />

      <main className="flex-1 mr-64 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-800">الخدمات الإضافية</h1>
            <p className="text-gray-500">خدمات قانونية متخصصة خارج نطاق الاشتراك</p>
          </div>
          {/* محرك البحث */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث عن خدمة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-sm text-gray-500 mt-2">
                نتائج البحث: {filteredServices.length} خدمة
              </p>
            )}
          </div>

          {/* تبويبات التصنيفات */}
          <div className="bg-white rounded-xl p-4 mb-6 flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                selectedCategory === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>📋</span>
              <span>الكل</span>
              <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{services.length}</span>
            </button>
            
            {categories.map((cat) => {
              const count = services.filter(s => s.category?.code === cat.code).length
              return (
                <button
                  key={cat.code}
                  onClick={() => setSelectedCategory(cat.code)}
                  style={{
                    backgroundColor: selectedCategory === cat.code ? cat.color : undefined,
                    borderColor: cat.color,
                  }}
                  className={`px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 border-2 ${
                    selectedCategory === cat.code
                      ? 'text-white'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <span>{getIcon(cat.icon)}</span>
                  <span>{cat.name_ar}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    selectedCategory === cat.code ? 'bg-white/20' : 'bg-gray-100'
                  }`}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* قائمة الخدمات */}
          {filteredServices.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <span className="text-6xl mb-4 block">🔍</span>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">لا توجد خدمات</h3>
              <p className="text-gray-500">لا توجد خدمات في هذا التصنيف</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all"
                  style={{ borderTop: `4px solid ${service.category?.color || '#6B7280'}` }}
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: `${service.category?.color}20` }}
                      >
                        {getIcon(service.icon || service.category?.icon)}
                      </div>
                      <span 
                        className="text-xs px-2 py-1 rounded-full text-white"
                        style={{ backgroundColor: service.category?.color }}

                      >
                        {service.category?.name_ar}
                      </span>
                    </div>

                    {/* اسم الخدمة */}
                    <h3 className="font-semibold text-gray-800 mb-2">{service.name_ar}</h3>
                    
                    {/* الوصف */}
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                      {service.description_ar || 'خدمة قانونية متخصصة'}
                    </p>

                    {/* السعر */}
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-xs px-2 py-1 rounded ${
                        service.pricing_type === 'quote' 
                          ? 'bg-amber-100 text-amber-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {service.pricing_type === 'quote' ? '📋 عرض سعر' : '✓ سعر ثابت'}
                      </span>
                      <span className="text-lg font-bold" style={{ color: service.category?.color }}>
                        {formatPrice(service.price)}
                      </span>
                    </div>

                    {/* زر الطلب */}
                    <button
                      onClick={() => openServiceModal(service)}
                      className={`w-full py-2.5 rounded-lg text-white transition-all hover:opacity-90 ${service.pricing_type === "quote" ? "bg-[#3D65AF] hover:bg-[#2d4f8f]" : "bg-[#F47A62] hover:bg-[#e06a52]"}`}
                    >
                      {service.pricing_type === 'quote' ? 'طلب عرض سعر' : 'طلب الخدمة'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Modal النموذج الديناميكي */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showModal && selectedService && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div 
              className="p-4 text-white bg-[#3D65AF]"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getIcon(selectedService.icon || selectedService.category?.icon)}</span>
                <div>
                  <h3 className="font-bold text-lg">{selectedService.name_ar}</h3>
                  <p className="text-sm opacity-90">{selectedService.category?.name_ar}</p>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {selectedService.category?.form_fields?.map((field) => (
                <div key={field.name} className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.name_ar}
                    {field.required && <span className="text-red-500 mr-1">*</span>}
                  </label>

                  {field.type === 'select' && (
                    <select
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500"
                      required={field.required}
                    >
                      <option value="">اختر...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {field.type === 'text' && (
                    <input
                      type="text"
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500"
                      required={field.required}
                    />
                  )}

                  {field.type === 'number' && (
                    <input
                      type="number"
                      min="1"
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500"
                      required={field.required}
                    />
                  )}

                  {field.type === 'date' && (
                    <input
                      type="date"
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500"
                      required={field.required}
                    />
                  )}

                  {field.type === 'textarea' && (
                    <textarea
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="w-full border rounded-lg px-4 py-2.5 h-24 resize-none focus:ring-2 focus:ring-primary-500"
                      required={field.required}
                    />
                  )}

                  {field.type === 'checkbox' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData[field.name] || false}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
                        className="w-5 h-5 rounded text-primary-600"
                      />
                      <span className="text-gray-600">{field.name_ar}</span>
                    </label>
                  )}

                  {field.type === 'file' && (
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-gray-50 cursor-pointer">
                      <input
                        type="file"
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.files?.[0]?.name })}
                        className="hidden"
                        id={`file-${field.name}`}
                      />
                      <label htmlFor={`file-${field.name}`} className="cursor-pointer">
                        <span className="text-2xl block mb-2">📎</span>
                        <span className="text-sm text-gray-500">
                          {formData[field.name] || 'اضغط لاختيار ملف'}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              ))}

              {/* ملخص السعر */}
              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">السعر:</span>
                  <span className="text-xl font-bold" style={{ color: selectedService.category?.color }}>
                    {selectedService.pricing_type === 'quote' 
                      ? '📋 سيتم تحديده بعد المراجعة' 
                      : formatPrice(selectedService.price)}
                  </span>
                </div>
                {selectedService.pricing_type === 'quote' && (
                  <p className="text-xs text-gray-500 mt-2">
                    سيقوم فريقنا بمراجعة طلبك وإرسال عرض سعر خلال 24 ساعة
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => { setShowModal(false); setSelectedService(null); setFormData({}) }}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-300 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 text-white py-3 rounded-xl transition-colors disabled:opacity-50 bg-[#3D65AF] hover:bg-[#2d4f8f]"
              >
                {isSubmitting ? '⏳ جاري الإرسال...' : 
                  selectedService.pricing_type === 'quote' ? '📋 إرسال طلب عرض سعر' : '💳 متابعة للدفع'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
