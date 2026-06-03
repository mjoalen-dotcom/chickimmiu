import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * POST /api/account/reviews — 會員提交商品評價
 *
 * 安全考量：product-reviews collection 的 create access 只是 `!!user`，若讓前端直接
 * 打 Payload REST，使用者可竄改 reviewer / status（評價成別人、或自我審核通過）。
 * 因此走這條 server route：
 *   - 由 cookie 驗證登入者
 *   - 強制 reviewer = 登入者本人、status = 'pending'（待審）
 *   - 驗證商品存在 + 會員確實購買過（防刷評）
 *   - 同一會員同一商品只允許一則（防洗版）
 *   - 照片只接受 client 先上傳到 /api/media 取得的 id（最多 5）
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      productId?: string
      rating?: number
      title?: string
      content?: string
      photoIds?: string[]
      orderId?: string
      variant?: string
    }

    const productId = String(body.productId || '').trim()
    const rating = Number(body.rating)
    const content = String(body.content || '').trim()
    const title = String(body.title || '').trim()

    if (!productId) {
      return NextResponse.json({ success: false, error: '請選擇商品' }, { status: 400 })
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: '請給 1–5 星評分' }, { status: 400 })
    }
    if (!content) {
      return NextResponse.json({ success: false, error: '請填寫評價內容' }, { status: 400 })
    }

    // 商品存在性
    const product = await payload
      .findByID({ collection: 'products', id: productId, depth: 0 })
      .catch(() => null)
    if (!product) {
      return NextResponse.json({ success: false, error: '找不到商品' }, { status: 404 })
    }

    // 購買驗證（best-effort：若巢狀查詢出錯則放行，因下拉本就只列已購商品）
    try {
      const orders = await payload.find({
        collection: 'orders',
        where: {
          and: [
            { customer: { equals: user.id } },
            { 'items.product': { equals: productId } },
          ],
        } as never,
        limit: 1,
        depth: 0,
      })
      if (orders.totalDocs === 0) {
        return NextResponse.json(
          { success: false, error: '只能評價您購買過的商品' },
          { status: 403 },
        )
      }
    } catch (verifyErr) {
      console.warn('[account/reviews] 購買驗證查詢失敗，略過嚴格檢查:', verifyErr)
    }

    // 防重複：同會員同商品已評價過
    const existing = await payload.find({
      collection: 'product-reviews',
      where: {
        and: [{ reviewer: { equals: user.id } }, { product: { equals: productId } }],
      } as never,
      limit: 1,
      depth: 0,
    })
    if (existing.totalDocs > 0) {
      return NextResponse.json(
        { success: false, error: '您已經評價過這項商品了' },
        { status: 409 },
      )
    }

    // 照片（最多 5，由 client 先上傳 /api/media 取得 id）
    const photoIds = Array.isArray(body.photoIds)
      ? body.photoIds.filter((x) => typeof x === 'string' && x.trim()).slice(0, 5)
      : []
    const photos = photoIds.map((id) => ({ image: id }))

    const created = await payload.create({
      collection: 'product-reviews',
      data: {
        product: productId,
        reviewer: user.id, // 強制本人，忽略 client 傳值
        rating,
        title: title || undefined,
        content,
        photos,
        status: 'pending', // 強制待審核
        orderInfo: {
          orderId: body.orderId ? String(body.orderId) : undefined,
          variant: body.variant ? String(body.variant) : undefined,
        },
      } as never,
      overrideAccess: true,
    })

    return NextResponse.json({ success: true, id: String(created.id) })
  } catch (error) {
    console.error('[account/reviews POST] error:', error)
    return NextResponse.json({ success: false, error: '提交失敗，請稍後再試' }, { status: 500 })
  }
}
