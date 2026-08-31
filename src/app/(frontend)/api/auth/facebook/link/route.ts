import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveSocialAuth } from '@/lib/auth/socialCredentials'
import { createFacebookLinkIntent, FACEBOOK_LINK_COOKIE, FACEBOOK_LINK_TTL, isSameOriginRequest, readCookie } from '@/lib/auth/facebookLinkIntent'

export async function POST(request: Request) {
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
  if (!isSameOriginRequest(request)) return fail('不允許此來源的連結請求', 403)
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user || user.collection !== 'customers' || user.isGuest || user._verified !== true) {
    return fail('請先登入並驗證原本的會員帳號', 401)
  }
  const { creds, enabled } = await resolveSocialAuth()
  if (!enabled.facebook || !creds.facebook) return fail('Facebook 登入尚未開放', 503)
  if (user.socialLogins?.facebookId) return fail('此會員已有 Facebook 連結；如需更換請聯繫客服', 409)
  const sessionToken = readCookie(request.headers, `${payload.config.cookiePrefix || 'payload'}-token`)
  if (!sessionToken) return fail('請使用此瀏覽器登入會員後再試', 401)
  const intent = createFacebookLinkIntent({
    customerId: String(user.id), appId: creds.facebook.clientId, sessionToken,
  }, payload.secret)
  const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(FACEBOOK_LINK_COOKIE, intent, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/api/auth', maxAge: FACEBOOK_LINK_TTL,
  })
  return response
}
