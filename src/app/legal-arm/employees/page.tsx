'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { 
  Users, Plus, Search, Edit, Trash2, 
  UserCheck, UserX, Briefcase,
  Star, Shield, X, AlertCircle, DollarSign,
  TrendingUp, ExternalLink, Clock,
  Mail, Send, RefreshCw, Copy, UserPlus
} from 'lucide-react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════
// 👥 إدارة المحامين - الذراع القانوني
// ═══════════════════════════════════════════════════════════════
// ✅ إضافة مباشرة (للمحامين الموجودين)
// ✅ نظام الدعوات (SaaS Model)
// ✅ تبويبات: المحامين | الدعوات المعلقة
// 📅 التاريخ: يناير 2026
// ═══════════════════════════════════════════════════════════════

export default function LegalArmEmployeesPage() {
  // ─────────────────────────────────────────────────────────────
  // الحالات الرئيسية
  // ─────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true)
  const [employees, setEmployees] = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [jobTitles, setJobTitles] = useState<any[]>([])
  const [armData, setArmData] = useState<any>(null)
  
  // الفلاتر
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  
  // التبويبات والنوافذ
  const [activeTab, setActiveTab] = useState<'employees' | 'invitations'>('employees')
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'invite'>('add')
  const [editingEmployee, setEditingEmployee] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showCancelInviteConfirm, setShowCancelInviteConfirm] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // ─────────────────────────────────────────────────────────────
  // بيانات النموذج
  // ─────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    full_name: '',
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

  // ─────────────────────────────────────────────────────────────
  // تحميل البيانات
  // ─────────────────────────────────────────────────────────────
  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const armId = localStorage.getItem('exolex_arm_id')
      if (!armId) {
        toast.error('يرجى تسجيل الدخول أولاً')
        return
      }

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

      // الدعوات
      const { data: invites } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('entity_type', 'legal_arm')
        .eq('entity_id', armId)
        .order('created_at', { ascending: false })

      setInvitations(invites || [])

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // التحقق من الترخيص المطلوب
  // ─────────────────────────────────────────────────────────────
  const checkLicenseRequired = (jobTitleId: string) => {
    const title = jobTitles.find(t => t.id === jobTitleId)
    const requires = title?.ref?.requires_license || title?.requires_license || false
    setRequiresLicense(requires)
  }

  // ─────────────────────────────────────────────────────────────
  // توليد رمز الدعوة
  // ─────────────────────────────────────────────────────────────
  const generateInviteToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return token
  }

  // ─────────────────────────────────────────────────────────────
  // إرسال دعوة جديدة
  // ─────────────────────────────────────────────────────────────
  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const armId = localStorage.getItem('exolex_arm_id')
      if (!armId) return

      // التحقق من البريد أو الجوال
      if (!formData.email && !formData.phone) {
        toast.error('يجب إدخال البريد الإلكتروني أو رقم الجوال')
        return
      }

      // التحقق من الترخيص إذا كان مطلوباً
      if (requiresLicense && (!formData.license_number || !formData.license_expiry)) {
        toast.error('يجب إدخال بيانات الترخيص لهذا المسمى الوظيفي')
        return
      }

      // التحقق من عدم وجود دعوة سابقة معلقة
      let query = supabase
        .from('team_invitations')
        .select('id')
        .eq('entity_id', armId)
        .eq('status', 'pending')

      if (formData.email) {
        query = query.eq('email', formData.email)
      } else if (formData.phone) {
        query = query.eq('phone', formData.phone)
      }

      const { data: existingInvite } = await query.maybeSingle()

      if (existingInvite) {
        toast.error('يوجد دعوة معلقة لهذا الشخص بالفعل')
        return
      }

      const token = generateInviteToken()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // صالحة لمدة 7 أيام

      const invitationData = {
        entity_type: 'legal_arm',
        entity_id: armId,
        full_name: formData.full_name,
        email: formData.email || null,
        phone: formData.phone || null,
        department_id: formData.department_id || null,
        job_title_id: formData.job_title_id || null,
        salary: formData.salary || 0,
        hire_date: formData.hire_date,
        experience_years: formData.experience_years,
        license_number: formData.license_number || null,
        license_expiry: formData.license_expiry || null,
        token: token,
        status: 'pending',
        invitation_type: formData.email ? 'email' : 'phone',
        invited_by: armData?.manager_id || null,
        expires_at: expiresAt.toISOString(),
      }

      const { error } = await supabase
        .from('team_invitations')
        .insert(invitationData)

      if (error) throw error

      // إنشاء رابط الدعوة
      const inviteUrl = `${window.location.origin}/auth/accept-invitation?token=${token}`
      
      // نسخ الرابط للحافظة
      await navigator.clipboard.writeText(inviteUrl)

      toast.success('✅ تم إنشاء الدعوة! تم نسخ الرابط للحافظة')

      setShowModal(false)
      resetForm()
      loadData()
      setActiveTab('invitations')

    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ في إرسال الدعوة')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // إضافة محامي مباشرة (بدون دعوة)
  // ─────────────────────────────────────────────────────────────
  const handleDirectAdd = async (e: React.FormEvent) => {
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
        full_name: formData.full_name,
        full_name_en: formData.full_name_en,
        email: formData.email,
        phone: formData.phone,
        national_id: formData.national_id,
        department_id: formData.department_id || null,
        job_title_id: formData.job_title_id || null,
        license_number: formData.license_number || null,
        license_expiry: formData.license_expiry || null,
        years_of_experience: formData.experience_years,
        salary: formData.salary,
        hire_date: formData.hire_date,
        is_available: formData.is_available,
        legal_arm_id: armId,
        lawyer_type: 'legal_arm',
        admin_approval_required: needsAdminApproval,
        admin_approval_status: needsAdminApproval ? 'pending' : 'approved',
        status: needsAdminApproval ? 'pending' : 'active',
        salary_start_date: needsAdminApproval ? null : formData.hire_date,
        // سيحتاج المحامي لاحقاً لتفعيل حسابه عبر دعوة
        user_id: null,
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

  // ─────────────────────────────────────────────────────────────
  // نسخ رابط الدعوة
  // ─────────────────────────────────────────────────────────────
  const copyInviteLink = async (token: string) => {
    const inviteUrl = `${window.location.origin}/auth/accept-invitation?token=${token}`
    await navigator.clipboard.writeText(inviteUrl)
    setCopiedToken(token)
    toast.success('تم نسخ الرابط!')
    setTimeout(() => setCopiedToken(null), 2000)
  }

  // ─────────────────────────────────────────────────────────────
  // إعادة إرسال الدعوة
  // ─────────────────────────────────────────────────────────────
  const resendInvitation = async (invitation: any) => {
    try {
      const newExpiry = new Date()
      newExpiry.setDate(newExpiry.getDate() + 7)

      const { error } = await supabase
        .from('team_invitations')
        .update({
          expires_at: newExpiry.toISOString(),
          resent_count: (invitation.resent_count || 0) + 1,
          last_resent_at: new Date().toISOString(),
          status: 'pending'
        })
        .eq('id', invitation.id)

      if (error) throw error

      // نسخ الرابط
      await copyInviteLink(invitation.token)
      toast.success('✅ تم تجديد الدعوة ونسخ الرابط')
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // إلغاء الدعوة
  // ─────────────────────────────────────────────────────────────
  const cancelInvitation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('team_invitations')
        .update({ status: 'cancelled' })
        .eq('id', id)

      if (error) throw error
      toast.success('تم إلغاء الدعوة')
      setShowCancelInviteConfirm(null)
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // حذف/إنهاء خدمة محامي
  // ─────────────────────────────────────────────────────────────
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
      toast.success('✅ تم إنهاء خدمة المحامي')
      setShowDeleteConfirm(null)
      loadData()
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // تبديل حالة المحامي
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // إعادة تعيين النموذج
  // ─────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormData({
      full_name: '',
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

  // ─────────────────────────────────────────────────────────────
  // فتح نافذة التعديل
  // ─────────────────────────────────────────────────────────────
  const openEditModal = (employee: any) => {
    setEditingEmployee(employee)
    setModalMode('edit')
    setFormData({
      full_name: employee.full_name || '',
      full_name_en: employee.full_name_en || '',
      email: employee.email || '',
      phone: employee.phone || '',
      national_id: employee.national_id || '',
      department_id: employee.department_id || '',
      job_title_id: employee.job_title_id || '',
      license_number: employee.license_number || '',
      license_expiry: employee.license_expiry || '',
      experience_years: employee.years_of_experience || 0,
      salary: employee.salary || 0,
      hire_date: employee.hire_date || new Date().toISOString().split('T')[0],
      is_available: employee.is_available ?? true,
    })
    checkLicenseRequired(employee.job_title_id)
    setShowModal(true)
  }

  // ─────────────────────────────────────────────────────────────
  // فلترة الموظفين
  // ─────────────────────────────────────────────────────────────
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = !searchQuery || 
      emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !filterStatus || emp.status === filterStatus
    return matchesSearch && matchesStatus
  })

  // ─────────────────────────────────────────────────────────────
  // إحصائيات
  // ─────────────────────────────────────────────────────────────
  const activeEmployees = employees.filter(e => e.status === 'active')
  const pendingInvitations = invitations.filter(i => i.status === 'pending')
  
  const stats = {
    total: employees.length,
    active: activeEmployees.length,
    pending: employees.filter(e => e.admin_approval_status === 'pending').length,
    invitations: pendingInvitations.length,
    totalSalary: activeEmployees.reduce((sum, e) => sum + (e.salary || 0), 0),
  }

  const isCostPlus = armData?.payment_model === 'cost_plus'
  const marginRate = armData?.cost_plus_margin || 20

  // ─────────────────────────────────────────────────────────────
  // الحصول على اسم المسمى
  // ─────────────────────────────────────────────────────────────
  const getTitleName = (titleId: string) => {
    const title = jobTitles.find(t => t.id === titleId)
    return title?.title_ar || '-'
  }

  // ─────────────────────────────────────────────────────────────
  // شارة الحالة
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // شارة حالة الدعوة
  // ─────────────────────────────────────────────────────────────
  const getInviteStatusBadge = (invite: any) => {
    const isExpired = new Date(invite.expires_at) < new Date()
    
    if (invite.status === 'accepted') {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">مقبولة</span>
    }
    if (invite.status === 'cancelled') {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">ملغاة</span>
    }
    if (isExpired || invite.status === 'expired') {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">منتهية</span>
    }
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">معلقة</span>
  }

  // ─────────────────────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // العرض الرئيسي
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">👥 إدارة المحامين</h1>
          <p className="text-slate-500 mt-1">
            إجمالي {stats.total} | نشط {stats.active}
            {stats.invitations > 0 && ` | دعوات معلقة ${stats.invitations}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { resetForm(); setModalMode('invite'); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <Mail className="w-5 h-5" />
            دعوة محامي
          </button>
          <button
            onClick={() => { resetForm(); setModalMode('add'); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
          >
            <Plus className="w-5 h-5" />
            إضافة مباشرة
          </button>
        </div>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">دعوات معلقة</p>
              <p className="text-xl font-bold text-slate-800">{stats.invitations}</p>
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
              <p className="text-xl font-bold text-slate-800">{stats.totalSalary.toLocaleString()}</p>
            </div>
          </div>
        </div>
        {isCostPlus && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">التكلفة + {marginRate}%</p>
                <p className="text-xl font-bold text-slate-800">{Math.round(stats.totalSalary * (1 + marginRate / 100)).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* التبويبات */}
<div className="bg-white rounded-xl shadow-sm">
  <div className="flex border-b">
    <div
      role="button"
      tabIndex={0}
      onClick={() => setActiveTab('employees')}
      onKeyDown={(e) => e.key === 'Enter' && setActiveTab('employees')}
      style={{ cursor: 'pointer' }}
      className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
        activeTab === 'employees' 
          ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50' 
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
      }`}
    >
      <Users className="w-5 h-5 inline ml-2" />
      المحامين ({employees.length})
    </div>
    <div
      role="button"
      tabIndex={0}
      onClick={() => setActiveTab('invitations')}
      onKeyDown={(e) => e.key === 'Enter' && setActiveTab('invitations')}
      style={{ cursor: 'pointer' }}
      className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
        activeTab === 'invitations' 
          ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
      }`}
    >
      <Mail className="w-5 h-5 inline ml-2" />
      الدعوات ({invitations.length})
      {pendingInvitations.length > 0 && (
        <span className="mr-2 px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs">
          {pendingInvitations.length}
        </span>
      )}
    </div>
  </div>

        {/* محتوى التبويب */}
        <div className="p-4">
          
          {/* ═══════════════════════════════════════════════════════ */}
          {/* تبويب المحامين */}
          {/* ═══════════════════════════════════════════════════════ */}
          {activeTab === 'employees' && (
            <>
              {/* الفلاتر */}
              <div className="flex flex-col md:flex-row gap-4 mb-4">
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
                  className="px-4 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">كل الحالات</option>
                  <option value="active">نشط</option>
                  <option value="pending">بانتظار الموافقة</option>
                  <option value="inactive">معطل</option>
                </select>
              </div>

              {/* جدول المحامين */}
              {filteredEmployees.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">المحامي</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">المسمى</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الراتب</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">التقييم</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الحالة</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الحساب</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredEmployees.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-medium">
                                {emp.full_name?.[0] || '؟'}
                              </div>
                              <div>
                                <p className="font-medium text-slate-800">{emp.full_name}</p>
                                <p className="text-sm text-slate-500">{emp.email || emp.phone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{getTitleName(emp.job_title_id)}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {emp.salary?.toLocaleString() || 0} ر.س
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-amber-400 fill-current" />
                              <span className="text-slate-700">{emp.rating_average?.toFixed(1) || '-'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(emp)}</td>
                          <td className="px-4 py-3">
                            {emp.user_id ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                مفعّل
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                غير مفعّل
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => openEditModal(emp)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600" title="تعديل">
                                <Edit className="w-4 h-4" />
                              </button>
                              {emp.admin_approval_status !== 'pending' && (
                                <button
                                  onClick={() => toggleStatus(emp)}
                                  className={`p-2 hover:bg-slate-100 rounded-lg ${emp.status === 'active' ? 'text-yellow-600' : 'text-green-600'}`}
                                  title={emp.status === 'active' ? 'تعطيل' : 'تفعيل'}
                                >
                                  {emp.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                </button>
                              )}
                              <button onClick={() => setShowDeleteConfirm(emp.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-600" title="إنهاء الخدمة">
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
                  <p className="text-slate-500 mb-4">ابدأ بدعوة أو إضافة محامين للذراع القانوني</p>
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════ */}
          {/* تبويب الدعوات */}
          {/* ═══════════════════════════════════════════════════════ */}
          {activeTab === 'invitations' && (
            <>
              {invitations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">المدعو</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">البريد/الجوال</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">المسمى</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الراتب</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">تاريخ الإرسال</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الحالة</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invitations.map(invite => (
                        <tr key={invite.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                                {invite.full_name?.[0] || '؟'}
                              </div>
                              <p className="font-medium text-slate-800">{invite.full_name}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {invite.email || invite.phone}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{getTitleName(invite.job_title_id)}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {invite.salary?.toLocaleString() || 0} ر.س
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-sm">
                            {new Date(invite.created_at).toLocaleDateString('ar-SA')}
                          </td>
                          <td className="px-4 py-3">{getInviteStatusBadge(invite)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => copyInviteLink(invite.token)}
                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                                title="نسخ الرابط"
                              >
                                {copiedToken === invite.token ? (
                                  <UserCheck className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                              {invite.status === 'pending' && (
                                <>
                                  <button 
                                    onClick={() => resendInvitation(invite)}
                                    className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                                    title="إعادة إرسال"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => setShowCancelInviteConfirm(invite.id)}
                                    className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                                    title="إلغاء"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {(invite.status === 'expired' || new Date(invite.expires_at) < new Date()) && invite.status !== 'cancelled' && (
                                <button 
                                  onClick={() => resendInvitation(invite)}
                                  className="p-2 hover:bg-green-50 rounded-lg text-green-600"
                                  title="تجديد الدعوة"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Mail className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-medium text-slate-800 mb-2">لا توجد دعوات</h3>
                  <p className="text-slate-500 mb-4">أرسل دعوات للمحامين للانضمام للفريق</p>
                  <button
                    onClick={() => { resetForm(); setModalMode('invite'); setShowModal(true) }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    <Mail className="w-5 h-5" />
                    إرسال دعوة
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Modal إضافة/تعديل/دعوة */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                {modalMode === 'invite' && '📧 دعوة محامي جديد'}
                {modalMode === 'add' && '➕ إضافة محامي مباشرة'}
                {modalMode === 'edit' && '✏️ تعديل بيانات المحامي'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={modalMode === 'invite' ? handleSendInvitation : handleDirectAdd} className="p-6 space-y-6">
              
              {/* تنبيه نوع الإضافة */}
              {modalMode === 'invite' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-blue-800 text-sm flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    سيتم إنشاء رابط دعوة للمحامي لتفعيل حسابه والانضمام للفريق
                  </p>
                </div>
              )}
              
              {modalMode === 'add' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-amber-800 text-sm flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    الإضافة المباشرة للمحامين الذين ليس لديهم بريد إلكتروني. يمكن تفعيل حسابهم لاحقاً.
                  </p>
                </div>
              )}

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
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      البريد الإلكتروني {modalMode === 'invite' && '*'}
                    </label>
                    <input
                      type="email"
                      required={modalMode === 'invite'}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">رقم الجوال</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                      placeholder="05xxxxxxxx"
                    />
                  </div>
                  {modalMode !== 'invite' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">رقم الهوية</label>
                        <input
                          type="text"
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
                    </>
                  )}
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">الراتب الشهري (ريال)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.salary}
                      onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ التعيين</label>
                    <input
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                
                {isCostPlus && modalMode === 'add' && (
                  <div className="mt-3 p-3 bg-emerald-50 rounded-lg">
                    <p className="text-sm text-emerald-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      سيتم إرسال طلب للأدمن للموافقة على الراتب (نموذج Cost Plus)
                    </p>
                  </div>
                )}
              </div>

              {modalMode !== 'invite' && (
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
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">
                  إلغاء
                </button>
                <button
                  type="submit"
                  className={`flex-1 px-4 py-2 text-white rounded-lg flex items-center justify-center gap-2 ${
                    modalMode === 'invite' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {modalMode === 'invite' && (
                    <>
                      <Send className="w-5 h-5" />
                      إرسال الدعوة
                    </>
                  )}
                  {modalMode === 'add' && (
                    <>
                      <UserPlus className="w-5 h-5" />
                      {isCostPlus ? 'إرسال للموافقة' : 'إضافة المحامي'}
                    </>
                  )}
                  {modalMode === 'edit' && 'تحديث البيانات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Modal تأكيد إنهاء الخدمة */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">إنهاء خدمة المحامي</h3>
            <p className="text-slate-500 mb-4">هل أنت متأكد من إنهاء خدمة هذا المحامي؟</p>
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

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Modal تأكيد إلغاء الدعوة */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showCancelInviteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">إلغاء الدعوة</h3>
            <p className="text-slate-500 mb-4">هل أنت متأكد من إلغاء هذه الدعوة؟</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelInviteConfirm(null)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg">
                تراجع
              </button>
              <button onClick={() => cancelInvitation(showCancelInviteConfirm)} className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg">
                إلغاء الدعوة
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}