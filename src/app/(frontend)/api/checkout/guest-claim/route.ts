import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { checkRateLimit, clientIpForRateLimit } from '@/lib/rateLimit'
import { issuePayloadToken } from '@/lib/auth/issuePayloadToken'
import { verifyGuestClaimToken } from '@/lib/commerce/guestClaimToken'
import { isSyntheticGuestEmail } from '@/lib/commerce/guestCheckout'

/**
 * POST /api/checkout/guest-claim —— 訪客一鍵成為會員
 * ────────────────────────────────────────────────
 * 訪客結帳建的是 `isGuest` 臨時帳號（合成信箱）。這支把那個帳號**就地升級**成
 * 真會員：換成顧客填的真信箱、設定密碼、isGuest=false，並把訂單上的收件資訊
 * 帶進會員資料（姓名/手機/地址簿）。因為 customer 關聯沒變，**那筆訂單自動
 * 進到他的會員中心**，不需要搬單。
 *
 * 兩種進入方式（擇一即可）：
 * 1. 剛結完帳（2 小時內）：帶著訪客 session cookie → 成功頁的「加入會員」卡片
 * 2. 訂單確認信裡的邀請連結：帶 `token`（HMAC 簽章，14 天）→ /join-member
 *    能收到那封信就等於證明擁有該信箱，所以 token 本身就是身分證明。
 *
 * 不接受「只給訂單編號 + 手機」就升級 —— 那組資訊只夠查單，拿來建立一個掛著
 * 別人 email 的帳號太弱。
 */

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60_000


function fail(status: number, error: string, code: string) {
  return NextResponse.json({ success: false, error, code }, { status })
}

export async function POST(req: Request) {
  let body: { password?: unknown; acceptTerms?: unknown; name?: unknown; token?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return fail(400, '請求格式錯誤', 'INVALID_BODY')
  }

  const password = typeof body.password === 'string' ? body.password : ''
  const token = typeof body.token === 'string' ? body.token : ''
  const acceptTerms = Boolean(body.acceptTerms)
  const nameInput = typeof body.name === 'string' ? body.name.trim() : ''

  if (password.length < 8) return fail(400, '密碼至少 8 個字元', 'WEAK_PASSWORD')
  if (!acceptTerms) return fail(400, '請勾選同意服務條款', 'TERMS_REQUIRED')

  const rate = checkRateLimit(`guest-claim:${clientIpForRateLimit(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, error: '嘗試次數過多，請稍後再試', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
    )
  }

  try {
    const payload = await getPayload({ config })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const secret = (payload as any).secret as string

    // ── 身分：session（剛結完帳）或 token（信件連結）──────────────────
    let guestUserId: string | number | null = null
    let orderDoc: Record<string, unknown> | null = null

    if (token) {
      const claim = verifyGuestClaimToken(secret, token)
      if (!claim) return fail(400, '邀請連結已失效，請改用「訂單查詢」或重新註冊', 'INVALID_TOKEN')
      const order = (await payload
        .findByID({ collection: 'orders', id: claim.orderId as never, depth: 0, overrideAccess: true })
        .catch(() => null)) as Record<string, unknown> | null
      if (!order) return fail(400, '邀請連結已失效', 'INVALID_TOKEN')
      // token 內的 email 必須仍與訂單一致（訂單被改過就作廢）
      if (String(order.guestEmail ?? '').toLowerCase() !== claim.email.toLowerCase()) {
        return fail(400, '邀請連結已失效', 'INVALID_TOKEN')
      }
      orderDoc = order
      guestUserId = (order.customer as string | number) ?? null
    } else {
      const { user } = await payload.auth({ headers: req.headers })
      if (!user) return fail(401, '請重新從訂單確認信的連結加入會員', 'UNAUTHORIZED')
      if ((user as unknown as { isGuest?: boolean }).isGuest !== true) {
        return fail(409, '您已經是會員了', 'ALREADY_MEMBER')
      }
      guestUserId = user.id
      const orders = await payload.find({
        collection: 'orders',
        where: { customer: { equals: user.id } },
        sort: '-createdAt',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      orderDoc = (orders.docs[0] as unknown as Record<string, unknown>) ?? null
    }

    if (guestUserId == null || !orderDoc) return fail(400, '找不到對應的訂單', 'ORDER_NOT_FOUND')

    const guestUser = (await payload
      .findByID({ collection: 'users', id: guestUserId as never, depth: 0, overrideAccess: true })
      .catch(() => null)) as Record<string, unknown> | null
    if (!guestUser) return fail(400, '找不到對應的帳號', 'USER_NOT_FOUND')
    if (guestUser.isGuest !== true) return fail(409, '此訂單已經綁定會員帳號', 'ALREADY_MEMBER')

    const email = String(orderDoc.guestEmail ?? '').trim().toLowerCase()
    if (!email || isSyntheticGuestEmail(email)) return fail(400, '此訂單沒有可用的聯絡信箱', 'NO_EMAIL')

    // 信箱已被其他會員使用 → 不搶，請他登入（不透露更多細節）
    const taken = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (taken.docs.length > 0 && String((taken.docs[0] as unknown as { id: unknown }).id) !== String(guestUserId)) {
      return fail(409, '此信箱已經是會員，請直接登入；需要把這筆訂單併入帳號請聯繫客服', 'EMAIL_TAKEN')
    }

    const addr = (orderDoc.shippingAddress ?? {}) as Record<string, unknown>
    const recipientName = typeof addr.recipientName === 'string' ? addr.recipientName : ''
    const phone = typeof addr.phone === 'string' ? addr.phone : ''

    // ── 就地升級（訂單的 customer 不變 → 訂單自動進會員中心）──────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.update as any)({
      collection: 'users',
      id: guestUserId,
      data: {
        email,
        password,
        isGuest: false,
        name: nameInput || (guestUser.name as string) || recipientName || '會員',
        ...(phone ? { phone } : {}),
        // 地址簿帶入這次的收件資訊，之後回購免重打
        ...(recipientName && phone && addr.address
          ? {
              addresses: [
                {
                  recipientName,
                  phone,
                  zipCode: (addr.zipCode as string) || '',
                  city: (addr.city as string) || '',
                  district: (addr.district as string) || '',
                  address: (addr.address as string) || '',
                  isDefault: true,
                },
              ],
            }
          : {}),
        _verified: true,
      },
      overrideAccess: true,
    })

    // 換發正常長度的會員 session（訪客那份只有 2 小時）
    const response = NextResponse.json({
      success: true,
      data: { email, orderNumber: orderDoc.orderNumber },
    })
    try {
      const fresh = (await payload.findByID({
        collection: 'users',
        id: guestUserId as never,
        depth: 0,
        overrideAccess: true,
      })) as unknown as { id: string | number; email?: string } & Record<string, unknown>
      const { token: sessionToken, expiresIn } = await issuePayloadToken(payload, fresh)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const authConfig = (payload as any).collections?.customers?.config?.auth
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cookiePrefix = ((payload as any).config?.cookiePrefix as string | undefined) || 'payload'
      const rawSameSite = authConfig?.cookies?.sameSite
      const sameSite: 'strict' | 'lax' | 'none' =
        typeof rawSameSite === 'string'
          ? (rawSameSite.toLowerCase() as 'strict' | 'lax' | 'none')
          : rawSameSite
            ? 'strict'
            : 'lax'
      response.cookies.set({
        name: `${cookiePrefix}-token`,
        value: sessionToken,
        httpOnly: true,
        path: '/',
        secure: Boolean(authConfig?.cookies?.secure) || sameSite === 'none',
        sameSite,
        domain: authConfig?.cookies?.domain || undefined,
        maxAge: expiresIn,
      })
    } catch (err) {
      // 帳號已經升級成功，只是沒自動登入 —— 顧客用新密碼登入即可
      console.error('[guest-claim] issue session failed', err)
    }
    return response
  } catch (err) {
    console.error('[guest-claim] failed', err)
    return fail(500, '加入會員失敗，請稍後再試', 'INTERNAL_ERROR')
  }
}
