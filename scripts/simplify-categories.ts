/**
 * 分類精簡（2026-08-24 Alan：「要精簡分類，你評估後執行」）
 * ──────────────────────────────────────────────────────
 * 評估結論：主分類 7 個保留；貼線子類併回上層（維度交給篩選器）：
 *   短褲(26) → 長褲（改名「褲裝」）
 *   背心(40) → 上衣（根）
 *   鞋靴(20)/包袋(18)/泳裝(12) → 配件生活（根）
 * 子分類 14 → 9；被併節點停用。備份 _backup_simplify_20260824 可回滾。
 *
 * 用法：NODE_ENV=production pnpm payload run scripts/simplify-categories.ts
 */

import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { runSql } from '../src/lib/db/dialectSafeSql'

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

function relId(val: unknown): number | null {
  if (val == null) return null
  if (typeof val === 'number') return val
  if (typeof val === 'string') return Number(val) || null
  if (typeof val === 'object') return relId((val as Record<string, unknown>).id)
  return null
}

async function idBySlug(payload: Payload, slug: string): Promise<number | null> {
  const r = await payload.find({ collection: 'categories', where: { slug: { equals: slug } }, limit: 1, depth: 0 })
  return r.docs[0] ? relId(r.docs[0]) : null
}

async function main() {
  const payload = await getPayload({ config })

  await runSql(
    payload,
    sql.raw(`CREATE TABLE IF NOT EXISTS _backup_simplify_20260824 AS
     SELECT id AS product_id, category_id FROM products`),
  )
  log('✅ 備份 _backup_simplify_20260824')

  const ids: Record<string, number> = {}
  for (const slug of ['pants', 'shorts', 'tops', 'camis', 'accessories', 'shoes', 'bags', 'swimwear']) {
    const id = await idBySlug(payload, slug)
    if (id == null) throw new Error(`找不到分類 ${slug}`)
    ids[slug] = id
  }

  // 合併搬移（SQL 批次，繞 hooks）
  const MERGES: Array<[from: string, to: string]> = [
    ['shorts', 'pants'],
    ['camis', 'tops'],
    ['shoes', 'accessories'],
    ['bags', 'accessories'],
    ['swimwear', 'accessories'],
  ]
  for (const [from, to] of MERGES) {
    await runSql(
      payload,
      sql.raw(`UPDATE products SET category_id = ${ids[to]} WHERE category_id = ${ids[from]}`),
    )
    log(`＋ ${from} → ${to}`)
  }

  // 長褲 → 褲裝（吸收短褲後語意）
  await payload.update({
    collection: 'categories',
    id: ids['pants'],
    data: { name: '褲裝' } as never,
    overrideAccess: true,
    depth: 0,
  })

  // 重算 productCount + 停用被併節點
  await runSql(
    payload,
    sql.raw(`UPDATE categories c SET product_count = COALESCE(s.cnt, 0)
     FROM (SELECT category_id, count(*) AS cnt FROM products GROUP BY category_id) s
     WHERE c.id = s.category_id`),
  )
  await runSql(
    payload,
    sql.raw(`UPDATE categories SET product_count = 0
     WHERE id NOT IN (SELECT DISTINCT category_id FROM products WHERE category_id IS NOT NULL)`),
  )
  const mergedIds = MERGES.map(([from]) => ids[from]).join(',')
  await runSql(payload, sql.raw(`UPDATE categories SET is_active = false WHERE id IN (${mergedIds})`))
  log('✅ 被併子類已停用、計數重算')

  // 最終樹輸出
  const finalCats = await payload.find({
    collection: 'categories',
    where: { isActive: { equals: true }, isCollection: { not_equals: true } } as never,
    sort: 'sortOrder',
    limit: 50,
    depth: 0,
  })
  for (const c of finalCats.docs as unknown as Record<string, unknown>[]) {
    log(`  ${c.parent ? '└ ' : ''}${c.name}（${c.slug}）：${c.productCount} 件`)
  }
  log('回滾：UPDATE products p SET category_id=b.category_id FROM _backup_simplify_20260824 b WHERE p.id=b.product_id;')
  process.exit(0)
}

await main()
