/**
 * Seed FAQPageSettings — 把 lib/cs/faqDefaults 的標準問答併進 CMS
 * ─────────────────────────────────────────────────────────────
 * 為什麼要 seed 而不是只改 code：prod 的 faq-page-settings 已經有資料，
 * /faq 頁與 AI 客服知識庫都讀 CMS，改 code 的 fallback 在 prod 不會生效。
 *
 * 合併策略（不覆蓋客服的手動編輯）：
 *   - 分類以「名稱」比對：沒有的就新增，有的沿用既有 icon
 *   - 問答以「題目」比對：沒有的補進去；已存在的一律不動，
 *     除非該題在 faqDefaults 標了 overwrite（用於修正過期資訊）
 *   - CMS 有、預設清單沒有的分類/問答一律保留，排在後面
 *
 * 順帶把 global-settings 的公司地址補上「信義區」（若還沒有），
 * AI 客服的商家事實直接讀這個欄位。
 *
 * Usage:
 *   pnpm seed:faq           # 實際寫入 DB
 *   pnpm seed:faq:dry       # 只印 log，不動 DB
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { FAQ_DEFAULT_CATEGORIES } from '../lib/cs/faqDefaults'

const DRY_RUN = process.argv.includes('--dry-run')

function log(msg: string) {
  process.stderr.write('[seedFaqDefaults] ' + msg + '\n')
}

const keepAlive = setInterval(() => {}, 60_000)

process.on('unhandledRejection', (e: unknown) => {
  log('UNHANDLED REJECTION: ' + (e instanceof Error ? e.stack || e.message : String(e)))
  process.exit(1)
})

interface CmsItem {
  question?: string | null
  answer?: string | null
  richAnswer?: unknown
  [k: string]: unknown
}
interface CmsCategory {
  icon?: string | null
  title?: string | null
  items?: CmsItem[]
  [k: string]: unknown
}

const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, '').trim()

async function main() {
  log('start; dry-run=' + DRY_RUN)
  const payload = await getPayload({ config })

  const current = (await payload.findGlobal({
    slug: 'faq-page-settings',
    depth: 0,
  })) as unknown as { categories?: CmsCategory[] }

  const existing: CmsCategory[] = Array.isArray(current?.categories) ? current.categories : []
  const changes: string[] = []
  const merged: CmsCategory[] = []
  const usedTitles = new Set<string>()

  for (const want of FAQ_DEFAULT_CATEGORIES) {
    const found = existing.find((c) => norm(c.title) === norm(want.title))
    if (found) usedTitles.add(norm(found.title))

    const items: CmsItem[] = found?.items ? [...found.items] : []
    for (const wantItem of want.items) {
      const idx = items.findIndex((i) => norm(i.question) === norm(wantItem.question))
      if (idx === -1) {
        items.push({ question: wantItem.question, answer: wantItem.answer })
        changes.push(`+ ${want.title} / ${wantItem.question}`)
      } else if (wantItem.overwrite && norm(items[idx].answer) !== norm(wantItem.answer)) {
        // richAnswer 若有內容會在前台優先顯示，覆蓋純文字等於沒改 → 一併清掉
        items[idx] = { ...items[idx], answer: wantItem.answer, richAnswer: null }
        changes.push(`~ ${want.title} / ${wantItem.question}（覆蓋過期內容）`)
      }
    }

    if (!found) changes.push(`+ 新分類「${want.title}」`)
    merged.push({
      ...(found || {}),
      icon: (found?.icon as string) || want.icon,
      title: want.title,
      items,
    })
  }

  // CMS 有、預設清單沒有的分類 → 保留在後面，不刪客服自己加的內容
  for (const c of existing) {
    if (!usedTitles.has(norm(c.title))) {
      merged.push(c)
      log(`保留 CMS 自訂分類「${c.title}」`)
    }
  }

  if (!changes.length) {
    log('FAQ 內容已是最新，無需變更')
  } else {
    log(`共 ${changes.length} 項變更：`)
    changes.forEach((c) => log('  ' + c))
    if (!DRY_RUN) {
      await payload.updateGlobal({
        slug: 'faq-page-settings',
        data: { categories: merged } as unknown as Parameters<typeof payload.updateGlobal>[0]['data'],
      })
      log('✓ faq-page-settings 已更新')
    }
  }

  /* 公司地址補「信義區」——AI 客服的商家事實直接讀這欄 */
  const globalSettings = (await payload.findGlobal({
    slug: 'global-settings',
    depth: 0,
  })) as unknown as { businessInfo?: { address?: string | null } }
  const addr = String(globalSettings?.businessInfo?.address || '')
  if (addr && addr.includes('基隆路一段68號9樓') && !addr.includes('信義區')) {
    const next = addr.replace('台北市', '台北市信義區')
    log(`地址補區名：「${addr}」→「${next}」`)
    if (!DRY_RUN) {
      await payload.updateGlobal({
        slug: 'global-settings',
        data: {
          businessInfo: { ...(globalSettings.businessInfo || {}), address: next },
        } as unknown as Parameters<typeof payload.updateGlobal>[0]['data'],
      })
      log('✓ global-settings.businessInfo.address 已更新')
    }
  }

  log('done')
  clearInterval(keepAlive)
  process.exit(0)
}

// ⚠️ MUST be top-level await — `payload run` 會 `await import(script); process.exit(0);`
await main().catch((e: unknown) => {
  log('FATAL: ' + (e instanceof Error ? e.stack || e.message : String(e)))
  process.exit(1)
})
