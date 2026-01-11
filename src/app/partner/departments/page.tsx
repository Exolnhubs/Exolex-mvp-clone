'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { 
  Building2, Plus, Edit, Trash2, X,
  CheckCircle, XCircle
} from 'lucide-react'

export default function DepartmentsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [departments, setDepartments] = useState<any[]>([])
  const [refDepartments, setRefDepartments] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingDept, setEditingDept] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const [selectedManagement, setSelectedManagement] = useState('')
  const [formData, setFormData] = useState({
    ref_department_id: '',
    custom_name: '',
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const partnerId = localStorage.getItem('exolex_partner_id')

      const { data: refDepts } = await supabase
        .from('ref_departments')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      setRefDepartments(refDepts || [])

      if (partnerId) {
        const { data: depts } = await supabase
          .from('partner_departments')
          .select('*, ref:ref_department_id(*)')
          .eq('partner_id', partnerId)
          .order('sort_order')

        setDepartments(depts || [])
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
      const partnerId = localStorage.getItem('exolex_partner_id')
      if (!partnerId) {
        toast.error('يرجى تسجيل الدخول')
        return
      }

      if (!formData.ref_department_id && !formData.custom_name) {
        toast.error('يجب اختيار قسم أو إدخال اسم مخصص')
        return
      }

      const refDept = refDepartments.find(d => d.id === formData.ref_department_id)
      
      const deptData = {
        partner_id: partnerId,
        ref_department_id: formData.ref_department_id || null,
        code: refDept?.code || `CUSTOM_${Date.now()}`,
        name_ar: refDept?.name_ar || formData.custom_name,
        name_en: refDept?.name_en || formData.custom_name,
        custom_name: formData.custom_name || null,
        can_receive_platform_requests: refDept?.is_legal || false,
        is_active: true,
        sort_order: departments.length + 1,
      }

      if (editingDept) {
        const { error } = await supabase
          .from('partner_departments')
          .update(deptData)
          .eq('id', editingDept.id)

        if (error) throw error
        toast.success('✅ تم تحديث القسم')
      } else {
        const { error } = await supabase
          .from('partner_departments')
          .insert(deptData)

        if (error) throw error
        toast.success('✅ تم إضافة القسم')
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
        .from('partner_departments')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
      toast.success('✅ تم حذف القسم')
      setShowDeleteConfirm(null)
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  const resetForm = () => {
    setFormData({ ref_department_id: '', custom_name: '' })
    setSelectedManagement('')
    setEditingDept(null)
  }

  const openEditModal = (dept: any) => {
    setEditingDept(dept)
    setFormData({
      ref_department_id: dept.ref_department_id || '',
      custom_name: dept.custom_name || '',
    })
    // محاولة تحديد الإدارة الأم
    const refDept = refDepartments.find(d => d.id === dept.ref_department_id)
    if (refDept?.parent_id) {
      setSelectedManagement(refDept.parent_id)
    }
    setShowModal(true)
  }

  // الإدارات
  const managements = refDepartments.filter(d => d.type === 'management')
  
  // الأقسام المرتبطة بالإدارة المختارة
  const getRelatedDepartments = (managementId: string) => {
    return refDepartments.filter(d => d.parent_id === managementId)
  }

  // اسم الإدارة المختارة
  const selectedManagementName = managements.find(m => m.id === selectedManagement)?.name_ar || ''

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🏢 إدارة الأقسام</h1>
          <p className="text-slate-500 mt-1">إجمالي {departments.filter(d => d.is_active).length} قسم</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          <Plus className="w-5 h-5" />
          إضافة قسم
        </button>
      </div>

      {/* قائمة الأقسام */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.filter(d => d.is_active).map(dept => (
          <div key={dept.id} className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  dept.can_receive_platform_requests 
                    ? 'bg-purple-100' 
                    : 'bg-slate-100'
                }`}>
                  <Building2 className={`w-6 h-6 ${
                    dept.can_receive_platform_requests 
                      ? 'text-purple-600' 
                      : 'text-slate-600'
                  }`} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{dept.name_ar}</h3>
                  {dept.name_en && (
                    <p className="text-sm text-slate-500">{dept.name_en}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditModal(dept)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(dept.id)}
                  className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="mt-4 flex items-center gap-2 text-sm">
              {dept.can_receive_platform_requests ? (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                  <CheckCircle className="w-4 h-4" />
                  قسم قانوني
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  <XCircle className="w-4 h-4" />
                  قسم إداري
                </span>
              )}
            </div>
          </div>
        ))}

        {departments.filter(d => d.is_active).length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-xl">
            <Building2 className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-800 mb-2">لا توجد أقسام</h3>
            <p className="text-slate-500 mb-4">ابدأ بإضافة الأقسام لشركتك</p>
            <button
              onClick={() => { resetForm(); setShowModal(true) }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              إضافة قسم
            </button>
          </div>
        )}
      </div>

      {/* Modal إضافة/تعديل */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">
                {editingDept ? '✏️ تعديل قسم' : '➕ إضافة قسم جديد'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* الخطوة 1: اختيار الإدارة */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  1. اختر الإدارة
                </label>
                <select
                  value={selectedManagement}
                  onChange={(e) => {
                    setSelectedManagement(e.target.value)
                    setFormData({ ...formData, ref_department_id: '', custom_name: '' })
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">-- اختر الإدارة --</option>
                  {managements.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name_ar} {dept.is_legal ? '⚖️' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* الخطوة 2: اختيار القسم */}
              {selectedManagement && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    2. اختر القسم من {selectedManagementName}
                  </label>
                  <select
                    value={formData.ref_department_id}
                    onChange={(e) => setFormData({ ...formData, ref_department_id: e.target.value, custom_name: '' })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- اختر القسم --</option>
                    {getRelatedDepartments(selectedManagement).map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name_ar} {dept.is_legal ? '⚖️' : ''}
                      </option>
                    ))}
                  </select>
                  
                  {getRelatedDepartments(selectedManagement).length === 0 && (
                    <p className="text-sm text-amber-600 mt-2 p-2 bg-amber-50 rounded-lg">
                      ⚠️ لا توجد أقسام مسجلة لهذه الإدارة. أضف اسم مخصص أدناه.
                    </p>
                  )}
                </div>
              )}

              {/* أو إضافة قسم مخصص */}
              {selectedManagement && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-slate-500">أو أضف قسم مخصص</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      اسم القسم المخصص
                    </label>
                    <input
                      type="text"
                      value={formData.custom_name}
                      onChange={(e) => setFormData({ ...formData, custom_name: e.target.value, ref_department_id: '' })}
                      placeholder={`قسم جديد في ${selectedManagementName}`}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </>
              )}

              {/* أزرار */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!selectedManagement || (!formData.ref_department_id && !formData.custom_name)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
                >
                  {editingDept ? 'تحديث' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal تأكيد الحذف */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">حذف القسم</h3>
            <p className="text-slate-500 mb-6">هل أنت متأكد من حذف هذا القسم؟</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
