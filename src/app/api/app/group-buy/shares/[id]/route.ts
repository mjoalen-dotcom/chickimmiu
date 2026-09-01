import { NextRequest } from 'next/server'
import type { Where } from 'payload'

import {
  requireCustomer,
  getActivitySettings,
  hitBannedWord,
  ok,
  fail,
  CODES,
} from '@/lib/app-activities/common'
import { visibilityWhere, serializeShare, validateMediaIds } from '@/lib/app-activities/groupBuy'

/**
 * GET    /api/app/group-buy/shares/[id]   讀取單篇（送出或編輯後 App 需重讀以更新畫面）
 * PATCH  /api/app/group-buy/shares/[id]   編輯（僅 content 與 photos）
 * DELETE /api/app/group-buy/shares/[id]   軟刪除（status: 'deleted'）
 * ────────────────────────────────────────────────────────────────────────────
 * 工單 2026-08-25 活動二：
 *   ‧ 編輯只能改內容與照片。綁定文章、訂單編號、購買日期一律不可更改 ——
 *     這三項是發獎與去重的依據，可改等同於繞過驗證。要換請刪除後重發。
 *   ‧ pending / approved / rejected 三種狀態在期限內都可編輯，編輯後一律轉回 pending
 *     重新審核（否則可先送乾淨內容過審再改成違規內容）。退回重審不重複發獎。
 *   ‧ editableUntil 一律以建立時間 + 設定時數計算，與審核進度無關；逾期不可編輯 ——
 *     刻意如此，避免「等審完再改」成為繞過審核的路徑。
 *   ‧ 編輯替換照片時，舊的 media 不刪除（可能被其他內容引用）。
 *   ‧ 刪除為軟刪除，訂單去重紀錄不釋放。
 */
export const dynamic = 'force-dynamic'

async function loadOwn(payload: unknown, id: string, userId: string | number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any
  const res = await p.find({
    collection: 'group-buy-shares',
    where: { and: [{ id: { equals: id } }, { user: { equals: userId } }] } as Where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs[0] as Record<string, unknown> | undefined
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')
    const { id } = await ctx.params

    const res = await payload.find({
      collection: 'group-buy-shares',
      where: { and: [{ id: { equals: id } }, visibilityWhere(user.id)] } as Where,
      limit: 1,
      depth: 2,
      overrideAccess: true,
    })
    const doc = res.docs[0]
    if (!doc) return fail(404, CODES.NOT_FOUND, '找不到這篇分享')
    return ok(serializeShare(doc, user.id))
  } catch (err) {
    console.error('[app/group-buy/shares/:id GET] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')
    const { id } = await ctx.params

    const settings = await getActivitySettings(payload)
    const cfg = settings.groupBuyShare
    if (!cfg.isActive) return fail(403, CODES.ACTIVITY_INACTIVE, '活動未開放')

    const doc = await loadOwn(payload, id, user.id)
    if (!doc) return fail(404, CODES.NOT_FOUND, '找不到這篇分享')
    if (doc.status === 'deleted') return fail(404, CODES.NOT_FOUND, '這篇分享已刪除')

    const until = doc.editableUntil ? new Date(doc.editableUntil as string).getTime() : 0
    if (!until || Date.now() > until) {
      return fail(403, CODES.EDIT_WINDOW_CLOSED, '已超過可編輯期限', {
        editableUntil: doc.editableUntil ?? null,
      })
    }

    const body = (await req.json().catch(() => ({}))) as {
      content?: string
      photoIds?: Array<string | number>
    }
    const data: Record<string, unknown> = {}

    if (typeof body.content === 'string') {
      const content = body.content.trim()
      if (content.length < cfg.minContentLength) {
        return fail(400, CODES.CONTENT_TOO_SHORT, '分享內容太短', {
          minContentLength: cfg.minContentLength,
        })
      }
      if (hitBannedWord(content, cfg.bannedWords)) {
        return fail(400, CODES.BANNED_WORD, '內容含有不允許的字詞')
      }
      data.content = content
    }

    if (Array.isArray(body.photoIds)) {
      const photoIds = body.photoIds.filter((v) => v != null)
      if (photoIds.length < 1) return fail(400, CODES.PHOTO_REQUIRED, '請至少保留 1 張照片')
      if (photoIds.length > cfg.maxImages) {
        return fail(400, CODES.TOO_MANY_PHOTOS, '照片張數超過上限', { maxImages: cfg.maxImages })
      }
      if (!(await validateMediaIds(payload, photoIds))) {
        return fail(400, CODES.INVALID_MEDIA, '照片無效，請重新上傳')
      }
      // 舊 media 不刪除（可能被其他內容引用）
      data.photos = photoIds.map((mid) => ({ image: mid }))
    }

    if (Object.keys(data).length === 0) {
      return fail(400, CODES.BAD_REQUEST, '沒有可更新的欄位（僅能改內容與照片）')
    }

    // 編輯一律轉回 pending 重新審核；rewarded 不動（退回重審不重複發獎）
    data.status = 'pending'

    await payload.update({
      collection: 'group-buy-shares',
      id,
      data: data as never,
      overrideAccess: true,
    })

    return ok({ id, status: 'pending' })
  } catch (err) {
    console.error('[app/group-buy/shares/:id PATCH] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')
    const { id } = await ctx.params

    const doc = await loadOwn(payload, id, user.id)
    if (!doc) return fail(404, CODES.NOT_FOUND, '找不到這篇分享')

    // 軟刪除；訂單去重紀錄刻意不釋放（否則換帳號即可繞過）
    await payload.update({
      collection: 'group-buy-shares',
      id,
      data: { status: 'deleted' } as never,
      overrideAccess: true,
    })
    return ok({ id, status: 'deleted' })
  } catch (err) {
    console.error('[app/group-buy/shares/:id DELETE] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}
