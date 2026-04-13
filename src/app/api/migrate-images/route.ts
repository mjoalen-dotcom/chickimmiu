/**
 * 商品圖片批量遷移 API
 * POST /api/migrate-images
 *
 * 從 Shopline CDN 下載商品圖片，上傳到 Payload Media，並關聯到對應商品。
 *
 * Body:
 *   { products: [{ name: string, slug: string, imageIds: string[] }] }
 *   OR
 *   { mode: 'auto' }  — 自動掃描所有無圖片的商品並嘗試從 seedProductImages 的對照表匯入
 *
 * 也支援 GET 來查詢當前商品圖片狀態
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
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
    if (!user || user.role !== 'admin') {
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
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理員權限' }, { status: 401 })
    }

    const body = await req.json()
    const { products: productList, imageUrl, productId } = body as {
      products?: { name: string; slug?: string; imageIds: string[] }[]
      imageUrl?: string
      productId?: number
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

        const existingImages = ((productDoc as unknown as Record<string, unknown>).images as unknown[]) || []
        if (existingImages.length > 0) {
          results.push({ name: item.name, status: 'skipped', imageCount: existingImages.length, error: '已有圖片' })
          continue
        }

        const mediaIds: number[] = []

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
            },
          })
          results.push({ name: item.name, status: 'success', imageCount: mediaIds.length })
        } else {
          results.push({ name: item.name, status: 'failed', imageCount: 0, error: '所有圖片下載失敗' })
        }
      } catch (err: unknown) {
        results.push({ name: item.name, status: 'error', imageCount: 0, error: (err as Error).message })
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

    const isWebp = imageUrl.includes('.webp')
    const media = await (payload.create as Function)({
      collection: 'media',
      data: { alt: `Product ${productId}`, caption: '' },
      file: {
        data: fs.readFileSync(tmpFile),
        mimetype: isWebp ? 'image/webp' : 'image/png',
        name: `product-${productId}-${imgId}.${isWebp ? 'webp' : 'png'}`,
        size: stats.size,
      },
    })

    // Get existing images
    const existing = await payload.findByID({ collection: 'products', id: productId, depth: 0 })
    const existingImages = ((existing as unknown as Record<string, unknown>).images as { image: number }[]) || []

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
