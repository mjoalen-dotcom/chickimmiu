import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { computeOrderPricing, type RawCartItem } from '@/lib/promotions/pricing'

/**
 * POST /api/admin/campaigns/[id]/preview（CHIC Commerce OS P0-C）
 * ─────────────────────────────────────────────────────────────
 * Campaign Studio 試算：管理員用假想購物車測指定活動（含 draft / paused），
 * 走同一個 computeOrderPricing，零副作用（不寫 reward / redemption / application）。
 *
 * Body: { items: RawCartItem[], couponCodes?: string[], userId?: number|string }
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  let body: { items?: RawCartItem[]; couponCodes?: string[]; userId?: number | string } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, errors: ['invalid_body'] }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config })
    const auth = await payload.auth({ headers: request.headers })
    const requester = auth?.user as Record<string, unknown> | null
    if (!requester || requester.role !== 'admin') {
      return NextResponse.json({ ok: false, errors: ['forbidden'] }, { status: 403 })
    }

    let simulatedUser: Record<string, unknown> | null = null
    if (body.userId != null) {
      try {
        simulatedUser = (await payload.findByID({
          collection: 'users',
          id: body.userId as never,
          depth: 0,
          overrideAccess: true,
        })) as unknown as Record<string, unknown>
      } catch {
        simulatedUser = null
      }
    }

    const result = await computeOrderPricing(payload, {
      items: Array.isArray(body.items) ? body.items : [],
      couponCodes: Array.isArray(body.couponCodes) ? body.couponCodes.map(String) : [],
      user: simulatedUser,
      channel: 'web',
      previewCampaignId: id,
    })

    return NextResponse.json({
      ok: result.ok,
      errors: result.errors,
      breakdown: result.breakdown,
      evaluation: result.evaluation,
      lines: result.lines.map((l) => ({
        lineId: l.lineId,
        productId: l.productId,
        productName: l.productName,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineSubtotal: l.lineSubtotal,
      })),
      quote: result.quote,
    })
  } catch (err) {
    console.error('[admin/campaigns/preview] failed', err)
    return NextResponse.json({ ok: false, errors: ['internal_error'] }, { status: 500 })
  }
}
