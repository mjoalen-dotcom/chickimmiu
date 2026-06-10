/**
 * Fix: 重建並 swap 劉祝華 ↔ 楊智捷 galleryImages
 * ─────────────────────────────────────────────
 * 處理 partial-state 救援版本：
 *
 * 之前 v1 fix 在 SDK 更新時遇 UNIQUE id constraint，第一個 update 已
 * 把劉祝華（slug=02）的 galleryImages 刪光（0 items），但新資料沒寫進。
 * 楊智捷（slug=05）仍維持 45 items 但內容是「劉祝華的真實照片」。
 *
 * Media 紀錄都還在（檔名 pattern：
 *   ckmu-on-show-gallery-02-NN.png/.jpg → 楊智捷的真實照片 (67fc7ee*)
 *   ckmu-on-show-gallery-05-NN.png/.jpg → 劉祝華的真實照片 (68aeacfa*)
 *
 * 重建邏輯：
 *   1. Media 查詢 filename like 'ckmu-on-show-gallery-02-%' → 楊智捷 photos
 *      → 拼成楊智捷的新 galleryImages（caption: 楊智捷 節目穿搭 #N）
 *   2. Media 查詢 filename like 'ckmu-on-show-gallery-05-%' → 劉祝華 photos
 *      → 拼成劉祝華的新 galleryImages（caption: 劉祝華 節目穿搭 #N）
 *   3. Update 楊智捷 + 劉祝華
 *
 * Strip id 來避免 UNIQUE constraint（讓 Payload auto-gen 新 array IDs）。
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY_RUN = process.env.SEED_DRY_RUN === '1'

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

// 從 filename 取出末尾數字（NN）用來排序，避免 .png/.jpg 混排
function numFromFilename(filename: string): number {
  const m = filename.match(/-(\d{2,3})\.(png|jpg)$/)
  return m ? parseInt(m[1], 10) : 0
}

async function getMediaByFilenamePrefix(
  payload: Awaited<ReturnType<typeof getPayload>>,
  prefix: string,
): Promise<Array<{ id: number; filename: string }>> {
  const result = await payload.find({
    collection: 'media',
    where: { filename: { like: prefix } },
    limit: 200,
    depth: 0,
    sort: 'filename',
  })
  return (result.docs as unknown as Array<{ id: number; filename: string }>).filter((d) =>
    d.filename.startsWith(prefix.replace('%', '')),
  )
}

async function main() {
  log('🔧 Reconstructing 劉祝華 ↔ 楊智捷 galleries from Media files')
  if (DRY_RUN) log('   (DRY-RUN)')

  const payload = await getPayload({ config })

  // 1. find celebrities
  const liuFound = await payload.find({
    collection: 'celebrity-features',
    where: { slug: { equals: '02' } },
    limit: 1,
    depth: 0,
  })
  const yangFound = await payload.find({
    collection: 'celebrity-features',
    where: { slug: { equals: '05' } },
    limit: 1,
    depth: 0,
  })
  const liu = liuFound.docs[0] as unknown as { id: number; name: string }
  const yang = yangFound.docs[0] as unknown as { id: number; name: string }

  // 2. media files
  log('\n🔍 Finding media files by filename prefix...')
  const filesUnder02 = await getMediaByFilenamePrefix(payload, 'ckmu-on-show-gallery-02-')
  const filesUnder05 = await getMediaByFilenamePrefix(payload, 'ckmu-on-show-gallery-05-')

  // 排序：按 filename 中的編號
  filesUnder02.sort((a, b) => numFromFilename(a.filename) - numFromFilename(b.filename))
  filesUnder05.sort((a, b) => numFromFilename(a.filename) - numFromFilename(b.filename))

  log(`   filename "ckmu-on-show-gallery-02-*": ${filesUnder02.length} files`)
  log(`     → 內容是 ${yang.name} 的真實照片（之前誤標）`)
  log(`   filename "ckmu-on-show-gallery-05-*": ${filesUnder05.length} files`)
  log(`     → 內容是 ${liu.name} 的真實照片（之前誤標）`)

  // 3. build new gallery arrays
  const yangNewGallery = filesUnder02.map((m, i) => ({
    image: m.id,
    caption: `${yang.name} 節目穿搭 #${i + 1}`,
  }))
  const liuNewGallery = filesUnder05.map((m, i) => ({
    image: m.id,
    caption: `${liu.name} 節目穿搭 #${i + 1}`,
  }))

  if (DRY_RUN) {
    log(`\n[dry-run] Would update:`)
    log(`   ${liu.name} (id=${liu.id}): 0 → ${liuNewGallery.length} items`)
    log(`   ${yang.name} (id=${yang.id}): 45 → ${yangNewGallery.length} items`)
    return
  }

  // 4. update both
  await payload.update({
    collection: 'celebrity-features',
    id: liu.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { galleryImages: liuNewGallery as any },
  })
  log(`\n   ✓ ${liu.name} (id=${liu.id}) updated → ${liuNewGallery.length} items`)

  await payload.update({
    collection: 'celebrity-features',
    id: yang.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { galleryImages: yangNewGallery as any },
  })
  log(`   ✓ ${yang.name} (id=${yang.id}) updated → ${yangNewGallery.length} items`)

  log('\n🎉 Done. Verify:')
  log(`   - https://pre.chickimmiu.com/celebrity/02 (${liu.name})`)
  log(`   - https://pre.chickimmiu.com/celebrity/05 (${yang.name})`)
}

await main()
