/**
 * 商品圖片修正 — Marcia 裙 + Roberta 套裝褲
 * PAYLOAD_SECRET=ckmu-dev-secret-2024 DATABASE_URI=file:./data/chickimmiu.db npx tsx src/seed/seedProductImages4b.ts
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

// Targeted fixes: products that need exact name match or specific handling
const BATCH: { dbName: string; imageId: string; exactId?: number }[] = [
  // Marcia skirt (ID 69) — batch 3 matched ID 70 (blouse) instead. Use more specific name.
  { dbName: 'Marcia 側開衩', imageId: '691aee2682adcc001816457d' },
]

function downloadImage(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redir = response.headers.location
        if (redir) { file.close(); try { fs.unlinkSync(destPath) } catch {}; return downloadImage(redir, destPath).then(resolve).catch(reject) }
      }
      if (response.statusCode !== 200) { file.close(); try { fs.unlinkSync(destPath) } catch {}; return reject(new Error(`HTTP ${response.statusCode}`)) }
      response.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', (err) => { file.close(); try { fs.unlinkSync(destPath) } catch {}; reject(err) })
  })
}

async function main() {
  const payload = await getPayload({ config })
  const tmpDir = path.resolve(__dirname, '../../tmp-images')
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

  console.log('🔧 商品圖片修正批次\n')
  let success = 0

  for (const item of BATCH) {
    const products = await payload.find({
      collection: 'products',
      where: { name: { contains: item.dbName } },
      limit: 1,
    })
    if (products.docs.length === 0) { console.log(`  ⚠️  找不到: ${item.dbName}`); continue }

    const product = products.docs[0]
    const existingImages = (product as unknown as Record<string, unknown>).images as unknown[] || []
    if (existingImages.length > 0) { console.log(`  → ${product.name} (已有圖片)`); continue }

    const slug = (product as unknown as Record<string, unknown>).slug as string || item.dbName.toLowerCase()
    const tmpFile = path.join(tmpDir, `${item.imageId}.png`)

    try {
      console.log(`  📥 ${item.dbName} → ${product.name} (ID: ${product.id})`)
      await downloadImage(`${SHOPLINE_IMG_BASE}/${item.imageId}/original.png`, tmpFile)
      const stats = fs.statSync(tmpFile)
      if (stats.size < 1000) { console.log(`    ⚠️  太小`); continue }

      const media = await (payload.create as Function)({
        collection: 'media',
        data: { alt: product.name || item.dbName, caption: product.name || item.dbName },
        file: { data: fs.readFileSync(tmpFile), mimetype: 'image/png', name: `${slug}-${item.imageId}.png`, size: stats.size },
      })
      await (payload.update as Function)({
        collection: 'products',
        id: product.id,
        data: { images: [{ image: media.id }] },
      })
      console.log(`    ✅ media #${media.id} → product #${product.id}`)
      success++
    } catch (err: unknown) { console.log(`    ❌ ${(err as Error).message}`) }
  }

  try { fs.rmSync(tmpDir, { recursive: true }) } catch {}
  console.log(`\n✅ 完成！成功: ${success}`)
  process.exit(0)
}
main().catch((e) => { console.error('❌', e.message); process.exit(1) })
