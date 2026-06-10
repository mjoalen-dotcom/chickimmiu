/**
 * Switch /pages/ckmu-on-show hero to 'banner' layout
 * ────────────────────────────────────────────────────
 * 原因：用戶提供的圖本身就是完整 banner（含品牌 CHIC KIM & MIU + 模特
 *      + 標語「看藝人喜愛的CKMU造型！」），split-left 把它跟旁邊文字
 *      並排造成內容重複 + 視覺混亂。
 *
 * 新 banner layout：圖置中 max-w-3xl，保留原 aspect ratio，不疊任何
 * 文字/overlay，圖本身就是內容。
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const PAGE_SLUG = 'ckmu-on-show'

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

async function main() {
  log("🎨 Switching hero to 'banner' layout (image-only, no overlay text)")
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
        layout: 'banner',
        theme: 'light',
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
  log(`   ✓ Page id=${page.id} hero → banner`)
  log('\n🎉 Done. Visit: https://pre.chickimmiu.com/pages/ckmu-on-show')
  log('   Admin: https://pre.chickimmiu.com/admin/collections/pages/3')
}

await main()
