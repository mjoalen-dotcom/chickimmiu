import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { computeOrderPricing, type RawCartItem } from '@/lib/promotions/pricing'
import { readReferralCodeFromRequest } from '@/lib/affiliate/referralCookie'
import { checkRateLimit, clientIpForRateLimit } from '@/lib/rateLimit'

/**
 * POST /api/pricing/quote（CHIC Commerce OS P0-B）
 * ──────────────────────────────────────────────
 * 伺服器權威報價：client 只送商品 id / sku / 數量 / 券碼 / 行標記，
 * 所有價格與折扣由 server 重算。前台購物車進度、結帳明細都吃這裡。
 *
 * Body: {
 *   items: [{ productId, sku?, quantity, isGift?, giftRuleRef?, isAddOn?, addOnRuleRef?, bundleRef? }],
 *   couponCodes?: string[],
 *   shippingMethodId?: number|string|null,
 *   paymentMethod?: string|null,
 * }
 *
 * 200 { ok:true, quote, breakdown, progress[], applications[], rejections[], rewardIntents[], lines[], storefrontEnabled }
 * 422 { ok:false, errors[] }（贈品/Bundle 行驗證失敗等 — fail closed）
 */
export const dynamic = 'force-dynamic'

interface QuoteBody {
  items?: RawCartItem[]
  couponCodes?: string[]
  shippingMethodId?: number | string | null
  paymentMethod?: string | null
}

/**
 * 限流：這支刻意**不要求登入**（訪客也要看得到購物車金額），所以 IP 限流是
 * 唯一的濫用防線。一次報價會打好幾次 DB（商品／規則／活動／券／用量／物流），
 * 不設限等於開放一個高成本端點給全世界。
 *
 * 額度取捨：前台 useCartQuote 已 debounce 400ms，真人一個 session 大概數十次；
 * 120/分鐘（≈2/秒）對真人綽綽有餘（含辦公室共用 IP 的情形），對腳本則是有效
 * 上限。
 */
const RATE_LIMIT_MAX = 120
const RATE_LIMIT_WINDOW_MS = 60_000

export async function POST(request: Request) {
  const rate = checkRateLimit(
    `pricing-quote:${clientIpForRateLimit(request)}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  )
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, errors: ['rate_limited'] },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
    )
  }

  let body: QuoteBody = {}
  try {
    body = (await request.json()) as QuoteBody
  } catch {
    return NextResponse.json({ ok: false, errors: ['invalid_body'] }, { status: 400 })
  }
  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) {
    return NextResponse.json({ ok: false, errors: ['empty_cart'] }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config })
    let user: Record<string, unknown> | null = null
    try {
      const auth = await payload.auth({ headers: request.headers })
      user = (auth?.user as unknown as Record<string, unknown>) ?? null
    } catch {
      user = null
    }

    const result = await computeOrderPricing(payload, {
      items,
      couponCodes: Array.isArray(body.couponCodes) ? body.couponCodes.map(String) : [],
      user,
      channel: 'web',
      shippingMethodId: body.shippingMethodId ?? null,
      paymentMethod: body.paymentMethod ?? null,
      // 伺服器端從 cookie 讀，刻意不看 body（見 referralCookie.ts 註解）
      referralCode: readReferralCodeFromRequest(request) ?? null,
    })

    if (!result.ok) {
      return NextResponse.json({ ok: false, errors: result.errors }, { status: 422 })
    }

    const e = result.evaluation
    return NextResponse.json({
      ok: true,
      storefrontEnabled: result.settings.storefrontEnabled,
      quote: result.quote,
      breakdown: result.breakdown,
      progress: e?.progress ?? [],
      applications: (e?.applications ?? []).map((a) => ({
        ruleKey: a.ruleKey,
        slug: a.slug,
        source: a.source,
        couponCode: a.couponCode,
        effectType: a.effectType,
        discountAmount: a.discountAmount,
        shippingDiscountAmount: a.shippingDiscountAmount,
        allocations: a.allocations,
      })),
      rejections: (e?.rejections ?? []).map((r) => ({
        ruleKey: r.ruleKey,
        slug: r.slug,
        source: r.source,
        couponCode: r.couponCode,
        reasonCodes: r.reasonCodes,
      })),
      rewardIntents: e?.rewardIntents ?? [],
      lines: result.lines.map((l) => ({
        lineId: l.lineId,
        productId: l.productId,
        sku: l.sku,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineSubtotal: l.lineSubtotal,
        isGift: l.isGift,
        isAddOn: l.isAddOn,
      })),
    })
  } catch (err) {
    console.error('[pricing/quote] failed', err)
    return NextResponse.json({ ok: false, errors: ['internal_error'] }, { status: 500 })
  }
}
