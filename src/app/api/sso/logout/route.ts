import { NextRequest, NextResponse } from 'next/server'
import { allowedPostLogoutRedirect } from '@/lib/sso/authorizationCode'

// 解 JWT 只讀 collection 欄位（不驗簽；清自己瀏覽器的 cookie 無安全含意）
function jwtCollection(token: string): string | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    const parsed = JSON.parse(json) as { collection?: unknown }
    return typeof parsed.collection === 'string' ? parsed.collection : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get('post_logout_redirect_uri')
  const redirectUri =
    requested && allowedPostLogoutRedirect(requested)
      ? requested
      : 'https://www.kimlafayette.com/'
  const response = NextResponse.redirect(redirectUri, 302)
  const secure = process.env.NODE_ENV === 'production'

  // 2026-09-08 cookie 分家：會員憑證在 ckmu-member-token（一律清）；
  // payload-token 只在它是 customers 的 legacy 會員 session 時才清 —
  // 無條件清會把同瀏覽器後台管理員（users）踢下線
  const legacyToken = request.cookies.get('payload-token')?.value
  const cookieNames = new Set([
    ...(legacyToken && jwtCollection(legacyToken) === 'customers' ? ['payload-token'] : []),
    'ckmu-member-token',
    ...request.cookies
      .getAll()
      .map((cookie) => cookie.name)
      .filter(
        (name) =>
          name.startsWith('authjs.') ||
          name.startsWith('__Secure-authjs.') ||
          name.startsWith('__Host-authjs.') ||
          name.startsWith('next-auth.'),
      ),
  ])
  for (const name of cookieNames) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  }
  response.headers.set('Cache-Control', 'no-store')
  return response
}
