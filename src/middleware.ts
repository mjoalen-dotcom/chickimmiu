import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { check } from './lib/rateLimit'

/**
 * /api/users/* rate-limit
 * ----------------------
 * - /api/users/login → 5 次 / 60 秒 / IP
 * - /api/users/forgot-password → 3 次 / 60 秒 / IP
 * 其他 /api/users/* pass-through（Payload 內建 auth 路徑仍走原邏輯）
 *
 * IP 來源：x-forwarded-for 第一段（Cloudflare Tunnel / nginx 皆帶此 header）。
 * 429 回傳 retry-after header 給前端顯示倒數（前端目前未讀；保留擴充空間）。
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const ip = (req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim()

  if (path === '/api/users/login') {
    const r = check(`login:${ip}`, 5, 60_000)
    if (!r.ok) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': String(r.retryAfter) },
      })
    }
  }

  if (path === '/api/users/forgot-password') {
    const r = check(`forgot:${ip}`, 3, 60_000)
    if (!r.ok) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': String(r.retryAfter) },
      })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/users/:path*'],
}
