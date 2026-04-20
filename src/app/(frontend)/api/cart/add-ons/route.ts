import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

/**
 * GET /api/cart/add-ons?subtotal=<num>&productIds=<csv>
 *
 * 給結帳頁用：傳入當下 cart subtotal + cart 內商品 id 清單，
 * 回傳符合條件的 AddOnProducts 清單（active + 在期間 + 達最低門檻 + 含指定商品）。
 *
 * 不暴露 conditions 細節，只回 client 顯示所需的欄位：
 *   id, name, addOnPrice, productId, productName, productImage, usageLimitPerOrder, priority
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
      collection: 'add-on-products',
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

    const items = result.docs
      .map((d) => d as unknown as Record<string, unknown>)
      .filter((d) => {
        const conditions = (d.conditions as Record<string, unknown> | undefined) ?? {}
        const minSubtotal = Number(conditions.minCartSubtotal ?? 0) || 0
        if (subtotal < minSubtotal) return false

        const appliesTo = (conditions.appliesToProducts as Array<Record<string, unknown> | string | number> | undefined) ?? []
        if (appliesTo.length === 0) return true
        const requiredIds = appliesTo.map((p) => {
          if (typeof p === 'object' && p !== null) return String((p as Record<string, unknown>).id ?? '')
          return String(p)
        })
        return requiredIds.some((id) => cartProductIds.includes(id))
      })
      .map((d) => {
        const product = d.product as Record<string, unknown> | undefined
        const productImage =
          product && Array.isArray(product.images) && product.images.length > 0
            ? ((product.images as Record<string, unknown>[])[0].image as Record<string, unknown> | undefined)
            : undefined
        const conditions = (d.conditions as Record<string, unknown> | undefined) ?? {}
        return {
          id: d.id,
          name: d.name,
          addOnPrice: Number(d.addOnPrice ?? 0),
          productId: product ? String(product.id ?? '') : '',
          productSlug: product ? String(product.slug ?? '') : '',
          productName: product ? String(product.name ?? '') : '',
          productImage:
            productImage && typeof productImage === 'object'
              ? String(productImage.url ?? '')
              : '',
          usageLimitPerOrder: Number(conditions.usageLimitPerOrder ?? 1) || 1,
          priority: Number(d.priority ?? 0),
        }
      })

    return NextResponse.json({ items })
  } catch (err) {
    console.error('[api/cart/add-ons] failed:', err)
    return NextResponse.json({ items: [], error: 'internal' }, { status: 500 })
  }
}
