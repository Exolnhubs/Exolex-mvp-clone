// ═══════════════════════════════════════════════════════════════════════════════
// Next.js Middleware - Authentication & Authorization
// Runs on every request before reaching the page/API
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  getSessionFromRequest,
  canAccessRoute,
  getDefaultRedirectForRole,
  type UserRole
} from '@/lib/supabase-server'

// ═══════════════════════════════════════════════════════════════════════════════
// Route Configuration
// ═══════════════════════════════════════════════════════════════════════════════

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/subscriber',
  '/independent',
  '/legal-arm',
  '/legal-arm-lawyer',
  '/partner',
  '/admin',
]

// Routes that should redirect authenticated users away
const AUTH_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/lawyer-login',
  '/auth/legal-arm-login',
  '/auth/partner-login',
]

// Public routes (no auth required)
const PUBLIC_ROUTES = [
  '/',
  '/marketplace',
  '/api/send-otp',
  '/api/verify-otp',
  '/api/referral/click',
]

// API routes that require authentication
const PROTECTED_API_ROUTES = [
  '/api/chat',
  '/api/nolex',
  '/api/reminders/process',
]

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route))
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(route => pathname.startsWith(route))
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  )
}

function isProtectedApiRoute(pathname: string): boolean {
  return PROTECTED_API_ROUTES.some(route => pathname.startsWith(route))
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // Has file extension
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Middleware
// ═══════════════════════════════════════════════════════════════════════════════

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static assets and Next.js internals
  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  // Get session from secure cookie
  const session = getSessionFromRequest(request)
  const isAuthenticated = !!session

  // ─────────────────────────────────────────────────────────────
  // Handle Protected Routes
  // ─────────────────────────────────────────────────────────────
  if (isProtectedRoute(pathname)) {
    // Not authenticated -> redirect to login
    if (!isAuthenticated) {
      const loginUrl = getLoginUrlForRoute(pathname)
      const url = request.nextUrl.clone()
      url.pathname = loginUrl
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    // Authenticated but wrong role -> redirect to correct portal
    if (!canAccessRoute(session.userType, pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = getDefaultRedirectForRole(session.userType)
      return NextResponse.redirect(url)
    }

    // Profile not complete -> redirect to complete profile
    // (except if already on complete-profile page)
    if (!pathname.includes('complete-profile')) {
      // We'll check this in a separate utility since we need DB access
      // For now, pass through
    }

    // All checks passed
    return NextResponse.next()
  }

  // ─────────────────────────────────────────────────────────────
  // Handle Auth Routes (login/register pages)
  // ─────────────────────────────────────────────────────────────
  if (isAuthRoute(pathname)) {
    // Already authenticated -> redirect to dashboard
    if (isAuthenticated) {
      const url = request.nextUrl.clone()
      url.pathname = getDefaultRedirectForRole(session.userType)
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  }

  // ─────────────────────────────────────────────────────────────
  // Handle Protected API Routes
  // ─────────────────────────────────────────────────────────────
  if (isProtectedApiRoute(pathname)) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    // Add user info to request headers for API routes
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', session.userId)
    requestHeaders.set('x-user-type', session.userType)
    if (session.memberId) requestHeaders.set('x-member-id', session.memberId)
    if (session.lawyerId) requestHeaders.set('x-lawyer-id', session.lawyerId)
    if (session.partnerId) requestHeaders.set('x-partner-id', session.partnerId)
    if (session.legalArmId) requestHeaders.set('x-legal-arm-id', session.legalArmId)

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  // ─────────────────────────────────────────────────────────────
  // Public Routes - Allow through
  // ─────────────────────────────────────────────────────────────
  return NextResponse.next()
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: Get appropriate login URL based on route
// ═══════════════════════════════════════════════════════════════════════════════

function getLoginUrlForRoute(pathname: string): string {
  if (pathname.startsWith('/subscriber')) {
    return '/auth/login'
  }
  if (pathname.startsWith('/independent')) {
    return '/auth/lawyer-login'
  }
  if (pathname.startsWith('/legal-arm')) {
    return '/auth/legal-arm-login'
  }
  if (pathname.startsWith('/partner')) {
    return '/auth/partner-login'
  }
  return '/auth/login'
}

// ═══════════════════════════════════════════════════════════════════════════════
// Middleware Config - Define which routes to run middleware on
// ═══════════════════════════════════════════════════════════════════════════════

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
