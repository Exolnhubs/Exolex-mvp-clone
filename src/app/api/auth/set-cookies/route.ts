// ═══════════════════════════════════════════════════════════════════════════════
// API: Set Authentication Cookies (httpOnly)
// Server-side cookie setting for security - prevents XSS access to auth tokens
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 days in seconds
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Valid user types
const VALID_USER_TYPES = ['member', 'lawyer', 'partner', 'partner_employee', 'legal_arm']

// Cookie configuration
const cookieOptions = {
  httpOnly: true,
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

    // Create response
    const response = NextResponse.json({ success: true })

    // Set user type cookie (always required)
    response.cookies.set('exolex_user_type', body.userType, cookieOptions)

    // Set user ID cookie
    if (body.userId) {
      response.cookies.set('exolex_user_id', body.userId, cookieOptions)
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
        }
        break
    }

    return response

  } catch (error) {
    console.error('Error setting auth cookies:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to set cookies' },
      { status: 500 }
    )
  }
}
