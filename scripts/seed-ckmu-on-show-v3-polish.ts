/**
 * Seed CKMU ON SHOW — Stage 3 Polish (v3)
 * ────────────────────────────────────────
 * 4 件收尾：
 *   1. Reorder /pages/ckmu-on-show layout — 為購物流程設計
 *      (magazine-cover → celebrity-grid → product-showcase → pull-quote
 *       → cta → faq)
 *      把 pull-quote 移到中段當情感緩衝，celebrity-grid 上移讓 user
 *      一打開就看到主菜
 *   2. 為 18 位的 galleryImages 補預設 caption（admin 之後可改）
 *      格式：「{藝人名} 節目穿搭 #{idx}」
 *   3. 補 楊智捷 + 劉祝華 整輯（之前 cap 15，加到 30+）
 *      用 ckmuonshow-03/04 完整 image list 的後段
 *   4. CelebrityGrid heading 文案更新成更購物導向
 *
 * Usage:
 *   pnpm payload run scripts/seed-ckmu-on-show-v3-polish.ts
 *
 * Env:
 *   SEED_DRY_RUN=1   只 plan
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY_RUN = process.env.SEED_DRY_RUN === '1'
const PAGE_SLUG = 'ckmu-on-show'
const SHOPLINE_PREFIX = 'https://shoplineimg.com/559df3efe37ec64e9f000092/'

// 劉祝華 ckmuonshow-04 從第 16 張開始的 hashes（已 seed 1-15）
const LIU_EXTRA_HASHES = [
  '67a5d0176727fa00101e149d/750x.png',
  '67a5d0177024710011fa2fff/750x.png',
  '67a5d01702fe38000e2cab95/750x.png',
  '67a5d0167dc26d000ec76f98/750x.png',
  '67a5d017386d1c000c1b5083/750x.png',
  '67a5d017866d83000c73da7c/750x.png',
  '6788a2366bb71e000d87a88f/750x.png',
  '67724f289e9bc4001040d246/750x.png',
  '67724f283bbdcc000b62b0ed/750x.png',
  '67a5d0178311a5000c250281/750x.png',
  '67a5d017d209b7000b233ffd/750x.png',
  '67724f28c6b996000f5e3c85/750x.png',
  '67e50fb24a4099000e263ef0/750x.png',
  '67e50fb2c06644000d989105/750x.png',
  '67e50fb2f7416d00113a1525/750x.png',
  '6728752bea65be31d7a06bbb/750x.jpg',
  '6728752ba50e7e1b5fcfe917/750x.jpg',
  '6728752b6cf213a8afd98978/750x.jpg',
  '6728752b0da98e13da10c11e/750x.jpg',
  '6728752bb9f637b6c210679b/750x.jpg',
  '6728752b9b431a3b2a0c4827/750x.jpg',
  '6728752b0939e1dffd47a2da/750x.jpg',
  '6728752ba50e7e3a5dcfe1f9/750x.jpg',
  '673afe252ac318782afd2d1a/750x.png',
  '673afe2592067b000c8e9952/750x.png',
  '673afe26d718ce000ab0615a/750x.png',
  '67529f3974712d00105bc142/750x.png',
  '67529f39099de8000f2764be/750x.png',
  '6752a3bf35a724000ea0671a/750x.png',
  '67529f392854c1000fc3af7b/750x.png',
  '6752a41fb9d704000e3af02a/750x.png',
]

// 楊智捷 ckmuonshow-03 從第 16 張開始的 hashes（已 seed 1-15）
const YANG_EXTRA_HASHES = [
  '6735719a8bd37b000a751020/750x.png',
  '6735719a9af215000d50e1fd/750x.png',
  '6735719a941e8a00111c9ef7/750x.png',
  '6735719ac4bc2d0010b8050a/750x.png',
  '6735719a7a63620011041e61/750x.png',
  '673571cdedda2f00119b8847/750x.png',
  '673571cd5f44020010418b0b/750x.png',
  '673571cdaee64a0011bc02f0/750x.png',
  '673571cddd0bef87fcbd087d/750x.png',
  '673571cd0a869a000d2c991d/750x.png',
  '673573e17a63620011041ed7/750x.png',
  '673573e12c1dd0000aca18d4/750x.png',
  '673573e1a9cc8600100761b3/750x.png',
  '673573e16f40df001022669d/750x.png',
  '673573e1ff76ea000c53b0f3/750x.png',
  '673573e16f40df0011226556/750x.png',
  '673573e1a9cc86000c076011/750x.png',
  '673573e12fd8d8000f40621a/750x.png',
  '673573e1f89474001075d4ad/750x.png',
  '673573e1db582c00116155a2/750x.png',
  '68ae9cfd4fd137000a1ca4c4/750x.png',
  '68ae9d0ec4b29c0010679ebf/750x.png',
  '68aeacaa448d35000c146a6a/750x.png',
  '673af105375354000d9d7c59/750x.png',
  '673af105259dab00102b5b08/750x.png',
  '673af105cd5815000ea63afa/750x.png',
  '673af1bd1a16ad00106c5e86/750x.png',
  '68ae973b0a4111000cec7a00/750x.png',
  '68ae97432c1bb3001868d3f1/750x.png',
  '68ae98d5d414e8000ac1a418/750x.png',
]

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

async function fetchImage(
  url: string,
): Promise<{ buffer: Buffer; mimetype: string; size: number }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url} -> HTTP ${res.status}`)
  const arrayBuf = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuf)
  const mimetype =
    res.headers.get('content-type')?.split(';')[0]?.trim() ||
    (url.toLowerCase().includes('.jpg') ? 'image/jpeg' : 'image/png')
  return { buffer, mimetype, size: buffer.byteLength }
}

async function extendGallery(
  payload: Awaited<ReturnType<typeof getPayload>>,
  slug: string,
  startIdx: number,
  hashes: string[],
) {
  const found = await payload.find({
    collection: 'celebrity-features',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })
  const celeb = found.docs[0] as unknown as
    | { id: number; name: string; galleryImages?: Array<Record<string, unknown>> }
    | undefined
  if (!celeb) {
    log(`   ✗ slug=${slug} not found`)
    return
  }

  const existingGallery = (celeb.galleryImages || []) as Array<Record<string, unknown>>
  log(`\n👤 ${celeb.name} (slug=${slug}) — existing ${existingGallery.length} images, adding ${hashes.length}`)

  const newGalleryItems: Array<{ image: number; caption: string }> = []
  for (let i = 0; i < hashes.length; i++) {
    const hash = hashes[i]
    const idxOverall = startIdx + i + 1
    const url = `${SHOPLINE_PREFIX}${hash}?`
    const ext = hash.endsWith('.jpg') ? 'jpg' : 'png'
    const filename = `ckmu-on-show-gallery-${slug}-${String(idxOverall).padStart(2, '0')}.${ext}`

    // 防重複下載
    const existingMedia = await payload.find({
      collection: 'media',
      where: { filename: { equals: filename } },
      limit: 1,
      depth: 0,
    })
    const existingMediaDoc = existingMedia.docs[0] as unknown as { id: number } | undefined
    if (existingMediaDoc) {
      newGalleryItems.push({
        image: existingMediaDoc.id,
        caption: `${celeb.name} 節目穿搭 #${idxOverall}`,
      })
      log(`   ${idxOverall}. ${filename} → reused id=${existingMediaDoc.id}`)
      continue
    }

    try {
      if (DRY_RUN) {
        log(`   ${idxOverall}. [dry-run] ${url}`)
        continue
      }
      const { buffer, mimetype, size } = await fetchImage(url)
      const created = (await payload.create({
        collection: 'media',
        data: { alt: `${celeb.name} 節目穿搭整輯 #${idxOverall}` },
        file: { data: buffer, name: filename, mimetype, size },
      })) as unknown as { id: number }
      newGalleryItems.push({
        image: created.id,
        caption: `${celeb.name} 節目穿搭 #${idxOverall}`,
      })
      log(`   ${idxOverall}. ${filename} → media id=${created.id} (${size} bytes)`)
    } catch (e) {
      log(`   ✗ ${idxOverall}. ${url}: ${(e as Error).message}`)
    }
  }

  // append new items + backfill captions on existing
  const updatedGallery = [
    ...existingGallery.map((g, i) => ({
      ...g,
      caption: g.caption || `${celeb.name} 節目穿搭 #${i + 1}`,
    })),
    ...newGalleryItems,
  ]

  if (!DRY_RUN) {
    await payload.update({
      collection: 'celebrity-features',
      id: celeb.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { galleryImages: updatedGallery as any },
    })
    log(`   ✓ Updated to ${updatedGallery.length} total items`)
  }
}

async function backfillCaptionsOnly(
  payload: Awaited<ReturnType<typeof getPayload>>,
  skipSlugs: string[],
) {
  log('\n📝 Backfilling captions for remaining celebrities...')
  const all = await payload.find({
    collection: 'celebrity-features',
    limit: 100,
    depth: 0,
  })
  for (const doc of all.docs as unknown as Array<{
    id: number
    name: string
    slug: string
    galleryImages?: Array<Record<string, unknown>>
  }>) {
    if (skipSlugs.includes(doc.slug)) continue
    const gallery = doc.galleryImages || []
    if (gallery.length === 0) continue
    const updated = gallery.map((g, i) => ({
      ...g,
      caption: g.caption || `${doc.name} 節目穿搭 #${i + 1}`,
    }))
    const changed = updated.some((g, i) => g.caption !== gallery[i].caption)
    if (!changed) {
      log(`   ${doc.slug} ${doc.name}: ${gallery.length} captions already set, skip`)
      continue
    }
    if (!DRY_RUN) {
      await payload.update({
        collection: 'celebrity-features',
        id: doc.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { galleryImages: updated as any },
      })
    }
    log(`   ${doc.slug} ${doc.name}: ${updated.length} captions backfilled`)
  }
}

async function reorderPageLayout(payload: Awaited<ReturnType<typeof getPayload>>) {
  log('\n📄 Reordering /pages/ckmu-on-show layout for shopping flow...')
  const pageFound = await payload.find({
    collection: 'pages',
    where: { slug: { equals: PAGE_SLUG } },
    limit: 1,
    depth: 0,
  })
  const page = pageFound.docs[0] as unknown as { id: number; layout?: unknown[] } | undefined
  if (!page) {
    log('   ✗ page not found')
    return
  }

  const oldLayout = (page.layout as Array<Record<string, unknown>>) || []
  const byType: Record<string, Record<string, unknown>> = {}
  for (const b of oldLayout) {
    byType[b.blockType as string] = b
  }

  // 新順序：magazine-cover → celebrity-grid → product-showcase → pull-quote → cta → faq
  const newLayout: Array<Record<string, unknown>> = []
  if (byType['magazine-cover']) newLayout.push(byType['magazine-cover'])
  if (byType['celebrity-grid']) {
    newLayout.push({
      ...byType['celebrity-grid'],
      heading: 'ON SHOW · 媒體曝光',
      subheading: '點圖進入該藝人專屬頁面 — 看完整節目穿搭整輯與同款購買',
    })
  }
  if (byType['product-showcase']) {
    newLayout.push({
      ...byType['product-showcase'],
      heading: '節目同款熱銷單品',
    })
  }
  if (byType['pull-quote']) newLayout.push(byType['pull-quote'])
  if (byType['cta']) newLayout.push(byType['cta'])
  if (byType['faq']) newLayout.push(byType['faq'])

  if (DRY_RUN) {
    log(`   [dry-run] Would reorder ${oldLayout.length} → ${newLayout.length} blocks`)
    log(`   New order: ${newLayout.map((b) => b.blockType).join(' → ')}`)
    return
  }

  await payload.update({
    collection: 'pages',
    id: page.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { layout: newLayout as any },
  })
  log(`   ✓ Page id=${page.id} reordered: ${newLayout.map((b) => b.blockType).join(' → ')}`)
}

async function main() {
  log('🎨 CKMU ON SHOW Stage 3 Polish')
  if (DRY_RUN) log('   (DRY-RUN)')

  const payload = await getPayload({ config })

  // 1. 補劉祝華 +30 + 楊智捷 +30
  await extendGallery(payload, '02', 15, LIU_EXTRA_HASHES) // 劉祝華 16-45
  await extendGallery(payload, '05', 15, YANG_EXTRA_HASHES) // 楊智捷 16-45

  // 2. 為剩下 16 位補 captions (skip 02 + 05 因為剛剛已處理)
  await backfillCaptionsOnly(payload, ['02', '05'])

  // 3. 重排 page layout
  await reorderPageLayout(payload)

  log('\n🎉 Done. Visit: https://pre.chickimmiu.com/pages/ckmu-on-show')
}

await main()
