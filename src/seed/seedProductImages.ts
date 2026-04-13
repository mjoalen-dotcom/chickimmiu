/**
 * 商品圖片匯入腳本
 * ─────────────────
 * 從 Shopline CDN 下載商品主圖，上傳到 Payload Media，並關聯到對應商品
 *
 * 使用方式：
 *   PAYLOAD_SECRET=xxx DATABASE_URI=file:./data/chickimmiu.db npx tsx src/seed/seedProductImages.ts
 */

import { getPayload } from 'payload'
import config from '../payload.config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Shopline image base URL pattern:
// https://img.shoplineapp.com/media/image_clips/{ID}/original.png
const SHOPLINE_IMG_BASE = 'https://img.shoplineapp.com/media/image_clips'

// Map of product name keywords → Shopline image IDs (from scraping)
// Each product gets its main cover image from the category listing
const PRODUCT_IMAGE_MAP: { slug: string; imageIds: string[]; name: string }[] = [
  { slug: 'dream-spliced-satin-bow-dress', name: 'Dream 拼接絲緞蝴蝶結洋裝', imageIds: ['69d3d8324c5226e1bcda99eb'] },
  { slug: 'colette-slim-empire-waist-elegant-dress', name: 'Colette 修身提腰氣質洋裝', imageIds: ['69d3d850293e6404cf30e5ce'] },
  { slug: 'estelle-chanel-pearl-dress', name: 'Estelle 小香珍珠洋裝', imageIds: ['69d3d83b4ef225a55ea202e5'] },
  { slug: 'myrca-refined-cropped-blazer', name: 'Myrca 精緻短版西裝外套', imageIds: ['69d3d8d557f177d12573967d'] },
  { slug: 'myrca-elegant-pleated-skort', name: 'Myrca 優雅百摺褲裙', imageIds: ['69d3d8dfa610233fa6be2386'] },
  { slug: 'bertha-urban-gold-button-lapel-blouse', name: 'Bertha 都會金釦翻領襯衫', imageIds: ['69d3e0b795013e15481a46c5'] },
  { slug: 'aria-tencel-lustrous-drape-blouse', name: 'Aria 天絲流光垂墜襯衫', imageIds: ['69d3e09495013e3cbc1a3e98'] },
  { slug: 'zenith-silky-elegant-blouse', name: 'Zenith 絲光優雅襯衫', imageIds: ['69d3dfcfa88bd56a7b620342'] },
  { slug: 'janice-vintage-coated-pencil-skirt', name: 'Janice 復古塗層鉛筆裙', imageIds: ['69d3df895b0a4341a091a6df'] },
  { slug: 'candace-clean-straight-cropped-pants', name: 'Candace 俐落直筒五分褲', imageIds: ['69d4638ebc52f133a4538558'] },
]

function downloadImage(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          file.close()
          fs.unlinkSync(destPath)
          return downloadImage(redirectUrl, destPath).then(resolve).catch(reject)
        }
      }
      if (response.statusCode !== 200) {
        file.close()
        fs.unlinkSync(destPath)
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

async function main() {
  const payload = await getPayload({ config })
  const tmpDir = path.resolve(__dirname, '../../tmp-images')
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

  console.log('🖼️  開始下載並上傳商品圖片...\n')

  let successCount = 0
  let skipCount = 0

  for (const item of PRODUCT_IMAGE_MAP) {
    // Find matching product
    const products = await payload.find({
      collection: 'products',
      where: {
        slug: { contains: item.slug },
      },
      limit: 1,
    })

    if (products.docs.length === 0) {
      // Try by name
      const byName = await payload.find({
        collection: 'products',
        where: {
          name: { contains: item.name.split(' ')[0] },
        },
        limit: 1,
      })
      if (byName.docs.length === 0) {
        console.log(`  ⚠️  找不到商品: ${item.name} (slug: ${item.slug})`)
        skipCount++
        continue
      }
      products.docs = byName.docs
    }

    const product = products.docs[0]
    const existingImages = (product as unknown as Record<string, unknown>).images as unknown[] || []

    if (existingImages.length > 0) {
      console.log(`  → ${product.name || item.name} (已有圖片，跳過)`)
      skipCount++
      continue
    }

    const mediaIds: number[] = []

    for (const imgId of item.imageIds) {
      const imgUrl = `${SHOPLINE_IMG_BASE}/${imgId}/original.png`
      const tmpFile = path.join(tmpDir, `${imgId}.png`)

      try {
        // Download image
        console.log(`  📥 下載: ${item.name} (${imgId})`)
        await downloadImage(imgUrl, tmpFile)

        // Get file stats
        const stats = fs.statSync(tmpFile)
        if (stats.size < 1000) {
          console.log(`  ⚠️  圖片太小，可能下載失敗: ${tmpFile}`)
          continue
        }

        // Upload to Payload media
        const media = await (payload.create as Function)({
          collection: 'media',
          data: {
            alt: item.name,
            caption: item.name,
          },
          filePath: tmpFile,
          file: {
            data: fs.readFileSync(tmpFile),
            mimetype: 'image/png',
            name: `${item.slug}-${imgId}.png`,
            size: stats.size,
          },
        })

        mediaIds.push(media.id)
        console.log(`  ✅ 已上傳: ${item.name} → media ID ${media.id}`)
      } catch (err: unknown) {
        console.log(`  ❌ 下載/上傳失敗: ${item.name} - ${(err as Error).message}`)
      }
    }

    // Link images to product
    if (mediaIds.length > 0) {
      try {
        await (payload.update as Function)({
          collection: 'products',
          id: product.id,
          data: {
            images: mediaIds.map((id) => ({ image: id })),
          },
        })
        console.log(`  🔗 已關聯 ${mediaIds.length} 張圖片到: ${product.name || item.name}`)
        successCount++
      } catch (err: unknown) {
        console.log(`  ❌ 關聯失敗: ${(err as Error).message}`)
      }
    }
  }

  // Clean up tmp directory
  try {
    fs.rmSync(tmpDir, { recursive: true })
  } catch {}

  console.log(`\n✅ 完成！成功: ${successCount}, 跳過: ${skipCount}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ 腳本錯誤:', e.message)
  process.exit(1)
})
