import { NextRequest, NextResponse } from 'next/server'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { suggestPersonalityTypes, type ProductLikeForRecommend } from '@/lib/games/mbtiAutoRecommend'

/**
 * POST /api/games/mbti/suggest-product-types
 * Body: { name?, description?, tags?, collectionTags?, category?, productId? }
 * Auth: admin only（給後台「🤖 自動推薦」按鈕用）
 *
 * 若帶 productId，會從 DB 補抓最新欄位再算（更準確）。
 * 否則直接用 body 內容算（適合新建尚未存的商品）。
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const headers = await nextHeaders()
    const { user } = await payload.auth({ headers })

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: '僅限後台管理員使用' },
        { status: 403 },
      )
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    let productData: ProductLikeForRecommend = {
      name: body.name as string | undefined,
      description: body.description,
      tags: body.tags as Array<{ tag?: string | null }> | undefined,
      collectionTags: body.collectionTags as string[] | undefined,
      category: body.category as ProductLikeForRecommend['category'],
    }

    // 若帶 productId 改從 DB 抓最新（admin 編輯既有商品的場景）
    if (body.productId != null) {
      try {
        const prod = await payload.findByID({
          collection: 'products',
          id: body.productId as number,
          depth: 1,
        }) as unknown as Record<string, unknown>
        productData = {
          name: prod.name as string | undefined,
          description: prod.description,
          tags: prod.tags as Array<{ tag?: string | null }> | undefined,
          collectionTags: prod.collectionTags as string[] | undefined,
          category: prod.category as ProductLikeForRecommend['category'],
        }
      } catch {
        // findByID 失敗就退回 body 內容
      }
    }

    const suggested = suggestPersonalityTypes(productData)

    return NextResponse.json({ success: true, suggested })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json(
      { success: false, message: `自動推薦失敗：${message}` },
      { status: 500 },
    )
  }
}
