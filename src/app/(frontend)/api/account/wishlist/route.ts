import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getUserWishlist } from '@/lib/wishlist/server'

/**
 * 會員收藏清單 API（DB 持久化，跨裝置）
 * ────────────────────────────────────
 *   GET    /api/account/wishlist            → 取得本人收藏（含商品資料）
 *   POST   /api/account/wishlist  {productId} → 加入收藏（冪等）
 *   DELETE /api/account/wishlist?productId=  → 移除收藏
 *
 * 一律以 cookie 驗證的登入會員為界（未登入回 401）。前台未登入時走
 * localStorage（不打這條）；登入後由 WishlistSync 合併並接管同步。
 *
 * wishlist-items collection access 是 isAdmin，這裡用 local API（overrideAccess
 * 預設 true），但每筆 where/data 都強制綁 user=本人，杜絕越權讀寫他人收藏。
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }
    const items = await getUserWishlist(payload, user.id)
    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error('[account/wishlist GET] error:', error)
    return NextResponse.json({ success: false, error: '讀取失敗' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as { productId?: string | number }
    const productId = String(body.productId || '').trim()
    if (!productId) {
      return NextResponse.json({ success: false, error: '缺少商品' }, { status: 400 })
    }

    // 商品存在性
    const product = await payload
      .findByID({ collection: 'products', id: productId, depth: 0 })
      .catch(() => null)
    if (!product) {
      return NextResponse.json({ success: false, error: '找不到商品' }, { status: 404 })
    }

    // 冪等：已收藏則直接成功
    const existing = await payload.find({
      collection: 'wishlist-items',
      where: {
        and: [{ user: { equals: user.id } }, { product: { equals: productId } }],
      },
      limit: 1,
      depth: 0,
    })
    if (existing.totalDocs === 0) {
      await payload.create({
        collection: 'wishlist-items',
        data: { user: user.id, product: productId } as never,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[account/wishlist POST] error:', error)
    return NextResponse.json({ success: false, error: '加入失敗' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const productId = String(req.nextUrl.searchParams.get('productId') || '').trim()
    if (!productId) {
      return NextResponse.json({ success: false, error: '缺少商品' }, { status: 400 })
    }

    await payload.delete({
      collection: 'wishlist-items',
      where: {
        and: [{ user: { equals: user.id } }, { product: { equals: productId } }],
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[account/wishlist DELETE] error:', error)
    return NextResponse.json({ success: false, error: '移除失敗' }, { status: 500 })
  }
}
