'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getPartnerId } from '@/lib/cookies'

// ═══════════════════════════════════════════════════════════════
// 🏢 الهيكل التنظيمي للشريك القانوني
// 📅 تاريخ: 4 يناير 2026 - نسخة مصححة
// 🎯 الغرض: إدارة موظفي الشريك (partner_employees) + الأدوار (partner_roles)
// 📋 الربط:
//    - الموظفين: partner_employees (partner_id)
//    - الأقسام: ref_departments (مباشرة)
//    - المسميات: ref_job_titles (مباشرة)
//    - الأدوار: partner_roles (partner_id)
// ═══════════════════════════════════════════════════════════════
// 📋 أعمدة partner_employees المستخدمة:
//    - status: 'active' | 'inactive' | 'suspended' (وليس is_active)
//    - experience_years (وليس years_of_experience)
//    - can_open_cases: boolean (للمحامي الذي يفتح قضايا)
//    - license_number: إذا موجود = محامي مرخص
// ═══════════════════════════════════════════════════════════════

export default function PartnerOrganizationPage() {
  // ─────────────────────────────────────────────────────────────
  // الحالة الأساسية
  // ─────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true)
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [partnerCode, setPartnerCode] = useState<string>('')
  
  // البيانات
  const [employees, setEmployees] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [refDepartments, setRefDepartments] = useState<any[]>([])
  const [refJobTitles, setRefJobTitles] = useState<any[]>([])
  
  // الفلاتر
  const [filterDepartment, setFilterDepartment] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  
  // النوافذ المنبثقة
  const [showEmployeeModal, setShowEmployeeModal] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<any>(null)
  const [editingRole, setEditingRole] = useState<any>(null)

  // ─────────────────────────────────────────────────────────────
  // نموذج إضافة/تعديل موظف
  // ─────────────────────────────────────────────────────────────
  const [employeeForm, setEmployeeForm] = useState({
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
    experience_years: 0,
    salary: 0,
    hire_date: new Date().toISOString().split('T')[0],
    status: 'active',
    is_lawyer: false,  // للواجهة فقط - يتحدد بوجود license_number
    can_open_cases: false
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
    const pId = getPartnerId()
    setPartnerId(pId)

    if (pId) {
      loadData(pId)
    } else {
      setIsLoading(false)
    }
  }, [])

  const loadData = async (pId: string) => {
    try {
      setIsLoading(true)

      // 1. جلب بيانات الشريك للحصول على partner_code
      const { data: partnerData } = await supabase
        .from('partners')
        .select('partner_code')
        .eq('id', pId)
        .single()
      
      if (partnerData) {
        setPartnerCode(partnerData.partner_code)
      }

      // 2. جلب الأقسام المرجعية (is_active وليس status)
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

      // 4. جلب أدوار الشريك
      const { data: rolesData } = await supabase
        .from('partner_roles')
        .select('*')
        .eq('partner_id', pId)
        .eq('is_active', true)
        .order('hierarchy_level')
      setRoles(rolesData || [])

      // 5. جلب موظفي الشريك
      const { data: employeesData } = await supabase
        .from('partner_employees')
        .select(`
          *,
          department:ref_departments(id, name_ar, name_en),
          job_title:ref_job_titles(id, title_ar, title_en),
          role:partner_roles(id, name_ar, name_en)
        `)
        .eq('partner_id', pId)
        .order('created_at', { ascending: false })
      setEmployees(employeesData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // إضافة موظف جديد
  // ─────────────────────────────────────────────────────────────
  const handleAddEmployee = async () => {
    if (!partnerId) {
      toast.error('خطأ: لم يتم تحديد الشريك القانوني')
      return
    }

    // التحقق من البيانات المطلوبة
    if (!employeeForm.full_name || !employeeForm.phone) {
      toast.error('الرجاء تعبئة الحقول المطلوبة')
      return
    }

    // التحقق من رقم الرخصة إذا كان محامي
    if (employeeForm.is_lawyer && !employeeForm.license_number) {
      toast.error('رقم الرخصة مطلوب للمحامين')
      return
    }

    try {
      // 1. إنشاء سجل في users أولاً للحصول على user_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          phone: employeeForm.phone.startsWith('+966') ? employeeForm.phone : '+966' + employeeForm.phone,
          email: employeeForm.email || null,
          full_name: employeeForm.full_name,
          user_type: 'partner_employee',
          national_id: employeeForm.national_id || null
        })
        .select('id')
        .single()

      if (userError) {
        console.error('Error creating user:', userError)
        toast.error('خطأ في إنشاء حساب المستخدم: ' + userError.message)
        return
      }

      // 2. إنشاء سجل في partner_employees
      const employeeData: any = {
        user_id: userData.id,
        partner_id: partnerId,
        full_name: employeeForm.full_name,
        full_name_en: employeeForm.full_name_en || null,
        national_id: employeeForm.national_id || null,
        phone: employeeForm.phone.startsWith('+966') ? employeeForm.phone : '+966' + employeeForm.phone,
        email: employeeForm.email || null,
        department_id: employeeForm.department_id || null,
        job_title_id: employeeForm.job_title_id || null,
        role_id: employeeForm.role_id || null,
        experience_years: employeeForm.experience_years || 0,
        salary: employeeForm.salary || 0,
        hire_date: employeeForm.hire_date,
        status: employeeForm.status || 'active',
        can_open_cases: employeeForm.can_open_cases || false
      }

      // إضافة بيانات الرخصة إذا كان محامي
      if (employeeForm.is_lawyer && employeeForm.license_number) {
        employeeData.license_number = employeeForm.license_number
        employeeData.license_expiry = employeeForm.license_expiry || null
      }

      const { data: newEmployee, error: employeeError } = await supabase
        .from('partner_employees')
        .insert(employeeData)
        .select('*, employee_code')
        .single()

      if (employeeError) {
        console.error('Error creating employee:', employeeError)
        // حذف المستخدم إذا فشل إنشاء الموظف
        await supabase.from('users').delete().eq('id', userData.id)
        toast.error('خطأ في إضافة الموظف: ' + employeeError.message)
        return
      }

      toast.success(`تم إضافة الموظف بنجاح - الكود: ${newEmployee.employee_code}`)
      setShowEmployeeModal(false)
      resetEmployeeForm()
      loadData(partnerId)

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ غير متوقع')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // تعديل موظف
  // ─────────────────────────────────────────────────────────────
  const handleUpdateEmployee = async () => {
    if (!editingEmployee || !partnerId) return

    try {
      const updateData: any = {
        full_name: employeeForm.full_name,
        full_name_en: employeeForm.full_name_en || null,
        national_id: employeeForm.national_id || null,
        phone: employeeForm.phone.startsWith('+966') ? employeeForm.phone : '+966' + employeeForm.phone,
        email: employeeForm.email || null,
        department_id: employeeForm.department_id || null,
        job_title_id: employeeForm.job_title_id || null,
        role_id: employeeForm.role_id || null,
        experience_years: employeeForm.experience_years || 0,
        salary: employeeForm.salary || 0,
        status: employeeForm.status,
        can_open_cases: employeeForm.can_open_cases || false
      }

      // تحديث بيانات الرخصة
      if (employeeForm.is_lawyer) {
        updateData.license_number = employeeForm.license_number || null
        updateData.license_expiry = employeeForm.license_expiry || null
      } else {
        updateData.license_number = null
        updateData.license_expiry = null
      }

      const { error } = await supabase
        .from('partner_employees')
        .update(updateData)
        .eq('id', editingEmployee.id)

      if (error) throw error

      toast.success('تم تحديث بيانات الموظف بنجاح')
      setShowEmployeeModal(false)
      setEditingEmployee(null)
      resetEmployeeForm()
      loadData(partnerId)

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحديث البيانات')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // تعطيل/تفعيل موظف
  // ─────────────────────────────────────────────────────────────
  const handleToggleEmployeeStatus = async (employee: any) => {
    if (!partnerId) return

    const currentStatus = employee.status
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    const message = newStatus === 'active' ? 'تفعيل' : 'تعطيل'

    try {
      const { error } = await supabase
        .from('partner_employees')
        .update({ status: newStatus })
        .eq('id', employee.id)

      if (error) throw error

      toast.success(`تم ${message} الموظف بنجاح`)
      loadData(partnerId)

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // إضافة دور جديد
  // ─────────────────────────────────────────────────────────────
  const handleAddRole = async () => {
    if (!partnerId) return

    if (!roleForm.name_ar || !roleForm.code) {
      toast.error('الرجاء تعبئة الحقول المطلوبة')
      return
    }

    try {
      const { error } = await supabase
        .from('partner_roles')
        .insert({
          partner_id: partnerId,
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
      loadData(partnerId)

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في إضافة الدور')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // تعديل دور
  // ─────────────────────────────────────────────────────────────
  const handleUpdateRole = async () => {
    if (!editingRole || !partnerId) return

    try {
      const { error } = await supabase
        .from('partner_roles')
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
      loadData(partnerId)

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحديث الدور')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // إعادة تعيين النماذج
  // ─────────────────────────────────────────────────────────────
  const resetEmployeeForm = () => {
    setEmployeeForm({
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
      experience_years: 0,
      salary: 0,
      hire_date: new Date().toISOString().split('T')[0],
      status: 'active',
      is_lawyer: false,
      can_open_cases: false
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
  const openEditEmployee = (employee: any) => {
    setEditingEmployee(employee)
    setEmployeeForm({
      full_name: employee.full_name || '',
      full_name_en: employee.full_name_en || '',
      national_id: employee.national_id || '',
      phone: employee.phone?.replace('+966', '') || '',
      email: employee.email || '',
      license_number: employee.license_number || '',
      license_expiry: employee.license_expiry || '',
      department_id: employee.department_id || '',
      job_title_id: employee.job_title_id || '',
      role_id: employee.role_id || '',
      experience_years: employee.experience_years || 0,
      salary: employee.salary || 0,
      hire_date: employee.hire_date || new Date().toISOString().split('T')[0],
      status: employee.status || 'active',
      is_lawyer: !!employee.license_number,  // محامي إذا لديه رخصة
      can_open_cases: employee.can_open_cases || false
    })
    setShowEmployeeModal(true)
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
  // تصفية الموظفين
  // ─────────────────────────────────────────────────────────────
  const filteredEmployees = employees.filter(employee => {
    const matchSearch = !searchTerm || 
      employee.full_name?.includes(searchTerm) ||
      employee.employee_code?.includes(searchTerm) ||
      employee.license_number?.includes(searchTerm)
    
    const matchDept = !filterDepartment || employee.department_id === filterDepartment

    return matchSearch && matchDept
  })

  // ─────────────────────────────────────────────────────────────
  // دالة تحديد إذا الموظف محامي (بوجود رخصة)
  // ─────────────────────────────────────────────────────────────
  const isLawyer = (employee: any) => !!employee.license_number

  // ─────────────────────────────────────────────────────────────
  // العرض
  // ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (!partnerId) {
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
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <span className="text-2xl">🏢</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">الهيكل التنظيمي</h1>
            <p className="text-slate-500">إدارة الموظفين والأدوار والصلاحيات</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* الإحصائيات */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">👥</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{employees.length}</p>
              <p className="text-sm text-slate-500">الموظفين</p>
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
                {employees.filter(e => e.status === 'active').length}
              </p>
              <p className="text-sm text-slate-500">نشط</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">👨‍⚖️</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {employees.filter(e => isLawyer(e)).length}
              </p>
              <p className="text-sm text-slate-500">محامين</p>
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
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* المحتوى الرئيسي */}
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
                className="w-64 pl-4 pr-10 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            </div>

            {/* فلتر القسم */}
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
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
                resetEmployeeForm()
                setEditingEmployee(null)
                setShowEmployeeModal(true)
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <span>+</span>
              <span>إضافة موظف</span>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* قائمة الموظفين */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span>👥</span>
            <span>الموظفين ({filteredEmployees.length})</span>
          </h3>

          {filteredEmployees.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <span className="text-4xl block mb-2">👥</span>
              <p>لا يوجد موظفين. أضف أول موظف!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">الكود</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">الاسم</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">النوع</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">رقم الرخصة</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">القسم</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">المسمى</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">الدور</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">الحالة</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                          {employee.employee_code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-800">{employee.full_name}</p>
                          {employee.full_name_en && (
                            <p className="text-sm text-slate-400">{employee.full_name_en}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          isLawyer(employee) 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {isLawyer(employee) ? '👨‍⚖️ محامي' : '👤 موظف'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {isLawyer(employee) ? employee.license_number : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{employee.department?.name_ar || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{employee.job_title?.title_ar || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{employee.role?.name_ar || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          employee.status === 'active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {employee.status === 'active' ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditEmployee(employee)}
                            className="text-blue-500 hover:text-blue-700 p-1"
                            title="تعديل"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleToggleEmployeeStatus(employee)}
                            className={`p-1 ${employee.status === 'active' ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}
                            title={employee.status === 'active' ? 'تعطيل' : 'تفعيل'}
                          >
                            {employee.status === 'active' ? '🚫' : '✅'}
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
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
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
      {/* نافذة إضافة/تعديل موظف */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">
                {editingEmployee ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {/* نوع الموظف */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={employeeForm.is_lawyer}
                    onChange={(e) => setEmployeeForm({...employeeForm, is_lawyer: e.target.checked})}
                    className="w-5 h-5 text-emerald-500 rounded focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-medium text-slate-800">محامي مرخص</span>
                    <p className="text-sm text-slate-500">حدد هذا الخيار إذا كان الموظف محامي لديه رخصة</p>
                  </div>
                </label>
              </div>

              {/* الاسم */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    الاسم بالعربي <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={employeeForm.full_name}
                    onChange={(e) => setEmployeeForm({...employeeForm, full_name: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    placeholder="الاسم الكامل"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    الاسم بالإنجليزي
                  </label>
                  <input
                    type="text"
                    value={employeeForm.full_name_en}
                    onChange={(e) => setEmployeeForm({...employeeForm, full_name_en: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
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
                    value={employeeForm.national_id}
                    onChange={(e) => setEmployeeForm({...employeeForm, national_id: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
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
                      value={employeeForm.phone}
                      onChange={(e) => setEmployeeForm({...employeeForm, phone: e.target.value.replace(/\D/g, '')})}
                      className="flex-1 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                      placeholder="5xxxxxxxx"
                      dir="ltr"
                      maxLength={9}
                    />
                  </div>
                </div>
              </div>

              {/* البريد */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={employeeForm.email}
                  onChange={(e) => setEmployeeForm({...employeeForm, email: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                  placeholder="email@example.com"
                  dir="ltr"
                />
              </div>

              {/* بيانات الرخصة (للمحامين فقط) */}
              {employeeForm.is_lawyer && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      رقم الرخصة <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={employeeForm.license_number}
                      onChange={(e) => setEmployeeForm({...employeeForm, license_number: e.target.value})}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                      placeholder="رقم رخصة المحاماة"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      تاريخ انتهاء الرخصة
                    </label>
                    <input
                      type="date"
                      value={employeeForm.license_expiry}
                      onChange={(e) => setEmployeeForm({...employeeForm, license_expiry: e.target.value})}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* تاريخ التعيين */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    تاريخ التعيين
                  </label>
                  <input
                    type="date"
                    value={employeeForm.hire_date}
                    onChange={(e) => setEmployeeForm({...employeeForm, hire_date: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    سنوات الخبرة
                  </label>
                  <input
                    type="number"
                    value={employeeForm.experience_years}
                    onChange={(e) => setEmployeeForm({...employeeForm, experience_years: parseInt(e.target.value) || 0})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    min="0"
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
                    value={employeeForm.department_id}
                    onChange={(e) => setEmployeeForm({...employeeForm, department_id: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
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
                    value={employeeForm.job_title_id}
                    onChange={(e) => setEmployeeForm({...employeeForm, job_title_id: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- اختر المسمى --</option>
                    {refJobTitles.map(title => (
                      <option key={title.id} value={title.id}>{title.title_ar}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* الدور والراتب */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    الدور
                  </label>
                  <select
                    value={employeeForm.role_id}
                    onChange={(e) => setEmployeeForm({...employeeForm, role_id: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- اختر الدور --</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name_ar}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    الراتب (ريال)
                  </label>
                  <input
                    type="number"
                    value={employeeForm.salary}
                    onChange={(e) => setEmployeeForm({...employeeForm, salary: parseInt(e.target.value) || 0})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    min="0"
                  />
                </div>
              </div>

              {/* الحالة */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={employeeForm.status === 'active'}
                    onChange={(e) => setEmployeeForm({...employeeForm, status: e.target.checked ? 'active' : 'inactive'})}
                    className="w-5 h-5 text-emerald-500 rounded focus:ring-emerald-500"
                  />
                  <span className="text-slate-700">نشط</span>
                </label>
                {employeeForm.is_lawyer && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={employeeForm.can_open_cases}
                      onChange={(e) => setEmployeeForm({...employeeForm, can_open_cases: e.target.checked})}
                      className="w-5 h-5 text-purple-500 rounded focus:ring-purple-500"
                    />
                    <span className="text-slate-700">يمكنه فتح قضايا</span>
                  </label>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEmployeeModal(false)
                  setEditingEmployee(null)
                  resetEmployeeForm()
                }}
                className="px-6 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                onClick={editingEmployee ? handleUpdateEmployee : handleAddEmployee}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
              >
                {editingEmployee ? 'تحديث' : 'إضافة'}
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
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
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
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
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
                    className="w-5 h-5 text-emerald-500 rounded focus:ring-emerald-500"
                  />
                  <span className="text-slate-700">دور افتراضي</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roleForm.is_active}
                    onChange={(e) => setRoleForm({...roleForm, is_active: e.target.checked})}
                    className="w-5 h-5 text-emerald-500 rounded focus:ring-emerald-500"
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
