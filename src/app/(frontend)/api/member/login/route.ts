import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * 會員登入（cookie 分家版，2026-09-08）
 * ─────────────────────────────────────
 * 包一層 payload.login({ collection: 'customers' })，但憑證寫入專屬
 * `ckmu-member-token` cookie，而不是 Payload 內建 `/api/customers/login`
 * 會下的共用 `payload-token` — 後者與後台 users 撞名互踢，是「登入兩次」
 * 的根因。middleware 會把 ckmu-member-token 注入成 payload-token 轉發，
 * 站內既有 payload.auth 呼叫點零改動。
 *
 * 回應形狀對齊 Payload 內建端點（{ user, token, exp } / { errors: [...] }），
 * LoginClient 與任何既有呼叫端不需要調整錯誤處理。
 */
export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown }
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown }
  } catch {
    return NextResponse.json({ errors: [{ message: '請提供 email 與密碼' }] }, { status: 400 })
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password) {
    return NextResponse.json({ errors: [{ message: '請提供 email 與密碼' }] }, { status: 400 })
  }

  const payload = await getPayload({ config })
  try {
    const result = await payload.login({
      collection: 'customers',
      data: { email, password },
    })

    const authConfig = payload.collections.customers.config.auth
    const rawSameSite = authConfig.cookies?.sameSite
    const normalized = typeof rawSameSite === 'string' ? rawSameSite.toLowerCase() : rawSameSite
    const sameSite: 'strict' | 'lax' | 'none' =
      normalized === 'none' ? 'none' : normalized === 'strict' ? 'strict' : 'lax'
    const secure = Boolean(authConfig.cookies?.secure) || sameSite === 'none'

    const response = NextResponse.json({
      message: 'Auth Passed',
      user: result.user,
      token: result.token,
      exp: result.exp,
    })
    response.cookies.set({
      name: 'ckmu-member-token',
      value: result.token || '',
      httpOnly: true,
      path: '/',
      secure,
      sameSite,
      maxAge: authConfig.tokenExpiration,
    })
    return response
  } catch (err) {
    // Payload 的 AuthenticationError / LockedAuth 帶 status；缺 status 視為 500
    const status =
      typeof (err as { status?: unknown })?.status === 'number'
        ? (err as { status: number }).status
        : 500
    const message =
      err instanceof Error && status !== 500
        ? err.message
        : 'The email or password provided is incorrect.'
    if (status === 500) {
      payload.logger.error({ err, msg: '[member/login] unexpected failure' })
      return NextResponse.json({ errors: [{ message: '登入服務異常，請稍後再試' }] }, { status: 500 })
    }
    return NextResponse.json({ errors: [{ message }] }, { status })
  }
}
