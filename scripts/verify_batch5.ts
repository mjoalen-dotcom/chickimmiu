/**
 * Batch 5 — 優惠券疊加/互斥 驗證（乾淨 temp DB）。
 *
 *   rm -f data/_b5.db*
 *   DATABASE_URI=file:./data/_b5.db NODE_OPTIONS=--no-deprecation yes y | \
 *     DATABASE_URI=file:./data/_b5.db NODE_OPTIONS=--no-deprecation pnpm exec payload migrate
 *   DATABASE_URI=file:./data/_b5.db NODE_OPTIONS=--no-deprecation pnpm exec payload run scripts/verify_batch5.ts
 *
 * 覆蓋：apply-coupon route 的疊加/互斥驗證 + checkout 折扣加總/封頂公式 +
 *       Orders redemption hook 多券 per-coupon usageCount。
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { POST as applyCouponPOST } from '@/app/(frontend)/api/cart/apply-coupon/route'

const results: Array<{ name: string; ok: boolean; detail: string }> = []
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail })
  process.stdout.write(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}\n`)
}

function applyReq(payloadBody: Record<string, unknown>): Request {
  return new Request('http://localhost/api/cart/apply-coupon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadBody),
  })
}

async function callApply(body: Record<string, unknown>) {
  const res = await applyCouponPOST(applyReq(body))
  return (await res.json()) as Record<string, unknown>
}

// checkout couponDiscount 公式（與 checkout/page.tsx 一致）
function couponDiscountFormula(subtotal: number, coupons: Array<{ discountAmount: number; freeShipping: boolean }>): number {
  return Math.min(subtotal, coupons.reduce((s, c) => s + (c.freeShipping ? 0 : c.discountAmount), 0))
}

async function main() {
  const payload = await getPayload({ config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any

  const mk = (data: Record<string, unknown>) =>
    p.create({ collection: 'coupons', data, overrideAccess: true })

  // ── coupons ──
  const C1 = await mk({ code: 'STACK10', name: '可疊加九折', discountType: 'percentage', discountValue: 10, stackable: true })
  const C2 = await mk({ code: 'WELCOME50', name: '可疊加減50', discountType: 'fixed', discountValue: 50, stackable: true, exclusiveGroup: 'welcome' })
  const C3 = await mk({ code: 'SOLO30', name: '單獨用減30', discountType: 'fixed', discountValue: 30, stackable: false })
  const C4 = await mk({ code: 'WELCOME20', name: '可疊加八折同群組', discountType: 'percentage', discountValue: 20, stackable: true, exclusiveGroup: 'welcome' })

  // ── Test A: 單獨套用（無 appliedCouponIds）→ valid ──
  try {
    const r = await callApply({ code: 'STACK10', subtotal: 1000 })
    check('A STACK10 alone valid, discount=100', r.valid === true && r.discountAmount === 100, JSON.stringify(r))
  } catch (e) { check('A suite', false, e instanceof Error ? e.message : String(e)) }

  // ── Test B: 兩張可疊加（不同/空群組）→ valid ──
  try {
    const r = await callApply({ code: 'WELCOME50', subtotal: 1000, appliedCouponIds: [C1.id] })
    check('B WELCOME50 + STACK10 → valid, discount=50', r.valid === true && r.discountAmount === 50, JSON.stringify(r))
  } catch (e) { check('B suite', false, e instanceof Error ? e.message : String(e)) }

  // ── Test C: 候選券不可疊加（SOLO30）但已有套用 → invalid ──
  try {
    const r = await callApply({ code: 'SOLO30', subtotal: 1000, appliedCouponIds: [C1.id] })
    check('C SOLO30 onto applied → invalid (not stackable)', r.valid === false && String(r.reason).includes('疊加'), JSON.stringify(r))
  } catch (e) { check('C suite', false, e instanceof Error ? e.message : String(e)) }

  // ── Test D: 已套用券不可疊加（SOLO30 already applied）→ invalid ──
  try {
    const r = await callApply({ code: 'STACK10', subtotal: 1000, appliedCouponIds: [C3.id] })
    check('D STACK10 with applied SOLO30 → invalid', r.valid === false, JSON.stringify(r))
  } catch (e) { check('D suite', false, e instanceof Error ? e.message : String(e)) }

  // ── Test E: 互斥群組衝突（welcome）→ invalid ──
  try {
    const r = await callApply({ code: 'WELCOME20', subtotal: 1000, appliedCouponIds: [C2.id] })
    check('E WELCOME20 + WELCOME50 same group → invalid (互斥)', r.valid === false && String(r.reason).includes('互斥'), JSON.stringify(r))
  } catch (e) { check('E suite', false, e instanceof Error ? e.message : String(e)) }

  // ── Test F: 折扣加總 + 封頂公式 ──
  check('F sum: 100+50 on 1000 → 150', couponDiscountFormula(1000, [{ discountAmount: 100, freeShipping: false }, { discountAmount: 50, freeShipping: false }]) === 150)
  check('F cap: 800+800 on 1000 → 1000', couponDiscountFormula(1000, [{ discountAmount: 800, freeShipping: false }, { discountAmount: 800, freeShipping: false }]) === 1000)
  check('F free-shipping coupon contributes 0 discount', couponDiscountFormula(1000, [{ discountAmount: 0, freeShipping: true }, { discountAmount: 100, freeShipping: false }]) === 100)

  // ── Test G: Orders redemption hook 多券 per-coupon usageCount ──
  try {
    const user = await p.create({ collection: 'users', data: { email: `b5_${Date.now()}@test.local`, password: 'Test12345!', name: 'B5' }, disableVerificationEmail: true, overrideAccess: true })
    const cat = await p.create({ collection: 'categories', data: { name: 'B5 分類', slug: `b5-cat-${Date.now()}` }, overrideAccess: true })
    const prod = await p.create({ collection: 'products', data: { name: 'B5 測試商品', slug: `b5-prod-${Date.now()}`, price: 1000, category: cat.id, status: 'published' }, overrideAccess: true })
    const order = await p.create({
      collection: 'orders',
      data: {
        customer: user.id,
        items: [{ product: prod.id, productName: 'B5 測試商品', quantity: 1, unitPrice: 1000, subtotal: 1000 }],
        subtotal: 1000,
        shippingFee: 0,
        total: 850,
        discountAmount: 150,
        couponCode: 'STACK10',
        coupon: C1.id,
        appliedCoupons: [
          { coupon: C1.id, couponCode: 'STACK10', discountAmount: 100 },
          { coupon: C2.id, couponCode: 'WELCOME50', discountAmount: 50 },
        ],
        shippingAddress: { recipientName: '測試', phone: '0912345678', city: '台北市', address: '測試路 1 號' },
        paymentMethod: 'cash_cod',
        paymentStatus: 'unpaid',
        status: 'pending',
      },
      overrideAccess: true,
    })
    const reds = await p.find({ collection: 'coupon-redemptions', where: { order: { equals: order.id } }, limit: 10, overrideAccess: true })
    check('G order → 2 coupon-redemptions (per-coupon)', reds.totalDocs === 2, `total=${reds.totalDocs}`)
    const c1 = await p.findByID({ collection: 'coupons', id: C1.id })
    const c2 = await p.findByID({ collection: 'coupons', id: C2.id })
    check('G C1 usageCount=1', c1.usageCount === 1, `=${c1.usageCount}`)
    check('G C2 usageCount=1', c2.usageCount === 1, `=${c2.usageCount}`)
  } catch (e) { check('G order-redemption suite', false, e instanceof Error ? e.message : String(e)) }

  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  process.stdout.write(`\n=== Batch 5 verify: ${passed} PASS / ${failed} FAIL (of ${results.length}) ===\n`)
  if (failed > 0) process.exitCode = 1
}

await main()
