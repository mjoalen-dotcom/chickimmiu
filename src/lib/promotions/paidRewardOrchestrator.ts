/**
 * Paid Reward Orchestrator — 付款成功後的獎勵落地（CHIC Commerce OS P0-B）
 * ──────────────────────────────────────────────────────────────────────
 * 為什麼獨立於 rewardOrchestrator：
 *
 * 1. **抽獎絕對不能放進 evaluator**。evaluator 的第一條不變量就是「純函式、
 *    無 I/O、無 Date.now、無隨機」——這是報價可重現、可稽核的基礎。所以
 *    evaluator 只吐 intent，真正的抽獎在這裡、在付款成功之後（Alan 需求 1）。
 *
 * 2. **冪等鍵不能沿用 rewardOrchestrator 的判重法**。那邊用
 *    「attachedToOrder + displayName」find-then-create，兩個問題：
 *      (a) Mystery Gift 每次抽出來的 displayName 都不同，判重必然失效；
 *      (b) find-then-create 本身不是原子的。
 *    這裡改用 promotion-drop-claims.idempotencyKey 的 UNIQUE index。
 *
 * 3. **兩個踩過的坑必須在這裡踩對**：
 *      (a) UserRewards.expiresAt 是 required 且無 defaultValue、無 beforeChange
 *          補值。漏傳 → ValidationError → 被自家 catch 吞掉 → granted 永遠 0，
 *          外面看起來一切正常。這條路徑從上線起一次都沒成功過（2026-08-17 實測）。
 *      (b) UserRewards.requiresPhysicalShipping 的 defaultValue 是 **true**，
 *          而 Orders 的 beforeChange 會把 unused + requiresPhysicalShipping=true
 *          的獎自動塞進顧客下一張訂單當實體贈品寄出。電子券被當實體包裹寄，
 *          是會真的發生的災難 —— 所以每一次 create 都必須**明設**這一欄。
 */
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-sqlite'

import {
  atomicDecrementPoolInventory,
  drawPrize,
  type DrawnPrize,
} from '../games/gameEngine'
import { estimatePrizeValueTwd } from '../games/abuseDetection'
import { recordWalletTxn } from '../wallet/server'
import { affectedRows, runSql } from '../db/dialectSafeSql'
import { MYSTERY_GIFT_POOL_TAG } from './types'
import type { RewardIntent } from './types'

/** 抽不到限量獎時最多重抽幾次，之後一律走保底獎 */
const MAX_DRAW_ATTEMPTS = 5
/** 獎項預設效期（天）；PrizePools.expiryDays 有值時優先用它，與 MiniGameRecords 對齊 */
const DEFAULT_EXPIRY_DAYS = 365

export interface SettleResult {
  granted: number
  skipped: number
  failed: number
  /** campaignId(string) → 實際成本 − 下單時預留成本（正數＝要補扣、負數＝要退回） */
  costDelta: Map<string, number>
}

type LooseRecord = Record<string, unknown>

function relId(v: unknown): number | string | null {
  if (v == null) return null
  if (typeof v === 'number' || typeof v === 'string') return v
  const id = (v as LooseRecord).id
  return typeof id === 'number' || typeof id === 'string' ? id : null
}

function expiresAtIso(days: number): string {
  return new Date(Date.now() + Math.max(1, days) * 86_400_000).toISOString()
}

/**
 * PrizePools.prizeType → UserRewards.rewardType。
 *
 * 這份對照表 MiniGameRecords 已經有一份。抽成共用函式而不是複製第三份 ——
 * 兩份不同步的對照表遲早會讓同一個獎在遊戲與訂單兩條路徑落地成不同型別。
 */
export function prizeTypeToRewardType(
  prizeType: string,
  deliveryMethod?: string,
): string | null {
  const isPhysical = deliveryMethod === 'physical_shipping'
  const map: Record<string, string> = {
    coupon: 'coupon',
    badge: 'badge',
    movie_ticket: isPhysical ? 'movie_ticket_physical' : 'movie_ticket_digital',
    free_shipping: 'free_shipping_coupon',
    physical_gift: 'gift_physical',
  }
  return map[prizeType] ?? null
}

/** 獎項是否需要實體出貨。與 MiniGameRecords 的判定保持一致。 */
function needsPhysicalShipping(rewardType: string, deliveryMethod?: string): boolean {
  return (
    deliveryMethod === 'physical_shipping' ||
    rewardType === 'gift_physical' ||
    rewardType === 'movie_ticket_physical'
  )
}

/**
 * 獎項價值（NT$）。優先序刻意與 /games/terms 機率公示頁一致 ——
 * 對外揭露的價值與內部扣活動預算的價值必須是同一個數字。
 */
function prizeValueTwd(prize: DrawnPrize): number {
  if (typeof prize.estimatedValue === 'number' && prize.estimatedValue > 0) {
    return prize.estimatedValue
  }
  return estimatePrizeValueTwd(prize.type, prize.amount || 0)
}

/** 產生一次性券碼（沿用 redemptionEngine 的形狀，換前綴以便對帳分辨來源） */
function genDropCouponCode(orderId: number | string, userId: number | string): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `CKMU-DROP-${String(orderId).slice(-4)}-${String(userId).slice(-4)}-${ts}${rand}`.slice(0, 40)
}

/**
 * 建一筆 UserRewards。
 *
 * expiresAt 與 requiresPhysicalShipping 兩欄一律明設，理由見檔頭第 3 點。
 */
async function grantUserReward(
  payload: Payload,
  args: {
    userId: number | string
    orderId: number | string
    rewardType: string
    displayName: string
    amount: number | null
    expiryDays: number
    deliveryMethod?: string
    couponCode?: string
    redemptionInstructions?: string
  },
): Promise<number | string | null> {
  const doc = await payload.create({
    collection: 'user-rewards',
    data: {
      user: args.userId,
      rewardType: args.rewardType,
      displayName: args.displayName,
      amount: args.amount,
      state: 'unused',
      attachedToOrder: args.orderId,
      expiresAt: expiresAtIso(args.expiryDays),
      requiresPhysicalShipping: needsPhysicalShipping(args.rewardType, args.deliveryMethod),
      ...(args.couponCode ? { couponCode: args.couponCode } : {}),
      ...(args.redemptionInstructions
        ? { redemptionInstructions: args.redemptionInstructions }
        : {}),
    } as never,
    overrideAccess: true,
  })
  return relId(doc)
}

/**
 * points / credit 型獎品不進寶物箱，直接入帳。
 * 與 MiniGameRecords 的既有語意一致（寶物箱只放「要去兌換／出貨」的東西）。
 *
 * 刻意不整包複用 gameEngine.recordGamePlay：那支會同時建一筆 mini-game-record，
 * 訂單發獎不是玩遊戲，混進遊戲紀錄會汙染遊戲的次數統計與風控。
 */
async function creditPrizeToWallet(
  payload: Payload,
  args: { userId: number | string; prize: DrawnPrize; description: string },
): Promise<void> {
  const amount = Math.max(0, Math.floor(args.prize.amount || 0))
  if (amount <= 0) return

  const user = (await payload.findByID({
    collection: 'customers',
    id: args.userId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as LooseRecord

  if (args.prize.type === 'points') {
    const balance = (Number(user.points) || 0) + amount
    await payload.update({
      collection: 'customers',
      id: args.userId,
      data: { points: balance } as never,
      overrideAccess: true,
    })
    await payload.create({
      collection: 'points-transactions',
      data: {
        user: args.userId,
        amount,
        type: 'earn',
        source: 'campaign',
        description: args.description,
        balance,
      } as never,
      overrideAccess: true,
    })
    return
  }

  if (args.prize.type === 'credit') {
    const balance = (Number(user.shoppingCredit) || 0) + amount
    await payload.update({
      collection: 'customers',
      id: args.userId,
      data: { shoppingCredit: balance } as never,
      overrideAccess: true,
    })
    await recordWalletTxn(payload, {
      userId: args.userId,
      wallet: 'shoppingCredit',
      amount,
      type: 'earn',
      source: 'campaign',
      description: args.description,
      balanceOverride: balance,
    })
  }
}

/**
 * 抽出一個**保證有獎**的獎品。
 *
 * 流程：正常抽 → 限量獎就原子扣庫存 → 扣不到（被搶完）就把該獎排除重抽 →
 * 重抽 MAX_DRAW_ATTEMPTS 次仍失敗 → 走 fallbackPoolSlug 的保底獎。
 * 保底獎在 PromotionRules.beforeValidate 已強制必須 inventoryUnlimited=true，
 * 所以最後這條路必定成功。**任何路徑都不得回傳 null**（Alan 需求 2）。
 */
async function drawGuaranteedPrize(
  payload: Payload,
  args: {
    tierSlug: string
    creditScore: number
    excludePrizeTypes: string[]
    fallbackPoolSlug?: string
  },
): Promise<{ prize: DrawnPrize; usedFallback: boolean; attempts: number } | null> {
  const excludePoolIds: number[] = []

  for (let attempt = 1; attempt <= MAX_DRAW_ATTEMPTS; attempt++) {
    const prize = await drawPrize(MYSTERY_GIFT_POOL_TAG, args.tierSlug, args.creditScore, {
      excludePrizeTypes: args.excludePrizeTypes,
      excludePoolIds,
    })
    if (!prize) break

    // 無限量獎：直接成立
    if (prize.inventoryUnlimited !== false || prize.sourcePoolId == null) {
      return { prize, usedFallback: false, attempts: attempt }
    }
    // 限量獎：必須原子扣到才算搶到
    const got = await atomicDecrementPoolInventory(payload, prize.sourcePoolId)
    if (got) return { prize, usedFallback: false, attempts: attempt }
    excludePoolIds.push(prize.sourcePoolId)
  }

  // 保底：limited 獎全被搶完
  if (!args.fallbackPoolSlug) return null
  const res = await payload.find({
    collection: 'prize-pools' as never,
    where: { slug: { equals: args.fallbackPoolSlug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const d = res.docs?.[0] as LooseRecord | undefined
  if (!d) return null
  return {
    prize: {
      prize: String(d.name || '神秘禮物'),
      type: String(d.prizeType || 'none') as DrawnPrize['type'],
      amount: Number(d.amount || 0),
      sourcePoolId: Number(d.id),
      deliveryMethod: d.deliveryMethod as DrawnPrize['deliveryMethod'],
      expiryDays: typeof d.expiryDays === 'number' ? d.expiryDays : undefined,
      couponCode: typeof d.couponCode === 'string' ? d.couponCode : undefined,
      estimatedValue: typeof d.estimatedValue === 'number' ? d.estimatedValue : undefined,
      inventoryUnlimited: d.inventoryUnlimited === true,
      redemptionInstructions:
        typeof d.redemptionInstructions === 'string' ? d.redemptionInstructions : undefined,
    },
    usedFallback: true,
    attempts: MAX_DRAW_ATTEMPTS,
  }
}

/**
 * 付款成功後落地 coupon_drop / mystery_gift 兩種 intent。
 *
 * 契約與 grantIntentRewards 一致：全程不拋出，回傳統計。發獎失敗不該讓
 * 付款流程炸掉，但**必須留下可查的痕跡**（claim 停在 reserved + notes）。
 */
export async function settlePaidPromotionRewards(
  payload: Payload,
  args: {
    userId: number | string
    orderId: number | string
    orderNumber?: string
    tierSlug?: string
    creditScore?: number
    intents: RewardIntent[]
  },
): Promise<SettleResult> {
  const result: SettleResult = { granted: 0, skipped: 0, failed: 0, costDelta: new Map() }
  const tierSlug = args.tierSlug || 'ordinary'
  const creditScore = Number.isFinite(args.creditScore) ? Number(args.creditScore) : 100

  for (const intent of args.intents) {
    if (intent.type !== 'coupon_drop' && intent.type !== 'mystery_gift') continue

    const claimKey = intent.claimKey || intent.ruleKey
    const idempotencyKey = `${claimKey}:u${args.userId}`

    try {
      // 第二層冪等（第一層是 Orders 的 paymentStatus !== 'paid' 閘門）。
      // 下單時已建 reserved claim；付款 callback 重送時這裡會看到 granted 直接跳過。
      const found = await payload.find({
        collection: 'promotion-drop-claims' as never,
        where: { idempotencyKey: { equals: idempotencyKey } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const claim = found.docs?.[0] as LooseRecord | undefined
      if (!claim) {
        // 下單時沒建成 claim（訪客／預留失敗）→ 不補發，也不算失敗
        result.skipped += 1
        continue
      }
      if (claim.status === 'granted' || claim.status === 'reversed') {
        result.skipped += 1
        continue
      }

      const reservedCost = Number(claim.budgetCostAmount) || 0
      const campaignKey = intent.campaignId != null ? String(intent.campaignId) : null

      if (intent.type === 'mystery_gift') {
        const drawn = await drawGuaranteedPrize(payload, {
          tierSlug,
          creditScore,
          excludePrizeTypes: intent.excludePrizeTypes ?? ['none'],
          fallbackPoolSlug: intent.fallbackPoolSlug,
        })
        if (!drawn) {
          // 保底獎也撈不到 = 設定錯誤。不硬發一個假獎，留 claim 在 reserved 讓人工補。
          result.failed += 1
          await payload.update({
            collection: 'promotion-drop-claims' as never,
            id: claim.id as number,
            data: {
              notes: '抽獎失敗：獎池全空且保底獎撈不到，需人工補發',
            } as never,
            overrideAccess: true,
          })
          continue
        }

        const { prize, usedFallback, attempts } = drawn
        const actualCost = prizeValueTwd(prize)
        const expiryDays = prize.expiryDays ?? DEFAULT_EXPIRY_DAYS
        let grantedRewardId: number | string | null = null

        if (prize.type === 'points' || prize.type === 'credit') {
          await creditPrizeToWallet(payload, {
            userId: args.userId,
            prize,
            description: `神秘禮物（訂單 ${args.orderNumber ?? args.orderId}）：${prize.prize}`,
          })
        } else {
          const rewardType = prizeTypeToRewardType(prize.type, prize.deliveryMethod) ?? 'voucher'
          grantedRewardId = await grantUserReward(payload, {
            userId: args.userId,
            orderId: args.orderId,
            rewardType,
            displayName: `神秘禮物：${prize.prize}`,
            amount: prize.amount || null,
            expiryDays,
            deliveryMethod: prize.deliveryMethod,
            couponCode: prize.couponCode,
            redemptionInstructions:
              prize.redemptionInstructions ||
              `恭喜獲得「${prize.prize}」${actualCost > 0 ? `（價值 NT$ ${actualCost.toLocaleString()}）` : ''}\n請於 ${expiryDays} 天內使用；如有問題請聯絡客服。`,
          })
        }

        await payload.update({
          collection: 'promotion-drop-claims' as never,
          id: claim.id as number,
          data: {
            status: 'granted',
            grantedAt: new Date().toISOString(),
            budgetCostAmount: actualCost,
            ...(prize.sourcePoolId != null ? { prizePool: prize.sourcePoolId } : {}),
            ...(grantedRewardId != null ? { grantedReward: grantedRewardId } : {}),
            notes: `抽獎 ${attempts} 次${usedFallback ? '，限量獎已搶完，發保底獎' : ''}`,
          } as never,
          overrideAccess: true,
        })

        if (campaignKey) {
          result.costDelta.set(
            campaignKey,
            (result.costDelta.get(campaignKey) ?? 0) + (actualCost - reservedCost),
          )
        }
        result.granted += 1
        continue
      }

      // ── coupon_drop ────────────────────────────────────────────────────
      const templateId = intent.couponId
      if (templateId == null) {
        result.failed += 1
        continue
      }
      const template = (await payload.findByID({
        collection: 'coupons',
        id: templateId as number,
        depth: 0,
        overrideAccess: true,
      })) as unknown as LooseRecord

      const code = genDropCouponCode(args.orderId, args.userId)
      const discountType = String(template.discountType ?? 'fixed')
      const discountValue = Number(template.discountValue) || 0
      const maxDiscountAmount = Number(template.maxDiscountAmount)
      const validDays = Number(template.validDays) || 30

      const created = await payload.create({
        collection: 'coupons',
        data: {
          code,
          name: `活動限量券：${String(template.name ?? '優惠券')}`,
          description: `來源：限量券包活動（訂單 ${args.orderNumber ?? args.orderId}）。對象會員 ID：${args.userId}。`,
          discountType,
          discountValue,
          ...(Number.isFinite(maxDiscountAmount) && maxDiscountAmount > 0
            ? { maxDiscountAmount }
            : {}),
          minOrderAmount: Number(template.minOrderAmount) || 0,
          // 一次性、綁單人：券碼本身仍是先搶先贏，真正的「屬於誰」靠下面的 UserRewards
          usageLimit: 1,
          usageLimitPerUser: 1,
          expiresAt: expiresAtIso(validDays),
          isActive: true,
        } as never,
        overrideAccess: true,
      })
      const couponId = relId(created)

      const valueLabel =
        discountType === 'percentage'
          ? `${discountValue}% 折`
          : discountType === 'free_shipping'
            ? '免運'
            : `NT$ ${discountValue.toLocaleString()} 折抵`
      const grantedRewardId = await grantUserReward(payload, {
        userId: args.userId,
        orderId: args.orderId,
        rewardType: discountType === 'free_shipping' ? 'free_shipping_coupon' : 'coupon',
        displayName: `活動限量券：${valueLabel}`,
        amount: discountValue,
        expiryDays: validDays,
        couponCode: code,
        redemptionInstructions: `結帳時於優惠券欄位輸入代碼 ${code}\n${valueLabel}\n效期 ${validDays} 天，使用 1 次後失效。`,
      })

      const actualCost =
        discountType === 'fixed' || discountType === 'fixed_amount'
          ? discountValue
          : Number.isFinite(maxDiscountAmount) && maxDiscountAmount > 0
            ? maxDiscountAmount
            : reservedCost

      await payload.update({
        collection: 'promotion-drop-claims' as never,
        id: claim.id as number,
        data: {
          status: 'granted',
          grantedAt: new Date().toISOString(),
          budgetCostAmount: actualCost,
          ...(couponId != null ? { coupon: couponId } : {}),
          ...(grantedRewardId != null ? { grantedReward: grantedRewardId } : {}),
        } as never,
        overrideAccess: true,
      })

      if (campaignKey) {
        result.costDelta.set(
          campaignKey,
          (result.costDelta.get(campaignKey) ?? 0) + (actualCost - reservedCost),
        )
      }
      result.granted += 1
    } catch (err) {
      result.failed += 1
      payload.logger.error({
        err,
        msg: '[paidRewardOrchestrator] 獎勵落地失敗（不阻斷付款流程）',
        orderNumber: args.orderNumber,
        idempotencyKey,
        intentType: intent.type,
      })
    }
  }

  return result
}

/**
 * 用實際成本與下單時預留成本的差額修正活動預算。
 *
 * 正負都要處理：抽到便宜的獎要把多佔的預算還回去，否則活動會提早顯示「預算用完」。
 * 走條件式 UPDATE 而不是讀出來再寫回去 —— 這張表同時被結帳鏈的預算預留寫入，
 * read-modify-write 會互相蓋掉。
 */
export async function applyBudgetCostDelta(
  payload: Payload,
  costDelta: Map<string, number>,
): Promise<void> {
  for (const [campaignId, delta] of costDelta) {
    const d = Math.round(delta)
    if (d === 0) continue
    try {
      if (d > 0) {
        await runSql(
          payload,
          sql`UPDATE marketing_campaigns
              SET commerce_budget_spent = COALESCE(commerce_budget_spent, 0) + ${d}
              WHERE id = ${Number(campaignId)}`,
        )
      } else {
        // 退回：用 WHERE 擋負數，不用 GREATEST（PG/SQLite 純量函式名不同）
        const back = -d
        const res = await runSql(
          payload,
          sql`UPDATE marketing_campaigns
              SET commerce_budget_spent = COALESCE(commerce_budget_spent, 0) - ${back}
              WHERE id = ${Number(campaignId)}
                AND COALESCE(commerce_budget_spent, 0) >= ${back}`,
        )
        if (affectedRows(res) === 0) {
          // 已用預算比要退的還少 = 對帳異常，記下來讓人工查，不要硬寫成負數
          payload.logger.warn({
            msg: '[paidRewardOrchestrator] 預算退回被擋（已用預算不足），請人工對帳',
            campaignId,
            back,
          })
        }
      }
    } catch (err) {
      payload.logger.error({ err, msg: '[paidRewardOrchestrator] 預算差額修正失敗', campaignId })
    }
  }
}
