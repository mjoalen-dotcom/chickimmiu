import { NextRequest } from 'next/server'
import type { Where } from 'payload'

import { requireCustomer, ok, fail, CODES } from '@/lib/app-activities/common'

/**
 * POST /api/app/reports
 * ─────────────────────
 * 檢舉分享或留言（工單 2026-08-25 活動二「檢舉」）。
 *
 * body: { targetType: 'review'|'comment', targetId: number,
 *         reason: 'spam'|'false_info'|'harassment'|'explicit'|'other',
 *         reasonDetail?: string }
 *
 * review / reporter / targetUser 由後端依 token 與被檢舉內容自行判定，不由 App 傳入。
 * 冪等：同一會員對同一目標只能檢舉一次，重複送出回 ALREADY_REPORTED（App 以此
 * 切換「已檢舉」UI —— 明確回錯誤碼，不讓 App 用其他 side-channel 推斷）。
 *
 * 不產生即時後果：隱藏由後台人工審核後操作，本端點只寫紀錄。
 * 活動開關關閉時檢舉不受影響（工單指定）。
 */
export const dynamic = 'force-dynamic'

const REASONS = new Set(['spam', 'false_info', 'harassment', 'explicit', 'other'])

export async function POST(req: NextRequest) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')

    const body = (await req.json().catch(() => ({}))) as {
      targetType?: string
      targetId?: number | string
      reason?: string
      reasonDetail?: string
    }
    const targetType = (body.targetType || '').trim()
    const targetId = Number(body.targetId)
    const reason = (body.reason || '').trim()

    if (targetType !== 'review' && targetType !== 'comment') {
      return fail(400, CODES.BAD_REQUEST, 'targetType 必須是 review 或 comment')
    }
    if (!Number.isFinite(targetId)) return fail(400, CODES.BAD_REQUEST, 'targetId 格式錯誤')
    if (!REASONS.has(reason)) return fail(400, CODES.BAD_REQUEST, 'reason 不在允許清單')

    // 找出被檢舉內容 → 決定 review 與 targetUser
    let reviewId: string | number | null = null
    let targetUserId: string | number | null = null

    if (targetType === 'review') {
      const r = await payload.find({
        collection: 'group-buy-shares',
        where: { id: { equals: targetId } } as Where,
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const doc = r.docs[0] as unknown as Record<string, unknown> | undefined
      if (!doc) return fail(404, CODES.NOT_FOUND, '找不到被檢舉的內容')
      reviewId = doc.id as string | number
      targetUserId =
        typeof doc.user === 'object' && doc.user !== null
          ? ((doc.user as Record<string, unknown>).id as string | number)
          : (doc.user as string | number)
    } else {
      const r = await payload.find({
        collection: 'group-buy-share-comments',
        where: { id: { equals: targetId } } as Where,
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const doc = r.docs[0] as unknown as Record<string, unknown> | undefined
      if (!doc) return fail(404, CODES.NOT_FOUND, '找不到被檢舉的內容')
      // 檢舉留言時，review 填該留言所屬的分享（後台才能一鍵跳到現場）
      reviewId =
        typeof doc.review === 'object' && doc.review !== null
          ? ((doc.review as Record<string, unknown>).id as string | number)
          : (doc.review as string | number)
      targetUserId =
        typeof doc.user === 'object' && doc.user !== null
          ? ((doc.user as Record<string, unknown>).id as string | number)
          : (doc.user as string | number)
    }

    // 冪等（先查；並發時靠唯一索引兜底）
    const dup = await payload.find({
      collection: 'content-reports',
      where: {
        and: [
          { targetType: { equals: targetType } },
          { targetId: { equals: targetId } },
          { reporter: { equals: user.id } },
        ],
      } as Where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (dup.docs.length > 0) {
      return fail(409, CODES.ALREADY_REPORTED, '你已經檢舉過這則內容')
    }

    try {
      await payload.create({
        collection: 'content-reports',
        data: {
          targetType,
          targetId,
          review: reviewId,
          reporter: user.id,
          targetUser: targetUserId,
          reason,
          // 僅「其他」會有值，其餘存空字串（後台不必分辨 missing 與空值）
          reasonDetail: reason === 'other' ? (body.reasonDetail || '').trim() : '',
          status: 'pending',
        } as never,
        overrideAccess: true,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/unique|duplicate/i.test(msg)) {
        return fail(409, CODES.ALREADY_REPORTED, '你已經檢舉過這則內容')
      }
      throw err
    }

    return ok({ reported: true })
  } catch (err) {
    console.error('[app/reports] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}
