'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { 
  Settings, Plus, X, Search, Filter, Check, ChevronDown, ChevronRight,
  DollarSign, Clock, ToggleLeft, ToggleRight, FileText, Scale, Copy,
  Loader2, Save, CheckSquare, Square, Briefcase
} from 'lucide-react'
import { getCookie } from '@/lib/cookies'

// ═══════════════════════════════════════════════════════════════════════════
// أنواع البيانات (Types)
// ═══════════════════════════════════════════════════════════════════════════

type ProviderType = 'partner' | 'legal_arm' | 'independent'
type PricingType = 'fixed' | 'range' | 'quote'

interface Category {
  id: string
  code: string
  name_ar: string
  name_en: string | null
}

interface Subcategory {
  id: string
  category_id: string
  code: string
  name_ar: string
  name_en: string | null
}

interface ServicePath {
  id: string
  code: string
  name_ar: string
  name_en: string | null
}

interface LegalService {
  id: string
  code: string
  category_id: string
  subcategory_id: string
  path_id: string
  name_ar: string
  name_en: string | null
  pricing_type: string | null
  base_price: number | null
  min_price: number | null
  max_price: number | null
  estimated_duration_days: number | null
}

interface ProviderService {
  id: string
  service_id: string
  partner_id: string | null
  legal_arm_id: string | null
  lawyer_id: string | null
  pricing_type: PricingType
  fixed_price: number | null
  min_price: number | null
  max_price: number | null
  estimated_days: number | null
  commission_rate: number
  is_active: boolean
}

interface ServicesManagerProps {
  providerType: ProviderType
}

const pricingTypes = [
  { value: 'fixed', label: 'سعر ثابت', icon: DollarSign },
  { value: 'range', label: 'نطاق سعري', icon: Scale },
  { value: 'quote', label: 'عرض سعر', icon: FileText },
]

// ═══════════════════════════════════════════════════════════════════════════
// المكون الرئيسي
// ═══════════════════════════════════════════════════════════════════════════

export default function ServicesManager({ providerType }: ServicesManagerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [providerId, setProviderId] = useState<string | null>(null)
  const commissionRate = providerType === 'legal_arm' ? 50 : 70
  
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [paths, setPaths] = useState<ServicePath[]>([])
  const [allServices, setAllServices] = useState<LegalService[]>([])
  const [myServices, setMyServices] = useState<ProviderService[]>([])
  
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set())
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  
  const [filters, setFilters] = useState({
    category: '',
    path: '',
    search: '',
    myServicesOnly: false,
  })
  
  const [showModal, setShowModal] = useState(false)
  const [selectedService, setSelectedService] = useState<LegalService | null>(null)
  const [serviceForm, setServiceForm] = useState({
    pricing_type: 'fixed' as PricingType,
    fixed_price: '',
    min_price: '',
    max_price: '',
    estimated_days: '',
  })
  
  const [copiedPrice, setCopiedPrice] = useState<{
    pricing_type: PricingType
    fixed_price: string
    min_price: string
    max_price: string
  } | null>(null)

  // ─────────────────────────────────────────────────────────────────────────
  // تحميل البيانات
  // ─────────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    loadInitialData()
  }, [])

  const getProviderIdKey = (): string => {
    switch (providerType) {
      case 'partner': return 'exolex_partner_id'
      case 'legal_arm': return 'exolex_legal_arm_id'
      case 'independent': return 'exolex_lawyer_id'
    }
  }

  const loadInitialData = async () => {
    try {
      setIsLoading(true)
      const id = getCookie(getProviderIdKey())
      setProviderId(id)

      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, code, name_ar, name_en')
        .eq('is_active', true)
        .order('sort_order')
      setCategories(categoriesData || [])

      const { data: subcategoriesData } = await supabase
        .from('subcategories')
        .select('id, category_id, code, name_ar, name_en')
        .eq('is_active', true)
        .order('sort_order')
      setSubcategories(subcategoriesData || [])

      const { data: pathsData } = await supabase
        .from('service_paths')
        .select('id, code, name_ar, name_en')
        .eq('is_active', true)
        .order('sort_order')
      setPaths(pathsData || [])

      const { data: servicesData } = await supabase
        .from('legal_services')
        .select('id, code, category_id, subcategory_id, path_id, name_ar, name_en, pricing_type, base_price, min_price, max_price, estimated_duration_days')
        .eq('is_active', true)
        .order('sort_order')
      setAllServices(servicesData || [])

      if (id) {
        await loadMyServices(id)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const loadMyServices = async (id: string) => {
    try {
      let query = supabase.from('provider_services').select('*')
      if (providerType === 'partner') query = query.eq('partner_id', id)
      else if (providerType === 'legal_arm') query = query.eq('legal_arm_id', id)
      else query = query.eq('lawyer_id', id)
      
      const { data } = await query.eq('is_active', true)
      setMyServices(data || [])
    } catch (error) {
      console.error('Error loading my services:', error)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // الدوال المساعدة
  // ─────────────────────────────────────────────────────────────────────────
  
  const getMyServiceData = (serviceId: string): ProviderService | undefined => {
    return myServices.find(ms => ms.service_id === serviceId)
  }

  const isServiceEnabled = (serviceId: string): boolean => {
    return myServices.some(ms => ms.service_id === serviceId && ms.is_active)
  }

  const calculateCommission = (price: number): number => {
    return Math.round(price * (commissionRate / 100))
  }

  const getEnabledCountInCategory = (categoryId: string) => {
    const servicesInCategory = allServices.filter(s => s.category_id === categoryId)
    const enabled = servicesInCategory.filter(s => isServiceEnabled(s.id)).length
    return { enabled, total: servicesInCategory.length }
  }

  const getEnabledCountInSubcategory = (subcategoryId: string) => {
    const servicesInSubcategory = allServices.filter(s => s.subcategory_id === subcategoryId)
    const enabled = servicesInSubcategory.filter(s => isServiceEnabled(s.id)).length
    return { enabled, total: servicesInSubcategory.length }
  }

  const getEnabledCountInPath = (subcategoryId: string, pathId: string) => {
    const servicesInPath = allServices.filter(s => s.subcategory_id === subcategoryId && s.path_id === pathId)
    const enabled = servicesInPath.filter(s => isServiceEnabled(s.id)).length
    return { enabled, total: servicesInPath.length }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // التصفية
  // ─────────────────────────────────────────────────────────────────────────
  
  const filteredCategories = useMemo(() => {
    if (!filters.category) return categories
    return categories.filter(c => c.id === filters.category)
  }, [categories, filters.category])

  const getSubcategoriesForCategory = (categoryId: string) => {
    return subcategories.filter(sc => sc.category_id === categoryId)
  }

  const getServicesForSubcategoryAndPath = (subcategoryId: string, pathId: string) => {
    let services = allServices.filter(s => s.subcategory_id === subcategoryId && s.path_id === pathId)
    if (filters.path && pathId !== filters.path) return []
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      services = services.filter(s => s.name_ar.toLowerCase().includes(searchLower) || (s.name_en?.toLowerCase().includes(searchLower)))
    }
    if (filters.myServicesOnly) {
      services = services.filter(s => isServiceEnabled(s.id))
    }
    return services
  }

  const getPathsForSubcategory = (subcategoryId: string) => {
    const pathIds = new Set(allServices.filter(s => s.subcategory_id === subcategoryId).map(s => s.path_id))
    return paths.filter(p => pathIds.has(p.id))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Toggle Accordion
  // ─────────────────────────────────────────────────────────────────────────
  
  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) newExpanded.delete(categoryId)
    else newExpanded.add(categoryId)
    setExpandedCategories(newExpanded)
  }

  const toggleSubcategory = (subcategoryId: string) => {
    const newExpanded = new Set(expandedSubcategories)
    if (newExpanded.has(subcategoryId)) newExpanded.delete(subcategoryId)
    else newExpanded.add(subcategoryId)
    setExpandedSubcategories(newExpanded)
  }

  const togglePath = (key: string) => {
    const newExpanded = new Set(expandedPaths)
    if (newExpanded.has(key)) newExpanded.delete(key)
    else newExpanded.add(key)
    setExpandedPaths(newExpanded)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // فتح المودال
  // ─────────────────────────────────────────────────────────────────────────
  
  const openServiceModal = (service: LegalService) => {
    setSelectedService(service)
    const existingService = getMyServiceData(service.id)
    
    if (existingService) {
      setServiceForm({
        pricing_type: existingService.pricing_type,
        fixed_price: existingService.fixed_price?.toString() || '',
        min_price: existingService.min_price?.toString() || '',
        max_price: existingService.max_price?.toString() || '',
        estimated_days: existingService.estimated_days?.toString() || '',
      })
    } else if (copiedPrice) {
      setServiceForm({
        pricing_type: copiedPrice.pricing_type,
        fixed_price: copiedPrice.fixed_price,
        min_price: copiedPrice.min_price,
        max_price: copiedPrice.max_price,
        estimated_days: '',
      })
    } else {
      setServiceForm({
        pricing_type: (service.pricing_type as PricingType) || 'fixed',
        fixed_price: service.base_price?.toString() || '',
        min_price: service.min_price?.toString() || '',
        max_price: service.max_price?.toString() || '',
        estimated_days: service.estimated_duration_days?.toString() || '',
      })
    }
    setShowModal(true)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // حفظ الخدمة
  // ─────────────────────────────────────────────────────────────────────────
  
  const saveService = async () => {
    if (!selectedService || !providerId) return
    
    if (serviceForm.pricing_type === 'fixed' && !serviceForm.fixed_price) {
      toast.error('يرجى إدخال السعر')
      return
    }
    
    if (serviceForm.pricing_type === 'range') {
      if (!serviceForm.min_price || !serviceForm.max_price) {
        toast.error('يرجى إدخال الحد الأدنى والأعلى للسعر')
        return
      }
      if (Number(serviceForm.min_price) >= Number(serviceForm.max_price)) {
        toast.error('الحد الأدنى يجب أن يكون أقل من الحد الأعلى')
        return
      }
    }

    try {
      setIsSaving(true)
      
      const serviceData: any = {
        service_id: selectedService.id,
        pricing_type: serviceForm.pricing_type,
        fixed_price: serviceForm.pricing_type === 'fixed' ? Number(serviceForm.fixed_price) : null,
        min_price: serviceForm.pricing_type === 'range' ? Number(serviceForm.min_price) : null,
        max_price: serviceForm.pricing_type === 'range' ? Number(serviceForm.max_price) : null,
        estimated_days: serviceForm.estimated_days ? Number(serviceForm.estimated_days) : null,
        commission_rate: commissionRate,
        is_active: true,
      }
      
      if (providerType === 'partner') serviceData.partner_id = providerId
      else if (providerType === 'legal_arm') serviceData.legal_arm_id = providerId
      else serviceData.lawyer_id = providerId

      const existingService = getMyServiceData(selectedService.id)
      
      if (existingService) {
        const { error } = await supabase.from('provider_services').update(serviceData).eq('id', existingService.id)
        if (error) throw error
        toast.success('تم تحديث الخدمة بنجاح')
      } else {
        const { error } = await supabase.from('provider_services').insert(serviceData)
        if (error) throw error
        toast.success('تم تفعيل الخدمة بنجاح')
      }

      await loadMyServices(providerId)
      setShowModal(false)
    } catch (error) {
      console.error('Error saving service:', error)
      toast.error('خطأ في حفظ الخدمة')
    } finally {
      setIsSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // تعطيل الخدمة
  // ─────────────────────────────────────────────────────────────────────────
  
  const disableService = async (serviceId: string) => {
    const existingService = getMyServiceData(serviceId)
    if (!existingService || !providerId) return
    
    try {
      const { error } = await supabase.from('provider_services').update({ is_active: false }).eq('id', existingService.id)
      if (error) throw error
      toast.success('تم تعطيل الخدمة')
      await loadMyServices(providerId)
    } catch (error) {
      console.error('Error disabling service:', error)
      toast.error('خطأ في تعطيل الخدمة')
    }
  }

  const copyPrice = (service: ProviderService) => {
    setCopiedPrice({
      pricing_type: service.pricing_type,
      fixed_price: service.fixed_price?.toString() || '',
      min_price: service.min_price?.toString() || '',
      max_price: service.max_price?.toString() || '',
    })
    toast.success('تم نسخ السعر')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // تفعيل الكل
  // ─────────────────────────────────────────────────────────────────────────
  
  const enableAllInCategory = async (categoryId: string) => {
    if (!providerId) return
    const services = allServices.filter(s => s.category_id === categoryId && !isServiceEnabled(s.id))
    if (services.length === 0) {
      toast('جميع الخدمات مفعّلة بالفعل', { icon: 'ℹ️' })
      return
    }
    
    try {
      const insertData = services.map(service => ({
        service_id: service.id,
        pricing_type: 'quote' as PricingType,
        commission_rate: commissionRate,
        is_active: true,
        ...(providerType === 'partner' ? { partner_id: providerId } : {}),
        ...(providerType === 'legal_arm' ? { legal_arm_id: providerId } : {}),
        ...(providerType === 'independent' ? { lawyer_id: providerId } : {}),
      }))
      
      const { error } = await supabase.from('provider_services').insert(insertData)
      if (error) throw error
      toast.success(`تم تفعيل ${services.length} خدمة`)
      await loadMyServices(providerId)
    } catch (error) {
      console.error('Error enabling all:', error)
      toast.error('خطأ في تفعيل الخدمات')
    }
  }

  const enableAllInSubcategory = async (subcategoryId: string) => {
    if (!providerId) return
    const services = allServices.filter(s => s.subcategory_id === subcategoryId && !isServiceEnabled(s.id))
    if (services.length === 0) {
      toast('جميع الخدمات مفعّلة بالفعل', { icon: 'ℹ️' })
      return
    }
    
    try {
      const insertData = services.map(service => ({
        service_id: service.id,
        pricing_type: 'quote' as PricingType,
        commission_rate: commissionRate,
        is_active: true,
        ...(providerType === 'partner' ? { partner_id: providerId } : {}),
        ...(providerType === 'legal_arm' ? { legal_arm_id: providerId } : {}),
        ...(providerType === 'independent' ? { lawyer_id: providerId } : {}),
      }))
      
      const { error } = await supabase.from('provider_services').insert(insertData)
      if (error) throw error
      toast.success(`تم تفعيل ${services.length} خدمة`)
      await loadMyServices(providerId)
    } catch (error) {
      console.error('Error enabling all:', error)
      toast.error('خطأ في تفعيل الخدمات')
    }
  }

  const enableAllInPath = async (subcategoryId: string, pathId: string) => {
    if (!providerId) return
    const services = allServices.filter(s => s.subcategory_id === subcategoryId && s.path_id === pathId && !isServiceEnabled(s.id))
    if (services.length === 0) {
      toast('جميع الخدمات مفعّلة بالفعل', { icon: 'ℹ️' })
      return
    }
    
    try {
      const insertData = services.map(service => ({
        service_id: service.id,
        pricing_type: 'quote' as PricingType,
        commission_rate: commissionRate,
        is_active: true,
        ...(providerType === 'partner' ? { partner_id: providerId } : {}),
        ...(providerType === 'legal_arm' ? { legal_arm_id: providerId } : {}),
        ...(providerType === 'independent' ? { lawyer_id: providerId } : {}),
      }))
      
      const { error } = await supabase.from('provider_services').insert(insertData)
      if (error) throw error
      toast.success(`تم تفعيل ${services.length} خدمة`)
      await loadMyServices(providerId)
    } catch (error) {
      console.error('Error enabling all:', error)
      toast.error('خطأ في تفعيل الخدمات')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // عرض التحميل
  // ─────────────────────────────────────────────────────────────────────────
  
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: 48, height: 48, animation: 'spin 1s linear infinite', color: '#059669', margin: '0 auto 16px' }} />
          <p style={{ color: '#64748b' }}>جاري تحميل الخدمات...</p>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // الواجهة الرئيسية
  // ─────────────────────────────────────────────────────────────────────────
  
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      
      {/* الهيدر */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 12, backgroundColor: '#d1fae5', borderRadius: 12 }}>
              <Settings style={{ width: 24, height: 24, color: '#059669' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>إدارة الخدمات</h1>
              <p style={{ color: '#64748b', margin: 0 }}>اختر الخدمات التي تقدمها وحدد أسعارك</p>
            </div>
          </div>
          
          <button
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            <Plus style={{ width: 20, height: 20 }} />
            <span>إضافة خدمة جديدة</span>
          </button>
        </div>
        
        {/* الإحصائيات */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, backgroundColor: '#d1fae5', borderRadius: 8 }}>
                <Check style={{ width: 20, height: 20, color: '#059669' }} />
              </div>
              <div>
                <p style={{ fontSize: 24, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{myServices.length}</p>
                <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>خدماتي المفعّلة</p>
              </div>
            </div>
          </div>
          
          <div style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, backgroundColor: '#dbeafe', borderRadius: 8 }}>
                <Briefcase style={{ width: 20, height: 20, color: '#2563eb' }} />
              </div>
              <div>
                <p style={{ fontSize: 24, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{allServices.length}</p>
                <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>إجمالي الخدمات</p>
              </div>
            </div>
          </div>
          
          <div style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, backgroundColor: '#f3e8ff', borderRadius: 8 }}>
                <DollarSign style={{ width: 20, height: 20, color: '#9333ea' }} />
              </div>
              <div>
                <p style={{ fontSize: 24, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{commissionRate}%</p>
                <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>نسبة عمولتك</p>
              </div>
            </div>
          </div>
          
          <div style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, backgroundColor: '#fef3c7', borderRadius: 8 }}>
                <Filter style={{ width: 20, height: 20, color: '#d97706' }} />
              </div>
              <div>
                <p style={{ fontSize: 24, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{categories.length}</p>
                <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>مجال قانوني</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* السعر المنسوخ */}
      {copiedPrice && (
        <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Copy style={{ width: 16, height: 16, color: '#059669' }} />
            <span style={{ fontSize: 14, color: '#065f46' }}>
              سعر منسوخ: {copiedPrice.pricing_type === 'fixed' ? `${copiedPrice.fixed_price} ر.س` : 
                         copiedPrice.pricing_type === 'range' ? `${copiedPrice.min_price} - ${copiedPrice.max_price} ر.س` : 
                         'عرض سعر'}
            </span>
          </div>
          <button onClick={() => setCopiedPrice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669' }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}

      {/* الفلاتر */}
      <div style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 4 }}>المجال</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 8 }}
            >
              <option value="">كل المجالات</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name_ar}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 4 }}>المسار</label>
            <select
              value={filters.path}
              onChange={(e) => setFilters({ ...filters, path: e.target.value })}
              style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 8 }}
            >
              <option value="">كل المسارات</option>
              {paths.map(path => (
                <option key={path.id} value={path.id}>{path.name_ar}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 4 }}>بحث</label>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#9ca3af' }} />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="ابحث عن خدمة..."
                style={{ width: '100%', padding: '8px 40px 8px 8px', border: '1px solid #d1d5db', borderRadius: 8 }}
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filters.myServicesOnly}
                onChange={(e) => setFilters({ ...filters, myServicesOnly: e.target.checked })}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontSize: 14, color: '#374151' }}>خدماتي فقط</span>
            </label>
          </div>
        </div>
      </div>

      {/* قائمة المجالات */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {filteredCategories.map(category => {
          const { enabled, total } = getEnabledCountInCategory(category.id)
          const isExpanded = expandedCategories.has(category.id)
          const categorySubcategories = getSubcategoriesForCategory(category.id)
          
          return (
            <div key={category.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              {/* رأس المجال */}
              <div 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, cursor: 'pointer', backgroundColor: isExpanded ? '#f8fafc' : 'white' }}
                onClick={() => toggleCategory(category.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {isExpanded ? <ChevronDown style={{ width: 20, height: 20, color: '#94a3b8' }} /> : <ChevronRight style={{ width: 20, height: 20, color: '#94a3b8' }} />}
                  <h3 style={{ fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{category.name_ar}</h3>
                  <span style={{ fontSize: 14, color: '#64748b' }}>({enabled}/{total} مفعّل)</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); enableAllInCategory(category.id) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', fontSize: 14, color: '#059669', backgroundColor: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                >
                  <CheckSquare style={{ width: 16, height: 16 }} />
                  <span>تفعيل الكل</span>
                </button>
              </div>
              
              {/* التصنيفات الفرعية */}
              {isExpanded && (
                <div style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                  {categorySubcategories.map(subcategory => {
                    const subCount = getEnabledCountInSubcategory(subcategory.id)
                    const isSubExpanded = expandedSubcategories.has(subcategory.id)
                    const subcategoryPaths = getPathsForSubcategory(subcategory.id)
                    
                    return (
                      <div key={subcategory.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        {/* رأس التصنيف الفرعي */}
                        <div 
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 12px 32px', cursor: 'pointer' }}
                          onClick={() => toggleSubcategory(subcategory.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {isSubExpanded ? <ChevronDown style={{ width: 16, height: 16, color: '#94a3b8' }} /> : <ChevronRight style={{ width: 16, height: 16, color: '#94a3b8' }} />}
                            <span style={{ fontWeight: 500, color: '#475569' }}>{subcategory.name_ar}</span>
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>({subCount.enabled}/{subCount.total})</span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); enableAllInSubcategory(subcategory.id) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 12, color: '#059669', backgroundColor: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            <CheckSquare style={{ width: 12, height: 12 }} />
                            <span>تفعيل الكل</span>
                          </button>
                        </div>
                        
                        {/* المسارات */}
                        {isSubExpanded && (
                          <div style={{ backgroundColor: 'white' }}>
                            {subcategoryPaths.map(path => {
                              const pathKey = `${subcategory.id}-${path.id}`
                              const pathCount = getEnabledCountInPath(subcategory.id, path.id)
                              const isPathExpanded = expandedPaths.has(pathKey)
                              const pathServices = getServicesForSubcategoryAndPath(subcategory.id, path.id)
                              
                              if (pathServices.length === 0 && (filters.path || filters.search || filters.myServicesOnly)) return null
                              
                              return (
                                <div key={pathKey} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  {/* رأس المسار */}
                                  <div 
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 12px 48px', cursor: 'pointer' }}
                                    onClick={() => togglePath(pathKey)}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                      {isPathExpanded ? <ChevronDown style={{ width: 16, height: 16, color: '#94a3b8' }} /> : <ChevronRight style={{ width: 16, height: 16, color: '#94a3b8' }} />}
                                      <span style={{ color: '#64748b' }}>{path.name_ar}</span>
                                      <span style={{ fontSize: 12, color: '#cbd5e1' }}>({pathCount.enabled}/{pathCount.total})</span>
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); enableAllInPath(subcategory.id, path.id) }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 12, color: '#059669', backgroundColor: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      <CheckSquare style={{ width: 12, height: 12 }} />
                                      <span>تفعيل الكل</span>
                                    </button>
                                  </div>
                                  
                                  {/* الخدمات */}
                                  {isPathExpanded && (
                                    <div style={{ padding: '0 16px 8px 64px' }}>
                                      {pathServices.map(service => {
                                        const myServiceData = getMyServiceData(service.id)
                                        const enabled = isServiceEnabled(service.id)
                                        
                                        return (
                                          <div 
                                            key={service.id}
                                            style={{ 
                                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                                              padding: 12, marginBottom: 8, borderRadius: 8, 
                                              backgroundColor: enabled ? '#ecfdf5' : 'white',
                                              border: `1px solid ${enabled ? '#a7f3d0' : '#e2e8f0'}`
                                            }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                              {enabled ? (
                                                <div style={{ padding: 4, backgroundColor: '#10b981', borderRadius: 4 }}>
                                                  <Check style={{ width: 16, height: 16, color: 'white' }} />
                                                </div>
                                              ) : (
                                                <div style={{ padding: 4, backgroundColor: '#e2e8f0', borderRadius: 4 }}>
                                                  <Square style={{ width: 16, height: 16, color: '#94a3b8' }} />
                                                </div>
                                              )}
                                              <div>
                                                <p style={{ fontWeight: 500, color: enabled ? '#065f46' : '#374151', margin: 0 }}>{service.name_ar}</p>
                                                {enabled && myServiceData && (
                                                  <p style={{ fontSize: 14, color: '#059669', margin: '4px 0 0' }}>
                                                    {myServiceData.pricing_type === 'fixed' && `💰 ${myServiceData.fixed_price} ر.س`}
                                                    {myServiceData.pricing_type === 'range' && `💰 ${myServiceData.min_price} - ${myServiceData.max_price} ر.س`}
                                                    {myServiceData.pricing_type === 'quote' && '📝 عرض سعر'}
                                                    {' | '}
                                                    عمولتك: {commissionRate}%
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                              {enabled && myServiceData && (
                                                <button
                                                  onClick={() => copyPrice(myServiceData)}
                                                  style={{ padding: 8, color: '#64748b', backgroundColor: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                                                  title="نسخ السعر"
                                                >
                                                  <Copy style={{ width: 16, height: 16 }} />
                                                </button>
                                              )}
                                              
                                              {enabled ? (
                                                <>
                                                  <button
                                                    onClick={() => openServiceModal(service)}
                                                    style={{ padding: '4px 12px', fontSize: 14, color: '#059669', backgroundColor: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                                                  >
                                                    تعديل
                                                  </button>
                                                  <button
                                                    onClick={() => disableService(service.id)}
                                                    style={{ padding: 8, color: '#64748b', backgroundColor: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                                                  >
                                                    <ToggleRight style={{ width: 20, height: 20 }} />
                                                  </button>
                                                </>
                                              ) : (
                                                <button
                                                  onClick={() => openServiceModal(service)}
                                                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', fontSize: 14, backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                                                >
                                                  <ToggleLeft style={{ width: 16, height: 16 }} />
                                                  <span>تفعيل</span>
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* مودال تفعيل/تعديل الخدمة */}
      {showModal && selectedService && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 16, width: '100%', maxWidth: 500, margin: 16, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
                {getMyServiceData(selectedService.id) ? 'تعديل الخدمة' : 'تفعيل الخدمة'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ padding: 8, backgroundColor: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            
            {/* Content */}
            <div style={{ padding: 24 }}>
              {/* اسم الخدمة */}
              <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#f8fafc', borderRadius: 12 }}>
                <h3 style={{ fontWeight: 'bold', color: '#1e293b', margin: '0 0 4px' }}>{selectedService.name_ar}</h3>
                <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
                  {categories.find(c => c.id === selectedService.category_id)?.name_ar} • {paths.find(p => p.id === selectedService.path_id)?.name_ar}
                </p>
              </div>
              
              {/* نوع التسعير */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 12 }}>نوع التسعير</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {pricingTypes.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setServiceForm({ ...serviceForm, pricing_type: type.value as PricingType })}
                      style={{ 
                        padding: 12, border: `2px solid ${serviceForm.pricing_type === type.value ? '#059669' : '#e2e8f0'}`, 
                        borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                        backgroundColor: serviceForm.pricing_type === type.value ? '#ecfdf5' : 'white',
                        color: serviceForm.pricing_type === type.value ? '#059669' : '#374151',
                        cursor: 'pointer'
                      }}
                    >
                      <type.icon style={{ width: 20, height: 20 }} />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* حقول السعر */}
              {serviceForm.pricing_type === 'fixed' && (
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 8 }}>السعر (ر.س)</label>
                  <input
                    type="number"
                    value={serviceForm.fixed_price}
                    onChange={(e) => setServiceForm({ ...serviceForm, fixed_price: e.target.value })}
                    placeholder="مثال: 500"
                    style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 12 }}
                  />
                  {serviceForm.fixed_price && (
                    <p style={{ marginTop: 8, fontSize: 14, color: '#059669' }}>
                      💰 عمولتك: {commissionRate}% = {calculateCommission(Number(serviceForm.fixed_price))} ر.س
                    </p>
                  )}
                </div>
              )}
              
              {serviceForm.pricing_type === 'range' && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 8 }}>الحد الأدنى (ر.س)</label>
                      <input
                        type="number"
                        value={serviceForm.min_price}
                        onChange={(e) => setServiceForm({ ...serviceForm, min_price: e.target.value })}
                        placeholder="مثال: 300"
                        style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 12 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 8 }}>الحد الأعلى (ر.س)</label>
                      <input
                        type="number"
                        value={serviceForm.max_price}
                        onChange={(e) => setServiceForm({ ...serviceForm, max_price: e.target.value })}
                        placeholder="مثال: 800"
                        style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 12 }}
                      />
                    </div>
                  </div>
                  {serviceForm.min_price && serviceForm.max_price && (
                    <p style={{ marginTop: 8, fontSize: 14, color: '#059669' }}>
                      💰 عمولتك: {calculateCommission(Number(serviceForm.min_price))} - {calculateCommission(Number(serviceForm.max_price))} ر.س
                    </p>
                  )}
                </div>
              )}
              
              {serviceForm.pricing_type === 'quote' && (
                <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#fef3c7', borderRadius: 12 }}>
                  <p style={{ fontSize: 14, color: '#92400e', margin: 0 }}>
                    ⚠️ سيتم طلب عرض سعر منك عند استلام طلب هذه الخدمة
                  </p>
                </div>
              )}
              
              {/* مدة التنفيذ */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 8 }}>مدة التنفيذ المتوقعة (يوم) - اختياري</label>
                <div style={{ position: 'relative' }}>
                  <Clock style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, color: '#9ca3af' }} />
                  <input
                    type="number"
                    value={serviceForm.estimated_days}
                    onChange={(e) => setServiceForm({ ...serviceForm, estimated_days: e.target.value })}
                    placeholder="مثال: 7"
                    style={{ width: '100%', padding: '12px 40px 12px 12px', border: '1px solid #d1d5db', borderRadius: 12 }}
                  />
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div style={{ padding: 16, borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: '8px 16px', color: '#64748b', backgroundColor: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                إلغاء
              </button>
              <button
                onClick={saveService}
                disabled={isSaving}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 24px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: isSaving ? 0.5 : 1 }}
              >
                {isSaving ? <Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 20, height: 20 }} />}
                <span>{getMyServiceData(selectedService.id) ? 'حفظ التعديلات' : 'حفظ وتفعيل'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
