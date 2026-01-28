'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getLegalArmId } from '@/lib/cookies'
import { 
  Briefcase, Plus, Edit, Trash2, X,
  Shield, Users, DollarSign, Building2
} from 'lucide-react'

const categoryConfig: Record<string, { label: string; icon: any; color: string }> = {
  'legal': { label: 'قانوني', icon: Shield, color: 'purple' },
  'administrative': { label: 'إداري', icon: Building2, color: 'slate' },
  'financial': { label: 'مالي', icon: DollarSign, color: 'emerald' },
  'hr': { label: 'موارد بشرية', icon: Users, color: 'blue' },
  'other': { label: 'أخرى', icon: Briefcase, color: 'gray' },
}

export default function LegalArmJobTitlesPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [jobTitles, setJobTitles] = useState<any[]>([])
  const [refJobTitles, setRefJobTitles] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingTitle, setEditingTitle] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const [selectedCategory, setSelectedCategory] = useState('')
  const [formData, setFormData] = useState({
    ref_job_title_id: '',
    custom_title: '',
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const armId = getLegalArmId()

      const { data: refTitles } = await supabase
        .from('ref_job_titles')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('sort_order')

      setRefJobTitles(refTitles || [])

      if (armId) {
        const { data: titles } = await supabase
          .from('legal_arm_job_titles')
          .select('*, ref:ref_job_title_id(*)')
          .eq('legal_arm_id', armId)
          .eq('is_active', true)
          .order('sort_order')

        setJobTitles(titles || [])
      }

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const armId = getLegalArmId()
      if (!armId) {
        toast.error('يرجى تسجيل الدخول')
        return
      }

      if (!formData.ref_job_title_id && !formData.custom_title) {
        toast.error('يجب اختيار مسمى أو إدخال مسمى مخصص')
        return
      }

      const refTitle = refJobTitles.find(t => t.id === formData.ref_job_title_id)
      
      const titleData = {
        legal_arm_id: armId,
        ref_job_title_id: formData.ref_job_title_id || null,
        title_ar: refTitle?.title_ar || formData.custom_title,
        title_en: refTitle?.title_en || formData.custom_title,
        custom_title: formData.custom_title || null,
        requires_license: refTitle?.requires_license || false,
        hierarchy_level: refTitle?.hierarchy_level || 1,
        is_active: true,
        sort_order: jobTitles.length + 1,
      }

      if (editingTitle) {
        const { error } = await supabase
          .from('legal_arm_job_titles')
          .update(titleData)
          .eq('id', editingTitle.id)

        if (error) throw error
        toast.success('✅ تم تحديث المسمى')
      } else {
        const { error } = await supabase
          .from('legal_arm_job_titles')
          .insert(titleData)

        if (error) throw error
        toast.success('✅ تم إضافة المسمى')
      }

      setShowModal(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('legal_arm_job_titles')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
      toast.success('✅ تم حذف المسمى')
      setShowDeleteConfirm(null)
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  const resetForm = () => {
    setFormData({ ref_job_title_id: '', custom_title: '' })
    setSelectedCategory('')
    setEditingTitle(null)
  }

  const openEditModal = (title: any) => {
    setEditingTitle(title)
    setFormData({
      ref_job_title_id: title.ref_job_title_id || '',
      custom_title: title.custom_title || '',
    })
    if (title.ref?.category) {
      setSelectedCategory(title.ref.category)
    }
    setShowModal(true)
  }

  const categories = Array.from(new Set(refJobTitles.map(t => t.category))).filter(Boolean)
    
  const getTitlesByCategory = (category: string) => {
    return refJobTitles.filter(t => t.category === category)
  }

  const selectedCategoryLabel = categoryConfig[selectedCategory]?.label || ''

  const groupedTitles = jobTitles.reduce((acc: any, title) => {
    const cat = title.ref?.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(title)
    return acc
  }, {})

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">💼 المسميات الوظيفية</h1>
          <p className="text-slate-500 mt-1">إجمالي {jobTitles.length} مسمى وظيفي</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
        >
          <Plus className="w-5 h-5" />
          إضافة مسمى
        </button>
      </div>

      {Object.entries(groupedTitles).length > 0 ? (
        Object.entries(groupedTitles).map(([category, titles]: [string, any]) => {
          const config = categoryConfig[category] || categoryConfig['other']
          const Icon = config.icon
          
          return (
            <div key={category} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className={`px-4 py-3 bg-${config.color}-50 border-b flex items-center gap-2`}>
                <Icon className={`w-5 h-5 text-${config.color}-600`} />
                <h2 className="font-bold text-slate-800">{config.label}</h2>
                <span className="text-sm text-slate-500">({titles.length})</span>
              </div>
              <div className="divide-y">
                {titles.map((title: any) => (
                  <div key={title.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{title.title_ar}</span>
                        {title.title_en && (
                          <span className="text-sm text-slate-400">({title.title_en})</span>
                        )}
                      </div>
                      {(title.ref?.requires_license || title.requires_license) && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          يتطلب ترخيص
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditModal(title)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => setShowDeleteConfirm(title.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      ) : (
        <div className="text-center py-12 bg-white rounded-xl">
          <Briefcase className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-800 mb-2">لا توجد مسميات وظيفية</h3>
          <p className="text-slate-500 mb-4">ابدأ بإضافة المسميات الوظيفية للذراع</p>
          <button onClick={() => { resetForm(); setShowModal(true) }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg">
            إضافة مسمى
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">
                {editingTitle ? '✏️ تعديل مسمى' : '➕ إضافة مسمى جديد'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">1. اختر الفئة</label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map(cat => {
                    const config = categoryConfig[cat] || categoryConfig['other']
                    const Icon = config.icon
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(cat)
                          setFormData({ ...formData, ref_job_title_id: '', custom_title: '' })
                        }}
                        className={`p-3 rounded-lg border-2 flex items-center gap-2 transition-all ${
                          selectedCategory === cat ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${selectedCategory === cat ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span className={selectedCategory === cat ? 'text-emerald-700 font-medium' : 'text-slate-600'}>
                          {config.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedCategory && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    2. اختر المسمى من {selectedCategoryLabel}
                  </label>
                  <select
                    value={formData.ref_job_title_id}
                    onChange={(e) => setFormData({ ...formData, ref_job_title_id: e.target.value, custom_title: '' })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- اختر المسمى --</option>
                    {getTitlesByCategory(selectedCategory).map(title => (
                      <option key={title.id} value={title.id}>
                        {title.title_ar} {title.requires_license ? '🔐' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedCategory && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-slate-500">أو أضف مسمى مخصص</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">مسمى مخصص</label>
                    <input
                      type="text"
                      value={formData.custom_title}
                      onChange={(e) => setFormData({ ...formData, custom_title: e.target.value, ref_job_title_id: '' })}
                      placeholder={`مسمى جديد في فئة ${selectedCategoryLabel}`}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!selectedCategory || (!formData.ref_job_title_id && !formData.custom_title)}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700"
                >
                  {editingTitle ? 'تحديث' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">حذف المسمى الوظيفي</h3>
            <p className="text-slate-500 mb-6">هل أنت متأكد من حذف هذا المسمى؟</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg">
                إلغاء
              </button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">
                حذف
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
