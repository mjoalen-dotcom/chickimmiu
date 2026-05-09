import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * POST /api/v1/auth/login
 * ─────────────────────────
 * APP 登入端點 — 包裝 Payload 內建 login，return 乾淨的 `{ token, user, expiresIn }`。
 *
 * Request body:
 *   { "email": "user@example.com", "password": "..." }
 *
 * Response 200:
 *   {
 *     "success": true,
 *     "data": {
 *       "token": "<JWT>",
 *       "expiresIn": 604800,       // 秒（= users.auth.tokenExpiration）
 *       "user": { id, email, name, points, shoppingCredit, memberTier, ... }
 *     }
 *   }
 *
 * 後續 APP 帶 `Authorization: Bearer <token>` 訪問所有 v1 API。
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; password?: string }
    const email = (body.email || '').trim().toLowerCase()
    const password = body.password || ''

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Missing email or password', code: 'BAD_REQUEST' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    let result: { token?: string; user?: Record<string, unknown>; exp?: number }
    try {
      result = (await payload.login({
        collection: 'users',
        data: { email, password },
      })) as never
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登入失敗'
      return NextResponse.json(
        { success: false, error: msg, code: 'INVALID_CREDENTIALS' },
        { status: 401 },
      )
    }

    if (!result?.token || !result.user) {
      return NextResponse.json(
        { success: false, error: '登入失敗', code: 'INVALID_CREDENTIALS' },
        { status: 401 },
      )
    }

    // 計算 expiresIn（exp 是 epoch seconds）
    const nowSec = Math.floor(Date.now() / 1000)
    const expiresIn = result.exp ? Math.max(0, result.exp - nowSec) : 7 * 24 * 60 * 60

    // 過濾敏感欄位
    const u = result.user as Record<string, unknown>
    return NextResponse.json({
      success: true,
      data: {
        token: result.token,
        expiresIn,
        user: {
          id: u.id,
          email: u.email,
          name: u.name,
          phone: u.phone,
          points: u.points || 0,
          shoppingCredit: u.shoppingCredit || 0,
          memberTier: u.memberTier,
          gender: u.gender,
          birthday: u.birthday,
          referralCode: u.referralCode,
          gameTermsAcceptance: u.gameTermsAcceptance,
        },
      },
    })
  } catch (err) {
    console.error('v1 login error', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
