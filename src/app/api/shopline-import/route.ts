/**
 * Shopline 商品批量匯入 API
 * POST /api/shopline-import
 * 接收解析後的商品 JSON，寫入 Payload CMS 資料庫
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { ParsedProduct } from '@/lib/shopline/csvParser'

interface ImportResult {
  success: number
  failed: number
  skipped: number
  details: {
    name: string
    status: 'created' | 'updated' | 'skipped' | 'error'
    message?: string
    id?: number
  }[]
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // 驗證登入狀態（需要 admin 或 partner 權限）
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || (user.role !== 'admin' && user.role !== 'partner')) {
      return NextResponse.json({ error: '需要管理員權限' }, { status: 401 })
    }

    const body = await req.json()
    const { products, mode = 'create' } = body as {
      products: ParsedProduct[]
      mode: 'create' | 'update' | 'skip-existing'
    }

    if (!products || !Array.isArray(products)) {
      return NextResponse.json({ error: '無效的商品資料' }, { status: 400 })
    }

    // 預載所有分類（建立 slug → id 映射）
    const catResult = await payload.find({
      collection: 'categories',
      limit: 200,
      depth: 0,
    })
    const categoryMap = new Map<string, number>()
    for (const cat of catResult.docs) {
      const slug = (cat as unknown as Record<string, unknown>).slug as string
      categoryMap.set(slug, cat.id as number)
    }

    const result: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      details: [],
    }

    for (const product of products) {
      try {
        // 檢查是否已存在（用名稱比對）
        const existing = await payload.find({
          collection: 'products',
          where: { name: { equals: product.name } },
          limit: 1,
          depth: 0,
        })

        if (existing.docs.length > 0) {
          if (mode === 'skip-existing') {
            result.skipped++
            result.details.push({ name: product.name, status: 'skipped', message: '已存在' })
            continue
          }
          if (mode === 'create') {
            result.skipped++
            result.details.push({ name: product.name, status: 'skipped', message: '已存在（模式: 僅新增）' })
            continue
          }
          // mode === 'update' → 更新現有商品
        }

        // 解析分類 ID
        const categoryId = product.categorySlug ? categoryMap.get(product.categorySlug) : null
        if (!categoryId) {
          // 嘗試用 'all-products' 作為預設
          const fallbackId = categoryMap.get('all-products') || categoryMap.get('new-arrival')
          if (!fallbackId) {
            result.failed++
            result.details.push({ name: product.name, status: 'error', message: `找不到分類: ${product.categorySlug}` })
            continue
          }
        }
        const finalCategoryId = categoryId || categoryMap.get('all-products') || 1

        // 生成 slug
        const slug = product.name
          .toLowerCase()
          .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .substring(0, 80) + '-' + Date.now().toString(36).slice(-4)

        // 組裝 Payload 資料
        const productData: Record<string, unknown> = {
          name: product.name,
          slug,
          description: product.full_description ? {
            root: {
              type: 'root',
              children: [{
                type: 'paragraph',
                children: [{ type: 'text', text: product.full_description, version: 1 }],
                version: 1,
              }],
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
            },
          } : undefined,
          price: product.original_price_ntd || product.price_ntd,
          salePrice: product.price_ntd !== product.original_price_ntd ? product.price_ntd : undefined,
          category: finalCategoryId,
          tags: product.tags.map(tag => ({ tag })),
          weight: product.weight_kg ? Math.round(product.weight_kg * 1000) : undefined,
          status: 'draft', // 匯入後先為草稿
          isNew: product.tags.some(t => t.includes('NEW') || t.includes('new')),
          seo: {
            metaTitle: product.seo_title || product.name,
            metaDescription: product.seo_description || product.short_desc,
          },
          variants: product.variants.map(v => ({
            colorName: v.color || '預設',
            colorCode: '',
            size: v.size || 'Free',
            sku: v.sku || slug,
            stock: v.stock || 0,
            priceOverride: v.price !== product.price_ntd ? v.price : undefined,
          })),
        }

        if (existing.docs.length > 0 && mode === 'update') {
          // 更新
          await (payload.update as Function)({
            collection: 'products',
            id: existing.docs[0].id,
            data: productData,
          })
          result.success++
          result.details.push({
            name: product.name,
            status: 'updated',
            id: existing.docs[0].id as number,
          })
        } else {
          // 新增
          const created = await (payload.create as Function)({
            collection: 'products',
            data: productData,
          })
          result.success++
          result.details.push({
            name: product.name,
            status: 'created',
            id: created.id,
          })
        }
      } catch (err: unknown) {
        result.failed++
        result.details.push({
          name: product.name,
          status: 'error',
          message: (err as Error).message,
        })
      }
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('Shopline import error:', err)
    return NextResponse.json(
      { error: (err as Error).message || '匯入失敗' },
      { status: 500 }
    )
  }
}
