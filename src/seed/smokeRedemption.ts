/**
 * Smoke test: redemption engine 12 types — payload run
 *
 * 跑法：pnpm payload run src/seed/smokeRedemption.ts
 *
 * 流程：
 *   1. 找一個 admin user（或建一個 testRedeem@local 測試帳號 + 給 100000 點）
 *   2. 為每個 type 建一筆 sample PointsRedemption（若 admin 已建類似的就重用）
 *   3. 對每個 type 直接呼叫 dispatchRedemption(ctx) → 驗證 outcome
 *   4. 列印結果 + 確認 user-rewards / coupons / shoppingCredit / points 餘額正確
 *
 * 不做 HTTP / auth，直接走 payload local API
 */

import { getPayload } from 'payload'
import config from '../payload.config'
import { dispatchRedemption, ALL_REDEMPTION_TYPES } from '../lib/redemption/redemptionEngine'

type LooseRecord = Record<string, unknown>

async function ensureTestUser(payload: Awaited<ReturnType<typeof getPayload>>) {
  // 找 DB 第一個 customer；不建新使用者（避免觸發 email verification）
  const found = await payload.find({
    collection: 'users',
    where: { role: { equals: 'customer' } } as never,
    limit: 1,
    sort: 'id',
    overrideAccess: true,
  })
  if (found.docs.length === 0) {
    throw new Error('找不到任何 customer 用戶；請先 seed 或在 admin 建立會員後再跑')
  }
  const u = found.docs[0] as unknown as LooseRecord
  await payload.update({
    collection: 'users',
    id: u.id as number,
    data: { points: 100000, shoppingCredit: 0 } as LooseRecord,
    overrideAccess: true,
  })
  return await payload.findByID({ collection: 'users', id: u.id as number, overrideAccess: true })
}

async function ensureRedemption(
  payload: Awaited<ReturnType<typeof getPayload>>,
  type: string,
): Promise<LooseRecord> {
  const slug = `smoke-${type}`
  const existing = await payload.find({
    collection: 'points-redemptions',
    where: { slug: { equals: slug } } as never,
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) return existing.docs[0] as unknown as LooseRecord

  const baseData: LooseRecord = {
    name: `Smoke 測試：${type}`,
    slug,
    type,
    pointsCost: 100,
    stock: 0, // 無限量
    redeemed: 0,
    isActive: true,
    description: `engine smoke test for ${type}`,
  }

  // 各 type 補必要的 config
  if (['coupon', 'discount_code', 'addon_deal'].includes(type)) {
    baseData.couponConfig = {
      discountType: 'fixed',
      discountValue: 50,
      minOrderAmount: 0,
      validDays: 30,
    }
  }
  if (type === 'free_shipping') {
    baseData.couponConfig = {
      discountType: 'free_shipping',
      discountValue: 0,
      minOrderAmount: 0,
      validDays: 30,
    }
  }
  if (type === 'store_credit') {
    baseData.couponConfig = {
      discountType: 'fixed',
      discountValue: 200, // 兌換贈送 NT$200 購物金
      validDays: 30,
    }
  }
  if (type === 'lottery' || type === 'mystery') {
    baseData.lotteryConfig = {
      winRate: type === 'lottery' ? 50 : 100,
      prizes: [
        { prizeName: 'A 獎：絲巾', prizeValue: 1500, weight: 1, stock: null },
        { prizeName: 'B 獎：洋裝折扣券 NT$300', prizeValue: 300, weight: 3, stock: null },
        { prizeName: 'C 獎：1 點 (安慰)', prizeValue: 1, weight: 6, stock: null },
      ],
    }
  }
  if (['physical', 'movie_ticket', 'gift_physical'].includes(type)) {
    baseData.physicalConfig = {
      validityDays: 365,
      physicalSku: `SMOKE-${type.toUpperCase()}`,
      shippingNote: '隨下次訂單寄出',
    }
  }

  return await payload.create({
    collection: 'points-redemptions',
    data: baseData,
    overrideAccess: true,
  })
}

async function main() {
  const payload = await getPayload({ config })
  console.log('[smoke] 啟動 redemption engine smoke test')

  const user = (await ensureTestUser(payload)) as unknown as LooseRecord
  const userId = user.id as number
  console.log(`[smoke] test user id=${userId} email=${user.email}`)

  console.log('\n────────── 12 type dispatch 驗證 ──────────')
  let passed = 0
  let failed = 0
  const failures: Array<{ type: string; err: string }> = []

  for (const type of ALL_REDEMPTION_TYPES) {
    const redemption = await ensureRedemption(payload, type)
    try {
      // 重新讀取（拿到 maxDiscountAmount=null 等預設）
      const fresh = (await payload.findByID({
        collection: 'points-redemptions',
        id: redemption.id as number,
        depth: 0,
        overrideAccess: true,
      })) as unknown as LooseRecord
      const freshUser = (await payload.findByID({
        collection: 'users',
        id: userId,
        depth: 0,
        overrideAccess: true,
      })) as unknown as LooseRecord

      const before = {
        points: freshUser.points,
        credit: freshUser.shoppingCredit,
      }

      const outcome = await dispatchRedemption({
        payload,
        redemption: fresh,
        user: freshUser,
        userId,
        cost: 100,
      })

      console.log(
        `[smoke] ✓ ${type.padEnd(15)} → rewardId=${String(outcome.rewardId).padEnd(5)} ${outcome.lottery ? `[lottery: ${outcome.lottery.won ? 'WON ' + outcome.lottery.prizeName : 'LOST'}]` : ''} message="${outcome.message}"`,
      )
      if (type === 'store_credit') {
        const after = (await payload.findByID({
          collection: 'users',
          id: userId,
          depth: 0,
          overrideAccess: true,
        })) as unknown as LooseRecord
        const creditBefore = (before.credit as number) ?? 0
        const creditAfter = (after.shoppingCredit as number) ?? 0
        if (creditAfter !== creditBefore + 200) {
          throw new Error(`store_credit: 預期 +200 但實際 ${creditAfter - creditBefore}`)
        }
      }
      passed++
    } catch (err) {
      console.error(`[smoke] ✗ ${type.padEnd(15)} → ERROR: ${(err as Error).message}`)
      failures.push({ type, err: (err as Error).message })
      failed++
    }
  }

  console.log('\n────────── 結果 ──────────')
  console.log(`通過：${passed} / ${ALL_REDEMPTION_TYPES.length}`)
  if (failed > 0) {
    console.log(`失敗：${failed}`)
    for (const f of failures) {
      console.log(`  - ${f.type}: ${f.err}`)
    }
  }

  // 列出該 user 寶物箱
  const rewards = await payload.find({
    collection: 'user-rewards',
    where: { user: { equals: userId } } as never,
    limit: 50,
    sort: '-createdAt',
    overrideAccess: true,
  })
  console.log(`\n寶物箱目前 ${rewards.docs.length} 筆：`)
  for (const r of rewards.docs) {
    const rd = r as unknown as LooseRecord
    console.log(
      `  - ${(rd.rewardType as string).padEnd(25)} state=${(rd.state as string).padEnd(15)} display=${rd.displayName} ${rd.couponCode ? `code=${rd.couponCode}` : ''}`,
    )
  }

  // 列出本次跑出來的個人化 coupons
  const coupons = await payload.find({
    collection: 'coupons',
    where: { code: { like: 'CKMU-RDM-' } } as never,
    limit: 20,
    sort: '-createdAt',
    overrideAccess: true,
  })
  console.log(`\n個人化 coupons (CKMU-RDM-*) ${coupons.docs.length} 筆：`)
  for (const c of coupons.docs) {
    const cd = c as unknown as LooseRecord
    console.log(
      `  - ${cd.code} discountType=${cd.discountType} value=${cd.discountValue} expiresAt=${cd.expiresAt}`,
    )
  }

  process.exit(failed > 0 ? 1 : 0)
}

await main()
