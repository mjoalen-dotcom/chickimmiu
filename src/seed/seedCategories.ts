/**
 * CHIC KIM & MIU — 分類 Seed 腳本
 * ──────────────────────────────────
 * 將完整的商品分類樹狀結構匯入 Payload CMS Categories collection
 *
 * 使用方式：
 *   npx tsx src/seed/seedCategories.ts
 *
 * 前置條件：
 *   1. PostgreSQL / SQLite 正在運行
 *   2. .env 中 DATABASE_URI 和 PAYLOAD_SECRET 已設定
 *   3. 已執行 Payload 資料庫遷移（npx payload migrate）
 */

import { getPayload } from 'payload'
import config from '../payload.config'

// ── 資料結構定義 ──

interface CategoryData {
  name: string
  slug: string
  description: string
  parentSlug?: string
}

// ── 頂層分類（無 parent）──

const TOP_LEVEL_CATEGORIES: CategoryData[] = [
  {
    name: 'NEW ARRIVAL',
    slug: 'new-arrival',
    description: '最新上架商品，搶先看本季新品',
  },
  {
    name: '全部商品 All',
    slug: 'all-products',
    description: '瀏覽所有商品',
  },
  {
    name: '主題精選',
    slug: 'theme-picks',
    description: '精選主題搭配系列',
  },
  {
    name: '下著 Bottom',
    slug: 'bottoms',
    description: '褲裝與裙裝全系列',
  },
  {
    name: '連衣裙/洋裝 Dress',
    slug: 'dresses',
    description: '各式洋裝、連衣裙，約會必備',
  },
  {
    name: '套裝 Set',
    slug: 'sets',
    description: '上下套裝系列',
  },
  {
    name: '泳裝 Swimwear',
    slug: 'swimwear',
    description: '比基尼、連身泳裝、罩衫',
  },
  {
    name: '配件 Accessories',
    slug: 'accessories',
    description: '時尚配件、完美穿搭的最後一哩路',
  },
  {
    name: '飾品 Jewelry',
    slug: 'jewelry',
    description: '精選飾品，提升穿搭質感',
  },
  {
    name: '韓劇商品 K-Drama Products',
    slug: 'k-drama',
    description: '韓劇同款商品，追劇必備穿搭',
  },
  {
    name: '現貨速到專區 Rush',
    slug: 'rush-delivery',
    description: '現貨商品，快速出貨',
  },
  {
    name: '婚禮洋裝/正式洋裝',
    slug: 'formal-dresses',
    description: '婚禮、宴會、正式場合洋裝',
  },
  {
    name: '品牌自訂款',
    slug: 'brand-custom',
    description: 'CHIC KIM & MIU 品牌獨家設計',
  },
]

// ── 子分類（含 parentSlug）──

const CHILD_CATEGORIES: CategoryData[] = [
  // 主題精選 children
  {
    name: '外套 Outer',
    slug: 'outer',
    description: '各式外套、大衣、夾克',
    parentSlug: 'theme-picks',
  },
  {
    name: '上衣 Top',
    slug: 'tops',
    description: 'T恤、背心、短袖上衣',
    parentSlug: 'theme-picks',
  },
  {
    name: '針織 Knit',
    slug: 'knit',
    description: '針織衫、毛衣、針織背心',
    parentSlug: 'theme-picks',
  },
  {
    name: '襯衫 Blouse',
    slug: 'blouse',
    description: '各式襯衫與女衫',
    parentSlug: 'theme-picks',
  },
  {
    name: 'Bra Top',
    slug: 'bra-top',
    description: '時尚 Bra Top 系列',
    parentSlug: 'theme-picks',
  },

  // 下著 Bottom children
  {
    name: '所有褲子',
    slug: 'all-pants',
    description: '瀏覽所有褲裝',
    parentSlug: 'bottoms',
  },
  {
    name: '長褲',
    slug: 'long-pants',
    description: '直筒褲、寬褲、西裝褲',
    parentSlug: 'bottoms',
  },
  {
    name: '短褲',
    slug: 'shorts',
    description: '牛仔短褲、休閒短褲',
    parentSlug: 'bottoms',
  },
  {
    name: '螞蟻腰褲',
    slug: 'high-waist-pants',
    description: '高腰修身螞蟻腰系列',
    parentSlug: 'bottoms',
  },
  {
    name: '所有裙子',
    slug: 'all-skirts',
    description: '瀏覽所有裙裝',
    parentSlug: 'bottoms',
  },
  {
    name: '中/長裙',
    slug: 'midi-long-skirts',
    description: '中長裙、長裙',
    parentSlug: 'bottoms',
  },
  {
    name: '短裙',
    slug: 'mini-skirts',
    description: '迷你裙、短裙',
    parentSlug: 'bottoms',
  },

  // 套裝 Set children
  {
    name: '正式套裝 Formal Set',
    slug: 'formal-sets',
    description: '西裝套裝、正式場合穿搭',
    parentSlug: 'sets',
  },
  {
    name: '休閒套裝 Casual Set',
    slug: 'casual-sets',
    description: '日常休閒套裝',
    parentSlug: 'sets',
  },

  // 配件 Accessories children
  {
    name: '鞋子',
    slug: 'shoes',
    description: '高跟鞋、平底鞋、涼鞋',
    parentSlug: 'accessories',
  },
  {
    name: '襪子',
    slug: 'socks',
    description: '各式襪款',
    parentSlug: 'accessories',
  },
  {
    name: '包包',
    slug: 'bags',
    description: '手提包、斜背包、手拿包',
    parentSlug: 'accessories',
  },
  {
    name: '眼鏡',
    slug: 'glasses',
    description: '太陽眼鏡、平光眼鏡',
    parentSlug: 'accessories',
  },
  {
    name: '皮帶',
    slug: 'belts',
    description: '各式皮帶與腰帶',
    parentSlug: 'accessories',
  },
  {
    name: '手錶',
    slug: 'watches',
    description: '時尚手錶',
    parentSlug: 'accessories',
  },
  {
    name: '髮飾',
    slug: 'hair-accessories',
    description: '髮夾、髮圈、髮帶',
    parentSlug: 'accessories',
  },
  {
    name: '帽子/圍巾',
    slug: 'hats-scarves',
    description: '帽子、圍巾、披肩',
    parentSlug: 'accessories',
  },
  {
    name: '吊飾',
    slug: 'charms',
    description: '手機吊飾、鑰匙圈',
    parentSlug: 'accessories',
  },

  // 飾品 Jewelry children
  {
    name: '耳環',
    slug: 'earrings',
    description: '耳針、耳夾、耳環',
    parentSlug: 'jewelry',
  },
  {
    name: '戒指',
    slug: 'rings',
    description: '戒指、指環',
    parentSlug: 'jewelry',
  },
  {
    name: '手環',
    slug: 'bracelets',
    description: '手環、手鍊',
    parentSlug: 'jewelry',
  },
  {
    name: '項鍊',
    slug: 'necklaces',
    description: '項鍊、鎖骨鍊',
    parentSlug: 'jewelry',
  },
  {
    name: '純銀',
    slug: 'sterling-silver',
    description: '925 純銀飾品系列',
    parentSlug: 'jewelry',
  },

  // 韓劇商品 K-Drama children
  {
    name: 'Penthouse',
    slug: 'k-drama-penthouse',
    description: '上流戰爭 同款穿搭',
    parentSlug: 'k-drama',
  },
  {
    name: '現正分手中',
    slug: 'k-drama-breaking-up',
    description: '現正分手中 劇中同款',
    parentSlug: 'k-drama',
  },
  {
    name: '愛的迫降',
    slug: 'k-drama-crash-landing',
    description: '愛的迫降 同款穿搭',
    parentSlug: 'k-drama',
  },
  {
    name: '夫妻的世界',
    slug: 'k-drama-world-of-married',
    description: '夫妻的世界 同款穿搭',
    parentSlug: 'k-drama',
  },
  {
    name: '男朋友',
    slug: 'k-drama-encounter',
    description: '男朋友 同款穿搭',
    parentSlug: 'k-drama',
  },
  {
    name: '觸及真心',
    slug: 'k-drama-touch-your-heart',
    description: '觸及真心 同款穿搭',
    parentSlug: 'k-drama',
  },
  {
    name: '她的私生活',
    slug: 'k-drama-her-private-life',
    description: '她的私生活 同款穿搭',
    parentSlug: 'k-drama',
  },
  {
    name: '太陽的後裔',
    slug: 'k-drama-descendants-of-sun',
    description: '太陽的後裔 同款穿搭',
    parentSlug: 'k-drama',
  },
]

// ── 主要函式 ──

export async function seedCategories(): Promise<void> {
  console.log('📂 開始匯入 CHIC KIM & MIU 商品分類樹狀結構...\n')

  const payload = await getPayload({ config })

  // slug → Payload document id 對照表
  const slugToId: Record<string, string> = {}

  let createdCount = 0
  let skippedCount = 0

  // ── 第一階段：建立頂層分類 ──

  console.log(`── 第一階段：建立 ${TOP_LEVEL_CATEGORIES.length} 個頂層分類 ──`)

  for (const cat of TOP_LEVEL_CATEGORIES) {
    try {
      const existing = await payload.find({
        collection: 'categories',
        where: { slug: { equals: cat.slug } },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        const id = existing.docs[0].id as unknown as string
        slugToId[cat.slug] = id
        skippedCount++
        console.log(`  → ${cat.name} (已存在，跳過)`)
      } else {
        const created = await (payload.create as Function)({
          collection: 'categories',
          data: {
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
          } as unknown as Record<string, unknown>,
        })
        slugToId[cat.slug] = created.id as unknown as string
        createdCount++
        console.log(`  ✓ ${cat.name} (新建)`)
      }
    } catch (err) {
      console.error(`  ✗ 建立失敗 [${cat.slug}]:`, err)
    }
  }

  // ── 第二階段：建立子分類（附上 parent reference）──

  console.log(`\n── 第二階段：建立 ${CHILD_CATEGORIES.length} 個子分類 ──`)

  for (const cat of CHILD_CATEGORIES) {
    const parentId = cat.parentSlug ? slugToId[cat.parentSlug] : undefined

    if (cat.parentSlug && !parentId) {
      console.warn(`  ⚠ ${cat.name}：找不到父分類 "${cat.parentSlug}"，略過`)
      skippedCount++
      continue
    }

    try {
      const existing = await payload.find({
        collection: 'categories',
        where: { slug: { equals: cat.slug } },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        const id = existing.docs[0].id as unknown as string
        slugToId[cat.slug] = id
        skippedCount++
        console.log(`  → ${cat.name} (已存在，跳過)`)
      } else {
        const data: Record<string, unknown> = {
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
        }

        if (parentId) {
          data.parent = parentId
        }

        const created = await (payload.create as Function)({
          collection: 'categories',
          data,
        })
        slugToId[cat.slug] = created.id as unknown as string
        createdCount++
        const parentLabel = cat.parentSlug ?? '無'
        console.log(`  ✓ ${cat.name}（父：${parentLabel}）(新建)`)
      }
    } catch (err) {
      console.error(`  ✗ 建立失敗 [${cat.slug}]:`, err)
    }
  }

  // ── 完成摘要 ──

  const total = TOP_LEVEL_CATEGORIES.length + CHILD_CATEGORIES.length
  console.log(`\n✅ 分類匯入完成！`)
  console.log(`   新建：${createdCount} 個`)
  console.log(`   跳過（已存在）：${skippedCount} 個`)
  console.log(`   總計：${total} 個分類`)
}

// ── 自執行主程式區塊 ──

const isMain =
  process.argv[1]?.endsWith('seedCategories.ts') ||
  process.argv[1]?.endsWith('seedCategories.js')

if (isMain) {
  seedCategories()
    .then(() => {
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ 分類 Seed 失敗：', err)
      process.exit(1)
    })
}
