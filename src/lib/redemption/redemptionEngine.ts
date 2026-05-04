/**
 * 點數兌換 Engine
 * ────────────────────────────────────────
 * 把 12 種兌換類型統一在這裡處理。
 *
 * 共用流程（POST /api/v1/points 已先處理）：
 *   1. Auth + 找 redemption + user
 *   2. 驗證 active / 時間窗 / 庫存 / 點數 / 等級 / maxPerUser / maxPerDay
 *   3. bump points-redemptions.redeemed
 *   4. 扣 user.points
 *   5. 寫 points-transactions audit 行
 *   6. ★ dispatch 到本檔對應 handler — 各 type 自行：
 *        - 建 user-rewards 記錄（如果產生實體 / 電子券）
 *        - 加 user.shoppingCredit（store_credit）
 *        - 跑抽獎演算法（lottery / mystery）
 *        - 產生 Coupons row（coupon / discount_code / free_shipping / addon_deal）
 *   7. 失敗時 caller 走 best-effort revert
 *
 * 12 種類型對應路徑：
 *   - physical / movie_ticket / gift_physical → 寫 user-rewards 隨單寄
 *   - coupon / discount_code / addon_deal → 自動產生個人化 Coupons row + user-rewards
 *   - free_shipping → 同上但 discountType='free_shipping'
 *   - store_credit → 加 user.shoppingCredit；不寫 user-rewards（餘額直接生效）
 *   - lottery → 依 winRate% 擲骰；中 → 加權抽 prize 寫 voucher；未中 → 只扣點
 *   - mystery → 一定中，直接加權抽 prize 寫 voucher
 *   - experience / styling / charity → 寫 voucher 由客服 / admin 手動聯絡
 */

import type { Payload } from 'payload'

export type RedemptionType =
  | 'physical'
  | 'movie_ticket'
  | 'gift_physical'
  | 'coupon'
  | 'discount_code'
  | 'addon_deal'
  | 'free_shipping'
  | 'store_credit'
  | 'lottery'
  | 'mystery'
  | 'experience'
  | 'styling'
  | 'charity'

type LooseRecord = Record<string, unknown>

export interface RedemptionContext {
  payload: Payload
  redemption: LooseRecord
  user: LooseRecord
  userId: string | number
  cost: number
}

export interface RedemptionOutcome {
  /** user-rewards.id 若該 type 有建 reward；否則 null */
  rewardId: string | number | null
  /** 顯示給使用者的成功訊息 */
  message: string
  /** 抽獎類型回傳，UI 根據 won 顯示動畫；其他類型 undefined */
  lottery?: {
    won: boolean
    prizeName?: string
    prizeValue?: number | null
  }
  /** 給 PointsTransactions.description 用，覆蓋預設 */
  transactionDescription?: string
  /** 額外 metadata（前端可選擇展示） */
  details?: LooseRecord
}

const SHIPPABLE_TYPES = new Set<RedemptionType>(['physical', 'movie_ticket', 'gift_physical'])
const COUPON_LIKE_TYPES = new Set<RedemptionType>([
  'coupon',
  'discount_code',
  'free_shipping',
  'addon_deal',
])
const VOUCHER_TYPES = new Set<RedemptionType>(['experience', 'styling', 'charity'])

// 對應 PointsRedemptions.type select 列舉（gift_physical 不是合法 redemption type，
// 而是 UserRewards.rewardType 的選項，由 physicalConfig.rewardTypeOverride 寫入）。
export const ALL_REDEMPTION_TYPES: RedemptionType[] = [
  'physical',
  'movie_ticket',
  'coupon',
  'discount_code',
  'addon_deal',
  'free_shipping',
  'store_credit',
  'lottery',
  'mystery',
  'experience',
  'styling',
  'charity',
]

export function isSupportedRedemptionType(t: unknown): t is RedemptionType {
  return typeof t === 'string' && (ALL_REDEMPTION_TYPES as string[]).includes(t)
}

/** 對應 type → user-rewards.rewardType */
function rewardTypeFor(t: RedemptionType, redemption: LooseRecord): string {
  if (t === 'free_shipping') return 'free_shipping_coupon'
  if (t === 'movie_ticket') {
    const physicalConfig = (redemption.physicalConfig as LooseRecord | undefined) ?? {}
    return (physicalConfig.rewardTypeOverride as string) || 'movie_ticket_physical'
  }
  if (SHIPPABLE_TYPES.has(t)) {
    const physicalConfig = (redemption.physicalConfig as LooseRecord | undefined) ?? {}
    return (physicalConfig.rewardTypeOverride as string) || 'gift_physical'
  }
  // coupon/discount_code/addon_deal → 'coupon'
  // lottery/mystery/experience/styling/charity → 'voucher'
  if (COUPON_LIKE_TYPES.has(t)) return 'coupon'
  return 'voucher'
}

/* ─── 共用 utils ──────────────────────────────────────────────── */

function pickId(val: unknown): string | number | null {
  if (val == null) return null
  if (typeof val === 'string' || typeof val === 'number') return val
  if (typeof val === 'object') {
    const id = (val as LooseRecord).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

function asNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function asString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return fallback
}

function expiresAtIso(daysFromNow: number): string {
  const ms = Date.now() + Math.max(1, daysFromNow) * 24 * 60 * 60 * 1000
  return new Date(ms).toISOString()
}

/** 產生個人化的 coupon code，避免衝突 */
function genCouponCode(redemptionId: string | number, userId: string | number): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  const r = String(redemptionId).slice(-4)
  const u = String(userId).slice(-4)
  return `CKMU-RDM-${u}-${r}-${ts}${rand}`.slice(0, 40)
}

/** 加權抽 prize；剔除 stock=0 的；若 prizes 為空回 null */
function pickWeightedPrize(
  prizes: Array<LooseRecord>,
): { idx: number; prize: LooseRecord } | null {
  const eligible: Array<{ idx: number; prize: LooseRecord; weight: number }> = []
  for (let i = 0; i < prizes.length; i++) {
    const p = prizes[i] as LooseRecord
    const stock = asNum(p.stock, 0)
    if (stock === 0 && p.stock !== undefined && p.stock !== null && p.stock !== 0) {
      // 已扣到 0 而欄位有值表示有限量；跳過
      continue
    }
    if (asNum(p.stock, -1) === 0 && p.stock !== undefined) {
      // stock 設成 0（已抽完）→ 跳過；stock=undefined / null 才當無限量
    }
    const weight = Math.max(0, asNum(p.weight, 1))
    if (weight <= 0) continue
    eligible.push({ idx: i, prize: p, weight })
  }
  if (eligible.length === 0) return null
  const totalWeight = eligible.reduce((s, e) => s + e.weight, 0)
  let r = Math.random() * totalWeight
  for (const e of eligible) {
    r -= e.weight
    if (r <= 0) return { idx: e.idx, prize: e.prize }
  }
  // 浮點 fallback
  return { idx: eligible[eligible.length - 1].idx, prize: eligible[eligible.length - 1].prize }
}

/* ─── handlers ───────────────────────────────────────────────── */

async function redeemPhysical(ctx: RedemptionContext): Promise<RedemptionOutcome> {
  const { payload, redemption, userId, cost } = ctx
  const physicalConfig = (redemption.physicalConfig as LooseRecord | undefined) ?? {}
  const validityDays = asNum(physicalConfig.validityDays, 365)
  const sku = asString(physicalConfig.physicalSku)
  const shippingNote = asString(physicalConfig.shippingNote)
  const linkedProductId = pickId(physicalConfig.linkedProduct)

  const instructionsParts: string[] = []
  if (sku) instructionsParts.push(`SKU：${sku}`)
  if (linkedProductId) instructionsParts.push(`商品 ID：${linkedProductId}`)
  if (shippingNote) instructionsParts.push(shippingNote)
  const redemptionInstructions = instructionsParts.join('\n') || null

  const created = await payload.create({
    collection: 'user-rewards',
    data: {
      user: userId,
      rewardType: rewardTypeFor(redemption.type as RedemptionType, redemption),
      displayName: asString(redemption.name, '點數商城獎品'),
      state: 'unused',
      requiresPhysicalShipping: true,
      expiresAt: expiresAtIso(validityDays),
      redemptionRef: redemption.id,
      pointsCostSnapshot: cost,
      ...(redemptionInstructions ? { redemptionInstructions } : {}),
    } as LooseRecord,
    overrideAccess: true,
  })

  return {
    rewardId: pickId(created),
    message: '兌換成功！獎品將隨您的下一張訂單寄出',
  }
}

async function redeemCoupon(ctx: RedemptionContext): Promise<RedemptionOutcome> {
  const { payload, redemption, userId, cost } = ctx
  const type = redemption.type as RedemptionType
  const couponConfig = (redemption.couponConfig as LooseRecord | undefined) ?? {}

  // 支援欄位 fallback：
  //   - free_shipping 預設 discountType=free_shipping、discountValue=0
  //   - 其餘預設 percentage 10%
  const discountType: 'percentage' | 'fixed' | 'free_shipping' =
    type === 'free_shipping'
      ? 'free_shipping'
      : (asString(couponConfig.discountType, 'percentage') as 'percentage' | 'fixed' | 'free_shipping')
  const discountValue =
    type === 'free_shipping' ? 0 : asNum(couponConfig.discountValue, 0)
  const minOrderAmount = asNum(couponConfig.minOrderAmount, 0)
  const validDays = asNum(couponConfig.validDays, 30)

  const code = genCouponCode(redemption.id as string | number, userId)
  const couponName = `兌換贈券：${asString(redemption.name, '點數商城優惠券')}`

  // (1) 寫 Coupons 表 — checkout 用 code 套
  await payload.create({
    collection: 'coupons',
    data: {
      code,
      name: couponName,
      description: `來源：點數兌換。對象會員 ID：${userId}。`,
      discountType,
      discountValue,
      ...(asNum(couponConfig.maxDiscountAmount, 0) > 0
        ? { maxDiscountAmount: asNum(couponConfig.maxDiscountAmount) }
        : {}),
      minOrderAmount,
      usageLimit: 1,
      usageLimitPerUser: 1,
      expiresAt: expiresAtIso(validDays),
      isActive: true,
    } as LooseRecord,
    overrideAccess: true,
  })

  // (2) 寫 UserRewards 寶物箱
  const valueLabel =
    discountType === 'percentage'
      ? `${discountValue}% 折`
      : discountType === 'fixed'
        ? `NT$ ${discountValue.toLocaleString()} 折抵`
        : '免運券'
  const minLabel = minOrderAmount > 0 ? `（滿 NT$ ${minOrderAmount.toLocaleString()} 可用）` : ''
  const instructions = `結帳時於優惠券欄位輸入代碼 ${code}\n${valueLabel}${minLabel}\n效期 ${validDays} 天，使用 1 次後失效。`

  const reward = await payload.create({
    collection: 'user-rewards',
    data: {
      user: userId,
      rewardType: rewardTypeFor(type, redemption),
      displayName: asString(redemption.name, '兌換贈券'),
      amount: discountValue,
      couponCode: code,
      state: 'unused',
      requiresPhysicalShipping: false,
      expiresAt: expiresAtIso(validDays),
      redemptionRef: redemption.id,
      pointsCostSnapshot: cost,
      redemptionInstructions: instructions,
    } as LooseRecord,
    overrideAccess: true,
  })

  return {
    rewardId: pickId(reward),
    message: `兌換成功！${valueLabel} 已存入寶物箱`,
    details: { couponCode: code, discountType, discountValue, expiresAt: expiresAtIso(validDays) },
  }
}

async function redeemStoreCredit(ctx: RedemptionContext): Promise<RedemptionOutcome> {
  const { payload, redemption, user, userId } = ctx
  const couponConfig = (redemption.couponConfig as LooseRecord | undefined) ?? {}
  // 購物金面額：優先 couponConfig.discountValue（admin 在 store_credit 時把此值當「贈送多少元」）
  const creditAmount = asNum(couponConfig.discountValue, 0)

  if (creditAmount <= 0) {
    throw new Error('購物金面額未設定，請聯絡客服或洽 admin 設定 couponConfig.discountValue')
  }

  const currentCredit = asNum(user.shoppingCredit, 0)
  await payload.update({
    collection: 'users',
    id: userId,
    data: { shoppingCredit: currentCredit + creditAmount } as LooseRecord,
    overrideAccess: true,
  })

  // 寶物箱也建一筆 audit voucher，方便會員追溯來源；state=consumed（餘額已生效）
  let rewardId: string | number | null = null
  try {
    const reward = await payload.create({
      collection: 'user-rewards',
      data: {
        user: userId,
        rewardType: 'voucher',
        displayName: `購物金 NT$ ${creditAmount.toLocaleString()}（兌換已存入）`,
        amount: creditAmount,
        state: 'consumed',
        consumedAt: new Date().toISOString(),
        requiresPhysicalShipping: false,
        // 永不過期：寫 30 年後（user.shoppingCredit 本身不會過期）
        expiresAt: expiresAtIso(365 * 30),
        redemptionRef: redemption.id,
        pointsCostSnapshot: ctx.cost,
        redemptionInstructions: `已存入您的購物金餘額（NT$ ${creditAmount.toLocaleString()}）。\n結帳時可直接抵扣訂單金額；購物金永不過期。`,
      } as LooseRecord,
      overrideAccess: true,
    })
    rewardId = pickId(reward)
  } catch {
    // voucher audit 失敗不影響主流程（user.shoppingCredit 已加）；admin 可手動補
  }

  return {
    rewardId,
    message: `兌換成功！NT$ ${creditAmount.toLocaleString()} 購物金已存入您的帳戶`,
    transactionDescription: `兌換購物金 NT$ ${creditAmount.toLocaleString()}：${asString(redemption.name)}`,
    details: { creditAdded: creditAmount, newBalance: currentCredit + creditAmount },
  }
}

async function redeemLotteryOrMystery(
  ctx: RedemptionContext,
  alwaysWin: boolean,
): Promise<RedemptionOutcome> {
  const { payload, redemption, userId, cost } = ctx
  const lotteryConfig = (redemption.lotteryConfig as LooseRecord | undefined) ?? {}
  const winRate = Math.max(0, Math.min(100, asNum(lotteryConfig.winRate, alwaysWin ? 100 : 10)))
  const prizes = Array.isArray(lotteryConfig.prizes)
    ? (lotteryConfig.prizes as Array<LooseRecord>)
    : []

  // mystery 視為 winRate=100；lottery 看 admin 設定
  const rolled = Math.random() * 100
  const won = alwaysWin ? prizes.length > 0 : rolled < winRate && prizes.length > 0

  if (!won) {
    return {
      rewardId: null,
      message: '本次未中獎，下次再接再厲！',
      lottery: { won: false },
      transactionDescription: `抽獎未中獎：${asString(redemption.name)}`,
    }
  }

  const picked = pickWeightedPrize(prizes)
  if (!picked) {
    // 應該不會走到（won=true 已 implies prizes.length > 0 + 有 weight）
    return {
      rewardId: null,
      message: '抽獎執行中，請稍後查詢寶物箱',
      lottery: { won: false },
      transactionDescription: `抽獎異常：${asString(redemption.name)}`,
    }
  }

  const prize = picked.prize
  const prizeName = asString(prize.prizeName, '神秘獎品')
  const prizeValue = asNum(prize.prizeValue, 0)

  // 若 prize 有 stock 限制，扣 1
  // SQLite 單寫者；race window 極小（admin 抽獎不會大流量）
  if (prize.stock !== undefined && prize.stock !== null) {
    const currentStock = asNum(prize.stock, 0)
    if (currentStock > 0) {
      const newPrizes = prizes.map((p, i) =>
        i === picked.idx ? { ...p, stock: currentStock - 1 } : p,
      )
      try {
        await payload.update({
          collection: 'points-redemptions',
          id: redemption.id as string | number,
          data: { lotteryConfig: { ...lotteryConfig, prizes: newPrizes } } as LooseRecord,
          overrideAccess: true,
        })
      } catch {
        // 抽中但 stock 寫回失敗 → 仍給獎，admin 可手動清；保使用者體驗
      }
    }
  }

  // 建 voucher reward
  const validityDays = 60 // 抽獎獎品預設 60 天兌換
  const reward = await payload.create({
    collection: 'user-rewards',
    data: {
      user: userId,
      rewardType: 'voucher',
      displayName: `${alwaysWin ? '神秘禮物' : '抽獎'}：${prizeName}`,
      amount: prizeValue || null,
      state: 'unused',
      requiresPhysicalShipping: false,
      expiresAt: expiresAtIso(validityDays),
      redemptionRef: redemption.id,
      pointsCostSnapshot: cost,
      redemptionInstructions: `恭喜抽中：${prizeName}${prizeValue > 0 ? `（價值 NT$ ${prizeValue.toLocaleString()}）` : ''}\n客服將於 3 個工作天內主動聯繫您安排兌換 / 出貨。\n如有問題請於 ${validityDays} 天內聯絡客服。`,
    } as LooseRecord,
    overrideAccess: true,
  })

  return {
    rewardId: pickId(reward),
    message: alwaysWin ? `恭喜！抽到「${prizeName}」` : `中獎了！「${prizeName}」`,
    lottery: { won: true, prizeName, prizeValue: prizeValue || null },
    transactionDescription: `抽獎中獎「${prizeName}」：${asString(redemption.name)}`,
    details: { prizeName, prizeValue, validityDays },
  }
}

async function redeemVoucher(ctx: RedemptionContext): Promise<RedemptionOutcome> {
  const { payload, redemption, userId, cost } = ctx
  // experience / styling / charity — 客服 / admin 手動聯絡履行
  const description = asString(redemption.description) || asString(redemption.name)
  const validityDays = 90

  const typeLabel: Record<string, string> = {
    experience: '體驗活動',
    styling: 'VIP 造型諮詢',
    charity: '公益捐贈',
  }
  const label = typeLabel[asString(redemption.type)] ?? '專屬服務'

  const reward = await payload.create({
    collection: 'user-rewards',
    data: {
      user: userId,
      rewardType: 'voucher',
      displayName: `${label}：${asString(redemption.name)}`,
      state: 'unused',
      requiresPhysicalShipping: false,
      expiresAt: expiresAtIso(validityDays),
      redemptionRef: redemption.id,
      pointsCostSnapshot: cost,
      redemptionInstructions: `兌換成功！${description}\n客服將於 3 個工作天內主動聯繫您確認時間 / 安排細節。\n${validityDays} 天內未聯繫請主動聯絡客服。`,
    } as LooseRecord,
    overrideAccess: true,
  })

  return {
    rewardId: pickId(reward),
    message: `${label}兌換成功！客服將於 3 個工作天內聯繫您`,
  }
}

/* ─── public dispatch ─────────────────────────────────────────── */

export async function dispatchRedemption(ctx: RedemptionContext): Promise<RedemptionOutcome> {
  const type = asString(ctx.redemption.type) as RedemptionType

  if (SHIPPABLE_TYPES.has(type)) {
    return redeemPhysical(ctx)
  }
  if (COUPON_LIKE_TYPES.has(type)) {
    return redeemCoupon(ctx)
  }
  if (type === 'store_credit') {
    return redeemStoreCredit(ctx)
  }
  if (type === 'lottery') {
    return redeemLotteryOrMystery(ctx, false)
  }
  if (type === 'mystery') {
    return redeemLotteryOrMystery(ctx, true)
  }
  if (VOUCHER_TYPES.has(type)) {
    return redeemVoucher(ctx)
  }
  throw new Error(`不支援的兌換類型：${type}`)
}
