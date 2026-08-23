/**
 * 分類體系精品化重整（2026-08-24，工作流 luxury-taxonomy-design 定稿落地）
 * ──────────────────────────────────────────────────────────────────────
 * 現況：135 分類其中 104 空殼（Shopline 遺產）、飾品 202 件掛根、23 件藏在
 * 停用分類、14 件未分類。本腳本執行 P0+P1：
 *   1) 備份 products.category_id（_backup_product_categories_20260824）
 *   2) 依定稿樹「收編改名」既有分類 + 建缺少節點（兩層、全部有貨支撐）
 *   3) 38 條優先序關鍵字規則自動歸類全部商品（rightmost 中心語演算法）
 *   4) SQL 批次搬移 category_id（繞過 hooks；零命中者原地不動進報告）
 *   5) 重算 productCount、停用「不在新樹且已空」的殭屍分類
 *   6) 產出報告 docs/reports/category-restructure-20260824.md
 * 回滾：UPDATE products p SET category_id=b.category_id
 *       FROM _backup_product_categories_20260824 b WHERE p.id=b.product_id;
 *
 * 用法：NODE_ENV=production pnpm payload run scripts/restructure-categories-luxury.ts
 */

import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { runSql } from '../src/lib/db/dialectSafeSql'

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

/* ── 定稿分類樹（adoptId = 收編的舊分類 id，來自 2026-08-24 DB 盤點） ── */
type Node = {
  slug: string
  name: string
  sortOrder: number
  parent: string | null // parent slug
  adoptId?: number
}
const TREE: Node[] = [
  { slug: 'dresses', name: '洋裝', sortOrder: 20, parent: null, adoptId: 1 },
  { slug: 'sets', name: '套裝', sortOrder: 21, parent: 'dresses', adoptId: 67 },
  { slug: 'tops', name: '上衣', sortOrder: 30, parent: null, adoptId: 3 },
  { slug: 'shirts', name: '襯衫', sortOrder: 31, parent: 'tops', adoptId: 64 },
  { slug: 'camis', name: '背心', sortOrder: 32, parent: 'tops' },
  { slug: 'knitwear', name: '針織', sortOrder: 40, parent: null, adoptId: 65 },
  { slug: 'outerwear', name: '外套', sortOrder: 50, parent: null, adoptId: 4 },
  { slug: 'bottoms', name: '裙褲', sortOrder: 60, parent: null },
  { slug: 'pants', name: '長褲', sortOrder: 61, parent: 'bottoms', adoptId: 72 },
  { slug: 'shorts', name: '短褲', sortOrder: 62, parent: 'bottoms', adoptId: 73 },
  { slug: 'skirts', name: '裙裝', sortOrder: 63, parent: 'bottoms', adoptId: 69 },
  { slug: 'jewelry', name: '飾品', sortOrder: 70, parent: null, adoptId: 12 },
  { slug: 'earrings', name: '耳環', sortOrder: 71, parent: 'jewelry', adoptId: 86 },
  { slug: 'necklaces', name: '頸飾', sortOrder: 72, parent: 'jewelry', adoptId: 85 },
  { slug: 'rings', name: '戒指', sortOrder: 73, parent: 'jewelry', adoptId: 84 },
  { slug: 'hair', name: '髮飾', sortOrder: 74, parent: 'jewelry', adoptId: 128 },
  { slug: 'accessories', name: '配件生活', sortOrder: 80, parent: null, adoptId: 5 },
  { slug: 'shoes', name: '鞋靴', sortOrder: 81, parent: 'accessories', adoptId: 74 },
  { slug: 'bags', name: '包袋', sortOrder: 82, parent: 'accessories', adoptId: 75 },
  { slug: 'swimwear', name: '泳裝', sortOrder: 83, parent: 'accessories', adoptId: 10 },
  { slug: 'lifestyle', name: '生活雜貨', sortOrder: 84, parent: 'accessories' },
]

/* ── 歸類規則引擎（工作流定稿 §4） ── */
function stripName(raw: string): string {
  let s = raw
  s = s.replace(/^\s*\[?\s*(現貨|預購|福利品)\s*\]?\s*/g, '')
  s = s.replace(/^\s*\[?\s*(現貨|預購|福利品)\s*\]?\s*/g, '') // 前綴可能疊兩個
  s = s.replace(/\[[^\]]*\]\s*$/g, '')
  return s.trim()
}

const RE = {
  lifestyle: /金老佛爺廚房|抹布|杯墊|手帕|口水巾|開瓶器|磁鐵|鑰匙圈|掛飾|熊來運轉|來報到|財圓滾滾|狗來福|擺飾/,
  hair: /彈夾|抓夾|鯊魚夾|大腸圈|髮箍|髮夾|髮帶|髮圈|髮飾/,
  earrings: /耳環|耳針|耳扣|耳釦|耳夾/,
  necklaces: /項鍊|頸鍊|鎖骨鍊|脖圍|脖環|choker/i,
  rings: /戒指|對戒/,
  jewelryRoot: /手鍊|手環|腳鍊|925|純銀/,
  bags: /托特|霍博|水桶包|側背|斜背|肩背|後背包|手拿包/,
  bagTail: /包$/,
  bagExclude: /包臀|包芯|包裙/,
  shoes: /鞋|靴|樂福|瑪莉珍|涼拖/,
  swimwear: /泳|比基尼/,
  beltLike: /皮帶|腰帶/,
  beltExclude: /附腰帶|含腰帶|綁帶|附皮帶/,
  accRoot: /墨鏡|眼鏡|襪|圍巾|手套/,
  hatStandalone: /(?:^|[^連])帽(?!T)/,
  knitStrong: /毛衣|毛衫|線衫|開襟|開衫|cardigan/i,
  knit: /針織/,
  dressWords: /洋裝|連身裙|連衣裙|長洋|短洋/,
  outerWords: /大衣|夾克|西裝外套|西外|風衣/,
  sets: /套裝|兩件式|三件式|成套|\bset\b/i,
  jumpsuit: /連身褲/,
  overallPants: /吊帶褲/,
}

// rightmost 中心語詞典（最長詞先比；取命中起點最右者）
const RIGHTMOST: Array<{ slug: string; words: string[] }> = [
  { slug: 'dresses', words: ['連身裙', '連衣裙', '洋裝', '長洋', '短洋', '小禮服', '禮服'] },
  { slug: 'shirts', words: ['雪紡衫', '襯衫', 'blouse'] },
  { slug: 'camis', words: ['小可愛', '細肩帶', '一字領', '平口', '背心'] },
  { slug: 'tops', words: ['大學T', '帽T', '棉T', '長T', 'T恤', 'Tee', 'polo', '衛衣', '罩衫', '上衣', '衫'] },
  { slug: 'outerwear', words: ['西裝外套', '外套', '大衣', '風衣', '夾克', '西外', '鋪棉', '羽絨', '皮衣', '斗篷', '披肩'] },
  { slug: 'skirts', words: ['半身裙', '百褶裙', '魚尾裙', 'A字裙', '紗裙', '窄裙', '褲裙', '裙'] },
  { slug: 'shorts', words: ['短褲'] },
  { slug: 'pants', words: ['牛仔褲', '西裝褲', '直筒褲', '喇叭褲', '內搭褲', '寬褲', 'legging', '褲'] },
]

function classify(rawName: string): string | null {
  const n = stripName(rawName)
  // Step 2 非服裝域
  if (RE.lifestyle.test(n)) return 'lifestyle'
  if (RE.hair.test(n)) return 'hair'
  if (RE.earrings.test(n)) return 'earrings'
  if (RE.necklaces.test(n)) return 'necklaces'
  if (RE.rings.test(n)) return 'rings'
  if ((RE.bags.test(n) || (RE.bagTail.test(n) && !RE.bagExclude.test(n))) && !RE.bagExclude.test(n)) return 'bags'
  if (RE.shoes.test(n)) return 'shoes'
  if (RE.swimwear.test(n)) return 'swimwear'
  if (RE.beltLike.test(n) && !RE.beltExclude.test(n)) return 'accessories'
  if (RE.accRoot.test(n)) return 'accessories'
  // Step 3 針織家族
  if (RE.knitStrong.test(n)) return 'knitwear'
  if (RE.knit.test(n)) {
    if (RE.dressWords.test(n)) return 'dresses'
    if (RE.outerWords.test(n)) return 'outerwear'
    if (/裙/.test(n)) return 'skirts'
    if (/褲/.test(n)) return 'pants'
    return 'knitwear'
  }
  // Step 4 套裝
  if (RE.sets.test(n)) return 'sets'
  // Step 5 連身家族
  if (RE.jumpsuit.test(n)) return 'dresses'
  if (RE.overallPants.test(n)) return 'pants'
  // Step 5+6 rightmost 中心語
  // 比「結束位置」而非起始位置：襯衫 vs 衫、短褲 vs 褲 的結尾相同時
  // 長詞才是真正的中心語（起始位置比較會讓單字 衫/褲 永遠劫走長詞）
  let best: { slug: string; end: number; len: number } | null = null
  for (const group of RIGHTMOST) {
    for (const w of group.words) {
      const idx = n.toLowerCase().lastIndexOf(w.toLowerCase())
      if (idx >= 0) {
        const end = idx + w.length
        if (!best || end > best.end || (end === best.end && w.length > best.len)) {
          best = { slug: group.slug, end, len: w.length }
        }
      }
    }
  }
  if (best) return best.slug
  // 純飾品件最後補撈：韓劇 IP 戒款常以「XX戒」結尾（五指戒/組合戒/圓圈戒）
  if (/戒(?:$|[\s([（])/.test(n)) return 'rings'
  if (/[鍊鏈](?:$|[\s([（])/.test(n)) return 'jewelry'
  if (RE.jewelryRoot.test(n)) return 'jewelry'
  if (RE.hatStandalone.test(n)) return 'accessories'
  return null
}

function relId(val: unknown): number | null {
  if (val == null) return null
  if (typeof val === 'number') return val
  if (typeof val === 'string') return Number(val) || null
  if (typeof val === 'object') return relId((val as Record<string, unknown>).id)
  return null
}

async function main() {
  const payload = await getPayload({ config })

  // ── 1. 備份 ──
  await runSql(
    payload,
    sql.raw(`CREATE TABLE IF NOT EXISTS _backup_product_categories_20260824 AS
     SELECT id AS product_id, category_id FROM products`),
  )
  log('✅ 1/6 備份 _backup_product_categories_20260824')

  // ── 2. 樹改造：收編改名 + 補建（先父後子） ──
  // 學既有資料的 level 值格式
  const sampleRoot = (await payload.find({ collection: 'categories', where: { parent: { exists: false } }, limit: 1, depth: 0 }))
    .docs[0] as unknown as Record<string, unknown>
  const levelRootVal = (sampleRoot?.level as string | number) ?? 1
  const sampleChild = (await payload.find({ collection: 'categories', where: { parent: { exists: true } }, limit: 1, depth: 0 }))
    .docs[0] as unknown as Record<string, unknown>
  const levelChildVal = (sampleChild?.level as string | number) ?? 2

  const slugToId = new Map<string, number>()
  for (const node of TREE) {
    const parentId = node.parent ? slugToId.get(node.parent) ?? null : null
    const data: Record<string, unknown> = {
      name: node.name,
      slug: node.slug,
      parent: parentId,
      sortOrder: node.sortOrder,
      isActive: true,
      level: parentId ? levelChildVal : levelRootVal,
    }
    // 先找收編對象，再找同 slug，最後新建
    let id: number | null = null
    if (node.adoptId != null) {
      try {
        const doc = await payload.findByID({ collection: 'categories', id: node.adoptId, depth: 0 })
        if (doc) id = relId(doc)
      } catch { /* 舊 id 不在就走 slug/新建 */ }
    }
    if (id == null) {
      const bySlug = await payload.find({ collection: 'categories', where: { slug: { equals: node.slug } }, limit: 1, depth: 0 })
      if (bySlug.docs[0]) id = relId(bySlug.docs[0])
    }
    // slug 有 unique 約束：若目標 slug 被「別的」列占用（Shopline 殭屍），
    // 先把占用者改名讓位（該列稍後會被停用）
    {
      const holder = await payload.find({ collection: 'categories', where: { slug: { equals: node.slug } }, limit: 1, depth: 0 })
      const holderId = holder.docs[0] ? relId(holder.docs[0]) : null
      if (holderId != null && holderId !== id) {
        await payload.update({
          collection: 'categories',
          id: holderId,
          data: { slug: `${node.slug}-legacy-${holderId}` } as never,
          overrideAccess: true,
          depth: 0,
        })
        log(`  · slug「${node.slug}」原被 id=${holderId} 占用，已改名讓位`)
      }
    }
    if (id != null) {
      await payload.update({ collection: 'categories', id, data: data as never, overrideAccess: true, depth: 0 })
    } else {
      const created = await payload.create({ collection: 'categories', data: data as never, overrideAccess: true, depth: 0 })
      id = relId(created)
    }
    if (id == null) throw new Error(`節點 ${node.slug} 建立失敗`)
    slugToId.set(node.slug, id)
  }
  log(`✅ 2/6 分類樹就緒（${TREE.length} 節點）：${[...slugToId.entries()].map(([s, i]) => `${s}=${i}`).join(' ')}`)

  // ── 3+4. 全商品歸類 + 批次搬移 ──
  const moves: Array<{ id: number; from: number | null; to: number; name: string }> = []
  const pending: Array<{ id: number; name: string; current: number | null }> = []
  let page = 1
  for (;;) {
    const batch = await payload.find({ collection: 'products', limit: 200, page, depth: 0, sort: 'id', overrideAccess: true })
    for (const doc of batch.docs as unknown as Record<string, unknown>[]) {
      const pid = relId(doc.id)
      if (pid == null) continue
      const name = String(doc.name ?? '')
      const current = relId(doc.category)
      const targetSlug = classify(name)
      if (!targetSlug) {
        pending.push({ id: pid, name, current })
        continue
      }
      const targetId = slugToId.get(targetSlug)!
      if (current !== targetId) moves.push({ id: pid, from: current, to: targetId, name })
    }
    if (!batch.hasNextPage) break
    page += 1
  }
  log(`歸類完成：需搬移 ${moves.length} 件、零命中 ${pending.length} 件（原地不動待人工）`)

  for (let i = 0; i < moves.length; i += 200) {
    const chunk = moves.slice(i, i + 200)
    const values = chunk.map((m) => `(${m.id}, ${m.to})`).join(',')
    await runSql(
      payload,
      sql.raw(`UPDATE products AS p SET category_id = v.cid
       FROM (VALUES ${values}) AS v(pid, cid)
       WHERE p.id = v.pid`),
    )
  }
  log(`✅ 3+4/6 已搬移 ${moves.length} 件`)

  // ── 5. 重算 productCount + 停用殭屍 ──
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
  const keepIds = [...slugToId.values()].join(',')
  await runSql(
    payload,
    sql.raw(`UPDATE categories SET is_active = false
     WHERE id NOT IN (${keepIds}) AND product_count = 0`),
  )
  log('✅ 5/6 productCount 重算 + 空殭屍分類停用（新樹之外仍有貨的分類保留 active 供人工）')

  // ── 6. 報告 ──
  const lines: string[] = ['# 分類重整報告 2026-08-24', '', '## 新樹各分類件數']
  for (const node of TREE) {
    const id = slugToId.get(node.slug)!
    const cat = (await payload.findByID({ collection: 'categories', id, depth: 0 })) as unknown as Record<string, unknown>
    lines.push(`- ${node.parent ? '　└ ' : ''}${node.name} (${node.slug}, id=${id})：${cat.productCount ?? '?'} 件`)
  }
  lines.push('', `## 搬移 ${moves.length} 件（抽樣前 60）`, ...moves.slice(0, 60).map((m) => `- #${m.id} ${m.name}（${m.from} → ${m.to}）`))
  lines.push('', `## 零命中待人工 ${pending.length} 件（全列）`, ...pending.map((p) => `- #${p.id} ${p.name}（現在分類 ${p.current}）`))
  lines.push('', '## 回滾', '```sql', 'UPDATE products p SET category_id = b.category_id FROM _backup_product_categories_20260824 b WHERE p.id = b.product_id;', '```')
  const reportDir = path.resolve(process.cwd(), 'docs/reports')
  fs.mkdirSync(reportDir, { recursive: true })
  const reportPath = path.join(reportDir, 'category-restructure-20260824.md')
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8')
  log(`✅ 6/6 報告：${reportPath}`)
  log(`零命中前 15 件：${pending.slice(0, 15).map((p) => p.name).join('｜')}`)
  process.exit(0)
}

await main()
