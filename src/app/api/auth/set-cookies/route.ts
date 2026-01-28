// ═══════════════════════════════════════════════════════════════════════════════
// API: Set Authentication Cookies
// Server-side cookie setting with database ownership verification
// User IDs are readable (for client JS) but verified server-side for security
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSession, setSessionCookie, type UserRole } from '@/lib/supabase-server'

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 days in seconds
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Supabase client for database verification
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Valid user types
const VALID_USER_TYPES = ['member', 'lawyer', 'partner', 'partner_employee', 'legal_arm']

// Cookie configuration - readable by JS (user IDs are not secrets)
// Security comes from server-side verification, not hiding values
const cookieOptions = {
  httpOnly: false, // Allow JS to read (needed for client-side routing)
  secure: IS_PRODUCTION,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: COOKIE_MAX_AGE,
}

interface SetCookiesRequest {
  userType: string
  userId?: string
  memberId?: string
  lawyerId?: string
  partnerId?: string
  employeeId?: string
  legalArmId?: string
}

/**
 * Verify that the provided IDs exist in the database and match the user type
 */
async function verifyOwnership(body: SetCookiesRequest): Promise<{ valid: boolean; error?: string }> {
  try {
    switch (body.userType) {
      case 'member': {
        if (body.memberId) {
          const { data, error } = await supabase
            .from('members')
            .select('id, user_id')
            .eq('id', body.memberId)
            .single()

          if (error || !data) {
            return { valid: false, error: 'Member not found' }
          }

          // If userId provided, verify it matches
          if (body.userId && data.user_id !== body.userId) {
            return { valid: false, error: 'User ID mismatch' }
          }
        } else if (body.userId) {
          // Verify user exists
          const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('id', body.userId)
            .single()

          if (error || !data) {
            return { valid: false, error: 'User not found' }
          }
        }
        break
      }

      case 'lawyer': {
        if (body.lawyerId) {
          const { data, error } = await supabase
            .from('lawyers')
            .select('id, legal_arm_id, status')
            .eq('id', body.lawyerId)
            .single()

          if (error || !data) {
            return { valid: false, error: 'Lawyer not found' }
          }

          // Verify lawyer is not suspended
          if (data.status === 'suspended') {
            return { valid: false, error: 'Lawyer account is suspended' }
          }

          // If legalArmId provided, verify it matches
          if (body.legalArmId && data.legal_arm_id !== body.legalArmId) {
            return { valid: false, error: 'Legal arm ID mismatch' }
          }
        }
        break
      }

      case 'partner': {
        if (body.partnerId) {
          const { data, error } = await supabase
            .from('partners')
            .select('id, status')
            .eq('id', body.partnerId)
            .single()

          if (error || !data) {
            return { valid: false, error: 'Partner not found' }
          }
        }
        break
      }

      case 'partner_employee': {
        if (body.employeeId) {
          const { data, error } = await supabase
            .from('partner_employees')
            .select('id, partner_id, status')
            .eq('id', body.employeeId)
            .single()

          if (error || !data) {
            return { valid: false, error: 'Employee not found' }
          }

          // Verify employee is not suspended
          if (data.status === 'suspended') {
            return { valid: false, error: 'Employee account is suspended' }
          }

          // If partnerId provided, verify it matches
          if (body.partnerId && data.partner_id !== body.partnerId) {
            return { valid: false, error: 'Partner ID mismatch' }
          }
        }
        break
      }

      case 'legal_arm': {
        if (body.legalArmId) {
          const { data, error } = await supabase
            .from('legal_arms')
            .select('id, status')
            .eq('id', body.legalArmId)
            .single()

          if (error || !data) {
            return { valid: false, error: 'Legal arm not found' }
          }
        }
        break
      }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'Database verification failed' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SetCookiesRequest = await request.json()

    // Validate user type
    if (!body.userType || !VALID_USER_TYPES.includes(body.userType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user type' },
        { status: 400 }
      )
    }

    // Validate that at least one ID is provided
    const hasId = body.userId || body.memberId || body.lawyerId ||
                  body.partnerId || body.employeeId || body.legalArmId
    if (!hasId) {
      return NextResponse.json(
        { success: false, error: 'At least one user ID is required' },
        { status: 400 }
      )
    }

    // Validate UUIDs (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const idsToValidate = [
      body.userId, body.memberId, body.lawyerId,
      body.partnerId, body.employeeId, body.legalArmId
    ].filter(Boolean)

    for (const id of idsToValidate) {
      if (!uuidRegex.test(id!)) {
        return NextResponse.json(
          { success: false, error: 'Invalid ID format' },
          { status: 400 }
        )
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECURITY: Verify ownership in database before setting cookies
    // This prevents attackers from setting arbitrary user IDs
    // ═══════════════════════════════════════════════════════════════════════════
    const verification = await verifyOwnership(body)
    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Verification failed' },
        { status: 403 }
      )
    }

    // Create response
    const response = NextResponse.json({ success: true })

    // Set user type cookie (always required)
    response.cookies.set('exolex_user_type', body.userType, cookieOptions)

    // Set user ID cookie (use fallback chain to ensure it's always set)
    const effectiveUserId = body.userId || body.lawyerId || body.partnerId || body.employeeId || body.legalArmId
    if (effectiveUserId) {
      response.cookies.set('exolex_user_id', effectiveUserId, cookieOptions)
    }

    // Set role-specific cookies based on user type
    switch (body.userType) {
      case 'member':
        if (body.memberId) {
          response.cookies.set('exolex_member_id', body.memberId, cookieOptions)
        }
        break

      case 'lawyer':
        if (body.lawyerId) {
          response.cookies.set('exolex_lawyer_id', body.lawyerId, cookieOptions)
        }
        if (body.legalArmId) {
          response.cookies.set('exolex_arm_id', body.legalArmId, cookieOptions)
          response.cookies.set('exolex_legal_arm_id', body.legalArmId, cookieOptions)
        }
        break

      case 'partner':
        if (body.partnerId) {
          response.cookies.set('exolex_partner_id', body.partnerId, cookieOptions)
        }
        break

      case 'partner_employee':
        if (body.employeeId) {
          response.cookies.set('exolex_employee_id', body.employeeId, cookieOptions)
        }
        if (body.partnerId) {
          response.cookies.set('exolex_partner_id', body.partnerId, cookieOptions)
        }
        break

      case 'legal_arm':
        if (body.legalArmId) {
          response.cookies.set('exolex_arm_id', body.legalArmId, cookieOptions)
          response.cookies.set('exolex_legal_arm_id', body.legalArmId, cookieOptions)
        }
        break
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CRITICAL: Create and set the signed session cookie for middleware auth
    // This is the primary auth mechanism used by the middleware
    // ═══════════════════════════════════════════════════════════════════════════
    const sessionToken = createSession({
      userId: body.userId || body.lawyerId || body.partnerId || body.employeeId || body.legalArmId || '',
      userType: body.userType as UserRole,
      phone: '', // Phone not needed for session validation
      memberId: body.memberId,
      lawyerId: body.lawyerId,
      partnerId: body.partnerId,
      legalArmId: body.legalArmId,
    })
    setSessionCookie(response, sessionToken)

    return response

  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to set cookies' },
      { status: 500 }
    )
  }
}
