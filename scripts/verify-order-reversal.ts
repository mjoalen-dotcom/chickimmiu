/**
 * 訂單回沖驗證（券額度 + 點數帳本）— CHIC Commerce OS P0 缺口修補
 * ────────────────────────────────────────────────────────────
 * 跑法：cross-env NODE_OPTIONS=--no-deprecation payload run scripts/verify-order-reversal.ts
 *
 * 驗證兩條既有洩漏是否真的補上：
 * 1. 券：建單 → usageCount +1 → 取消 → usageCount 回到原值、redemption 消失
 * 2. 點數：付款 → users.points +N 且有 purchase ledger row → 退款 → 點數扣回 +
 *    多一筆 refund_deduct（負數）ledger；重跑取消不會重複扣（idempotent）
 *
 * 全部自建測試資料，跑完清除（訂單保留為 cancelled/refunded 供人工查核，
 * 標記 [TEST-REVERSAL] 於 adminNote）。
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

const log = (...args: unknown[]) => console.error('[reversal]', ...args)
const keepAlive = setInterval(() => {}, 60_000)
let failures = 0
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) log(`✓ ${name}`)
  else {
    failures++
    log(`✗ ${name}`, extra !== undefined ? JSON.stringify(extra) : '')
  }
}

async function main() {
  const payload = await getPayload({ config: await config })
  const stamp = Date.now()
  const cleanup: Array<() => Promise<void>> = []

  // ── 準備：分類 / 商品 / 會員 / 券 ────────────────────────────────────────
  const cats = await payload.find({ collection: 'categories', limit: 1, depth: 0, overrideAccess: true })
  let categoryId = (cats.docs[0] as Record<string, any> | undefined)?.id
  if (categoryId == null) {
    const c = (await payload.create({
      collection: 'categories',
      data: { name: '[TEST] 回沖分類', slug: `test-rev-cat-${stamp}` } as never,
      overrideAccess: true,
    })) as Record<string, any>
    categoryId = c.id
    cleanup.push(async () => {
      await payload.delete({ collection: 'categories', id: c.id, overrideAccess: true }).catch(() => {})
    })
  }

  const product = (await payload.create({
    collection: 'products',
    data: {
      name: '[TEST] 回沖商品',
      slug: `test-rev-p-${stamp}`,
      price: 2000,
      cost: 600,
      status: 'published',
      stock: 99,
      category: categoryId,
    } as never,
    overrideAccess: true,
  })) as Record<string, any>
  cleanup.push(async () => {
    await payload.delete({ collection: 'products', id: product.id, overrideAccess: true }).catch(() => {})
  })

  const user = (await payload.create({
    collection: 'users',
    data: {
      name: '[TEST] 回沖會員',
      email: `test-reversal-${stamp}@invalid.local`,
      password: `Pw!${stamp}aA`,
      role: 'customer',
      points: 0,
    } as never,
    overrideAccess: true,
  })) as Record<string, any>
  cleanup.push(async () => {
    await payload.delete({ collection: 'users', id: user.id, overrideAccess: true }).catch(() => {})
  })

  const coupon = (await payload.create({
    collection: 'coupons',
    data: {
      code: `TESTREV${stamp}`,
      name: '[TEST] 回沖券',
      discountType: 'fixed',
      discountValue: 100,
      isActive: true,
      usageCount: 0,
    } as never,
    overrideAccess: true,
  })) as Record<string, any>
  cleanup.push(async () => {
    await payload.delete({ collection: 'coupons', id: coupon.id, overrideAccess: true }).catch(() => {})
  })

  const readCouponUsage = async (): Promise<number> => {
    const c = (await payload.findByID({
      collection: 'coupons',
      id: coupon.id,
      depth: 0,
      overrideAccess: true,
    })) as Record<string, any>
    return Number(c.usageCount) || 0
  }
  const readPoints = async (): Promise<number> => {
    const u = (await payload.findByID({
      collection: 'users',
      id: user.id,
      depth: 0,
      overrideAccess: true,
    })) as Record<string, any>
    return Number(u.points) || 0
  }

  // ── 1. 建單（帶券）→ usageCount +1 ─────────────────────────────────────
  const usageBefore = await readCouponUsage()
  const order = (await payload.create({
    collection: 'orders',
    data: {
      customer: user.id,
      items: [
        {
          product: product.id,
          productName: '[TEST] 回沖商品',
          quantity: 1,
          unitPrice: 2000,
          subtotal: 2000,
        },
      ],
      subtotal: 2000,
      subtotalBeforeDiscount: 2000,
      discountAmount: 100,
      shippingFee: 0,
      total: 1900,
      appliedCoupons: [{ coupon: coupon.id, couponCode: coupon.code, discountAmount: 100 }],
      coupon: coupon.id,
      couponCode: coupon.code,
      paymentMethod: 'ecpay',
      paymentStatus: 'unpaid',
      status: 'pending',
      shippingAddress: {
        recipientName: '測試',
        phone: '0900000000',
        city: '台北市',
        address: '測試路 1 號',
      },
      adminNote: '[TEST-REVERSAL] 自動化驗證訂單',
    } as never,
    overrideAccess: true,
  })) as Record<string, any>
  const usageAfterCreate = await readCouponUsage()
  check('建單 → 券 usageCount +1', usageAfterCreate === usageBefore + 1, {
    before: usageBefore,
    after: usageAfterCreate,
  })

  // ── 2. 付款 → 點數發放 + purchase ledger ───────────────────────────────
  await payload.update({
    collection: 'orders',
    id: order.id,
    data: { paymentStatus: 'paid' } as never,
    overrideAccess: true,
  })
  const pointsAfterPaid = await readPoints()
  const purchaseLedger = await payload.find({
    collection: 'points-transactions',
    where: {
      and: [{ relatedOrder: { equals: order.id } }, { source: { equals: 'purchase' } }],
    },
    limit: 5,
    depth: 0,
    overrideAccess: true,
  })
  const earnedRow = purchaseLedger.docs[0] as Record<string, any> | undefined
  check('付款 → users.points 增加', pointsAfterPaid > 0, { points: pointsAfterPaid })
  check('付款 → 有 purchase ledger row（既有缺口已補）', purchaseLedger.docs.length === 1, {
    rows: purchaseLedger.docs.length,
  })
  check(
    'ledger amount 與 balance 與實際點數一致',
    Boolean(earnedRow) && Number(earnedRow!.amount) === pointsAfterPaid && Number(earnedRow!.balance) === pointsAfterPaid,
    { amount: earnedRow?.amount, balance: earnedRow?.balance, actual: pointsAfterPaid },
  )

  // 重複觸發 paid（模擬 callback 重放）→ 不應重複寫 ledger
  await payload.update({
    collection: 'orders',
    id: order.id,
    data: { paymentStatus: 'paid', adminNote: '[TEST-REVERSAL] replay' } as never,
    overrideAccess: true,
  })
  const ledgerAfterReplay = await payload.count({
    collection: 'points-transactions',
    where: { and: [{ relatedOrder: { equals: order.id } }, { source: { equals: 'purchase' } }] },
    overrideAccess: true,
  })
  check('paid 重放 → ledger 不重複', ledgerAfterReplay.totalDocs === 1, ledgerAfterReplay.totalDocs)

  // ── 3. 退款 → 券回沖 + 點數扣回 + refund_deduct ledger ─────────────────
  await payload.update({
    collection: 'orders',
    id: order.id,
    data: { status: 'refunded', paymentStatus: 'refunded' } as never,
    overrideAccess: true,
  })
  const usageAfterRefund = await readCouponUsage()
  const pointsAfterRefund = await readPoints()
  const redemptionsLeft = await payload.count({
    collection: 'coupon-redemptions',
    where: { order: { equals: order.id } },
    overrideAccess: true,
  })
  const refundLedger = await payload.find({
    collection: 'points-transactions',
    where: { and: [{ relatedOrder: { equals: order.id } }, { source: { equals: 'order_refund' } }] },
    limit: 5,
    depth: 0,
    overrideAccess: true,
  })
  const refundRow = refundLedger.docs[0] as Record<string, any> | undefined

  check('退款 → 券 usageCount 回到原值（修好洩漏）', usageAfterRefund === usageBefore, {
    before: usageBefore,
    after: usageAfterRefund,
  })
  check('退款 → redemption 已移除', redemptionsLeft.totalDocs === 0, redemptionsLeft.totalDocs)
  check('退款 → 點數扣回 0', pointsAfterRefund === 0, { points: pointsAfterRefund })
  check('退款 → 有 refund_deduct ledger（負數）', Boolean(refundRow) && Number(refundRow!.amount) < 0, {
    amount: refundRow?.amount,
  })

  // ── 4. 再次進入終態 → 不重複扣（idempotent）────────────────────────────
  await payload.update({
    collection: 'orders',
    id: order.id,
    data: { status: 'cancelled' } as never,
    overrideAccess: true,
  })
  const usageFinal = await readCouponUsage()
  const pointsFinal = await readPoints()
  const refundLedgerFinal = await payload.count({
    collection: 'points-transactions',
    where: { and: [{ relatedOrder: { equals: order.id } }, { source: { equals: 'order_refund' } }] },
    overrideAccess: true,
  })
  check('重複終態 → usageCount 不再減（不變負）', usageFinal === usageBefore, usageFinal)
  check('重複終態 → 點數不再扣', pointsFinal === 0, pointsFinal)
  check('重複終態 → refund ledger 仍只有 1 筆', refundLedgerFinal.totalDocs === 1, refundLedgerFinal.totalDocs)

  // ── 清理（訂單保留，標記 TEST-REVERSAL）────────────────────────────────
  await payload
    .delete({ collection: 'orders', id: order.id, overrideAccess: true })
    .catch(() => log('訂單刪除失敗（保留為測試資料）'))
  for (const fn of cleanup.reverse()) await fn()
  log('測試資料已清除')

  log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
  clearInterval(keepAlive)
  process.exit(failures === 0 ? 0 : 1)
}

await main().catch((err) => {
  console.error('[reversal] FATAL', err)
  process.exit(1)
})
