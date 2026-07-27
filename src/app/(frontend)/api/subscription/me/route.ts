import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getActiveMembership } from '@/lib/subscription/activate'

/**
 * GET /api/subscription/me — 登入者目前訂閱權益摘要。
 * 結帳頁（會員折扣/免運門檻）與訂閱頁 client refresh 用。
 * 未登入或無生效訂閱 → { active: false }。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ active: false })
    }
    const m = await getActiveMembership(payload, user as unknown as Record<string, unknown>)
    if (!m) {
      return NextResponse.json({ active: false })
    }
    const b = m.plan.benefits || {}
    return NextResponse.json({
      active: true,
      planName: m.plan.name || '',
      validUntil: m.validUntil.toISOString(),
      streakMonths: m.streakMonths,
      benefits: {
        discountPercent: Number(b.discountPercent) || 0,
        pointsMultiplier: Number(b.pointsMultiplier) || 1,
        freeShippingThreshold:
          b.freeShippingThreshold === null || b.freeShippingThreshold === undefined
            ? null
            : Number(b.freeShippingThreshold),
        monthlyCredit: Number(b.monthlyCredit) || 0,
      },
    })
  } catch (err) {
    console.error('[subscription/me] error:', err)
    return NextResponse.json({ active: false })
  }
}
