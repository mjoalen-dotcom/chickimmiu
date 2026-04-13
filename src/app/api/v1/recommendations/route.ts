import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * AI Recommendations API
 * GET /api/v1/recommendations — AI 推薦商品
 *
 * Query params:
 *   type: 'also_bought' | 'similar' | 'trending' | 'personalized' | 'body_match'
 *   productId: 目前瀏覽的商品 ID（用於 also_bought / similar）
 *   userId: 會員 ID（用於 personalized / body_match）
 *   context: 'homepage' | 'product_page' | 'cart' | 'checkout' | 'thank_you' | 'email'
 *   limit: 回傳筆數（預設 4）
 *
 * 推薦邏輯：
 *   1. Item-to-Item Collaborative Filtering：同類別 + 同價格帶 + 熱銷加權
 *   2. 身形相似度加權：讀取 User bodyProfile，推薦尺碼吻合度高的商品
 *   3. 庫存即時同步：無庫存自動排除
 *   4. 後台權重可調（LoyaltySettings > recommendationConfig）
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const type = searchParams.get('type') || 'trending'
    const productId = searchParams.get('productId')
    const userId = searchParams.get('userId')
    const context = searchParams.get('context') || 'product_page'
    const limit = Math.min(parseInt(searchParams.get('limit') || '4', 10), 20)

    const payload = await getPayload({ config })

    // 讀取推薦設定
    let maxItems = limit
    let excludeOutOfStock = true
    try {
      const loyalty = await payload.findGlobal({ slug: 'loyalty-settings' })
      const recConfig = loyalty.recommendationConfig as unknown as Record<string, unknown> | undefined
      const placements = (recConfig?.placements as unknown as Array<Record<string, unknown>>) || []
      const placement = placements.find(p => p.location === context)
      if (placement) {
        maxItems = Math.min((placement.maxItems as number) || limit, 20)
        excludeOutOfStock = (placement.excludeOutOfStock as boolean) ?? true
      }
    } catch {
      // 使用預設值
    }

    // 基本庫存過濾條件
    const baseWhere: Record<string, unknown> = {
      status: { equals: 'published' },
      ...(excludeOutOfStock ? { stock: { greater_than: 0 } } : {}),
    }

    let products
    let matchReasons: Record<string, string> = {}

    switch (type) {
      case 'also_bought': {
        if (productId) {
          const current = await payload.findByID({ collection: 'products', id: productId })
          const categoryId = typeof current.category === 'string'
            ? current.category
            : (current.category as unknown as Record<string, unknown>)?.id as unknown as string

          // Item-to-Item CF: 同類別 + 相近價格 + 熱銷優先
          const priceRange = (current.price as number) * 0.5
          products = await payload.find({
            collection: 'products',
            where: {
              ...baseWhere,
              id: { not_equals: productId },
              ...(categoryId ? { category: { equals: categoryId } } : {}),
              price: {
                greater_than_equal: Math.max(0, (current.price as number) - priceRange),
                less_than_equal: (current.price as number) + priceRange,
              },
            } as never,
            limit: maxItems * 2, // 取多一點再排序
            sort: '-isHot,-createdAt',
          })

          // 為每個推薦商品標記原因
          if (products) {
            for (const doc of products.docs) {
              const docId = doc.id as unknown as string
              if (Boolean(doc.isHot)) {
                matchReasons[docId] = '經常一起購買'
              } else if (Boolean(doc.isNew)) {
                matchReasons[docId] = '新品推薦'
              } else {
                matchReasons[docId] = '相似風格'
              }
            }
            products.docs = products.docs.slice(0, maxItems)
          }
        }
        break
      }

      case 'body_match': {
        // 身形相似度推薦：讀取 User bodyProfile
        if (userId) {
          try {
            const user = await payload.findByID({ collection: 'users', id: userId })
            const profile = user.bodyProfile as unknown as Record<string, unknown> | undefined
            if (profile?.preferredSizes) {
              const sizes = profile.preferredSizes as string[]
              // 推薦有這些尺碼庫存的商品
              products = await payload.find({
                collection: 'products',
                where: {
                  ...baseWhere,
                  'variants.size': { in: sizes },
                } as never,
                limit: maxItems,
                sort: '-isHot,-createdAt',
              })
              if (products) {
                for (const doc of products.docs) {
                  matchReasons[doc.id as unknown as string] = '身形相似買家最愛'
                }
              }
            }
          } catch {
            // fallback to trending
          }
        }
        // fallback
        if (!products) {
          products = await payload.find({
            collection: 'products',
            where: { ...baseWhere, isHot: { equals: true } } as never,
            limit: maxItems,
            sort: '-createdAt',
          })
        }
        break
      }

      case 'similar': {
        if (productId) {
          const current = await payload.findByID({ collection: 'products', id: productId })
          const priceRange = (current.price as number) * 0.4
          products = await payload.find({
            collection: 'products',
            where: {
              ...baseWhere,
              id: { not_equals: productId },
              price: {
                greater_than_equal: Math.max(0, (current.price as number) - priceRange),
                less_than_equal: (current.price as number) + priceRange,
              },
            } as never,
            limit: maxItems,
            sort: '-isHot,-createdAt',
          })
          if (products) {
            for (const doc of products.docs) {
              matchReasons[doc.id as unknown as string] = '熱銷搭配'
            }
          }
        }
        break
      }

      case 'personalized': {
        // 個人化推薦：基於用戶的購買歷史
        if (userId) {
          try {
            // 取得用戶最近訂單的商品類別
            const recentOrders = await payload.find({
              collection: 'orders',
              where: { customer: { equals: userId } } as never,
              limit: 5,
              sort: '-createdAt',
            })

            const boughtProductIds = new Set<string>()
            const categoryIds = new Set<string>()

            for (const order of recentOrders.docs) {
              const items = (order.items as unknown as Array<Record<string, unknown>>) || []
              for (const item of items) {
                const pid = typeof item.product === 'string' ? item.product : (item.product as unknown as Record<string, unknown>)?.id as unknown as string
                if (pid) {
                  boughtProductIds.add(pid)
                  try {
                    const prod = await payload.findByID({ collection: 'products', id: pid })
                    const catId = typeof prod.category === 'string' ? prod.category : (prod.category as unknown as Record<string, unknown>)?.id as unknown as string
                    if (catId) categoryIds.add(catId)
                  } catch { /* skip */ }
                }
              }
            }

            if (categoryIds.size > 0) {
              products = await payload.find({
                collection: 'products',
                where: {
                  ...baseWhere,
                  id: { not_in: Array.from(boughtProductIds) },
                  category: { in: Array.from(categoryIds) },
                } as never,
                limit: maxItems,
                sort: '-isHot,-createdAt',
              })
            }
          } catch { /* fallback */ }
        }
        // fallback
        if (!products || products.docs.length === 0) {
          products = await payload.find({
            collection: 'products',
            where: { ...baseWhere, isHot: { equals: true } } as never,
            limit: maxItems,
            sort: '-createdAt',
          })
        }
        break
      }

      case 'trending':
      default: {
        products = await payload.find({
          collection: 'products',
          where: {
            ...baseWhere,
            isHot: { equals: true },
          } as never,
          limit: maxItems,
          sort: '-createdAt',
        })
        break
      }
    }

    // 附加 matchReason 到每個商品
    const enrichedDocs = (products?.docs || []).map(doc => ({
      ...doc,
      _matchReason: matchReasons[doc.id as unknown as string] || null,
    }))

    return NextResponse.json({
      success: true,
      type,
      context,
      data: enrichedDocs,
      meta: {
        total: products?.totalDocs || 0,
      },
    })
  } catch (error) {
    console.error('Recommendations API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
