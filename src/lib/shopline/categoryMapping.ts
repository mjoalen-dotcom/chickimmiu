/**
 * Shopline → CHIC KIM & MIU 分類映射
 * 處理 Shopline CSV 中的 "Online Store Categories" 欄位
 * 格式範例: "Clothes>Dress", "Bottom>Pants", "Accessory- Jewelry", "NEW ARRIVAL"
 */

export interface CategoryMapping {
  shoplineKey: string      // Shopline 原始分類（小寫比對用）
  newCategoryName: string  // 新網站分類名稱
  newCategorySlug: string  // 新網站分類 slug
}

// 完整映射表 — 涵蓋 Shopline 所有可能分類
const CATEGORY_MAP: CategoryMapping[] = [
  // ── 洋裝 / Dress ──
  { shoplineKey: 'clothes>dress', newCategoryName: '連衣裙/洋裝 Dress', newCategorySlug: 'dresses' },
  { shoplineKey: 'dress', newCategoryName: '連衣裙/洋裝 Dress', newCategorySlug: 'dresses' },

  // ── 上衣 / Top ──
  { shoplineKey: 'clothes>top', newCategoryName: '上衣 Top', newCategorySlug: 'tops' },
  { shoplineKey: 'top', newCategoryName: '上衣 Top', newCategorySlug: 'tops' },
  { shoplineKey: 'clothes>blouse', newCategoryName: '襯衫 Blouse', newCategorySlug: 'blouse' },
  { shoplineKey: 'blouse', newCategoryName: '襯衫 Blouse', newCategorySlug: 'blouse' },

  // ── 針織 / Knit ──
  { shoplineKey: 'clothes>knit', newCategoryName: '針織 Knit', newCategorySlug: 'knit' },
  { shoplineKey: 'knit', newCategoryName: '針織 Knit', newCategorySlug: 'knit' },

  // ── 外套 / Outer ──
  { shoplineKey: 'clothes>outer', newCategoryName: '外套 Outer', newCategorySlug: 'outer' },
  { shoplineKey: 'outer', newCategoryName: '外套 Outer', newCategorySlug: 'outer' },
  { shoplineKey: 'clothes>jacket', newCategoryName: '外套 Outer', newCategorySlug: 'outer' },
  { shoplineKey: 'clothes>coat', newCategoryName: '外套 Outer', newCategorySlug: 'outer' },

  // ── 下著 / Bottom ──
  { shoplineKey: 'bottom>pants', newCategoryName: '長褲', newCategorySlug: 'long-pants' },
  { shoplineKey: 'bottom>skirt', newCategoryName: '所有裙子', newCategorySlug: 'all-skirts' },
  { shoplineKey: 'bottom>shorts', newCategoryName: '短褲', newCategorySlug: 'shorts' },
  { shoplineKey: 'bottom', newCategoryName: '下著 Bottom', newCategorySlug: 'bottoms' },
  { shoplineKey: 'pants', newCategoryName: '長褲', newCategorySlug: 'long-pants' },
  { shoplineKey: 'skirt', newCategoryName: '所有裙子', newCategorySlug: 'all-skirts' },

  // ── 套裝 / Set ──
  { shoplineKey: 'clothes>set', newCategoryName: '正式套裝 Formal Set', newCategorySlug: 'formal-sets' },
  { shoplineKey: 'set', newCategoryName: '正式套裝 Formal Set', newCategorySlug: 'formal-sets' },
  { shoplineKey: 'clothes>casual set', newCategoryName: '休閒套裝 Casual Set', newCategorySlug: 'casual-sets' },

  // ── 泳裝 ──
  { shoplineKey: 'clothes>swimwear', newCategoryName: '泳裝 Swimwear', newCategorySlug: 'swimwear' },
  { shoplineKey: 'swimwear', newCategoryName: '泳裝 Swimwear', newCategorySlug: 'swimwear' },

  // ── 配件 / Accessories ──
  { shoplineKey: 'accessories>bag', newCategoryName: '包包', newCategorySlug: 'bags' },
  { shoplineKey: 'accessory>bag', newCategoryName: '包包', newCategorySlug: 'bags' },
  { shoplineKey: 'accessory- bag', newCategoryName: '包包', newCategorySlug: 'bags' },
  { shoplineKey: 'accessories>hat', newCategoryName: '帽子/圍巾', newCategorySlug: 'hats-scarves' },
  { shoplineKey: 'accessory- hat', newCategoryName: '帽子/圍巾', newCategorySlug: 'hats-scarves' },
  { shoplineKey: 'accessories>glasses', newCategoryName: '眼鏡', newCategorySlug: 'glasses' },
  { shoplineKey: 'accessory- glasses', newCategoryName: '眼鏡', newCategorySlug: 'glasses' },
  { shoplineKey: 'accessories>belt', newCategoryName: '皮帶', newCategorySlug: 'belts' },
  { shoplineKey: 'accessory- belt', newCategoryName: '皮帶', newCategorySlug: 'belts' },
  { shoplineKey: 'accessories>shoes', newCategoryName: '鞋子', newCategorySlug: 'shoes' },
  { shoplineKey: 'accessory- shoes', newCategoryName: '鞋子', newCategorySlug: 'shoes' },
  { shoplineKey: 'accessories', newCategoryName: '配件 Accessories', newCategorySlug: 'accessories' },

  // ── 飾品 / Jewelry ──
  { shoplineKey: 'accessory- jewelry', newCategoryName: '飾品 Jewelry', newCategorySlug: 'jewelry' },
  { shoplineKey: 'accessory>jewelry', newCategoryName: '飾品 Jewelry', newCategorySlug: 'jewelry' },
  { shoplineKey: 'accessories>jewelry', newCategoryName: '飾品 Jewelry', newCategorySlug: 'jewelry' },
  { shoplineKey: 'jewelry>necklace', newCategoryName: '項鍊', newCategorySlug: 'necklaces' },
  { shoplineKey: 'jewelry>earring', newCategoryName: '耳環', newCategorySlug: 'earrings' },
  { shoplineKey: 'jewelry>ring', newCategoryName: '戒指', newCategorySlug: 'rings' },
  { shoplineKey: 'jewelry>bracelet', newCategoryName: '手環', newCategorySlug: 'bracelets' },
  { shoplineKey: 'jewelry', newCategoryName: '飾品 Jewelry', newCategorySlug: 'jewelry' },

  // ── Bra Top ──
  { shoplineKey: 'clothes>bra top', newCategoryName: 'Bra Top', newCategorySlug: 'bra-top' },
  { shoplineKey: 'bra top', newCategoryName: 'Bra Top', newCategorySlug: 'bra-top' },

  // ── 正式洋裝 ──
  { shoplineKey: 'formal dress', newCategoryName: '婚禮洋裝/正式洋裝', newCategorySlug: 'formal-dresses' },

  // ── 特殊標籤（保留原名） ──
  { shoplineKey: 'new arrival', newCategoryName: 'NEW ARRIVAL', newCategorySlug: 'new-arrival' },
  { shoplineKey: 'in stock & fast delivery', newCategoryName: '現貨速到專區 Rush', newCategorySlug: 'rush-delivery' },
  { shoplineKey: 'in stock', newCategoryName: '現貨速到專區 Rush', newCategorySlug: 'rush-delivery' },

  // ── 韓劇商品 ──
  { shoplineKey: 'k-drama', newCategoryName: '韓劇商品 K-Drama Products', newCategorySlug: 'k-drama' },
]

/**
 * 將 Shopline 分類字串映射到新網站分類
 * @param shoplineCategories - Shopline CSV 中的分類字串，多個用逗號分隔
 * @returns 映射後的主分類 + 額外標籤
 */
export function mapShoplineCategory(shoplineCategories: string): {
  primaryCategory: { name: string; slug: string } | null
  tags: string[]
  rawCategories: string[]
} {
  if (!shoplineCategories || !shoplineCategories.trim()) {
    return { primaryCategory: null, tags: [], rawCategories: [] }
  }

  // 分割多個分類（Shopline 用逗號或分號分隔）
  const rawCats = shoplineCategories
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean)

  const tags: string[] = []
  let primaryCategory: { name: string; slug: string } | null = null

  // 特殊標籤分類（不作為主分類，僅作為 tag）
  const tagOnlySlugs = new Set(['new-arrival', 'rush-delivery'])

  for (const raw of rawCats) {
    const key = raw.toLowerCase().trim()
    const match = CATEGORY_MAP.find(m => key === m.shoplineKey || key.includes(m.shoplineKey))

    if (match) {
      if (tagOnlySlugs.has(match.newCategorySlug)) {
        // NEW ARRIVAL / Rush → 作為標籤
        tags.push(match.newCategoryName)
      } else if (!primaryCategory) {
        // 第一個非標籤的分類作為主分類
        primaryCategory = { name: match.newCategoryName, slug: match.newCategorySlug }
      }
    } else {
      // 未匹配的分類保留為 tag
      tags.push(raw)
    }
  }

  return { primaryCategory, tags, rawCategories: rawCats }
}

/**
 * 取得所有可用的新網站分類（去重）
 */
export function getAllNewCategories(): { name: string; slug: string }[] {
  const seen = new Set<string>()
  const result: { name: string; slug: string }[] = []

  for (const m of CATEGORY_MAP) {
    if (!seen.has(m.newCategorySlug)) {
      seen.add(m.newCategorySlug)
      result.push({ name: m.newCategoryName, slug: m.newCategorySlug })
    }
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
}
