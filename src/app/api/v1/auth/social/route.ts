import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveSocialAuth } from '@/lib/auth/socialCredentials'
import { verifyIdToken, IdTokenError, type IdTokenProvider } from '@/lib/auth/verifyIdToken'
import { linkOrCreateSocialUser } from '@/lib/auth/socialIdentity'
import { issuePayloadToken } from '@/lib/auth/issuePayloadToken'

/**
 * POST /api/v1/auth/social
 * ────────────────────────
 * 原生 App 的 Google / Apple 登入 —— id_token 交換 Payload Bearer token。
 *
 * 為什麼不共用網頁那條：網頁走 NextAuth authorization-code（瀏覽器轉址 + cookie），
 * 原生 App 該用系統 SDK（Google Sign-In / ASAuthorizationAppleIDProvider）取得 id_token
 * 再交換 —— 不必開瀏覽器、Apple 審核也要求 iOS App 用原生 Sign in with Apple。
 *
 * 會員資料與網頁 100% 同一份：走 socialIdentity.linkOrCreateSocialUser（socialId-first），
 * 同一個人先在網頁用 Google 登入、之後在 App 用 Google 登入，會對到同一個會員。
 *
 * Request body:
 *   {
 *     "provider": "google" | "apple",
 *     "idToken":  "<SDK 拿到的 id_token>",
 *     "nonce":    "<發起授權時用的 nonce 原文，可選但強烈建議>",
 *     "name":     "<Apple 首次登入才拿得到全名，可選>"
 *   }
 *
 * Response 200: 與 /api/v1/auth/login 同格式，另加 `isNewUser`。
 *
 * ⚠️ Apple 的 email / 全名「只有第一次授權」會回傳。App 端首次登入務必把 fullName
 *    一起 POST 上來，否則會員名字只會是 email 前綴。
 */

const SUPPORTED: IdTokenProvider[] = ['google', 'apple']

function fail(status: number, error: string, code: string) {
  return NextResponse.json({ success: false, error, code }, { status })
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      provider?: string
      idToken?: string
      id_token?: string
      nonce?: string
      name?: string
    }

    const provider = (body.provider || '').trim().toLowerCase() as IdTokenProvider
    const idToken = (body.idToken || body.id_token || '').trim()

    if (!SUPPORTED.includes(provider)) {
      return fail(400, 'provider 必須是 google 或 apple', 'BAD_REQUEST')
    }
    if (!idToken) {
      return fail(400, '缺少 idToken', 'BAD_REQUEST')
    }

    const { enabled, nativeAudiences } = await resolveSocialAuth()
    if (!enabled[provider]) {
      return fail(403, `${provider} 登入目前未啟用`, 'PROVIDER_DISABLED')
    }

    let identity
    try {
      identity = await verifyIdToken({
        provider,
        idToken,
        allowedAudiences: nativeAudiences[provider],
        nonce: body.nonce || null,
      })
    } catch (err) {
      if (err instanceof IdTokenError) {
        console.warn(`[v1/auth/social] ${provider} id_token 驗證失敗：${err.message}`)
        return fail(401, err.message, 'INVALID_ID_TOKEN')
      }
      throw err
    }

    // email_verified=false 的 email 不採信（拿來做 email 匹配會被人冒用既有會員），
    // 但仍可用 sub 建/找帳號 —— 走 placeholder email 路徑。
    const trustedEmail = identity.emailVerified ? identity.email : null

    const payload = await getPayload({ config })
    // isNewUser 給 App 判斷要不要跑新手引導 —— 在 link 之前先問一次「這個社群 ID 見過嗎」
    const before = await payload.find({
      collection: 'customers',
      where: { [`socialLogins.${provider}Id`]: { equals: identity.sub } },
      limit: 1,
    })
    const isNewUser = before.docs.length === 0

    const user = await linkOrCreateSocialUser({
      provider,
      providerAccountId: identity.sub,
      email: trustedEmail,
      name: (body.name || '').trim() || identity.name,
    })
    if (!user) {
      return fail(401, '無法建立會員（provider 未回傳可用的識別資訊）', 'UNAUTHORIZED')
    }

    const { token, expiresIn } = await issuePayloadToken(payload, user)

    // 回傳最新的完整 user（linkOrCreateSocialUser 可能剛更新過欄位）
    const fresh = (await payload.findByID({
      collection: 'customers',
      id: user.id,
      depth: 1,
    })) as unknown as Record<string, unknown>

    return NextResponse.json({
      success: true,
      data: {
        token,
        expiresIn,
        isNewUser,
        user: {
          id: fresh.id,
          email: fresh.email,
          name: fresh.name,
          phone: fresh.phone,
          points: fresh.points || 0,
          shoppingCredit: fresh.shoppingCredit || 0,
          memberTier: fresh.memberTier,
          gender: fresh.gender,
          birthday: fresh.birthday,
          referralCode: fresh.referralCode,
          gameTermsAcceptance: fresh.gameTermsAcceptance,
        },
      },
    })
  } catch (err) {
    console.error('[v1/auth/social] error', err)
    return fail(500, 'Internal server error', 'INTERNAL_ERROR')
  }
}
