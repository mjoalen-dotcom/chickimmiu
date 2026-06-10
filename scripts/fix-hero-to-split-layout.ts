/**
 * Switch /pages/ckmu-on-show hero to split-left layout
 * ─────────────────────────────────────────────────────
 * User feedback: BANNER 不是高度問題是寬度問題 + 金老佛爺的臉被遮住了
 * Fix: 改用「左圖右文」分欄 layout，圖片完整呈現不被文字疊住。
 *
 * Admin 後台可在 /admin/collections/pages/3 編輯該頁面 magazine-cover
 * block，切換 layout 為其他選項（split-right / cover-left/center/bottom）。
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const PAGE_SLUG = 'ckmu-on-show'

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

async function main() {
  log('🎨 Switching hero to split-left layout (image fully visible)')
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
        layout: 'split-left',
        theme: 'light', // 改回 light theme（dark 是配 cover layout 黑遮罩用）
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
  log(`   ✓ Page id=${page.id} hero switched to split-left`)
  log('\n🎉 Done. Edit anytime at:')
  log('   https://pre.chickimmiu.com/admin/collections/pages/3')
}

await main()
