/**
 * Batch 4 — BlogCategories collection + migration seed 驗證（乾淨 temp DB）。
 *   驗證 hand-written CREATE TABLE 與 Payload collection 對齊（讀/寫/seed）。
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const results: Array<{ name: string; ok: boolean; detail: string }> = []
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail })
  process.stdout.write(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}\n`)
}

async function main() {
  const payload = await getPayload({ config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any
  try {
    const cats = await p.find({ collection: 'blog-categories', sort: 'displayOrder', limit: 50, overrideAccess: true })
    check('5 seeded categories', cats.totalDocs === 5, `total=${cats.totalDocs}`)
    const byValue: Record<string, string> = Object.fromEntries(cats.docs.map((c: Record<string, unknown>) => [c.value, c.name]))
    check('styling → 穿搭教學', byValue['styling'] === '穿搭教學', byValue['styling'])
    check('trends → 時尚趨勢', byValue['trends'] === '時尚趨勢', byValue['trends'])
    check('new-arrivals → 新品介紹', byValue['new-arrivals'] === '新品介紹', byValue['new-arrivals'])
    check('brand-story → 品牌故事', byValue['brand-story'] === '品牌故事', byValue['brand-story'])
    check('promotions → 優惠活動', byValue['promotions'] === '優惠活動', byValue['promotions'])
    check('displayOrder: styling first (order 1)', cats.docs[0]?.value === 'styling' && cats.docs[0]?.displayOrder === 1, `first=${cats.docs[0]?.value}/${cats.docs[0]?.displayOrder}`)
    // 透過 Payload 寫入（驗證 collection ↔ table 欄位對齊，含 seo group）
    await p.update({ collection: 'blog-categories', id: cats.docs[0].id, data: { description: '測試描述', seo: { metaTitle: 'T' } }, overrideAccess: true })
    const re = await p.findByID({ collection: 'blog-categories', id: cats.docs[0].id })
    check('update persists (description + seo group)', re.description === '測試描述' && re.seo?.metaTitle === 'T', `desc=${re.description} seo=${re.seo?.metaTitle}`)
  } catch (e) {
    check('blog-categories suite', false, e instanceof Error ? e.message : String(e))
  }

  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  process.stdout.write(`\n=== Batch 4 (blog) verify: ${passed} PASS / ${failed} FAIL (of ${results.length}) ===\n`)
  if (failed > 0) process.exitCode = 1
}

await main()
