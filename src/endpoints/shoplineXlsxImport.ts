import type { Endpoint, PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'
import { parseShoplineXlsx, type ShoplineProduct } from '../lib/shopline/xlsxParser'
import { safeRevalidate } from '../lib/revalidate'

// Payload 的 create / update 對 data 要求嚴格 typed 形狀。我們匯入時用
// Record<string, unknown> 動態拼 data，因此需要一次統一 cast 給 Payload。
type ProductData = RequiredDataFromCollectionSlug<'products'>

/**
 * POST /api/products/shopline-xlsx
 * ────────────────────────────────
 * 直接接收 Shopline 匯出的 BulkUpdateForm.xlsx 檔案並：
 *   1. 解析為 ShoplineProduct[]（server-side ExcelJS）
 *   2. 以 `sourcing.sourceId === Shopline Product ID` 為 upsert key
 *   3. 不存在 → payload.create；存在 → payload.update
 *
 * 使用：
 *   multipart/form-data with field `file` = .xlsx
 *   query string:
 *     dryRun=1   → 僅回傳預覽（不寫入資料庫） ← 預設
 *     dryRun=0   → 實際寫入
 *     limit=N    → 最多處理 N 筆（測試用）
 *     status=draft|published|keep → 覆蓋匯入狀態；keep 沿用檔案
 *     strict=1   → dryRun 模式下若有 unmappedCategories 直接 fail（強迫補完
 *                 categoryMapping.ts 才能進到 commit）
 *     fallback=uncategorized → commit 模式：未對應分類丟去「未分類」bucket
 *                 （PR3 之前的舊行為，現在要顯式 opt-in）
 *
 * 預設 commit 模式（無 fallback flag）：未對應分類的商品該筆記成 `action:'error'`
 * 不寫入 DB，回傳 unmappedCategories 給 admin 補對照表後重跑。
 *
 * 權限：僅 admin。
 *
 * 回傳：JSON report（符合 UI 預覽與錯誤顯示所需）
 */
export const shoplineXlsxImportEndpoint: Endpoint = {
  path: '/shopline-xlsx',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!req.user || (req.user as unknown as Record<string, unknown>).role !== 'admin') {
      return Response.json({ success: false, message: '權限不足' }, { status: 403 })
    }

    const url = new URL(req.url || '', 'http://localhost')
    const dryRun = url.searchParams.get('dryRun') !== '0'
    const limitRaw = url.searchParams.get('limit')
    const limit = limitRaw ? Math.max(1, parseInt(limitRaw, 10) || 0) : 0
    const statusOverride = url.searchParams.get('status') || 'keep'
    const strict = url.searchParams.get('strict') === '1'
    const allowFallback = url.searchParams.get('fallback') === 'uncategorized'

    /* ── 取得上傳的檔案 ── */
    let buffer: Buffer
    try {
      // Payload v3 的 req 保留了原生 Request，formData() 可用
      // @ts-expect-error formData 在 PayloadRequest 上沒有型別
      const form = await req.formData()
      const file = form.get('file') as unknown as
        | (Blob & { arrayBuffer: () => Promise<ArrayBuffer>; name?: string })
        | null
      if (!file || typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== 'function') {
        return Response.json({ success: false, message: '請上傳 xlsx 檔案（欄位名 file）' }, { status: 400 })
      }
      const ab = await file.arrayBuffer()
      buffer = Buffer.from(ab)
    } catch (err) {
      return Response.json(
        { success: false, message: `檔案讀取失敗：${(err as Error).message}` },
        { status: 400 },
      )
    }

    /* ── 解析 ── */
    const report = await parseShoplineXlsx(buffer)
    if (report.globalErrors.length > 0) {
      return Response.json({ success: false, report }, { status: 400 })
    }

    const batch: ShoplineProduct[] = limit > 0 ? report.products.slice(0, limit) : report.products

    /* ── Dry-run：只回 parse report + 預覽 ── */
    if (dryRun) {
      // strict 模式：有未對應分類就 fail，逼 admin 補完 categoryMapping.ts
      // 才能進到 commit。設計動機是「分類 mapping 明確」P0 要求 — 不要默默丟
      // 進「未分類」bucket 然後 7000 個商品都在那等人手動分。
      if (strict && report.unmappedCategories.length > 0) {
        return Response.json(
          {
            success: false,
            mode: 'dry-run',
            message:
              `strict 模式啟用，且有 ${report.unmappedCategories.length} 個未對應分類。` +
              '請補完 src/lib/shopline/categoryMapping.ts 的 CATEGORY_MAP 後重跑，' +
              '或拿掉 ?strict=1 / 加 ?fallback=uncategorized 強制進到 commit。',
            unmappedCategories: report.unmappedCategories,
            totalRowsInFile: report.totalRows,
            totalProductsParsed: report.totalProducts,
          },
          { status: 422 },
        )
      }

      return Response.json({
        success: true,
        mode: 'dry-run',
        strict,
        totalRowsInFile: report.totalRows,
        totalProductsParsed: report.totalProducts,
        totalVariantsParsed: report.totalVariants,
        willProcess: batch.length,
        unmappedCategories: report.unmappedCategories,
        sample: batch.slice(0, 5).map((p) => ({
          shoplineProductId: p.shoplineProductId,
          name: p.name,
          slug: p.slug,
          price: p.price,
          salePrice: p.salePrice,
          status: p.status,
          category: { slug: p.categorySlug, name: p.categoryName },
          variantCount: p.variants.length,
          firstVariant: p.variants[0],
          stock: p.stock,
          warnings: p.warnings,
          errors: p.errors,
        })),
      })
    }

    /* ── Commit 模式：真的寫入 Payload ── */
    // 1) 預載分類 slug → id
    const catList = await req.payload.find({
      collection: 'categories',
      limit: 500,
      depth: 0,
    })
    const catBySlug = new Map<string, number>()
    for (const c of catList.docs as unknown as { id: number; slug?: string }[]) {
      if (c.slug) catBySlug.set(c.slug, c.id)
    }

    // 2) Fallback 分類處理（PR3 改：只在 ?fallback=uncategorized 才 auto-create）
    //    - 無 fallback flag：未對應分類的商品該筆 → action='error' 不寫入 DB
    //    - 有 fallback flag：恢復舊行為，缺 mapping 的丟「未分類」bucket
    let fallbackCatId: number | undefined = catBySlug.get('uncategorized')
    if (allowFallback && !fallbackCatId) {
      const created = await req.payload.create({
        collection: 'categories',
        data: { name: '未分類', slug: 'uncategorized' },
      })
      fallbackCatId = (created as unknown as { id: number }).id
      catBySlug.set('uncategorized', fallbackCatId)
    }

    const results: {
      shoplineProductId: string
      name: string
      action: 'created' | 'updated' | 'skipped' | 'error'
      id?: number
      message?: string
    }[] = []

    let created = 0
    let updated = 0
    let failed = 0

    for (const p of batch) {
      if (p.errors.length > 0) {
        failed++
        results.push({
          shoplineProductId: p.shoplineProductId,
          name: p.name,
          action: 'error',
          message: p.errors.join('; '),
        })
        continue
      }

      try {
        // 以 sourcing.sourceId 找既有商品
        const existing = await req.payload.find({
          collection: 'products',
          where: { 'sourcing.sourceId': { equals: p.shoplineProductId } },
          limit: 1,
          depth: 0,
        })

        // 分類解析：
        //   - parser 給了 categorySlug 且 catBySlug 命中 → 用該 id
        //   - parser 給了 categorySlug 但 DB 沒這條（mapping 表寫了、Categories
        //     collection 還沒建）→ fail-loud 該筆，admin 去建分類
        //   - parser 沒給 categorySlug（Shopline 該商品沒分類字串）→ 看 fallback flag
        let categoryId: number | undefined
        let categoryError: string | undefined
        if (p.categorySlug) {
          const found = catBySlug.get(p.categorySlug)
          if (found) {
            categoryId = found
          } else if (fallbackCatId) {
            categoryId = fallbackCatId
          } else {
            categoryError = `分類 slug "${p.categorySlug}" 在 Categories 找不到。請先建分類，或加 ?fallback=uncategorized 把這類丟進「未分類」bucket。`
          }
        } else if (fallbackCatId) {
          categoryId = fallbackCatId
        } else {
          categoryError = '此商品在 Shopline 無分類，且未啟用 ?fallback=uncategorized。'
        }

        if (categoryError) {
          failed++
          results.push({
            shoplineProductId: p.shoplineProductId,
            name: p.name,
            action: 'error',
            message: categoryError,
          })
          continue
        }

        const status =
          statusOverride === 'keep' ? p.status : (statusOverride as 'draft' | 'published')

        const data: Record<string, unknown> = {
          name: p.name,
          slug: existing.docs[0]
            ? ((existing.docs[0] as unknown as { slug?: string }).slug || p.slug)
            : p.slug,
          brand: p.brand,
          productSku: p.productSku,
          shortDescription: p.shortDescription,
          price: p.price,
          salePrice: p.salePrice,
          status,
          isNew: p.isNew,
          weight: p.weightGrams,
          category: categoryId,
          tags: p.tags.map((tag) => ({ tag })),
          allowPreOrder: p.allowPreOrder,
          preOrderNote: p.preOrderNote,
          variants: p.variants.map((v) => ({
            colorName: v.colorName || '預設',
            colorCode: '',
            size: v.size,
            sku: v.sku,
            stock: v.stock,
            priceOverride: v.priceOverride,
          })),
          ...(p.variants.length === 0 && typeof p.stock === 'number' ? { stock: p.stock } : {}),
          sourcing: {
            sourceId: p.sourcing.sourceId,
            supplierName: p.sourcing.supplierName,
            costTWD: p.sourcing.costTWD,
          },
          seo: {
            metaTitle: p.seo.metaTitle,
            metaDescription: p.seo.metaDescription,
          },
        }

        if (existing.docs.length > 0) {
          const updatedDoc = await req.payload.update({
            collection: 'products',
            id: existing.docs[0].id as number,
            data: data as ProductData,
          })
          updated++
          results.push({
            shoplineProductId: p.shoplineProductId,
            name: p.name,
            action: 'updated',
            id: (updatedDoc as unknown as { id: number }).id,
          })
        } else {
          const createdDoc = await req.payload.create({
            collection: 'products',
            data: data as ProductData,
          })
          created++
          results.push({
            shoplineProductId: p.shoplineProductId,
            name: p.name,
            action: 'created',
            id: (createdDoc as unknown as { id: number }).id,
          })
        }
      } catch (err) {
        failed++
        results.push({
          shoplineProductId: p.shoplineProductId,
          name: p.name,
          action: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    // 全站 revalidate（一次就好，不要每次 hook 跑）
    safeRevalidate(['/', '/products'], ['products', 'categories'])

    return Response.json({
      success: true,
      mode: 'commit',
      strictFallback: allowFallback ? 'uncategorized' : 'error',
      totalRowsInFile: report.totalRows,
      totalProductsParsed: report.totalProducts,
      processed: batch.length,
      created,
      updated,
      failed,
      unmappedCategories: report.unmappedCategories,
      results,
    })
  },
}
