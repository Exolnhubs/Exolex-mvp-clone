// ═══════════════════════════════════════════════════════════════════════════════
// API: Clear Authentication Cookies
// Server-side cookie clearing for logout
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'

// All auth cookies to clear
const AUTH_COOKIES = [
  'exolex_user_id',
  'exolex_user_type',
  'exolex_member_id',
  'exolex_lawyer_id',
  'exolex_partner_id',
  'exolex_arm_id',
  'exolex_employee_id',
  'exolex_session',
]

export async function POST() {
  try {
    const response = NextResponse.json({ success: true })

    // Clear all auth cookies by setting them to empty with maxAge 0
    for (const cookieName of AUTH_COOKIES) {
      response.cookies.set(cookieName, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0, // Expire immediately
      })
    }

    return response

  } catch (error) {
    console.error('Error clearing auth cookies:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to clear cookies' },
      { status: 500 }
    )
  }
}
