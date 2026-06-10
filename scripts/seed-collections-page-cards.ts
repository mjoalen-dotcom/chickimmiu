/**
 * Seed Collections Page Cards — 修主題精選 nav 404
 * ──────────────────────────────────────────────
 * Nav menu「主題精選」7 個 children 全連 /collections/{slug}，但
 * collections-page-settings global 的 cards array 是空的 → 點 7 個都 404
 * （hit notFound() 渲染「找不到此系列」頁面）。
 *
 * 這個 seed 注入 7 張 placeholder cards 對應 nav menu 的 7 個 slug：
 *   jin-live / jin-style / host-style / brand-custom / formal-dresses
 *   / rush / celebrity-style
 *
 * 圖片：找一張既存的 media（嘗試 CKMU logo 或第一筆 media）當 placeholder，
 *      admin 之後可在 /admin/globals/collections-page-settings 換成適合的圖。
 *
 * 冪等：先讀現有 cards，已存在的 slug 跳過，沒的才補。
 *
 * Usage:
 *   pnpm payload run scripts/seed-collections-page-cards.ts
 */

import { getPayload } from 'payload'
import config from '@payload-config'

type Card = {
  slug: string
  title: string
  description: string
  collectionTagsFilter: string[]
  span?: 'normal' | 'wide' | 'tall' | 'large'
  sortOrder: number
}

const SEED_CARDS: Card[] = [
  {
    slug: 'jin-live',
    title: '金老佛爺 Live',
    description: '直播搶購限時優惠 — 金老佛爺親選爆款，現貨速到',
    collectionTagsFilter: ['jin-live'],
    span: 'wide',
    sortOrder: 10,
  },
  {
    slug: 'jin-style',
    title: '金金同款專區',
    description: '金老佛爺本人穿過的款式 — 跟著流行教主穿出風格',
    collectionTagsFilter: ['jin-style', 'jin-live'],
    sortOrder: 20,
  },
  {
    slug: 'host-style',
    title: '主播同款專區',
    description: '電視主播鏡頭前的職場專業 — 端莊俐落的工作美學',
    collectionTagsFilter: ['host-style'],
    sortOrder: 30,
  },
  {
    slug: 'celebrity-style',
    title: '藝人穿搭',
    description: '陳美鳳、Melody、韓瑜等藝人於節目穿搭精選 — 看 CKMU ON SHOW',
    collectionTagsFilter: ['celebrity-style', 'korean-celebrity'],
    span: 'wide',
    sortOrder: 40,
  },
  {
    slug: 'brand-custom',
    title: '品牌自訂款',
    description: 'CKMU 獨家設計 — 台灣設計、韓國工藝、限量單品',
    collectionTagsFilter: ['brand-custom'],
    sortOrder: 50,
  },
  {
    slug: 'formal-dresses',
    title: '婚禮洋裝 / 正式洋裝',
    description: '婚禮、餐酒會、晚宴、典禮 — 為重要場合準備的優雅選擇',
    collectionTagsFilter: ['formal-dresses'],
    sortOrder: 60,
  },
  {
    slug: 'rush',
    title: '現貨速到 Rush',
    description: '台灣倉現貨 — 訂單成立 24 小時出貨，下週上身',
    collectionTagsFilter: ['rush'],
    sortOrder: 70,
  },
]

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

async function main() {
  log('🌱 Seeding collections-page-settings cards (fix 主題精選 nav 404)')
  const payload = await getPayload({ config })

  // 找一張可用的 placeholder image
  log('\n🖼️  Finding placeholder image (CKMU logo or first media)...')
  let placeholderId: number | null = null

  // 先試找 1200x.webp (CKMU logo)
  const logoFound = await payload.find({
    collection: 'media',
    where: { filename: { equals: '1200x.webp' } },
    limit: 1,
    depth: 0,
  })
  if (logoFound.docs.length > 0) {
    placeholderId = (logoFound.docs[0] as unknown as { id: number }).id
    log(`   ✓ Using CKMU logo (1200x.webp) → media id=${placeholderId}`)
  } else {
    // fallback: 第一筆 media
    const firstMedia = await payload.find({ collection: 'media', limit: 1, depth: 0 })
    if (firstMedia.docs.length > 0) {
      placeholderId = (firstMedia.docs[0] as unknown as { id: number }).id
      log(`   ✓ Using first media → id=${placeholderId}`)
    } else {
      throw new Error('No media in DB — cannot seed cards with required image field')
    }
  }

  // 讀現有 global
  log('\n📋 Loading current collections-page-settings...')
  const current = await payload.findGlobal({ slug: 'collections-page-settings' })
  const currentCards =
    ((current as unknown as { cards?: Array<Record<string, unknown>> })?.cards as Array<
      Record<string, unknown>
    >) || []
  const existingSlugs = new Set(currentCards.map((c) => c.slug as string))
  log(`   Existing cards: ${currentCards.length} (${[...existingSlugs].join(', ') || '(none)'})`)

  // 補沒有的 slug
  const cardsToAdd = SEED_CARDS.filter((c) => !existingSlugs.has(c.slug))
  log(`\n➕ Adding ${cardsToAdd.length} new cards: ${cardsToAdd.map((c) => c.slug).join(', ')}`)

  if (cardsToAdd.length === 0) {
    log('   (nothing to do — all cards already exist)')
    return
  }

  const newCards = [
    ...currentCards,
    ...cardsToAdd.map((c) => ({
      image: placeholderId,
      title: c.title,
      slug: c.slug,
      description: c.description,
      span: c.span || 'normal',
      sortOrder: c.sortOrder,
      isActive: true,
      collectionTagsFilter: c.collectionTagsFilter,
    })),
  ]

  await payload.updateGlobal({
    slug: 'collections-page-settings',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { cards: newCards } as any,
  })
  log(`\n✅ Global updated — total cards: ${newCards.length}`)
  log('\n   Verify:')
  for (const c of cardsToAdd) {
    log(`   - https://pre.chickimmiu.com/collections/${c.slug}`)
  }
  log('\n   Admin to swap placeholder images:')
  log('   - https://pre.chickimmiu.com/admin/globals/collections-page-settings')
}

await main()
