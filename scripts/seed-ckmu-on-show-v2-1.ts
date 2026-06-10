/**
 * Seed CKMU ON SHOW — Stage 1.6 patch (v2.1)
 * ────────────────────────────────────────────
 * 把既有 18 筆 celebrity-features 補 slug + socialLinks（從 Stage 1.5
 * 升級而來，因為新增 subpage route /celebrity/[slug] 跟社群互惠導流）。
 *
 * - slug = sortOrder 兩位數編號（01..18）— 對應原 Shopline ckmuonshow-XX
 *   命名習慣（但 hash 改成 /celebrity/01..18 較語意化）
 * - socialLinks 預填：劉祝華（Joyce Liu）+ 丁士芬（Sophia Ting）—
 *   這兩位的 IG/FB 在原 Shopline 子頁可確認。其他 16 位先留空，
 *   admin 拿到藝人社群資料後從後台 /admin/collections/celebrity-features
 *   點開那筆 → 「藝人社群連結」區塊新增。
 *
 * Usage:
 *   pnpm payload run scripts/seed-ckmu-on-show-v2-1.ts
 *
 * 冪等：用 sortOrder 反查既有 row，update 而非 create。
 */

import { getPayload } from 'payload'
import config from '@payload-config'

type SocialPlatform = 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'threads' | 'line' | 'website'
type SocialLink = { platform: SocialPlatform; url: string; handle?: string }

type Patch = {
  sortOrder: number
  slug: string
  socialLinks: SocialLink[]
}

const PATCHES: Patch[] = [
  { sortOrder: 1, slug: '01', socialLinks: [] }, // 陳美鳳
  {
    sortOrder: 2,
    slug: '02',
    socialLinks: [
      { platform: 'facebook', url: 'https://www.facebook.com/profile.php?id=100044496213787', handle: 'Joyce Liu 劉祝華' },
      { platform: 'instagram', url: 'https://www.instagram.com/joyce1031joyce1031/', handle: '@joyce1031joyce1031' },
    ],
  }, // 劉祝華
  { sortOrder: 3, slug: '03', socialLinks: [] }, // 韓瑜
  { sortOrder: 4, slug: '04', socialLinks: [] }, // Melody
  { sortOrder: 5, slug: '05', socialLinks: [] }, // 楊智捷
  { sortOrder: 6, slug: '06', socialLinks: [] }, // 高昱晴
  { sortOrder: 7, slug: '07', socialLinks: [] }, // 葉俞璘
  { sortOrder: 8, slug: '08', socialLinks: [] }, // 廖廷娟
  {
    sortOrder: 9,
    slug: '09',
    socialLinks: [
      { platform: 'instagram', url: 'https://www.instagram.com/shihfent/', handle: '@shihfent' },
    ],
  }, // 丁士芬
  { sortOrder: 10, slug: '10', socialLinks: [] }, // 王淑麗
  { sortOrder: 11, slug: '11', socialLinks: [] }, // 房業涵
  { sortOrder: 12, slug: '12', socialLinks: [] }, // 陳靜宜
  { sortOrder: 13, slug: '13', socialLinks: [] }, // 李樺仙
  { sortOrder: 14, slug: '14', socialLinks: [] }, // 張予馨
  { sortOrder: 15, slug: '15', socialLinks: [] }, // 林季瑩
  { sortOrder: 16, slug: '16', socialLinks: [] }, // 呂心喻
  { sortOrder: 17, slug: '17', socialLinks: [] }, // 葉子菁
  { sortOrder: 18, slug: '18', socialLinks: [] }, // 劉佩綺
]

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

async function main() {
  log('🌱 Patching celebrity-features with slug + socialLinks (v2.1)')
  const payload = await getPayload({ config })

  for (const p of PATCHES) {
    const found = await payload.find({
      collection: 'celebrity-features',
      where: { sortOrder: { equals: p.sortOrder } },
      limit: 1,
      depth: 0,
    })
    const doc = found.docs[0] as unknown as { id: number; name: string } | undefined
    if (!doc) {
      log(`   ✗ sortOrder=${p.sortOrder} not found, skipping`)
      continue
    }

    await payload.update({
      collection: 'celebrity-features',
      id: doc.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { slug: p.slug, socialLinks: p.socialLinks } as any,
    })
    const note = p.socialLinks.length > 0 ? ` + ${p.socialLinks.length} social link(s)` : ''
    log(`   ✓ ${p.sortOrder}. ${doc.name} → slug=${p.slug}${note}`)
  }

  log('\n🎉 Done. Visit:')
  log('   - https://pre.chickimmiu.com/pages/ckmu-on-show')
  log('   - https://pre.chickimmiu.com/celebrity/01 (陳美鳳)')
  log('   - https://pre.chickimmiu.com/celebrity/02 (劉祝華 — 有社群連結展示)')
  log('   - https://pre.chickimmiu.com/celebrity/09 (丁士芬 — 有社群連結展示)')
}

await main()
