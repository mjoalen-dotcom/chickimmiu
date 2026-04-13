/**
 * CHIC KIM & MIU — 真實商品 Seed 資料
 * 從 www.chickimmiu.com 取得的完整商品資訊
 * 使用方式：在後台或 CLI 執行 seed 匯入
 *
 * 圖片 CDN：https://shoplineimg.com/559df3efe37ec64e9f000092/{imageId}/{resolution}x.{ext}
 * 解析度可選：400x（縮圖）、1500x（中）、2000x（大圖）
 */

export interface SeedProduct {
  name: string
  slug: string
  price: number
  salePrice?: number
  category: string
  sizes: string[]
  colors: number
  imageId: string
  imageExt: string
  isNew?: boolean
  isHot?: boolean
  description?: string
}

const IMG_BASE = 'https://shoplineimg.com/559df3efe37ec64e9f000092'

export function getImageUrl(imageId: string, ext = 'png', resolution = '1500x') {
  return `${IMG_BASE}/${imageId}/${resolution}.webp?source_format=${ext}`
}

// ═══════════════════════════════════════════════════════════
// 🏷 洋裝 DRESSES
// ═══════════════════════════════════════════════════════════
export const DRESSES: SeedProduct[] = [
  {
    name: '拼接絲緞蝴蝶結洋裝 Dream Silk Ribbon Dress',
    slug: 'dream-silk-ribbon-dress',
    price: 2680,
    salePrice: 2480,
    category: 'dress',
    sizes: ['S', 'M'],
    colors: 2,
    imageId: '69d3d8324c5226e1bcda99eb',
    imageExt: 'png',
    isNew: true,
  },
  {
    name: '小香珍珠洋裝 Estelle Pearl Dress',
    slug: 'estelle-pearl-dress',
    price: 3680,
    salePrice: 3380,
    category: 'dress',
    sizes: ['S', 'M'],
    colors: 2,
    imageId: '69d3d83b4ef225a55ea202e5',
    imageExt: 'png',
    isNew: true,
  },
  {
    name: '修身提腰氣質洋裝 Colette Waistline Lifting Dress',
    slug: 'colette-waistline-lifting-dress',
    price: 3080,
    salePrice: 2880,
    category: 'dress',
    sizes: ['S', 'M'],
    colors: 2,
    imageId: '69d3d850293e6404cf30e5ce',
    imageExt: 'png',
    isNew: true,
  },
  {
    name: '優雅疊紗包釦洋裝 Amelia Elegant Lace-Lined Dress',
    slug: 'amelia-elegant-tulle-button-dress',
    price: 2780,
    salePrice: 2580,
    category: 'dress',
    sizes: ['S', 'M', 'L'],
    colors: 2,
    imageId: '69ca4f60043ccd59ea96d5db',
    imageExt: 'png',
  },
  {
    name: '氣質收腰雙排釦洋裝 Yuna Double-Breasted Dress',
    slug: 'yuna-double-breasted-dress',
    price: 3180,
    salePrice: 2880,
    category: 'dress',
    sizes: ['S', 'M'],
    colors: 2,
    imageId: '69ca51927d644d009eac3783',
    imageExt: 'png',
  },
  {
    name: '名媛風粗花呢洋裝 Penelope Tweed Mini Dress',
    slug: 'penelope-contrast-tweed-mini-dress',
    price: 2980,
    category: 'dress',
    sizes: ['S', 'M'],
    colors: 2,
    imageId: '69aeccd4162aa337a2d43094',
    imageExt: 'jpg',
  },
  {
    name: '優雅V領珍珠花釦洋裝 Olivia Pearl Button Dress',
    slug: 'olivia-v-neck-pearl-button-dress',
    price: 2980,
    category: 'dress',
    sizes: ['S', 'M', 'L'],
    colors: 2,
    imageId: '69aed02b2783b88d61513c16',
    imageExt: 'png',
  },
  {
    name: '名媛造型珠釦領包臀洋裝 Opaline Bodycon Dress',
    slug: 'opaline-pearl-button-bodycon-dress',
    price: 3380,
    category: 'dress',
    sizes: ['S', 'M', 'L'],
    colors: 2,
    imageId: '696e2cfadcea474f126c48fd',
    imageExt: 'png',
    isHot: true,
  },
  {
    name: 'Serene 名媛蕾絲層次洋裝',
    slug: 'serene-elegant-lace-layered-dress',
    price: 2980,
    category: 'dress',
    sizes: ['S', 'M'],
    colors: 2,
    imageId: '69c140b9f04a564933f21f59',
    imageExt: 'png',
    isNew: true,
    isHot: true,
  },
  {
    name: 'Quincy 氣質裹身微開衩洋裝',
    slug: 'quincy-elegant-wrap-slit-dress',
    price: 2980,
    salePrice: 2680,
    category: 'dress',
    sizes: ['S', 'M'],
    colors: 2,
    imageId: '69b8e8ecf7cad647346583b3',
    imageExt: 'png',
    isHot: true,
  },
]

// ═══════════════════════════════════════════════════════════
// 🏷 上衣 / 襯衫 TOPS & BLOUSES
// ═══════════════════════════════════════════════════════════
export const TOPS: SeedProduct[] = [
  {
    name: '都會金釦翻領襯衫 Bertha Urban Gold Button Shirt',
    slug: 'bertha-urban-gold-button-shirt',
    price: 1180,
    salePrice: 1080,
    category: 'top',
    sizes: ['Free'],
    colors: 4,
    imageId: '69d3e0b795013e15481a46c5',
    imageExt: 'png',
    isNew: true,
  },
  {
    name: '天絲流光垂墜襯衫 Aria Tencel Shining Blouse',
    slug: 'aria-tencel-shining-blouse',
    price: 1580,
    salePrice: 1480,
    category: 'top',
    sizes: ['Free'],
    colors: 3,
    imageId: '69d3e0c44c5226e1bcda9a5e',
    imageExt: 'png',
    isNew: true,
  },
  {
    name: '氣質方領雪紡上衣 Willow Square Neck Chiffon Blouse',
    slug: 'willow-square-neck-chiffon-blouse',
    price: 1280,
    salePrice: 1180,
    category: 'top',
    sizes: ['Free'],
    colors: 3,
    imageId: '69ca533f5984db6c457ee57d',
    imageExt: 'jpg',
  },
  {
    name: '名媛風珍珠釦上衣 Irene Pearl Button Blouse',
    slug: 'irene-pearl-button-blouse',
    price: 1380,
    salePrice: 1280,
    category: 'top',
    sizes: ['Free'],
    colors: 3,
    imageId: '69ca53a3584149d3b5f646f9',
    imageExt: 'png',
    isHot: true,
  },
  {
    name: '假兩件雪紡針織襯衫 Sierra Two-in-One Blouse',
    slug: 'sierra-two-in-one-chiffon-knit-blouse',
    price: 1680,
    category: 'top',
    sizes: ['Free'],
    colors: 2,
    imageId: '69c146e7cf9ab231afb2541d',
    imageExt: 'png',
  },
  {
    name: '法式翻領針織上衣 Lesley French Collar Knit Polo',
    slug: 'lesley-french-collar-knit-polo',
    price: 1980,
    category: 'top',
    sizes: ['Free'],
    colors: 3,
    imageId: '69ae982fb78f7e9f60c5f2d4',
    imageExt: 'png',
  },
  {
    name: '羊駝毛柔霧針織 Minni Alpaca Blend Soft Knit',
    slug: 'minni-alpaca-blend-soft-knit',
    price: 1880,
    category: 'top',
    sizes: ['Free'],
    colors: 4,
    imageId: '69b7c90fff4aed9170f7ab3f',
    imageExt: 'png',
  },
]

// ═══════════════════════════════════════════════════════════
// 🏷 褲子 PANTS
// ═══════════════════════════════════════════════════════════
export const PANTS: SeedProduct[] = [
  {
    name: '螞蟻腰都會修身直筒褲',
    slug: 'ant-waist-urban-straight-pants',
    price: 1480,
    category: 'pants',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: 3,
    imageId: '69c1521fa96d6491182ab509',
    imageExt: 'png',
    isNew: true,
    isHot: true,
  },
  {
    name: '螞蟻腰修身線條寬管西裝褲 Ant-Waist Wide-Leg Slacks',
    slug: 'ant-waist-sculpting-wide-leg-slacks',
    price: 1580,
    category: 'pants',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: 3,
    imageId: '69c14f3531bca7a037d363d1',
    imageExt: 'png',
    isHot: true,
  },
  {
    name: '顯瘦直筒牛仔褲 Xenia Slim Straight-Leg Jeans',
    slug: 'xenia-slim-straight-leg-jeans',
    price: 2480,
    category: 'pants',
    sizes: ['S', 'M'],
    colors: 1,
    imageId: '69b7c7a9022cd8561d73898c',
    imageExt: 'png',
  },
  {
    name: '淺洗直筒牛仔褲 Trinity Light Wash Jeans',
    slug: 'trinity-light-wash-straight-jeans',
    price: 2580,
    category: 'pants',
    sizes: ['S', 'M'],
    colors: 1,
    imageId: '69ae9688e20bb08c2dc5e5fd',
    imageExt: 'png',
  },
]

// ═══════════════════════════════════════════════════════════
// 🏷 外套 OUTERWEAR
// ═══════════════════════════════════════════════════════════
export const OUTERWEAR: SeedProduct[] = [
  {
    name: '精緻短版西裝外套 Myrca Fine Cropped Blazer',
    slug: 'myrca-fine-cropped-blazer',
    price: 2480,
    salePrice: 2280,
    category: 'outer',
    sizes: ['Free'],
    colors: 3,
    imageId: '69d3d8d557f177d12573967d',
    imageExt: 'png',
    isNew: true,
  },
  {
    name: '都會氣質風衣外套 Lydia Urban Trench Coat',
    slug: 'lydia-urban-trench-coat',
    price: 4080,
    category: 'outer',
    sizes: ['Free'],
    colors: 2,
    imageId: '69b804f4bc5c054961ffc715',
    imageExt: 'png',
  },
  {
    name: '簡約翻領短版夾克 Karly Minimal Cropped Jacket',
    slug: 'karly-minimal-cropped-collar-jacket',
    price: 4180,
    category: 'outer',
    sizes: ['Free'],
    colors: 3,
    imageId: '69ae9794aaffcdcea8668357',
    imageExt: 'png',
  },
  {
    name: '率性立領風衣夾克 Ingrid Stand Collar Trench Jacket',
    slug: 'ingrid-chic-stand-collar-trench-jacket',
    price: 4480,
    category: 'outer',
    sizes: ['Free'],
    colors: 3,
    imageId: '69ae9699f67d2fbe5027b432',
    imageExt: 'png',
  },
  {
    name: '喀什米爾簡約短版罩衫 Hani Cashmere Cardigan',
    slug: 'hani-cashmere-cropped-cardigan',
    price: 2280,
    category: 'outer',
    sizes: ['Free'],
    colors: 3,
    imageId: '69ae9683c065326eac0e7d1e',
    imageExt: 'png',
  },
  {
    name: '高端經典寬肩西裝外套 Raphaela Oversized Blazer',
    slug: 'raphaela-oversized-shoulder-blazer',
    price: 4780,
    category: 'outer',
    sizes: ['Free'],
    colors: 2,
    imageId: '68e3910fdd4ad6000c068321',
    imageExt: 'png',
  },
]

// ═══════════════════════════════════════════════════════════
// 🏷 裙子 SKIRTS
// ═══════════════════════════════════════════════════════════
export const SKIRTS: SeedProduct[] = [
  {
    name: '氣質緞面魚尾裙 Elena Satin Mermaid Skirt',
    slug: 'elena-satin-mermaid-skirt',
    price: 2480,
    category: 'skirt',
    sizes: ['S', 'M'],
    colors: 2,
    imageId: '69b7c7e85f01ccedd1437eaa',
    imageExt: 'png',
  },
  {
    name: '高腰收腹傘裙 Ginny High-Waisted A-Line Skirt',
    slug: 'ginny-high-waisted-a-line-skirt',
    price: 3380,
    category: 'skirt',
    sizes: ['S', 'M'],
    colors: 2,
    imageId: '69c1063d31f868a179663a58',
    imageExt: 'png',
  },
]

// ═══════════════════════════════════════════════════════════
// 🏷 套裝 SETS
// ═══════════════════════════════════════════════════════════
export const SETS: SeedProduct[] = [
  {
    name: '優雅高腰寬褲西裝套裝 Miriam Elegant Suit Set',
    slug: 'miriam-elegant-suit-set',
    price: 4780,
    salePrice: 4280,
    category: 'set',
    sizes: ['S', 'M', 'L'],
    colors: 2,
    imageId: '69ca5266dd7f90b1732e8a5d',
    imageExt: 'png',
    isHot: true,
  },
]

// ═══════════════════════════════════════════════════════════
// 🏷 配件 ACCESSORIES
// ═══════════════════════════════════════════════════════════
export const ACCESSORIES: SeedProduct[] = [
  {
    name: 'Y2K個性橢圓墨鏡',
    slug: 'y2k-oval-sunglasses',
    price: 780,
    category: 'accessories',
    sizes: ['Free'],
    colors: 5,
    imageId: '69bd18487d7f9fb65f0f78b4',
    imageExt: 'png',
    isNew: true,
  },
  {
    name: '時髦多色橢圓墨鏡',
    slug: 'trendy-multicolor-oval-sunglasses',
    price: 980,
    salePrice: 780,
    category: 'accessories',
    sizes: ['Free'],
    colors: 5,
    imageId: '69aeddfa41bba89465778780',
    imageExt: 'png',
    isHot: true,
  },
  {
    name: '復古風橢圓造型眼鏡 Retro Oval Frame Glasses',
    slug: 'retro-oval-frame-glasses',
    price: 780,
    salePrice: 680,
    category: 'accessories',
    sizes: ['Free'],
    colors: 5,
    imageId: '69ca47fb9253ac5f950cdc99',
    imageExt: 'png',
  },
  {
    name: '古著風洞石項鏈 Vintage Stone Necklace',
    slug: 'vintage-stone-necklace',
    price: 580,
    category: 'accessories',
    sizes: ['Free'],
    colors: 3,
    imageId: '69c1070caaf4c85cd754a0da',
    imageExt: 'png',
  },
  {
    name: '粗獷鏡面開口戒 Bold Polished Open Ring',
    slug: 'bold-polished-open-ring',
    price: 480,
    category: 'accessories',
    sizes: ['Free'],
    colors: 1,
    imageId: '69b80435883bd693aa0220bd',
    imageExt: 'jpg',
  },
  {
    name: '雙水滴Y字長項鏈 Double Drops Y-Shape Necklace',
    slug: 'double-drops-y-shape-necklace',
    price: 580,
    category: 'accessories',
    sizes: ['Free'],
    colors: 1,
    imageId: '69b8031ca6cf95b699f24c96',
    imageExt: 'png',
  },
  {
    name: '浪漫仙女絲巾 Mielle Fairy Scarf',
    slug: 'mielle-fairy-scarf',
    price: 780,
    category: 'accessories',
    sizes: ['Free'],
    colors: 1,
    imageId: '69c106bdd2895bbcbeb64054',
    imageExt: 'png',
  },
  {
    name: '刺繡徽章棒球帽 Embroidered Patch Cap',
    slug: 'embroidered-patch-baseball-cap',
    price: 780,
    category: 'accessories',
    sizes: ['Free'],
    colors: 4,
    imageId: '69a63ba3c099d88d0f90da30',
    imageExt: 'jpg',
  },
]

// ═══════════════════════════════════════════════════════════
// 🏷 鞋包 BAGS & SHOES
// ═══════════════════════════════════════════════════════════
export const BAGS_SHOES: SeedProduct[] = [
  {
    name: '牛皮柔質托特包 Minerva Soft Cowhide Tote',
    slug: 'minerva-soft-cowhide-tote-bag',
    price: 4280,
    category: 'bag',
    sizes: ['Free'],
    colors: 2,
    imageId: '695c9dfa249874d85babedb6',
    imageExt: 'png',
  },
  {
    name: '率性牛皮皮帶 Casual Cowhide Belt',
    slug: 'casual-cowhide-leather-belt',
    price: 2580,
    category: 'accessories',
    sizes: ['Free'],
    colors: 2,
    imageId: '69b7c7750e8b85b679c1a122',
    imageExt: 'png',
  },
  {
    name: '復古感麂皮運動鞋 Vintage Suede Sneaker',
    slug: 'vintage-suede-sneaker',
    price: 2580,
    category: 'shoes',
    sizes: ['230', '235', '240', '245', '250'],
    colors: 3,
    imageId: '699c57f0ae766b03bd1ff00c',
    imageExt: 'jpg',
  },
  {
    name: '簡約皮革便士樂福鞋 Minimalist Penny Loafers',
    slug: 'minimalist-leather-penny-loafers',
    price: 2480,
    category: 'shoes',
    sizes: ['230', '235', '240', '245', '250'],
    colors: 2,
    imageId: '68c7e01510d44a001411d9fd',
    imageExt: 'jpg',
  },
]

// ── 合併全部商品 ──
export const ALL_PRODUCTS: SeedProduct[] = [
  ...DRESSES,
  ...TOPS,
  ...PANTS,
  ...OUTERWEAR,
  ...SKIRTS,
  ...SETS,
  ...ACCESSORIES,
  ...BAGS_SHOES,
]

// ── 分類對照 ──
export const CATEGORIES = [
  { name: '洋裝 Dresses', slug: 'dress' },
  { name: '上衣 Tops', slug: 'top' },
  { name: '褲子 Pants', slug: 'pants' },
  { name: '外套 Outerwear', slug: 'outer' },
  { name: '裙子 Skirts', slug: 'skirt' },
  { name: '套裝 Sets', slug: 'set' },
  { name: '配件 Accessories', slug: 'accessories' },
  { name: '包包 Bags', slug: 'bag' },
  { name: '鞋子 Shoes', slug: 'shoes' },
]
