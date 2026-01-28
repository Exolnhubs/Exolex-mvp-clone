// ═══════════════════════════════════════════════════════════════════════════════
// Next.js Middleware - Authentication, Authorization, Logging & Security
// Runs on every request before reaching the page/API
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  getSessionFromRequest,
  canAccessRoute,
  getDefaultRedirectForRole,
  type UserRole,
  type SessionData
} from '@/lib/supabase-server'
import {
  logger,
  createRequestContext,
  addRequestIdHeader,
  shouldLogRequest,
  recordMetrics,
  type RequestContext
} from '@/lib/logger'
import {
  isPreflight,
  handlePreflight,
  addCorsHeaders,
  addSecurityHeaders,
  routeNeedsCors,
  defaultCorsConfig
} from '@/lib/cors'
import { recordError } from '@/lib/error-tracker'

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
  const startTime = Date.now()

  // Skip static assets and Next.js internals
  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  // Create request context for logging
  const ctx = createRequestContext(request)

  // Log incoming request
  if (shouldLogRequest(pathname)) {
    logger.request(ctx)
  }

  // Handle CORS preflight requests
  if (isPreflight(request) && routeNeedsCors(pathname)) {
    const response = handlePreflight(request, defaultCorsConfig)
    logResponse(ctx, response.status, startTime)
    return response
  }

  // Get session from secure signed cookie (primary auth)
  let session = getSessionFromRequest(request)

  // Fallback: Read from individual auth cookies
  // The signed session (exolex_session) uses Node.js crypto (createHmac)
  // which may not be available in Edge Runtime where middleware runs.
  // Individual cookies are set by /api/auth/set-cookies with DB ownership
  // verification, providing server-side security.
  if (!session) {
    const cookieUserId = request.cookies.get('exolex_user_id')?.value
    const cookieUserType = request.cookies.get('exolex_user_type')?.value as UserRole | undefined

    if (cookieUserId && cookieUserType) {
      session = {
        userId: cookieUserId,
        userType: cookieUserType,
        phone: '',
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        memberId: request.cookies.get('exolex_member_id')?.value,
        lawyerId: request.cookies.get('exolex_lawyer_id')?.value,
        partnerId: request.cookies.get('exolex_partner_id')?.value,
        legalArmId: request.cookies.get('exolex_arm_id')?.value,
      }
    }
  }

  const isAuthenticated = !!session

  // ─────────────────────────────────────────────────────────────
  // Handle Protected Routes
  // ─────────────────────────────────────────────────────────────
  if (isProtectedRoute(pathname)) {
    // Not authenticated -> redirect to login
    if (!isAuthenticated) {
      logger.security(ctx, 'Unauthenticated access attempt', { route: pathname })
      const loginUrl = getLoginUrlForRoute(pathname)
      const url = request.nextUrl.clone()
      url.pathname = loginUrl
      url.searchParams.set('redirect', pathname)
      const response = NextResponse.redirect(url)
      logResponse(ctx, 302, startTime)
      return addRequestIdHeader(response, ctx.requestId)
    }

    // Authenticated but wrong role -> redirect to correct portal
    if (!canAccessRoute(session.userType, pathname)) {
      logger.security(ctx, 'Wrong role access attempt', {
        route: pathname,
        userRole: session.userType,
      })
      const url = request.nextUrl.clone()
      url.pathname = getDefaultRedirectForRole(session.userType)
      const response = NextResponse.redirect(url)
      logResponse(ctx, 302, startTime)
      return addRequestIdHeader(response, ctx.requestId)
    }

    // Profile not complete -> redirect to complete profile
    // (except if already on complete-profile page)
    if (!pathname.includes('complete-profile')) {
      // We'll check this in a separate utility since we need DB access
      // For now, pass through
    }

    // All checks passed
    const response = NextResponse.next()
    logResponse(ctx, 200, startTime)
    return addSecurityHeaders(addRequestIdHeader(response, ctx.requestId))
  }

  // ─────────────────────────────────────────────────────────────
  // Handle Auth Routes (login/register pages)
  // ─────────────────────────────────────────────────────────────
  if (isAuthRoute(pathname)) {
    // Already authenticated -> redirect to dashboard
    if (isAuthenticated) {
      const url = request.nextUrl.clone()
      url.pathname = getDefaultRedirectForRole(session.userType)
      const response = NextResponse.redirect(url)
      logResponse(ctx, 302, startTime)
      return addRequestIdHeader(response, ctx.requestId)
    }

    const response = NextResponse.next()
    logResponse(ctx, 200, startTime)
    return addSecurityHeaders(addRequestIdHeader(response, ctx.requestId))
  }

  // ─────────────────────────────────────────────────────────────
  // Handle Protected API Routes
  // ─────────────────────────────────────────────────────────────
  if (isProtectedApiRoute(pathname)) {
    if (!isAuthenticated) {
      logger.security(ctx, 'Unauthenticated API access', { route: pathname })
      recordError()
      const response = NextResponse.json(
        { success: false, error: 'Unauthorized - Please login', requestId: ctx.requestId },
        { status: 401 }
      )
      logResponse(ctx, 401, startTime)
      return addRequestIdHeader(response, ctx.requestId)
    }

    // Add user info to request headers for API routes
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', session.userId)
    requestHeaders.set('x-user-type', session.userType)
    requestHeaders.set('x-request-id', ctx.requestId)
    if (session.memberId) requestHeaders.set('x-member-id', session.memberId)
    if (session.lawyerId) requestHeaders.set('x-lawyer-id', session.lawyerId)
    if (session.partnerId) requestHeaders.set('x-partner-id', session.partnerId)
    if (session.legalArmId) requestHeaders.set('x-legal-arm-id', session.legalArmId)

    // Update context with user info for logging
    ctx.userId = session.userId
    ctx.userType = session.userType

    let response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })

    // Add CORS headers if needed
    if (routeNeedsCors(pathname)) {
      response = addCorsHeaders(response, request)
    }

    logResponse(ctx, 200, startTime)
    return addSecurityHeaders(addRequestIdHeader(response, ctx.requestId))
  }

  // ─────────────────────────────────────────────────────────────
  // Public Routes - Allow through
  // ─────────────────────────────────────────────────────────────
  let response = NextResponse.next()

  // Add CORS headers for public API routes
  if (routeNeedsCors(pathname)) {
    response = addCorsHeaders(response, request)
  }

  logResponse(ctx, 200, startTime)
  return addSecurityHeaders(addRequestIdHeader(response, ctx.requestId))
}

// ═══════════════════════════════════════════════════════════════════════════════
// Logging Helper
// ═══════════════════════════════════════════════════════════════════════════════

function logResponse(ctx: RequestContext, statusCode: number, startTime: number): void {
  if (!shouldLogRequest(ctx.path)) return

  const duration = Date.now() - startTime
  logger.response(ctx, statusCode)
  recordMetrics(duration, statusCode >= 400)
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
