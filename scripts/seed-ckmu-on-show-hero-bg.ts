/**
 * Seed CKMU ON SHOW Hero Background Image
 * ────────────────────────────────────────
 * 下載 Shopline 主視覺圖 → 上傳 Media → 更新 /pages/ckmu-on-show 的
 * magazine-cover block 加 backgroundImage 引用（修留白 + 視覺強化）。
 *
 * Usage:
 *   pnpm payload run scripts/seed-ckmu-on-show-hero-bg.ts
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const HERO_BG_URL =
  'https://shoplineimg.com/559df3efe37ec64e9f000092/673adc388bab39000e3f634a/1296x.webp?source_format=png'
const HERO_BG_FILENAME = 'ckmu-on-show-hero-bg.png'
const PAGE_SLUG = 'ckmu-on-show'

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
  // source_format=png 表示 Shopline 把 webp 轉成 png 給我們，所以 mimetype 是 image/png
  return { buffer, mimetype: 'image/png', size: buffer.byteLength }
}

async function main() {
  log('🌱 Seeding CKMU ON SHOW hero background image')
  const payload = await getPayload({ config })

  // 1. 找既有同 filename，否則重新下載上傳
  log('\n🖼️  Checking existing media...')
  const existing = await payload.find({
    collection: 'media',
    where: { filename: { equals: HERO_BG_FILENAME } },
    limit: 1,
    depth: 0,
  })
  let bgId: number
  const existingDoc = existing.docs[0] as unknown as { id: number } | undefined
  if (existingDoc) {
    bgId = existingDoc.id
    log(`   ✓ Found existing → id=${bgId}`)
  } else {
    log(`   Downloading from Shopline: ${HERO_BG_URL}`)
    const { buffer, mimetype, size } = await fetchImage(HERO_BG_URL)
    log(`   ↓ ${size} bytes (${mimetype})`)
    const created = (await payload.create({
      collection: 'media',
      data: { alt: 'CKMU ON SHOW · 電視名人穿搭主視覺' },
      file: { data: buffer, name: HERO_BG_FILENAME, mimetype, size },
    })) as unknown as { id: number }
    bgId = created.id
    log(`   ✓ Uploaded → media id=${bgId}`)
  }

  // 2. 找 page + update magazine-cover block 加 backgroundImage
  log('\n📄 Updating /pages/ckmu-on-show magazine-cover block...')
  const pageFound = await payload.find({
    collection: 'pages',
    where: { slug: { equals: PAGE_SLUG } },
    limit: 1,
    depth: 0,
  })
  const page = pageFound.docs[0] as unknown as { id: number; layout?: unknown[] } | undefined
  if (!page) {
    log(`   ✗ Page not found, aborting`)
    return
  }

  const oldLayout = (page.layout as Array<Record<string, unknown>>) || []
  let updated = false
  const newLayout = oldLayout.map((block) => {
    if (block.blockType === 'magazine-cover') {
      updated = true
      return {
        ...block,
        image: bgId,
        theme: 'dark', // hero 圖片背景下用 dark theme 加可讀性
      }
    }
    return block
  })

  if (!updated) {
    log(`   ✗ No magazine-cover block in page, aborting`)
    return
  }

  await payload.update({
    collection: 'pages',
    id: page.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { layout: newLayout as any },
  })
  log(`   ✓ Page id=${page.id} magazine-cover.image=${bgId}, theme=dark`)
  log('\n🎉 Done. Visit: https://pre.chickimmiu.com/pages/ckmu-on-show')
}

await main()
