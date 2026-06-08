import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getUserWishlist } from '@/lib/wishlist/server'

/**
 * POST /api/account/wishlist/merge  { productIds: string[] }
 * ─────────────────────────────────────────────────────────
 * 登入時把 localStorage 既有收藏合併進 DB（取聯集），回傳合併後的完整清單
 * （含商品資料）讓 client 以 DB 為準回填 zustand store，達成跨裝置一致。
 *
 * 冪等：已在 DB 的略過；只建立 DB 缺、且商品確實存在者。
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_MERGE = 200

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as { productIds?: unknown }
    const incoming = Array.isArray(body.productIds) ? body.productIds : []
    const productIds = Array.from(
      new Set(
        incoming
          .map((x) => String(x || '').trim())
          .filter((x) => x && /^[0-9a-zA-Z]+$/.test(x)),
      ),
    ).slice(0, MAX_MERGE)

    if (productIds.length > 0) {
      // 已在收藏內的 product id（避免重複建立）
      const existingRes = await payload.find({
        collection: 'wishlist-items',
        where: { user: { equals: user.id } },
        limit: 1000,
        depth: 0,
      })
      const alreadyHave = new Set(
        existingRes.docs.map((d) => {
          const p = d.product
          return typeof p === 'object' && p !== null
            ? String((p as { id: unknown }).id)
            : String(p)
        }),
      )

      // 哪些 id 對應的商品真的存在（一次查詢驗證）
      const validRes = await payload.find({
        collection: 'products',
        where: { id: { in: productIds } },
        limit: MAX_MERGE,
        depth: 0,
      })
      const validIds = new Set(validRes.docs.map((p) => String(p.id)))

      const toAdd = productIds.filter((id) => validIds.has(id) && !alreadyHave.has(id))
      for (const productId of toAdd) {
        try {
          await payload.create({
            collection: 'wishlist-items',
            data: { user: user.id, product: productId } as never,
          })
        } catch (e) {
          // 競態下可能撞唯一索引（user+product），忽略即可
          console.warn('[wishlist/merge] create skipped:', productId, e)
        }
      }
    }

    const items = await getUserWishlist(payload, user.id)
    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error('[account/wishlist/merge POST] error:', error)
    return NextResponse.json({ success: false, error: '同步失敗' }, { status: 500 })
  }
}
