'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { 
  Shield, Plus, Edit, Trash2, X, Users,
  Check, Lock, Unlock, Copy, ChevronDown, ChevronUp,
  UserCog, Settings, FileText, DollarSign, BarChart3,
  Briefcase, FolderOpen
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// 🔐 إدارة الصلاحيات والأدوار - الشريك القانوني
// ═══════════════════════════════════════════════════════════════

// تصنيفات الصلاحيات
const permissionCategories = {
  requests: { label: 'الطلبات', icon: FileText, color: 'blue' },
  quotes: { label: 'عروض الأسعار', icon: DollarSign, color: 'green' },
  cases: { label: 'القضايا', icon: Briefcase, color: 'purple' },
  documents: { label: 'المستندات', icon: FolderOpen, color: 'amber' },
  finance: { label: 'المالية', icon: DollarSign, color: 'emerald' },
  reports: { label: 'التقارير', icon: BarChart3, color: 'cyan' },
  team: { label: 'الفريق', icon: Users, color: 'indigo' },
  services: { label: 'الخدمات', icon: Settings, color: 'slate' },
}

export default function PermissionsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [refRoles, setRefRoles] = useState<any[]>([])
  const [customRoles, setCustomRoles] = useState<any[]>([])
  const [permissions, setPermissions] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  
  const [activeTab, setActiveTab] = useState<'roles' | 'employees'>('roles')
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [editingRole, setEditingRole] = useState<any>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)

  const [roleForm, setRoleForm] = useState({
    code: '',
    name_ar: '',
    name_en: '',
    description_ar: '',
    permissions: {} as Record<string, boolean>,
    hierarchy_level: 3,
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const partnerId = localStorage.getItem('exolex_partner_id')

      // الأدوار الافتراضية
      const { data: refRolesData } = await supabase
        .from('ref_roles')
        .select('*')
        .eq('is_active', true)
        .order('hierarchy_level')

      setRefRoles(refRolesData || [])

      // الأدوار المخصصة للشريك
      if (partnerId) {
        const { data: customRolesData } = await supabase
          .from('partner_roles')
          .select('*')
          .eq('partner_id', partnerId)
          .eq('is_active', true)
          .order('hierarchy_level')

        setCustomRoles(customRolesData || [])
      }

      // الصلاحيات المتاحة
      const { data: permsData } = await supabase
        .from('partner_permissions')
        .select('*')
        .order('category')

      setPermissions(permsData || [])

      // الموظفين
      if (partnerId) {
        const { data: empsData } = await supabase
          .from('partner_employees')
          .select('*, role:role_id(*)')
          .eq('partner_id', partnerId)
          .neq('status', 'terminated')
          .order('full_name')

        setEmployees(empsData || [])
      }

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // تجميع الصلاحيات حسب الفئة
  const groupedPermissions = permissions.reduce((acc: any, perm) => {
    if (!acc[perm.category]) acc[perm.category] = []
    acc[perm.category].push(perm)
    return acc
  }, {})

  // فتح modal لإنشاء دور جديد من قالب
  const createRoleFromTemplate = (templateRole: any) => {
    setRoleForm({
      code: '',
      name_ar: '',
      name_en: '',
      description_ar: '',
      permissions: templateRole.default_permissions || {},
      hierarchy_level: templateRole.hierarchy_level || 3,
    })
    setEditingRole(null)
    setShowRoleModal(true)
  }

  // فتح modal لتعديل دور مخصص
  const editCustomRole = (role: any) => {
    setRoleForm({
      code: role.code,
      name_ar: role.name_ar,
      name_en: role.name_en || '',
      description_ar: role.description_ar || '',
      permissions: role.permissions || {},
      hierarchy_level: role.hierarchy_level || 3,
    })
    setEditingRole(role)
    setShowRoleModal(true)
  }

  // حفظ الدور
  const handleSaveRole = async () => {
    try {
      const partnerId = localStorage.getItem('exolex_partner_id')
      if (!partnerId) return

      if (!roleForm.code || !roleForm.name_ar) {
        toast.error('يرجى إدخال كود واسم الدور')
        return
      }

      const roleData = {
        partner_id: partnerId,
        code: roleForm.code,
        name_ar: roleForm.name_ar,
        name_en: roleForm.name_en,
        description_ar: roleForm.description_ar,
        permissions: roleForm.permissions,
        hierarchy_level: roleForm.hierarchy_level,
        is_default: false,
        is_active: true,
      }

      if (editingRole) {
        const { error } = await supabase
          .from('partner_roles')
          .update(roleData)
          .eq('id', editingRole.id)

        if (error) throw error
        toast.success('✅ تم تحديث الدور')
      } else {
        const { error } = await supabase
          .from('partner_roles')
          .insert(roleData)

        if (error) throw error
        toast.success('✅ تم إنشاء الدور')
      }

      setShowRoleModal(false)
      loadData()
    } catch (error: any) {
      console.error('Error:', error)
      if (error.code === '23505') {
        toast.error('هذا الكود موجود مسبقاً')
      } else {
        toast.error('حدث خطأ')
      }
    }
  }

  // حذف دور مخصص
  const deleteRole = async (roleId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الدور؟')) return

    try {
      const { error } = await supabase
        .from('partner_roles')
        .update({ is_active: false })
        .eq('id', roleId)

      if (error) throw error
      toast.success('✅ تم حذف الدور')
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // تعيين دور لموظف
  const assignRoleToEmployee = async (employeeId: string, roleId: string | null, rolePermissions: any) => {
    try {
      const { error } = await supabase
        .from('partner_employees')
        .update({ 
          role_id: roleId,
          permissions: rolePermissions 
        })
        .eq('id', employeeId)

      if (error) throw error
      toast.success('✅ تم تعيين الدور')
      setShowAssignModal(false)
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // عدد الصلاحيات المفعلة
  const countActivePermissions = (perms: any) => {
    if (!perms) return 0
    return Object.values(perms).filter(v => v === true).length
  }

  // الحصول على اسم الدور للموظف
  const getEmployeeRoleName = (emp: any) => {
    if (emp.role) return emp.role.name_ar
    // البحث في ref_roles
    const refRole = refRoles.find(r => 
      JSON.stringify(r.default_permissions) === JSON.stringify(emp.permissions)
    )
    return refRole?.name_ar || 'مخصص'
  }

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
          <h1 className="text-2xl font-bold text-slate-800">🔐 إدارة الصلاحيات</h1>
          <p className="text-slate-500 mt-1">
            {refRoles.length} دور افتراضي | {customRoles.length} دور مخصص
          </p>
        </div>
        <button
          onClick={() => {
            setRoleForm({
              code: '',
              name_ar: '',
              name_en: '',
              description_ar: '',
              permissions: {},
              hierarchy_level: 3,
            })
            setEditingRole(null)
            setShowRoleModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          <Plus className="w-5 h-5" />
          إنشاء دور مخصص
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'roles' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <Shield className="w-4 h-4 inline ml-2" />
          الأدوار والصلاحيات
        </button>
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'employees' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4 inline ml-2" />
          صلاحيات الموظفين
        </button>
      </div>

      {/* Tab: الأدوار */}
      {activeTab === 'roles' && (
        <div className="space-y-4">

          {/* الأدوار الافتراضية */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                الأدوار الافتراضية
              </h2>
              <p className="text-sm text-slate-500">قوالب جاهزة يمكنك نسخها وتخصيصها</p>
            </div>
            <div className="divide-y">
              {refRoles.map(role => (
                <div key={role.id} className="p-4">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        role.hierarchy_level === 1 ? 'bg-purple-100' :
                        role.hierarchy_level === 2 ? 'bg-blue-100' :
                        role.hierarchy_level <= 4 ? 'bg-green-100' : 'bg-slate-100'
                      }`}>
                        <UserCog className={`w-5 h-5 ${
                          role.hierarchy_level === 1 ? 'text-purple-600' :
                          role.hierarchy_level === 2 ? 'text-blue-600' :
                          role.hierarchy_level <= 4 ? 'text-green-600' : 'text-slate-600'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-800">{role.name_ar}</h3>
                        <p className="text-sm text-slate-500">{role.description_ar}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">
                        {countActivePermissions(role.default_permissions)} صلاحية
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          createRoleFromTemplate(role)
                        }}
                        className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                        title="نسخ كقالب"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {expandedRole === role.id ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                  
                  {/* الصلاحيات المفصلة */}
                  {expandedRole === role.id && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(groupedPermissions).map(([category, perms]: [string, any]) => (
                        <div key={category} className="space-y-2">
                          <h4 className="text-sm font-medium text-slate-700 flex items-center gap-1">
                            {permissionCategories[category as keyof typeof permissionCategories]?.label || category}
                          </h4>
                          <div className="space-y-1">
                            {perms.map((perm: any) => (
                              <div key={perm.code} className="flex items-center gap-2 text-sm">
                                {role.default_permissions?.[perm.code] ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <X className="w-4 h-4 text-slate-300" />
                                )}
                                <span className={role.default_permissions?.[perm.code] ? 'text-slate-700' : 'text-slate-400'}>
                                  {perm.name_ar}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* الأدوار المخصصة */}
          {customRoles.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 border-b">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  الأدوار المخصصة
                </h2>
                <p className="text-sm text-slate-500">أدوار خاصة بمكتبك</p>
              </div>
              <div className="divide-y">
                {customRoles.map(role => (
                  <div key={role.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-800">{role.name_ar}</h3>
                          <p className="text-sm text-slate-500">{role.description_ar || role.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">
                          {countActivePermissions(role.permissions)} صلاحية
                        </span>
                        <button
                          onClick={() => editCustomRole(role)}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteRole(role.id)}
                          className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: صلاحيات الموظفين */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الموظف</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">القسم</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الدور</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الصلاحيات</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                        {emp.full_name?.[0] || '؟'}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{emp.full_name}</p>
                        <p className="text-sm text-slate-500">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{emp.department?.name_ar || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {getEmployeeRoleName(emp)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {countActivePermissions(emp.permissions)} صلاحية
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setSelectedEmployee(emp)
                        setShowAssignModal(true)
                      }}
                      className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                    >
                      <UserCog className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {employees.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">لا يوجد موظفين</p>
            </div>
          )}
        </div>
      )}

      {/* Modal إنشاء/تعديل دور */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                {editingRole ? '✏️ تعديل الدور' : '➕ إنشاء دور جديد'}
              </h2>
              <button onClick={() => setShowRoleModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* معلومات الدور */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">كود الدور *</label>
                  <input
                    type="text"
                    value={roleForm.code}
                    onChange={(e) => setRoleForm({ ...roleForm, code: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                    placeholder="مثال: senior_accountant"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    disabled={!!editingRole}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الاسم بالعربي *</label>
                  <input
                    type="text"
                    value={roleForm.name_ar}
                    onChange={(e) => setRoleForm({ ...roleForm, name_ar: e.target.value })}
                    placeholder="مثال: محاسب أول"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الاسم بالإنجليزي</label>
                  <input
                    type="text"
                    value={roleForm.name_en}
                    onChange={(e) => setRoleForm({ ...roleForm, name_en: e.target.value })}
                    placeholder="Senior Accountant"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">المستوى</label>
                  <select
                    value={roleForm.hierarchy_level}
                    onChange={(e) => setRoleForm({ ...roleForm, hierarchy_level: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value={1}>1 - أعلى (مدير)</option>
                    <option value={2}>2 - مشرف</option>
                    <option value={3}>3 - أول</option>
                    <option value={4}>4 - موظف</option>
                    <option value={5}>5 - مبتدئ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الوصف</label>
                <input
                  type="text"
                  value={roleForm.description_ar}
                  onChange={(e) => setRoleForm({ ...roleForm, description_ar: e.target.value })}
                  placeholder="وصف مختصر للدور"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              {/* الصلاحيات */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-slate-800">الصلاحيات</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allPerms = permissions.reduce((acc: any, p) => {
                          acc[p.code] = true
                          return acc
                        }, {})
                        setRoleForm({ ...roleForm, permissions: allPerms })
                      }}
                      className="text-sm text-green-600 hover:underline"
                    >
                      تحديد الكل
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setRoleForm({ ...roleForm, permissions: {} })}
                      className="text-sm text-red-600 hover:underline"
                    >
                      إلغاء الكل
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(groupedPermissions).map(([category, perms]: [string, any]) => {
                    const catConfig = permissionCategories[category as keyof typeof permissionCategories]
                    return (
                      <div key={category} className="bg-slate-50 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                          {catConfig?.label || category}
                        </h4>
                        <div className="space-y-2">
                          {perms.map((perm: any) => (
                            <label key={perm.code} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={roleForm.permissions[perm.code] || false}
                                onChange={(e) => setRoleForm({
                                  ...roleForm,
                                  permissions: {
                                    ...roleForm.permissions,
                                    [perm.code]: e.target.checked
                                  }
                                })}
                                className="rounded text-blue-600"
                              />
                              <span className="text-sm text-slate-700">{perm.name_ar}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveRole}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingRole ? 'تحديث' : 'إنشاء'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal تعيين دور لموظف */}
      {showAssignModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                تعيين دور لـ {selectedEmployee.full_name}
              </h2>
              <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-slate-600">اختر دور من القائمة:</p>
              
              {/* الأدوار الافتراضية */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-500">الأدوار الافتراضية</h4>
                {refRoles.map(role => (
                  <button
                    key={role.id}
                    onClick={() => assignRoleToEmployee(selectedEmployee.id, null, role.default_permissions)}
                    className="w-full p-3 text-right border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-800">{role.name_ar}</span>
                    <span className="text-sm text-slate-500">{countActivePermissions(role.default_permissions)} صلاحية</span>
                  </button>
                ))}
              </div>

              {/* الأدوار المخصصة */}
              {customRoles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-500">الأدوار المخصصة</h4>
                  {customRoles.map(role => (
                    <button
                      key={role.id}
                      onClick={() => assignRoleToEmployee(selectedEmployee.id, role.id, role.permissions)}
                      className="w-full p-3 text-right border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-between"
                    >
                      <span className="font-medium text-slate-800">{role.name_ar}</span>
                      <span className="text-sm text-slate-500">{countActivePermissions(role.permissions)} صلاحية</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
