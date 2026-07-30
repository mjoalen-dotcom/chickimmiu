import { NextRequest, NextResponse } from 'next/server'
import { allowedPostLogoutRedirect } from '@/lib/sso/authorizationCode'

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get('post_logout_redirect_uri')
  const redirectUri =
    requested && allowedPostLogoutRedirect(requested)
      ? requested
      : 'https://www.kimlafayette.com/'
  const response = NextResponse.redirect(redirectUri, 302)
  const secure = process.env.NODE_ENV === 'production'

  const cookieNames = new Set([
    'payload-token',
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
