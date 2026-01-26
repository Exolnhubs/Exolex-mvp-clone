// ═══════════════════════════════════════════════════════════════════════════════
// Permission Management Utilities
// Server-side permission checking for RBAC
// ═══════════════════════════════════════════════════════════════════════════════

import { createSupabaseServerClient } from './supabase-server'

// ═══════════════════════════════════════════════════════════════════════════════
// Permission Codes (must match partner_permissions table)
// ═══════════════════════════════════════════════════════════════════════════════

export const PERMISSIONS = {
  // Requests
  REQUESTS_VIEW: 'requests.view',
  REQUESTS_CREATE: 'requests.create',
  REQUESTS_EDIT: 'requests.edit',
  REQUESTS_DELETE: 'requests.delete',
  REQUESTS_ASSIGN: 'requests.assign',

  // Quotes
  QUOTES_VIEW: 'quotes.view',
  QUOTES_CREATE: 'quotes.create',
  QUOTES_EDIT: 'quotes.edit',
  QUOTES_APPROVE: 'quotes.approve',

  // Cases
  CASES_VIEW: 'cases.view',
  CASES_CREATE: 'cases.create',
  CASES_EDIT: 'cases.edit',
  CASES_DELETE: 'cases.delete',
  CASES_ASSIGN: 'cases.assign',

  // Documents
  DOCUMENTS_VIEW: 'documents.view',
  DOCUMENTS_UPLOAD: 'documents.upload',
  DOCUMENTS_DELETE: 'documents.delete',

  // Finance
  FINANCE_VIEW: 'finance.view',
  FINANCE_MANAGE: 'finance.manage',
  FINANCE_WITHDRAW: 'finance.withdraw',

  // Reports
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  // Team
  TEAM_VIEW: 'team.view',
  TEAM_MANAGE: 'team.manage',
  TEAM_PERMISSIONS: 'team.permissions',

  // Services
  SERVICES_VIEW: 'services.view',
  SERVICES_MANAGE: 'services.manage',

  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
} as const

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS]

// ═══════════════════════════════════════════════════════════════════════════════
// Permission Checking
// ═══════════════════════════════════════════════════════════════════════════════

export interface PermissionContext {
  userId: string
  userType: 'lawyer' | 'partner_employee'
  entityId: string // lawyer_id, partner_employee_id
  entityType: 'lawyer' | 'partner' | 'legal_arm'
}

/**
 * Check if a user has a specific permission
 */
export async function hasPermission(
  context: PermissionContext,
  permission: PermissionCode
): Promise<boolean> {
  const supabase = await createSupabaseServerClient()

  try {
    // Determine which table to query based on entity type
    let query
    if (context.userType === 'lawyer') {
      query = supabase
        .from('lawyers')
        .select('permissions')
        .eq('id', context.entityId)
        .single()
    } else {
      query = supabase
        .from('partner_employees')
        .select('permissions')
        .eq('id', context.entityId)
        .single()
    }

    const { data, error } = await query

    if (error || !data) {
      console.error('Permission check failed:', error)
      return false
    }

    const permissions = data.permissions as Record<string, boolean> | null
    return permissions?.[permission] === true
  } catch (error) {
    console.error('Permission check error:', error)
    return false
  }
}

/**
 * Check if a user has ALL of the specified permissions
 */
export async function hasAllPermissions(
  context: PermissionContext,
  permissions: PermissionCode[]
): Promise<boolean> {
  const supabase = await createSupabaseServerClient()

  try {
    let query
    if (context.userType === 'lawyer') {
      query = supabase
        .from('lawyers')
        .select('permissions')
        .eq('id', context.entityId)
        .single()
    } else {
      query = supabase
        .from('partner_employees')
        .select('permissions')
        .eq('id', context.entityId)
        .single()
    }

    const { data, error } = await query

    if (error || !data) {
      return false
    }

    const userPermissions = data.permissions as Record<string, boolean> | null
    if (!userPermissions) return false

    return permissions.every(p => userPermissions[p] === true)
  } catch (error) {
    console.error('Permission check error:', error)
    return false
  }
}

/**
 * Check if a user has ANY of the specified permissions
 */
export async function hasAnyPermission(
  context: PermissionContext,
  permissions: PermissionCode[]
): Promise<boolean> {
  const supabase = await createSupabaseServerClient()

  try {
    let query
    if (context.userType === 'lawyer') {
      query = supabase
        .from('lawyers')
        .select('permissions')
        .eq('id', context.entityId)
        .single()
    } else {
      query = supabase
        .from('partner_employees')
        .select('permissions')
        .eq('id', context.entityId)
        .single()
    }

    const { data, error } = await query

    if (error || !data) {
      return false
    }

    const userPermissions = data.permissions as Record<string, boolean> | null
    if (!userPermissions) return false

    return permissions.some(p => userPermissions[p] === true)
  } catch (error) {
    console.error('Permission check error:', error)
    return false
  }
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(
  context: Pick<PermissionContext, 'userType' | 'entityId'>
): Promise<Record<string, boolean>> {
  const supabase = await createSupabaseServerClient()

  try {
    let query
    if (context.userType === 'lawyer') {
      query = supabase
        .from('lawyers')
        .select('permissions')
        .eq('id', context.entityId)
        .single()
    } else {
      query = supabase
        .from('partner_employees')
        .select('permissions')
        .eq('id', context.entityId)
        .single()
    }

    const { data, error } = await query

    if (error || !data) {
      return {}
    }

    return (data.permissions as Record<string, boolean>) || {}
  } catch (error) {
    console.error('Get permissions error:', error)
    return {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Permission Helpers for Common Checks
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if user can manage team (employees, roles, permissions)
 */
export async function canManageTeam(context: PermissionContext): Promise<boolean> {
  return hasAnyPermission(context, [
    PERMISSIONS.TEAM_MANAGE,
    PERMISSIONS.TEAM_PERMISSIONS,
  ])
}

/**
 * Check if user can manage finances
 */
export async function canManageFinance(context: PermissionContext): Promise<boolean> {
  return hasPermission(context, PERMISSIONS.FINANCE_MANAGE)
}

/**
 * Check if user can create and send quotes
 */
export async function canCreateQuotes(context: PermissionContext): Promise<boolean> {
  return hasPermission(context, PERMISSIONS.QUOTES_CREATE)
}

/**
 * Check if user can assign requests/cases
 */
export async function canAssignWork(context: PermissionContext): Promise<boolean> {
  return hasAnyPermission(context, [
    PERMISSIONS.REQUESTS_ASSIGN,
    PERMISSIONS.CASES_ASSIGN,
  ])
}

// ═══════════════════════════════════════════════════════════════════════════════
// Ownership Checks
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a lawyer/employee belongs to a specific organization
 */
export async function belongsToOrganization(
  userId: string,
  organizationType: 'partner' | 'legal_arm',
  organizationId: string
): Promise<boolean> {
  const supabase = await createSupabaseServerClient()

  try {
    if (organizationType === 'partner') {
      const { data, error } = await supabase
        .from('partner_employees')
        .select('id')
        .eq('user_id', userId)
        .eq('partner_id', organizationId)
        .eq('status', 'active')
        .single()

      return !error && !!data
    } else {
      const { data, error } = await supabase
        .from('lawyers')
        .select('id')
        .eq('user_id', userId)
        .eq('legal_arm_id', organizationId)
        .eq('status', 'active')
        .single()

      return !error && !!data
    }
  } catch (error) {
    return false
  }
}

/**
 * Check if a user owns or is assigned to a specific resource
 */
export async function ownsResource(
  userId: string,
  resourceType: 'service_request' | 'case' | 'service_offer',
  resourceId: string
): Promise<boolean> {
  const supabase = await createSupabaseServerClient()

  try {
    let query
    switch (resourceType) {
      case 'service_request':
        query = supabase
          .from('service_requests')
          .select('id')
          .eq('id', resourceId)
          .or(`assigned_lawyer_id.eq.${userId},created_by.eq.${userId}`)
          .single()
        break
      case 'service_offer':
        query = supabase
          .from('service_offers')
          .select('id')
          .eq('id', resourceId)
          .eq('created_by', userId)
          .single()
        break
      default:
        return false
    }

    const { data, error } = await query
    return !error && !!data
  } catch (error) {
    return false
  }
}
