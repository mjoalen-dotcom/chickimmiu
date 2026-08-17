import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { computeOrderPricing, type RawCartItem } from '@/lib/promotions/pricing'
import { readReferralCodeFromRequest } from '@/lib/affiliate/referralCookie'

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

export async function POST(request: Request) {
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
