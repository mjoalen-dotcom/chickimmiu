import { NextRequest } from 'next/server'
import type { PayloadRequest, Where } from 'payload'

import {
  requireCustomer,
  getActivitySettings,
  ok,
  fail,
  CODES,
} from '@/lib/app-activities/common'
import { awardActivityPoints } from '@/lib/app-activities/award'

/**
 * POST /api/app/travel/read-claim
 * ──────────────────────────────
 * body: { articleId: string, articleTitle?: string }
 *
 * 工單 2026-08-25 活動一：
 *   ‧ 發點由後端執行，App 不指定數量（共通規則 #3）—— 點數一律取自後台設定
 *   ‧ 冪等：同一篇文章只能領一次（user + articleId 複合唯一索引）
 *   ‧ 建立紀錄與加值在同一交易內完成，避免「已記錄、但點數未加」的半套失敗
 *
 * 後端不驗證閱讀行為本身（閱讀時間與捲動深度由 App 判斷，伺服器無從查核）——
 * 單篇金額小、每篇限領一次，總量有天花板。
 */
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')

    const body = (await req.json().catch(() => ({}))) as {
      articleId?: string
      articleTitle?: string
    }
    const articleId = (body.articleId || '').trim()
    const articleTitle = (body.articleTitle || '').trim().slice(0, 300)
    if (!articleId) return fail(400, CODES.BAD_REQUEST, '缺少 articleId')

    const settings = await getActivitySettings(payload)
    if (!settings.travelRead.isActive) {
      return fail(403, CODES.ACTIVITY_INACTIVE, '活動未開放')
    }

    // 冪等（先查，命中直接回；並發時靠唯一索引在下面兜底）
    const existing = await payload.find({
      collection: 'travel-read-rewards',
      where: {
        and: [{ user: { equals: user.id } }, { articleId: { equals: articleId } }],
      } as Where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      return fail(409, CODES.ALREADY_CLAIMED, '這篇文章已經領過了')
    }

    const points = settings.travelRead.pointsPerArticle
    const transactionID = await payload.db.beginTransaction()
    if (transactionID == null) {
      return fail(503, CODES.INTERNAL_ERROR, '系統忙碌中，請稍後再試')
    }

    try {
      await payload.create({
        collection: 'travel-read-rewards',
        data: {
          user: user.id,
          articleId,
          articleTitle,
          pointsAwarded: points,
          claimedAt: new Date().toISOString(),
        } as never,
        overrideAccess: true,
        req: { transactionID } as PayloadRequest,
      })

      const result = await awardActivityPoints(payload, {
        userId: user.id,
        amount: points,
        source: 'travel_article_read',
        description: `閱讀愛旅遊文章：${articleTitle || articleId}`,
        existingTransactionID: transactionID,
      })

      await payload.db.commitTransaction(transactionID)
      return ok({
        articleId,
        pointsAwarded: result.awarded,
        balance: result.balance,
      })
    } catch (err) {
      await payload.db.rollbackTransaction(transactionID)
      // 並發下另一個請求先插入 → 撞 user+articleId 唯一索引
      const msg = err instanceof Error ? err.message : String(err)
      if (/unique|duplicate/i.test(msg)) {
        return fail(409, CODES.ALREADY_CLAIMED, '這篇文章已經領過了')
      }
      throw err
    }
  } catch (err) {
    console.error('[app/travel/read-claim] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}
