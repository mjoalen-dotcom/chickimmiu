/**
 * 媒體牆插回「一半圖一半影片」列（2026-08-24，冪等）
 * ──────────────────────────────────────────────────
 * 背景：seed-cover-content 用商品圖鋪滿 sections 後，預設的雙欄
 * 照片|直式影片列不再渲染 → 歡迎頁直式影片消失（Alan 反映）。
 * 此腳本在 sections 第 2 列插入 split 列：左=未用過的商品圖、
 * 右=品牌直式影片（home-hero-9x16.mp4 的媒體庫紀錄）。
 * 冪等：sections 中已有任何影片素材列則跳過。
 *
 * 用法：NODE_ENV=production pnpm payload run scripts/insert-cover-video-row.ts
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

function isVideoDoc(val: unknown): boolean {
  return Boolean(
    val && typeof val === 'object' &&
    String((val as Record<string, unknown>).mimeType ?? '').startsWith('video/'),
  )
}

async function main() {
  const payload = await getPayload({ config })

  const homepage = (await payload.findGlobal({ slug: 'homepage-settings', depth: 2 })) as unknown as Record<string, unknown>
  const cp = (homepage.coverPage as Record<string, unknown>) || {}
  const sections = (cp.sections as Array<Record<string, unknown>> | undefined) || []

  if (sections.length === 0) {
    log('sections 為空 — 預設雙欄（含影片）本來就會渲染，不需插入')
    process.exit(0)
  }
  if (sections.some((s) => isVideoDoc(s.media) || isVideoDoc(s.mediaRight))) {
    log('sections 已含影片列，跳過')
    process.exit(0)
  }

  // 直式影片媒體紀錄
  const vid = await payload.find({
    collection: 'media',
    where: { filename: { equals: 'home-hero-9x16.mp4' } },
    limit: 1,
    depth: 0,
  })
  const videoId = vid.docs[0] ? relId(vid.docs[0]) : null
  if (videoId == null) {
    throw new Error('媒體庫找不到 home-hero-9x16.mp4（先跑 seed-cover-content.ts）')
  }

  // 找一張 sections 尚未使用的商品圖當左格
  const usedIds = new Set<string>()
  for (const s of sections) {
    const a = relId(s.media)
    const b = relId(s.mediaRight)
    if (a != null) usedIds.add(String(a))
    if (b != null) usedIds.add(String(b))
  }
  const products = await payload.find({ collection: 'products', sort: '-createdAt', limit: 24, depth: 1 })
  let imageId: number | string | null = null
  for (const p of products.docs as unknown as Record<string, unknown>[]) {
    const images = p.images as Array<{ image?: unknown }> | undefined
    const id = relId(images?.[0]?.image)
    if (id != null && !usedIds.has(String(id))) {
      imageId = id
      break
    }
  }
  if (imageId == null) {
    // 找不到未用過的就重用第一列左圖（影片列還是要有）
    imageId = relId(sections[0].media)
  }

  // 序列化回存：media 欄位要還原成 id
  const plainRows = sections.map((s) => ({
    layout: s.layout === 'split' ? 'split' : 'full',
    media: relId(s.media),
    mediaRight: relId(s.mediaRight),
    heading: (s.heading as string | null) || null,
    caption: (s.caption as string | null) || null,
  }))
  plainRows.splice(1, 0, {
    layout: 'split',
    media: imageId,
    mediaRight: videoId,
    heading: null,
    caption: 'FILM',
  })

  // coverPage 其他 upload 欄位同樣還原成 id（depth 2 撈回的是 populated 物件）
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
        sections: plainRows,
      },
    } as never,
  })
  log(`✅ 已在第 2 列插回 圖|直式影片（video id=${videoId}），共 ${plainRows.length} 列`)
  process.exit(0)
}

await main()
