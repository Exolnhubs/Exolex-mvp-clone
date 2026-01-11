'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 نموذج طلب استشارة / قضية - Component مستقل
// 📅 تاريخ الإنشاء: 6 يناير 2026
// 🎯 الغرض: فصل نموذج الطلب عن Dashboard لسهولة التعديل
// 📁 المسار: src/components/subscriber/RequestFormModal.tsx
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, RefObject } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { FloatingNolexRef } from '@/components/FloatingNolex'

// ═══════════════════════════════════════════════════════════════════════════════
// الواجهات (Interfaces)
// ═══════════════════════════════════════════════════════════════════════════════

interface Category {
  id: string
  code: string
  name_ar: string
  color: string
}

interface Subcategory {
  id: string
  name_ar: string
  category_id: string
}

interface LegalService {
  id: string
  name_ar: string
  code: string
  category_id: string
  subcategory_id: string | null
  path_id: string
  path?: {
    id: string
    code: string
    name_ar: string
  }
}

interface Subscription {
  id: string
  consultations_remaining: number
  cases_remaining: number
}

interface Member {
  id: string
  member_code: string
}

interface RequestFormModalProps {
  isOpen: boolean
  onClose: () => void
  requestType: 'consultation' | 'case'
  nolexRef: RefObject<FloatingNolexRef>
  subscription: Subscription | null
  member: Member | null
  categories: Category[]
  onSuccess: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// معرّف مسار الاستشارة (ثابت من قاعدة البيانات)
// ═══════════════════════════════════════════════════════════════════════════════
const CONSULTATION_PATH_ID = '27439b80-96c8-4a9b-9337-f8f3e1b5cf7d'

// ═══════════════════════════════════════════════════════════════════════════════
// المكون الرئيسي
// ═══════════════════════════════════════════════════════════════════════════════

export default function RequestFormModal({
  isOpen,
  onClose,
  requestType,
  nolexRef,
  subscription,
  member,
  categories,
  onSuccess
}: RequestFormModalProps) {
  
  // ─────────────────────────────────────────────────────────────
  // States
  // ─────────────────────────────────────────────────────────────
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [legalServices, setLegalServices] = useState<LegalService[]>([])
  const [filteredServices, setFilteredServices] = useState<LegalService[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingServices, setIsLoadingServices] = useState(false)
  
  const [requestForm, setRequestForm] = useState({
    category_id: '',
    subcategory_id: '',
    service_id: '',
    custom_title: '',
    description: '',
    attachments: [] as File[]
  })

  // ─────────────────────────────────────────────────────────────
  // جلب الفروع عند اختيار المجال
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (requestForm.category_id) {
      fetchSubcategories(requestForm.category_id)
      fetchLegalServices(requestForm.category_id)
    } else {
      setSubcategories([])
      setLegalServices([])
      setFilteredServices([])
    }
  }, [requestForm.category_id])

  // ─────────────────────────────────────────────────────────────
  // فلترة الخدمات عند تغيير الفرع أو نوع الطلب
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    filterServices()
  }, [requestForm.subcategory_id, legalServices, requestType])

  // ─────────────────────────────────────────────────────────────
  // جلب الفروع من قاعدة البيانات
  // ─────────────────────────────────────────────────────────────
  const fetchSubcategories = async (categoryId: string) => {
    const { data, error } = await supabase
      .from('subcategories')
      .select('id, name_ar, category_id')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('sort_order')

    if (data) {
      setSubcategories(data)
    }
    if (error) {
      console.error('Error fetching subcategories:', error)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // جلب الخدمات القانونية من قاعدة البيانات
  // ─────────────────────────────────────────────────────────────
  const fetchLegalServices = async (categoryId: string) => {
    setIsLoadingServices(true)
    
    const { data, error } = await supabase
      .from('legal_services')
      .select(`
        id,
        name_ar,
        code,
        category_id,
        subcategory_id,
        path_id,
        path:service_paths(id, code, name_ar)
      `)
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('sort_order')

    if (data) {
      // تحويل البيانات للشكل المطلوب
      const services = data.map((s: any) => ({
        ...s,
        path: s.path ? s.path : null
      }))
      setLegalServices(services)
    }
    if (error) {
      console.error('Error fetching legal services:', error)
    }
    
    setIsLoadingServices(false)
  }

  // ─────────────────────────────────────────────────────────────
  // فلترة الخدمات حسب نوع الطلب والفرع
  // ─────────────────────────────────────────────────────────────
  const filterServices = () => {
    let filtered = [...legalServices]

    // فلترة حسب نوع الطلب (استشارة أو قضية)
    if (requestType === 'consultation') {
      // استشارة = فقط الخدمات التي path_id = consultation
      filtered = filtered.filter(s => s.path_id === CONSULTATION_PATH_ID)
    } else {
      // قضية = كل الخدمات ما عدا الاستشارة
      filtered = filtered.filter(s => s.path_id !== CONSULTATION_PATH_ID)
    }

    // فلترة حسب الفرع إذا تم اختياره
    if (requestForm.subcategory_id) {
      filtered = filtered.filter(s => s.subcategory_id === requestForm.subcategory_id)
    }

    setFilteredServices(filtered)
  }

  // ─────────────────────────────────────────────────────────────
  // عند اختيار المجال
  // ─────────────────────────────────────────────────────────────
  const handleCategorySelect = (categoryId: string) => {
    setRequestForm(prev => ({ 
      ...prev, 
      category_id: categoryId, 
      subcategory_id: '', 
      service_id: '' 
    }))
    
    // إخبار NOLEX بالمجال المختار
    const selectedCategory = categories.find(c => c.id === categoryId)
    if (selectedCategory && nolexRef.current && categoryId) {
      nolexRef.current.openWithGreeting({
        type: requestType,
        category_name: selectedCategory.name_ar,
        category_id: categoryId,
        title: '',
        description: ''
      })
    }
  }

  // ─────────────────────────────────────────────────────────────
  // عند اختيار الفرع
  // ─────────────────────────────────────────────────────────────
  const handleSubcategorySelect = (subcategoryId: string) => {
    setRequestForm(prev => ({ 
      ...prev, 
      subcategory_id: subcategoryId,
      service_id: ''
    }))
  }

  // ─────────────────────────────────────────────────────────────
  // إرسال الطلب
  // ─────────────────────────────────────────────────────────────
  const handleSubmitRequest = async () => {
    // التحقق من البيانات
    if (!requestForm.category_id) {
      toast.error('يرجى اختيار المجال القانوني')
      return
    }
    if (!requestForm.description) {
      toast.error('يرجى كتابة تفاصيل الطلب')
      return
    }
    if (!member || !subscription) {
      toast.error('يرجى تسجيل الدخول أولاً')
      return
    }

    // جلب أسماء المجال والفرع والخدمة
    const selectedCategory = categories.find(c => c.id === requestForm.category_id)
    const selectedSubcategory = subcategories.find(s => s.id === requestForm.subcategory_id)
    const selectedService = filteredServices.find(s => s.id === requestForm.service_id)
    
    // تحديد العنوان النهائي
    const finalTitle = requestForm.service_id === 'other' || !selectedService
      ? requestForm.custom_title || `${requestType === 'consultation' ? 'استشارة' : 'قضية'} جديدة`
      : selectedService.name_ar

    // استدعاء NOLEX للتحليل
    if (nolexRef.current) {
      nolexRef.current.analyzeRequest({
        type: requestType,
        category_name: selectedCategory?.name_ar || '',
        category_id: requestForm.category_id,
        subcategory_name: selectedSubcategory?.name_ar,
        subcategory_id: requestForm.subcategory_id,
        title: finalTitle,
        description: requestForm.description
      })
    }
  }

  // ─────────────────────────────────────────────────────────────
  // إعادة تعيين النموذج عند الإغلاق
  // ─────────────────────────────────────────────────────────────
  const handleClose = () => {
    setRequestForm({
      category_id: '',
      subcategory_id: '',
      service_id: '',
      custom_title: '',
      description: '',
      attachments: []
    })
    setSubcategories([])
    setLegalServices([])
    setFilteredServices([])
    onClose()
  }

  // ─────────────────────────────────────────────────────────────
  // لا تعرض إذا مغلق
  // ─────────────────────────────────────────────────────────────
  if (!isOpen) return null

  // ═══════════════════════════════════════════════════════════════════════════════
  // العرض (Render)
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        
        {/* ─────────────────────────────────────────────────────────────
            Header
        ───────────────────────────────────────────────────────────── */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {requestType === 'consultation' ? '💬 طلب استشارة' : '⚖️ طلب قضية'}
            </h2>
            <p className="text-sm text-gray-500">
              الرصيد المتبقي: {requestType === 'consultation' 
                ? subscription?.consultations_remaining 
                : subscription?.cases_remaining}
            </p>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            ✕
          </button>
        </div>
        
        {/* ─────────────────────────────────────────────────────────────
            Form
        ───────────────────────────────────────────────────────────── */}
        <div className="p-6 space-y-5">
          
          {/* المجال القانوني */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              المجال القانوني <span className="text-red-500">*</span>
            </label>
            <select
              value={requestForm.category_id}
              onChange={(e) => handleCategorySelect(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">اختر المجال</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.code === 'labor' ? '💼 ' : '👨‍👩‍👧 '}{cat.name_ar}
                </option>
              ))}
            </select>
          </div>

          {/* الفرع */}
          {requestForm.category_id && subcategories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الفرع
              </label>
              <select
                value={requestForm.subcategory_id}
                onChange={(e) => handleSubcategorySelect(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">اختر الفرع (اختياري)</option>
                {subcategories.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name_ar}</option>
                ))}
              </select>
            </div>
          )}

          {/* المسار - تلقائي */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              المسار
            </label>
            <input
              type="text"
              value={requestType === 'consultation' ? 'استشارة' : 'تقاضي'}
              disabled
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
            />
          </div>

          {/* عنوان الطلب - من الخدمات */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              عنوان {requestType === 'consultation' ? 'الاستشارة' : 'القضية'}
            </label>
            <select
              value={requestForm.service_id}
              onChange={(e) => setRequestForm(prev => ({ ...prev, service_id: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={!requestForm.category_id || isLoadingServices}
            >
              <option value="">
                {isLoadingServices 
                  ? 'جاري التحميل...' 
                  : !requestForm.category_id 
                    ? 'اختر المجال أولاً'
                    : 'اختر نوع الخدمة'
                }
              </option>
              {filteredServices.map(svc => (
                <option key={svc.id} value={svc.id}>
                  {svc.name_ar}
                </option>
              ))}
              <option value="other">✏️ أخرى (سأكتب العنوان)</option>
            </select>
            
            {/* عرض المسار الفعلي للخدمة المختارة */}
            {requestForm.service_id && requestForm.service_id !== 'other' && (
              <p className="text-xs text-gray-400 mt-1">
                المسار: {filteredServices.find(s => s.id === requestForm.service_id)?.path?.name_ar || '-'}
              </p>
            )}
          </div>

          {/* عنوان مخصص */}
          {requestForm.service_id === 'other' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                اكتب العنوان
              </label>
              <input
                type="text"
                value={requestForm.custom_title}
                onChange={(e) => setRequestForm(prev => ({ ...prev, custom_title: e.target.value }))}
                placeholder={`مثال: ${requestType === 'consultation' ? 'استفسار عن مستحقات نهاية الخدمة' : 'قضية فصل تعسفي'}`}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          )}

          {/* تفاصيل الطلب */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              تفاصيل {requestType === 'consultation' ? 'الاستشارة' : 'القضية'} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={requestForm.description}
              onChange={(e) => setRequestForm(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              placeholder="اشرح موضوعك بالتفصيل لنتمكن من مساعدتك بشكل أفضل..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>

          {/* إرفاق مستندات */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📎 إرفاق مستندات (اختياري)
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                setRequestForm(prev => ({ ...prev, attachments: files }))
              }}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {requestForm.attachments.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                تم اختيار {requestForm.attachments.length} ملف
              </p>
            )}
          </div>

          {/* تنبيه الرصيد */}
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-sm text-amber-700">
              ⚠️ سيتم خصم {requestType === 'consultation' ? 'استشارة واحدة' : 'قضية واحدة'} من رصيدك عند الإرسال
            </p>
          </div>
        </div>
        
        {/* ─────────────────────────────────────────────────────────────
            Actions
        ───────────────────────────────────────────────────────────── */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
          <button
            onClick={handleClose}
            className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmitRequest}
            disabled={isSubmitting || !requestForm.category_id || !requestForm.description}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                جاري الإرسال...
              </>
            ) : (
              <>
                إرسال الطلب
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
