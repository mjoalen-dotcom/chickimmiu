import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

/**
 * GET /api/cart/gifts?subtotal=<num>&productIds=<csv>
 *
 * 依據當下 cart subtotal + 商品清單，找出應自動加入的贈品。
 * 回傳給 client（checkout / cart page）以 `cartStore.replaceGifts()` 套用。
 *
 * 觸發規則：
 *   - min_amount：subtotal >= minAmount 即觸發；stackable=true 時倍數 = floor(subtotal / minAmount)
 *   - product_in_cart：cart 任一 id in triggerProducts 即觸發（固定 1 份）
 *
 * 多條規則同時觸發時按 priority DESC 排。回 gifts[] 適合直接塞進 cart。
 */

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const searchParams = req.nextUrl.searchParams
  const subtotal = Number(searchParams.get('subtotal') ?? 0) || 0
  const productIdsRaw = searchParams.get('productIds') ?? ''
  const cartProductIds = productIdsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  try {
    const payload = await getPayload({ config })
    const now = new Date().toISOString()

    const result = await payload.find({
      collection: 'gift-rules',
      where: {
        and: [
          { isActive: { equals: true } },
          {
            or: [
              { startsAt: { exists: false } },
              { startsAt: { less_than_equal: now } },
            ],
          },
          {
            or: [
              { expiresAt: { exists: false } },
              { expiresAt: { greater_than: now } },
            ],
          },
        ],
      } satisfies Where,
      depth: 1,
      limit: 50,
      sort: '-priority',
    })

    const gifts: Array<Record<string, unknown>> = []

    for (const docRaw of result.docs) {
      const d = docRaw as unknown as Record<string, unknown>
      const triggerType = String(d.triggerType ?? '')
      const giftProduct = d.giftProduct as Record<string, unknown> | undefined
      if (!giftProduct) continue
      const giftQty = Number(d.giftQuantity ?? 1) || 1

      let multiplier = 0
      if (triggerType === 'min_amount') {
        const min = Number(d.minAmount ?? 0) || 0
        if (min <= 0 || subtotal < min) continue
        multiplier = d.stackable ? Math.floor(subtotal / min) : 1
      } else if (triggerType === 'product_in_cart') {
        const trigger = (d.triggerProducts as Array<Record<string, unknown> | string | number> | undefined) ?? []
        const triggerIds = trigger.map((p) => {
          if (typeof p === 'object' && p !== null) return String((p as Record<string, unknown>).id ?? '')
          return String(p)
        })
        if (!triggerIds.some((id) => cartProductIds.includes(id))) continue
        multiplier = 1
      }
      if (multiplier <= 0) continue

      const totalQty = giftQty * multiplier
      const productImage =
        Array.isArray(giftProduct.images) && giftProduct.images.length > 0
          ? ((giftProduct.images as Record<string, unknown>[])[0].image as Record<string, unknown> | undefined)
          : undefined

      gifts.push({
        productId: String(giftProduct.id ?? ''),
        slug: String(giftProduct.slug ?? ''),
        name: `[贈品] ${String(giftProduct.name ?? '')}`,
        image: productImage && typeof productImage === 'object' ? String(productImage.url ?? '') : '',
        price: 0,
        isGift: true,
        giftRuleRef: d.id,
        quantity: totalQty,
        ruleName: d.name,
      })
    }

    return NextResponse.json({ gifts })
  } catch (err) {
    console.error('[api/cart/gifts] failed:', err)
    return NextResponse.json({ gifts: [], error: 'internal' }, { status: 500 })
  }
}
