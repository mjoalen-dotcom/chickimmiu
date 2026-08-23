/**
 * 歡迎頁媒體牆排成 chuu.co.kr 結構（2026-08-24 Alan 拍板）
 * ────────────────────────────────────────────────────────
 * 對映 chuu 首頁節奏（hero 影片已在 sections 之外）：
 *   1. split  圖｜品牌直式影片（貼合，caption FILM）
 *   2. heading「New In」 + split 兩格新品大圖（貼合）
 *   3. full   形象編輯大圖（brandBanner 圖）
 *   4. heading「Lookbook」 + grid3 三格（微間距）
 *   5. grid3  三格（與上列形成 3×2 lookbook 牆）
 * ⚠ 會覆寫現有 sections 排列（素材沿用媒體庫）。之後在 /cover-editor 隨意調。
 *
 * 用法：NODE_ENV=production pnpm payload run scripts/arrange-cover-chuu.ts
 */

import { getPayload } from 'payload'
import config from '@payload-config'

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

function relId(val: unknown): number | string | null {
  if (val == null) return null
  if (typeof val === 'number' || typeof val === 'string') return val
  if (typeof val === 'object') {
    const id = (val as Record<string, unknown>).id
    if (typeof id === 'number' || typeof id === 'string') return id
  }
  return null
}

async function main() {
  const payload = await getPayload({ config })

  // 素材：直式影片
  const vid = await payload.find({
    collection: 'media',
    where: { filename: { equals: 'home-hero-9x16.mp4' } },
    limit: 1,
    depth: 0,
  })
  const videoId = vid.docs[0] ? relId(vid.docs[0]) : null
  if (videoId == null) throw new Error('媒體庫缺 home-hero-9x16.mp4（先跑 seed-cover-content.ts）')

  // 素材：商品圖 9 張（去重）
  const products = await payload.find({ collection: 'products', sort: '-createdAt', limit: 30, depth: 1 })
  const imgIds: (number | string)[] = []
  for (const p of products.docs as unknown as Record<string, unknown>[]) {
    const images = p.images as Array<{ image?: unknown }> | undefined
    const id = relId(images?.[0]?.image)
    if (id != null && !imgIds.includes(id)) imgIds.push(id)
    if (imgIds.length >= 9) break
  }
  if (imgIds.length < 9) throw new Error(`商品圖不足 9 張（現有 ${imgIds.length}）`)

  // 素材：形象編輯大圖（brandBanner 圖，缺則 hero 輪播第一張）
  const homepage = (await payload.findGlobal({ slug: 'homepage-settings', depth: 0 })) as unknown as Record<string, unknown>
  const brandBanner = (homepage.brandBanner as Record<string, unknown>) || {}
  const heroBanners = (homepage.heroBanners as Array<Record<string, unknown>> | undefined) || []
  const editorialId = relId(brandBanner.image) ?? relId(heroBanners[0]?.image)
  if (editorialId == null) throw new Error('缺形象大圖（brandBanner.image / heroBanners[0]）')

  const cp = (homepage.coverPage as Record<string, unknown>) || {}
  const sections = [
    { layout: 'split', media: imgIds[0], mediaRight: videoId, mediaThird: null, heading: null, caption: 'FILM' },
    { layout: 'split', media: imgIds[1], mediaRight: imgIds[2], mediaThird: null, heading: 'New In', caption: null },
    { layout: 'full', media: editorialId, mediaRight: null, mediaThird: null, heading: null, caption: 'EDITORIAL' },
    { layout: 'grid3', media: imgIds[3], mediaRight: imgIds[4], mediaThird: imgIds[5], heading: 'Lookbook', caption: null },
    { layout: 'grid3', media: imgIds[6], mediaRight: imgIds[7], mediaThird: imgIds[8], heading: null, caption: null },
  ]

  await payload.updateGlobal({
    slug: 'homepage-settings',
    data: {
      coverPage: {
        heroMode: (cp.heroMode as string) || 'video',
        heroVideo: relId(cp.heroVideo),
        heroVideoMobile: relId(cp.heroVideoMobile),
        heroImage: relId(cp.heroImage),
        sideImage: relId(cp.sideImage),
        sideVideo: relId(cp.sideVideo),
        sections,
      },
    } as never,
  })
  log(`✅ 媒體牆已排成 chuu 結構（${sections.length} 列：圖|影 → New In 2格 → 編輯大圖 → Lookbook 3×2）`)
  process.exit(0)
}

await main()
