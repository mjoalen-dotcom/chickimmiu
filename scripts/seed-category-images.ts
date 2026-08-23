/**
 * 分類形象圖鋪底（2026-08-24，冪等）
 * ──────────────────────────────────
 * LV/Dior 式分類 banner 需要每個分類有形象圖與一句情境文案。
 * 本腳本對新分類樹的每個節點：image 空 → 取該分類（含子分類）最新
 * 商品的第一張圖鋪底；description 空 → 填精品語感一句話。
 * 後台隨時可換（Categories 編輯頁有「即時預覽」直看效果）。
 *
 * 用法：NODE_ENV=production pnpm payload run scripts/seed-category-images.ts
 */

import { getPayload } from 'payload'
import config from '@payload-config'

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

const COPY: Record<string, string> = {
  dresses: '一件完成的優雅——從日常約會到重要場合的命定洋裝。',
  sets: '整套的從容，上下身一次到位的名媛套裝。',
  tops: '衣櫥的基本盤，質感上衣讓每一天都好搭。',
  shirts: '俐落與溫柔並存，襯衫是最聰明的第一層。',
  camis: '疊穿或單穿都成立的輕盈選擇。',
  knitwear: '柔軟針織，把溫度穿在身上。',
  outerwear: '定調整體造型的最後一件——外套與大衣。',
  bottoms: '比例的秘密藏在下身，裙與褲的完整提案。',
  pants: '顯瘦與舒適兼得的褲裝選集。',
  shorts: '輕快俐落，夏日比例的好朋友。',
  skirts: '一步成型的女人味，裙裝選集。',
  jewelry: '細節見品味，點亮造型的飾品提案。',
  earrings: '框住臉龐光線的耳際風景。',
  necklaces: '鎖骨間的細緻存在感。',
  rings: '指尖上的個性宣言，含韓劇同款選集。',
  hair: '一夾定調，髮間的優雅細節。',
  accessories: '穿搭之外的生活風格選物。',
  shoes: '走路帶風的鞋履選集。',
  bags: '裝得下生活的質感包袋。',
  swimwear: '假期限定，泳裝選集。',
  lifestyle: '金老佛爺選物——把品味帶回家。',
}

async function main() {
  const payload = await getPayload({ config })

  const cats = await payload.find({
    collection: 'categories',
    where: { isActive: { equals: true } },
    limit: 100,
    depth: 0,
    sort: 'sortOrder',
  })

  for (const doc of cats.docs as unknown as Record<string, unknown>[]) {
    const id = relId(doc.id)
    if (id == null) continue
    const slug = String(doc.slug ?? '')
    const updates: Record<string, unknown> = {}

    if (relId(doc.image) == null) {
      // 該分類（含子分類）最新一件商品的第一張圖
      const kids = await payload.find({
        collection: 'categories',
        where: { parent: { equals: id } },
        limit: 50,
        depth: 0,
      })
      const catIds = [id, ...((kids.docs as unknown as Record<string, unknown>[]).map((k) => relId(k.id)).filter((v): v is number => v != null))]
      const prod = await payload.find({
        collection: 'products',
        where: { category: { in: catIds } },
        sort: '-createdAt',
        limit: 1,
        depth: 0,
      })
      const p = prod.docs[0] as unknown as Record<string, unknown> | undefined
      const images = p?.images as Array<{ image?: unknown }> | undefined
      const imgId = relId(images?.[0]?.image)
      if (imgId != null) updates.image = imgId
    }
    if (!doc.description && COPY[slug]) {
      updates.description = COPY[slug]
    }
    if (Object.keys(updates).length > 0) {
      await payload.update({ collection: 'categories', id, data: updates as never, overrideAccess: true, depth: 0 })
      log(`＋ ${doc.name}（${slug}）：${Object.keys(updates).join(' + ')}`)
    }
  }
  log('✅ 分類形象圖/文案鋪底完成（後台 Categories 可自行替換）')
  process.exit(0)
}

await main()
