import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getPayload } from 'payload'
import config from '@payload-config'

import { computeOrderPricing } from '@/lib/promotions/pricing'
import { checkRateLimit } from '@/lib/rateLimit'
import { issuePayloadToken } from '@/lib/auth/issuePayloadToken'
import {
  syntheticGuestEmail,
  validateGuestCheckoutInput,
  type GuestCheckoutInput,
} from '@/lib/commerce/guestCheckout'

/**
 * POST /api/checkout/guest-order —— 訪客（非會員）結帳送單（WO-BP002 C）
 * ────────────────────────────────────────────────────────────────
 * 開關：後台 結帳設定 → 「允許訪客（非會員）結帳」（checkout-settings.checkoutAsGuest）
 * 關閉時一律 403，前台會退回「請先登入」。
 *
 * 為什麼不是直接放寬 Orders.access.create：
 * - 放開公開建單 = 任何人都能對 /api/orders 灌單，且 client 送什麼欄位都進得來。
 *   這裡改成一支收斂的入口：只收「商品 id / 數量 / 券碼 / 物流 / 收件資訊 / email」，
 *   **完全不收任何金額欄位**，價格由 computeOrderPricing 重算後才寫進訂單。
 *
 * ⚠️ 這支用 local API 建單，而 `beforeChangeServerPricing` 對 local API 是跳過的
 *    —— 所以本路由自己就是計價權威，必須用 server 算出來的數字建單（下方
 *    `pricing.breakdown` / `pricing.lines`），絕不可回頭採用 client 傳的金額。
 *    （庫存檢查 hook 沒有 local-API 豁免，仍會跑。）
 *
 * 身分：每筆訪客單建立一個 `isGuest` 臨時會員（合成信箱），真實信箱寫進
 * orders.guestEmail；建單後簽一份 session cookie，讓後續金流（/api/payment/
 * ecpay/create 需要登入 + 訂單擁有權）與成功頁沿用既有路徑。
 */

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
/** 訪客 session 有效期（秒）：夠走完付款與成功頁即可 */
const GUEST_SESSION_MAX_AGE = 2 * 60 * 60

function fail(status: number, error: string, code: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, code, ...extra }, { status })
}

/**
 * 限流用的來源 IP。
 * ⚠️ 不可取 X-Forwarded-For 的**第一段** —— 那段是 client 自己送的，攻擊者每次換一個
 * 假 IP 就能無限繞過限流。nginx 會設 X-Real-IP，並把真正的來源附加在 XFF 最後一段，
 * 所以優先讀 X-Real-IP，退而取 XFF 的最後一段。
 */
function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const parts = fwd.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]!
  }
  return 'unknown'
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return fail(400, '請求格式錯誤', 'INVALID_BODY')
  }

  const rate = checkRateLimit(`guest-order:${clientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, error: '嘗試次數過多，請稍後再試', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
    )
  }

  const validation = validateGuestCheckoutInput(body)
  if (!validation.ok) {
    return fail(400, '結帳資料不完整，請確認必填欄位', 'VALIDATION_FAILED', {
      errors: validation.errors,
    })
  }
  const input: GuestCheckoutInput = validation.value

  try {
    const payload = await getPayload({ config })

    // ── 開關 ────────────────────────────────────────────────────────────
    const settings = (await payload.findGlobal({
      slug: 'checkout-settings',
      depth: 0,
    })) as unknown as Record<string, unknown>
    if (settings?.checkoutAsGuest === false) {
      return fail(403, '本店目前僅開放會員結帳，請先登入', 'GUEST_CHECKOUT_DISABLED')
    }
    const maxItems =
      typeof settings?.maxItemsPerOrder === 'number' && settings.maxItemsPerOrder > 0
        ? settings.maxItemsPerOrder
        : 0
    const totalQty = input.items.reduce((n, i) => n + i.quantity, 0)
    if (maxItems > 0 && totalQty > maxItems) {
      return fail(400, `單筆訂單最多 ${maxItems} 件，請調整數量`, 'TOO_MANY_ITEMS')
    }

    // ── 計價（唯一權威）──────────────────────────────────────────────
    const pricing = await computeOrderPricing(payload, {
      items: input.items,
      couponCodes: input.couponCodes,
      user: null, // 訪客沒有會員 / 訂閱權益
      channel: 'web',
      shippingMethodId: input.shippingMethodId,
      paymentMethod: input.paymentMethod,
    })
    if (!pricing.ok) {
      return fail(400, '購物車內容已變動，請回到購物車重新確認', 'PRICING_FAILED', {
        errors: pricing.errors,
      })
    }
    const b = pricing.breakdown

    const minOrder =
      typeof settings?.minOrderAmount === 'number' && settings.minOrderAmount > 0
        ? settings.minOrderAmount
        : 0
    if (minOrder > 0 && b.itemsSubtotal < minOrder) {
      return fail(400, `最低消費金額為 NT$${minOrder}`, 'BELOW_MIN_ORDER')
    }

    // ── 物流方式快照（名稱 / 物流商，訂單顯示用）────────────────────
    let methodName: string | undefined
    let carrier: string | undefined
    if (input.shippingMethodId != null) {
      try {
        const m = (await payload.findByID({
          collection: 'shipping-methods',
          id: input.shippingMethodId as never,
          depth: 0,
          overrideAccess: true,
        })) as unknown as Record<string, unknown>
        methodName = typeof m?.name === 'string' ? m.name : undefined
        carrier = typeof m?.carrier === 'string' ? m.carrier : undefined
      } catch {
        /* computeOrderPricing 已經 fail closed 過，這裡拿不到只是少了顯示名稱 */
      }
    }

    const couponApps = (pricing.evaluation?.applications ?? []).filter((a) => a.source === 'coupon')
    const reasonParts: string[] = []
    if (b.promotionDiscount > 0) reasonParts.push(`活動折抵 ${b.promotionDiscount}`)
    if (b.couponDiscount > 0) reasonParts.push(`優惠券 ${b.couponDiscount}`)
    const discountReason = reasonParts.join('；')

    // ── 訪客臨時帳號 ────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const guestUser = (await (payload as any).create({
      collection: 'users',
      data: {
        email: syntheticGuestEmail(randomUUID()),
        password: `guest_${randomUUID()}_${Date.now()}`,
        name: input.shippingAddress.recipientName || '訪客',
        role: 'customer',
        isGuest: true,
        _verified: true,
      },
      disableVerificationEmail: true,
      overrideAccess: true,
    })) as Record<string, unknown>

    // ── 建單（金額全部取自 server 計價結果）──────────────────────────
    // 建單失敗（庫存不足等）要把剛剛那個臨時帳號收掉，否則每次失敗都留一筆垃圾會員。
    let order: Record<string, unknown>
    try {
      order = (await payload.create({
        collection: 'orders',
        data: {
          customer: guestUser.id,
          guestEmail: input.email,
          items: pricing.lines.map((l) => ({
            product: l.productId,
            productName: l.productName,
            variant: l.variantLabel ?? undefined,
            sku: l.sku ?? undefined,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            subtotal: l.lineSubtotal,
            isGift: l.isGift || undefined,
            isAddOn: l.isAddOn || undefined,
            bundleRef: l.bundleRef ?? undefined,
            giftRuleRef: l.giftRuleRef ?? undefined,
            addOnRuleRef: l.addOnRuleRef ?? undefined,
          })),
          subtotal: b.itemsSubtotal,
          subtotalBeforeDiscount: b.itemsSubtotal,
          discountAmount: b.promotionDiscount + b.couponDiscount,
          discountReason: discountReason || undefined,
          // 券快照：Orders afterChange 會據此寫 CouponRedemptions 並累計使用次數。
          // 少了這段 = 訪客用券不計額度（等同無限次使用），必須跟著 server 計價結果寫。
          coupon: couponApps[0]?.couponId ?? undefined,
          couponCode: couponApps[0]?.couponCode ?? undefined,
          appliedCoupons: couponApps.map((a) => ({
            coupon: a.couponId,
            couponCode: a.couponCode,
            discountAmount: a.discountAmount > 0 ? a.discountAmount : a.shippingDiscountAmount,
          })),
          attribution: input.attribution,
          shippingFee: b.shippingFee,
          codFee: b.codFee,
          total: b.total,
          paymentMethod: input.paymentMethod,
          paymentStatus: 'unpaid',
          status: 'pending',
          shippingAddress: input.shippingAddress,
          shippingMethod: {
            method: input.shippingMethodId ?? undefined,
            methodName,
            carrier,
          },
          customerNote: input.customerNote,
          promotion: {
            quoteId: pricing.quote.quoteId,
            pricingVersion: pricing.quote.pricingVersion,
            serverEnforced: true,
            quoteHash: pricing.quote.quoteHash,
            discountTotal: b.promotionDiscount,
            shippingDiscountTotal: pricing.evaluation?.shippingDiscountTotal ?? 0,
            appliedPromotionSnapshots: pricing.evaluation?.applications ?? [],
            rewardIntents: pricing.evaluation?.rewardIntents ?? [],
          },
        } as never,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
    } catch (orderErr) {
      try {
        await payload.delete({ collection: 'users', id: guestUser.id as never, overrideAccess: true })
      } catch (cleanupErr) {
        console.error('[guest-order] 建單失敗後清除臨時帳號也失敗', guestUser.id, cleanupErr)
      }
      throw orderErr
    }

    // ── 簽 session：後續金流 / 成功頁沿用既有（需登入）路徑 ──────────
    const response = NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
      },
    })
    try {
      const { token, expiresIn } = await issuePayloadToken(
        payload,
        guestUser as { id: string | number; email?: string } & Record<string, unknown>,
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const authConfig = (payload as any).collections?.users?.config?.auth
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
        value: token,
        httpOnly: true,
        path: '/',
        secure: Boolean(authConfig?.cookies?.secure) || sameSite === 'none',
        sameSite,
        domain: authConfig?.cookies?.domain || undefined,
        // 訪客 session 只要撐到「付完款 + 看完成功頁」就夠 —— 用會員的 7 天期限會讓
        // 顧客在往後一週都以合成信箱的臨時帳號「登入中」（頁首顯示已登入、會員中心
        // 只有一張訂單），誤以為自己有帳號。壓到 2 小時。
        maxAge: Math.min(expiresIn, GUEST_SESSION_MAX_AGE),
      })
    } catch (err) {
      // 簽 session 失敗不擋單 —— 訂單已成立，只是綠界線上付款那條會要求登入。
      // 貨到付款 / 面交不受影響，顧客仍會收到訂單確認信。
      console.error('[guest-order] issuePayloadToken failed', err)
    }

    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // 庫存不足等 hook 擋單訊息要讓顧客看得到（Orders.beforeChange 丟 APIError 400）
    if (/庫存|不足|已售完/.test(message)) {
      return fail(400, message, 'OUT_OF_STOCK')
    }
    console.error('[guest-order] failed', err)
    return fail(500, '訂單建立失敗，請稍後再試', 'INTERNAL_ERROR')
  }
}
