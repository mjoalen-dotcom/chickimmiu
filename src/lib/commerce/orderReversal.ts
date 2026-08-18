/**
 * 訂單取消 / 退款的財務回沖（CHIC Commerce OS P0 缺口修補）
 *
 * 盤點發現的既有洩漏（非 Campaign Engine 引入，一併修掉）：
 * 1. 券：redemption 在 create 時就寫入、usageCount 也已 +1，但取消 / 退款完全不回沖
 *    → 每張取消單都永久吃掉一次券額度（含自動取消未付款單）。
 * 2. 點數：付款發點只寫 users.points，沒有 points-transactions ledger row，
 *    退款也不扣回 → 帳本無法重建、退款後點數照留。
 *
 * 本模組在 Orders.afterChange 進入終態（cancelled / refunded）時：
 * - 刪除該單的 coupon-redemptions 並原子遞減 coupons.usageCount（不低於 0）
 * - 依 purchase ledger row 扣回點數，並寫一筆 refund_deduct（負數）ledger
 * 全部 idempotent：以「該單是否已有 refund_deduct row」與 redemption 是否還在為準，
 * 重跑不會重複扣。促銷 applications / 活動預算的回沖在 lib/promotions/orderPricingHook.ts。
 */
// `sql` 只是 drizzle 的 template tag（兩個 adapter 都是同一份 re-export），
// 方言差異在 SQL 文字本身，不在這個 import。
import { sql } from '@payloadcms/db-sqlite'
import { runSql } from '../db/dialectSafeSql'
import { restorePoolInventory } from '../games/gameEngine'
import type { CollectionAfterChangeHook, Payload } from 'payload'

const relId = (v: unknown): number | string | null => {
  if (v == null) return null
  if (typeof v === 'object') return ((v as Record<string, unknown>).id as number | string) ?? null
  return v as number | string
}

/**
 * 條件式原子遞減 usageCount（避免 read-modify-write 競態，且不會變負數）。
 * 不用 MAX()/GREATEST()（方言不同），改用 WHERE 擋負數，語意相同且
 * SQLite/PG 都吃——詳見 lib/db/dialectSafeSql.ts。
 */
async function decrementCouponUsage(payload: Payload, couponId: number | string): Promise<void> {
  await runSql(
    payload,
    sql`UPDATE coupons
        SET usage_count = COALESCE(usage_count, 0) - 1
        WHERE id = ${Number(couponId)}
          AND COALESCE(usage_count, 0) > 0`,
  )
}

/**
 * 付款成功時補寫 purchase ledger row。
 * 由 Orders.afterChange 的發點區塊呼叫（users.points 已由呼叫端更新，這裡只補帳本）。
 * PointsTransactions 的 hooks 對 local API 是 no-op，所以不會重複加點。
 */
export async function writePurchasePointsLedger(
  payload: Payload,
  args: {
    userId: number | string
    orderId: number | string
    orderNumber?: string
    points: number
    balanceAfter: number
  },
): Promise<void> {
  if (args.points <= 0) return
  try {
    // idempotent：同一單同來源只寫一次
    const existing = await payload.count({
      collection: 'points-transactions',
      where: {
        and: [
          { user: { equals: args.userId } },
          { relatedOrder: { equals: args.orderId } },
          { source: { equals: 'purchase' } },
        ],
      },
      overrideAccess: true,
    })
    if (existing.totalDocs > 0) return
    await payload.create({
      collection: 'points-transactions',
      data: {
        user: args.userId,
        type: 'earn',
        amount: args.points,
        balance: args.balanceAfter,
        source: 'purchase',
        description: `訂單 ${args.orderNumber ?? args.orderId} 消費回饋`,
        relatedOrder: args.orderId,
      } as never,
      overrideAccess: true,
    })
  } catch (err) {
    // 帳本補寫失敗不影響已發放的點數（users.points 已更新），只記錄
    console.error('[orderReversal] purchase ledger 寫入失敗', err instanceof Error ? err.message : err)
  }
}

export const afterChangeReverseOrderFinancials: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
}) => {
  const status = (doc as Record<string, unknown>).status
  const prevStatus = (previousDoc as Record<string, unknown> | undefined)?.status
  const terminal = status === 'cancelled' || status === 'refunded'
  const wasTerminal = prevStatus === 'cancelled' || prevStatus === 'refunded'
  if (!terminal || wasTerminal) return doc

  const payload = req.payload
  const orderId = (doc as Record<string, unknown>).id as number | string
  const orderNumber = (doc as Record<string, unknown>).orderNumber as string | undefined

  // ── 1. 券額度回沖 ──────────────────────────────────────────────────────────
  try {
    const redemptions = await payload.find({
      collection: 'coupon-redemptions',
      where: { order: { equals: orderId } },
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    for (const raw of redemptions.docs as unknown as Array<Record<string, unknown>>) {
      const couponId = relId(raw.coupon)
      // 先刪 redemption（其 afterChange 只在 create 時加 usageCount，刪除不會再動）
      await payload.delete({
        collection: 'coupon-redemptions',
        id: raw.id as never,
        overrideAccess: true,
      })
      if (couponId != null) await decrementCouponUsage(payload, couponId)
    }
    if (redemptions.docs.length > 0) {
      payload.logger.info(
        `[orderReversal] ${orderNumber}: 回沖 ${redemptions.docs.length} 張券額度（${status}）`,
      )
    }
  } catch (err) {
    payload.logger.error({ err, msg: '[orderReversal] 券回沖失敗', orderId })
  }

  // ── 1.5 分潤佣金回沖 ───────────────────────────────────────────────────────
  // Orders.afterChange 在付款成功時累加 Affiliates.totalEarnings/pendingAmount
  // 並把 commissionStatus 標成 confirmed，但一直沒有對應的退款回沖——訂單退掉
  // 佣金卻留著，最後會變成可提領的真錢。
  //
  // 這條路徑在 2026-08-16 之前是死的（checkout 從不寫入 affiliateInfo.
  // referralCode，累加條件 commissionStatus==='pending' 永遠不成立），是分潤
  // 歸因接上結帳之後才變成實際會發生的漏洞，故一併補上。
  // 冪等：只處理 confirmed，處理完標成 cancelled，重跑不會重複扣。
  try {
    const aff = (doc as Record<string, unknown>).affiliateInfo as Record<string, unknown> | undefined
    const commission = Number(aff?.commissionAmount) || 0
    const affUserId = relId(aff?.affiliateUser)
    if (aff?.commissionStatus === 'confirmed' && commission > 0 && affUserId != null) {
      const affRes = await payload.find({
        collection: 'affiliates',
        where: { user: { equals: affUserId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const affDoc = affRes.docs[0] as unknown as Record<string, unknown> | undefined
      if (affDoc) {
        // 不讓任何一項變負數（可能已被 admin 手動調整過或部分已結算）
        await payload.update({
          collection: 'affiliates',
          id: affDoc.id as never,
          data: {
            totalEarnings: Math.max(0, (Number(affDoc.totalEarnings) || 0) - commission),
            pendingAmount: Math.max(0, (Number(affDoc.pendingAmount) || 0) - commission),
          } as never,
          overrideAccess: true,
        })
        await payload.update({
          collection: 'orders',
          id: orderId as never,
          data: {
            affiliateInfo: { ...aff, commissionStatus: 'cancelled' },
          } as never,
          overrideAccess: true,
        })
        payload.logger.info(
          `[orderReversal] ${orderNumber}: 回沖分潤佣金 NT$${commission}（${status}）`,
        )
      }
    }
  } catch (err) {
    payload.logger.error({ err, msg: '[orderReversal] 分潤佣金回沖失敗', orderId })
  }

  // ── 2. 點數扣回 ───────────────────────────────────────────────────────────
  try {
    const userId = relId((doc as Record<string, unknown>).customer)
    if (userId != null) {
      const earned = await payload.find({
        collection: 'points-transactions',
        where: {
          and: [
            { relatedOrder: { equals: orderId } },
            { source: { equals: 'purchase' } },
            { type: { equals: 'earn' } },
          ],
        },
        limit: 5,
        depth: 0,
        overrideAccess: true,
      })
      const alreadyReversed = await payload.count({
        collection: 'points-transactions',
        where: {
          and: [{ relatedOrder: { equals: orderId } }, { source: { equals: 'order_refund' } }],
        },
        overrideAccess: true,
      })
      const totalEarned = (earned.docs as unknown as Array<Record<string, unknown>>).reduce(
        (sum, row) => sum + (Number(row.amount) || 0),
        0,
      )
      if (totalEarned > 0 && alreadyReversed.totalDocs === 0) {
        const user = (await payload.findByID({
          collection: 'customers',
          id: userId as never,
          depth: 0,
          overrideAccess: true,
        })) as unknown as Record<string, unknown>
        const current = Number(user?.points) || 0
        // 不扣成負數：使用者可能已花掉部分點數（缺額由客服處理，不自動變負）
        const deduct = Math.min(current, totalEarned)
        const balanceAfter = current - deduct
        await payload.update({
          collection: 'customers',
          id: userId as never,
          data: { points: balanceAfter } as never,
          overrideAccess: true,
        })
        await payload.create({
          collection: 'points-transactions',
          data: {
            user: userId,
            type: 'refund_deduct',
            amount: -deduct,
            balance: balanceAfter,
            source: 'order_refund',
            description: `訂單 ${orderNumber ?? orderId} ${status === 'refunded' ? '退款' : '取消'}，回收消費回饋${
              deduct < totalEarned ? `（原發 ${totalEarned} 點，餘額不足僅回收 ${deduct} 點）` : ''
            }`,
            relatedOrder: orderId,
          } as never,
          overrideAccess: true,
        })
        payload.logger.info(`[orderReversal] ${orderNumber}: 回收 ${deduct} 點（${status}）`)
      }
    }
  } catch (err) {
    payload.logger.error({ err, msg: '[orderReversal] 點數回收失敗', orderId })
  }

  // ── 4. 限量券包 / 神秘禮物回沖 ─────────────────────────────────────────────
  //
  // 為什麼要新寫而不是沿用既有機制：Orders 的取消還原只撈 state='pending_attach'
  // 的 user-rewards，而促銷發的獎是 state='unused' —— 查詢條件永遠不匹配，
  // 退款完全不回沖已發出的獎。放寬那邊的 where 會誤傷 checkout 隨單寄出流程，
  // 所以在這裡另開一段。
  //
  // 四件事必須成套：quota、獎品庫存、獎項失效、活動預算。少一件就是單向漏。
  //
  // ⚠️ idempotencyKey 刻意**不刪**（Alan 2026-08-17 拍板「退款不恢復領取資格」）：
  // 刪掉的話「下單 → 退款 → 再領」就是無限刷。
  try {
    const claims = await payload.find({
      collection: 'promotion-drop-claims' as never,
      where: {
        and: [{ order: { equals: orderId } }, { status: { in: ['reserved', 'granted'] } }],
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    for (const raw of claims.docs as unknown as Array<Record<string, unknown>>) {
      const campaignId = relId(raw.campaign)

      // (a) 限量總量退回。用 WHERE 擋負數，不用 GREATEST（PG/SQLite 純量函式名不同）。
      //     只有真的扣過的才退，避免重複回沖把別人的額度也退掉。
      if (raw.quotaConsumed === true && campaignId != null) {
        await runSql(
          payload,
          sql`UPDATE marketing_campaigns
              SET commerce_drop_claimed = COALESCE(commerce_drop_claimed, 0) - 1
              WHERE id = ${Number(campaignId)}
                AND COALESCE(commerce_drop_claimed, 0) > 0`,
        ).catch((err) => payload.logger.error({ err, msg: '[orderReversal] drop quota 退回失敗' }))
      }

      // (b) 限量獎庫存還原
      const poolId = relId(raw.prizePool)
      if (poolId != null) await restorePoolInventory(payload, Number(poolId))

      // (c) 已發出的寶物作廢。UserRewards.state 沒有 'revoked'（實測 enum 只有
      //     unused / pending_attach / shipped / consumed / expired），用 'expired'
      //     + expiresAt=now 表達，可省一支 ALTER TYPE migration。
      const rewardId = relId(raw.grantedReward)
      if (rewardId != null) {
        await payload
          .update({
            collection: 'user-rewards',
            id: rewardId as never,
            data: { state: 'expired', expiresAt: new Date().toISOString() } as never,
            overrideAccess: true,
          })
          .catch((err) => payload.logger.error({ err, msg: '[orderReversal] 獎項作廢失敗', rewardId }))
      }

      // (d) 動態產生的 drop 券停用
      const couponId = relId(raw.coupon)
      if (couponId != null) {
        await payload
          .update({
            collection: 'coupons',
            id: couponId as never,
            data: { isActive: false } as never,
            overrideAccess: true,
          })
          .catch((err) => payload.logger.error({ err, msg: '[orderReversal] drop 券停用失敗', couponId }))
      }

      // (e) 活動預算退回實際佔用的成本
      const cost = Number(raw.budgetCostAmount) || 0
      if (cost > 0 && campaignId != null) {
        await runSql(
          payload,
          sql`UPDATE marketing_campaigns
              SET commerce_budget_spent = COALESCE(commerce_budget_spent, 0) - ${cost}
              WHERE id = ${Number(campaignId)}
                AND COALESCE(commerce_budget_spent, 0) >= ${cost}`,
        ).catch((err) => payload.logger.error({ err, msg: '[orderReversal] drop 預算退回失敗' }))
      }

      await payload.update({
        collection: 'promotion-drop-claims' as never,
        id: raw.id as never,
        data: {
          status: 'reversed',
          reversedAt: new Date().toISOString(),
          reversalReason: `order_${status}`,
        } as never,
        overrideAccess: true,
      })
    }
    if (claims.docs.length > 0) {
      payload.logger.info(
        `[orderReversal] ${orderNumber}: 回沖 ${claims.docs.length} 筆限量領取（${status}）`,
      )
    }
  } catch (err) {
    payload.logger.error({ err, msg: '[orderReversal] 限量券包／神秘禮物回沖失敗', orderId })
  }

  return doc
}
