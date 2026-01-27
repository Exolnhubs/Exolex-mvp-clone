// ═══════════════════════════════════════════════════════════════════════════════
// Rate Limiting Utility
// Supports both in-memory (development) and Upstash Redis (production)
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
  limit: number
  window: number // seconds
  identifier: string
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const USE_REDIS = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

// ═══════════════════════════════════════════════════════════════════════════════
// In-Memory Store (Development/Fallback)
// ═══════════════════════════════════════════════════════════════════════════════

const memoryStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically (only in non-edge environments)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    const entries = Array.from(memoryStore.entries())
    for (const [key, entry] of entries) {
      if (entry.resetAt < now) {
        memoryStore.delete(key)
      }
    }
  }, 60000)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Upstash Redis Client (Production)
// ═══════════════════════════════════════════════════════════════════════════════

interface RedisResponse {
  result: number | null
}

async function redisCommand(command: string[]): Promise<number | null> {
  if (!USE_REDIS) return null

  try {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      console.error('Redis error:', response.statusText)
      return null
    }

    const data: RedisResponse = await response.json()
    return data.result
  } catch (error) {
    console.error('Redis connection error:', error)
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Core Rate Limiter
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check and update rate limit for a given key
 * Uses Redis in production, memory in development
 */
export async function checkRateLimitAsync(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const now = Date.now()
  const windowMs = config.window * 1000
  const fullKey = `ratelimit:${config.identifier}:${key}`

  // Try Redis first in production
  if (USE_REDIS) {
    try {
      // Use Redis INCR with EXPIRE for atomic rate limiting
      const count = await redisCommand(['INCR', fullKey])

      if (count === 1) {
        // First request in window, set expiry
        await redisCommand(['EXPIRE', fullKey, config.window.toString()])
      }

      const ttl = await redisCommand(['TTL', fullKey])
      const resetAt = now + ((ttl || config.window) * 1000)
      const remaining = Math.max(0, config.limit - (count || 0))
      const success = (count || 0) <= config.limit

      return {
        success,
        remaining,
        resetAt,
        retryAfter: success ? undefined : Math.ceil((ttl || config.window)),
      }
    } catch (error) {
      // Fall through to memory store on Redis error
      console.error('Redis rate limit error, falling back to memory:', error)
    }
  }

  // Fallback to in-memory store
  let entry = memoryStore.get(fullKey)

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs }
  }

  entry.count++
  memoryStore.set(fullKey, entry)

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
 * Synchronous rate limit check (uses memory store only)
 * For backward compatibility with existing code
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const windowMs = config.window * 1000
  const fullKey = `ratelimit:${config.identifier}:${key}`

  let entry = memoryStore.get(fullKey)

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs }
  }

  entry.count++
  memoryStore.set(fullKey, entry)

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
 * Get client identifier from request
 */
export function getClientIdentifier(request: NextRequest, userId?: string): string {
  if (userId) {
    return `user:${userId}`
  }

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return `ip:${ip}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pre-configured Rate Limiters
// ═══════════════════════════════════════════════════════════════════════════════

export const otpRateLimiter = {
  config: { limit: 3, window: 3600, identifier: 'otp' },
  check(phone: string): RateLimitResult {
    return checkRateLimit(phone, this.config)
  },
  async checkAsync(phone: string): Promise<RateLimitResult> {
    return checkRateLimitAsync(phone, this.config)
  },
}

export const otpVerifyRateLimiter = {
  config: { limit: 5, window: 600, identifier: 'otp-verify' },
  check(phone: string): RateLimitResult {
    return checkRateLimit(phone, this.config)
  },
  async checkAsync(phone: string): Promise<RateLimitResult> {
    return checkRateLimitAsync(phone, this.config)
  },
}

export const chatRateLimiter = {
  config: { limit: 30, window: 60, identifier: 'chat' },
  check(identifier: string): RateLimitResult {
    return checkRateLimit(identifier, this.config)
  },
  async checkAsync(identifier: string): Promise<RateLimitResult> {
    return checkRateLimitAsync(identifier, this.config)
  },
}

export const apiRateLimiter = {
  config: { limit: 100, window: 60, identifier: 'api' },
  check(identifier: string): RateLimitResult {
    return checkRateLimit(identifier, this.config)
  },
  async checkAsync(identifier: string): Promise<RateLimitResult> {
    return checkRateLimitAsync(identifier, this.config)
  },
}

export const strictRateLimiter = {
  config: { limit: 10, window: 3600, identifier: 'strict' },
  check(identifier: string): RateLimitResult {
    return checkRateLimit(identifier, this.config)
  },
  async checkAsync(identifier: string): Promise<RateLimitResult> {
    return checkRateLimitAsync(identifier, this.config)
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// Response Helpers
// ═══════════════════════════════════════════════════════════════════════════════

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const response = NextResponse.json(
    {
      success: false,
      error: 'طلبات كثيرة. حاول مرة أخرى لاحقاً.',
      error_en: 'Too many requests. Please try again later.',
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

export function addRateLimitHeaders(response: NextResponse, result: RateLimitResult): void {
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', result.resetAt.toString())
}

// ═══════════════════════════════════════════════════════════════════════════════
// API Route Wrapper
// ═══════════════════════════════════════════════════════════════════════════════

type ApiHandler = (request: NextRequest) => Promise<NextResponse>

export function withRateLimit(
  handler: ApiHandler,
  config: RateLimitConfig,
  getKey?: (request: NextRequest) => string
): ApiHandler {
  return async (request: NextRequest) => {
    const key = getKey
      ? getKey(request)
      : getClientIdentifier(request, request.headers.get('x-user-id') || undefined)

    const result = await checkRateLimitAsync(key, config)

    if (!result.success) {
      return rateLimitResponse(result)
    }

    const response = await handler(request)
    addRateLimitHeaders(response, result)
    return response
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phone Blocking (for OTP abuse prevention)
// ═══════════════════════════════════════════════════════════════════════════════

export async function blockPhoneAsync(phone: string, durationSeconds: number): Promise<void> {
  const key = `blocked:${phone}`

  if (USE_REDIS) {
    try {
      await redisCommand(['SET', key, '1', 'EX', durationSeconds.toString()])
      return
    } catch (error) {
      console.error('Redis block error:', error)
    }
  }

  // Fallback to memory
  memoryStore.set(key, {
    count: 999999,
    resetAt: Date.now() + (durationSeconds * 1000),
  })
}

export function blockPhone(phone: string, durationSeconds: number): void {
  const key = `blocked:${phone}`
  memoryStore.set(key, {
    count: 999999,
    resetAt: Date.now() + (durationSeconds * 1000),
  })

  // Also try to set in Redis (fire and forget)
  if (USE_REDIS) {
    redisCommand(['SET', key, '1', 'EX', durationSeconds.toString()]).catch(() => {})
  }
}

export async function isPhoneBlockedAsync(phone: string): Promise<boolean> {
  const key = `blocked:${phone}`

  if (USE_REDIS) {
    try {
      const exists = await redisCommand(['EXISTS', key])
      if (exists === 1) return true
    } catch (error) {
      console.error('Redis check error:', error)
    }
  }

  // Check memory store
  const entry = memoryStore.get(key)
  if (!entry) return false
  if (entry.resetAt < Date.now()) {
    memoryStore.delete(key)
    return false
  }
  return true
}

export function isPhoneBlocked(phone: string): boolean {
  const key = `blocked:${phone}`
  const entry = memoryStore.get(key)
  if (!entry) return false
  if (entry.resetAt < Date.now()) {
    memoryStore.delete(key)
    return false
  }
  return true
}

// Legacy exports for backward compatibility
export function isPhoneRateLimited(phone: string): RateLimitResult {
  return otpRateLimiter.check(phone)
}

export function isVerifyRateLimited(phone: string): RateLimitResult {
  return otpVerifyRateLimiter.check(phone)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════════════════════

export function getRateLimitHealth(): {
  mode: 'redis' | 'memory'
  memoryEntries: number
  redisConfigured: boolean
} {
  return {
    mode: USE_REDIS ? 'redis' : 'memory',
    memoryEntries: memoryStore.size,
    redisConfigured: USE_REDIS,
  }
}
