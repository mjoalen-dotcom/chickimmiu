/**
 * 手機 hero 改蒙太奇直式版（2026-09-01，冪等）
 * ──────────────────────────────────────────
 * 手機上 hero 與媒體牆 FILM 格曾是同一支 Reel（直式影片出現兩次）。
 * 蒙太奇 9:16 版入媒體庫 → coverPage.heroVideoMobile 指向它；
 * Reel（home-hero-9x16.mp4）留給媒體牆 FILM 格。
 *
 * 用法：NODE_ENV=production pnpm payload run scripts/set-hero-mobile-montage.ts
 */

import fs from 'fs'
import path from 'path'
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
  const filename = 'home-hero-9x16-montage.mp4'

  // 找/建媒體紀錄（含磁碟防呆）
  let mediaId: number | string | null = null
  const existing = await payload.find({
    collection: 'media',
    where: { filename: { equals: filename } },
    limit: 1,
    depth: 0,
  })
  const doc = existing.docs[0] as unknown as { id: number | string; filename?: string } | undefined
  if (doc && fs.existsSync(path.resolve(process.cwd(), 'public/media', doc.filename || filename))) {
    mediaId = doc.id
  } else {
    const abs = path.resolve(process.cwd(), 'public/videos', filename)
    if (!fs.existsSync(abs)) throw new Error(`缺 public/videos/${filename}（先 deploy 帶上檔案）`)
    const data = fs.readFileSync(abs)
    const created = await payload.create({
      collection: 'media',
      data: { alt: '品牌形象影片（手機直式蒙太奇）' },
      file: { data, name: filename, mimetype: 'video/mp4', size: data.length },
    })
    mediaId = relId(created)
    log(`＋ 媒體庫新增 ${filename}（id=${mediaId}）`)
  }
  if (mediaId == null) throw new Error('媒體建立失敗')

  const homepage = (await payload.findGlobal({ slug: 'homepage-settings', depth: 0 })) as unknown as Record<string, unknown>
  const cp = (homepage.coverPage as Record<string, unknown>) || {}
  await payload.updateGlobal({
    slug: 'homepage-settings',
    data: {
      coverPage: {
        ...cp,
        heroVideo: relId(cp.heroVideo),
        heroVideoMobile: mediaId,
        heroImage: relId(cp.heroImage),
        sideImage: relId(cp.sideImage),
        sideVideo: relId(cp.sideVideo),
        sections: ((cp.sections as Array<Record<string, unknown>>) || []).map((s) => ({
          layout: s.layout,
          media: relId(s.media),
          mediaRight: relId(s.mediaRight),
          mediaThird: relId(s.mediaThird),
          heading: s.heading ?? null,
          caption: s.caption ?? null,
          link: s.link ?? null,
        })),
      },
    } as never,
  })
  log('✅ 手機 hero 已改蒙太奇直式；Reel 專屬媒體牆 FILM 格（手機不再重複）')
  process.exit(0)
}

await main()
