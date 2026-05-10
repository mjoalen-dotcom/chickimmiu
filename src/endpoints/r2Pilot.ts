import type { Endpoint, PayloadRequest } from 'payload'

/**
 * POST /api/products/r2-pilot
 * ───────────────────────────
 * automation P0 PR3 配套 — 把 1 顆商品的 1-5 張圖直寫 R2，回傳每張圖的 latency
 * 與最終 URL，給 admin 在「跑全 7226 個商品」之前先驗 R2 wiring + 觀察 PDP 速度。
 *
 * 流程：
 *   1. 收 admin 給的 productSlugOrId + imageUrls（最多 5 個）
 *   2. 找對應 product
 *   3. 對每張 URL：
 *      - HTTP GET 抓圖（追 redirects、檢查大小）
 *      - payload.create({ collection: 'media', file: {...} })
 *        → 透過 PR1 的 s3Storage plugin 直接寫到 R2 bucket
 *        （沒設 R2 env 時 fallback 到 public/media，pilot 仍會跑但 latency 反映 local）
 *      - 計時：抓圖 / 上傳 / 總計
 *   4. 把 5 張新 mediaId append 到 product.images（不覆蓋既有）
 *   5. 標 imageMigration.status='done'（PR2 加的欄位）
 *
 * Body:
 *   {
 *     productSlugOrId: string | number,  // 找商品用
 *     imageUrls: string[],               // 最多 5 個 https URL
 *   }
 *
 * Response:
 *   {
 *     success: boolean,
 *     productId: number,
 *     pdpUrl: string,           // 給 admin 直接點開驗 PDP load
 *     totalElapsedMs: number,
 *     results: [{
 *       url: string,
 *       success: boolean,
 *       mediaId?: number,
 *       mediaFilename?: string,
 *       sizeBytes?: number,
 *       fetchMs?: number,
 *       uploadMs?: number,
 *       error?: string,
 *     }]
 *   }
 *
 * 權限：僅 admin。
 */

const MAX_URLS = 5
const MAX_BYTES = 8 * 1024 * 1024 // 8MB（與 Media.ts MAX_IMAGE 一致）

async function fetchImage(url: string, timeoutMs = 30000): Promise<{
  data: Buffer
  contentType: string
  fetchMs: number
}> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }
    const ct = res.headers.get('content-type') || 'application/octet-stream'
    if (!ct.startsWith('image/')) {
      throw new Error(`非圖片 content-type: ${ct}`)
    }
    const ab = await res.arrayBuffer()
    if (ab.byteLength > MAX_BYTES) {
      throw new Error(`檔案過大 ${(ab.byteLength / 1024 / 1024).toFixed(1)}MB > 8MB`)
    }
    return {
      data: Buffer.from(ab),
      contentType: ct,
      fetchMs: Date.now() - started,
    }
  } finally {
    clearTimeout(timer)
  }
}

function extFromContentType(ct: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  return map[ct.split(';')[0].trim()] || 'jpg'
}

export const r2PilotEndpoint: Endpoint = {
  path: '/r2-pilot',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!req.user || (req.user as unknown as Record<string, unknown>).role !== 'admin') {
      return Response.json({ success: false, message: '權限不足' }, { status: 403 })
    }

    let body: { productSlugOrId?: string | number; imageUrls?: string[] }
    try {
      body = (await req.json?.()) || {}
    } catch {
      return Response.json({ success: false, message: '請傳 JSON body' }, { status: 400 })
    }

    const { productSlugOrId, imageUrls } = body
    if (!productSlugOrId) {
      return Response.json(
        { success: false, message: '需要 productSlugOrId（商品 slug 或數字 id）' },
        { status: 400 },
      )
    }
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return Response.json(
        { success: false, message: '需要 imageUrls 陣列（1-5 個 https URL）' },
        { status: 400 },
      )
    }
    if (imageUrls.length > MAX_URLS) {
      return Response.json(
        { success: false, message: `pilot 最多 ${MAX_URLS} 張，避免一次燒太多 R2 quota` },
        { status: 400 },
      )
    }

    /* ── 找商品 ── */
    type ProductLite = { id: number; slug?: string; images?: unknown[] }
    let productDoc: ProductLite | null = null
    if (typeof productSlugOrId === 'number' || /^\d+$/.test(String(productSlugOrId))) {
      try {
        const found = await req.payload.findByID({
          collection: 'products',
          id: Number(productSlugOrId),
          depth: 0,
        })
        productDoc = found as unknown as ProductLite
      } catch {
        // continue to slug lookup
      }
    }
    if (!productDoc) {
      const found = await req.payload.find({
        collection: 'products',
        where: { slug: { equals: String(productSlugOrId) } },
        limit: 1,
        depth: 0,
      })
      if (found.docs.length > 0) {
        productDoc = found.docs[0] as unknown as ProductLite
      }
    }
    if (!productDoc) {
      return Response.json(
        { success: false, message: `找不到商品：${productSlugOrId}` },
        { status: 404 },
      )
    }
    // 給後續 closure 用 — non-null narrowed alias
    const product: ProductLite = productDoc

    /* ── 對每張 URL 跑 fetch + create media ── */
    const startedAll = Date.now()
    type PilotResult = {
      url: string
      success: boolean
      mediaId?: number
      mediaFilename?: string
      sizeBytes?: number
      fetchMs?: number
      uploadMs?: number
      error?: string
    }
    const results: PilotResult[] = []
    const newMediaIds: number[] = []

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i]
      try {
        const { data, contentType, fetchMs } = await fetchImage(url)
        const ext = extFromContentType(contentType)
        const filename = `r2-pilot-${product.id}-${Date.now()}-${i + 1}.${ext}`

        const uploadStarted = Date.now()
        const media = await req.payload.create({
          collection: 'media',
          data: { alt: `pilot ${i + 1}`, caption: '' },
          file: {
            data,
            mimetype: contentType.split(';')[0].trim(),
            name: filename,
            size: data.byteLength,
          },
        })
        const uploadMs = Date.now() - uploadStarted

        const mediaRec = media as unknown as { id: number; filename?: string }
        newMediaIds.push(mediaRec.id)
        results.push({
          url,
          success: true,
          mediaId: mediaRec.id,
          mediaFilename: mediaRec.filename,
          sizeBytes: data.byteLength,
          fetchMs,
          uploadMs,
        })
      } catch (err) {
        results.push({
          url,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    /* ── append 新圖到商品 ── */
    // 僅 append images。imageMigration.status 由 PR2 的 /api/migrate-images 寫，
    // 此 pilot 故意不碰那個欄位以維持 PR3 對 main 的 standalone（PR2 沒 merge
    // 也能跑）。
    if (newMediaIds.length > 0) {
      const existingImages = (product.images as { image?: number | { id?: number } }[]) || []
      const existingIds = existingImages
        .map((img) =>
          typeof img.image === 'number' ? img.image : (img.image as { id?: number })?.id,
        )
        .filter((id): id is number => typeof id === 'number')
      const merged = [...existingIds, ...newMediaIds].map((id) => ({ image: id }))

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await req.payload.update({
          collection: 'products',
          id: product.id,
          data: { images: merged } as any,
        })
      } catch (err) {
        console.error('[r2Pilot] product update failed:', err)
      }
    }

    const totalElapsedMs = Date.now() - startedAll
    const successCount = results.filter((r) => r.success).length

    return Response.json({
      success: successCount > 0,
      productId: product.id,
      productSlug: product.slug,
      pdpUrl: product.slug ? `/products/${product.slug}` : null,
      totalElapsedMs,
      successCount,
      failCount: results.length - successCount,
      results,
    })
  },
}
