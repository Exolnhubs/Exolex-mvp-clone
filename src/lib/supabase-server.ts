// ═══════════════════════════════════════════════════════════════════════════════
// Supabase Server-Side Utilities
// For use in Server Components, API Routes, and Middleware
// ═══════════════════════════════════════════════════════════════════════════════

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type UserRole = 'member' | 'lawyer' | 'partner' | 'partner_employee' | 'legal_arm' | 'admin' | 'staff'

export interface SessionUser {
  id: string
  phone: string
  user_type: UserRole
  full_name: string | null
  is_profile_complete: boolean
  // Extended IDs based on role
  member_id?: string
  lawyer_id?: string
  partner_id?: string
  legal_arm_id?: string
}

export interface AuthSession {
  user: SessionUser | null
  isAuthenticated: boolean
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Component Client (for use in Server Components and API Routes)
// ═══════════════════════════════════════════════════════════════════════════════

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - ignore
          }
        },
      },
    }
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Middleware Client (for use in middleware.ts)
// ═══════════════════════════════════════════════════════════════════════════════

export function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  return { supabase, response }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Session Management - JWT-like tokens with HMAC-SHA256 signing
// ═══════════════════════════════════════════════════════════════════════════════

const SESSION_COOKIE_NAME = 'exolex_session'
const SESSION_EXPIRY_DAYS = 7

// Secret key for signing sessions - MUST be set in production
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production-min-32-chars'

export interface SessionData {
  userId: string
  userType: UserRole
  phone: string
  expiresAt: number
  // Role-specific IDs
  memberId?: string
  lawyerId?: string
  partnerId?: string
  legalArmId?: string
  // Session metadata
  issuedAt?: number
}

/**
 * Create HMAC-SHA256 signature for session data
 */
function signSession(payload: string): string {
  return createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url')
}

/**
 * Verify HMAC signature using timing-safe comparison
 */
function verifySignature(payload: string, signature: string): boolean {
  const expectedSignature = signSession(payload)

  // Convert to buffers for timing-safe comparison
  const sigBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  // Signatures must be same length for timing-safe comparison
  if (sigBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(sigBuffer, expectedBuffer)
}

/**
 * Create a secure signed session token after successful authentication
 * Format: base64url(payload).signature
 */
export function createSession(data: Omit<SessionData, 'expiresAt' | 'issuedAt'>): string {
  const session: SessionData = {
    ...data,
    expiresAt: Date.now() + (SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    issuedAt: Date.now()
  }

  // Encode payload as base64url
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')

  // Create signature
  const signature = signSession(payload)

  // Return token in format: payload.signature
  return `${payload}.${signature}`
}

/**
 * Parse and validate signed session token
 * Returns null if token is invalid, tampered with, or expired
 */
export function parseSession(sessionToken: string | undefined): SessionData | null {
  if (!sessionToken) return null

  try {
    // Split token into payload and signature
    const parts = sessionToken.split('.')
    if (parts.length !== 2) {
      return null
    }

    const [payload, signature] = parts

    // Verify signature FIRST (before parsing payload)
    if (!verifySignature(payload, signature)) {
      // Signature mismatch - token has been tampered with
      return null
    }

    // Decode and parse payload
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8')
    const session: SessionData = JSON.parse(decoded)

    // Validate required fields
    if (!session.userId || !session.userType || !session.expiresAt) {
      return null
    }

    // Check expiry
    if (session.expiresAt < Date.now()) {
      return null
    }

    // Validate userType is a known role
    const validRoles: UserRole[] = ['member', 'lawyer', 'partner', 'partner_employee', 'legal_arm', 'admin', 'staff']
    if (!validRoles.includes(session.userType)) {
      return null
    }

    return session
  } catch {
    return null
  }
}

/**
 * Set session cookie in response
 */
export function setSessionCookie(response: NextResponse, sessionToken: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    path: '/',
  })
}

/**
 * Clear session cookie (logout)
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}

/**
 * Get session from request
 */
export function getSessionFromRequest(request: NextRequest): SessionData | null {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  return parseSession(sessionToken)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Role-Based Route Access
// ═══════════════════════════════════════════════════════════════════════════════

export const ROUTE_ACCESS: Record<string, UserRole[]> = {
  '/subscriber': ['member'],
  '/independent': ['lawyer'],
  '/legal-arm': ['legal_arm'],
  '/legal-arm-lawyer': ['lawyer'], // lawyers working under legal arm
  '/partner': ['partner', 'partner_employee'],
  '/admin': ['admin', 'staff'],
}

/**
 * Check if a user role can access a given path
 */
export function canAccessRoute(userType: UserRole, pathname: string): boolean {
  // Find matching route prefix
  for (const [routePrefix, allowedRoles] of Object.entries(ROUTE_ACCESS)) {
    if (pathname.startsWith(routePrefix)) {
      return allowedRoles.includes(userType)
    }
  }
  // Public routes
  return true
}

/**
 * Get redirect path based on user role
 */
export function getDefaultRedirectForRole(userType: UserRole): string {
  switch (userType) {
    case 'member':
      return '/subscriber/dashboard'
    case 'lawyer':
      return '/independent/dashboard'
    case 'legal_arm':
      return '/legal-arm/dashboard'
    case 'partner':
    case 'partner_employee':
      return '/partner/dashboard'
    case 'admin':
    case 'staff':
      return '/admin/dashboard'
    default:
      return '/'
  }
}
