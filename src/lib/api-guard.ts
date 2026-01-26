// ═══════════════════════════════════════════════════════════════════════════════
// API Route Protection Utilities
// Wrappers and guards for securing API routes
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, type UserRole, type SessionData } from './supabase-server'
import { hasPermission, type PermissionCode, type PermissionContext } from './permissions'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuthenticatedRequest extends NextRequest {
  session: SessionData
}

export type ApiHandler<T = unknown> = (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => Promise<NextResponse<T>>

export type AuthenticatedApiHandler<T = unknown> = (
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) => Promise<NextResponse<T>>

export interface ApiGuardOptions {
  // Required user roles (any of these)
  roles?: UserRole[]
  // Required permissions (all of these)
  permissions?: PermissionCode[]
  // Custom validation function
  validate?: (session: SessionData, request: NextRequest) => Promise<boolean>
}

// ═══════════════════════════════════════════════════════════════════════════════
// Response Helpers
// ═══════════════════════════════════════════════════════════════════════════════

export function jsonResponse<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status })
}

export function errorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  )
}

export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  )
}

export function forbiddenResponse(message = 'Forbidden - Insufficient permissions'): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403 }
  )
}

export function notFoundResponse(message = 'Resource not found'): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status: 404 }
  )
}

export function serverErrorResponse(message = 'Internal server error'): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status: 500 }
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// API Guard Wrapper
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wrap an API handler with authentication and authorization checks
 *
 * @example
 * // Basic auth required
 * export const GET = withApiGuard(async (request) => {
 *   const { session } = request
 *   return jsonResponse({ userId: session.userId })
 * })
 *
 * @example
 * // With role restriction
 * export const POST = withApiGuard(async (request) => {
 *   // Only lawyers can access this
 *   return jsonResponse({ success: true })
 * }, { roles: ['lawyer'] })
 *
 * @example
 * // With permission check
 * export const DELETE = withApiGuard(async (request) => {
 *   return jsonResponse({ deleted: true })
 * }, { permissions: ['cases.delete'] })
 */
export function withApiGuard(
  handler: AuthenticatedApiHandler,
  options: ApiGuardOptions = {}
): ApiHandler {
  return async (request: NextRequest, context) => {
    try {
      // 1. Check authentication
      const session = getSessionFromRequest(request)

      if (!session) {
        return unauthorizedResponse('Please login to access this resource')
      }

      // 2. Check role restriction
      if (options.roles && options.roles.length > 0) {
        if (!options.roles.includes(session.userType)) {
          return forbiddenResponse(`This resource is only accessible to: ${options.roles.join(', ')}`)
        }
      }

      // 3. Check permissions
      if (options.permissions && options.permissions.length > 0) {
        // Build permission context
        const permContext: PermissionContext = {
          userId: session.userId,
          userType: session.userType === 'lawyer' ? 'lawyer' : 'partner_employee',
          entityId: session.lawyerId || session.partnerId || session.userId,
          entityType: session.legalArmId ? 'legal_arm' : session.partnerId ? 'partner' : 'lawyer',
        }

        // Check each required permission
        for (const permission of options.permissions) {
          const hasPerm = await hasPermission(permContext, permission)
          if (!hasPerm) {
            return forbiddenResponse(`Missing required permission: ${permission}`)
          }
        }
      }

      // 4. Run custom validation
      if (options.validate) {
        const isValid = await options.validate(session, request)
        if (!isValid) {
          return forbiddenResponse('Custom validation failed')
        }
      }

      // 5. All checks passed - call the handler
      const authenticatedRequest = request as AuthenticatedRequest
      authenticatedRequest.session = session

      return handler(authenticatedRequest, context)
    } catch (error) {
      console.error('API Guard error:', error)
      return serverErrorResponse()
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Specialized Guards
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Guard for member-only endpoints
 */
export function withMemberGuard(handler: AuthenticatedApiHandler): ApiHandler {
  return withApiGuard(handler, { roles: ['member'] })
}

/**
 * Guard for lawyer-only endpoints
 */
export function withLawyerGuard(handler: AuthenticatedApiHandler): ApiHandler {
  return withApiGuard(handler, { roles: ['lawyer'] })
}

/**
 * Guard for partner-only endpoints
 */
export function withPartnerGuard(handler: AuthenticatedApiHandler): ApiHandler {
  return withApiGuard(handler, { roles: ['partner', 'partner_employee'] })
}

/**
 * Guard for admin-only endpoints
 */
export function withAdminGuard(handler: AuthenticatedApiHandler): ApiHandler {
  return withApiGuard(handler, { roles: ['admin', 'staff'] })
}

// ═══════════════════════════════════════════════════════════════════════════════
// Request Body Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Safely parse JSON body from request
 */
export async function parseJsonBody<T>(request: NextRequest): Promise<T | null> {
  try {
    const body = await request.json()
    return body as T
  } catch {
    return null
  }
}

/**
 * Get user info from middleware headers (set by middleware)
 */
export function getUserFromHeaders(request: NextRequest): {
  userId: string | null
  userType: UserRole | null
  memberId: string | null
  lawyerId: string | null
  partnerId: string | null
  legalArmId: string | null
} {
  return {
    userId: request.headers.get('x-user-id'),
    userType: request.headers.get('x-user-type') as UserRole | null,
    memberId: request.headers.get('x-member-id'),
    lawyerId: request.headers.get('x-lawyer-id'),
    partnerId: request.headers.get('x-partner-id'),
    legalArmId: request.headers.get('x-legal-arm-id'),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Validation Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
  body: Record<string, unknown>,
  fields: string[]
): { valid: boolean; missing: string[] } {
  const missing = fields.filter(field => {
    const value = body[field]
    return value === undefined || value === null || value === ''
  })

  return {
    valid: missing.length === 0,
    missing,
  }
}

/**
 * Validate UUID format
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * Validate Saudi phone number
 */
export function isValidSaudiPhone(phone: string): boolean {
  // Accepts: +9665xxxxxxxx, 05xxxxxxxx, 5xxxxxxxx
  const cleaned = phone.replace(/\s|-/g, '')
  return /^(\+966|966|0)?5[0-9]{8}$/.test(cleaned)
}

/**
 * Validate Saudi National ID
 */
export function isValidNationalId(id: string): boolean {
  // Saudi National ID: starts with 1, 10 digits
  return /^1[0-9]{9}$/.test(id)
}

/**
 * Validate IQAMA number
 */
export function isValidIqama(id: string): boolean {
  // IQAMA: starts with 2, 10 digits
  return /^2[0-9]{9}$/.test(id)
}
