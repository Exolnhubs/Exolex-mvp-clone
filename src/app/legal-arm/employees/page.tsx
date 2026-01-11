'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { 
  Users, Plus, Search, Edit, Trash2, 
  UserCheck, UserX, Building2, Briefcase,
  Star, Shield, X, AlertCircle, DollarSign,
  Calendar, TrendingUp, ExternalLink, Clock
} from 'lucide-react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════
// 👥 إدارة المحامين - الذراع القانوني
// - الأقسام تُضاف من صفحة الأقسام
// - المسميات تُضاف من صفحة المسميات
// - الراتب + تاريخ التعيين (إلزامي)
// ═══════════════════════════════════════════════════════════════

export default function LegalArmEmployeesPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [employees, setEmployees] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [jobTitles, setJobTitles] = useState<any[]>([])
  const [armData, setArmData] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    full_name_ar: '',
    full_name_en: '',
    email: '',
    phone: '',
    national_id: '',
    department_id: '',
    job_title_id: '',
    license_number: '',
    license_expiry: '',
    experience_years: 0,
    salary: 0,
    hire_date: new Date().toISOString().split('T')[0],
    is_available: true,
  })

  const [requiresLicense, setRequiresLicense] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const armId = localStorage.getItem('exolex_arm_id')
      if (!armId) return

      // بيانات الذراع
      const { data: arm } = await supabase
        .from('legal_arms')
        .select('*')
        .eq('id', armId)
        .single()

      setArmData(arm)

      // أقسام الذراع
      const { data: depts } = await supabase
        .from('legal_arm_departments')
        .select('*, ref:ref_department_id(*)')
        .eq('legal_arm_id', armId)
        .eq('is_active', true)
        .order('sort_order')

      setDepartments(depts || [])

      // مسميات الذراع
      const { data: titles } = await supabase
        .from('legal_arm_job_titles')
        .select('*, ref:ref_job_title_id(*)')
        .eq('legal_arm_id', armId)
        .eq('is_active', true)
        .order('sort_order')

      setJobTitles(titles || [])

      // المحامين
      const { data: lawyers } = await supabase
        .from('lawyers')
        .select('*')
        .eq('legal_arm_id', armId)
        .eq('lawyer_type', 'legal_arm')
        .neq('status', 'terminated')
        .order('created_at', { ascending: false })

      setEmployees(lawyers || [])

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const checkLicenseRequired = (jobTitleId: string) => {
    const title = jobTitles.find(t => t.id === jobTitleId)
    const requires = title?.ref?.requires_license || title?.requires_license || false
    setRequiresLicense(requires)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const armId = localStorage.getItem('exolex_arm_id')
      if (!armId) return

      if (requiresLicense && (!formData.license_number || !formData.license_expiry)) {
        toast.error('يجب إدخال بيانات الترخيص لهذا المسمى الوظيفي')
        return
      }

      // تحديد إذا كان يحتاج موافقة أدمن (Cost Plus)
      const isCostPlus = armData?.payment_model === 'cost_plus'
      const needsAdminApproval = isCostPlus

      const lawyerData = {
        full_name_ar: formData.full_name_ar,
        full_name_en: formData.full_name_en,
        email: formData.email,
        phone: formData.phone,
        national_id: formData.national_id,
        department_id: formData.department_id || null,
        job_title_id: formData.job_title_id || null,
        license_number: formData.license_number || null,
        license_expiry: formData.license_expiry || null,
        experience_years: formData.experience_years,
        salary: formData.salary,
        hire_date: formData.hire_date,
        is_available: formData.is_available,
        legal_arm_id: armId,
        lawyer_type: 'legal_arm',
        admin_approval_required: needsAdminApproval,
        admin_approval_status: needsAdminApproval ? 'pending' : 'approved',
        status: needsAdminApproval ? 'pending' : 'active',
        salary_start_date: needsAdminApproval ? null : formData.hire_date,
      }

      if (editingEmployee) {
        const { error } = await supabase
          .from('lawyers')
          .update(lawyerData)
          .eq('id', editingEmployee.id)

        if (error) throw error
        toast.success('✅ تم تحديث البيانات')
      } else {
        const { error } = await supabase
          .from('lawyers')
          .insert(lawyerData)

        if (error) throw error
        
        if (needsAdminApproval) {
          toast.success('✅ تم إضافة المحامي - بانتظار موافقة الأدمن على الراتب')
        } else {
          toast.success('✅ تم إضافة المحامي بنجاح')
        }
      }

      setShowModal(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في حفظ البيانات')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('lawyers')
        .update({ 
          status: 'terminated',
          termination_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', id)

      if (error) throw error
      toast.success('✅ تم إنهاء خدمة المحامي - سيتم احتساب التكلفة حتى اليوم')
      setShowDeleteConfirm(null)
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  const toggleStatus = async (employee: any) => {
    try {
      const newStatus = employee.status === 'active' ? 'inactive' : 'active'
      const updates: any = { status: newStatus }
      
      if (newStatus === 'inactive') {
        updates.termination_date = new Date().toISOString().split('T')[0]
      } else {
        updates.termination_date = null
      }

      const { error } = await supabase
        .from('lawyers')
        .update(updates)
        .eq('id', employee.id)

      if (error) throw error
      toast.success(newStatus === 'active' ? '✅ تم تفعيل المحامي' : '⏸️ تم تعطيل المحامي')
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  const resetForm = () => {
    setFormData({
      full_name_ar: '',
      full_name_en: '',
      email: '',
      phone: '',
      national_id: '',
      department_id: '',
      job_title_id: '',
      license_number: '',
      license_expiry: '',
      experience_years: 0,
      salary: 0,
      hire_date: new Date().toISOString().split('T')[0],
      is_available: true,
    })
    setEditingEmployee(null)
    setRequiresLicense(false)
  }

  const openEditModal = (employee: any) => {
    setEditingEmployee(employee)
    setFormData({
      full_name_ar: employee.full_name_ar || '',
      full_name_en: employee.full_name_en || '',
      email: employee.email || '',
      phone: employee.phone || '',
      national_id: employee.national_id || '',
      department_id: employee.department_id || '',
      job_title_id: employee.job_title_id || '',
      license_number: employee.license_number || '',
      license_expiry: employee.license_expiry || '',
      experience_years: employee.experience_years || 0,
      salary: employee.salary || 0,
      hire_date: employee.hire_date || new Date().toISOString().split('T')[0],
      is_available: employee.is_available ?? true,
    })
    checkLicenseRequired(employee.job_title_id)
    setShowModal(true)
  }

  // فلترة
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = !searchQuery || 
      emp.full_name_ar?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDept = !filterDepartment || emp.department_id === filterDepartment
    const matchesStatus = !filterStatus || emp.status === filterStatus
    return matchesSearch && matchesDept && matchesStatus
  })

  // إحصائيات
  const activeEmployees = employees.filter(e => e.status === 'active')
  const stats = {
    total: employees.length,
    active: activeEmployees.length,
    pending: employees.filter(e => e.admin_approval_status === 'pending').length,
    totalSalary: activeEmployees.reduce((sum, e) => sum + (e.salary || 0), 0),
    totalRevenue: employees.reduce((sum, e) => sum + (e.total_revenue || 0), 0),
  }

  const isCostPlus = armData?.payment_model === 'cost_plus'
  const marginRate = armData?.cost_plus_margin || 20

  const getStatusBadge = (employee: any) => {
    if (employee.admin_approval_status === 'pending') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          بانتظار الموافقة
        </span>
      )
    }
    const styles: Record<string, string> = {
      'active': 'bg-green-100 text-green-700',
      'inactive': 'bg-yellow-100 text-yellow-700',
      'terminated': 'bg-red-100 text-red-700',
    }
    const labels: Record<string, string> = {
      'active': 'نشط',
      'inactive': 'معطل',
      'terminated': 'منتهي',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[employee.status] || 'bg-slate-100'}`}>
        {labels[employee.status] || employee.status}
      </span>
    )
  }

  // الحصول على اسم القسم
  const getDeptName = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId)
    return dept?.name_ar || '-'
  }

  // الحصول على اسم المسمى
  const getTitleName = (titleId: string) => {
    const title = jobTitles.find(t => t.id === titleId)
    return title?.title_ar || '-'
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">👥 إدارة المحامين</h1>
          <p className="text-slate-500 mt-1">
            إجمالي {stats.total} | نشط {stats.active}
            {stats.pending > 0 && ` | بانتظار الموافقة ${stats.pending}`}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
        >
          <Plus className="w-5 h-5" />
          إضافة محامي
        </button>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">إجمالي المحامين</p>
              <p className="text-xl font-bold text-slate-800">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">النشطين</p>
              <p className="text-xl font-bold text-slate-800">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">إجمالي الرواتب</p>
              <p className="text-xl font-bold text-slate-800">{stats.totalSalary.toLocaleString()} ر.س</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">إجمالي الإيرادات</p>
              <p className="text-xl font-bold text-slate-800">{stats.totalRevenue.toLocaleString()} ر.س</p>
            </div>
          </div>
        </div>
      </div>

      {/* ملخص Cost Plus */}
      {isCostPlus && stats.active > 0 && (
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            ملخص التكاليف الشهرية (Cost Plus {marginRate}%)
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-emerald-100 text-sm">الرواتب</p>
              <p className="text-2xl font-bold">{stats.totalSalary.toLocaleString()} ر.س</p>
            </div>
            <div>
              <p className="text-emerald-100 text-sm">الهامش ({marginRate}%)</p>
              <p className="text-2xl font-bold">{Math.round(stats.totalSalary * marginRate / 100).toLocaleString()} ر.س</p>
            </div>
            <div>
              <p className="text-emerald-100 text-sm">الإجمالي</p>
              <p className="text-2xl font-bold">{Math.round(stats.totalSalary * (1 + marginRate / 100)).toLocaleString()} ر.س</p>
            </div>
          </div>
        </div>
      )}

      {/* تنبيه إذا لم توجد أقسام */}
      {departments.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">لا توجد أقسام</p>
              <p className="text-sm text-amber-600">يجب إضافة الأقسام أولاً</p>
            </div>
            <Link href="/legal-arm/departments" className="mr-auto px-3 py-1 bg-amber-600 text-white text-sm rounded-lg flex items-center gap-1">
              إضافة أقسام <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* الفلاتر */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم أو البريد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg"
          >
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="pending">بانتظار الموافقة</option>
            <option value="inactive">معطل</option>
          </select>
        </div>
      </div>

      {/* جدول المحامين */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filteredEmployees.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">المحامي</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">المسمى</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">تاريخ التعيين</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الراتب</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الترخيص</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">التقييم</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الحالة</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-medium">
                          {emp.full_name_ar?.[0] || '؟'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{emp.full_name_ar}</p>
                          <p className="text-sm text-slate-500">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{getTitleName(emp.job_title_id)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {emp.hire_date ? new Date(emp.hire_date).toLocaleDateString('ar-SA') : '-'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {emp.salary?.toLocaleString() || 0} ر.س
                    </td>
                    <td className="px-4 py-3">
                      {emp.license_number ? (
                        <div>
                          <p className="text-sm text-slate-700">{emp.license_number}</p>
                          {emp.license_expiry && (
                            <p className="text-xs text-slate-500">
                              ينتهي: {new Date(emp.license_expiry).toLocaleDateString('ar-SA')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-400 fill-current" />
                        <span className="text-slate-700">{emp.avg_rating?.toFixed(1) || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(emp)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditModal(emp)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
                          <Edit className="w-4 h-4" />
                        </button>
                        {emp.admin_approval_status !== 'pending' && (
                          <button
                            onClick={() => toggleStatus(emp)}
                            className={`p-2 hover:bg-slate-100 rounded-lg ${emp.status === 'active' ? 'text-yellow-600' : 'text-green-600'}`}
                          >
                            {emp.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                        )}
                        <button onClick={() => setShowDeleteConfirm(emp.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-800 mb-2">لا يوجد محامين</h3>
            <p className="text-slate-500 mb-4">ابدأ بإضافة محامين للذراع القانوني</p>
          </div>
        )}
      </div>

      {/* Modal إضافة/تعديل */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                {editingEmployee ? '✏️ تعديل محامي' : '➕ إضافة محامي جديد'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              
              {/* البيانات الأساسية */}
              <div>
                <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  البيانات الأساسية
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">الاسم بالعربي *</label>
                    <input
                      type="text"
                      required
                      value={formData.full_name_ar}
                      onChange={(e) => setFormData({ ...formData, full_name_ar: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">الاسم بالإنجليزي</label>
                    <input
                      type="text"
                      value={formData.full_name_en}
                      onChange={(e) => setFormData({ ...formData, full_name_en: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">رقم الجوال *</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">رقم الهوية *</label>
                    <input
                      type="text"
                      required
                      value={formData.national_id}
                      onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">سنوات الخبرة</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.experience_years}
                      onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* المسمى الوظيفي */}
              <div>
                <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-emerald-600" />
                  المسمى الوظيفي
                </h3>
                
                {jobTitles.length === 0 ? (
                  <div className="p-4 bg-amber-50 rounded-lg text-amber-700">
                    <p className="mb-2">لا توجد مسميات مضافة</p>
                    <Link href="/legal-arm/job-titles" className="text-amber-800 underline">
                      إضافة مسميات من هنا
                    </Link>
                  </div>
                ) : (
                  <select
                    required
                    value={formData.job_title_id}
                    onChange={(e) => {
                      setFormData({ ...formData, job_title_id: e.target.value })
                      checkLicenseRequired(e.target.value)
                    }}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">اختر المسمى الوظيفي</option>
                    {jobTitles.map(title => (
                      <option key={title.id} value={title.id}>
                        {title.title_ar} {(title.ref?.requires_license || title.requires_license) && '🔐'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* بيانات الترخيص */}
              {requiresLicense && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <h3 className="font-medium text-amber-800 mb-3 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    بيانات الترخيص (مطلوبة لهذا المسمى)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">رقم الترخيص *</label>
                      <input
                        type="text"
                        required
                        value={formData.license_number}
                        onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ انتهاء الترخيص *</label>
                      <input
                        type="date"
                        required
                        value={formData.license_expiry}
                        onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* الراتب وتاريخ التعيين */}
              <div>
                <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  الراتب والتعيين
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">الراتب الشهري (ريال) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.salary}
                      onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ التعيين *</label>
                    <input
                      type="date"
                      required
                      value={formData.hire_date}
                      onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                
                {isCostPlus && (
                  <div className="mt-3 p-3 bg-emerald-50 rounded-lg">
                    <p className="text-sm text-emerald-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      سيتم إرسال طلب للأدمن للموافقة على الراتب (نموذج Cost Plus)
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_available"
                  checked={formData.is_available}
                  onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                  className="rounded text-emerald-600"
                />
                <label htmlFor="is_available" className="text-sm text-slate-700">متاح لاستقبال الطلبات</label>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  {editingEmployee ? 'تحديث' : (isCostPlus ? 'إرسال للموافقة' : 'إضافة')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal تأكيد إنهاء الخدمة */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">إنهاء خدمة المحامي</h3>
            <p className="text-slate-500 mb-2">سيتم احتساب التكلفة حتى تاريخ اليوم</p>
            {isCostPlus && (
              <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg mb-4">
                سيتم خصم أيام العمل من الفاتورة الشهرية
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg">
                إلغاء
              </button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
