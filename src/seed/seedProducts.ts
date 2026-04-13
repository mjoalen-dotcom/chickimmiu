/**
 * CHIC KIM & MIU — 商品 Seed 腳本
 * ──────────────────────────────────
 * 為每個分類植入真實感樣本商品（40-50 件）
 *
 * 使用方式：
 *   npx tsx src/seed/seedProducts.ts
 *
 * 前置條件：
 *   1. PostgreSQL / SQLite 正在運行
 *   2. .env 中 DATABASE_URI 和 PAYLOAD_SECRET 已設定
 *   3. 已執行 Payload 資料庫遷移（npx payload migrate）
 */

import { getPayload } from 'payload'
import config from '../payload.config'
import { seedCategories } from './seedCategories'

// ── 商品資料型別 ──

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
  /** 對應 categories collection 的 slug */
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
  allowPreOrder?: boolean
  sourcing?: {
    supplierName?: string
    costKRW?: number
  }
}

// ── 輔助函式 ──

/** 產生標準 SKU：CKM-{CATEGORY}-{NUMBER}-{COLOR}{SIZE} */
function sku(category: string, num: number, color: string, size: string): string {
  return `CKM-${category.toUpperCase()}-${String(num).padStart(3, '0')}-${color}${size}`
}

/** 隨機庫存（5-50） */
function stock(min = 5, max = 50): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ── 商品資料 ──

// ═══════════════════════════════════════════════════════════
// 外套 OUTER
// ═══════════════════════════════════════════════════════════
const OUTER_PRODUCTS: ProductDef[] = [
  {
    name: '韓系寬鬆短版西裝外套',
    slug: 'ckm-korean-relaxed-cropped-blazer',
    price: 1980,
    salePrice: 1680,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    isNew: true,
    isHot: true,
    collectionTags: ['jin-style', 'rush'],
    weight: 350,
    tags: [{ tag: '韓系' }, { tag: '外套' }, { tag: '西裝外套' }, { tag: '通勤' }, { tag: '百搭' }],
    variants: [
      { colorName: '米白', colorCode: '#F5F0E8', size: 'S', sku: sku('OUTER', 1, 'MW', 'S'), stock: stock() },
      { colorName: '米白', colorCode: '#F5F0E8', size: 'M', sku: sku('OUTER', 1, 'MW', 'M'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'S', sku: sku('OUTER', 1, 'BK', 'S'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'M', sku: sku('OUTER', 1, 'BK', 'M'), stock: stock() },
    ],
  },
  {
    name: '小香風粗花呢短版外套',
    slug: 'ckm-chanel-tweed-cropped-jacket',
    price: 2580,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    isHot: true,
    collectionTags: ['celebrity-style', 'formal-dresses'],
    weight: 400,
    tags: [{ tag: '小香風' }, { tag: '粗花呢' }, { tag: '名媛' }, { tag: '通勤' }, { tag: '約會穿搭' }],
    variants: [
      { colorName: '香草奶白', colorCode: '#F7F2E3', size: 'S', sku: sku('OUTER', 2, 'VW', 'S'), stock: stock() },
      { colorName: '香草奶白', colorCode: '#F7F2E3', size: 'M', sku: sku('OUTER', 2, 'VW', 'M'), stock: stock() },
      { colorName: '玫瑰灰', colorCode: '#C4AFAF', size: 'S', sku: sku('OUTER', 2, 'RG', 'S'), stock: stock() },
      { colorName: '玫瑰灰', colorCode: '#C4AFAF', size: 'M', sku: sku('OUTER', 2, 'RG', 'M'), stock: stock() },
    ],
  },
  {
    name: '輕薄防曬長版風衣',
    slug: 'ckm-lightweight-uv-long-trench',
    price: 1680,
    salePrice: 1380,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 280,
    tags: [{ tag: '防曬' }, { tag: '風衣' }, { tag: '輕薄' }, { tag: '百搭' }, { tag: '顯瘦' }],
    variants: [
      { colorName: '卡其', colorCode: '#C2A87C', size: 'Free', sku: sku('OUTER', 3, 'KH', 'Free'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'Free', sku: sku('OUTER', 3, 'BK', 'Free'), stock: stock() },
      { colorName: '米白', colorCode: '#F5F0E8', size: 'Free', sku: sku('OUTER', 3, 'MW', 'Free'), stock: stock() },
    ],
  },
  {
    name: '都會簡約立領寬肩西裝外套',
    slug: 'ckm-urban-oversized-blazer',
    price: 2280,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    collectionTags: ['host-style'],
    weight: 370,
    tags: [{ tag: '西裝外套' }, { tag: '寬肩' }, { tag: '顯瘦' }, { tag: '通勤' }],
    variants: [
      { colorName: '燕麥', colorCode: '#D9C9A8', size: 'S', sku: sku('OUTER', 4, 'OT', 'S'), stock: stock() },
      { colorName: '燕麥', colorCode: '#D9C9A8', size: 'M', sku: sku('OUTER', 4, 'OT', 'M'), stock: stock() },
      { colorName: '深藍', colorCode: '#1C2D4B', size: 'S', sku: sku('OUTER', 4, 'NB', 'S'), stock: stock() },
      { colorName: '深藍', colorCode: '#1C2D4B', size: 'M', sku: sku('OUTER', 4, 'NB', 'M'), stock: stock() },
    ],
  },
  {
    name: '喀什米爾感柔軟罩衫外套',
    slug: 'ckm-cashmere-feel-soft-cardigan-coat',
    price: 1880,
    salePrice: 1580,
    categorySlug: 'outer',
    stock: 0,
    status: 'published',
    weight: 320,
    tags: [{ tag: '喀什米爾' }, { tag: '柔軟' }, { tag: '百搭' }, { tag: '秋冬' }],
    variants: [
      { colorName: '粉杏', colorCode: '#F2D0BB', size: 'Free', sku: sku('OUTER', 5, 'PA', 'Free'), stock: stock() },
      { colorName: '淺灰', colorCode: '#BEBEBE', size: 'Free', sku: sku('OUTER', 5, 'LG', 'Free'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'Free', sku: sku('OUTER', 5, 'BK', 'Free'), stock: stock() },
    ],
  },
]

// ═══════════════════════════════════════════════════════════
// 上衣 TOPS
// ═══════════════════════════════════════════════════════════
const TOP_PRODUCTS: ProductDef[] = [
  {
    name: '法式方領泡泡袖上衣',
    slug: 'ckm-french-square-neck-puff-sleeve-top',
    price: 980,
    salePrice: 780,
    categorySlug: 'tops',
    stock: 0,
    status: 'published',
    isNew: true,
    isHot: true,
    collectionTags: ['jin-live', 'rush'],
    weight: 150,
    tags: [{ tag: '法式' }, { tag: '方領' }, { tag: '泡泡袖' }, { tag: '約會穿搭' }, { tag: '顯瘦' }],
    variants: [
      { colorName: '奶油白', colorCode: '#FFF8E7', size: 'S', sku: sku('TOP', 1, 'CW', 'S'), stock: stock() },
      { colorName: '奶油白', colorCode: '#FFF8E7', size: 'M', sku: sku('TOP', 1, 'CW', 'M'), stock: stock() },
      { colorName: '粉霧藍', colorCode: '#B8D4E3', size: 'S', sku: sku('TOP', 1, 'MB', 'S'), stock: stock() },
      { colorName: '粉霧藍', colorCode: '#B8D4E3', size: 'M', sku: sku('TOP', 1, 'MB', 'M'), stock: stock() },
    ],
  },
  {
    name: '韓系純色短袖T恤',
    slug: 'ckm-korean-solid-short-sleeve-tee',
    price: 590,
    categorySlug: 'tops',
    stock: 0,
    status: 'published',
    collectionTags: ['rush'],
    weight: 120,
    tags: [{ tag: '韓系' }, { tag: 'T恤' }, { tag: '百搭' }, { tag: '休閒' }],
    variants: [
      { colorName: '白色', colorCode: '#FFFFFF', size: 'S', sku: sku('TOP', 2, 'WH', 'S'), stock: stock() },
      { colorName: '白色', colorCode: '#FFFFFF', size: 'M', sku: sku('TOP', 2, 'WH', 'M'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'S', sku: sku('TOP', 2, 'BK', 'S'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'M', sku: sku('TOP', 2, 'BK', 'M'), stock: stock() },
      { colorName: '灰色', colorCode: '#9E9E9E', size: 'S', sku: sku('TOP', 2, 'GR', 'S'), stock: stock() },
      { colorName: '灰色', colorCode: '#9E9E9E', size: 'M', sku: sku('TOP', 2, 'GR', 'M'), stock: stock() },
    ],
  },
  {
    name: '蕾絲拼接雪紡上衣',
    slug: 'ckm-lace-splice-chiffon-blouse',
    price: 1180,
    salePrice: 980,
    categorySlug: 'tops',
    stock: 0,
    status: 'published',
    isNew: true,
    collectionTags: ['jin-style'],
    weight: 130,
    tags: [{ tag: '蕾絲' }, { tag: '雪紡' }, { tag: '甜美' }, { tag: '約會穿搭' }, { tag: '韓系' }],
    variants: [
      { colorName: '米白', colorCode: '#F5F0E8', size: 'Free', sku: sku('TOP', 3, 'MW', 'Free'), stock: stock() },
      { colorName: '淡粉', colorCode: '#F9D7D7', size: 'Free', sku: sku('TOP', 3, 'LP', 'Free'), stock: stock() },
    ],
  },
  {
    name: '氣質方領綁帶吊帶背心',
    slug: 'ckm-square-neck-tie-cami-top',
    price: 780,
    categorySlug: 'tops',
    stock: 0,
    status: 'published',
    isHot: true,
    weight: 110,
    tags: [{ tag: '吊帶' }, { tag: '方領' }, { tag: '百搭' }, { tag: '夏季' }],
    variants: [
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'S', sku: sku('TOP', 4, 'BK', 'S'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'M', sku: sku('TOP', 4, 'BK', 'M'), stock: stock() },
      { colorName: '米白', colorCode: '#F5F0E8', size: 'S', sku: sku('TOP', 4, 'MW', 'S'), stock: stock() },
      { colorName: '米白', colorCode: '#F5F0E8', size: 'M', sku: sku('TOP', 4, 'MW', 'M'), stock: stock() },
    ],
  },
]

// ═══════════════════════════════════════════════════════════
// 針織 KNIT
// ═══════════════════════════════════════════════════════════
const KNIT_PRODUCTS: ProductDef[] = [
  {
    name: '慵懶風V領針織背心',
    slug: 'ckm-lazy-v-neck-knit-vest',
    price: 890,
    salePrice: 750,
    categorySlug: 'knit',
    stock: 0,
    status: 'published',
    isNew: true,
    collectionTags: ['jin-style', 'rush'],
    weight: 200,
    tags: [{ tag: '針織' }, { tag: '背心' }, { tag: '慵懶風' }, { tag: '百搭' }, { tag: '韓系' }],
    variants: [
      { colorName: '燕麥', colorCode: '#D9C9A8', size: 'Free', sku: sku('KNIT', 1, 'OT', 'Free'), stock: stock() },
      { colorName: '深棕', colorCode: '#5C3D2E', size: 'Free', sku: sku('KNIT', 1, 'DB', 'Free'), stock: stock() },
      { colorName: '灰紫', colorCode: '#9D8EB5', size: 'Free', sku: sku('KNIT', 1, 'LP', 'Free'), stock: stock() },
    ],
  },
  {
    name: '冰絲薄款針織開衫',
    slug: 'ckm-ice-silk-thin-knit-cardigan',
    price: 980,
    categorySlug: 'knit',
    stock: 0,
    status: 'published',
    isHot: true,
    weight: 180,
    tags: [{ tag: '冰絲' }, { tag: '開衫' }, { tag: '針織' }, { tag: '夏季' }, { tag: '空調外套' }],
    variants: [
      { colorName: '白色', colorCode: '#FFFFFF', size: 'Free', sku: sku('KNIT', 2, 'WH', 'Free'), stock: stock() },
      { colorName: '淺藍', colorCode: '#A8C5D8', size: 'Free', sku: sku('KNIT', 2, 'LB', 'Free'), stock: stock() },
      { colorName: '粉杏', colorCode: '#F2D0BB', size: 'Free', sku: sku('KNIT', 2, 'PA', 'Free'), stock: stock() },
    ],
  },
  {
    name: '撞色條紋針織衫',
    slug: 'ckm-contrast-stripe-knit-sweater',
    price: 1280,
    salePrice: 1080,
    categorySlug: 'knit',
    stock: 0,
    status: 'published',
    weight: 280,
    tags: [{ tag: '條紋' }, { tag: '撞色' }, { tag: '針織' }, { tag: '韓系' }, { tag: '秋冬' }],
    variants: [
      { colorName: '黑白撞色', colorCode: '#808080', size: 'Free', sku: sku('KNIT', 3, 'BW', 'Free'), stock: stock() },
      { colorName: '藍白撞色', colorCode: '#7B9DC4', size: 'Free', sku: sku('KNIT', 3, 'BLW', 'Free'), stock: stock() },
    ],
  },
]

// ═══════════════════════════════════════════════════════════
// 長褲 LONG PANTS
// ═══════════════════════════════════════════════════════════
const PANTS_PRODUCTS: ProductDef[] = [
  {
    name: '高腰顯瘦直筒西裝褲',
    slug: 'ckm-high-waist-slim-straight-slacks',
    price: 1480,
    salePrice: 1280,
    categorySlug: 'long-pants',
    stock: 0,
    status: 'published',
    isNew: true,
    isHot: true,
    collectionTags: ['host-style', 'rush'],
    weight: 350,
    tags: [{ tag: '高腰' }, { tag: '顯瘦' }, { tag: '西裝褲' }, { tag: '通勤' }, { tag: '百搭' }],
    variants: [
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'S', sku: sku('PANTS', 1, 'BK', 'S'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'M', sku: sku('PANTS', 1, 'BK', 'M'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'L', sku: sku('PANTS', 1, 'BK', 'L'), stock: stock() },
      { colorName: '奶茶', colorCode: '#C8A882', size: 'S', sku: sku('PANTS', 1, 'MT', 'S'), stock: stock() },
      { colorName: '奶茶', colorCode: '#C8A882', size: 'M', sku: sku('PANTS', 1, 'MT', 'M'), stock: stock() },
    ],
  },
  {
    name: '復古水洗牛仔寬褲',
    slug: 'ckm-vintage-washed-wide-leg-jeans',
    price: 1680,
    categorySlug: 'long-pants',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 420,
    tags: [{ tag: '牛仔' }, { tag: '寬褲' }, { tag: '復古' }, { tag: '韓系' }],
    variants: [
      { colorName: '淺藍水洗', colorCode: '#B5CCDB', size: 'S', sku: sku('PANTS', 2, 'LW', 'S'), stock: stock() },
      { colorName: '淺藍水洗', colorCode: '#B5CCDB', size: 'M', sku: sku('PANTS', 2, 'LW', 'M'), stock: stock() },
      { colorName: '深藍水洗', colorCode: '#4A6B8A', size: 'S', sku: sku('PANTS', 2, 'DW', 'S'), stock: stock() },
      { colorName: '深藍水洗', colorCode: '#4A6B8A', size: 'M', sku: sku('PANTS', 2, 'DW', 'M'), stock: stock() },
    ],
  },
  {
    name: '螞蟻腰修身線條寬管西裝褲',
    slug: 'ckm-ant-waist-wide-leg-suit-pants',
    price: 1580,
    categorySlug: 'long-pants',
    stock: 0,
    status: 'published',
    isHot: true,
    weight: 360,
    tags: [{ tag: '螞蟻腰' }, { tag: '顯瘦' }, { tag: '西裝褲' }, { tag: '百搭' }, { tag: '通勤' }],
    variants: [
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'S', sku: sku('PANTS', 3, 'BK', 'S'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'M', sku: sku('PANTS', 3, 'BK', 'M'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'L', sku: sku('PANTS', 3, 'BK', 'L'), stock: stock() },
      { colorName: '深灰', colorCode: '#555555', size: 'S', sku: sku('PANTS', 3, 'DG', 'S'), stock: stock() },
      { colorName: '深灰', colorCode: '#555555', size: 'M', sku: sku('PANTS', 3, 'DG', 'M'), stock: stock() },
    ],
  },
]

// ═══════════════════════════════════════════════════════════
// 短褲 SHORTS
// ═══════════════════════════════════════════════════════════
const SHORTS_PRODUCTS: ProductDef[] = [
  {
    name: '百搭牛仔短褲',
    slug: 'ckm-versatile-denim-shorts',
    price: 890,
    salePrice: 750,
    categorySlug: 'shorts',
    stock: 0,
    status: 'published',
    isHot: true,
    collectionTags: ['rush'],
    weight: 280,
    tags: [{ tag: '牛仔' }, { tag: '短褲' }, { tag: '百搭' }, { tag: '夏季' }],
    variants: [
      { colorName: '淺藍', colorCode: '#B5CCDB', size: 'S', sku: sku('SHRT', 1, 'LB', 'S'), stock: stock() },
      { colorName: '淺藍', colorCode: '#B5CCDB', size: 'M', sku: sku('SHRT', 1, 'LB', 'M'), stock: stock() },
      { colorName: '深藍', colorCode: '#2C4B6E', size: 'S', sku: sku('SHRT', 1, 'DB', 'S'), stock: stock() },
      { colorName: '深藍', colorCode: '#2C4B6E', size: 'M', sku: sku('SHRT', 1, 'DB', 'M'), stock: stock() },
    ],
  },
  {
    name: '高腰A字西裝短褲',
    slug: 'ckm-high-waist-a-line-suit-shorts',
    price: 990,
    categorySlug: 'shorts',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 240,
    tags: [{ tag: '高腰' }, { tag: '短褲' }, { tag: '西裝' }, { tag: '顯瘦' }, { tag: '通勤' }],
    variants: [
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'S', sku: sku('SHRT', 2, 'BK', 'S'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'M', sku: sku('SHRT', 2, 'BK', 'M'), stock: stock() },
      { colorName: '卡其', colorCode: '#C2A87C', size: 'S', sku: sku('SHRT', 2, 'KH', 'S'), stock: stock() },
      { colorName: '卡其', colorCode: '#C2A87C', size: 'M', sku: sku('SHRT', 2, 'KH', 'M'), stock: stock() },
    ],
  },
]

// ═══════════════════════════════════════════════════════════
// 裙子 SKIRTS
// ═══════════════════════════════════════════════════════════
const SKIRT_PRODUCTS: ProductDef[] = [
  {
    name: '碎花半身長裙',
    slug: 'ckm-floral-midi-maxi-skirt',
    price: 1280,
    salePrice: 1080,
    categorySlug: 'midi-long-skirts',
    stock: 0,
    status: 'published',
    isNew: true,
    collectionTags: ['jin-live'],
    weight: 260,
    tags: [{ tag: '碎花' }, { tag: '長裙' }, { tag: '甜美' }, { tag: '約會穿搭' }, { tag: '度假' }],
    variants: [
      { colorName: '粉底碎花', colorCode: '#F5D5D5', size: 'S', sku: sku('SKRT', 1, 'PF', 'S'), stock: stock() },
      { colorName: '粉底碎花', colorCode: '#F5D5D5', size: 'M', sku: sku('SKRT', 1, 'PF', 'M'), stock: stock() },
      { colorName: '藍底碎花', colorCode: '#B8D4E3', size: 'S', sku: sku('SKRT', 1, 'BF', 'S'), stock: stock() },
      { colorName: '藍底碎花', colorCode: '#B8D4E3', size: 'M', sku: sku('SKRT', 1, 'BF', 'M'), stock: stock() },
    ],
  },
  {
    name: '高腰百褶短裙',
    slug: 'ckm-high-waist-pleated-mini-skirt',
    price: 980,
    categorySlug: 'mini-skirts',
    stock: 0,
    status: 'published',
    isHot: true,
    weight: 200,
    tags: [{ tag: '百褶裙' }, { tag: '短裙' }, { tag: '韓系' }, { tag: '甜美' }],
    variants: [
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'S', sku: sku('SKRT', 2, 'BK', 'S'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'M', sku: sku('SKRT', 2, 'BK', 'M'), stock: stock() },
      { colorName: '格紋奶茶', colorCode: '#C8A882', size: 'S', sku: sku('SKRT', 2, 'CK', 'S'), stock: stock() },
      { colorName: '格紋奶茶', colorCode: '#C8A882', size: 'M', sku: sku('SKRT', 2, 'CK', 'M'), stock: stock() },
    ],
  },
  {
    name: 'A字牛仔中裙',
    slug: 'ckm-a-line-denim-midi-skirt',
    price: 1180,
    salePrice: 980,
    categorySlug: 'midi-long-skirts',
    stock: 0,
    status: 'published',
    isNew: true,
    collectionTags: ['rush'],
    weight: 380,
    tags: [{ tag: 'A字裙' }, { tag: '牛仔' }, { tag: '中裙' }, { tag: '百搭' }, { tag: '顯瘦' }],
    variants: [
      { colorName: '淺藍', colorCode: '#B5CCDB', size: 'S', sku: sku('SKRT', 3, 'LB', 'S'), stock: stock() },
      { colorName: '淺藍', colorCode: '#B5CCDB', size: 'M', sku: sku('SKRT', 3, 'LB', 'M'), stock: stock() },
      { colorName: '深藍', colorCode: '#2C4B6E', size: 'S', sku: sku('SKRT', 3, 'DB', 'S'), stock: stock() },
      { colorName: '深藍', colorCode: '#2C4B6E', size: 'M', sku: sku('SKRT', 3, 'DB', 'M'), stock: stock() },
    ],
  },
  {
    name: '氣質緞面魚尾半身裙',
    slug: 'ckm-satin-mermaid-midi-skirt',
    price: 1680,
    categorySlug: 'midi-long-skirts',
    stock: 0,
    status: 'published',
    isHot: true,
    collectionTags: ['formal-dresses', 'celebrity-style'],
    weight: 300,
    tags: [{ tag: '緞面' }, { tag: '魚尾裙' }, { tag: '氣質' }, { tag: '約會穿搭' }, { tag: '宴會' }],
    variants: [
      { colorName: '香檳金', colorCode: '#C9A96E', size: 'S', sku: sku('SKRT', 4, 'CG', 'S'), stock: stock() },
      { colorName: '香檳金', colorCode: '#C9A96E', size: 'M', sku: sku('SKRT', 4, 'CG', 'M'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'S', sku: sku('SKRT', 4, 'BK', 'S'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'M', sku: sku('SKRT', 4, 'BK', 'M'), stock: stock() },
    ],
  },
]

// ═══════════════════════════════════════════════════════════
// 洋裝 DRESSES
// ═══════════════════════════════════════════════════════════
const DRESS_PRODUCTS: ProductDef[] = [
  {
    name: '法式碎花連衣裙',
    slug: 'ckm-french-floral-wrap-dress',
    price: 1880,
    salePrice: 1580,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    isNew: true,
    isHot: true,
    collectionTags: ['jin-live', 'jin-style'],
    weight: 250,
    tags: [{ tag: '法式' }, { tag: '碎花' }, { tag: '洋裝' }, { tag: '約會穿搭' }, { tag: '甜美' }],
    variants: [
      { colorName: '粉底碎花', colorCode: '#F5D5D5', size: 'S', sku: sku('DRSS', 1, 'PF', 'S'), stock: stock() },
      { colorName: '粉底碎花', colorCode: '#F5D5D5', size: 'M', sku: sku('DRSS', 1, 'PF', 'M'), stock: stock() },
      { colorName: '藍底碎花', colorCode: '#B8D4E3', size: 'S', sku: sku('DRSS', 1, 'BF', 'S'), stock: stock() },
      { colorName: '藍底碎花', colorCode: '#B8D4E3', size: 'M', sku: sku('DRSS', 1, 'BF', 'M'), stock: stock() },
    ],
  },
  {
    name: '韓系氣質魚尾洋裝',
    slug: 'ckm-korean-elegant-mermaid-dress',
    price: 2280,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    isHot: true,
    collectionTags: ['celebrity-style', 'formal-dresses'],
    weight: 310,
    tags: [{ tag: '魚尾裙' }, { tag: '洋裝' }, { tag: '氣質' }, { tag: '宴會' }, { tag: '約會穿搭' }],
    variants: [
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'S', sku: sku('DRSS', 2, 'BK', 'S'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'M', sku: sku('DRSS', 2, 'BK', 'M'), stock: stock() },
      { colorName: '酒紅', colorCode: '#7B2D3E', size: 'S', sku: sku('DRSS', 2, 'WR', 'S'), stock: stock() },
      { colorName: '酒紅', colorCode: '#7B2D3E', size: 'M', sku: sku('DRSS', 2, 'WR', 'M'), stock: stock() },
    ],
  },
  {
    name: '小香風無袖背心洋裝',
    slug: 'ckm-chanel-style-sleeveless-dress',
    price: 2580,
    salePrice: 2180,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    isNew: true,
    collectionTags: ['host-style', 'brand-custom'],
    weight: 280,
    tags: [{ tag: '小香風' }, { tag: '無袖' }, { tag: '洋裝' }, { tag: '名媛' }, { tag: '通勤' }],
    variants: [
      { colorName: '香草奶白', colorCode: '#F7F2E3', size: 'S', sku: sku('DRSS', 3, 'VW', 'S'), stock: stock() },
      { colorName: '香草奶白', colorCode: '#F7F2E3', size: 'M', sku: sku('DRSS', 3, 'VW', 'M'), stock: stock() },
      { colorName: '玫瑰粉', colorCode: '#E8A0A0', size: 'S', sku: sku('DRSS', 3, 'RP', 'S'), stock: stock() },
      { colorName: '玫瑰粉', colorCode: '#E8A0A0', size: 'M', sku: sku('DRSS', 3, 'RP', 'M'), stock: stock() },
    ],
  },
  {
    name: '度假風吊帶長洋裝',
    slug: 'ckm-resort-style-maxi-cami-dress',
    price: 1680,
    salePrice: 1380,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 230,
    tags: [{ tag: '吊帶' }, { tag: '長洋裝' }, { tag: '度假' }, { tag: '夏季' }, { tag: '甜美' }],
    variants: [
      { colorName: '白色', colorCode: '#FFFFFF', size: 'S', sku: sku('DRSS', 4, 'WH', 'S'), stock: stock() },
      { colorName: '白色', colorCode: '#FFFFFF', size: 'M', sku: sku('DRSS', 4, 'WH', 'M'), stock: stock() },
      { colorName: '淡黃', colorCode: '#F5E6A3', size: 'S', sku: sku('DRSS', 4, 'LY', 'S'), stock: stock() },
      { colorName: '淡黃', colorCode: '#F5E6A3', size: 'M', sku: sku('DRSS', 4, 'LY', 'M'), stock: stock() },
    ],
  },
  {
    name: '收腰雙排釦氣質洋裝',
    slug: 'ckm-waist-double-breasted-elegant-dress',
    price: 2180,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    isHot: true,
    collectionTags: ['jin-live'],
    weight: 290,
    tags: [{ tag: '雙排釦' }, { tag: '洋裝' }, { tag: '氣質' }, { tag: '顯瘦' }, { tag: '通勤' }],
    variants: [
      { colorName: '卡其', colorCode: '#C2A87C', size: 'S', sku: sku('DRSS', 5, 'KH', 'S'), stock: stock() },
      { colorName: '卡其', colorCode: '#C2A87C', size: 'M', sku: sku('DRSS', 5, 'KH', 'M'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'S', sku: sku('DRSS', 5, 'BK', 'S'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'M', sku: sku('DRSS', 5, 'BK', 'M'), stock: stock() },
    ],
  },
]

// ═══════════════════════════════════════════════════════════
// 套裝 SETS
// ═══════════════════════════════════════════════════════════
const SET_PRODUCTS: ProductDef[] = [
  {
    name: '職場西裝套裝（外套+褲）',
    slug: 'ckm-office-blazer-pants-set',
    price: 3280,
    salePrice: 2880,
    categorySlug: 'formal-sets',
    stock: 0,
    status: 'published',
    isNew: true,
    isHot: true,
    collectionTags: ['host-style', 'brand-custom'],
    weight: 680,
    tags: [{ tag: '套裝' }, { tag: '西裝' }, { tag: '職場' }, { tag: '通勤' }, { tag: '百搭' }],
    variants: [
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'S', sku: sku('SET', 1, 'BK', 'S'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'M', sku: sku('SET', 1, 'BK', 'M'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'L', sku: sku('SET', 1, 'BK', 'L'), stock: stock() },
      { colorName: '深灰', colorCode: '#555555', size: 'S', sku: sku('SET', 1, 'DG', 'S'), stock: stock() },
      { colorName: '深灰', colorCode: '#555555', size: 'M', sku: sku('SET', 1, 'DG', 'M'), stock: stock() },
    ],
  },
  {
    name: '休閒棉麻套裝（上衣+褲）',
    slug: 'ckm-casual-linen-top-pants-set',
    price: 2180,
    categorySlug: 'casual-sets',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 480,
    tags: [{ tag: '棉麻' }, { tag: '套裝' }, { tag: '休閒' }, { tag: '度假' }, { tag: '百搭' }],
    variants: [
      { colorName: '米白', colorCode: '#F5F0E8', size: 'S', sku: sku('SET', 2, 'MW', 'S'), stock: stock() },
      { colorName: '米白', colorCode: '#F5F0E8', size: 'M', sku: sku('SET', 2, 'MW', 'M'), stock: stock() },
      { colorName: '淡橄欖', colorCode: '#B5B87D', size: 'S', sku: sku('SET', 2, 'OL', 'S'), stock: stock() },
      { colorName: '淡橄欖', colorCode: '#B5B87D', size: 'M', sku: sku('SET', 2, 'OL', 'M'), stock: stock() },
    ],
  },
  {
    name: '撞色針織上衣+短裙套裝',
    slug: 'ckm-contrast-knit-top-skirt-set',
    price: 2580,
    salePrice: 2180,
    categorySlug: 'casual-sets',
    stock: 0,
    status: 'published',
    isHot: true,
    collectionTags: ['jin-style'],
    weight: 420,
    tags: [{ tag: '套裝' }, { tag: '針織' }, { tag: '撞色' }, { tag: '韓系' }, { tag: '約會穿搭' }],
    variants: [
      { colorName: '白+黑', colorCode: '#D0D0D0', size: 'S', sku: sku('SET', 3, 'WB', 'S'), stock: stock() },
      { colorName: '白+黑', colorCode: '#D0D0D0', size: 'M', sku: sku('SET', 3, 'WB', 'M'), stock: stock() },
      { colorName: '粉+白', colorCode: '#F5D5D5', size: 'S', sku: sku('SET', 3, 'PW', 'S'), stock: stock() },
      { colorName: '粉+白', colorCode: '#F5D5D5', size: 'M', sku: sku('SET', 3, 'PW', 'M'), stock: stock() },
    ],
  },
]

// ═══════════════════════════════════════════════════════════
// 泳裝 SWIMWEAR
// ═══════════════════════════════════════════════════════════
const SWIMWEAR_PRODUCTS: ProductDef[] = [
  {
    name: '韓系碎花比基尼三件組',
    slug: 'ckm-korean-floral-bikini-3pcs-set',
    price: 1580,
    salePrice: 1280,
    categorySlug: 'swimwear',
    stock: 0,
    status: 'published',
    isNew: true,
    isHot: true,
    weight: 180,
    tags: [{ tag: '比基尼' }, { tag: '碎花' }, { tag: '泳裝' }, { tag: '度假' }, { tag: '韓系' }],
    variants: [
      { colorName: '藍底碎花', colorCode: '#B8D4E3', size: 'S', sku: sku('SWIM', 1, 'BF', 'S'), stock: stock() },
      { colorName: '藍底碎花', colorCode: '#B8D4E3', size: 'M', sku: sku('SWIM', 1, 'BF', 'M'), stock: stock() },
      { colorName: '粉底碎花', colorCode: '#F5D5D5', size: 'S', sku: sku('SWIM', 1, 'PF', 'S'), stock: stock() },
      { colorName: '粉底碎花', colorCode: '#F5D5D5', size: 'M', sku: sku('SWIM', 1, 'PF', 'M'), stock: stock() },
    ],
  },
  {
    name: '連身挖腰泳裝',
    slug: 'ckm-cutout-one-piece-swimsuit',
    price: 1280,
    categorySlug: 'swimwear',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 160,
    tags: [{ tag: '連身泳裝' }, { tag: '挖腰' }, { tag: '顯瘦' }, { tag: '度假' }],
    variants: [
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'S', sku: sku('SWIM', 2, 'BK', 'S'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'M', sku: sku('SWIM', 2, 'BK', 'M'), stock: stock() },
      { colorName: '酒紅', colorCode: '#7B2D3E', size: 'S', sku: sku('SWIM', 2, 'WR', 'S'), stock: stock() },
      { colorName: '酒紅', colorCode: '#7B2D3E', size: 'M', sku: sku('SWIM', 2, 'WR', 'M'), stock: stock() },
    ],
  },
]

// ═══════════════════════════════════════════════════════════
// 配件 ACCESSORIES
// ═══════════════════════════════════════════════════════════
const ACCESSORY_PRODUCTS: ProductDef[] = [
  {
    name: '韓系編織托特包',
    slug: 'ckm-korean-woven-tote-bag',
    price: 1280,
    salePrice: 980,
    categorySlug: 'bags',
    stock: 0,
    status: 'published',
    isNew: true,
    isHot: true,
    collectionTags: ['jin-style', 'rush'],
    weight: 380,
    tags: [{ tag: '托特包' }, { tag: '編織' }, { tag: '韓系' }, { tag: '百搭' }],
    variants: [
      { colorName: '原色米白', colorCode: '#F5F0E8', size: 'Free', sku: sku('ACC', 1, 'NW', 'Free'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'Free', sku: sku('ACC', 1, 'BK', 'Free'), stock: stock() },
      { colorName: '焦糖棕', colorCode: '#A0522D', size: 'Free', sku: sku('ACC', 1, 'CB', 'Free'), stock: stock() },
    ],
  },
  {
    name: '復古金屬框太陽眼鏡',
    slug: 'ckm-vintage-metal-frame-sunglasses',
    price: 780,
    salePrice: 680,
    categorySlug: 'glasses',
    stock: 0,
    status: 'published',
    isHot: true,
    collectionTags: ['rush'],
    weight: 40,
    tags: [{ tag: '太陽眼鏡' }, { tag: '復古' }, { tag: '金屬框' }, { tag: '韓系' }, { tag: '百搭' }],
    variants: [
      { colorName: '金框茶色鏡', colorCode: '#C9A96E', size: 'Free', sku: sku('ACC', 2, 'GT', 'Free'), stock: stock() },
      { colorName: '銀框灰色鏡', colorCode: '#C0C0C0', size: 'Free', sku: sku('ACC', 2, 'SG', 'Free'), stock: stock() },
      { colorName: '黑框黑色鏡', colorCode: '#1A1A1A', size: 'Free', sku: sku('ACC', 2, 'BB', 'Free'), stock: stock() },
    ],
  },
  {
    name: '珍珠髮夾組（3入）',
    slug: 'ckm-pearl-hair-clips-set-3pcs',
    price: 390,
    categorySlug: 'hair-accessories',
    stock: 0,
    status: 'published',
    isNew: true,
    isHot: true,
    collectionTags: ['rush'],
    weight: 30,
    tags: [{ tag: '珍珠' }, { tag: '髮夾' }, { tag: '甜美' }, { tag: '百搭' }],
    variants: [
      { colorName: '米白珍珠', colorCode: '#F5F0E8', size: 'Free', sku: sku('ACC', 3, 'WP', 'Free'), stock: stock() },
      { colorName: '粉色珍珠', colorCode: '#F5D5D5', size: 'Free', sku: sku('ACC', 3, 'PP', 'Free'), stock: stock() },
    ],
  },
  {
    name: '韓系菱格紋鏈條包',
    slug: 'ckm-quilted-chain-crossbody-bag',
    price: 1580,
    salePrice: 1380,
    categorySlug: 'bags',
    stock: 0,
    status: 'published',
    isNew: true,
    collectionTags: ['jin-live', 'celebrity-style'],
    weight: 320,
    tags: [{ tag: '鏈條包' }, { tag: '菱格' }, { tag: '韓系' }, { tag: '約會穿搭' }],
    variants: [
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'Free', sku: sku('ACC', 4, 'BK', 'Free'), stock: stock() },
      { colorName: '奶茶粉', colorCode: '#E8C5A0', size: 'Free', sku: sku('ACC', 4, 'MP', 'Free'), stock: stock() },
    ],
  },
]

// ═══════════════════════════════════════════════════════════
// 飾品 JEWELRY
// ═══════════════════════════════════════════════════════════
const JEWELRY_PRODUCTS: ProductDef[] = [
  {
    name: '925純銀蝴蝶結耳環',
    slug: 'ckm-925-silver-bow-earrings',
    price: 690,
    categorySlug: 'earrings',
    stock: 0,
    status: 'published',
    isNew: true,
    isHot: true,
    collectionTags: ['brand-custom'],
    weight: 15,
    tags: [{ tag: '925純銀' }, { tag: '耳環' }, { tag: '蝴蝶結' }, { tag: '甜美' }, { tag: '百搭' }],
    variants: [
      { colorName: '銀色', colorCode: '#C0C0C0', size: 'Free', sku: sku('JWLR', 1, 'SL', 'Free'), stock: stock() },
      { colorName: '玫瑰金', colorCode: '#B76E79', size: 'Free', sku: sku('JWLR', 1, 'RG', 'Free'), stock: stock() },
    ],
  },
  {
    name: '氣質鋯石鎖骨項鍊',
    slug: 'ckm-zircon-collarbone-necklace',
    price: 580,
    salePrice: 490,
    categorySlug: 'necklaces',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 12,
    tags: [{ tag: '鋯石' }, { tag: '項鍊' }, { tag: '氣質' }, { tag: '百搭' }, { tag: '約會穿搭' }],
    variants: [
      { colorName: '金色', colorCode: '#C9A96E', size: 'Free', sku: sku('JWLR', 2, 'GL', 'Free'), stock: stock() },
      { colorName: '銀色', colorCode: '#C0C0C0', size: 'Free', sku: sku('JWLR', 2, 'SL', 'Free'), stock: stock() },
    ],
  },
  {
    name: '簡約開口戒指',
    slug: 'ckm-minimalist-open-ring',
    price: 390,
    categorySlug: 'rings',
    stock: 0,
    status: 'published',
    isHot: true,
    collectionTags: ['rush'],
    weight: 8,
    tags: [{ tag: '戒指' }, { tag: '開口戒' }, { tag: '簡約' }, { tag: '百搭' }],
    variants: [
      { colorName: '金色', colorCode: '#C9A96E', size: 'Free', sku: sku('JWLR', 3, 'GL', 'Free'), stock: stock() },
      { colorName: '銀色', colorCode: '#C0C0C0', size: 'Free', sku: sku('JWLR', 3, 'SL', 'Free'), stock: stock() },
      { colorName: '玫瑰金', colorCode: '#B76E79', size: 'Free', sku: sku('JWLR', 3, 'RG', 'Free'), stock: stock() },
    ],
  },
  {
    name: '星月造型不對稱耳環',
    slug: 'ckm-star-moon-asymmetric-earrings',
    price: 490,
    categorySlug: 'earrings',
    stock: 0,
    status: 'published',
    isNew: true,
    weight: 10,
    tags: [{ tag: '耳環' }, { tag: '星月' }, { tag: '不對稱' }, { tag: '韓系' }],
    variants: [
      { colorName: '金色', colorCode: '#C9A96E', size: 'Free', sku: sku('JWLR', 4, 'GL', 'Free'), stock: stock() },
      { colorName: '銀色', colorCode: '#C0C0C0', size: 'Free', sku: sku('JWLR', 4, 'SL', 'Free'), stock: stock() },
    ],
  },
  {
    name: '珍珠疊戴手鍊組（2入）',
    slug: 'ckm-pearl-layered-bracelet-set',
    price: 580,
    salePrice: 490,
    categorySlug: 'bracelets',
    stock: 0,
    status: 'published',
    weight: 18,
    tags: [{ tag: '珍珠' }, { tag: '手鍊' }, { tag: '疊戴' }, { tag: '甜美' }, { tag: '百搭' }],
    variants: [
      { colorName: '白珍珠+金鍊', colorCode: '#F5F0E8', size: 'Free', sku: sku('JWLR', 5, 'WG', 'Free'), stock: stock() },
      { colorName: '白珍珠+銀鍊', colorCode: '#FFFFFF', size: 'Free', sku: sku('JWLR', 5, 'WS', 'Free'), stock: stock() },
    ],
  },
]

// ═══════════════════════════════════════════════════════════
// 韓劇同款 K-DRAMA
// ═══════════════════════════════════════════════════════════
const KDRAMA_PRODUCTS: ProductDef[] = [
  {
    name: '上流戰爭千乇同款西裝外套',
    slug: 'ckm-penthouse-cheonye-blazer',
    price: 3280,
    salePrice: 2880,
    categorySlug: 'k-drama-penthouse',
    stock: 0,
    status: 'published',
    isNew: true,
    isHot: true,
    collectionTags: ['celebrity-style'],
    weight: 400,
    allowPreOrder: true,
    tags: [{ tag: '韓劇同款' }, { tag: '上流戰爭' }, { tag: '西裝外套' }, { tag: '名媛' }, { tag: '氣質' }],
    sourcing: { supplierName: 'Drama Style Korea', costKRW: 85000 },
    variants: [
      { colorName: '米白', colorCode: '#F5F0E8', size: 'S', sku: sku('KDRA', 1, 'MW', 'S'), stock: stock() },
      { colorName: '米白', colorCode: '#F5F0E8', size: 'M', sku: sku('KDRA', 1, 'MW', 'M'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'S', sku: sku('KDRA', 1, 'BK', 'S'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'M', sku: sku('KDRA', 1, 'BK', 'M'), stock: stock() },
    ],
  },
  {
    name: '愛的迫降尹世理同款大衣',
    slug: 'ckm-crash-landing-yoon-seri-coat',
    price: 3990,
    categorySlug: 'k-drama-crash-landing',
    stock: 0,
    status: 'published',
    isHot: true,
    collectionTags: ['celebrity-style'],
    weight: 680,
    allowPreOrder: true,
    tags: [{ tag: '韓劇同款' }, { tag: '愛的迫降' }, { tag: '大衣' }, { tag: '氣質' }, { tag: '顯瘦' }],
    sourcing: { supplierName: 'K-Drama Closet', costKRW: 105000 },
    variants: [
      { colorName: '駝色', colorCode: '#C19A6B', size: 'S', sku: sku('KDRA', 2, 'CM', 'S'), stock: stock() },
      { colorName: '駝色', colorCode: '#C19A6B', size: 'M', sku: sku('KDRA', 2, 'CM', 'M'), stock: stock() },
      { colorName: '米白', colorCode: '#F5F0E8', size: 'S', sku: sku('KDRA', 2, 'MW', 'S'), stock: stock() },
      { colorName: '米白', colorCode: '#F5F0E8', size: 'M', sku: sku('KDRA', 2, 'MW', 'M'), stock: stock() },
    ],
  },
  {
    name: '夫妻的世界金希愛同款針織洋裝',
    slug: 'ckm-world-of-married-kim-heaee-knit-dress',
    price: 2380,
    salePrice: 1980,
    categorySlug: 'dresses',
    stock: 0,
    status: 'published',
    isNew: true,
    collectionTags: ['celebrity-style'],
    weight: 300,
    tags: [{ tag: '韓劇同款' }, { tag: '夫妻的世界' }, { tag: '針織洋裝' }, { tag: '氣質' }],
    sourcing: { supplierName: 'Drama Style Korea', costKRW: 62000 },
    variants: [
      { colorName: '深海藍', colorCode: '#1C2D4B', size: 'S', sku: sku('KDRA', 3, 'DB', 'S'), stock: stock() },
      { colorName: '深海藍', colorCode: '#1C2D4B', size: 'M', sku: sku('KDRA', 3, 'DB', 'M'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'S', sku: sku('KDRA', 3, 'BK', 'S'), stock: stock() },
      { colorName: '黑色', colorCode: '#1A1A1A', size: 'M', sku: sku('KDRA', 3, 'BK', 'M'), stock: stock() },
    ],
  },
]

// ── 合併全部商品 ──
const ALL_SEED_PRODUCTS: ProductDef[] = [
  ...OUTER_PRODUCTS,
  ...TOP_PRODUCTS,
  ...KNIT_PRODUCTS,
  ...PANTS_PRODUCTS,
  ...SHORTS_PRODUCTS,
  ...SKIRT_PRODUCTS,
  ...DRESS_PRODUCTS,
  ...SET_PRODUCTS,
  ...SWIMWEAR_PRODUCTS,
  ...ACCESSORY_PRODUCTS,
  ...JEWELRY_PRODUCTS,
  ...KDRAMA_PRODUCTS,
]

// ── 主要 Seed 函式 ──

export async function seedProducts(): Promise<void> {
  console.log('\n[商品 Seed] 開始植入 CHIC KIM & MIU 樣本商品...\n')

  const payload = await getPayload({ config })

  // ── 步驟 1：先執行分類 Seed ──
  console.log('[步驟 1/2] 執行分類 Seed...')
  await seedCategories()

  // 重新查詢所有分類，建立 slug → id 對照表
  console.log('\n[步驟 1/2] 讀取分類對照表...')
  const categoryMap: Record<string, string | number> = {}

  const allCats = await payload.find({
    collection: 'categories',
    limit: 200,
  })

  for (const cat of allCats.docs) {
    categoryMap[cat.slug as string] = cat.id
  }

  console.log(`[步驟 1/2] 已載入 ${Object.keys(categoryMap).length} 個分類`)

  // ── 步驟 2：植入商品 ──
  console.log(`\n[步驟 2/2] 植入 ${ALL_SEED_PRODUCTS.length} 件樣本商品...`)

  let created = 0
  let skipped = 0
  let failed = 0

  for (const product of ALL_SEED_PRODUCTS) {
    try {
      // 確認分類 ID
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

      // 計算總庫存
      const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0)

      // 建立商品資料
      const data: Record<string, unknown> = {
        name: product.name,
        slug: product.slug,
        price: product.price,
        category: categoryId,
        stock: totalStock,
        status: product.status,
        isNew: product.isNew ?? false,
        isHot: product.isHot ?? false,
        weight: product.weight,
        allowPreOrder: product.allowPreOrder ?? false,
        variants: product.variants,
        tags: product.tags,
      }

      if (product.salePrice !== undefined) {
        data.salePrice = product.salePrice
      }

      if (product.collectionTags && product.collectionTags.length > 0) {
        data.collectionTags = product.collectionTags
      }

      if (product.sourcing) {
        data.sourcing = product.sourcing
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

  // ── 完成摘要 ──
  console.log('\n════════════════════════════════════')
  console.log('商品 Seed 完成！')
  console.log(`  新建：${created} 件`)
  console.log(`  跳過（已存在）：${skipped} 件`)
  if (failed > 0) console.log(`  失敗：${failed} 件`)
  console.log(`  總計嘗試：${ALL_SEED_PRODUCTS.length} 件`)
  console.log('════════════════════════════════════\n')
}

// ── 自執行主程式入口 ──
// 使用方式：npx tsx src/seed/seedProducts.ts

const isMain =
  process.argv[1]?.endsWith('seedProducts.ts') || process.argv[1]?.endsWith('seedProducts.js')

if (isMain) {
  seedProducts()
    .then(() => {
      process.exit(0)
    })
    .catch((err) => {
      console.error('商品 Seed 失敗：', err)
      process.exit(1)
    })
}
