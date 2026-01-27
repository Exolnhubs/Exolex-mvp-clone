// ═══════════════════════════════════════════════════════════════════════════════
// Health Check API
// Returns system health status and metrics
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { getMetrics } from '@/lib/logger'
import { getErrorTrackerHealth } from '@/lib/error-tracker'

export const dynamic = 'force-dynamic'

export async function GET() {
  const metrics = getMetrics()
  const errorHealth = getErrorTrackerHealth()

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    metrics: {
      requests: metrics.requestCount,
      averageResponseTime: `${metrics.averageResponseTime}ms`,
      errorRate: `${(metrics.errorRate * 100).toFixed(2)}%`,
      slowRequests: metrics.slowRequests,
    },
    services: {
      errorTracking: {
        initialized: errorHealth.initialized,
        sentryEnabled: errorHealth.sentryEnabled,
        errorsLastMinute: errorHealth.errorsLastMinute,
      },
    },
  }

  // Determine overall health status
  if (metrics.errorRate > 0.1) {
    health.status = 'degraded'
  }
  if (errorHealth.errorsLastMinute > 50) {
    health.status = 'unhealthy'
  }

  return NextResponse.json(health, {
    status: health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
