// ═══════════════════════════════════════════════════════════════════════════════
// Rate Limiting Utility
// In-memory rate limiter for API protection
// For production, consider using Redis or Upstash
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitConfig {
  // Maximum number of requests
  limit: number
  // Time window in seconds
  window: number
  // Unique identifier for this limiter
  identifier: string
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

// ═══════════════════════════════════════════════════════════════════════════════
// In-Memory Store
// Note: This resets on server restart. Use Redis for production.
// ═══════════════════════════════════════════════════════════════════════════════

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  const entries = Array.from(rateLimitStore.entries())
  for (const [key, entry] of entries) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean every minute

// ═══════════════════════════════════════════════════════════════════════════════
// Core Rate Limiter
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check and update rate limit for a given key
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const windowMs = config.window * 1000
  const fullKey = `${config.identifier}:${key}`

  let entry = rateLimitStore.get(fullKey)

  // Create new entry or reset expired one
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    }
  }

  // Increment count
  entry.count++
  rateLimitStore.set(fullKey, entry)

  // Check if over limit
  const remaining = Math.max(0, config.limit - entry.count)
  const success = entry.count <= config.limit

  return {
    success,
    remaining,
    resetAt: entry.resetAt,
    retryAfter: success ? undefined : Math.ceil((entry.resetAt - now) / 1000),
  }
}

/**
 * Get client identifier from request (IP or user ID)
 */
export function getClientIdentifier(request: NextRequest, userId?: string): string {
  // Prefer user ID if authenticated
  if (userId) {
    return `user:${userId}`
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return `ip:${ip}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pre-configured Rate Limiters
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * OTP rate limiter - very strict
 * 3 requests per phone per hour
 */
export const otpRateLimiter = {
  config: {
    limit: 3,
    window: 3600, // 1 hour
    identifier: 'otp',
  },

  check(phone: string): RateLimitResult {
    return checkRateLimit(phone, this.config)
  },
}

/**
 * OTP verification rate limiter
 * 5 attempts per phone per 10 minutes
 */
export const otpVerifyRateLimiter = {
  config: {
    limit: 5,
    window: 600, // 10 minutes
    identifier: 'otp-verify',
  },

  check(phone: string): RateLimitResult {
    return checkRateLimit(phone, this.config)
  },
}

/**
 * Chat/AI rate limiter
 * 30 requests per user per minute
 */
export const chatRateLimiter = {
  config: {
    limit: 30,
    window: 60, // 1 minute
    identifier: 'chat',
  },

  check(identifier: string): RateLimitResult {
    return checkRateLimit(identifier, this.config)
  },
}

/**
 * General API rate limiter
 * 100 requests per user per minute
 */
export const apiRateLimiter = {
  config: {
    limit: 100,
    window: 60, // 1 minute
    identifier: 'api',
  },

  check(identifier: string): RateLimitResult {
    return checkRateLimit(identifier, this.config)
  },
}

/**
 * Strict rate limiter for sensitive operations
 * 10 requests per user per hour
 */
export const strictRateLimiter = {
  config: {
    limit: 10,
    window: 3600, // 1 hour
    identifier: 'strict',
  },

  check(identifier: string): RateLimitResult {
    return checkRateLimit(identifier, this.config)
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// Middleware Helper
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create rate limit response with proper headers
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const response = NextResponse.json(
    {
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: result.retryAfter,
    },
    { status: 429 }
  )

  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', result.resetAt.toString())
  if (result.retryAfter) {
    response.headers.set('Retry-After', result.retryAfter.toString())
  }

  return response
}

/**
 * Add rate limit headers to successful response
 */
export function addRateLimitHeaders(response: NextResponse, result: RateLimitResult): void {
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', result.resetAt.toString())
}

// ═══════════════════════════════════════════════════════════════════════════════
// Rate Limit Wrapper for API Routes
// ═══════════════════════════════════════════════════════════════════════════════

type ApiHandler = (request: NextRequest) => Promise<NextResponse>

/**
 * Wrap an API handler with rate limiting
 *
 * @example
 * export const POST = withRateLimit(
 *   async (request) => {
 *     // Your handler logic
 *     return NextResponse.json({ success: true })
 *   },
 *   { limit: 10, window: 60, identifier: 'my-endpoint' }
 * )
 */
export function withRateLimit(
  handler: ApiHandler,
  config: RateLimitConfig,
  getKey?: (request: NextRequest) => string
): ApiHandler {
  return async (request: NextRequest) => {
    // Get rate limit key
    const key = getKey
      ? getKey(request)
      : getClientIdentifier(request, request.headers.get('x-user-id') || undefined)

    // Check rate limit
    const result = checkRateLimit(key, config)

    if (!result.success) {
      return rateLimitResponse(result)
    }

    // Call handler
    const response = await handler(request)

    // Add rate limit headers to response
    addRateLimitHeaders(response, result)

    return response
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phone-based Rate Limiting (for OTP)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if phone is rate limited for OTP
 */
export function isPhoneRateLimited(phone: string): RateLimitResult {
  return otpRateLimiter.check(phone)
}

/**
 * Check if phone is rate limited for OTP verification
 */
export function isVerifyRateLimited(phone: string): RateLimitResult {
  return otpVerifyRateLimiter.check(phone)
}

/**
 * Block a phone temporarily (e.g., after too many failed attempts)
 */
export function blockPhone(phone: string, durationSeconds: number): void {
  const key = `blocked:${phone}`
  rateLimitStore.set(key, {
    count: 999999,
    resetAt: Date.now() + (durationSeconds * 1000),
  })
}

/**
 * Check if a phone is blocked
 */
export function isPhoneBlocked(phone: string): boolean {
  const key = `blocked:${phone}`
  const entry = rateLimitStore.get(key)
  if (!entry) return false
  if (entry.resetAt < Date.now()) {
    rateLimitStore.delete(key)
    return false
  }
  return true
}
