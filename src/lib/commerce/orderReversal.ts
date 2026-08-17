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
import { getDrizzle } from '../db/dialectSafeSql'
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
  const drizzle = getDrizzle(payload)
  await drizzle.run(
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

  return doc
}
