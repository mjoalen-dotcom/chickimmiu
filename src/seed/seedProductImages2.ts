/**
 * 商品圖片匯入腳本 — 第二批（10 個）
 * ──────────────────────────────────
 * 從 Shopline CDN 下載商品圖片，上傳到 Payload Media，關聯到對應商品
 * 使用 Shopline 分類頁面擷取的 image_clips ID
 *
 * PAYLOAD_SECRET=ckmu-dev-secret-2024 DATABASE_URI=file:./data/chickimmiu.db npx tsx src/seed/seedProductImages2.ts
 */

import { getPayload } from 'payload'
import config from '../payload.config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SHOPLINE_IMG_BASE = 'https://img.shoplineapp.com/media/image_clips'

// Batch 2: Mapped from Shopline category pages → our DB product names
// Format: { dbName: first few chars to match, imageId: Shopline image_clips ID }
const BATCH: { dbName: string; imageId: string }[] = [
  // Dresses (from dress-in-stock category)
  { dbName: 'Kaitlin', imageId: '699fee591feece5b7ccf35c5' },
  { dbName: 'Veronica', imageId: '69084e656967e5000aacc182' },
  { dbName: 'Deirdre', imageId: '6912922f760b31000c033b8d' },
  { dbName: 'Madeline', imageId: '68ff35ac87202c000e5407cc' },
  { dbName: 'Anila', imageId: '695b8109c1571558f4d2ed2a' },
  // Tops (from top-1 category)
  { dbName: 'Peyton', imageId: '68ff48c84dc566000e9a3d0b' },
  { dbName: 'Paisly', imageId: '69a558d9a6d270565413d71b' }, // try from another cat if not found
  // Bottoms (from bottom-in-stock)
  { dbName: 'Sloane', imageId: '693fd2c078c689364a4b8ae4' },
  { dbName: 'Rora', imageId: '699e5fc13c797c80714f50e7' },
  // Accessories — Raspberry (try from new-arrival or dress)
  { dbName: 'Raspberry', imageId: '6964bba78f9df39bfeca243f' }, // Noemie as fallback if Raspberry not found
]

function downloadImage(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)
    https.get(url, (response) => {
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
        return reject(new Error(`HTTP ${response.statusCode}`))
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

  console.log('🖼️  第二批商品圖片匯入（10 個）\n')

  let success = 0
  let skip = 0

  for (const item of BATCH) {
    // Find product by name prefix
    const products = await payload.find({
      collection: 'products',
      where: { name: { contains: item.dbName } },
      limit: 1,
    })

    if (products.docs.length === 0) {
      console.log(`  ⚠️  找不到: ${item.dbName}`)
      skip++
      continue
    }

    const product = products.docs[0]
    const existingImages = (product as unknown as Record<string, unknown>).images as unknown[] || []
    if (existingImages.length > 0) {
      console.log(`  → ${product.name} (已有圖片)`)
      skip++
      continue
    }

    const imgUrl = `${SHOPLINE_IMG_BASE}/${item.imageId}/original.png`
    const slug = (product as unknown as Record<string, unknown>).slug as string || item.dbName.toLowerCase()
    const tmpFile = path.join(tmpDir, `${item.imageId}.png`)

    try {
      console.log(`  📥 ${item.dbName} → ${product.name}`)
      await downloadImage(imgUrl, tmpFile)

      const stats = fs.statSync(tmpFile)
      if (stats.size < 1000) {
        console.log(`    ⚠️  圖片太小，跳過`)
        skip++
        continue
      }

      const media = await (payload.create as Function)({
        collection: 'media',
        data: { alt: product.name || item.dbName, caption: product.name || item.dbName },
        file: {
          data: fs.readFileSync(tmpFile),
          mimetype: 'image/png',
          name: `${slug}-${item.imageId}.png`,
          size: stats.size,
        },
      })

      await (payload.update as Function)({
        collection: 'products',
        id: product.id,
        data: { images: [{ image: media.id }] },
      })

      console.log(`    ✅ 已上傳 → media #${media.id}`)
      success++
    } catch (err: unknown) {
      console.log(`    ❌ 失敗: ${(err as Error).message}`)
    }
  }

  try { fs.rmSync(tmpDir, { recursive: true }) } catch {}
  console.log(`\n✅ 完成！成功: ${success}, 跳過: ${skip}`)
  process.exit(0)
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
