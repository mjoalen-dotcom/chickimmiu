/**
 * 精選企劃策展層 seed（2026-08-24 P2，冪等）
 * ────────────────────────────────────────
 * 建 5 個 isCollection 企劃分類，成員掛 products.additionalCategories
 * （PLP 的 category 篩選本就同時查 additionalCategories，零前台改動）：
 *   - 婚宴場合 OCCASION ← 備份表舊分類 28（婚禮/正式場合洋裝）
 *   - 顯瘦企劃 SLIM FIT ← 舊 25（螞蟻腰系列）
 *   - 通勤名媛 OFFICE   ← 舊 36（職場穿搭）
 *   - 韓劇同款 K-STYLE  ← 品名 IP 關鍵字（千頌伊/星你/製作人/她很漂亮/赫拉…）
 *   - 金老佛爺推薦 JIN'S PICK ← isHot 12 件起手（老佛爺後台自行增減）
 * 企劃形象圖 = 第一個成員的商品圖；已有成員/圖不重複加。
 *
 * 用法：NODE_ENV=production pnpm payload run scripts/seed-collections.ts
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

const COLLECTIONS = [
  { slug: 'jins-pick', name: '金老佛爺推薦', sortOrder: 210, description: 'JIN’S PICK——老佛爺親自點名的本季必收。' },
  { slug: 'k-style', name: '韓劇同款', sortOrder: 220, description: 'K-STYLE——千頌伊們戴過的那些，劇迷都懂。' },
  { slug: 'occasion', name: '婚宴場合', sortOrder: 230, description: 'OCCASION——喜宴、謝師、正式場合的得體提案。' },
  { slug: 'office', name: '通勤名媛', sortOrder: 240, description: 'OFFICE——週一到週五的優雅戰袍。' },
  { slug: 'slim-fit', name: '顯瘦企劃', sortOrder: 250, description: 'SLIM FIT——比例魔法，上身立刻懂。' },
] as const

const K_STYLE_RE = /千頌伊|星星的你|來自星星|製作人|她很漂亮|赫拉|金泰熙|韓藝瑟|孔孝真|主播同款/

async function ensureCollection(payload: Payload, def: (typeof COLLECTIONS)[number]): Promise<number> {
  const found = await payload.find({ collection: 'categories', where: { slug: { equals: def.slug } }, limit: 1, depth: 0 })
  const data = {
    name: def.name,
    slug: def.slug,
    parent: null,
    level: '1',
    sortOrder: def.sortOrder,
    isActive: true,
    isCollection: true,
    description: def.description,
  }
  if (found.docs[0]) {
    const id = relId(found.docs[0])!
    await payload.update({ collection: 'categories', id, data: data as never, overrideAccess: true, depth: 0 })
    return id
  }
  const created = await payload.create({ collection: 'categories', data: data as never, overrideAccess: true, depth: 0 })
  return relId(created)!
}

async function addMembers(payload: Payload, collectionId: number, productIds: number[]): Promise<number> {
  let added = 0
  for (const pid of productIds) {
    const doc = (await payload.findByID({ collection: 'products', id: pid, depth: 0 })) as unknown as Record<string, unknown>
    const existing = ((doc.additionalCategories as unknown[]) || []).map(relId).filter((v): v is number => v != null)
    if (existing.includes(collectionId)) continue
    await payload.update({
      collection: 'products',
      id: pid,
      data: { additionalCategories: [...existing, collectionId] } as never,
      overrideAccess: true,
      depth: 0,
    })
    added += 1
  }
  return added
}

async function idsFromBackupOldCategory(payload: Payload, oldCatId: number): Promise<number[]> {
  const res = (await runSql(
    payload,
    sql.raw(`SELECT product_id FROM _backup_product_categories_20260824 WHERE category_id = ${oldCatId}`),
  )) as { rows?: Array<{ product_id: number }> }
  return (res.rows ?? []).map((r) => Number(r.product_id)).filter((v) => Number.isFinite(v))
}

async function setImageFromFirstMember(payload: Payload, collectionId: number): Promise<void> {
  const cat = (await payload.findByID({ collection: 'categories', id: collectionId, depth: 0 })) as unknown as Record<string, unknown>
  if (relId(cat.image) != null) return
  const member = await payload.find({
    collection: 'products',
    where: { additionalCategories: { in: [collectionId] } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
  })
  const p = member.docs[0] as unknown as Record<string, unknown> | undefined
  const images = p?.images as Array<{ image?: unknown }> | undefined
  const imgId = relId(images?.[0]?.image)
  if (imgId != null) {
    await payload.update({ collection: 'categories', id: collectionId, data: { image: imgId } as never, overrideAccess: true, depth: 0 })
  }
}

async function main() {
  const payload = await getPayload({ config })

  const ids: Record<string, number> = {}
  for (const def of COLLECTIONS) {
    ids[def.slug] = await ensureCollection(payload, def)
  }
  log(`✅ 企劃分類就緒：${Object.entries(ids).map(([s, i]) => `${s}=${i}`).join(' ')}`)

  // 成員：備份表復活舊主題分類
  for (const [slug, oldId] of [['occasion', 28], ['slim-fit', 25], ['office', 36]] as const) {
    const pids = await idsFromBackupOldCategory(payload, oldId)
    const added = await addMembers(payload, ids[slug], pids)
    log(`＋ ${slug}：舊分類 ${oldId} 復活 ${pids.length} 件（新掛 ${added}）`)
  }

  // K-STYLE：品名 IP 關鍵字
  {
    const all = await payload.find({ collection: 'products', limit: 2000, depth: 0, overrideAccess: true })
    const hits = (all.docs as unknown as Record<string, unknown>[])
      .filter((p) => K_STYLE_RE.test(String(p.name ?? '')))
      .map((p) => relId(p.id))
      .filter((v): v is number => v != null)
    const added = await addMembers(payload, ids['k-style'], hits)
    log(`＋ k-style：IP 關鍵字命中 ${hits.length} 件（新掛 ${added}）`)
  }

  // JIN'S PICK：isHot 12 件起手
  {
    const hot = await payload.find({ collection: 'products', where: { isHot: { equals: true } }, sort: '-createdAt', limit: 12, depth: 0 })
    const pids = (hot.docs as unknown as Record<string, unknown>[]).map((p) => relId(p.id)).filter((v): v is number => v != null)
    const added = await addMembers(payload, ids['jins-pick'], pids)
    log(`＋ jins-pick：isHot 起手 ${pids.length} 件（新掛 ${added}）— 老佛爺後台可自行增減`)
  }

  for (const id of Object.values(ids)) {
    await setImageFromFirstMember(payload, id)
  }
  log('✅ 企劃形象圖鋪底完成。前台 /products「Collections」列即會顯示。')
  process.exit(0)
}

await main()
