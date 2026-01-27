// ═══════════════════════════════════════════════════════════════════════════════
// Request Logger & Monitoring Utility
// Structured logging for API requests, errors, and performance tracking
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  requestId: string
  method: string
  path: string
  statusCode?: number
  duration?: number
  userId?: string
  userType?: string
  ip?: string
  userAgent?: string
  message?: string
  error?: {
    name: string
    message: string
    stack?: string
  }
  metadata?: Record<string, unknown>
}

export interface RequestContext {
  requestId: string
  startTime: number
  method: string
  path: string
  userId?: string
  userType?: string
  ip?: string
  userAgent?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const LOG_CONFIG = {
  // Minimum log level to output
  minLevel: (process.env.LOG_LEVEL || 'info') as LogLevel,
  // Whether to log in JSON format (for production log aggregation)
  jsonFormat: process.env.NODE_ENV === 'production',
  // Paths to exclude from logging (health checks, static assets)
  excludePaths: [
    '/_next',
    '/favicon.ico',
    '/api/health',
  ],
  // Log sensitive data (only in development)
  logSensitive: process.env.NODE_ENV !== 'production',
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// ═══════════════════════════════════════════════════════════════════════════════
// Request ID Generator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a unique request ID
 * Format: timestamp-random (e.g., 1706123456789-abc123)
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${timestamp}-${random}`
}

/**
 * Get or create request ID from headers
 */
export function getRequestId(request: NextRequest): string {
  // Check if request already has an ID (from upstream proxy like nginx)
  const existingId = request.headers.get('x-request-id') ||
                     request.headers.get('x-correlation-id')
  return existingId || generateRequestId()
}

// ═══════════════════════════════════════════════════════════════════════════════
// Core Logger
// ═══════════════════════════════════════════════════════════════════════════════

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[LOG_CONFIG.minLevel]
}

function formatLogEntry(entry: LogEntry): string {
  if (LOG_CONFIG.jsonFormat) {
    // JSON format for production (easy to parse by log aggregators)
    return JSON.stringify(entry)
  }

  // Human-readable format for development
  const { timestamp, level, requestId, method, path, statusCode, duration, message, error } = entry
  const status = statusCode ? ` ${statusCode}` : ''
  const time = duration ? ` ${duration}ms` : ''
  const msg = message ? ` - ${message}` : ''
  const err = error ? ` [${error.name}: ${error.message}]` : ''

  return `[${timestamp}] ${level.toUpperCase().padEnd(5)} [${requestId}] ${method} ${path}${status}${time}${msg}${err}`
}

function log(entry: LogEntry): void {
  if (!shouldLog(entry.level)) return

  const formatted = formatLogEntry(entry)

  switch (entry.level) {
    case 'debug':
      console.debug(formatted)
      break
    case 'info':
      console.info(formatted)
      break
    case 'warn':
      console.warn(formatted)
      break
    case 'error':
      console.error(formatted)
      break
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Request Context
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create request context from NextRequest
 */
export function createRequestContext(request: NextRequest): RequestContext {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

  return {
    requestId: getRequestId(request),
    startTime: Date.now(),
    method: request.method,
    path: request.nextUrl.pathname,
    userId: request.headers.get('x-user-id') || undefined,
    userType: request.headers.get('x-user-type') || undefined,
    ip,
    userAgent: request.headers.get('user-agent') || undefined,
  }
}

/**
 * Check if path should be excluded from logging
 */
export function shouldLogRequest(path: string): boolean {
  return !LOG_CONFIG.excludePaths.some(excluded => path.startsWith(excluded))
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public Logger API
// ═══════════════════════════════════════════════════════════════════════════════

export const logger = {
  /**
   * Log incoming request
   */
  request(ctx: RequestContext): void {
    if (!shouldLogRequest(ctx.path)) return

    log({
      timestamp: new Date().toISOString(),
      level: 'info',
      requestId: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      userId: ctx.userId,
      userType: ctx.userType,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      message: 'Request started',
    })
  },

  /**
   * Log response with timing
   */
  response(ctx: RequestContext, statusCode: number, metadata?: Record<string, unknown>): void {
    if (!shouldLogRequest(ctx.path)) return

    const duration = Date.now() - ctx.startTime
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'

    log({
      timestamp: new Date().toISOString(),
      level,
      requestId: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      statusCode,
      duration,
      userId: ctx.userId,
      userType: ctx.userType,
      ip: ctx.ip,
      message: 'Request completed',
      metadata,
    })
  },

  /**
   * Log error
   */
  error(ctx: RequestContext, error: Error, metadata?: Record<string, unknown>): void {
    log({
      timestamp: new Date().toISOString(),
      level: 'error',
      requestId: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      userId: ctx.userId,
      userType: ctx.userType,
      ip: ctx.ip,
      message: 'Request error',
      error: {
        name: error.name,
        message: error.message,
        stack: LOG_CONFIG.logSensitive ? error.stack : undefined,
      },
      metadata,
    })
  },

  /**
   * Log security event (auth failures, rate limits, etc.)
   */
  security(ctx: RequestContext, event: string, metadata?: Record<string, unknown>): void {
    log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      requestId: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      userId: ctx.userId,
      userType: ctx.userType,
      ip: ctx.ip,
      message: `Security: ${event}`,
      metadata,
    })
  },

  /**
   * Log debug info (only in development)
   */
  debug(requestId: string, message: string, metadata?: Record<string, unknown>): void {
    log({
      timestamp: new Date().toISOString(),
      level: 'debug',
      requestId,
      method: '',
      path: '',
      message,
      metadata,
    })
  },

  /**
   * Log general info
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    log({
      timestamp: new Date().toISOString(),
      level: 'info',
      requestId: 'system',
      method: '',
      path: '',
      message,
      metadata,
    })
  },

  /**
   * Log warning
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      requestId: 'system',
      method: '',
      path: '',
      message,
      metadata,
    })
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// Middleware Helper
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add request ID to response headers
 */
export function addRequestIdHeader(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('x-request-id', requestId)
  return response
}

// ═══════════════════════════════════════════════════════════════════════════════
// API Route Wrapper with Logging
// ═══════════════════════════════════════════════════════════════════════════════

type ApiHandler = (request: NextRequest) => Promise<NextResponse>

/**
 * Wrap an API handler with automatic logging
 *
 * @example
 * export const POST = withLogging(async (request) => {
 *   return NextResponse.json({ success: true })
 * })
 */
export function withLogging(handler: ApiHandler): ApiHandler {
  return async (request: NextRequest) => {
    const ctx = createRequestContext(request)

    // Log request start
    logger.request(ctx)

    try {
      // Call handler
      const response = await handler(request)

      // Log response
      logger.response(ctx, response.status)

      // Add request ID to response
      return addRequestIdHeader(response, ctx.requestId)
    } catch (error) {
      // Log error
      logger.error(ctx, error instanceof Error ? error : new Error(String(error)))

      // Re-throw to let error boundary handle it
      throw error
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Performance Monitoring
// ═══════════════════════════════════════════════════════════════════════════════

export interface PerformanceMetrics {
  requestCount: number
  averageResponseTime: number
  errorRate: number
  slowRequests: number // > 1 second
}

// In-memory metrics (for development/monitoring)
const metrics = {
  requests: 0,
  totalResponseTime: 0,
  errors: 0,
  slowRequests: 0,
}

/**
 * Record request metrics
 */
export function recordMetrics(duration: number, isError: boolean): void {
  metrics.requests++
  metrics.totalResponseTime += duration
  if (isError) metrics.errors++
  if (duration > 1000) metrics.slowRequests++
}

/**
 * Get current metrics
 */
export function getMetrics(): PerformanceMetrics {
  return {
    requestCount: metrics.requests,
    averageResponseTime: metrics.requests > 0
      ? Math.round(metrics.totalResponseTime / metrics.requests)
      : 0,
    errorRate: metrics.requests > 0
      ? Math.round((metrics.errors / metrics.requests) * 100) / 100
      : 0,
    slowRequests: metrics.slowRequests,
  }
}

/**
 * Reset metrics (call periodically or on deployment)
 */
export function resetMetrics(): void {
  metrics.requests = 0
  metrics.totalResponseTime = 0
  metrics.errors = 0
  metrics.slowRequests = 0
}
