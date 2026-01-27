// ═══════════════════════════════════════════════════════════════════════════════
// CORS (Cross-Origin Resource Sharing) Configuration
// Secure CORS setup for API routes
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface CorsConfig {
  // Allowed origins (domains that can access the API)
  allowedOrigins: string[]
  // Allowed HTTP methods
  allowedMethods: string[]
  // Allowed request headers
  allowedHeaders: string[]
  // Headers exposed to the browser
  exposedHeaders: string[]
  // Allow credentials (cookies, authorization headers)
  credentials: boolean
  // Preflight cache duration (seconds)
  maxAge: number
}

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get allowed origins based on environment
 */
function getAllowedOrigins(): string[] {
  const env = process.env.NODE_ENV

  // Development: allow localhost
  if (env !== 'production') {
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
    ]
  }

  // Production: use environment variable or default domains
  const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS
  if (configuredOrigins) {
    return configuredOrigins.split(',').map(o => o.trim())
  }

  // Default production origins (update with your actual domains)
  return [
    'https://exolex.sa',
    'https://www.exolex.sa',
    'https://app.exolex.sa',
    // Add staging domain if needed
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  ].filter(Boolean)
}

/**
 * Default CORS configuration
 */
export const defaultCorsConfig: CorsConfig = {
  allowedOrigins: getAllowedOrigins(),
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-Id',
    'X-CSRF-Token',
    'Accept',
    'Accept-Language',
  ],
  exposedHeaders: [
    'X-Request-Id',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
}

/**
 * Strict CORS config for sensitive API endpoints
 */
export const strictCorsConfig: CorsConfig = {
  ...defaultCorsConfig,
  allowedMethods: ['POST'], // Only POST
  credentials: true,
  maxAge: 3600, // 1 hour
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORS Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | null, config: CorsConfig = defaultCorsConfig): boolean {
  if (!origin) return false

  // Check exact match
  if (config.allowedOrigins.includes(origin)) {
    return true
  }

  // Check wildcard patterns (e.g., *.exolex.sa)
  for (const allowed of config.allowedOrigins) {
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2)
      if (origin.endsWith(domain) || origin.endsWith(`.${domain}`)) {
        return true
      }
    }
  }

  return false
}

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(
  request: NextRequest,
  config: CorsConfig = defaultCorsConfig
): Record<string, string> {
  const origin = request.headers.get('origin')
  const headers: Record<string, string> = {}

  // Only set CORS headers if origin is provided and allowed
  if (origin && isOriginAllowed(origin, config)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Methods'] = config.allowedMethods.join(', ')
    headers['Access-Control-Allow-Headers'] = config.allowedHeaders.join(', ')
    headers['Access-Control-Expose-Headers'] = config.exposedHeaders.join(', ')
    headers['Access-Control-Max-Age'] = config.maxAge.toString()

    if (config.credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true'
    }
  }

  // Always set Vary header for proper caching
  headers['Vary'] = 'Origin'

  return headers
}

/**
 * Add CORS headers to a response
 */
export function addCorsHeaders(
  response: NextResponse,
  request: NextRequest,
  config: CorsConfig = defaultCorsConfig
): NextResponse {
  const headers = getCorsHeaders(request, config)

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value)
  }

  return response
}

// ═══════════════════════════════════════════════════════════════════════════════
// Preflight Request Handler
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle preflight (OPTIONS) requests
 */
export function handlePreflight(
  request: NextRequest,
  config: CorsConfig = defaultCorsConfig
): NextResponse {
  const origin = request.headers.get('origin')

  // If origin is not allowed, return 403
  if (!isOriginAllowed(origin, config)) {
    return new NextResponse(null, {
      status: 403,
      statusText: 'CORS origin not allowed',
    })
  }

  // Return 204 with CORS headers
  const headers = getCorsHeaders(request, config)
  return new NextResponse(null, {
    status: 204,
    headers,
  })
}

/**
 * Check if request is a preflight request
 */
export function isPreflight(request: NextRequest): boolean {
  return (
    request.method === 'OPTIONS' &&
    request.headers.has('origin') &&
    request.headers.has('access-control-request-method')
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORS Middleware Wrapper
// ═══════════════════════════════════════════════════════════════════════════════

type ApiHandler = (request: NextRequest) => Promise<NextResponse>

/**
 * Wrap an API handler with CORS support
 *
 * @example
 * export const GET = withCors(async (request) => {
 *   return NextResponse.json({ data: 'hello' })
 * })
 *
 * // Handle OPTIONS for preflight
 * export const OPTIONS = withCors(async () => {
 *   return new NextResponse(null, { status: 204 })
 * })
 */
export function withCors(
  handler: ApiHandler,
  config: CorsConfig = defaultCorsConfig
): ApiHandler {
  return async (request: NextRequest) => {
    // Handle preflight
    if (isPreflight(request)) {
      return handlePreflight(request, config)
    }

    // Check origin for non-preflight requests
    const origin = request.headers.get('origin')
    if (origin && !isOriginAllowed(origin, config)) {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'CORS origin not allowed' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Call handler
    const response = await handler(request)

    // Add CORS headers
    return addCorsHeaders(response, request, config)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API Routes Configuration
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Routes that require CORS (external API access)
 */
export const CORS_ENABLED_ROUTES = [
  '/api/public',
  '/api/marketplace',
  '/api/referral',
]

/**
 * Check if a route needs CORS handling
 */
export function routeNeedsCors(pathname: string): boolean {
  return CORS_ENABLED_ROUTES.some(route => pathname.startsWith(route))
}

// ═══════════════════════════════════════════════════════════════════════════════
// Security Headers (Additional)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Additional security headers for API responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    // Enable XSS filter
    'X-XSS-Protection': '1; mode=block',
    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Permissions policy
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }
}

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  const headers = getSecurityHeaders()

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value)
  }

  return response
}
