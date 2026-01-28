'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getLegalArmId } from '@/lib/cookies'

// ═══════════════════════════════════════════════════════════════
// 🏢 الهيكل التنظيمي للذراع القانوني
// 📅 تاريخ: 4 يناير 2026
// 🎯 الغرض: إدارة محامي الذراع (lawyers) + الأدوار (legal_arm_roles)
// 📋 الربط:
//    - المحامين: lawyers (legal_arm_id)
//    - الأقسام: ref_departments (مباشرة)
//    - المسميات: ref_job_titles (مباشرة)
//    - الأدوار: legal_arm_roles (legal_arm_id)
// ═══════════════════════════════════════════════════════════════

export default function LegalArmOrganizationPage() {
  // ─────────────────────────────────────────────────────────────
  // الحالة الأساسية
  // ─────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true)
  const [legalArmId, setLegalArmId] = useState<string | null>(null)
  const [legalArmCode, setLegalArmCode] = useState<string>('')
  
  // البيانات
  const [lawyers, setLawyers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [refDepartments, setRefDepartments] = useState<any[]>([])
  const [refJobTitles, setRefJobTitles] = useState<any[]>([])
  
  // الفلاتر
  const [filterDepartment, setFilterDepartment] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  
  // النوافذ المنبثقة
  const [showLawyerModal, setShowLawyerModal] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editingLawyer, setEditingLawyer] = useState<any>(null)
  const [editingRole, setEditingRole] = useState<any>(null)

  // ─────────────────────────────────────────────────────────────
  // نموذج إضافة/تعديل محامي
  // ─────────────────────────────────────────────────────────────
  const [lawyerForm, setLawyerForm] = useState({
    full_name: '',
    full_name_en: '',
    national_id: '',
    phone: '',
    email: '',
    license_number: '',
    license_expiry: '',
    department_id: '',
    job_title_id: '',
    role_id: '',
    years_of_experience: 0,
    salary: 0,
    hire_date: new Date().toISOString().split('T')[0],
    is_available: true
  })

  // ─────────────────────────────────────────────────────────────
  // نموذج إضافة/تعديل دور
  // ─────────────────────────────────────────────────────────────
  const [roleForm, setRoleForm] = useState({
    code: '',
    name_ar: '',
    name_en: '',
    description_ar: '',
    hierarchy_level: 5,
    permissions: {} as any,
    is_default: false,
    is_active: true
  })

  // ─────────────────────────────────────────────────────────────
  // تحميل البيانات
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const armId = getLegalArmId()
    setLegalArmId(armId)

    if (armId) {
      loadData(armId)
    } else {
      setIsLoading(false)
    }
  }, [])

  const loadData = async (armId: string) => {
    try {
      setIsLoading(true)

      // 1. جلب بيانات الذراع للحصول على arm_code
      const { data: armData } = await supabase
        .from('legal_arms')
        .select('arm_code')
        .eq('id', armId)
        .single()
      
      if (armData) {
        setLegalArmCode(armData.arm_code)
      }

      // 2. جلب الأقسام المرجعية
      const { data: refDepts } = await supabase
        .from('ref_departments')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      setRefDepartments(refDepts || [])

      // 3. جلب المسميات الوظيفية المرجعية
      const { data: refTitles } = await supabase
        .from('ref_job_titles')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      setRefJobTitles(refTitles || [])

      // 4. جلب أدوار الذراع
      const { data: rolesData } = await supabase
        .from('legal_arm_roles')
        .select('*')
        .eq('legal_arm_id', armId)
        .eq('is_active', true)
        .order('hierarchy_level')
      setRoles(rolesData || [])

      // 5. جلب محامي الذراع من جدول lawyers
      const { data: lawyersData } = await supabase
        .from('lawyers')
        .select(`
          *,
          department:ref_departments(id, name_ar, name_en),
          job_title:ref_job_titles(id, title_ar, title_en),
          role:legal_arm_roles(id, name_ar, name_en)
        `)
        .eq('legal_arm_id', armId)
        .order('created_at', { ascending: false })
      setLawyers(lawyersData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // إضافة محامي جديد
  // ─────────────────────────────────────────────────────────────
  const handleAddLawyer = async () => {
    if (!legalArmId) {
      toast.error('خطأ: لم يتم تحديد الذراع القانوني')
      return
    }

    // التحقق من البيانات المطلوبة
    if (!lawyerForm.full_name || !lawyerForm.phone || !lawyerForm.license_number) {
      toast.error('الرجاء تعبئة الحقول المطلوبة')
      return
    }

    try {
      // 1. إنشاء سجل في users أولاً للحصول على user_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          phone: lawyerForm.phone.startsWith('+966') ? lawyerForm.phone : '+966' + lawyerForm.phone,
          email: lawyerForm.email || null,
          full_name: lawyerForm.full_name,
          user_type: 'lawyer',
          national_id: lawyerForm.national_id || null
        })
        .select('id')
        .single()

      if (userError) {
        console.error('Error creating user:', userError)
        toast.error('خطأ في إنشاء حساب المستخدم')
        return
      }

      // 2. إنشاء سجل في lawyers مع legal_arm_id و user_id
      const { data: lawyerData, error: lawyerError } = await supabase
        .from('lawyers')
        .insert({
          user_id: userData.id,
          legal_arm_id: legalArmId,
          lawyer_type: 'legal_arm',
          full_name: lawyerForm.full_name,
          full_name_en: lawyerForm.full_name_en || null,
          national_id: lawyerForm.national_id || null,
          phone: lawyerForm.phone.startsWith('+966') ? lawyerForm.phone : '+966' + lawyerForm.phone,
          email: lawyerForm.email || null,
          license_number: lawyerForm.license_number,
          license_expiry: lawyerForm.license_expiry || null,
          department_id: lawyerForm.department_id || null,
          job_title_id: lawyerForm.job_title_id || null,
          role_id: lawyerForm.role_id || null,
          years_of_experience: lawyerForm.years_of_experience || 0,
          salary: lawyerForm.salary || 0,
          hire_date: lawyerForm.hire_date,
          is_available: lawyerForm.is_available,
          status: 'active'
        })
        .select('*, lawyer_code')
        .single()

      if (lawyerError) {
        console.error('Error creating lawyer:', lawyerError)
        // حذف المستخدم إذا فشل إنشاء المحامي
        await supabase.from('users').delete().eq('id', userData.id)
        toast.error('خطأ في إضافة المحامي')
        return
      }

      toast.success(`تم إضافة المحامي بنجاح - الكود: ${lawyerData.lawyer_code}`)
      setShowLawyerModal(false)
      resetLawyerForm()
      loadData(legalArmId)

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ غير متوقع')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // تعديل محامي
  // ─────────────────────────────────────────────────────────────
  const handleUpdateLawyer = async () => {
    if (!editingLawyer || !legalArmId) return

    try {
      const { error } = await supabase
        .from('lawyers')
        .update({
          full_name: lawyerForm.full_name,
          full_name_en: lawyerForm.full_name_en || null,
          national_id: lawyerForm.national_id || null,
          phone: lawyerForm.phone.startsWith('+966') ? lawyerForm.phone : '+966' + lawyerForm.phone,
          email: lawyerForm.email || null,
          license_number: lawyerForm.license_number,
          license_expiry: lawyerForm.license_expiry || null,
          department_id: lawyerForm.department_id || null,
          job_title_id: lawyerForm.job_title_id || null,
          role_id: lawyerForm.role_id || null,
          years_of_experience: lawyerForm.years_of_experience || 0,
          salary: lawyerForm.salary || 0,
          is_available: lawyerForm.is_available
        })
        .eq('id', editingLawyer.id)

      if (error) throw error

      toast.success('تم تحديث بيانات المحامي بنجاح')
      setShowLawyerModal(false)
      setEditingLawyer(null)
      resetLawyerForm()
      loadData(legalArmId)

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحديث البيانات')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // تعطيل/تفعيل محامي (بدلاً من الحذف)
  // ─────────────────────────────────────────────────────────────
  const handleToggleLawyerStatus = async (lawyer: any) => {
    if (!legalArmId) return

    const newStatus = lawyer.status === 'active' ? 'suspended' : 'active'
    const message = newStatus === 'active' ? 'تفعيل' : 'تعطيل'

    try {
      const { error } = await supabase
        .from('lawyers')
        .update({ status: newStatus })
        .eq('id', lawyer.id)

      if (error) throw error

      toast.success(`تم ${message} المحامي بنجاح`)
      loadData(legalArmId)

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // إضافة دور جديد
  // ─────────────────────────────────────────────────────────────
  const handleAddRole = async () => {
    if (!legalArmId) return

    if (!roleForm.name_ar || !roleForm.code) {
      toast.error('الرجاء تعبئة الحقول المطلوبة')
      return
    }

    try {
      const { error } = await supabase
        .from('legal_arm_roles')
        .insert({
          legal_arm_id: legalArmId,
          code: roleForm.code,
          name_ar: roleForm.name_ar,
          name_en: roleForm.name_en || null,
          description_ar: roleForm.description_ar || null,
          hierarchy_level: roleForm.hierarchy_level,
          permissions: roleForm.permissions,
          is_default: roleForm.is_default,
          is_active: roleForm.is_active
        })

      if (error) throw error

      toast.success('تم إضافة الدور بنجاح')
      setShowRoleModal(false)
      resetRoleForm()
      loadData(legalArmId)

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في إضافة الدور')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // تعديل دور
  // ─────────────────────────────────────────────────────────────
  const handleUpdateRole = async () => {
    if (!editingRole || !legalArmId) return

    try {
      const { error } = await supabase
        .from('legal_arm_roles')
        .update({
          code: roleForm.code,
          name_ar: roleForm.name_ar,
          name_en: roleForm.name_en || null,
          description_ar: roleForm.description_ar || null,
          hierarchy_level: roleForm.hierarchy_level,
          permissions: roleForm.permissions,
          is_default: roleForm.is_default,
          is_active: roleForm.is_active
        })
        .eq('id', editingRole.id)

      if (error) throw error

      toast.success('تم تحديث الدور بنجاح')
      setShowRoleModal(false)
      setEditingRole(null)
      resetRoleForm()
      loadData(legalArmId)

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحديث الدور')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // إعادة تعيين النماذج
  // ─────────────────────────────────────────────────────────────
  const resetLawyerForm = () => {
    setLawyerForm({
      full_name: '',
      full_name_en: '',
      national_id: '',
      phone: '',
      email: '',
      license_number: '',
      license_expiry: '',
      department_id: '',
      job_title_id: '',
      role_id: '',
      years_of_experience: 0,
      salary: 0,
      hire_date: new Date().toISOString().split('T')[0],
      is_available: true
    })
  }

  const resetRoleForm = () => {
    setRoleForm({
      code: '',
      name_ar: '',
      name_en: '',
      description_ar: '',
      hierarchy_level: 5,
      permissions: {},
      is_default: false,
      is_active: true
    })
  }

  // ─────────────────────────────────────────────────────────────
  // فتح نافذة التعديل
  // ─────────────────────────────────────────────────────────────
  const openEditLawyer = (lawyer: any) => {
    setEditingLawyer(lawyer)
    setLawyerForm({
      full_name: lawyer.full_name || '',
      full_name_en: lawyer.full_name_en || '',
      national_id: lawyer.national_id || '',
      phone: lawyer.phone?.replace('+966', '') || '',
      email: lawyer.email || '',
      license_number: lawyer.license_number || '',
      license_expiry: lawyer.license_expiry || '',
      department_id: lawyer.department_id || '',
      job_title_id: lawyer.job_title_id || '',
      role_id: lawyer.role_id || '',
      years_of_experience: lawyer.years_of_experience || 0,
      salary: lawyer.salary || 0,
      hire_date: lawyer.hire_date || new Date().toISOString().split('T')[0],
      is_available: lawyer.is_available ?? true
    })
    setShowLawyerModal(true)
  }

  const openEditRole = (role: any) => {
    setEditingRole(role)
    setRoleForm({
      code: role.code || '',
      name_ar: role.name_ar || '',
      name_en: role.name_en || '',
      description_ar: role.description_ar || '',
      hierarchy_level: role.hierarchy_level || 5,
      permissions: role.permissions || {},
      is_default: role.is_default || false,
      is_active: role.is_active ?? true
    })
    setShowRoleModal(true)
  }

  // ─────────────────────────────────────────────────────────────
  // تصفية المحامين
  // ─────────────────────────────────────────────────────────────
  const filteredLawyers = lawyers.filter(lawyer => {
    const matchSearch = !searchTerm || 
      lawyer.full_name?.includes(searchTerm) ||
      lawyer.lawyer_code?.includes(searchTerm) ||
      lawyer.license_number?.includes(searchTerm)
    
    const matchDept = !filterDepartment || lawyer.department_id === filterDepartment

    return matchSearch && matchDept
  })

  // ─────────────────────────────────────────────────────────────
  // التجميع حسب القسم
  // ─────────────────────────────────────────────────────────────
  const managements = refDepartments.filter(d => d.type === 'management')
  const getDepartmentsForManagement = (managementId: string) => {
    return refDepartments.filter(d => d.parent_id === managementId)
  }

  // ─────────────────────────────────────────────────────────────
  // العرض
  // ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (!legalArmId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-red-500 text-xl">خطأ: لم يتم تسجيل الدخول</p>
          <p className="text-slate-500 mt-2">الرجاء تسجيل الدخول للوصول لهذه الصفحة</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6" dir="rtl">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* العنوان */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <span className="text-2xl">🏛️</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">الهيكل التنظيمي</h1>
            <p className="text-slate-500">إدارة المحامين والأدوار والصلاحيات</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* الإحصائيات */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">👨‍⚖️</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{lawyers.length}</p>
              <p className="text-sm text-slate-500">المحامين</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">✅</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {lawyers.filter(l => l.status === 'active').length}
              </p>
              <p className="text-sm text-slate-500">نشط</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">🎭</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{roles.length}</p>
              <p className="text-sm text-slate-500">الأدوار</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">🏢</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{managements.length}</p>
              <p className="text-sm text-slate-500">الإدارات</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* التبويبات */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* شريط الأدوات */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-3 items-center">
            {/* البحث */}
            <div className="relative">
              <input
                type="text"
                placeholder="بحث بالاسم أو الكود..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 pl-4 pr-10 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            </div>

            {/* فلتر القسم */}
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
            >
              <option value="">كل الأقسام</option>
              {refDepartments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name_ar}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                resetRoleForm()
                setEditingRole(null)
                setShowRoleModal(true)
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <span>+</span>
              <span>إضافة دور</span>
            </button>
            <button
              onClick={() => {
                resetLawyerForm()
                setEditingLawyer(null)
                setShowLawyerModal(true)
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <span>+</span>
              <span>إضافة محامي</span>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* قائمة المحامين */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span>👨‍⚖️</span>
            <span>المحامين ({filteredLawyers.length})</span>
          </h3>

          {filteredLawyers.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <span className="text-4xl block mb-2">👨‍⚖️</span>
              <p>لا يوجد محامين. أضف أول محامي!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">الكود</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">الاسم</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">رقم الرخصة</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">القسم</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">المسمى</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">الدور</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">الحالة</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLawyers.map((lawyer) => (
                    <tr key={lawyer.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          {lawyer.lawyer_code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-800">{lawyer.full_name}</p>
                          {lawyer.full_name_en && (
                            <p className="text-sm text-slate-400">{lawyer.full_name_en}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lawyer.license_number}</td>
                      <td className="px-4 py-3 text-slate-600">{lawyer.department?.name_ar || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{lawyer.job_title?.title_ar || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{lawyer.role?.name_ar || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          lawyer.status === 'active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {lawyer.status === 'active' ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditLawyer(lawyer)}
                            className="text-blue-500 hover:text-blue-700 p-1"
                            title="تعديل"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleToggleLawyerStatus(lawyer)}
                            className={`p-1 ${lawyer.status === 'active' ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}
                            title={lawyer.status === 'active' ? 'تعطيل' : 'تفعيل'}
                          >
                            {lawyer.status === 'active' ? '🚫' : '✅'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* قائمة الأدوار */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="p-4 border-t border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span>🎭</span>
            <span>الأدوار والصلاحيات ({roles.length})</span>
          </h3>

          {roles.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <span className="text-4xl block mb-2">🎭</span>
              <p>لا يوجد أدوار. أضف أول دور!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map((role) => (
                <div key={role.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-800">{role.name_ar}</h4>
                      <p className="text-sm text-slate-500">{role.code}</p>
                    </div>
                    <button
                      onClick={() => openEditRole(role)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      ✏️
                    </button>
                  </div>
                  {role.description_ar && (
                    <p className="text-sm text-slate-600 mt-2">{role.description_ar}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                      المستوى: {role.hierarchy_level}
                    </span>
                    {role.is_default && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        افتراضي
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* نافذة إضافة/تعديل محامي */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showLawyerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">
                {editingLawyer ? 'تعديل بيانات المحامي' : 'إضافة محامي جديد'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {/* الاسم */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    الاسم بالعربي <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={lawyerForm.full_name}
                    onChange={(e) => setLawyerForm({...lawyerForm, full_name: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    placeholder="الاسم الكامل"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    الاسم بالإنجليزي
                  </label>
                  <input
                    type="text"
                    value={lawyerForm.full_name_en}
                    onChange={(e) => setLawyerForm({...lawyerForm, full_name_en: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    placeholder="Full Name"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* الهوية والجوال */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    رقم الهوية
                  </label>
                  <input
                    type="text"
                    value={lawyerForm.national_id}
                    onChange={(e) => setLawyerForm({...lawyerForm, national_id: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    placeholder="1000000000"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    رقم الجوال <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <span className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-500">
                      +966
                    </span>
                    <input
                      type="text"
                      value={lawyerForm.phone}
                      onChange={(e) => setLawyerForm({...lawyerForm, phone: e.target.value.replace(/\D/g, '')})}
                      className="flex-1 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                      placeholder="5xxxxxxxx"
                      dir="ltr"
                      maxLength={9}
                    />
                  </div>
                </div>
              </div>

              {/* البريد والرخصة */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={lawyerForm.email}
                    onChange={(e) => setLawyerForm({...lawyerForm, email: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    placeholder="email@example.com"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    رقم الرخصة <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={lawyerForm.license_number}
                    onChange={(e) => setLawyerForm({...lawyerForm, license_number: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    placeholder="رقم رخصة المحاماة"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* تاريخ انتهاء الرخصة */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    تاريخ انتهاء الرخصة
                  </label>
                  <input
                    type="date"
                    value={lawyerForm.license_expiry}
                    onChange={(e) => setLawyerForm({...lawyerForm, license_expiry: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    تاريخ التعيين
                  </label>
                  <input
                    type="date"
                    value={lawyerForm.hire_date}
                    onChange={(e) => setLawyerForm({...lawyerForm, hire_date: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* القسم والمسمى */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    القسم
                  </label>
                  <select
                    value={lawyerForm.department_id}
                    onChange={(e) => setLawyerForm({...lawyerForm, department_id: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- اختر القسم --</option>
                    {refDepartments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name_ar}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    المسمى الوظيفي
                  </label>
                  <select
                    value={lawyerForm.job_title_id}
                    onChange={(e) => setLawyerForm({...lawyerForm, job_title_id: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- اختر المسمى --</option>
                    {refJobTitles.map(title => (
                      <option key={title.id} value={title.id}>{title.title_ar}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* الدور والخبرة */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    الدور
                  </label>
                  <select
                    value={lawyerForm.role_id}
                    onChange={(e) => setLawyerForm({...lawyerForm, role_id: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- اختر الدور --</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name_ar}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    سنوات الخبرة
                  </label>
                  <input
                    type="number"
                    value={lawyerForm.years_of_experience}
                    onChange={(e) => setLawyerForm({...lawyerForm, years_of_experience: parseInt(e.target.value) || 0})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    min="0"
                  />
                </div>
              </div>

              {/* الراتب ومتاح */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    الراتب (ريال)
                  </label>
                  <input
                    type="number"
                    value={lawyerForm.salary}
                    onChange={(e) => setLawyerForm({...lawyerForm, salary: parseInt(e.target.value) || 0})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    min="0"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lawyerForm.is_available}
                      onChange={(e) => setLawyerForm({...lawyerForm, is_available: e.target.checked})}
                      className="w-5 h-5 text-purple-500 rounded focus:ring-purple-500"
                    />
                    <span className="text-slate-700">متاح لاستقبال الطلبات</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowLawyerModal(false)
                  setEditingLawyer(null)
                  resetLawyerForm()
                }}
                className="px-6 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                onClick={editingLawyer ? handleUpdateLawyer : handleAddLawyer}
                className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg"
              >
                {editingLawyer ? 'تحديث' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* نافذة إضافة/تعديل دور */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">
                {editingRole ? 'تعديل الدور' : 'إضافة دور جديد'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    الكود <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={roleForm.code}
                    onChange={(e) => setRoleForm({...roleForm, code: e.target.value.toUpperCase()})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    placeholder="MANAGER"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    المستوى
                  </label>
                  <input
                    type="number"
                    value={roleForm.hierarchy_level}
                    onChange={(e) => setRoleForm({...roleForm, hierarchy_level: parseInt(e.target.value) || 5})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    min="1"
                    max="10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    الاسم بالعربي <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={roleForm.name_ar}
                    onChange={(e) => setRoleForm({...roleForm, name_ar: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    placeholder="مدير"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    الاسم بالإنجليزي
                  </label>
                  <input
                    type="text"
                    value={roleForm.name_en}
                    onChange={(e) => setRoleForm({...roleForm, name_en: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    placeholder="Manager"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  الوصف
                </label>
                <textarea
                  value={roleForm.description_ar}
                  onChange={(e) => setRoleForm({...roleForm, description_ar: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                  placeholder="وصف الدور والمسؤوليات..."
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roleForm.is_default}
                    onChange={(e) => setRoleForm({...roleForm, is_default: e.target.checked})}
                    className="w-5 h-5 text-purple-500 rounded focus:ring-purple-500"
                  />
                  <span className="text-slate-700">دور افتراضي</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roleForm.is_active}
                    onChange={(e) => setRoleForm({...roleForm, is_active: e.target.checked})}
                    className="w-5 h-5 text-purple-500 rounded focus:ring-purple-500"
                  />
                  <span className="text-slate-700">نشط</span>
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRoleModal(false)
                  setEditingRole(null)
                  resetRoleForm()
                }}
                className="px-6 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                onClick={editingRole ? handleUpdateRole : handleAddRole}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                {editingRole ? 'تحديث' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
