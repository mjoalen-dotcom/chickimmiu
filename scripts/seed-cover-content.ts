/**
 * 前後台素材同步 + 封面媒體牆豐富化（2026-08-23 Alan 需求，冪等）
 * ────────────────────────────────────────────────────────────────
 * 解「前台有畫面、後台欄位卻是空的」的脫節感：
 *  1. 內建品牌影片（public/videos/*.mp4）匯入媒體庫，回填
 *     homepage-settings.coverPage 的 heroVideo / heroVideoMobile / sideVideo
 *     （欄位已有值則不動 — 不覆蓋 admin 的選擇）
 *  2. 封面媒體牆 sections 為空時，用最新商品圖鋪 5 列（chuu/LV 式：
 *     New In 雙欄 → Editorial 整幅 → Lookbook 雙欄×2 → Best 整幅），
 *     admin 之後可在 /cover-editor 自由重排
 *  3. about-page-settings：hero.image / ourVision.logo 為空時，把前台
 *     實際 fallback 中的圖（Shopline CDN hero、白字 logo）匯入媒體庫回填
 *
 * 用法（專案根目錄）：NODE_ENV=production pnpm payload run scripts/seed-cover-content.ts
 */

import fs from 'fs'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

/**
 * 依檔名找「檔案真的在磁碟上」的媒體紀錄。
 * ⚠ PG 搬移後 DB 存在檔案遺失的孤兒 media row（例：about-hero.webp，
 * server log 報 missing on the disk）— 只認 DB 會把欄位指到破圖，
 * 必須連磁碟一起驗。孤兒紀錄視為不存在（重新上傳，Payload 自動改名去重）。
 */
async function findMediaByFilename(payload: Payload, filename: string): Promise<number | string | null> {
  const r = await payload.find({
    collection: 'media',
    where: { filename: { equals: filename } },
    limit: 1,
    depth: 0,
  })
  const doc = r.docs[0] as unknown as { id: number | string; filename?: string } | undefined
  if (!doc) return null
  const onDisk = path.resolve(process.cwd(), 'public/media', doc.filename || filename)
  if (!fs.existsSync(onDisk)) {
    log(`⚠ media「${filename}」DB 有紀錄但磁碟缺檔（孤兒 row id=${doc.id}），改為重新上傳`)
    return null
  }
  return doc.id
}

async function ensureLocalFileMedia(
  payload: Payload,
  relPath: string,
  filename: string,
  mimetype: string,
  alt: string,
): Promise<number | string | null> {
  const existing = await findMediaByFilename(payload, filename)
  if (existing != null) return existing
  const abs = path.resolve(process.cwd(), relPath)
  if (!fs.existsSync(abs)) {
    log(`⚠ 找不到 ${relPath}，跳過`)
    return null
  }
  const data = fs.readFileSync(abs)
  const doc = await payload.create({
    collection: 'media',
    data: { alt },
    file: { data, name: filename, mimetype, size: data.length },
  })
  log(`＋ 媒體庫新增 ${filename}（id=${(doc as unknown as { id: number | string }).id}）`)
  return (doc as unknown as { id: number | string }).id
}

async function ensureRemoteImageMedia(
  payload: Payload,
  url: string,
  filename: string,
  alt: string,
): Promise<number | string | null> {
  const existing = await findMediaByFilename(payload, filename)
  if (existing != null) return existing
  const res = await fetch(url)
  if (!res.ok) {
    log(`⚠ 下載失敗 ${url}（${res.status}），跳過`)
    return null
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const mimetype = res.headers.get('content-type') || 'image/webp'
  const doc = await payload.create({
    collection: 'media',
    data: { alt },
    file: { data: buf, name: filename, mimetype, size: buf.length },
  })
  log(`＋ 媒體庫新增 ${filename}（來源 ${url.slice(0, 60)}…）`)
  return (doc as unknown as { id: number | string }).id
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

  // ── 1. 內建影片 → 媒體庫 + coverPage 回填 ──
  const heroDesktop = await ensureLocalFileMedia(
    payload, 'public/videos/home-hero-16x9.mp4', 'home-hero-16x9.mp4', 'video/mp4', '品牌形象影片（桌機 16:9）',
  )
  const heroMobile = await ensureLocalFileMedia(
    payload, 'public/videos/home-hero-9x16.mp4', 'home-hero-9x16.mp4', 'video/mp4', '品牌直式影片（手機 9:16）',
  )

  const homepage = (await payload.findGlobal({ slug: 'homepage-settings', depth: 0 })) as unknown as Record<string, unknown>
  const cp = (homepage.coverPage as Record<string, unknown>) || {}
  const coverUpdate: Record<string, unknown> = { ...cp }
  if (relId(cp.heroVideo) == null && heroDesktop != null) coverUpdate.heroVideo = heroDesktop
  if (relId(cp.heroVideoMobile) == null && heroMobile != null) coverUpdate.heroVideoMobile = heroMobile
  if (relId(cp.sideVideo) == null && heroMobile != null) coverUpdate.sideVideo = heroMobile

  // ── 2. sections 空 → 用商品圖鋪 5 列 ──
  const sections = (cp.sections as unknown[]) || []
  if (sections.length === 0) {
    const products = await payload.find({
      collection: 'products',
      sort: '-createdAt',
      limit: 16,
      depth: 1,
    })
    const imgIds: (number | string)[] = []
    for (const p of products.docs as unknown as Record<string, unknown>[]) {
      const images = p.images as Array<{ image?: unknown }> | undefined
      const id = relId(images?.[0]?.image)
      if (id != null && !imgIds.includes(id)) imgIds.push(id)
      if (imgIds.length >= 8) break
    }
    if (imgIds.length >= 4) {
      const rows: Record<string, unknown>[] = []
      rows.push({ layout: 'split', media: imgIds[0], mediaRight: imgIds[1], heading: 'New In' })
      if (imgIds[2] != null) rows.push({ layout: 'full', media: imgIds[2], caption: 'EDITORIAL' })
      if (imgIds[3] != null) rows.push({ layout: 'split', media: imgIds[3], mediaRight: imgIds[4] ?? null, heading: 'Lookbook' })
      if (imgIds[5] != null) rows.push({ layout: 'split', media: imgIds[5], mediaRight: imgIds[6] ?? null })
      if (imgIds[7] != null) rows.push({ layout: 'full', media: imgIds[7], heading: 'Best Sellers' })
      coverUpdate.sections = rows
      log(`＋ 封面媒體牆鋪 ${rows.length} 列（商品圖 ${imgIds.length} 張）`)
    } else {
      log('⚠ 商品圖不足 4 張，媒體牆維持空（走預設精簡版）')
    }
  } else {
    log(`· 媒體牆已有 ${sections.length} 列，不動`)
  }

  await payload.updateGlobal({ slug: 'homepage-settings', data: { coverPage: coverUpdate } as never })
  log('✅ homepage-settings.coverPage 已回填（後台即可看到目前使用中的影片/素材）')

  // ── 3. about-page-settings 同步實際使用中的圖 ──
  const about = (await payload.findGlobal({ slug: 'about-page-settings', depth: 0 })) as unknown as Record<string, unknown>
  const hero = (about.hero as Record<string, unknown>) || {}
  const ourVision = (about.ourVision as Record<string, unknown>) || {}
  const aboutUpdate: Record<string, unknown> = {}

  if (relId(hero.image) == null) {
    const id = await ensureRemoteImageMedia(
      payload,
      'https://shoplineimg.com/559df3efe37ec64e9f000092/69ce99f6a88927d62e71333c/1296x.webp?source_format=png',
      'about-hero.webp',
      '關於我們主視覺',
    )
    if (id != null) aboutUpdate.hero = { ...hero, image: id }
  }
  if (relId(ourVision.logo) == null) {
    const id = await ensureLocalFileMedia(
      payload, 'public/images/logo-ckmu-white.webp', 'logo-ckmu-white.webp', 'image/webp', 'CKMU 白字 logo',
    )
    if (id != null) aboutUpdate.ourVision = { ...ourVision, logo: id }
  }
  if (Object.keys(aboutUpdate).length > 0) {
    await payload.updateGlobal({ slug: 'about-page-settings', data: aboutUpdate as never })
    log('✅ about-page-settings 已回填實際使用中的圖')
  } else {
    log('· about-page-settings 欄位已有值，不動')
  }

  process.exit(0)
}

await main()
