/**
 * Seed minimum test data for V4 smoke tests:
 *   - 1 category (頂層 / 必填)
 *   - 1 media image (placeholder via direct DB; alt text 觸發 PR #129 fallback)
 *   - 2 products (用一個試 V4-d 批次改分類/改價/加標籤)
 *     - "測試商品 A" 帶 variants + intro_video + purchase_limit
 *     - "測試商品 B" 副品（用於批次/複製對比）
 *
 * Run: pnpm payload run scripts/seed-v4-smoke-data.ts
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

// 1x1 transparent PNG (67 bytes)
const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex',
)

// Minimal MP4 ftyp box (28 bytes — not playable but passes mimetype/size checks)
const TINY_MP4 = Buffer.from(
  '0000001c66747970697336' + '6d000000016176633166696c00000008' + '6d646174',
  'hex',
)

async function main() {
  const payload = await getPayload({ config })

  // 1. Category
  let cat = (await payload.find({
    collection: 'categories',
    where: { slug: { equals: 'smoke-test' } },
    limit: 1,
  })).docs[0]
  if (!cat) {
    cat = await payload.create({
      collection: 'categories',
      data: {
        name: 'V4 Smoke 測試',
        slug: 'smoke-test',
        description: 'Smoke test category for product admin V4',
      } as never,
    })
    process.stdout.write(`[cat] created id=${cat.id}\n`)
  } else {
    process.stdout.write(`[cat] exists id=${cat.id}\n`)
  }

  // 2. Media (placeholder — we just need an ID to attach as featured/intro)
  let mediaA = (await payload.find({
    collection: 'media',
    where: { filename: { equals: 'smoke-test-cover.png' } },
    limit: 1,
  })).docs[0]
  if (!mediaA) {
    mediaA = await payload.create({
      collection: 'media',
      data: { alt: 'V4 smoke test cover' } as never,
      file: {
        data: TINY_PNG,
        mimetype: 'image/png',
        name: 'smoke-test-cover.png',
        size: TINY_PNG.length,
      },
    })
    process.stdout.write(`[media-cover] created id=${mediaA.id}\n`)
  } else {
    process.stdout.write(`[media-cover] exists id=${mediaA.id}\n`)
  }

  let mediaVideo = (await payload.find({
    collection: 'media',
    where: { filename: { equals: 'smoke-test-intro.mp4' } },
    limit: 1,
  })).docs[0]
  if (!mediaVideo) {
    mediaVideo = await payload.create({
      collection: 'media',
      data: { alt: 'V4 smoke test intro video' } as never,
      file: {
        data: TINY_MP4,
        mimetype: 'video/mp4',
        name: 'smoke-test-intro.mp4',
        size: TINY_MP4.length,
      },
    })
    process.stdout.write(`[media-video] created id=${mediaVideo.id}\n`)
  } else {
    process.stdout.write(`[media-video] exists id=${mediaVideo.id}\n`)
  }

  // 3. Products A & B
  for (const tag of ['A', 'B']) {
    const slug = `smoke-test-${tag.toLowerCase()}`
    const existing = (await payload.find({
      collection: 'products',
      where: { slug: { equals: slug } },
      limit: 1,
    })).docs[0]
    if (existing) {
      process.stdout.write(`[product-${tag}] exists id=${existing.id}\n`)
      continue
    }
    const p = await payload.create({
      collection: 'products',
      data: {
        name: `V4 Smoke 測試商品 ${tag}`,
        slug,
        description: `Smoke test product ${tag} — used for V4 manual smoke tests`,
        price: tag === 'A' ? 1200 : 980,
        category: cat.id,
        status: 'published',
        // PR #209 new fields
        purchaseLimit: tag === 'A' ? 2 : null,
        dimensions: {
          length: 40,
          width: 30,
          height: 2,
        },
        hsCode: '6203.42.40',
        introVideo: tag === 'A' ? mediaVideo.id : null,
        // 4 tab essentials
        featuredImage: mediaA.id,
        images: [
          { image: mediaA.id, category: 'cover', caption: '封面測試圖' },
        ],
        variants: [
          {
            colorName: '米杏白',
            colorCode: '#F5EEDC',
            size: 'M',
            sku: `SMK-${tag}-M-WHITE`,
            stock: 10,
          },
          {
            colorName: '墨黑',
            colorCode: '#1A1A1A',
            size: 'L',
            sku: `SMK-${tag}-L-BLACK`,
            stock: 5,
          },
        ],
        cost: 400,
      } as never,
    })
    process.stdout.write(`[product-${tag}] created id=${p.id} slug=${p.slug}\n`)
  }

  process.stdout.write('[seed] done\n')
  process.exit(0)
}

await main()
