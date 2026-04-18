import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware
 * ----------
 * /admin BasicAuth gate — 僅在 ADMIN_BASIC_USER + ADMIN_BASIC_PW 都設時啟用。
 *
 * 用途：prod 封測期在 Payload auth 前再加一層 BasicAuth，
 *   即使 Payload admin 帳密外洩也擋得住未授權探測。
 *
 * 關閉條件：任一 env 未設 → no-op（本機 dev 預設 off）。
 * 替代方案：Cloudflare Access — 見 docs/admin-cloudflare-access.md。
 *
 * 使用者與密碼比較使用 timing-safe 等長比對，
 * 降低旁通攻擊（timing side-channel）風險。
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_BASIC_USER
  const pw = process.env.ADMIN_BASIC_PW
  if (!user || !pw) {
    return NextResponse.next()
  }

  const auth = req.headers.get('authorization') || ''
  const expected = 'Basic ' + btoa(`${user}:${pw}`)
  if (!timingSafeEqual(auth, expected)) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Admin"',
        'Cache-Control': 'no-store',
      },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
