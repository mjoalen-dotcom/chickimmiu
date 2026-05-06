/**
 * Demo Data Seed — 後台範例資料
 * ──────────────────────────────────────────
 *   範圍：S1 — 5 個 collection
 *     - Returns        退貨單
 *     - Exchanges      換貨單
 *     - UGCPosts       UGC 貼文
 *     - UserRewards    會員寶物箱獎項
 *     - AddOnProducts  加購品規則
 *
 *   每筆 demo 都用以下欄位前綴 `[DEMO]` 標識，方便 wipe-and-reseed：
 *     Returns/Exchanges/UGCPosts → adminNote 以 `[DEMO]` 開頭
 *     UserRewards               → displayName 以 `[DEMO]` 開頭
 *     AddOnProducts             → name 以 `[DEMO]` 開頭
 *     Orders（demo 撿單用）     → adminNote 以 `[DEMO]` 開頭
 *
 * Usage:
 *   pnpm seed:demo        # 寫入 DB
 *   pnpm seed:demo:dry    # 只印 log
 *
 * 前置條件：
 *   - 至少 1 個 user（admin 或 customer 任一）
 *   - 至少 1 個 published product（建議先跑 seedRealProducts）
 */
import { getPayload } from 'payload'
import config from '../payload.config'

const DRY_RUN = process.argv.includes('--dry-run')
const TAG = '[DEMO]'

function log(msg: string) {
  process.stderr.write(`[seedDemo] ${msg}\n`)
}

const keepAlive = setInterval(() => {}, 60_000)

async function wipeDemo(payload: any, collection: string, field: string) {
  const found = await payload.find({
    collection,
    where: { [field]: { like: TAG } },
    limit: 100,
    depth: 0,
  })
  for (const doc of found.docs) {
    if (!DRY_RUN) {
      await payload.delete({ collection, id: doc.id })
    }
  }
  log(`  wiped ${found.docs.length} demo ${collection}`)
}

async function seedDemo() {
  log(`script loaded, DRY_RUN=${DRY_RUN}`)
  const payload = await getPayload({ config })

  // ── Resolve dependencies ──
  const usersRes = await payload.find({ collection: 'users', limit: 5, depth: 0 })
  if (usersRes.docs.length === 0) {
    log('❌ 找不到任何 user，請先建 admin user (resetAdmin) 或 register')
    process.exit(1)
  }
  const customer =
    (usersRes.docs.find(
      (u: any) => (u as any).role !== 'admin',
    ) as any) ?? (usersRes.docs[0] as any)
  log(`✓ customer = #${customer.id} (${customer.email})`)

  const productsRes = await payload.find({
    collection: 'products',
    where: { status: { equals: 'published' } },
    limit: 5,
    depth: 0,
  })
  if (productsRes.docs.length === 0) {
    log('❌ 找不到 published products，請先 npx tsx src/seed/seedRealProducts.ts')
    process.exit(1)
  }
  const products = productsRes.docs as any[]
  log(`✓ products = ${products.length} 筆 (${products.map((p) => p.name).slice(0, 3).join(', ')}...)`)

  // ── Prepare demo Order（找不到客戶 order 就建一張）──
  await wipeDemo(payload, 'orders', 'adminNote')
  let demoOrder: any
  if (DRY_RUN) {
    log('  [dry-run] would create demo order')
    demoOrder = { id: 'DRY-ORDER', orderNumber: 'DRY-ORDER' }
  } else {
    const orderItems = products.slice(0, 2).map((p) => ({
      product: p.id,
      productName: p.name,
      quantity: 1,
      unitPrice: p.price ?? 1000,
      subtotal: p.price ?? 1000,
    }))
    const orderSubtotal = orderItems.reduce((s, i) => s + i.subtotal, 0)
    demoOrder = await payload.create({
      collection: 'orders',
      data: {
        customer: customer.id,
        items: orderItems,
        subtotal: orderSubtotal,
        total: orderSubtotal + 100,
        shippingFee: 100,
        status: 'delivered',
        paymentStatus: 'paid',
        shippingAddress: {
          recipientName: 'Demo 客戶',
          phone: '0912-345-678',
          zipCode: '105',
          city: '台北市',
          district: '松山區',
          address: '南京東路 5 段 100 號',
        },
        adminNote: `${TAG} 這是後台範例訂單，可隨時刪除`,
      } as any,
    })
    log(`✓ demo order = #${demoOrder.id} (${demoOrder.orderNumber})`)
  }

  // ── Returns（3 筆）──
  log('── Returns ──')
  await wipeDemo(payload, 'returns', 'adminNote')
  const returnsData = [
    {
      status: 'pending',
      items: [
        {
          product: products[0].id,
          variant: '黑色 / M',
          quantity: 1,
          reason: 'wrong_size',
          reasonDetail: '尺寸偏小，希望換大一號',
        },
      ],
      adminNote: `${TAG} 待審核 — 尺寸不合範例`,
    },
    {
      status: 'approved',
      items: [
        {
          product: products[Math.min(1, products.length - 1)].id,
          variant: '白色 / S',
          quantity: 1,
          reason: 'defective',
          reasonDetail: '收到時發現布料有破損',
        },
      ],
      refundAmount: 1280,
      refundMethod: 'original',
      adminNote: `${TAG} 已核准 — 商品瑕疵範例（請提供退貨物流）`,
    },
    {
      status: 'refunded',
      items: [
        {
          product: products[Math.min(2, products.length - 1)].id,
          variant: '米色 / L',
          quantity: 2,
          reason: 'color_mismatch',
          reasonDetail: '實品顏色與網頁圖片差異大',
        },
      ],
      refundAmount: 2560,
      refundMethod: 'credit',
      trackingNumber: '760123456789',
      adminNote: `${TAG} 已退款（購物金）— 顏色不符範例`,
    },
  ]
  for (const r of returnsData) {
    if (DRY_RUN) {
      log(`  [dry-run] would create return: ${r.status} / ${r.adminNote}`)
      continue
    }
    const created = await payload.create({
      collection: 'returns',
      data: {
        order: demoOrder.id,
        customer: customer.id,
        ...r,
      } as any,
    })
    log(`  ✓ ${(created as any).returnNumber} (${r.status})`)
  }

  // ── Exchanges（3 筆）──
  log('── Exchanges ──')
  await wipeDemo(payload, 'exchanges', 'adminNote')
  const exchangesData = [
    {
      status: 'pending',
      items: [
        {
          product: products[0].id,
          originalVariant: '黑色 / S',
          newVariant: '黑色 / M',
          quantity: 1,
          reason: 'wrong_size',
        },
      ],
      adminNote: `${TAG} 待審核 — 尺寸換貨範例`,
    },
    {
      status: 'shipped',
      items: [
        {
          product: products[Math.min(1, products.length - 1)].id,
          originalVariant: '紅色 / M',
          newVariant: '藍色 / M',
          quantity: 1,
          reason: 'color_mismatch',
        },
      ],
      priceDifference: 0,
      newTrackingNumber: '870987654321',
      adminNote: `${TAG} 新品已寄出 — 顏色換貨範例`,
    },
    {
      status: 'completed',
      items: [
        {
          product: products[Math.min(2, products.length - 1)].id,
          originalVariant: '米色 / L',
          newVariant: '咖啡 / L',
          quantity: 1,
          reason: 'defective',
        },
      ],
      priceDifference: 200,
      newTrackingNumber: '870111222333',
      adminNote: `${TAG} 已完成 — 瑕疵換貨（補差價 200）範例`,
    },
  ]
  for (const e of exchangesData) {
    if (DRY_RUN) {
      log(`  [dry-run] would create exchange: ${e.status} / ${e.adminNote}`)
      continue
    }
    const created = await payload.create({
      collection: 'exchanges',
      data: {
        order: demoOrder.id,
        customer: customer.id,
        ...e,
      } as any,
    })
    log(`  ✓ ${(created as any).exchangeNumber} (${e.status})`)
  }

  // ── UGC Posts（5 筆）──
  log('── UGC Posts ──')
  await wipeDemo(payload, 'ugc-posts', 'adminNote')
  const ugcData = [
    {
      platform: 'instagram',
      sourceType: 'brand_post',
      externalId: 'demo-ig-brand-001',
      externalUrl: 'https://instagram.com/p/demo-001',
      authorName: 'CHIC KIM & MIU',
      authorHandle: '@chickimmiu',
      contentType: 'image',
      caption:
        '春季新品上市 ✨ 質感連身洋裝，溫柔氣質一秒到位 #chickimmiu #春季新品',
      likes: 1248,
      comments: 56,
      shares: 23,
      views: 8920,
      status: 'approved',
      isPinned: true,
      sortOrder: 100,
      displayLocations: ['homepage', 'ugc_gallery'],
      displayLayout: 'shoppable_gallery',
      taggedProducts: products.slice(0, 2).map((p) => p.id),
      hashtags: [{ tag: 'chickimmiu' }, { tag: '春季新品' }, { tag: 'OOTD' }],
      adminNote: `${TAG} IG 品牌帳號貼文 — 置頂範例`,
    },
    {
      platform: 'instagram',
      sourceType: 'user_tag',
      externalId: 'demo-ig-tag-002',
      externalUrl: 'https://instagram.com/p/demo-002',
      authorName: '小美 Mia',
      authorHandle: '@mia_outfit',
      contentType: 'carousel',
      caption: '今天的穿搭 💛 來自 @chickimmiu 真的太美了！',
      likes: 432,
      comments: 18,
      shares: 5,
      views: 2150,
      status: 'approved',
      sortOrder: 50,
      displayLocations: ['ugc_gallery'],
      displayLayout: 'masonry',
      taggedProducts: [products[Math.min(1, products.length - 1)].id],
      hashtags: [{ tag: 'OOTD' }, { tag: 'taiwanesefashion' }],
      adminNote: `${TAG} IG 用戶標註品牌範例`,
    },
    {
      platform: 'facebook',
      sourceType: 'brand_post',
      externalId: 'demo-fb-brand-003',
      externalUrl: 'https://facebook.com/chickimmiu/posts/demo-003',
      authorName: 'CHIC KIM & MIU',
      authorHandle: 'chickimmiu',
      contentType: 'image',
      caption: '週末限定 ✨ 全館滿千折百，再送精緻小禮！',
      likes: 256,
      comments: 12,
      shares: 8,
      views: 1820,
      status: 'approved',
      sortOrder: 30,
      displayLocations: ['homepage'],
      displayLayout: 'grid',
      hashtags: [{ tag: '週末限定' }, { tag: '優惠' }],
      adminNote: `${TAG} FB 品牌貼文範例`,
    },
    {
      platform: 'tiktok',
      sourceType: 'user_mention',
      externalId: 'demo-tiktok-004',
      externalUrl: 'https://tiktok.com/@user/video/demo-004',
      authorName: 'TJ 穿搭日記',
      authorHandle: '@tj_diary',
      contentType: 'reel',
      caption: 'CHICKIMMIU 的洋裝合集 💃 三套穿搭給你看！',
      likes: 5680,
      comments: 234,
      shares: 89,
      views: 42100,
      status: 'approved',
      sortOrder: 80,
      displayLocations: ['ugc_gallery'],
      displayLayout: 'shoppable_video',
      taggedProducts: products.slice(0, 3).map((p) => p.id),
      hashtags: [{ tag: '穿搭' }, { tag: 'fyp' }],
      adminNote: `${TAG} TikTok 影音範例（導購影音版型）`,
    },
    {
      platform: 'manual',
      sourceType: 'manual_import',
      externalId: 'demo-manual-005',
      authorName: '官方造型師 Lisa',
      contentType: 'image',
      caption: '本週推薦造型 — 三件式套裝完整搭配示範',
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      status: 'pending',
      sortOrder: 0,
      hashtags: [{ tag: '造型推薦' }],
      adminNote: `${TAG} 手動匯入 — 待審核範例`,
    },
  ]
  for (const u of ugcData) {
    if (DRY_RUN) {
      log(`  [dry-run] would create ugc: ${u.authorName} / ${u.platform}`)
      continue
    }
    const created = await payload.create({
      collection: 'ugc-posts',
      data: u as any,
    })
    log(`  ✓ #${(created as any).id} ${u.authorName} (${u.platform})`)
  }

  // ── User Rewards（5 筆）──
  log('── User Rewards ──')
  await wipeDemo(payload, 'user-rewards', 'displayName')
  const oneYearLater = new Date()
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
  const sixMonthsLater = new Date()
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)

  const rewardsData = [
    {
      rewardType: 'free_shipping_coupon',
      displayName: `${TAG} 免運券（全站）`,
      amount: 1,
      couponCode: `DEMO-FS-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      redemptionInstructions: '結帳時自動套用，可折抵運費上限 100 元',
      state: 'unused',
      expiresAt: oneYearLater.toISOString(),
      requiresPhysicalShipping: false,
    },
    {
      rewardType: 'movie_ticket_digital',
      displayName: `${TAG} 威秀電影券（電子）`,
      amount: 2,
      couponCode: `DEMO-MV-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      redemptionInstructions: '至威秀影城官網兌換，輸入兌換碼即可選位',
      state: 'unused',
      expiresAt: sixMonthsLater.toISOString(),
      requiresPhysicalShipping: false,
    },
    {
      rewardType: 'coupon',
      displayName: `${TAG} 9 折優惠券`,
      amount: 10,
      couponCode: `DEMO-CP-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      redemptionInstructions: '單筆滿 1000 元可用，不可與其他活動併用',
      state: 'unused',
      expiresAt: oneYearLater.toISOString(),
      requiresPhysicalShipping: false,
    },
    {
      rewardType: 'gift_physical',
      displayName: `${TAG} 品牌限量贈品（實體）`,
      amount: 1,
      redemptionInstructions: '勾選後隨下一張訂單寄出',
      state: 'pending_attach',
      expiresAt: oneYearLater.toISOString(),
      requiresPhysicalShipping: true,
    },
    {
      rewardType: 'badge',
      displayName: `${TAG} 鑽石會員紀念徽章`,
      amount: 1,
      redemptionInstructions: '會員專屬榮譽徽章，於個人頁面顯示',
      state: 'unused',
      expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      requiresPhysicalShipping: false,
    },
  ]
  for (const r of rewardsData) {
    if (DRY_RUN) {
      log(`  [dry-run] would create reward: ${r.displayName} / ${r.state}`)
      continue
    }
    const created = await payload.create({
      collection: 'user-rewards',
      data: {
        user: customer.id,
        ...r,
      } as any,
    })
    log(`  ✓ #${(created as any).id} ${r.displayName} (${r.state})`)
  }

  // ── Add-On Products（4 筆）──
  log('── Add-On Products ──')
  await wipeDemo(payload, 'add-on-products', 'name')
  const addOnsData = [
    {
      name: `${TAG} 滿 $500 加購暖暖包`,
      product: products[0].id,
      addOnPrice: 99,
      conditions: { minCartSubtotal: 500, usageLimitPerOrder: 1 },
      isActive: true,
      priority: 100,
    },
    {
      name: `${TAG} 滿 $1000 加購收納袋`,
      product: products[Math.min(1, products.length - 1)].id,
      addOnPrice: 199,
      conditions: { minCartSubtotal: 1000, usageLimitPerOrder: 2 },
      isActive: true,
      priority: 80,
    },
    {
      name: `${TAG} 滿 $2000 加購保養精華`,
      product: products[Math.min(2, products.length - 1)].id,
      addOnPrice: 499,
      conditions: { minCartSubtotal: 2000, usageLimitPerOrder: 1 },
      isActive: true,
      priority: 60,
    },
    {
      name: `${TAG} 滿 $3000 加購精緻禮盒`,
      product: products[Math.min(3, products.length - 1)].id,
      addOnPrice: 999,
      conditions: { minCartSubtotal: 3000, usageLimitPerOrder: 1 },
      isActive: false,
      priority: 40,
    },
  ]
  for (const a of addOnsData) {
    if (DRY_RUN) {
      log(`  [dry-run] would create add-on: ${a.name}`)
      continue
    }
    const created = await payload.create({
      collection: 'add-on-products',
      data: a as any,
    })
    log(`  ✓ #${(created as any).id} ${a.name}`)
  }

  log('✅ Done')
  clearInterval(keepAlive)
  process.exit(0)
}

// ⚠️ MUST be top-level await — see seedCore.ts for full explanation.
// `payload run` does `await import(scriptPath)` then `process.exit(0)`;
// fire-and-forget would let the import resolve before seedDemo() finishes.
await seedDemo().catch((err) => {
  log('❌ ERROR: ' + (err?.stack || err))
  process.exit(1)
})
