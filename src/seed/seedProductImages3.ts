/**
 * 商品圖片匯入 — 第三批（10 個）
 * PAYLOAD_SECRET=ckmu-dev-secret-2024 DATABASE_URI=file:./data/chickimmiu.db npx tsx src/seed/seedProductImages3.ts
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

const BATCH: { dbName: string; imageId: string }[] = [
  { dbName: 'Roberta', imageId: '69525249407fd635bf4b4880' },
  { dbName: 'Korrine', imageId: '68c7b9a77285ad0014985cf6' },
  { dbName: 'Zabara', imageId: '6908c794c87f9b000cbc2bb6' },
  { dbName: 'Marcia', imageId: '691aee2682adcc001816457d' },
  { dbName: 'Elena', imageId: '6911a2c78a00e94f10574702' },
  { dbName: 'Lauren', imageId: '69814d20318134240d2beb33' },
  { dbName: 'Brie', imageId: '697790267c37c3f0d5b6e10a' },
  { dbName: 'Elsie', imageId: '6960617e8f65f559cd36dbc5' },
  { dbName: 'Cara', imageId: '6977908f9afce21b1deb2f7e' },
  { dbName: 'Alma', imageId: '692e3ca224e02100168b1330' },
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

  console.log('🖼️  第三批商品圖片匯入（10 個）\n')
  let success = 0, skip = 0

  for (const item of BATCH) {
    const products = await payload.find({
      collection: 'products',
      where: { name: { contains: item.dbName } },
      limit: 1,
    })
    if (products.docs.length === 0) { console.log(`  ⚠️  找不到: ${item.dbName}`); skip++; continue }

    const product = products.docs[0]
    const existingImages = (product as unknown as Record<string, unknown>).images as unknown[] || []
    if (existingImages.length > 0) { console.log(`  → ${product.name} (已有圖片)`); skip++; continue }

    const slug = (product as unknown as Record<string, unknown>).slug as string || item.dbName.toLowerCase()
    const tmpFile = path.join(tmpDir, `${item.imageId}.png`)

    try {
      console.log(`  📥 ${item.dbName} → ${product.name}`)
      await downloadImage(`${SHOPLINE_IMG_BASE}/${item.imageId}/original.png`, tmpFile)
      const stats = fs.statSync(tmpFile)
      if (stats.size < 1000) { console.log(`    ⚠️  太小`); skip++; continue }

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
      console.log(`    ✅ media #${media.id}`)
      success++
    } catch (err: unknown) { console.log(`    ❌ ${(err as Error).message}`) }
  }

  try { fs.rmSync(tmpDir, { recursive: true }) } catch {}
  console.log(`\n✅ 完成！成功: ${success}, 跳過: ${skip}`)
  process.exit(0)
}
main().catch((e) => { console.error('❌', e.message); process.exit(1) })
