/**
 * navigation-settings.footerSections Help 區補「新手教學 /guide」連結（冪等）
 * ──────────────────────────────────────────────────────────────────────────
 * Footer 有 CMS footerSections 時走 CMS、不吃程式 fallback（Footer.tsx:175），
 * 所以 /guide 入口要補進 CMS 資料。已存在 href=/guide 就跳過，可重複執行。
 *
 * 用法（專案根目錄）：
 *   NODE_ENV=production pnpm payload run scripts/add-footer-guide-link.ts
 */

import { getPayload } from 'payload'
import config from '@payload-config'

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

async function main() {
  const payload = await getPayload({ config })
  const nav = (await payload.findGlobal({ slug: 'navigation-settings', depth: 0 })) as unknown as Record<string, unknown>
  const sections = (nav.footerSections as Array<{ title?: string; links?: Array<{ label?: string; href?: string }> }> | null) || []

  if (!sections.length) {
    log('CMS footerSections 未設定 — Footer 走程式 fallback（已含 /guide），不需修改')
    process.exit(0)
  }

  const hasGuide = sections.some((s) => (s.links || []).some((l) => l.href === '/guide'))
  if (hasGuide) {
    log('footerSections 已有 /guide 連結，跳過')
    process.exit(0)
  }

  const helpSection = sections.find((s) => (s.title || '').toLowerCase() === 'help') || sections[0]
  helpSection.links = [{ label: '新手教學', href: '/guide' }, ...(helpSection.links || [])]

  await payload.updateGlobal({
    slug: 'navigation-settings',
    data: { footerSections: sections } as never,
  })
  log(`✅ 已把「新手教學 /guide」加入 footer「${helpSection.title}」區第一位`)
  process.exit(0)
}

await main()
