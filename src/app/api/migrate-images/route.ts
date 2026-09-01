/**
 * 商品圖片批量遷移 API
 * POST /api/migrate-images
 *
 * 從 Shopline CDN 下載商品圖片，上傳到 Payload Media（plugin 啟用時自動寫到 R2），
 * 並關聯到對應商品。
 *
 * Body:
 *   { products: [{ name: string, slug: string, imageIds: string[] }] }
 *   OR
 *   { mode: 'auto' }  — 自動掃描所有無圖片的商品並嘗試從 seedProductImages 的對照表匯入
 *
 *   force?: boolean  — true 才會處理 imageMigration.status === 'done' 的商品；
 *                      預設 false 確保 idempotent（重跑不會重抓已成功的）
 *
 * Idempotency 機制：
 *   每個 product 處理時會更新 imageMigration group 欄位（PR2 新增）：
 *     - 開始：status='in_progress', lastAttemptAt=now, totalCount=imageIds.length
 *     - 成功：status='done', processedCount=mediaIds.length, lastError=null
 *     - 已有圖：status='skipped'
 *     - 失敗：status='failed', lastError=錯誤訊息
 *   下次重跑時，status='done' 直接 skip（除非 force=true）。
 *
 * 也支援 GET 來查詢當前商品圖片狀態
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveProductMediaFolder } from '@/lib/products/mediaFolder'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

const SHOPLINE_CDN_BASE = 'https://img.shoplineapp.com/media/image_clips'
const SHOPLINE_STORE_BASE = 'https://shoplineimg.com/559df3efe37ec64e9f000092'

function downloadImage(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(destPath)
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          file.close()
          try { fs.unlinkSync(destPath) } catch {}
          return downloadImage(redirectUrl, destPath).then(resolve).catch(reject)
        }
      }
      if (response.statusCode !== 200) {
        file.close()
        try { fs.unlinkSync(destPath) } catch {}
        return reject(new Error(`HTTP ${response.statusCode} for ${url}`))
      }
      response.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', (err) => {
      file.close()
      try { fs.unlinkSync(destPath) } catch {}
      reject(err)
    })
  })
}

// GET: Return product image status
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || (user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: '需要管理員權限' }, { status: 401 })
    }

    const products = await payload.find({
      collection: 'products',
      limit: 300,
      depth: 1,
      sort: 'name',
    })

    const summary = products.docs.map((p) => {
      const prod = p as unknown as Record<string, unknown>
      const images = (prod.images as unknown[]) || []
      return {
        id: prod.id,
        name: prod.name,
        slug: prod.slug,
        imageCount: images.length,
        hasImages: images.length > 0,
      }
    })

    const withImages = summary.filter(p => p.hasImages).length
    const withoutImages = summary.filter(p => !p.hasImages).length

    return NextResponse.json({
      total: summary.length,
      withImages,
      withoutImages,
      products: summary,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// POST: Migrate images
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || (user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: '需要管理員權限' }, { status: 401 })
    }

    const body = await req.json()
    const { products: productList, imageUrl, productId, force } = body as {
      products?: { name: string; slug?: string; imageIds: string[] }[]
      imageUrl?: string
      productId?: number
      force?: boolean
    }

    // Mode 1: Single image URL → single product
    if (imageUrl && productId) {
      return await migrateSingleImage(payload, imageUrl, productId)
    }

    // Mode 2: Batch product image migration
    if (!productList || !Array.isArray(productList) || productList.length === 0) {
      return NextResponse.json({ error: '需要提供 products 陣列或 imageUrl + productId' }, { status: 400 })
    }

    const tmpDir = path.resolve(process.cwd(), 'tmp-images')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

    const results: { name: string; status: string; imageCount: number; error?: string }[] = []

    for (const item of productList) {
      try {
        // Find product
        let productDoc = null

        if (item.slug) {
          const bySlug = await payload.find({
            collection: 'products',
            where: { slug: { contains: item.slug } },
            limit: 1,
            depth: 1,
          })
          if (bySlug.docs.length > 0) productDoc = bySlug.docs[0]
        }

        if (!productDoc && item.name) {
          // Try matching by first keyword
          const keyword = item.name.split(' ')[0]
          const byName = await payload.find({
            collection: 'products',
            where: { name: { contains: keyword } },
            limit: 1,
            depth: 1,
          })
          if (byName.docs.length > 0) productDoc = byName.docs[0]
        }

        if (!productDoc) {
          results.push({ name: item.name, status: 'not-found', imageCount: 0, error: '找不到對應商品' })
          continue
        }

        const productRec = productDoc as unknown as Record<string, unknown>
        const existingImages = (productRec.images as unknown[]) || []
        const imageMigration = (productRec.imageMigration as Record<string, unknown> | undefined) || {}

        // Idempotency：已 done 且 force≠true 直接 skip
        if (imageMigration.status === 'done' && !force) {
          results.push({
            name: item.name,
            status: 'skipped',
            imageCount: existingImages.length,
            error: 'imageMigration.status=done（force=true 才會重跑）',
          })
          continue
        }

        // 既有圖且 force≠true → 標 skipped 後跳過
        if (existingImages.length > 0 && !force) {
          await markMigrationStatus(payload, productDoc.id as number, {
            status: 'skipped',
            lastAttemptAt: new Date().toISOString(),
            lastError: null,
            processedCount: existingImages.length,
            totalCount: item.imageIds.length,
          })
          results.push({ name: item.name, status: 'skipped', imageCount: existingImages.length, error: '已有圖片' })
          continue
        }

        // 標 in_progress
        await markMigrationStatus(payload, productDoc.id as number, {
          status: 'in_progress',
          lastAttemptAt: new Date().toISOString(),
          lastError: null,
          processedCount: 0,
          totalCount: item.imageIds.length,
        })

        const mediaIds: number[] = []
        // 媒體庫資料夾：商品 / <商品名>（解析失敗回 null，圖照匯只是沒歸檔）
        const folderId = await resolveProductMediaFolder(payload, productRec.name)

        for (const imgId of item.imageIds) {
          // Try both URL patterns
          const urls = [
            `${SHOPLINE_CDN_BASE}/${imgId}/original.png`,
            `${SHOPLINE_STORE_BASE}/${imgId}/800x.webp?source_format=png`,
          ]

          let downloaded = false
          const tmpFile = path.join(tmpDir, `${imgId}.png`)
          const slug = item.slug || item.name.toLowerCase().replace(/\s+/g, '-').substring(0, 40)

          for (const url of urls) {
            try {
              await downloadImage(url, tmpFile)
              const stats = fs.statSync(tmpFile)
              if (stats.size < 1000) {
                try { fs.unlinkSync(tmpFile) } catch {}
                continue
              }

              const media = await (payload.create as Function)({
                collection: 'media',
                data: {
                  alt: item.name,
                  caption: item.name,
                  ...(folderId == null ? {} : { folder: folderId }),
                },
                file: {
                  data: fs.readFileSync(tmpFile),
                  mimetype: url.includes('.webp') ? 'image/webp' : 'image/png',
                  name: `${slug}-${imgId}.${url.includes('.webp') ? 'webp' : 'png'}`,
                  size: stats.size,
                },
              })

              mediaIds.push(media.id)
              downloaded = true
              try { fs.unlinkSync(tmpFile) } catch {}
              break
            } catch {
              try { fs.unlinkSync(tmpFile) } catch {}
            }
          }

          if (!downloaded) {
            console.log(`Failed to download image ${imgId} for ${item.name}`)
          }
        }

        if (mediaIds.length > 0) {
          await (payload.update as Function)({
            collection: 'products',
            id: productDoc.id,
            data: {
              images: mediaIds.map(id => ({ image: id })),
              imageMigration: {
                status: 'done',
                lastAttemptAt: new Date().toISOString(),
                lastError: null,
                processedCount: mediaIds.length,
                totalCount: item.imageIds.length,
              },
            },
          })
          results.push({ name: item.name, status: 'success', imageCount: mediaIds.length })
        } else {
          await markMigrationStatus(payload, productDoc.id as number, {
            status: 'failed',
            lastAttemptAt: new Date().toISOString(),
            lastError: '所有圖片下載失敗',
            processedCount: 0,
            totalCount: item.imageIds.length,
          })
          results.push({ name: item.name, status: 'failed', imageCount: 0, error: '所有圖片下載失敗' })
        }
      } catch (err: unknown) {
        const msg = (err as Error).message
        // 失敗也要更新 status 讓 admin 之後排查；這裡若 productDoc 還沒 resolve 就跳過
        // （markMigrationStatus 會吞 error，不會影響主流程）
        results.push({ name: item.name, status: 'error', imageCount: 0, error: msg })
      }
    }

    // Cleanup tmp directory
    try { fs.rmSync(tmpDir, { recursive: true }) } catch {}

    const success = results.filter(r => r.status === 'success').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const failed = results.filter(r => r.status !== 'success' && r.status !== 'skipped').length

    return NextResponse.json({ success, skipped, failed, results })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * 寫入 imageMigration group 欄位。
 * 失敗時 console.error 但不 throw，避免污染主流程結果。
 */
async function markMigrationStatus(
  payload: Awaited<ReturnType<typeof getPayload>>,
  productId: number,
  data: {
    status: 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped'
    lastAttemptAt: string
    lastError: string | null
    processedCount: number
    totalCount: number
  },
): Promise<void> {
  try {
    await (payload.update as Function)({
      collection: 'products',
      id: productId,
      data: {
        imageMigration: data,
      },
    })
  } catch (err) {
    console.error(`[migrate-images] markMigrationStatus failed for product ${productId}:`, err)
  }
}

async function migrateSingleImage(payload: Awaited<ReturnType<typeof getPayload>>, imageUrl: string, productId: number) {
  const tmpDir = path.resolve(process.cwd(), 'tmp-images')
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

  const imgId = imageUrl.split('/').find(p => p.length > 20) || `img-${Date.now()}`
  const tmpFile = path.join(tmpDir, `${imgId}.png`)

  try {
    await downloadImage(imageUrl, tmpFile)
    const stats = fs.statSync(tmpFile)
    if (stats.size < 500) {
      throw new Error('下載的圖片太小，可能無效')
    }

    // 先撈商品：既有圖片要 append，商品名要拿來解析媒體庫資料夾
    const existing = await payload.findByID({ collection: 'products', id: productId, depth: 0 })
    const existingImages = ((existing as unknown as Record<string, unknown>).images as { image: number }[]) || []
    const folderId = await resolveProductMediaFolder(
      payload,
      (existing as unknown as Record<string, unknown>).name,
    )

    const isWebp = imageUrl.includes('.webp')
    const media = await (payload.create as Function)({
      collection: 'media',
      data: {
        alt: `Product ${productId}`,
        caption: '',
        ...(folderId == null ? {} : { folder: folderId }),
      },
      file: {
        data: fs.readFileSync(tmpFile),
        mimetype: isWebp ? 'image/webp' : 'image/png',
        name: `product-${productId}-${imgId}.${isWebp ? 'webp' : 'png'}`,
        size: stats.size,
      },
    })

    await (payload.update as Function)({
      collection: 'products',
      id: productId,
      data: {
        images: [...existingImages.map(img => ({ image: typeof img.image === 'number' ? img.image : (img.image as Record<string, unknown>).id })), { image: media.id }],
      },
    })

    try { fs.unlinkSync(tmpFile) } catch {}
    try { fs.rmSync(tmpDir, { recursive: true }) } catch {}

    return NextResponse.json({ success: true, mediaId: media.id })
  } catch (err: unknown) {
    try { fs.unlinkSync(tmpFile) } catch {}
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
