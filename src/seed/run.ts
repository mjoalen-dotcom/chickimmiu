/**
 * CHIC KIM & MIU — Master Seed Runner
 * ────────────────────────────────────
 * 一鍵執行所有 seed 腳本 + 產生上傳範本
 *
 * 使用方式：
 *   npx tsx src/seed/run.ts
 *
 * 前置條件：
 *   1. SQLite / PostgreSQL 正在運行
 *   2. .env 中 DATABASE_URI 和 PAYLOAD_SECRET 已設定
 */

import { getPayload } from 'payload'
import config from '../payload.config'
import { seedCategories } from './seedCategories'
import { seedRealProducts } from './seedRealProducts'

async function seed() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║   CHIC KIM & MIU — 資料庫初始化腳本     ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()

  const start = Date.now()

  // Step 1: 分類（含完整子分類樹）
  console.log('📂 Step 1/4: 建立商品分類...')
  await seedCategories()
  console.log()

  // Step 2: 真實商品（~120 件）
  console.log('🛍️  Step 2/4: 建立真實商品（www.chickimmiu.com）...')
  await seedRealProducts()
  console.log()

  // Step 3: 點數兌換範本
  console.log('🎁 Step 3/4: 建立點數兌換範本...')
  const payload = await getPayload({ config })
  const redemptionTemplates = [
    { name: '威秀電影票 (單張)', slug: 'vieshow-movie-ticket-single', type: 'movie_ticket', pointsCost: 500, stock: 50, description: '威秀影城電影票一張，全台門市皆可使用（2D一般廳）' },
    { name: '威秀電影票 (雙人)', slug: 'vieshow-movie-ticket-pair', type: 'movie_ticket', pointsCost: 900, stock: 30, description: '威秀影城電影票兩張，與好友一起看電影！' },
    { name: 'NT$100 購物金', slug: 'store-credit-100', type: 'store_credit', pointsCost: 200, stock: 0, description: '可於下次購物直接折抵 NT$100' },
    { name: '免運券', slug: 'free-shipping-coupon', type: 'free_shipping', pointsCost: 100, stock: 0, description: '單筆訂單免運費（限台灣本島）' },
    { name: '幸運轉盤 (1次)', slug: 'lucky-spin-1x', type: 'lottery', pointsCost: 50, stock: 0, description: '轉盤一次！獎品包含電影票、購物金、折扣碼等' },
    { name: '95折優惠券', slug: 'discount-5pct-coupon', type: 'coupon', pointsCost: 150, stock: 0, description: '全站商品 95 折（不可與其他優惠併用）' },
    { name: '新品搶先購資格', slug: 'early-access-pass', type: 'experience', pointsCost: 300, stock: 20, description: '下次新品上市前 24 小時搶先購買' },
  ]

  for (const item of redemptionTemplates) {
    try {
      const existing = await payload.find({
        collection: 'points-redemptions',
        where: { slug: { equals: item.slug } },
        limit: 1,
      })
      if (existing.docs.length > 0) {
        console.log(`  → ${item.name} (已存在)`)
        continue
      }
      await (payload.create as Function)({
        collection: 'points-redemptions',
        data: { ...item, isActive: true, redeemed: 0, sortOrder: 0 } as unknown as Record<string, unknown>,
      })
      console.log(`  ✓ ${item.name}`)
    } catch (err) {
      console.error(`  ✗ ${item.name}:`, err)
    }
  }
  console.log()

  // Step 4: 上傳範本
  console.log('📋 Step 4/4: 產生上傳範本...')
  const { generateTemplates } = await import('./generateTemplates')
  await generateTemplates()
  console.log()

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log('╔══════════════════════════════════════════╗')
  console.log(`║   ✅ 全部完成！耗時 ${elapsed} 秒`)
  console.log('║                                          ')
  console.log('║   已建立：                                ')
  console.log('║   • 商品分類（13 個頂層 + 36 個子分類）   ')
  console.log('║   • 真實商品（~120 件，含變體）           ')
  console.log('║   • 點數兌換範本（7 個）                  ')
  console.log('║   • 上傳範本 (public/templates/)          ')
  console.log('╚══════════════════════════════════════════╝')

  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed 失敗:', err)
  process.exit(1)
})
