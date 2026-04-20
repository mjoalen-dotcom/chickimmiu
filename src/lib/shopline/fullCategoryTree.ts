/**
 * Shopline → Payload 完整分類鏡像
 * ────────────────────────────────
 * 將 Shopline 後台（https://admin.shoplineapp.com/admin/chickimmiu/categories）
 * 的 ~140 個分類 1:1 映射到 Payload `categories` collection。
 *
 * 設計原則：
 *   1. 歷史 / 已過期分類（2023 秋特、過期團購、非服飾商品）保留結構但 isActive=false
 *   2. 父子關係用 parentSlug 指向已存在的 slug
 *   3. 核心英文 slug 沿用 seedCategories.ts 既有約定（dresses / tops / outerwear / pants / accessories…）
 *   4. upsert by slug：已存在則覆寫 name / parent / sortOrder / isActive
 *
 * 使用：呼叫 POST /api/categories/seed-shopline?dryRun=1 先預覽，
 *       dryRun=0 才真的寫入。
 */

export interface ShoplineCategoryNode {
  /** 分類名稱（Shopline 原名，中文保留） */
  name: string
  /** URL-safe slug（CKMU 自訂英文） */
  slug: string
  /** 父分類的 slug；undefined = 頂層 */
  parentSlug?: string
  /** 越小越前面；未設則依宣告順序 */
  sortOrder?: number
  /** false = 前台隱藏（保留結構供歷史資料參照） */
  isActive?: boolean
  description?: string
}

export const SHOPLINE_CATEGORIES: ShoplineCategoryNode[] = [
  // ══════════════════════════════════════════════════════════
  // 頂層容器（Top-level containers）
  // ══════════════════════════════════════════════════════════
  { name: 'NEW ARRIVAL', slug: 'new-arrival', sortOrder: 1, description: '最新上架' },
  { name: '現貨專區', slug: 'rush-delivery', sortOrder: 2, description: '現貨速到，快速出貨' },
  { name: '衣著', slug: 'clothes', sortOrder: 10, description: '上衣、洋裝、外套、針織等' },
  { name: '套裝 Set', slug: 'sets', sortOrder: 20, description: '正式與休閒套裝' },
  { name: '泳衣 Swimwear', slug: 'swimwear', sortOrder: 30, description: '比基尼、連身泳裝' },
  { name: '下著', slug: 'bottoms', sortOrder: 40, description: '褲裝與裙裝全系列' },
  { name: '配件', slug: 'accessories', sortOrder: 50, description: '時尚配件' },
  { name: '飾品', slug: 'jewelry', sortOrder: 60, description: '耳環、項鍊、戒指、手環' },
  { name: '韓劇穿搭', slug: 'k-drama', sortOrder: 70, description: '韓劇同款穿搭' },
  { name: '韓國生活小物', slug: 'korea-lifestyle', sortOrder: 80, description: '韓國生活雜貨、母嬰用品' },
  { name: 'CKMU旅拍', slug: 'ckmu-travel', sortOrder: 90, description: '品牌旅拍系列' },

  // ══════════════════════════════════════════════════════════
  // 現貨專區 children
  // ══════════════════════════════════════════════════════════
  { name: '現貨上衣', slug: 'rush-tops', parentSlug: 'rush-delivery', sortOrder: 1 },
  { name: '現貨褲子', slug: 'rush-pants', parentSlug: 'rush-delivery', sortOrder: 2 },
  { name: '現貨裙子', slug: 'rush-skirts', parentSlug: 'rush-delivery', sortOrder: 3 },
  { name: '現貨洋裝', slug: 'rush-dresses', parentSlug: 'rush-delivery', sortOrder: 4 },
  { name: '現貨套裝', slug: 'rush-sets', parentSlug: 'rush-delivery', sortOrder: 5 },
  { name: '現貨外套', slug: 'rush-outerwear', parentSlug: 'rush-delivery', sortOrder: 6 },
  { name: '現貨配件', slug: 'rush-accessories', parentSlug: 'rush-delivery', sortOrder: 7 },
  { name: '現貨飾品', slug: 'rush-jewelry', parentSlug: 'rush-delivery', sortOrder: 8 },
  { name: '現貨泳衣', slug: 'rush-swimwear', parentSlug: 'rush-delivery', sortOrder: 9 },

  // ══════════════════════════════════════════════════════════
  // 衣著 children（slug 對齊既有 prod + categoryMapping.ts）
  // ══════════════════════════════════════════════════════════
  { name: '連衣裙/洋裝', slug: 'dresses', parentSlug: 'clothes', sortOrder: 1 },
  { name: '上衣', slug: 'tops', parentSlug: 'clothes', sortOrder: 2 },
  { name: '襯衫', slug: 'blouse', parentSlug: 'clothes', sortOrder: 3 },
  { name: '針織', slug: 'knit', parentSlug: 'clothes', sortOrder: 4 },
  { name: 'Bra Top', slug: 'bra-top', parentSlug: 'clothes', sortOrder: 5 },
  // 注意：既有 prod 的 slug 是 outerwear（非 outer），保留相容
  { name: '外套', slug: 'outerwear', parentSlug: 'clothes', sortOrder: 6 },

  // ══════════════════════════════════════════════════════════
  // 套裝 children
  // ══════════════════════════════════════════════════════════
  { name: '正式套裝 Formal Set', slug: 'formal-sets', parentSlug: 'sets', sortOrder: 1 },
  { name: '休閒套裝 Casual Set', slug: 'casual-sets', parentSlug: 'sets', sortOrder: 2 },

  // ══════════════════════════════════════════════════════════
  // 下著 children（slug 對齊既有 prod：pants）
  // ══════════════════════════════════════════════════════════
  { name: '裙子', slug: 'all-skirts', parentSlug: 'bottoms', sortOrder: 1 },
  { name: '中/長裙', slug: 'midi-long-skirts', parentSlug: 'bottoms', sortOrder: 2 },
  { name: '短裙', slug: 'mini-skirts', parentSlug: 'bottoms', sortOrder: 3 },
  // 既有 prod slug=pants，保留
  { name: '褲子', slug: 'pants', parentSlug: 'bottoms', sortOrder: 4 },
  { name: '長褲', slug: 'long-pants', parentSlug: 'bottoms', sortOrder: 5 },
  { name: '短褲', slug: 'shorts', parentSlug: 'bottoms', sortOrder: 6 },

  // ══════════════════════════════════════════════════════════
  // 配件 children
  // ══════════════════════════════════════════════════════════
  { name: '鞋子', slug: 'shoes', parentSlug: 'accessories', sortOrder: 1 },
  { name: '包包', slug: 'bags', parentSlug: 'accessories', sortOrder: 2 },
  { name: '手錶', slug: 'watches', parentSlug: 'accessories', sortOrder: 3 },
  { name: '墨鏡/造型眼鏡', slug: 'glasses', parentSlug: 'accessories', sortOrder: 4 },
  { name: '皮帶', slug: 'belts', parentSlug: 'accessories', sortOrder: 5 },
  { name: '襪子', slug: 'socks', parentSlug: 'accessories', sortOrder: 6 },
  { name: '帽子/圍巾', slug: 'hats-scarves', parentSlug: 'accessories', sortOrder: 7 },
  { name: '吊飾', slug: 'charms', parentSlug: 'accessories', sortOrder: 8 },
  { name: '髮飾', slug: 'hair-accessories', parentSlug: 'accessories', sortOrder: 9 },

  // ══════════════════════════════════════════════════════════
  // 飾品 children（含 Choker、金色燙金等子系列，全放 jewelry 底下）
  // ══════════════════════════════════════════════════════════
  { name: '純銀全品項', slug: 'sterling-silver', parentSlug: 'jewelry', sortOrder: 1 },
  { name: '戒指', slug: 'rings', parentSlug: 'jewelry', sortOrder: 2 },
  { name: '項鍊', slug: 'necklaces', parentSlug: 'jewelry', sortOrder: 3 },
  { name: '耳環', slug: 'earrings', parentSlug: 'jewelry', sortOrder: 4 },
  { name: '手環', slug: 'bracelets', parentSlug: 'jewelry', sortOrder: 5 },
  { name: '脖圍', slug: 'neckwarmers', parentSlug: 'jewelry', sortOrder: 6 },
  { name: 'Choker-百搭必備款', slug: 'choker-essential', parentSlug: 'jewelry', sortOrder: 10 },
  { name: 'Choker-韓星愛用款', slug: 'choker-kstar', parentSlug: 'jewelry', sortOrder: 11 },
  { name: 'Choker-時尚簡約款', slug: 'choker-minimal', parentSlug: 'jewelry', sortOrder: 12 },
  { name: '金色燙金系列', slug: 'gold-stamping', parentSlug: 'jewelry', sortOrder: 20 },
  { name: '個性造型系列', slug: 'character-style', parentSlug: 'jewelry', sortOrder: 21 },
  { name: '金色質感飾品', slug: 'gold-texture', parentSlug: 'jewelry', sortOrder: 22 },
  { name: '迪士尼抗過敏耳針系列', slug: 'disney-hypoallergenic-earrings', parentSlug: 'jewelry', sortOrder: 23 },
  { name: '寶可夢抗過敏耳針系列', slug: 'pokemon-hypoallergenic-earrings', parentSlug: 'jewelry', sortOrder: 24 },
  { name: '命定天然石系列', slug: 'natural-stones', parentSlug: 'jewelry', sortOrder: 25 },
  { name: '韓劇飾品', slug: 'k-drama-jewelry', parentSlug: 'jewelry', sortOrder: 26 },

  // ══════════════════════════════════════════════════════════
  // 韓劇穿搭 children
  // ══════════════════════════════════════════════════════════
  { name: '熱播韓劇穿搭', slug: 'k-drama-trending', parentSlug: 'k-drama', sortOrder: 1 },
  { name: '韓劇穿搭 - Penthouse', slug: 'k-drama-penthouse', parentSlug: 'k-drama', sortOrder: 2 },
  { name: '韓劇穿搭 - 雖然是神經病但沒關係', slug: 'k-drama-psycho-but-ok', parentSlug: 'k-drama', sortOrder: 3 },
  { name: '韓劇穿搭 - 夫妻的世界', slug: 'k-drama-world-of-married', parentSlug: 'k-drama', sortOrder: 4 },
  { name: '韓劇穿搭 - 愛的迫降', slug: 'k-drama-crash-landing', parentSlug: 'k-drama', sortOrder: 5 },
  { name: '韓劇穿搭 - 德魯納酒店', slug: 'k-drama-hotel-del-luna', parentSlug: 'k-drama', sortOrder: 6 },
  { name: '韓劇穿搭 - 她的私生活', slug: 'k-drama-her-private-life', parentSlug: 'k-drama', sortOrder: 7 },
  { name: '韓劇穿搭 - 觸及真心', slug: 'k-drama-touch-your-heart', parentSlug: 'k-drama', sortOrder: 8 },
  { name: '經典回顧韓劇', slug: 'k-drama-classics', parentSlug: 'k-drama', sortOrder: 9 },
  { name: '韓劇穿搭 - 現正分手中', slug: 'k-drama-breaking-up', parentSlug: 'k-drama', sortOrder: 10 },
  { name: '韓劇穿搭 - 男朋友', slug: 'k-drama-encounter', parentSlug: 'k-drama', sortOrder: 11 },
  { name: '韓劇穿搭 - 金秘書為何那樣', slug: 'k-drama-secretary-kim', parentSlug: 'k-drama', sortOrder: 12 },
  { name: '韓劇穿搭 - 藍色海洋的傳說', slug: 'k-drama-legend-blue-sea', parentSlug: 'k-drama', sortOrder: 13 },
  { name: '韓劇穿搭 - 經常請吃飯的漂亮姐姐', slug: 'k-drama-pretty-noona', parentSlug: 'k-drama', sortOrder: 14 },
  { name: '韓劇穿搭 - 孤單又燦爛的神-鬼怪', slug: 'k-drama-goblin', parentSlug: 'k-drama', sortOrder: 15 },
  { name: '韓劇穿搭 - 嫉妒的化身', slug: 'k-drama-jealousy-incarnate', parentSlug: 'k-drama', sortOrder: 16 },
  { name: '韓劇穿搭 - 太陽的後裔', slug: 'k-drama-descendants-of-sun', parentSlug: 'k-drama', sortOrder: 17 },
  { name: '韓劇穿搭 - 油膩的Melo', slug: 'k-drama-melo-is-my-nature', parentSlug: 'k-drama', sortOrder: 18 },
  { name: '韓劇穿搭 - 來自星星的你', slug: 'k-drama-from-stars', parentSlug: 'k-drama', sortOrder: 19 },
  { name: '韓劇穿搭 - 沒關係，是愛情啊', slug: 'k-drama-its-okay-love', parentSlug: 'k-drama', sortOrder: 20 },
  { name: '韓劇穿搭 - 她很漂亮', slug: 'k-drama-shes-pretty', parentSlug: 'k-drama', sortOrder: 21 },
  { name: '韓劇穿搭 - 主君的太陽', slug: 'k-drama-master-sun', parentSlug: 'k-drama', sortOrder: 22 },
  { name: '韓劇穿搭 - 製作人', slug: 'k-drama-producer', parentSlug: 'k-drama', sortOrder: 23 },
  { name: '韓劇穿搭 - Doctors-醫生們', slug: 'k-drama-doctors', parentSlug: 'k-drama', sortOrder: 24 },

  // ══════════════════════════════════════════════════════════
  // 韓國生活小物 children
  // ══════════════════════════════════════════════════════════
  { name: '手工抹布系列', slug: 'handmade-cloths', parentSlug: 'korea-lifestyle', sortOrder: 1 },
  { name: '手工杯墊系列', slug: 'handmade-coasters', parentSlug: 'korea-lifestyle', sortOrder: 2 },
  { name: '寶寶口水巾', slug: 'baby-bibs', parentSlug: 'korea-lifestyle', sortOrder: 3 },
  { name: 'TakkoBebe髮帶', slug: 'takkobebe-headbands', parentSlug: 'korea-lifestyle', sortOrder: 4 },
  { name: 'TakkoBebe 特殊花色髮帶', slug: 'takkobebe-special-headbands', parentSlug: 'korea-lifestyle', sortOrder: 5 },
  { name: 'TakkoBebe 寶寶精緻髮夾', slug: 'takkobebe-baby-clips', parentSlug: 'korea-lifestyle', sortOrder: 6 },
  { name: 'RIBBON 大綁帶縫線髮飾', slug: 'ribbon-hair-accessories', parentSlug: 'korea-lifestyle', sortOrder: 7 },

  // ══════════════════════════════════════════════════════════
  // CKMU旅拍 children
  // ══════════════════════════════════════════════════════════
  { name: 'CKMU IN SEOUL', slug: 'ckmu-seoul', parentSlug: 'ckmu-travel', sortOrder: 1 },
  { name: 'CKMU IN VIENNA', slug: 'ckmu-vienna', parentSlug: 'ckmu-travel', sortOrder: 2 },
  { name: 'CKMU IN LA', slug: 'ckmu-la', parentSlug: 'ckmu-travel', sortOrder: 3 },

  // ══════════════════════════════════════════════════════════
  // 品牌 / 聯名（top-level）
  // ══════════════════════════════════════════════════════════
  { name: 'mzuu', slug: 'brand-mzuu', sortOrder: 100 },
  { name: 'noonoofingers', slug: 'brand-noonoofingers', sortOrder: 101 },
  { name: 'TROIS ROIS', slug: 'brand-trois-rois', sortOrder: 102 },
  { name: 'Dark Angel x CKMU 聯名', slug: 'collab-dark-angel', sortOrder: 103 },

  // ══════════════════════════════════════════════════════════
  // 金老佛爺 / 主播 / 穿搭系列（top-level）
  // ══════════════════════════════════════════════════════════
  { name: '金金同款專區', slug: 'jin-style', sortOrder: 110 },
  { name: '主播同款專區', slug: 'host-style', sortOrder: 111 },
  { name: '情侶裝', slug: 'couple-outfits', sortOrder: 112 },
  { name: '男裝', slug: 'menswear', sortOrder: 113 },
  { name: '穿搭系列專區', slug: 'styling-picks', sortOrder: 114 },
  { name: '螞蟻腰超強顯瘦全系列', slug: 'high-waist-pants', sortOrder: 115 },
  { name: '金老佛爺直播優惠專區', slug: 'jin-live', sortOrder: 116 },
  { name: '夏日清涼悠活套裝', slug: 'summer-relax-sets', sortOrder: 117 },
  { name: '婚禮/正式場合洋裝系列', slug: 'formal-dresses', sortOrder: 118 },
  { name: '大尺碼寬鬆系列', slug: 'plus-size-loose', sortOrder: 119 },
  { name: '高爾夫球系列', slug: 'golf', sortOrder: 120 },
  { name: '金老佛爺穿搭專區', slug: 'jin-outfits', sortOrder: 121 },
  { name: '金老佛爺推薦包款', slug: 'jin-bags', sortOrder: 122 },
  { name: '金老佛爺推薦鞋款', slug: 'jin-shoes', sortOrder: 123 },

  // ══════════════════════════════════════════════════════════
  // 其他（top-level，active）
  // ══════════════════════════════════════════════════════════
  { name: '福利商品優惠區💕', slug: 'outlet', sortOrder: 130 },
  { name: '保健品', slug: 'health-supplements', sortOrder: 131 },
  { name: '職場穿搭', slug: 'workwear', sortOrder: 132 },
  { name: '針織商品', slug: 'knit-products', sortOrder: 133 },

  // ══════════════════════════════════════════════════════════
  // 團購專區（parent active，多數子項為過期活動 isActive=false）
  // ══════════════════════════════════════════════════════════
  { name: '金老佛爺 x 團購活動', slug: 'grouporder', sortOrder: 200 },
  { name: '金老佛爺 x ME30 地中海輕珠寶', slug: 'grouporder-me30', parentSlug: 'grouporder', isActive: false },
  { name: '肌活青春露組合', slug: 'grouporder-skinrelief', parentSlug: 'grouporder', isActive: false },
  { name: 'SOMETHING X 金老佛爺團購系列', slug: 'grouporder-something', parentSlug: 'grouporder', isActive: false },
  { name: '江戶勝 X 金老佛爺團購系列', slug: 'grouporder-edo-victory', parentSlug: 'grouporder', isActive: false },
  { name: '韓國SNOWKIDS兒童藝術團購', slug: 'grouporder-snowkids', parentSlug: 'grouporder', isActive: false },
  { name: '韓國IONSPA蓮蓬頭團購', slug: 'grouporder-ionspa', parentSlug: 'grouporder', isActive: false },
  { name: 'Stem Cell奇肌之鑰 原生因子生物纖維面膜', slug: 'grouporder-stemcell', parentSlug: 'grouporder', isActive: false },
  { name: 'zmec.f. 雙色手機皮夾包雙12快閃團', slug: 'grouporder-zmec', parentSlug: 'grouporder', isActive: false },
  { name: 'Beseye雲端攝影機團購', slug: 'grouporder-beseye', parentSlug: 'grouporder', isActive: false },
  { name: 'LisaVicky 限時團購', slug: 'grouporder-lisavicky', parentSlug: 'grouporder', isActive: false },
  { name: '金老佛爺xLisa Vicky 聯名運動風涼鞋團購', slug: 'grouporder-lisavicky-sandals', parentSlug: 'grouporder', isActive: false },
  { name: 'Swissline 奢華葡萄多酚精華露', slug: 'grouporder-swissline', parentSlug: 'grouporder', isActive: false },
  { name: '青春機密膠原飲優惠', slug: 'grouporder-collagen', parentSlug: 'grouporder', isActive: false },
  { name: '金老佛爺 x 萬田小小兵海苔', slug: 'grouporder-minion-nori', parentSlug: 'grouporder', isActive: false },
  { name: '【田原香X金老佛爺】團購滴雞精', slug: 'grouporder-tianyuanxiang', parentSlug: 'grouporder', isActive: false },
  { name: '金老佛爺 x SO NICE運動系列', slug: 'grouporder-sonice', parentSlug: 'grouporder', isActive: false },
  { name: '金老佛爺 x 翡麗詩丹', slug: 'grouporder-forever-stan', parentSlug: 'grouporder', isActive: false },
  { name: '迪士尼 x 三麗鷗 親子團購', slug: 'grouporder-disney-sanrio', parentSlug: 'grouporder', isActive: false },

  // ══════════════════════════════════════════════════════════
  // 歷史特賣/POS 分類（全 isActive=false，保留結構供歷史資料參照）
  // ══════════════════════════════════════════════════════════
  { name: '帽子均一價300', slug: 'hat-promo-300', isActive: false, sortOrder: 300 },
  { name: '2023秋季特賣三件$799區', slug: 'sale-2023-autumn-3for799', isActive: false, sortOrder: 301 },
  { name: '2023秋季特賣新品85折區', slug: 'sale-2023-autumn-new-85', isActive: false, sortOrder: 302 },
  { name: '2023秋季特賣5折區', slug: 'sale-2023-autumn-50', isActive: false, sortOrder: 303 },
  { name: '2023秋季特賣6折區', slug: 'sale-2023-autumn-60', isActive: false, sortOrder: 304 },
  { name: '2023秋季特賣7折區', slug: 'sale-2023-autumn-70', isActive: false, sortOrder: 305 },
  { name: '2023秋季特賣8折區', slug: 'sale-2023-autumn-80', isActive: false, sortOrder: 306 },
  { name: '洋裝均一價$1000元', slug: 'dress-promo-1000', isActive: false, sortOrder: 307 },
  { name: '任選三件799元', slug: 'promo-3for799', isActive: false, sortOrder: 308 },
  { name: '任選10件2199元', slug: 'promo-10for2199', isActive: false, sortOrder: 309 },
  { name: '鞋子300元', slug: 'shoes-promo-300', isActive: false, sortOrder: 310 },
  { name: '鞋子500元', slug: 'shoes-promo-500', isActive: false, sortOrder: 311 },
  { name: '鞋子700元', slug: 'shoes-promo-700', isActive: false, sortOrder: 312 },
  { name: '墨鏡眼鏡均一價200', slug: 'glasses-promo-200', isActive: false, sortOrder: 313 },
  { name: '包包100元區', slug: 'bags-promo-100', isActive: false, sortOrder: 314 },
  { name: '加購品', slug: 'addon-items', isActive: false, sortOrder: 315 },
]

/** 依 parentSlug 關係判斷 Payload Categories level 欄位（1/2/3） */
export function computeLevel(
  node: ShoplineCategoryNode,
  byslug: Map<string, ShoplineCategoryNode>,
): '1' | '2' | '3' {
  if (!node.parentSlug) return '1'
  const parent = byslug.get(node.parentSlug)
  if (!parent || !parent.parentSlug) return '2'
  return '3'
}
