import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['libsql', '@libsql/client'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    reactCompiler: false,
  },
  async headers() {
    // Content-Security-Policy — 封測期 baseline
    //   - 'unsafe-inline' 是 Next 15 hydration boot script + Payload admin 必須
    //   - 'unsafe-eval' 是 Next dev webpack module loading 需要（prod 其實可拿掉，
    //     但 Payload admin UI 某些動態載入也用到，為了 admin 穩定先保留）
    //   - 若 prod 監控 CSP violation 要用 report-only 模式，把 key 換成
    //     'Content-Security-Policy-Report-Only' 即可
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: blob: https://shoplineimg.com https://*.r2.cloudflarestorage.com https://pre.chickimmiu.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://www.google-analytics.com https://*.ecpay.com.tw https://sandbox-api-pay.line.me https://api-pay.line.me https://ccore.newebpay.com",
      "font-src 'self' data:",
      "frame-src https://*.ecpay.com.tw",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://payment.ecpay.com.tw https://payment-stage.ecpay.com.tw",
      "upgrade-insecure-requests",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
          // HSTS — 僅 prod 發送，避免本機 dev 把 localhost 鎖進瀏覽器 HSTS cache
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
            : []),
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
      {
        // HTML pages — always fetch fresh so iPad/Safari never serves
        // stale HTML referencing dead webpack chunk hashes (white-screen bug).
        // Excludes /_next/static (immutable bundles) and /api/* (handled below).
        source: '/((?!_next/static|api|media|images|.*\\.).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      {
        // Static assets — long cache
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default withPayload(nextConfig)
