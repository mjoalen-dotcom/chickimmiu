/**
 * 商品圖片批量匯入 — 56 個商品
 * 從 Shopline 產品頁面擷取的可用 image IDs
 * PAYLOAD_SECRET=ckmu-dev-secret-2024 DATABASE_URI=file:./data/chickimmiu.db npx tsx src/seed/seedProductImagesBulk.ts
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
  { dbName: '時髦多色橢圓墨鏡', imageId: '69aeddfa41bba89465778780' },
  { dbName: 'Y2K個性橢圓墨鏡', imageId: '69bd18487d7f9fb65f0f78b4' },
  { dbName: '刺繡徽章棒球帽', imageId: '69a034a4321f340012d07ea3' },
  { dbName: '簡約墨水滴項鍊', imageId: '69a557f3459e8d6037a15f9b' },
  { dbName: '極簡圓珠長項鍊', imageId: '69a55780cbfeafa804acdfcb' },
  { dbName: '率性牛皮皮帶', imageId: '69b7c7750e8b85b679c1a122' },
  { dbName: '古著風洞石項鏈', imageId: '69c1070caaf4c85cd754a0da' },
  { dbName: 'Mielle', imageId: '69c106bdd2895bbcbeb64054' },
  { dbName: '知性圓框造型眼鏡', imageId: '69ca4772aaf9a70dedb09d52' },
  { dbName: '復古風橢圓造型眼鏡', imageId: '69ca47fb9253ac5f950cdc99' },
  { dbName: 'Novia', imageId: '6899ad08af377f000a096f07' },
  { dbName: 'Miriam', imageId: '69ca5266dd7f90b1732e8a5d' },
  { dbName: 'Vion 雙層荷葉', imageId: '69ca49b21eab2a80d195903b' },
  { dbName: 'Fiona', imageId: '69b80921fe3042e80a619dbc' },
  { dbName: 'Ginny', imageId: '69c1063d31f868a179663a58' },
  { dbName: 'Helen', imageId: '69c105d35546138b4aaf3fdc' },
  { dbName: 'Irene 極簡高腰', imageId: '69ca55b9c7e397e97314c4c2' },
  { dbName: 'Trinity', imageId: '69ae9688e20bb08c2dc5e5fd' },
  { dbName: 'Yves', imageId: '69b806d067a76d376e7f561b' },
  { dbName: '螞蟻腰都會', imageId: '69c1521fa96d6491182ab509' },
  { dbName: '螞蟻腰修身', imageId: '69c14f3531bca7a037d363d1' },
  { dbName: 'Zeline', imageId: '69c14ceaba076d02b8f6c7ab' },
  { dbName: 'Jess', imageId: '699c4953f591c23c31d975f3' },
  { dbName: 'Lucia', imageId: '69a578bbb625abd4a17bb7f6' },
  { dbName: 'Olivia', imageId: '69aed02b2783b88d61513c16' },
  { dbName: 'Penelope', imageId: '69aecdb23ee15492987140f5' },
  { dbName: 'Quincy 氣質裹身', imageId: '69b80d28d1831137f627ccce' },
  { dbName: 'Rhea', imageId: '69b80e451fd6dd3e35d8c8a6' },
  { dbName: 'Tara', imageId: '69c14280fe108164e9837a66' },
  { dbName: 'Serene', imageId: '69c140b9f04a564933f21f59' },
  { dbName: 'Vera', imageId: '69c13e34cb219e2846d68f35' },
  { dbName: 'Yuna', imageId: '69ca51927d644d009eac3783' },
  { dbName: 'Amelia', imageId: '69ca4f60043ccd59ea96d5db' },
  { dbName: 'Minni', imageId: '69b7c90fff4aed9170f7ab3f' },
  { dbName: 'Lovely', imageId: '677391c577ce8c000dd751f1' },
  { dbName: 'Gricel', imageId: '68bea432faa4b1000a00b733' },
  { dbName: 'Urie', imageId: '69ca4860d25c4eae03e5ca75' },
  { dbName: 'Odette', imageId: '69b80c147a38d17216b8ca1b' },
  { dbName: 'Rosa 溫柔荷葉', imageId: '69c1067644107cc54b468f82' },
  { dbName: 'Trisha', imageId: '69c1478a2a3a33619837f874' },
  { dbName: 'Sierra', imageId: '69c146e7cf9ab231afb2541d' },
  { dbName: 'Lesley', imageId: '69ae982fb78f7e9f60c5f2d4' },
  { dbName: 'Chic 極簡線條', imageId: '68dcfcb4c1ae03000caa5c04' },
  { dbName: 'Nadia', imageId: '69b7c8b31e8c488bc7f9df0b' },
  { dbName: 'Peyton 珠光蕾絲', imageId: '69bcdf2417003f4d965684ce' },
  { dbName: 'Vion 飄帶雪紡', imageId: '69ca496f008b97dc5a65d688' },
  { dbName: 'Irene 名媛風珍珠', imageId: '69ca53a3584149d3b5f646f9' },
  { dbName: 'Willow', imageId: '69ca533faaade9ff153c380f' },
  { dbName: 'Devon', imageId: '69645164a1d0436483bb26e8' },
  { dbName: 'Quenisha', imageId: '695ca52f8b0792d645e29a52' },
  { dbName: 'Solenne', imageId: '6952516a829647aaf73fd474' },
  { dbName: '珍珠釦香香外套', imageId: '6361e15470845b0010e6fd10' },
  { dbName: 'Hani', imageId: '69ae9683c065326eac0e7d1e' },
  { dbName: 'Ingrid', imageId: '69ae9699f67d2fbe5027b432' },
  { dbName: 'Karly', imageId: '69ae9794aaffcdcea8668357' },
  { dbName: 'Lydia', imageId: '69b804f4bc5c054961ffc715' },
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

  console.log(`🖼️  批量商品圖片匯入（${BATCH.length} 個）\n`)
  let success = 0, skip = 0, fail = 0

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

    const slug = (product as unknown as Record<string, unknown>).slug as string || item.dbName.toLowerCase().replace(/\s+/g, '-')
    const tmpFile = path.join(tmpDir, `${item.imageId}.png`)

    try {
      console.log(`  📥 ${item.dbName} → ${product.name}`)
      await downloadImage(`${SHOPLINE_IMG_BASE}/${item.imageId}/original.png`, tmpFile)
      const stats = fs.statSync(tmpFile)
      if (stats.size < 5000) { console.log(`    ⚠️  太小 (${stats.size}b)`); skip++; continue }

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
    } catch (err: unknown) {
      console.log(`    ❌ ${(err as Error).message}`)
      fail++
    }

    // Clean up tmp file
    try { fs.unlinkSync(tmpFile) } catch {}
  }

  try { fs.rmSync(tmpDir, { recursive: true }) } catch {}
  console.log(`\n╔══════════════════════════════╗`)
  console.log(`║  批量匯入完成                ║`)
  console.log(`╠══════════════════════════════╣`)
  console.log(`║  ✅ 成功: ${String(success).padStart(3)}               ║`)
  console.log(`║  ⏭️  跳過: ${String(skip).padStart(3)}               ║`)
  console.log(`║  ❌ 失敗: ${String(fail).padStart(3)}               ║`)
  console.log(`╚══════════════════════════════╝`)
  process.exit(0)
}
main().catch((e) => { console.error('❌', e.message); process.exit(1) })
