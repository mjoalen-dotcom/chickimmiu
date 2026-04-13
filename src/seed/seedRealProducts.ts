/**
 * CHIC KIM & MIU — 真實商品 Seed 腳本
 * ──────────────────────────────────────
 * 從 www.chickimmiu.com 爬取的真實商品資料（~120 件）
 *
 * 使用方式：
 *   npx tsx src/seed/seedRealProducts.ts
 *
 * 前置條件：
 *   1. SQLite 正在運行
 *   2. .env 中 DATABASE_URI 和 PAYLOAD_SECRET 已設定
 *   3. 已執行 Payload 資料庫遷移（npx payload migrate）
 *   4. 已執行 seedCategories（分類必須先存在）
 */

import { getPayload } from 'payload'
import config from '../payload.config'
import { seedCategories } from './seedCategories'

// ── 型別定義 ──

interface VariantDef {
  colorName: string
  colorCode: string
  size: string
  sku: string
  stock: number
}

interface ProductDef {
  name: string
  slug: string
  price: number
  salePrice?: number
  categorySlug: string
  stock: number
  status: 'published' | 'draft' | 'archived'
  isNew?: boolean
  isHot?: boolean
  collectionTags?: (
    | 'jin-live'
    | 'jin-style'
    | 'host-style'
    | 'brand-custom'
    | 'formal-dresses'
    | 'rush'
    | 'celebrity-style'
  )[]
  variants: VariantDef[]
  tags: { tag: string }[]
  weight: number
}

/** 分類中文對照 */
const CATEGORY_LABELS: Record<string, string> = {
  outer: '外套',
  tops: '上衣',
  blouse: '襯衫/雪紡',
  knit: '針織衫',
  dresses: '洋裝',
  'long-pants': '長褲',
  shorts: '短褲',
  skirts: '裙子',
  'formal-set': '正式套裝',
  'casual-set': '休閒套裝',
  accessories: '配飾',
  rush: '現貨專區',
}

/** 根據商品資訊自動生成描述 */
function generateDescription(product: ProductDef): string {
  const catLabel = CATEGORY_LABELS[product.categorySlug] || '服飾'
  const colors = [...new Set(product.variants.map((v) => v.colorName))]
  const sizes = [...new Set(product.variants.map((v) => v.size))]
  const colorText = colors.length > 0 ? `提供 ${colors.join('、')} 等${colors.length}色選擇` : ''
  const sizeText = sizes.length > 1 ? `，尺寸 ${sizes.join('/')}` : sizes.length === 1 ? `，${sizes[0]} 尺寸` : ''
  const priceText = product.salePrice
    ? `特惠價 NT$${product.salePrice.toLocaleString()}（原價 NT$${product.price.toLocaleString()}）`
    : `NT$${product.price.toLocaleString()}`

  const isCKMU = product.collectionTags?.includes('brand-custom')
  const isRush = product.collectionTags?.includes('rush')

  const intro = isCKMU
    ? `CHIC KIM & MIU 自訂款${catLabel}，精選面料與版型設計。`
    : isRush
      ? `現貨商品，下單後快速出貨！`
      : `韓國直送${catLabel}，融合極簡優雅與韓系活力。`

  return `${intro}${colorText}${sizeText}。${priceText}。\n\n商品材質舒適親膚，版型修身顯瘦。適合日常穿搭、約會、上班等多種場合。\n\n⚠️ 因拍攝光線與螢幕設定不同，實際顏色可能略有色差。\n📦 下單後約 7-14 個工作天到貨（現貨商品 1-3 天出貨）`
}

// ── 輔助函式 ──

/** 隨機整數（含邊界） */
function rnd(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** 標準色票對照 */
const COLOR_MAP: Record<string, string> = {
  黑色: '#1A1A1A',
  象牙白: '#FFFFF0',
  米色: '#E8DCC8',
  深藍: '#1C2D4B',
  灰色: '#9E9E9E',
  深灰色: '#555555',
  焦糖棕: '#A0522D',
  粉色: '#F5D5D5',
  卡其: '#C2A87C',
  白色: '#FFFFFF',
  藍色: '#4A7BB7',
  淺藍色: '#B5CCDB',
  綠色: '#5A8A5A',
  酒紅: '#7B2D3E',
  香草白: '#FFF8E7',
  奶白: '#FFF8E7',
  銀色: '#C0C0C0',
}

/** 取得色碼（若無對應則給預設深色） */
function colorCode(name: string): string {
  return COLOR_MAP[name] ?? '#888888'
}

/** 依色名取 2 碼縮寫 */
function colorAbbr(name: string): string {
  const map: Record<string, string> = {
    黑色: 'BK',
    象牙白: 'IW',
    米色: 'BE',
    深藍: 'NB',
    灰色: 'GR',
    深灰色: 'DG',
    焦糖棕: 'CB',
    粉色: 'PK',
    卡其: 'KH',
    白色: 'WH',
    藍色: 'BL',
    淺藍色: 'LB',
    綠色: 'GN',
    酒紅: 'WR',
    香草白: 'VW',
    奶白: 'CW',
    銀色: 'SV',
  }
  return map[name] ?? name.slice(0, 2).toUpperCase()
}

/** 產生 SKU */
function sku(prefix: string, slug: string, color: string, size: string): string {
  const slugPrefix = slug.slice(0, 8).toUpperCase().replace(/-/g, '')
  return `CKMU-${prefix}-${slugPrefix}-${colorAbbr(color)}${size}`
}

/** 產生 Free Size 變體（N 色） */
function freeVariants(prefix: string, slug: string, colors: string[]): VariantDef[] {
  return colors.map((c) => ({
    colorName: c,
    colorCode: colorCode(c),
    size: 'Free',
    sku: sku(prefix, slug, c, 'F'),
    stock: rnd(5, 30),
  }))
}

/** 產生多色多尺寸變體 */
function multiVariants(prefix: string, slug: string, colors: string[], sizes: string[]): VariantDef[] {
  const result: VariantDef[] = []
  for (const c of colors) {
    for (const s of sizes) {
      result.push({
        colorName: c,
        colorCode: colorCode(c),
        size: s,
        sku: sku(prefix, slug, c, s),
        stock: rnd(5, 30),
      })
    }
  }
  return result
}

// ── 共用色組 ──
const COLORS_2 = ['黑色', '象牙白']
const COLORS_3 = ['黑色', '象牙白', '灰色']
const COLORS_3B = ['黑色', '米色', '深藍']
const COLORS_4 = ['黑色', '象牙白', '灰色', '焦糖棕']
const COLORS_5 = ['黑色', '象牙白', '灰色', '焦糖棕', '粉色']
const SIZES_SM = ['S', 'M']
const SIZES_SML = ['S', 'M', 'L']
const SIZES_SMLXL = ['S', 'M', 'L', 'XL']

// ═══════════════════════════════════════════════════════════════════
// 外套 OUTER
// ═══════════════════════════════════════════════════════════════════
const OUTER_PRODUCTS: ProductDef[] = [
  {
    name: 'Myrca 精緻短版西裝外套',
    slug: 'myrca-refined-cropped-blazer',
    price: 2480,
    salePrice: 2280,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 350,
    tags: [{ tag: '西裝外套' }, { tag: '短版' }, { tag: '氣質' }, { tag: '通勤' }],
    variants: freeVariants('OUT', 'myrca-refined-cropped-blazer', COLORS_3),
  },
  {
    name: 'Lydia 都會氣質風衣外套',
    slug: 'lydia-urban-trench-coat',
    price: 4080,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 480,
    tags: [{ tag: '風衣' }, { tag: '氣質' }, { tag: '都會' }, { tag: '百搭' }],
    variants: freeVariants('OUT', 'lydia-urban-trench-coat', COLORS_2),
  },
  {
    name: 'Karly 簡約翻領短版夾克',
    slug: 'karly-minimalist-lapel-cropped-jacket',
    price: 4180,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 420,
    tags: [{ tag: '夾克' }, { tag: '短版' }, { tag: '簡約' }, { tag: '韓系' }],
    variants: freeVariants('OUT', 'karly-minimalist-lapel-cropped-jacket', COLORS_3),
  },
  {
    name: 'Ingrid 率性立領風衣夾克',
    slug: 'ingrid-stand-collar-trench-jacket',
    price: 4480,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 450,
    tags: [{ tag: '風衣' }, { tag: '夾克' }, { tag: '立領' }, { tag: '率性' }],
    variants: freeVariants('OUT', 'ingrid-stand-collar-trench-jacket', COLORS_3),
  },
  {
    name: 'Hani 喀什米爾簡約短版罩衫',
    slug: 'hani-cashmere-minimal-cropped-cardigan',
    price: 2280,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    isNew: true,
    collectionTags: ['rush'],
    weight: 300,
    tags: [{ tag: '喀什米爾' }, { tag: '短版' }, { tag: '罩衫' }, { tag: '百搭' }],
    variants: freeVariants('OUT', 'hani-cashmere-minimal-cropped-cardigan', COLORS_3),
  },
  {
    name: '優雅氣質珍珠釦香香外套',
    slug: 'pearl-button-chanel-style-jacket',
    price: 5180,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    collectionTags: ['rush', 'formal-dresses'],
    weight: 500,
    tags: [{ tag: '香香外套' }, { tag: '珍珠釦' }, { tag: '名媛' }, { tag: '氣質' }],
    variants: freeVariants('OUT', 'pearl-button-chanel-style-jacket', ['象牙白']),
  },
  {
    name: 'Lauren 連帽羊毛開襟衫',
    slug: 'lauren-hooded-wool-cardigan',
    price: 3080,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 400,
    tags: [{ tag: '羊毛' }, { tag: '連帽' }, { tag: '開襟衫' }, { tag: '秋冬' }],
    variants: freeVariants('OUT', 'lauren-hooded-wool-cardigan', COLORS_2),
  },
  {
    name: 'Reese 輕巧百搭素面罩衫',
    slug: 'reese-lightweight-versatile-cover-up',
    price: 2180,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 250,
    tags: [{ tag: '罩衫' }, { tag: '素面' }, { tag: '百搭' }, { tag: '輕巧' }],
    variants: freeVariants('OUT', 'reese-lightweight-versatile-cover-up', COLORS_2),
  },
  {
    name: 'Virginia 學院風雙排釦短版外套',
    slug: 'virginia-preppy-double-breasted-cropped-jacket',
    price: 4380,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 440,
    tags: [{ tag: '學院風' }, { tag: '雙排釦' }, { tag: '短版' }, { tag: '外套' }],
    variants: freeVariants('OUT', 'virginia-preppy-double-breasted-cropped-jacket', ['深灰色']),
  },
  {
    name: 'Solenne 柔率雙頭拉鍊羊毛外套',
    slug: 'solenne-dual-zip-wool-coat',
    price: 5380,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 550,
    tags: [{ tag: '羊毛外套' }, { tag: '拉鍊' }, { tag: '率性' }, { tag: '秋冬' }],
    variants: freeVariants('OUT', 'solenne-dual-zip-wool-coat', COLORS_3),
  },
  {
    name: 'Quenisha 雋雅車線羊毛短版外套',
    slug: 'quenisha-stitchline-wool-cropped-jacket',
    price: 4980,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    weight: 480,
    tags: [{ tag: '羊毛' }, { tag: '車線' }, { tag: '短版' }, { tag: '雋雅' }],
    variants: freeVariants('OUT', 'quenisha-stitchline-wool-cropped-jacket', COLORS_4),
  },
  {
    name: 'Devon 寬擺包釦羊毛開襟衫',
    slug: 'devon-wide-hem-button-wool-cardigan',
    price: 3180,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 380,
    tags: [{ tag: '羊毛' }, { tag: '開襟衫' }, { tag: '包釦' }, { tag: '百搭' }],
    variants: freeVariants('OUT', 'devon-wide-hem-button-wool-cardigan', COLORS_5),
  },
]

// ═══════════════════════════════════════════════════════════════════
// 上衣 TOPS
// ═══════════════════════════════════════════════════════════════════
const TOP_PRODUCTS: ProductDef[] = [
  {
    name: 'Willow 氣質方領雪紡上衣',
    slug: 'willow-square-neck-chiffon-top',
    price: 1280,
    salePrice: 1180,
    categorySlug: 'tops',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 130,
    tags: [{ tag: '方領' }, { tag: '雪紡' }, { tag: '氣質' }, { tag: '約會穿搭' }],
    variants: freeVariants('TOP', 'willow-square-neck-chiffon-top', COLORS_3),
  },
  {
    name: 'Irene 名媛風珍珠釦上衣',
    slug: 'irene-ladylike-pearl-button-top',
    price: 1380,
    salePrice: 1280,
    categorySlug: 'tops',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 150,
    tags: [{ tag: '珍珠釦' }, { tag: '名媛' }, { tag: '氣質' }, { tag: '百搭' }],
    variants: freeVariants('TOP', 'irene-ladylike-pearl-button-top', COLORS_3),
  },
  {
    name: 'Vion 飄帶雪紡修身上衣',
    slug: 'vion-ribbon-chiffon-slim-top',
    price: 2280,
    salePrice: 2180,
    categorySlug: 'tops',
    stock: 0,
    status: 'published',
    weight: 140,
    tags: [{ tag: '飄帶' }, { tag: '雪紡' }, { tag: '修身' }, { tag: '韓系' }],
    variants: freeVariants('TOP', 'vion-ribbon-chiffon-slim-top', COLORS_3),
  },
  {
    name: 'Peyton 珠光蕾絲背心',
    slug: 'peyton-pearlescent-lace-cami',
    price: 1580,
    categorySlug: 'tops',
    stock: 0,
    status: 'published',
    weight: 120,
    tags: [{ tag: '蕾絲' }, { tag: '背心' }, { tag: '珠光' }, { tag: '約會穿搭' }],
    variants: freeVariants('TOP', 'peyton-pearlescent-lace-cami', COLORS_4),
  },
  {
    name: 'Nadia 垂墜感素色上衣',
    slug: 'nadia-drape-solid-top',
    price: 1580,
    categorySlug: 'tops',
    stock: 0,
    status: 'published',
    weight: 135,
    tags: [{ tag: '垂墜' }, { tag: '素色' }, { tag: '百搭' }, { tag: '通勤' }],
    variants: freeVariants('TOP', 'nadia-drape-solid-top', COLORS_5),
  },
  {
    name: 'Fanny 柔膚兩件式造型上衣',
    slug: 'fanny-soft-skin-two-piece-styled-top',
    price: 2180,
    categorySlug: 'tops',
    stock: 0,
    status: 'published',
    weight: 160,
    tags: [{ tag: '兩件式' }, { tag: '柔膚' }, { tag: '造型' }, { tag: '氣質' }],
    variants: freeVariants('TOP', 'fanny-soft-skin-two-piece-styled-top', COLORS_4),
  },
  {
    name: 'Chic 極簡線條短版上衣',
    slug: 'chic-minimal-line-cropped-top',
    price: 1380,
    categorySlug: 'tops',
    stock: 0,
    status: 'published',
    collectionTags: ['brand-custom'],
    weight: 150,
    tags: [{ tag: '極簡' }, { tag: '短版' }, { tag: '品牌自訂' }, { tag: '百搭' }],
    variants: multiVariants('TOP', 'chic-minimal-line-cropped-top', ['黑色', '象牙白', '灰色', '米色', '粉色', '深藍'], SIZES_SML),
  },
  {
    name: 'Lesley 法式翻領針織上衣',
    slug: 'lesley-french-lapel-knit-top',
    price: 1980,
    categorySlug: 'tops',
    stock: 0,
    status: 'published',
    weight: 200,
    tags: [{ tag: '法式' }, { tag: '翻領' }, { tag: '針織' }, { tag: '氣質' }],
    variants: freeVariants('TOP', 'lesley-french-lapel-knit-top', COLORS_3),
  },
]

// ═══════════════════════════════════════════════════════════════════
// 襯衫 BLOUSE
// ═══════════════════════════════════════════════════════════════════
const BLOUSE_PRODUCTS: ProductDef[] = [
  {
    name: 'Bertha 都會金釦翻領襯衫',
    slug: 'bertha-urban-gold-button-lapel-blouse',
    price: 1180,
    salePrice: 1080,
    categorySlug: 'blouse',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 160,
    tags: [{ tag: '金釦' }, { tag: '翻領' }, { tag: '都會' }, { tag: '通勤' }],
    variants: freeVariants('BLS', 'bertha-urban-gold-button-lapel-blouse', COLORS_4),
  },
  {
    name: 'Aria 天絲流光垂墜襯衫',
    slug: 'aria-tencel-lustrous-drape-blouse',
    price: 1580,
    salePrice: 1480,
    categorySlug: 'blouse',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 155,
    tags: [{ tag: '天絲' }, { tag: '垂墜' }, { tag: '流光' }, { tag: '氣質' }],
    variants: freeVariants('BLS', 'aria-tencel-lustrous-drape-blouse', COLORS_3),
  },
  {
    name: 'Zenith 絲光優雅襯衫',
    slug: 'zenith-silky-elegant-blouse',
    price: 2480,
    salePrice: 2280,
    categorySlug: 'blouse',
    stock: 0,
    status: 'published',
    weight: 175,
    tags: [{ tag: '絲光' }, { tag: '優雅' }, { tag: '氣質' }, { tag: '通勤' }],
    variants: freeVariants('BLS', 'zenith-silky-elegant-blouse', COLORS_3),
  },
  {
    name: 'Sierra 假兩件雪紡針織襯衫',
    slug: 'sierra-faux-twopiece-chiffon-knit-blouse',
    price: 1680,
    categorySlug: 'blouse',
    stock: 0,
    status: 'published',
    weight: 165,
    tags: [{ tag: '假兩件' }, { tag: '雪紡' }, { tag: '針織' }, { tag: '氣質' }],
    variants: freeVariants('BLS', 'sierra-faux-twopiece-chiffon-knit-blouse', COLORS_2),
  },
  {
    name: 'Trisha 珍珠曲線層次擺襯衫',
    slug: 'trisha-pearl-curved-layered-blouse',
    price: 1580,
    categorySlug: 'blouse',
    stock: 0,
    status: 'published',
    weight: 170,
    tags: [{ tag: '珍珠' }, { tag: '層次' }, { tag: '氣質' }, { tag: '名媛' }],
    variants: freeVariants('BLS', 'trisha-pearl-curved-layered-blouse', COLORS_3),
  },
  {
    name: 'Rosa 溫柔荷葉邊直條襯衫',
    slug: 'rosa-gentle-ruffle-stripe-blouse',
    price: 2480,
    categorySlug: 'blouse',
    stock: 0,
    status: 'published',
    weight: 180,
    tags: [{ tag: '荷葉邊' }, { tag: '直條' }, { tag: '溫柔' }, { tag: '約會穿搭' }],
    variants: freeVariants('BLS', 'rosa-gentle-ruffle-stripe-blouse', COLORS_3),
  },
  {
    name: 'Odette 優雅傘擺襯衫(附腰帶)',
    slug: 'odette-elegant-flared-blouse-with-belt',
    price: 1580,
    categorySlug: 'blouse',
    stock: 0,
    status: 'published',
    weight: 190,
    tags: [{ tag: '傘擺' }, { tag: '腰帶' }, { tag: '優雅' }, { tag: '氣質' }],
    variants: freeVariants('BLS', 'odette-elegant-flared-blouse-with-belt', ['白色']),
  },
]

// ═══════════════════════════════════════════════════════════════════
// 針織 KNIT
// ═══════════════════════════════════════════════════════════════════
const KNIT_PRODUCTS: ProductDef[] = [
  {
    name: 'Urie 輕柔連帽薄針織上衣',
    slug: 'urie-light-hooded-thin-knit-top',
    price: 1980,
    salePrice: 1880,
    categorySlug: 'knit',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 200,
    tags: [{ tag: '連帽' }, { tag: '薄針織' }, { tag: '輕柔' }, { tag: '百搭' }],
    variants: freeVariants('KNT', 'urie-light-hooded-thin-knit-top', COLORS_4),
  },
  {
    name: 'Elena 掛脖修身羊毛背心',
    slug: 'elena-halter-slim-wool-vest',
    price: 1580,
    categorySlug: 'knit',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 180,
    tags: [{ tag: '掛脖' }, { tag: '修身' }, { tag: '羊毛' }, { tag: '背心' }],
    variants: freeVariants('KNT', 'elena-halter-slim-wool-vest', COLORS_5),
  },
  {
    name: 'Cara 不對稱綁帶羊毛上衣',
    slug: 'cara-asymmetric-tie-wool-top',
    price: 1180,
    categorySlug: 'knit',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 190,
    tags: [{ tag: '不對稱' }, { tag: '綁帶' }, { tag: '羊毛' }, { tag: '設計感' }],
    variants: freeVariants('KNT', 'cara-asymmetric-tie-wool-top', COLORS_2),
  },
  {
    name: 'Brie 開襟斜釦針織上衣',
    slug: 'brie-open-diagonal-button-knit-top',
    price: 1080,
    categorySlug: 'knit',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 175,
    tags: [{ tag: '開襟' }, { tag: '斜釦' }, { tag: '針織' }, { tag: '百搭' }],
    variants: freeVariants('KNT', 'brie-open-diagonal-button-knit-top', COLORS_2),
  },
  {
    name: 'Alma 別緻五分泡泡袖針織衫',
    slug: 'alma-chic-puff-sleeve-knit-top',
    price: 1380,
    categorySlug: 'knit',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 195,
    tags: [{ tag: '泡泡袖' }, { tag: '五分袖' }, { tag: '別緻' }, { tag: '韓系' }],
    variants: freeVariants('KNT', 'alma-chic-puff-sleeve-knit-top', COLORS_2),
  },
  {
    name: 'Elsie 橫條羅紋POLO針織衫',
    slug: 'elsie-stripe-rib-polo-knit',
    price: 1280,
    categorySlug: 'knit',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 210,
    tags: [{ tag: 'POLO' }, { tag: '橫條' }, { tag: '羅紋' }, { tag: '百搭' }],
    variants: freeVariants('KNT', 'elsie-stripe-rib-polo-knit', COLORS_2),
  },
  {
    name: 'Ula 優雅領巾針織衫',
    slug: 'ula-elegant-scarf-knit-top',
    price: 1680,
    categorySlug: 'knit',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 220,
    tags: [{ tag: '領巾' }, { tag: '優雅' }, { tag: '針織' }, { tag: '氣質' }],
    variants: freeVariants('KNT', 'ula-elegant-scarf-knit-top', ['象牙白']),
  },
  {
    name: 'Wynn 襯衫領羅紋針織上衣',
    slug: 'wynn-shirt-collar-rib-knit-top',
    price: 1880,
    categorySlug: 'knit',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 215,
    tags: [{ tag: '襯衫領' }, { tag: '羅紋' }, { tag: '針織' }, { tag: '通勤' }],
    variants: freeVariants('KNT', 'wynn-shirt-collar-rib-knit-top', ['黑色']),
  },
  {
    name: 'Gricel 知性立領繡孔針織上衣',
    slug: 'gricel-intellectual-stand-collar-eyelet-knit',
    price: 2180,
    categorySlug: 'knit',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 230,
    tags: [{ tag: '立領' }, { tag: '繡孔' }, { tag: '知性' }, { tag: '氣質' }],
    variants: freeVariants('KNT', 'gricel-intellectual-stand-collar-eyelet-knit', COLORS_2),
  },
  {
    name: 'Lovely 愛心針織上衣',
    slug: 'lovely-heart-knit-top',
    price: 2180,
    categorySlug: 'knit',
    stock: 0,
    status: 'published',
    isNew: true,
    collectionTags: ['rush'],
    weight: 200,
    tags: [{ tag: '愛心' }, { tag: '可愛' }, { tag: '針織' }, { tag: '約會穿搭' }],
    variants: freeVariants('KNT', 'lovely-heart-knit-top', COLORS_2),
  },
  {
    name: 'Minni 羊駝毛柔霧薄針織',
    slug: 'minni-alpaca-soft-matte-thin-knit',
    price: 1880,
    categorySlug: 'knit',
    stock: 0,
    status: 'published',
    weight: 185,
    tags: [{ tag: '羊駝毛' }, { tag: '柔霧' }, { tag: '薄針織' }, { tag: '百搭' }],
    variants: freeVariants('KNT', 'minni-alpaca-soft-matte-thin-knit', COLORS_4),
  },
]

// ═══════════════════════════════════════════════════════════════════
// 洋裝 DRESSES
// ═══════════════════════════════════════════════════════════════════
const DRESS_PRODUCTS: ProductDef[] = [
  {
    name: 'Dream 拼接絲緞蝴蝶結洋裝',
    slug: 'dream-spliced-satin-bow-dress',
    price: 2680,
    salePrice: 2480,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 280,
    tags: [{ tag: '絲緞' }, { tag: '蝴蝶結' }, { tag: '拼接' }, { tag: '甜美' }],
    variants: multiVariants('DRS', 'dream-spliced-satin-bow-dress', COLORS_2, SIZES_SM),
  },
  {
    name: 'Colette 修身提腰氣質洋裝',
    slug: 'colette-slim-empire-waist-elegant-dress',
    price: 3080,
    salePrice: 2880,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 290,
    tags: [{ tag: '修身' }, { tag: '提腰' }, { tag: '氣質' }, { tag: '約會穿搭' }],
    variants: multiVariants('DRS', 'colette-slim-empire-waist-elegant-dress', COLORS_2, SIZES_SM),
  },
  {
    name: 'Estelle 小香珍珠洋裝',
    slug: 'estelle-chanel-pearl-dress',
    price: 3680,
    salePrice: 3380,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    isNew: true,
    isHot: true,
    collectionTags: ['formal-dresses'],
    weight: 320,
    tags: [{ tag: '小香風' }, { tag: '珍珠' }, { tag: '名媛' }, { tag: '宴會' }],
    variants: multiVariants('DRS', 'estelle-chanel-pearl-dress', COLORS_2, SIZES_SM),
  },
  {
    name: 'Amelia 優雅疊紗包釦洋裝',
    slug: 'amelia-elegant-layered-chiffon-covered-button-dress',
    price: 2780,
    salePrice: 2580,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 270,
    tags: [{ tag: '疊紗' }, { tag: '包釦' }, { tag: '優雅' }, { tag: '氣質' }],
    variants: multiVariants('DRS', 'amelia-elegant-layered-chiffon-covered-button-dress', COLORS_2, SIZES_SML),
  },
  {
    name: 'Yuna 氣質收腰雙排釦洋裝',
    slug: 'yuna-elegant-waist-double-breasted-dress',
    price: 3180,
    salePrice: 2880,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    weight: 310,
    tags: [{ tag: '收腰' }, { tag: '雙排釦' }, { tag: '氣質' }, { tag: '通勤' }],
    variants: multiVariants('DRS', 'yuna-elegant-waist-double-breasted-dress', COLORS_2, SIZES_SM),
  },
  {
    name: 'Vera 浪漫飄逸水手領洋裝',
    slug: 'vera-romantic-flowing-sailor-collar-dress',
    price: 2980,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    weight: 260,
    tags: [{ tag: '水手領' }, { tag: '飄逸' }, { tag: '浪漫' }, { tag: '約會穿搭' }],
    variants: freeVariants('DRS', 'vera-romantic-flowing-sailor-collar-dress', COLORS_3),
  },
  {
    name: 'Serene 名媛蕾絲層次洋裝',
    slug: 'serene-ladylike-lace-layered-dress',
    price: 2980,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    collectionTags: ['formal-dresses'],
    weight: 295,
    tags: [{ tag: '蕾絲' }, { tag: '層次' }, { tag: '名媛' }, { tag: '宴會' }],
    variants: multiVariants('DRS', 'serene-ladylike-lace-layered-dress', COLORS_2, SIZES_SML),
  },
  {
    name: 'Tara 專業感假兩件洋裝',
    slug: 'tara-professional-faux-twopiece-dress',
    price: 2980,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    weight: 285,
    tags: [{ tag: '假兩件' }, { tag: '專業感' }, { tag: '通勤' }, { tag: '氣質' }],
    variants: multiVariants('DRS', 'tara-professional-faux-twopiece-dress', COLORS_2, SIZES_SML),
  },
  {
    name: 'Rhea 精緻襯衫領層次洋裝',
    slug: 'rhea-refined-shirt-collar-layered-dress',
    price: 2980,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    weight: 275,
    tags: [{ tag: '襯衫領' }, { tag: '層次' }, { tag: '精緻' }, { tag: '氣質' }],
    variants: multiVariants('DRS', 'rhea-refined-shirt-collar-layered-dress', COLORS_2, SIZES_SM),
  },
  {
    name: 'Quincy 氣質裹身微開衩洋裝',
    slug: 'quincy-elegant-wrap-slit-dress',
    price: 2980,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    weight: 270,
    tags: [{ tag: '裹身' }, { tag: '開衩' }, { tag: '修身' }, { tag: '氣質' }],
    variants: multiVariants('DRS', 'quincy-elegant-wrap-slit-dress', COLORS_3, SIZES_SML),
  },
  {
    name: 'Penelope 名媛風粗花呢洋裝',
    slug: 'penelope-ladylike-tweed-dress',
    price: 2980,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    collectionTags: ['formal-dresses'],
    weight: 340,
    tags: [{ tag: '粗花呢' }, { tag: '名媛' }, { tag: '小香風' }, { tag: '宴會' }],
    variants: multiVariants('DRS', 'penelope-ladylike-tweed-dress', COLORS_2, SIZES_SM),
  },
  {
    name: 'Olivia 優雅V領珍珠花釦洋裝',
    slug: 'olivia-elegant-vneck-pearl-flower-button-dress',
    price: 2980,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    weight: 280,
    tags: [{ tag: 'V領' }, { tag: '珍珠' }, { tag: '花釦' }, { tag: '優雅' }],
    variants: multiVariants('DRS', 'olivia-elegant-vneck-pearl-flower-button-dress', COLORS_2, SIZES_SML),
  },
  {
    name: 'Lucia 公主風修身A字洋裝',
    slug: 'lucia-princess-slim-aline-dress',
    price: 2980,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    weight: 265,
    tags: [{ tag: 'A字裙' }, { tag: '公主風' }, { tag: '修身' }, { tag: '甜美' }],
    variants: multiVariants('DRS', 'lucia-princess-slim-aline-dress', COLORS_2, SIZES_SML),
  },
  {
    name: 'Jess 荷葉拼接格紋洋裝',
    slug: 'jess-ruffle-splice-plaid-dress',
    price: 4580,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    isHot: true,
    weight: 360,
    tags: [{ tag: '荷葉邊' }, { tag: '格紋' }, { tag: '拼接' }, { tag: '氣質' }],
    variants: freeVariants('DRS', 'jess-ruffle-splice-plaid-dress', COLORS_2),
  },
]

// ═══════════════════════════════════════════════════════════════════
// 長褲 LONG-PANTS
// ═══════════════════════════════════════════════════════════════════
const LONGPANTS_PRODUCTS: ProductDef[] = [
  {
    name: 'Abigail 粉色心機長腿微喇叭牛仔褲',
    slug: 'abigail-pink-leg-lengthening-flare-jeans',
    price: 2980,
    salePrice: 2780,
    categorySlug: 'long-pants',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 450,
    tags: [{ tag: '喇叭褲' }, { tag: '牛仔褲' }, { tag: '顯瘦' }, { tag: '長腿' }],
    variants: multiVariants('PNT', 'abigail-pink-flare-jeans', ['白色'], SIZES_SMLXL),
  },
  {
    name: 'Zeline 愛心刺繡寬鬆丹寧褲',
    slug: 'zeline-heart-embroidery-relaxed-denim-pants',
    price: 1880,
    categorySlug: 'long-pants',
    stock: 0,
    status: 'published',
    weight: 480,
    tags: [{ tag: '刺繡' }, { tag: '丹寧' }, { tag: '愛心' }, { tag: '寬鬆' }],
    variants: multiVariants('PNT', 'zeline-heart-embroidery-denim', ['藍色'], SIZES_SMLXL),
  },
  {
    name: '螞蟻腰修身線條寬管西裝褲',
    slug: 'ant-waist-slim-wide-leg-trousers',
    price: 1580,
    categorySlug: 'long-pants',
    stock: 0,
    status: 'published',
    isHot: true,
    weight: 350,
    tags: [{ tag: '螞蟻腰' }, { tag: '寬管褲' }, { tag: '西裝褲' }, { tag: '顯瘦' }],
    variants: multiVariants('PNT', 'ant-waist-wide-leg-trousers', COLORS_3, SIZES_SMLXL),
  },
  {
    name: '螞蟻腰都會修身直筒褲',
    slug: 'ant-waist-urban-slim-straight-pants',
    price: 1480,
    categorySlug: 'long-pants',
    stock: 0,
    status: 'published',
    isHot: true,
    weight: 330,
    tags: [{ tag: '螞蟻腰' }, { tag: '直筒褲' }, { tag: '修身' }, { tag: '通勤' }],
    variants: multiVariants('PNT', 'ant-waist-slim-straight-pants', COLORS_3, SIZES_SMLXL),
  },
  {
    name: 'Yves 極修身微喇叭西裝褲',
    slug: 'yves-ultra-slim-micro-flare-trousers',
    price: 1780,
    categorySlug: 'long-pants',
    stock: 0,
    status: 'published',
    weight: 360,
    tags: [{ tag: '微喇叭' }, { tag: '西裝褲' }, { tag: '修身' }, { tag: '通勤' }],
    variants: multiVariants('PNT', 'yves-micro-flare-trousers', COLORS_3, SIZES_SML),
  },
  {
    name: 'Trinity 淺洗直筒牛仔褲',
    slug: 'trinity-lightwash-straight-jeans',
    price: 2580,
    categorySlug: 'long-pants',
    stock: 0,
    status: 'published',
    weight: 460,
    tags: [{ tag: '淺洗' }, { tag: '直筒褲' }, { tag: '牛仔褲' }, { tag: '百搭' }],
    variants: multiVariants('PNT', 'trinity-lightwash-straight-jeans', ['淺藍色'], SIZES_SM),
  },
]

// ═══════════════════════════════════════════════════════════════════
// 短褲 SHORTS
// ═══════════════════════════════════════════════════════════════════
const SHORTS_PRODUCTS: ProductDef[] = [
  {
    name: 'Candace 俐落直筒五分褲',
    slug: 'candace-clean-straight-cropped-pants',
    price: 1480,
    salePrice: 1380,
    categorySlug: 'shorts',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 280,
    tags: [{ tag: '五分褲' }, { tag: '直筒' }, { tag: '俐落' }, { tag: '百搭' }],
    variants: multiVariants('SHT', 'candace-straight-cropped-pants', COLORS_2, SIZES_SML),
  },
  {
    name: 'Beck 寬腰帶打摺五分褲',
    slug: 'beck-wide-waistband-pleated-cropped-pants',
    price: 1880,
    salePrice: 1780,
    categorySlug: 'shorts',
    stock: 0,
    status: 'published',
    weight: 300,
    tags: [{ tag: '寬腰帶' }, { tag: '打摺' }, { tag: '五分褲' }, { tag: '氣質' }],
    variants: freeVariants('SHT', 'beck-wide-waistband-pleated-cropped-pants', COLORS_2),
  },
]

// ═══════════════════════════════════════════════════════════════════
// 中長裙 MIDI-LONG-SKIRTS
// ═══════════════════════════════════════════════════════════════════
const MIDISKIRT_PRODUCTS: ProductDef[] = [
  {
    name: 'Janice 復古塗層鉛筆裙',
    slug: 'janice-vintage-coated-pencil-skirt',
    price: 2480,
    salePrice: 2280,
    categorySlug: 'midi-long-skirts',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 340,
    tags: [{ tag: '鉛筆裙' }, { tag: '復古' }, { tag: '塗層' }, { tag: '修身' }],
    variants: multiVariants('MSK', 'janice-vintage-coated-pencil-skirt', COLORS_3, SIZES_SML),
  },
  {
    name: 'Irene 極簡高腰直筒長裙',
    slug: 'irene-minimalist-high-waist-straight-maxi-skirt',
    price: 1280,
    salePrice: 1180,
    categorySlug: 'midi-long-skirts',
    stock: 0,
    status: 'published',
    weight: 310,
    tags: [{ tag: '高腰' }, { tag: '直筒' }, { tag: '極簡' }, { tag: '長裙' }],
    variants: freeVariants('MSK', 'irene-minimalist-high-waist-straight-maxi-skirt', COLORS_3),
  },
  {
    name: 'Helen 純棉抓皺層次長裙',
    slug: 'helen-cotton-ruched-layered-maxi-skirt',
    price: 2680,
    categorySlug: 'midi-long-skirts',
    stock: 0,
    status: 'published',
    weight: 360,
    tags: [{ tag: '純棉' }, { tag: '抓皺' }, { tag: '層次' }, { tag: '長裙' }],
    variants: freeVariants('MSK', 'helen-cotton-ruched-layered-maxi-skirt', COLORS_2),
  },
  {
    name: 'Ginny 高腰收腹傘裙 (附三角綁帶)',
    slug: 'ginny-high-waist-tummy-control-flare-skirt',
    price: 3380,
    categorySlug: 'midi-long-skirts',
    stock: 0,
    status: 'published',
    weight: 320,
    tags: [{ tag: '高腰' }, { tag: '傘裙' }, { tag: '收腹' }, { tag: '綁帶' }],
    variants: multiVariants('MSK', 'ginny-high-waist-tummy-control-flare-skirt', COLORS_2, SIZES_SM),
  },
  {
    name: 'Fiona 知性高腰打褶傘裙',
    slug: 'fiona-intellectual-high-waist-pleated-flare-skirt',
    price: 2480,
    categorySlug: 'midi-long-skirts',
    stock: 0,
    status: 'published',
    weight: 300,
    tags: [{ tag: '高腰' }, { tag: '打褶' }, { tag: '傘裙' }, { tag: '知性' }],
    variants: multiVariants('MSK', 'fiona-intellectual-high-waist-pleated-flare-skirt', COLORS_3, SIZES_SM),
  },
]

// ═══════════════════════════════════════════════════════════════════
// 短裙 MINI-SKIRTS
// ═══════════════════════════════════════════════════════════════════
const MINISKIRT_PRODUCTS: ProductDef[] = [
  {
    name: 'Vion 雙層荷葉雪紡短裙',
    slug: 'vion-double-ruffle-chiffon-mini-skirt',
    price: 2680,
    salePrice: 2480,
    categorySlug: 'mini-skirts',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 220,
    tags: [{ tag: '荷葉邊' }, { tag: '雙層' }, { tag: '雪紡' }, { tag: '浪漫' }],
    variants: freeVariants('MSS', 'vion-double-ruffle-chiffon-mini-skirt', COLORS_3),
  },
  {
    name: 'Myrca 優雅百摺褲裙',
    slug: 'myrca-elegant-pleated-skort',
    price: 1480,
    salePrice: 1380,
    categorySlug: 'mini-skirts',
    stock: 0,
    status: 'published',
    weight: 240,
    tags: [{ tag: '百摺' }, { tag: '褲裙' }, { tag: '優雅' }, { tag: '氣質' }],
    variants: multiVariants('MSS', 'myrca-elegant-pleated-skort', COLORS_3, SIZES_SM),
  },
]

// ═══════════════════════════════════════════════════════════════════
// 套裝 SETS — FORMAL
// ═══════════════════════════════════════════════════════════════════
const FORMALSET_PRODUCTS: ProductDef[] = [
  {
    name: 'Miriam 優雅高腰寬褲西裝套裝',
    slug: 'miriam-elegant-high-waist-wide-leg-suit-set',
    price: 4780,
    salePrice: 4280,
    categorySlug: 'formal-sets',
    stock: 0,
    status: 'published',
    isNew: true,
    isHot: true,
    collectionTags: ['formal-dresses'],
    weight: 700,
    tags: [{ tag: '套裝' }, { tag: '西裝' }, { tag: '高腰' }, { tag: '寬褲' }, { tag: '通勤' }],
    variants: multiVariants('FST', 'miriam-highwaist-wide-leg-suit', COLORS_2, SIZES_SML),
  },
  {
    name: 'Marcia 側開衩魚尾套裝長裙',
    slug: 'marcia-side-slit-mermaid-suit-skirt',
    price: 2280,
    categorySlug: 'formal-sets',
    stock: 0,
    status: 'published',
    collectionTags: ['rush', 'formal-dresses'],
    weight: 350,
    tags: [{ tag: '魚尾裙' }, { tag: '開衩' }, { tag: '套裝' }, { tag: '正式' }],
    variants: multiVariants('FST', 'marcia-mermaid-suit-skirt', COLORS_2, SIZES_SM),
  },
  {
    name: 'Marcia 方領七分袖套裝襯衫',
    slug: 'marcia-square-neck-3q-sleeve-suit-blouse',
    price: 2780,
    categorySlug: 'formal-sets',
    stock: 0,
    status: 'published',
    collectionTags: ['rush', 'formal-dresses'],
    weight: 220,
    tags: [{ tag: '方領' }, { tag: '七分袖' }, { tag: '套裝' }, { tag: '正式' }],
    variants: freeVariants('FST', 'marcia-square-neck-suit-blouse', ['深灰色']),
  },
  {
    name: 'Zabara 領巾圓領套裝外套',
    slug: 'zabara-scarf-round-neck-suit-jacket',
    price: 3280,
    categorySlug: 'formal-sets',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 450,
    tags: [{ tag: '領巾' }, { tag: '圓領' }, { tag: '套裝外套' }, { tag: '氣質' }],
    variants: multiVariants('FST', 'zabara-scarf-suit-jacket', COLORS_2, SIZES_SM),
  },
  {
    name: 'Zabara 微A字套裝中裙',
    slug: 'zabara-subtle-aline-suit-midi-skirt',
    price: 1680,
    categorySlug: 'formal-sets',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 270,
    tags: [{ tag: 'A字裙' }, { tag: '套裝' }, { tag: '中裙' }, { tag: '氣質' }],
    variants: multiVariants('FST', 'zabara-aline-suit-midi-skirt', COLORS_2, SIZES_SM),
  },
  {
    name: 'Korrine 高端排釦傘襬腰身套裝',
    slug: 'korrine-premium-button-flare-waist-suit',
    price: 4580,
    categorySlug: 'formal-sets',
    stock: 0,
    status: 'published',
    collectionTags: ['rush', 'formal-dresses'],
    isHot: true,
    weight: 600,
    tags: [{ tag: '排釦' }, { tag: '傘擺' }, { tag: '套裝' }, { tag: '高端' }, { tag: '宴會' }],
    variants: [
      { colorName: '黑色', colorCode: colorCode('黑色'), size: 'L', sku: sku('FST', 'korrine-flare-waist-suit', '黑色', 'L'), stock: rnd(5, 20) },
    ],
  },
  {
    name: 'Novia 細褶套裝裙',
    slug: 'novia-micro-pleat-suit-skirt',
    price: 2980,
    categorySlug: 'formal-sets',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 290,
    tags: [{ tag: '細褶' }, { tag: '套裝裙' }, { tag: '氣質' }, { tag: '通勤' }],
    variants: freeVariants('FST', 'novia-micro-pleat-suit-skirt', COLORS_2),
  },
  {
    name: 'Novia 無袖細褶套裝背心',
    slug: 'novia-sleeveless-micro-pleat-suit-vest',
    price: 2280,
    categorySlug: 'formal-sets',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 200,
    tags: [{ tag: '無袖' }, { tag: '細褶' }, { tag: '背心' }, { tag: '套裝' }],
    variants: freeVariants('FST', 'novia-sleeveless-micro-pleat-suit-vest', ['黑色', '象牙白', '灰色', '米色', '粉色', '深藍', '焦糖棕']),
  },
  {
    name: 'Novia 細褶套裝上衣',
    slug: 'novia-micro-pleat-suit-top',
    price: 2580,
    categorySlug: 'formal-sets',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 215,
    tags: [{ tag: '細褶' }, { tag: '套裝上衣' }, { tag: '氣質' }, { tag: '通勤' }],
    variants: freeVariants('FST', 'novia-micro-pleat-suit-top', COLORS_3),
  },
  {
    name: 'Novia 細褶套裝開襟衫',
    slug: 'novia-micro-pleat-suit-cardigan',
    price: 3080,
    categorySlug: 'formal-sets',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 320,
    tags: [{ tag: '細褶' }, { tag: '開襟衫' }, { tag: '套裝' }, { tag: '氣質' }],
    variants: freeVariants('FST', 'novia-micro-pleat-suit-cardigan', COLORS_2),
  },
]

// ═══════════════════════════════════════════════════════════════════
// 套裝 SETS — CASUAL
// ═══════════════════════════════════════════════════════════════════
const CASUALSET_PRODUCTS: ProductDef[] = [
  {
    name: 'Roberta 線條刷絨套裝褲',
    slug: 'roberta-stripe-fleece-suit-pants',
    price: 3680,
    categorySlug: 'casual-sets',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 380,
    tags: [{ tag: '刷絨' }, { tag: '套裝褲' }, { tag: '線條' }, { tag: '休閒' }],
    variants: freeVariants('CST', 'roberta-stripe-fleece-suit-pants', COLORS_2),
  },
  {
    name: 'Roberta 線條刷絨套裝上衣',
    slug: 'roberta-stripe-fleece-suit-top',
    price: 4080,
    categorySlug: 'casual-sets',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 320,
    tags: [{ tag: '刷絨' }, { tag: '套裝上衣' }, { tag: '線條' }, { tag: '休閒' }],
    variants: freeVariants('CST', 'roberta-stripe-fleece-suit-top', COLORS_2),
  },
]

// ═══════════════════════════════════════════════════════════════════
// 配件 ACCESSORIES
// ═══════════════════════════════════════════════════════════════════
const ACCESSORY_PRODUCTS: ProductDef[] = [
  {
    name: '流線金屬長鍊',
    slug: 'streamline-metal-long-chain-necklace',
    price: 680,
    salePrice: 580,
    categorySlug: 'necklaces',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 30,
    tags: [{ tag: '項鍊' }, { tag: '金屬' }, { tag: '長鍊' }, { tag: '簡約' }],
    variants: freeVariants('NEC', 'streamline-metal-long-chain-necklace', ['銀色']),
  },
  {
    name: '復古風橢圓造型眼鏡',
    slug: 'vintage-oval-frame-glasses',
    price: 780,
    salePrice: 680,
    categorySlug: 'glasses',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 35,
    tags: [{ tag: '眼鏡' }, { tag: '橢圓框' }, { tag: '復古' }, { tag: '造型' }],
    variants: freeVariants('GLS', 'vintage-oval-frame-glasses', ['黑色', '象牙白', '灰色', '焦糖棕', '米色']),
  },
  {
    name: '知性圓框造型眼鏡',
    slug: 'intellectual-round-frame-glasses',
    price: 680,
    salePrice: 580,
    categorySlug: 'glasses',
    stock: 0,
    status: 'published',
    weight: 33,
    tags: [{ tag: '眼鏡' }, { tag: '圓框' }, { tag: '知性' }, { tag: '造型' }],
    variants: freeVariants('GLS', 'intellectual-round-frame-glasses', COLORS_3),
  },
  {
    name: 'Mielle 浪漫仙女絲巾',
    slug: 'mielle-romantic-fairy-scarf',
    price: 780,
    categorySlug: 'hats-scarves',
    stock: 0,
    status: 'published',
    weight: 40,
    tags: [{ tag: '絲巾' }, { tag: '仙女' }, { tag: '浪漫' }, { tag: '飾品' }],
    variants: freeVariants('SCF', 'mielle-romantic-fairy-scarf', ['白色']),
  },
  {
    name: '古著風洞石項鏈',
    slug: 'vintage-holey-stone-necklace',
    price: 580,
    categorySlug: 'necklaces',
    stock: 0,
    status: 'published',
    weight: 28,
    tags: [{ tag: '洞石' }, { tag: '古著' }, { tag: '項鍊' }, { tag: '個性' }],
    variants: freeVariants('NEC', 'vintage-holey-stone-necklace', COLORS_3),
  },
  {
    name: '率性牛皮皮帶',
    slug: 'casual-genuine-leather-belt',
    price: 2580,
    categorySlug: 'belts',
    stock: 0,
    status: 'published',
    weight: 150,
    tags: [{ tag: '皮帶' }, { tag: '牛皮' }, { tag: '率性' }, { tag: '百搭' }],
    variants: freeVariants('BLT', 'casual-genuine-leather-belt', COLORS_2),
  },
  {
    name: '極簡圓珠長項鍊',
    slug: 'minimalist-round-bead-long-necklace',
    price: 580,
    categorySlug: 'necklaces',
    stock: 0,
    status: 'published',
    weight: 25,
    tags: [{ tag: '圓珠' }, { tag: '長項鍊' }, { tag: '極簡' }, { tag: '百搭' }],
    variants: freeVariants('NEC', 'minimalist-round-bead-long-necklace', ['銀色']),
  },
  {
    name: '簡約墨水滴項鍊',
    slug: 'minimalist-ink-drop-necklace',
    price: 580,
    categorySlug: 'necklaces',
    stock: 0,
    status: 'published',
    weight: 22,
    tags: [{ tag: '墨水滴' }, { tag: '項鍊' }, { tag: '簡約' }, { tag: '設計感' }],
    variants: freeVariants('NEC', 'minimalist-ink-drop-necklace', ['銀色']),
  },
  {
    name: '刺繡徽章棒球帽',
    slug: 'embroidered-badge-baseball-cap',
    price: 780,
    categorySlug: 'hats-scarves',
    stock: 0,
    status: 'published',
    weight: 80,
    tags: [{ tag: '棒球帽' }, { tag: '刺繡' }, { tag: '徽章' }, { tag: '百搭' }],
    variants: freeVariants('HAT', 'embroidered-badge-baseball-cap', COLORS_4),
  },
  {
    name: '復古感麂皮運動鞋',
    slug: 'vintage-suede-sneakers',
    price: 2580,
    categorySlug: 'shoes',
    stock: 0,
    status: 'published',
    weight: 480,
    tags: [{ tag: '運動鞋' }, { tag: '麂皮' }, { tag: '復古' }, { tag: '百搭' }],
    variants: [
      { colorName: '黑色', colorCode: colorCode('黑色'), size: '230', sku: sku('SHO', 'vintage-suede-sneakers', '黑色', '230'), stock: rnd(5, 20) },
      { colorName: '黑色', colorCode: colorCode('黑色'), size: '235', sku: sku('SHO', 'vintage-suede-sneakers', '黑色', '235'), stock: rnd(5, 20) },
      { colorName: '黑色', colorCode: colorCode('黑色'), size: '240', sku: sku('SHO', 'vintage-suede-sneakers', '黑色', '240'), stock: rnd(5, 20) },
      { colorName: '黑色', colorCode: colorCode('黑色'), size: '245', sku: sku('SHO', 'vintage-suede-sneakers', '黑色', '245'), stock: rnd(5, 20) },
      { colorName: '黑色', colorCode: colorCode('黑色'), size: '250', sku: sku('SHO', 'vintage-suede-sneakers', '黑色', '250'), stock: rnd(5, 20) },
      { colorName: '象牙白', colorCode: colorCode('象牙白'), size: '230', sku: sku('SHO', 'vintage-suede-sneakers', '象牙白', '230'), stock: rnd(5, 20) },
      { colorName: '象牙白', colorCode: colorCode('象牙白'), size: '235', sku: sku('SHO', 'vintage-suede-sneakers', '象牙白', '235'), stock: rnd(5, 20) },
      { colorName: '象牙白', colorCode: colorCode('象牙白'), size: '240', sku: sku('SHO', 'vintage-suede-sneakers', '象牙白', '240'), stock: rnd(5, 20) },
      { colorName: '象牙白', colorCode: colorCode('象牙白'), size: '245', sku: sku('SHO', 'vintage-suede-sneakers', '象牙白', '245'), stock: rnd(5, 20) },
      { colorName: '象牙白', colorCode: colorCode('象牙白'), size: '250', sku: sku('SHO', 'vintage-suede-sneakers', '象牙白', '250'), stock: rnd(5, 20) },
      { colorName: '灰色', colorCode: colorCode('灰色'), size: '230', sku: sku('SHO', 'vintage-suede-sneakers', '灰色', '230'), stock: rnd(5, 20) },
      { colorName: '灰色', colorCode: colorCode('灰色'), size: '235', sku: sku('SHO', 'vintage-suede-sneakers', '灰色', '235'), stock: rnd(5, 20) },
      { colorName: '灰色', colorCode: colorCode('灰色'), size: '240', sku: sku('SHO', 'vintage-suede-sneakers', '灰色', '240'), stock: rnd(5, 20) },
      { colorName: '灰色', colorCode: colorCode('灰色'), size: '245', sku: sku('SHO', 'vintage-suede-sneakers', '灰色', '245'), stock: rnd(5, 20) },
      { colorName: '灰色', colorCode: colorCode('灰色'), size: '250', sku: sku('SHO', 'vintage-suede-sneakers', '灰色', '250'), stock: rnd(5, 20) },
    ],
  },
  {
    name: 'Y2K個性橢圓墨鏡',
    slug: 'y2k-personality-oval-sunglasses',
    price: 780,
    categorySlug: 'glasses',
    stock: 0,
    status: 'published',
    weight: 36,
    tags: [{ tag: 'Y2K' }, { tag: '墨鏡' }, { tag: '橢圓' }, { tag: '個性' }],
    variants: freeVariants('GLS', 'y2k-personality-oval-sunglasses', COLORS_5),
  },
  {
    name: '時髦多色橢圓墨鏡',
    slug: 'trendy-multicolor-oval-sunglasses',
    price: 780,
    categorySlug: 'glasses',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 36,
    tags: [{ tag: '墨鏡' }, { tag: '橢圓' }, { tag: '多色' }, { tag: '時髦' }],
    variants: freeVariants('GLS', 'trendy-multicolor-oval-sunglasses', ['黑色', '象牙白', '灰色', '焦糖棕', '粉色', '深藍']),
  },
]

// ═══════════════════════════════════════════════════════════════════
// 現貨速到 RUSH DELIVERY
// ═══════════════════════════════════════════════════════════════════
const RUSH_PRODUCTS: ProductDef[] = [
  {
    name: 'Peyton 風衣式腰帶襯衫',
    slug: 'peyton-trench-style-belted-blouse',
    price: 1580,
    categorySlug: 'rush-delivery',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 200,
    tags: [{ tag: '風衣式' }, { tag: '腰帶' }, { tag: '襯衫' }, { tag: '現貨' }],
    variants: freeVariants('RUS', 'peyton-trench-style-belted-blouse', COLORS_2),
  },
  {
    name: 'Paisly 小清新格紋襯衫',
    slug: 'paisly-fresh-plaid-blouse',
    price: 2680,
    categorySlug: 'rush-delivery',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 195,
    tags: [{ tag: '格紋' }, { tag: '清新' }, { tag: '襯衫' }, { tag: '現貨' }],
    variants: freeVariants('RUS', 'paisly-fresh-plaid-blouse', COLORS_2),
  },
  {
    name: 'Rora 顯瘦直筒丹寧褲',
    slug: 'rora-slimming-straight-denim-pants',
    price: 1680,
    categorySlug: 'rush-delivery',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 430,
    tags: [{ tag: '丹寧褲' }, { tag: '直筒' }, { tag: '顯瘦' }, { tag: '現貨' }],
    variants: [
      { colorName: '白色', colorCode: colorCode('白色'), size: 'S', sku: sku('RUS', 'rora-straight-denim-pants', '白色', 'S'), stock: rnd(5, 25) },
    ],
  },
  {
    name: 'Raspberry 無袖香香洋裝',
    slug: 'raspberry-sleeveless-chanel-style-dress',
    price: 2180,
    categorySlug: 'rush-delivery',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 270,
    tags: [{ tag: '無袖' }, { tag: '香香外套' }, { tag: '洋裝' }, { tag: '現貨' }],
    variants: multiVariants('RUS', 'raspberry-sleeveless-chanel-dress', COLORS_2, SIZES_SML),
  },
  {
    name: 'Madeline 千鳥格假兩件包臀洋裝',
    slug: 'madeline-houndstooth-faux-twopiece-bodycon-dress',
    price: 3380,
    categorySlug: 'rush-delivery',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 310,
    tags: [{ tag: '千鳥格' }, { tag: '假兩件' }, { tag: '包臀' }, { tag: '現貨' }],
    variants: multiVariants('RUS', 'madeline-houndstooth-bodycon-dress', COLORS_2, SIZES_SM),
  },
  {
    name: 'Deirdre 領巾撞色A字長洋裝',
    slug: 'deirdre-scarf-colorblock-aline-maxi-dress',
    price: 3580,
    categorySlug: 'rush-delivery',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 300,
    tags: [{ tag: '領巾' }, { tag: '撞色' }, { tag: 'A字裙' }, { tag: '長洋裝' }, { tag: '現貨' }],
    variants: multiVariants('RUS', 'deirdre-scarf-colorblock-aline-dress', COLORS_2, SIZES_SM),
  },
  {
    name: 'Veronica 曼妙假兩件包臀洋裝',
    slug: 'veronica-graceful-faux-twopiece-bodycon-dress',
    price: 3380,
    categorySlug: 'rush-delivery',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 295,
    tags: [{ tag: '假兩件' }, { tag: '包臀' }, { tag: '修身' }, { tag: '現貨' }],
    variants: multiVariants('RUS', 'veronica-faux-twopiece-bodycon-dress', COLORS_2, SIZES_SM),
  },
  {
    name: 'Sloane 彈性收腹八分西裝褲',
    slug: 'sloane-elastic-tummy-control-ankle-trousers',
    price: 2680,
    categorySlug: 'rush-delivery',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 340,
    tags: [{ tag: '西裝褲' }, { tag: '收腹' }, { tag: '彈性' }, { tag: '現貨' }],
    variants: freeVariants('RUS', 'sloane-elastic-tummy-control-ankle-trousers', COLORS_3),
  },
  {
    name: 'Kaitlin 高雅金釦綁帶洋裝',
    slug: 'kaitlin-elegant-gold-button-tie-dress',
    price: 3980,
    categorySlug: 'rush-delivery',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    isHot: true,
    weight: 320,
    tags: [{ tag: '金釦' }, { tag: '綁帶' }, { tag: '高雅' }, { tag: '洋裝' }, { tag: '現貨' }],
    variants: freeVariants('RUS', 'kaitlin-elegant-gold-button-tie-dress', COLORS_2),
  },
  {
    name: 'Anila 單釦小翻領包臀洋裝',
    slug: 'anila-single-button-lapel-bodycon-dress',
    price: 3380,
    categorySlug: 'rush-delivery',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 285,
    tags: [{ tag: '單釦' }, { tag: '小翻領' }, { tag: '包臀' }, { tag: '現貨' }],
    variants: multiVariants('RUS', 'anila-single-button-lapel-bodycon-dress', COLORS_2, SIZES_SM),
  },
]

// ── 合併全部真實商品 ──
const ALL_REAL_PRODUCTS: ProductDef[] = [
  ...OUTER_PRODUCTS,
  ...TOP_PRODUCTS,
  ...BLOUSE_PRODUCTS,
  ...KNIT_PRODUCTS,
  ...DRESS_PRODUCTS,
  ...LONGPANTS_PRODUCTS,
  ...SHORTS_PRODUCTS,
  ...MIDISKIRT_PRODUCTS,
  ...MINISKIRT_PRODUCTS,
  ...FORMALSET_PRODUCTS,
  ...CASUALSET_PRODUCTS,
  ...ACCESSORY_PRODUCTS,
  ...RUSH_PRODUCTS,
]

// ── 前 10 件標記為 isNew ──
ALL_REAL_PRODUCTS.forEach((p, i) => {
  if (i < 10) p.isNew = true
})

// ── 主要 Seed 函式 ──

export async function seedRealProducts(): Promise<void> {
  console.log('\n[真實商品 Seed] 開始植入 CHIC KIM & MIU 真實商品（來自 www.chickimmiu.com）...\n')

  const payload = await getPayload({ config })

  // 步驟 1：確保分類已存在
  console.log('[步驟 1/2] 確認分類資料...')
  await seedCategories()

  // 讀取分類對照表（slug → id）
  const categoryMap: Record<string, string | number> = {}
  const allCats = await payload.find({
    collection: 'categories',
    limit: 200,
  })
  for (const cat of allCats.docs) {
    categoryMap[cat.slug as string] = cat.id
  }
  console.log(`[步驟 1/2] 已載入 ${Object.keys(categoryMap).length} 個分類`)

  // 步驟 2：植入商品
  console.log(`\n[步驟 2/2] 植入 ${ALL_REAL_PRODUCTS.length} 件真實商品...`)

  let created = 0
  let skipped = 0
  let failed = 0

  for (const product of ALL_REAL_PRODUCTS) {
    try {
      const categoryId = categoryMap[product.categorySlug]
      if (!categoryId) {
        console.warn(`  ⚠ ${product.name}: 找不到分類 "${product.categorySlug}"，跳過`)
        skipped++
        continue
      }

      // 如果已存在，跳過
      const existing = await payload.find({
        collection: 'products',
        where: { slug: { equals: product.slug } },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        console.log(`  → ${product.name} (已存在，跳過)`)
        skipped++
        continue
      }

      const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0)

      const desc = generateDescription(product)
      const data: Record<string, unknown> = {
        name: product.name,
        slug: product.slug,
        price: product.price,
        description: {
          root: {
            type: 'root',
            children: desc.split('\n\n').map((para) => ({
              type: 'paragraph',
              children: [{ type: 'text', text: para, version: 1 }],
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
            })),
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
        category: categoryId,
        stock: totalStock,
        status: product.status,
        isNew: product.isNew ?? false,
        isHot: product.isHot ?? false,
        weight: product.weight,
        variants: product.variants,
        tags: product.tags,
      }

      if (product.salePrice !== undefined) {
        data.salePrice = product.salePrice
      }

      if (product.collectionTags && product.collectionTags.length > 0) {
        data.collectionTags = product.collectionTags
      }

      await (payload.create as Function)({
        collection: 'products',
        data: data as unknown as Record<string, unknown>,
      })

      const priceDisplay = product.salePrice
        ? `NT$${product.salePrice.toLocaleString()} (原 NT$${product.price.toLocaleString()})`
        : `NT$${product.price.toLocaleString()}`

      console.log(
        `  ✓ ${product.name} | ${priceDisplay} | ${product.variants.length} 款式 | 庫存 ${totalStock}`,
      )
      created++
    } catch (err) {
      console.error(`  ✗ 建立失敗 [${product.slug}]:`, err)
      failed++
    }
  }

  // 完成摘要
  console.log('\n════════════════════════════════════')
  console.log('真實商品 Seed 完成！')
  console.log(`  新建：${created} 件`)
  console.log(`  跳過（已存在）：${skipped} 件`)
  if (failed > 0) console.log(`  失敗：${failed} 件`)
  console.log(`  總計嘗試：${ALL_REAL_PRODUCTS.length} 件`)
  console.log('════════════════════════════════════\n')
}

// ── 自執行主程式入口 ──

const isMain =
  process.argv[1]?.endsWith('seedRealProducts.ts') ||
  process.argv[1]?.endsWith('seedRealProducts.js')

if (isMain) {
  seedRealProducts()
    .then(() => {
      process.exit(0)
    })
    .catch((err) => {
      console.error('真實商品 Seed 失敗：', err)
      process.exit(1)
    })
}
