import { NextResponse } from 'next/server'
import { FACEBOOK_LINK_COOKIE } from '@/lib/auth/facebookLinkIntent'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const base = process.env.NEXT_PUBLIC_SITE_URL || url.origin
  const result = url.searchParams.get('result') === 'linked' ? 'linked' : 'failed'
  const response = NextResponse.redirect(new URL(`/account/settings?facebook=${result}`, base))
  response.headers.set('Cache-Control', 'no-store')
  response.cookies.set(FACEBOOK_LINK_COOKIE, '', { path: '/api/auth', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
  return response
}
