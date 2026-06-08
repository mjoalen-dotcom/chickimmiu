import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getServerRecommendations } from '@/lib/recommendation/serverRecommend'
import type { RecommendationContext } from '@/lib/recommendationEngine'

/**
 * GET /api/recommendations?stage=product_page&productId=&price=&cartIds=a,b&total=
 * 前台 5 個推薦元件（PDP 加購 / 購物車交叉 / 結帳加購 / 感謝頁 / 離站挽留）fetch 此端點。
 * 回傳依 stage 不同：product_page → {crossSell,upsell}；cart → {bundle,addon}；其餘 → {items}。
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_STAGES = new Set([
  'product_page',
  'cart',
  'checkout',
  'thank_you',
  'exit_intent',
  'email',
])

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const stage = String(sp.get('stage') || '')
    if (!VALID_STAGES.has(stage)) {
      return NextResponse.json({ success: false, error: 'invalid stage' }, { status: 400 })
    }
    const cartIds = String(sp.get('cartIds') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const ctx: RecommendationContext = {
      stage: stage as RecommendationContext['stage'],
      currentProductId: sp.get('productId') || undefined,
      currentPrice: sp.get('price') ? Number(sp.get('price')) : undefined,
      cartProductIds: cartIds,
      cartTotal: sp.get('total') ? Number(sp.get('total')) : undefined,
    }

    const payload = await getPayload({ config })
    const result = await getServerRecommendations(payload, ctx)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[recommendations GET] error:', error)
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 })
  }
}
