/**
 * Visual cleanup: simplify hero + remove duplicate grid heading
 * ─────────────────────────────────────────────────────────────
 * User feedback: BANNER 太大、BANNER 文字和原來的文字看起來很亂
 *
 * Visual fix:
 * 1. MagazineCover: 已縮到 32-40vh + 簡化 padding（renderer 端改）
 * 2. CelebrityGrid: stats strip 改成 hero 邊緣懸浮卡（renderer 端改）
 *    取代原本「heading + subheading + ✦ 裝飾線」三層文字
 *
 * 此 seed 把 page 內容文字也簡化：
 *   - magazine-cover.subheading: 縮成更短的單行
 *   - magazine-cover.cornerLabels: 清空（renderer 已不渲染但清資料）
 *   - celebrity-grid.heading + subheading: 清空（讓 stats 卡接續）
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const PAGE_SLUG = 'ckmu-on-show'

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

async function main() {
  log('🎨 Cleaning up /pages/ckmu-on-show hero + grid text')
  const payload = await getPayload({ config })

  const found = await payload.find({
    collection: 'pages',
    where: { slug: { equals: PAGE_SLUG } },
    limit: 1,
    depth: 0,
  })
  const page = found.docs[0] as unknown as { id: number; layout?: unknown[] }
  if (!page) {
    log('   ✗ page not found')
    return
  }

  const oldLayout = (page.layout as Array<Record<string, unknown>>) || []
  const newLayout = oldLayout.map((block) => {
    if (block.blockType === 'magazine-cover') {
      return {
        ...block,
        issueLabel: 'CKMU ON SHOW',
        heading: '電視螢幕上的 CKMU',
        subheading: '從美鳳有約到 11 點熱吵店，國民藝人都在穿',
        cornerLabels: [], // 清空（cornerLabels 已不在 renderer 中顯示）
      }
    }
    if (block.blockType === 'celebrity-grid') {
      return {
        ...block,
        heading: '', // 清空：避免跟 hero「電視螢幕上的 CKMU」重複
        subheading: '', // 清空：stats 卡 + 卡片本身就講完故事了
      }
    }
    return block
  })

  await payload.update({
    collection: 'pages',
    id: page.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { layout: newLayout as any },
  })
  log(`   ✓ Page id=${page.id} content cleaned`)
  log('\n🎉 Done. Visit: https://pre.chickimmiu.com/pages/ckmu-on-show')
}

await main()
