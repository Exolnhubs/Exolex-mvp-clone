/** @type {import('next').NextConfig} */
const nextConfig = {
  // ═══════════════════════════════════════════════════════════════════════════
  // Build Configuration
  // ═══════════════════════════════════════════════════════════════════════════

  // TODO: Enable these before production deployment
  // Currently disabled to allow incremental fixing of issues
  eslint: {
    // Set to false to enable ESLint during builds
    ignoreDuringBuilds: process.env.SKIP_LINT === 'true',
  },
  typescript: {
    // Set to false to enable TypeScript checks during builds
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === 'true',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Security Headers
  // ═══════════════════════════════════════════════════════════════════════════

  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
        ],
      },
      {
        // Stricter CSP for API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; frame-ancestors 'none'"
          },
        ],
      },
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Image Configuration
  // ═══════════════════════════════════════════════════════════════════════════

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Environment Variables (client-side exposure)
  // ═══════════════════════════════════════════════════════════════════════════

  env: {
    // Only expose non-sensitive variables
    NEXT_PUBLIC_APP_NAME: 'ExoLex',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Production Optimizations
  // ═══════════════════════════════════════════════════════════════════════════

  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Compress responses
  compress: true,

  // Generate ETags for caching
  generateEtags: true,

  // Power header (disable for security)
  poweredByHeader: false,
};

export default nextConfig;
