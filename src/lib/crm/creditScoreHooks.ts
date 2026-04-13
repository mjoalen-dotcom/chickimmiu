/**
 * 信用分數 Payload Hooks
 * ─────────────────────────────────────
 * 嵌入 Orders、Returns、ProductReviews 的 afterChange hooks
 * 自動觸發信用分數加扣分與溫馨通知
 *
 * 所有 hook 函式都是獨立的，可安全地被各 Collection 引用。
 * 每個函式都包含完整的錯誤處理，不會因為信用分數計算失敗而影響主流程。
 */

import type { CollectionAfterChangeHook } from 'payload'
import {
  adjustCreditScore,
  calculateReturnPenalty,
  calculatePurchaseAmountBonus,
  checkReturnRatePenalty,
  getCreditChangeNotification,
  getCreditStatus,
  type CreditScoreReason,
} from './creditScoreEngine'

// ═══════════════════════════════════════
// ── Orders afterChange Hook ──
// ═══════════════════════════════════════

/**
 * 訂單狀態變更時觸發信用分數調整
 *
 * - 訂單送達（delivered）：+8 基礎 + 金額加成（每 NT$1000 額外 +2，上限 +10）+ 準時收貨 +5
 * - 訂單取消（cancelled）：棄單 -6 或惡意取消 -20
 * - 首購偵測：首次購買額外 +15
 */
export const orderCreditScoreHook: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  try {
    const status = doc.status as string
    const prevStatus = previousDoc?.status as string | undefined
    const customerId = typeof doc.customer === 'string'
      ? doc.customer
      : (doc.customer as unknown as Record<string, unknown>)?.id as unknown as string

    if (!customerId) return doc

    // ── 訂單送達：加分 ──
    if (status === 'delivered' && prevStatus !== 'delivered') {
      const orderTotal = (doc.total as number) ?? 0
      const orderId = doc.id as unknown as string

      // 基礎購買加分 +8
      const result = await adjustCreditScore({
        userId: customerId,
        reason: 'purchase',
        description: `訂單 ${doc.orderNumber} 已送達`,
        relatedOrderId: orderId,
      })

      // 金額加成（每 NT$1000 額外 +2，上限 +10）
      const amountBonus = calculatePurchaseAmountBonus(orderTotal)
      if (amountBonus > 0) {
        await adjustCreditScore({
          userId: customerId,
          reason: 'purchase',
          customChange: amountBonus,
          description: `訂單 ${doc.orderNumber} 金額加成（NT$${orderTotal.toLocaleString()}）`,
          relatedOrderId: orderId,
        })
      }

      // 準時收貨加分 +5
      await adjustCreditScore({
        userId: customerId,
        reason: 'on_time_delivery',
        description: `訂單 ${doc.orderNumber} 準時收貨`,
        relatedOrderId: orderId,
      })

      // 首購偵測
      try {
        const orderCount = await req.payload.find({
          collection: 'orders',
          where: {
            customer: { equals: customerId },
            status: { equals: 'delivered' },
          },
          limit: 0,
        })
        if (orderCount.totalDocs === 1) {
          await adjustCreditScore({
            userId: customerId,
            reason: 'first_purchase',
            description: '首次購買完成',
            relatedOrderId: orderId,
          })
          console.log(`[CreditScore] 首購加分：會員 ${customerId}`)
        }
      } catch { /* ignore first purchase check failure */ }

      // 好客人表揚（分數 >= 95）
      if (result.newScore >= 95) {
        await adjustCreditScore({
          userId: customerId,
          reason: 'good_customer_reward',
          description: '好客人表揚獎勵',
          relatedOrderId: orderId,
        })
      }

      const notification = getCreditChangeNotification(
        result.change,
        result.newScore,
        '訂單送達',
      )
      console.log(`[CreditScore] 訂單送達：${customerId} ${result.change > 0 ? '+' : ''}${result.change} → ${result.newScore} | ${notification.title}`)
    }

    // ── 訂單取消：扣分 ──
    if (status === 'cancelled' && prevStatus !== 'cancelled') {
      const orderId = doc.id as unknown as string
      const cancelledByCustomer = (doc.cancelledBy as string) === 'customer'

      if (cancelledByCustomer) {
        // 判斷是否惡意取消（例如短時間內多次取消）
        let cancelCount = 0
        try {
          const recentCancels = await req.payload.find({
            collection: 'orders',
            where: {
              customer: { equals: customerId },
              status: { equals: 'cancelled' },
              createdAt: {
                greater_than: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              },
            },
            limit: 0,
          })
          cancelCount = recentCancels.totalDocs
        } catch { /* ignore */ }

        const reason: CreditScoreReason = cancelCount >= 3 ? 'malicious_cancel' : 'abandoned_cart'
        const result = await adjustCreditScore({
          userId: customerId,
          reason,
          description: cancelCount >= 3
            ? `7天內第${cancelCount}次取消訂單（惡意取消）`
            : `訂單 ${doc.orderNumber} 已取消`,
          relatedOrderId: orderId,
        })

        const notification = getCreditChangeNotification(result.change, result.newScore, '訂單取消')
        console.log(`[CreditScore] 訂單取消：${customerId} ${result.change} → ${result.newScore} | ${notification.message}`)
      }
    }
  } catch (err) {
    console.error('[CreditScore Hook] 訂單信用分數處理失敗:', err)
  }

  return doc
}

// ═══════════════════════════════════════
// ── Returns afterChange Hook ──
// ═══════════════════════════════════════

/**
 * 退貨狀態變更時觸發信用分數扣分
 *
 * - 退貨核准（approved）：依金額比例 -8~-15 或無理由 -25/-35/-50
 * - 30天退貨率 > 40%：額外 -15
 * - 退貨被拒（rejected）：不扣分
 */
export const returnCreditScoreHook: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
}) => {
  try {
    const status = doc.status as string
    const prevStatus = previousDoc?.status as string | undefined
    const customerId = typeof doc.customer === 'string'
      ? doc.customer
      : (doc.customer as unknown as Record<string, unknown>)?.id as unknown as string

    if (!customerId) return doc

    // ── 退貨核准：扣分 ──
    if (status === 'approved' && prevStatus !== 'approved') {
      const returnId = doc.id as unknown as string
      const refundAmount = (doc.refundAmount as number) ?? 0
      const items = doc.items as { reason?: string; quantity?: number }[]

      // 判斷是否為無理由退貨
      const isNoReason = items.some(
        (item) => item.reason === 'not_wanted',
      )

      // 查詢連續無理由退貨次數
      let consecutiveNoReasonReturns = 0
      if (isNoReason) {
        try {
          const recentReturns = await req.payload.find({
            collection: 'returns',
            where: {
              customer: { equals: customerId },
              status: { in: ['approved', 'returning', 'received', 'refunded'] },
            },
            sort: '-createdAt',
            limit: 10,
          })

          for (const ret of recentReturns.docs) {
            const retItems = (ret as unknown as Record<string, unknown>).items as { reason?: string }[]
            if (retItems?.some((i) => i.reason === 'not_wanted')) {
              consecutiveNoReasonReturns++
            } else {
              break // 遇到非無理由退貨就停止計數
            }
          }
        } catch { /* ignore */ }
      }

      // 取得原訂單金額
      let orderTotal = 0
      try {
        const orderId = typeof doc.order === 'string' ? doc.order : (doc.order as unknown as Record<string, unknown>)?.id as unknown as string
        if (orderId) {
          const order = await req.payload.findByID({ collection: 'orders', id: orderId })
          orderTotal = (order.total as number) ?? 0
        }
      } catch { /* ignore */ }

      // 計算退貨扣分
      const penalty = calculateReturnPenalty({
        returnAmount: refundAmount,
        orderTotal,
        consecutiveNoReasonReturns,
        isNoReason,
      })

      const reason: CreditScoreReason = isNoReason
        ? (consecutiveNoReasonReturns >= 3 ? 'return_malicious' : 'return_no_reason')
        : 'return_general'

      const result = await adjustCreditScore({
        userId: customerId,
        reason,
        customChange: penalty,
        description: isNoReason
          ? `無理由退貨（第${consecutiveNoReasonReturns}次）退款 NT$${refundAmount.toLocaleString()}`
          : `一般退貨 退款 NT$${refundAmount.toLocaleString()}`,
        relatedReturnId: returnId,
        relatedOrderId: typeof doc.order === 'string' ? doc.order : undefined,
        metadata: {
          isNoReason,
          consecutiveNoReasonReturns,
          returnAmount: refundAmount,
          orderTotal,
        },
      })

      // 檢查 30 天退貨率
      const ratePenalty = await checkReturnRatePenalty(customerId)
      if (ratePenalty < 0) {
        await adjustCreditScore({
          userId: customerId,
          reason: 'return_rate_penalty',
          customChange: ratePenalty,
          description: '30天內退貨率超過 40%，額外扣分',
          relatedReturnId: returnId,
        })
        console.log(`[CreditScore] 高退貨率額外扣分：${customerId} ${ratePenalty}`)
      }

      // 更新 User 黑名單狀態
      const newStatus = getCreditStatus(result.newScore)
      if (newStatus === 'blacklist' || newStatus === 'suspended') {
        await req.payload.update({
          collection: 'users',
          id: customerId,
          data: {
            isBlacklisted: true,
            blacklistReason: `信用分數 ${result.newScore} 分（退貨導致）`,
            isSuspended: newStatus === 'suspended',
            creditStatus: newStatus,
          } as unknown as Record<string, unknown>,
        })
      }

      const notification = getCreditChangeNotification(penalty, result.newScore, '退貨')
      console.log(`[CreditScore] 退貨扣分：${customerId} ${penalty} → ${result.newScore} | ${notification.severity}: ${notification.message}`)
    }
  } catch (err) {
    console.error('[CreditScore Hook] 退貨信用分數處理失敗:', err)
  }

  return doc
}

// ═══════════════════════════════════════
// ── ProductReviews afterChange Hook ──
// ═══════════════════════════════════════

/**
 * 評價審核通過時觸發信用分數加分
 *
 * - 文字好評（rating >= 4）：+10
 * - 附圖好評：+12
 */
export const reviewCreditScoreHook: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
}) => {
  try {
    const status = doc.status as string
    const prevStatus = previousDoc?.status as string | undefined
    const rating = (doc.rating as number) ?? 0
    const authorId = typeof doc.author === 'string'
      ? doc.author
      : (doc.author as unknown as Record<string, unknown>)?.id as unknown as string

    if (!authorId) return doc

    // 審核通過且為好評（4 星以上）
    if (status === 'approved' && prevStatus !== 'approved' && rating >= 4) {
      const photos = doc.photos as unknown[] | undefined
      const hasPhotos = Boolean(photos && photos.length > 0)

      const result = await adjustCreditScore({
        userId: authorId,
        reason: hasPhotos ? 'photo_review' : 'good_review',
        description: hasPhotos
          ? `附圖好評（${rating} 星）`
          : `文字好評（${rating} 星）`,
      })

      console.log(`[CreditScore] 好評加分：${authorId} +${result.change} → ${result.newScore}`)
    }
  } catch (err) {
    console.error('[CreditScore Hook] 評價信用分數處理失敗:', err)
  }

  return doc
}
