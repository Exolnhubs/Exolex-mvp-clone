// ═══════════════════════════════════════════════════════════════════════════════
// Error Tracking & Monitoring
// Sentry integration for production error tracking
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { logger, type RequestContext } from './logger'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ErrorContext {
  requestId?: string
  userId?: string
  userType?: string
  path?: string
  method?: string
  ip?: string
  tags?: Record<string, string>
  extra?: Record<string, unknown>
}

export interface SentryConfig {
  dsn: string
  environment: string
  release?: string
  tracesSampleRate?: number
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sentry Integration (Optional)
// Set SENTRY_DSN environment variable to enable
// ═══════════════════════════════════════════════════════════════════════════════

let sentryInitialized = false
let Sentry: typeof import('@sentry/nextjs') | null = null

/**
 * Initialize Sentry (called once at app startup)
 * Only initializes if SENTRY_DSN is set
 */
export async function initSentry(): Promise<void> {
  if (sentryInitialized) return

  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

  if (!dsn) {
    logger.info('Sentry DSN not configured - error tracking disabled')
    sentryInitialized = true
    return
  }

  try {
    // Dynamic import to avoid errors if @sentry/nextjs is not installed
    Sentry = await import('@sentry/nextjs')

    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_APP_VERSION,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // Don't send errors in development unless explicitly enabled
      enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLED === 'true',
      // Filter out common non-actionable errors
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        'Network request failed',
        'Load failed',
        'cancelled',
      ],
      // Sanitize sensitive data
      beforeSend(event) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers['authorization']
          delete event.request.headers['cookie']
          delete event.request.headers['x-api-key']
        }
        return event
      },
    })

    sentryInitialized = true
    logger.info('Sentry initialized successfully')
  } catch {
    logger.warn('Failed to initialize Sentry - @sentry/nextjs may not be installed')
    sentryInitialized = true
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Error Capture Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Capture an error and send to Sentry
 */
export function captureError(error: Error, context?: ErrorContext): string | null {
  // Always log the error
  console.error('[ERROR]', error.message, context)

  if (!Sentry) {
    return null
  }

  try {
    // Set user context if available
    if (context?.userId) {
      Sentry.setUser({
        id: context.userId,
        // Don't include PII - just the user type
        segment: context.userType,
      })
    }

    // Add tags
    if (context?.tags) {
      for (const [key, value] of Object.entries(context.tags)) {
        Sentry.setTag(key, value)
      }
    }

    // Add extra context
    if (context?.requestId) {
      Sentry.setTag('request_id', context.requestId)
    }
    if (context?.path) {
      Sentry.setTag('path', context.path)
    }
    if (context?.method) {
      Sentry.setTag('method', context.method)
    }

    // Capture the error
    const eventId = Sentry.captureException(error, {
      extra: context?.extra,
    })

    return eventId
  } catch (sentryError) {
    console.error('Failed to send error to Sentry:', sentryError)
    return null
  }
}

/**
 * Capture a message (non-error event)
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): string | null {
  if (!Sentry) {
    logger.info(message, context?.extra as Record<string, unknown>)
    return null
  }

  try {
    const eventId = Sentry.captureMessage(message, {
      level,
      extra: context?.extra,
      tags: {
        request_id: context?.requestId,
        path: context?.path,
        ...context?.tags,
      },
    })

    return eventId
  } catch {
    return null
  }
}

/**
 * Create error context from request context
 */
export function errorContextFromRequest(ctx: RequestContext): ErrorContext {
  return {
    requestId: ctx.requestId,
    userId: ctx.userId,
    userType: ctx.userType,
    path: ctx.path,
    method: ctx.method,
    ip: ctx.ip,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Error Boundary Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Error response with tracking ID
 */
export function createErrorResponse(
  error: Error,
  statusCode: number = 500,
  context?: ErrorContext
): NextResponse {
  const eventId = captureError(error, context)

  // Create user-friendly error response
  const response = {
    success: false,
    error: statusCode >= 500
      ? 'An unexpected error occurred. Please try again later.'
      : error.message,
    // Include tracking ID so users can report issues
    ...(eventId && { trackingId: eventId }),
    ...(context?.requestId && { requestId: context.requestId }),
  }

  return NextResponse.json(response, { status: statusCode })
}

// ═══════════════════════════════════════════════════════════════════════════════
// API Route Wrapper with Error Tracking
// ═══════════════════════════════════════════════════════════════════════════════

type ApiHandler = (request: NextRequest) => Promise<NextResponse>

/**
 * Wrap an API handler with error tracking
 *
 * @example
 * export const POST = withErrorTracking(async (request) => {
 *   // Your handler - errors are automatically captured
 *   return NextResponse.json({ success: true })
 * })
 */
export function withErrorTracking(handler: ApiHandler): ApiHandler {
  return async (request: NextRequest) => {
    const requestId = request.headers.get('x-request-id') || 'unknown'
    const context: ErrorContext = {
      requestId,
      userId: request.headers.get('x-user-id') || undefined,
      userType: request.headers.get('x-user-type') || undefined,
      path: request.nextUrl.pathname,
      method: request.method,
    }

    try {
      return await handler(request)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      // Determine status code based on error type
      let statusCode = 500
      if (err.name === 'ValidationError') statusCode = 400
      if (err.name === 'UnauthorizedError') statusCode = 401
      if (err.name === 'ForbiddenError') statusCode = 403
      if (err.name === 'NotFoundError') statusCode = 404

      return createErrorResponse(err, statusCode, context)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Custom Error Classes
// ═══════════════════════════════════════════════════════════════════════════════

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED')
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN')
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class RateLimitError extends AppError {
  constructor(
    message = 'Too many requests',
    public retryAfter?: number
  ) {
    super(message, 429, 'RATE_LIMITED')
    this.name = 'RateLimitError'
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Monitoring & Alerting
// ═══════════════════════════════════════════════════════════════════════════════

interface AlertThresholds {
  errorRate: number       // Errors per minute
  responseTime: number    // Average response time in ms
  errorCount: number      // Total errors before alert
}

const defaultThresholds: AlertThresholds = {
  errorRate: 10,
  responseTime: 2000,
  errorCount: 50,
}

// Track errors for alerting
const errorWindow: number[] = []
const WINDOW_SIZE_MS = 60000 // 1 minute

/**
 * Record an error for rate monitoring
 */
export function recordError(): void {
  const now = Date.now()
  errorWindow.push(now)

  // Clean old entries
  while (errorWindow.length > 0 && errorWindow[0] < now - WINDOW_SIZE_MS) {
    errorWindow.shift()
  }

  // Check if we should alert
  if (errorWindow.length >= defaultThresholds.errorRate) {
    triggerAlert('High error rate detected', {
      errorsPerMinute: errorWindow.length,
      threshold: defaultThresholds.errorRate,
    })
  }
}

/**
 * Trigger an alert (sends to Sentry as a high-priority message)
 */
function triggerAlert(message: string, data: Record<string, unknown>): void {
  logger.warn(`ALERT: ${message}`, data)

  if (Sentry) {
    Sentry.captureMessage(`ALERT: ${message}`, {
      level: 'error',
      extra: data,
      tags: { alert: 'true' },
    })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════════════════════

export function getErrorTrackerHealth(): {
  initialized: boolean
  sentryEnabled: boolean
  errorsLastMinute: number
} {
  return {
    initialized: sentryInitialized,
    sentryEnabled: !!Sentry,
    errorsLastMinute: errorWindow.filter(t => t > Date.now() - WINDOW_SIZE_MS).length,
  }
}
