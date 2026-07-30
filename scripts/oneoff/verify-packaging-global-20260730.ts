/**
 * 煙霧測試：PackagingPageSettings global 的 drizzle schema ↔ 手寫 migration 表對齊。
 * 用法：DATABASE_URI=file:./data/verify-packaging.db pnpm payload run scripts/oneoff/verify-packaging-global-20260730.ts
 * findGlobal（讀路徑）+ updateGlobal 帶 array（寫路徑，驗 _order/_parent_id/id 欄位）。
 */
import { getPayload } from 'payload'
import config from '../../src/payload.config'

function diag(msg: string) {
  process.stderr.write('[verify-packaging] ' + msg + '\n')
}

async function main() {
  const payload = await getPayload({ config })

  const g = await payload.findGlobal({ slug: 'packaging-page-settings' })
  diag('findGlobal OK — hero.title=' + JSON.stringify(g?.hero?.title ?? null))

  const updated = await payload.updateGlobal({
    slug: 'packaging-page-settings',
    data: {
      hero: { title: '商品包裝' },
      features: {
        items: [
          { icon: 'Sparkles', title: '測試卡', description: '寫路徑煙霧測試' },
        ],
      },
      process: {
        steps: [{ step: '01', title: '測試步驟', description: '寫路徑煙霧測試' }],
      },
    },
  })
  diag(
    'updateGlobal OK — items=' +
      String(updated?.features?.items?.length ?? 0) +
      ' steps=' +
      String(updated?.process?.steps?.length ?? 0),
  )

  const again = await payload.findGlobal({ slug: 'packaging-page-settings' })
  diag(
    'reread OK — items=' +
      String(again?.features?.items?.length ?? 0) +
      ' steps=' +
      String(again?.process?.steps?.length ?? 0),
  )

  process.exit(0)
}

await main()
