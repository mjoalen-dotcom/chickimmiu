/**
 * Set homepage hero layout override (chuu 化改版 ops script)
 * ──────────────────────────────────────────────────────────
 * 首頁 hero 版型解析順序：homepage-settings.heroLayoutOverride >
 * activeTheme.heroLayout > 程式預設。此腳本只動 override 欄位，
 * 不碰 site-themes，後台隨時可在 全域 > 首頁設定 改回 inherit。
 *
 * 用法（專案根目錄）：
 *   NODE_ENV=production pnpm payload run scripts/set-homepage-hero-variant.ts -- editorial
 *   合法值：inherit | split | editorial | cinematic | magazine
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const VALID = ['inherit', 'split', 'editorial', 'cinematic', 'magazine']

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

async function main() {
  const variant = process.argv[process.argv.length - 1]
  if (!VALID.includes(variant)) {
    throw new Error(`需要指定版型參數（${VALID.join(' | ')}），收到：${variant}`)
  }

  const payload = await getPayload({ config })
  const before = await payload.findGlobal({ slug: 'homepage-settings', depth: 0 })
  log(`heroLayoutOverride: ${String(before.heroLayoutOverride)} → ${variant}`)

  await payload.updateGlobal({
    slug: 'homepage-settings',
    data: { heroLayoutOverride: variant },
  })
  log('✅ done（首頁 ISR 300 秒內生效，或重新 build/restart 立即生效）')
  process.exit(0)
}

await main()
